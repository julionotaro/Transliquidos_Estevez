// ===== CORRELACIONADOR v3.2: dos pasadas + match determinista + guardas + estado_lectura =====
//
// Logica del nodo Code "Formatear Linea Gesruta" del workflow [ESTEVEZ] Ingesta
// Viaje (WD0q9Ic0oDvUoJwp). Extraida aqui para que el repo sea la fuente de verdad
// y no se separe del workflow en silencio (ESTADO-Y-TRASPASO §4).
//
// Cambio v3.1 -> v3.2: NADA de la logica de correlacion ni de las guardas. Lo unico
// que cambia es que las guardas ahora marcan LA FILA, no solo el texto global.
//
//   estado_lectura   'OK' | 'REVISAR'
//   motivo_revision  por que quedo en REVISAR
//   pagina_origen    pagina del PDF de la que salio el viaje (trazabilidad)
//
// El defecto que corrige: en v3.1 las guardas escribian en un blob de texto y la
// fila se persistia igual en la tabla Viajes con estado 'pendiente'. Un viaje con
// el odometro ANULADO por la guarda del multiplo de 500 entraba indistinguible de
// uno bien leido. Mismo principio que el validador: un dato no confiable jamas
// puede parecerse a uno verificado.
//
// El informe de texto y el `datos_json` conservan exactamente el formato de v3.1;
// los campos nuevos son aditivos. El test de regresion compara el informe generado
// por este modulo contra el del fuente original, caracter a caracter.

// --- Estados de lectura ---
var ESTADO_LECTURA = { OK: 'OK', REVISAR: 'REVISAR' };

// Logging estandar del runtime, visible en el log de ejecucion de n8n.
var LOG_ACTIVO = true;
function setLogActivo(v) { LOG_ACTIVO = !!v; }
function logInfo(msg) { if (LOG_ACTIVO) { console.log('[ficha] ' + msg); } }
function logError(msg) { if (LOG_ACTIVO) { console.error('[ficha] ERROR ' + msg); } }

var nz = function (x) { if (x === null || x === undefined) { return null; } if (typeof x === 'string') { const s = x.trim(); return (s === '' || s.toLowerCase() === 'null') ? null : x; } return x; };
// num() devuelve null para 0: el marcador 0 que el modelo copiaba del esquema
// nunca debe entrar como dato (ESTADO §4, error 2).
var num = function (x) { if (typeof x === 'number') { return (isFinite(x) && x !== 0) ? x : null; } if (typeof x === 'string' && x.trim() !== '') { const n = Number(x.replace(/\./g, '').replace(',', '.')); return (isFinite(n) && n !== 0) ? n : null; } return null; };
var mat = function (x) { return (x || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, ''); };
var upp = function (x) { return (x || '').toString().toUpperCase(); };
var dias = function (a, b) { if (!a || !b) { return null; } const da = Date.parse(a + 'T00:00:00Z'); const db = Date.parse(b + 'T00:00:00Z'); if (!isFinite(da) || !isFinite(db)) { return null; } return Math.round((db - da) / 86400000); };

/**
 * Correlaciona la pasada de fichas (rA) con la de documentos (rB).
 *
 * @param {object|null} rA JSON de la pasada de fichas   ({hojas:[...]}).
 * @param {object|null} rB JSON de la pasada de documentos ({documentos:[...]}).
 * @returns {{ok:boolean, hojas:Array, viajes:Array, documentos:Array,
 *            errores:Array, avisos:Array}}
 */
function correlacionar(rA, rB, docaiPorPagina) {
  if (!rA) {
    logError('la pasada de FICHAS no devolvio JSON valido');
    return { ok: false, hojas: [], viajes: [], documentos: [], errores: [], avisos: [] };
  }
  docaiPorPagina = docaiPorPagina || {};
  // Document AI esta "activo" solo si el canal aporto lecturas. Sin eso, el
  // correlacionador se comporta EXACTAMENTE como antes (odometros de gpt-4o, sin
  // campos ni guardas nuevas) — la regresion queda intacta.
  const docaiActivo = Object.keys(docaiPorPagina).length > 0;
  const hojasRaw = Array.isArray(rA.hojas) ? rA.hojas : [];
  const docsRaw = (rB && Array.isArray(rB.documentos)) ? rB.documentos : [];

  const errores = []; const avisos = [];
  const ANIO_HOY = new Date().getFullYear();

  // Marca la fila i para revision humana y registra el motivo, ademas de dejar
  // el mensaje en la lista global (que es lo que ya lee la oficina).
  const marcar = function (v, motivo) { v.motivos_revision.push(motivo); };

  // ---- Viajes desde las fichas ----
  // FUSION Document AI: km_inicio/km_final vienen de Document AI (lector de
  // odometros) cuando esta disponible; el resto de los campos, de gpt-4o. El
  // km_recorridos escrito lo sigue leyendo gpt-4o y se usa SOLO como contexto,
  // nunca para corregir un odometro (encargo integracion §3).
  const viajes = [];
  for (let h = 0; h < hojasRaw.length; h++) {
    const H = hojasRaw[h];
    const bloques = Array.isArray(H.bloques) ? H.bloques : [];
    const paginaH = (typeof H.pagina === 'number' && isFinite(H.pagina)) ? H.pagina : null;
    for (let i = 0; i < bloques.length; i++) {
      const b = bloques[i];
      const v = {
        hoja_idx: h, orden: num(b.orden) || (i + 1),
        conductor: nz(H.conductor), tractora: nz(H.tractora), remolque: nz(H.remolque), empresa: nz(H.empresa),
        tractoraN: mat(H.tractora),
        pagina_origen: paginaH,
        fecha_carga: nz(b.fecha_carga), fecha_carga_texto: nz(b.fecha_carga_texto), fecha_descarga: nz(b.fecha_descarga),
        nombre_carga: nz(b.nombre_carga), lugar_carga: nz(b.lugar_carga),
        nombre_descarga: nz(b.nombre_descarga), lugar_descarga: nz(b.lugar_descarga),
        tipo_mercancia: nz(b.tipo_mercancia), cantidad_kg: num(b.cantidad_kg),
        km_inicio: num(b.km_inicio), km_final: num(b.km_final), km_recorridos: num(b.km_recorridos),
        motivos_revision: [],
        docs: []
      };
      // FUSION Document AI (solo si el canal aporto lecturas): km_inicio/km_final
      // pasan a venir de Document AI (banda de km del viaje `orden` de la pagina).
      if (docaiActivo) {
        v.km_inicio_gpt = v.km_inicio; v.km_final_gpt = v.km_final;
        v.fuente_odometro = 'gpt4o'; v.docai = null;
        const dp = (v.pagina_origen != null) ? docaiPorPagina[v.pagina_origen] : null;
        const dband = dp ? dp['km_v' + v.orden] : null;
        if (dband) {
          v.docai = dband;
          v.fuente_odometro = 'docai';
          v.km_inicio = (dband.inicio && dband.inicio.valor != null) ? dband.inicio.valor : null;
          v.km_final = (dband.final && dband.final.valor != null) ? dband.final.valor : null;
        }
      }
      viajes.push(v);
    }
  }
  if (viajes.length === 0) { errores.push('No se detecto ninguna ficha de chofer con bloques rellenos.'); }

  // ---- GUARDA Document AI: confianza/formato de los odometros ----
  // Solo si Document AI esta activo. Un odometro se acepta solo si NO es malformado
  // Y conf >= umbral (la decision ok/motivo la trae ya evaluada docai.js). El
  // km_recorridos escrito (gpt-4o) se agrega al motivo como contexto para el
  // humano; NO cambia la decision ni corrige el valor. La guarda de consistencia
  // (final-inicio vs recorridos, mas abajo) sigue existiendo aparte, no se duplica.
  for (let i = 0; docaiActivo && i < viajes.length; i++) {
    const v = viajes[i];
    if (v.fuente_odometro !== 'docai' || !v.docai) {
      // Document AI no leyo este viaje: sus km no estan verificados por el lector
      // confiable. No se confia en el km de gpt-4o en silencio.
      marcar(v, 'odometros sin lectura de Document AI (no verificados)');
      continue;
    }
    ['inicio', 'final'].forEach(function (campo) {
      const c = v.docai[campo];
      if (!c || c.ok) { return; }
      let motivo;
      if (c.motivo === 'formato_invalido_docai') {
        motivo = 'km_' + campo + ' con formato invalido leido por Document AI ("' + (c.raw || '') + '")';
      } else {
        motivo = 'km_' + campo + ' con baja confianza de Document AI (' + (typeof c.conf === 'number' ? c.conf.toFixed(3) : '?') + ')';
      }
      // Contexto (§3): el km_recorridos escrito como pista, nunca como corrector.
      if (v.km_recorridos !== null && v.km_inicio !== null && v.km_final !== null) {
        const consistente = Math.abs((v.km_final - v.km_inicio) - v.km_recorridos) <= 5;
        motivo += consistente
          ? '; el km_recorridos escrito (' + v.km_recorridos + ') SI es consistente con lo leido'
          : '; el km_recorridos escrito (' + v.km_recorridos + ') NO coincide con lo leido';
      }
      marcar(v, motivo);
    });
  }

  // ---- GUARDA A: ano fuera de rango (mala lectura del ano en el manuscrito) ----
  // Se aplica ANTES del match porque la fecha se usa para desempatar documentos.
  for (let i = 0; i < viajes.length; i++) {
    const v = viajes[i];
    if (!v.fecha_carga) { continue; }
    const y = Number(String(v.fecha_carga).slice(0, 4));
    if (isFinite(y) && (y < ANIO_HOY - 1 || y > ANIO_HOY + 1)) {
      errores.push('Viaje ' + (i + 1) + ': fecha ' + v.fecha_carga + ' (ano ' + y + ') fuera del rango razonable. Ano mal leido; se anula la fecha. En la ficha dice: "' + (v.fecha_carga_texto || 'ilegible') + '".');
      marcar(v, 'ano ' + y + ' fuera de rango; fecha anulada');
      v.fecha_carga = null;
      v.fecha_descarga = null;
    }
  }

  // ---- Match documento -> viaje (N docs : 1 viaje) ----
  const docsHuerfanos = [];
  for (const d of docsRaw) {
    if (d.duplicado_de) { continue; }
    const dm = mat(d.matricula_tractor);
    const df = nz(d.fecha);
    const et = 'pag ' + (d.pagina || '?') + ' ' + (nz(d.referencia) || 'sin ref');
    if (!dm) { docsHuerfanos.push({ d: d, motivo: 'sin matricula de tractor legible' }); continue; }
    let cands = viajes.filter(function (v) { return v.tractoraN && v.tractoraN === dm; });
    if (cands.length === 0) { docsHuerfanos.push({ d: d, motivo: 'matricula ' + d.matricula_tractor + ' no corresponde a ninguna ficha de este envio' }); continue; }
    if (cands.length > 1 && df) {
      const enVentana = cands.filter(function (v) {
        const ini = v.fecha_carga; const fin = v.fecha_descarga || v.fecha_carga;
        if (!ini && !fin) { return true; }
        const antes = ini ? dias(ini, df) : 1;
        const despues = fin ? dias(df, fin) : 1;
        return antes >= -1 && despues >= -1;
      });
      if (enVentana.length > 0) { cands = enVentana; }
    }
    if (cands.length > 1) {
      const dk = num(d.kg_neto);
      if (dk) {
        let best = null; let bd = null;
        for (const v of cands) { if (v.cantidad_kg) { const diff = Math.abs(v.cantidad_kg - dk); if (bd === null || diff < bd) { bd = diff; best = v; } } }
        if (best && bd !== null && bd <= 1500) { cands = [best]; }
      }
    }
    if (cands.length > 1) {
      cands.sort(function (a, b) { return a.docs.length - b.docs.length; });
      avisos.push('Documento ' + et + ' encaja en ' + cands.length + ' viajes de ' + d.matricula_tractor + '. Asignado al bloque ' + cands[0].orden + '; REVISAR.');
    }
    cands[0].docs.push(d);
  }

  // ---- Consolidacion por viaje ----
  for (let i = 0; i < viajes.length; i++) {
    const v = viajes[i];
    const pick = function (tipos, campo) {
      for (const t of tipos) { for (const d of v.docs) { if ((d.tipo_doc || '') === t && nz(d[campo]) !== null) { return d; } } }
      for (const d of v.docs) { if (nz(d[campo]) !== null) { return d; } }
      return null;
    };
    const votos = {};
    for (const d of v.docs) { const c = nz(d.cliente_probable); if (c) { votos[upp(c)] = (votos[upp(c)] || 0) + 1; } }
    let cliente = null; let mx = 0;
    for (const k of Object.keys(votos)) { if (votos[k] > mx) { mx = votos[k]; cliente = k; } }
    if (!cliente && v.nombre_carga) { cliente = upp(v.nombre_carga); avisos.push('Viaje ' + (i + 1) + ': cliente tomado de la ficha ("' + v.nombre_carga + '"), sin confirmacion documental.'); }
    v.cliente = cliente;
    const esForesa = cliente ? (cliente.indexOf('FORESA') >= 0 || cliente.indexOf('BRESFOR') >= 0) : false;
    const dRef = pick(esForesa ? ['albaran', 'cmr'] : ['orden_transporte', 'orden_carga', 'guia', 'cmr', 'carta_porte', 'albaran'], 'referencia');
    v.referencia = dRef ? nz(dRef.referencia) : null;
    v.tipo_doc = dRef ? nz(dRef.tipo_doc) : null;
    v.fecha_documento = dRef ? nz(dRef.fecha) : null;
    const dKg = pick(esForesa ? ['albaran', 'cmr', 'bascula'] : ['cmr', 'carta_porte', 'guia', 'bascula', 'albaran'], 'kg_neto');
    v.kg_documento = dKg ? num(dKg.kg_neto) : null;
    v.fuente_peso = dKg ? nz(dKg.tipo_doc) : null;
    const dOD = pick(['cmr', 'carta_porte', 'albaran', 'orden_transporte', 'guia'], 'destino');
    v.origen = (dOD && nz(dOD.origen)) ? nz(dOD.origen) : v.lugar_carga;
    v.destino = (dOD && nz(dOD.destino)) ? nz(dOD.destino) : v.lugar_descarga;
    const dMt = pick(['cmr', 'carta_porte', 'albaran', 'guia', 'orden_transporte'], 'material');
    v.material = (dMt && nz(dMt.material)) ? nz(dMt.material) : v.tipo_mercancia;
    const dIm = pick(['orden_carga', 'orden_transporte'], 'importe');
    v.importe_documento = dIm ? num(dIm.importe) : null;
    const dTa = pick(['orden_carga', 'orden_transporte'], 'tarifa_tn');
    v.tarifa_tn_documento = dTa ? num(dTa.tarifa_tn) : null;
    // KM: el calculo lo hace SIEMPRE el sistema; km_recorridos, si existe, es verificacion.
    v.km_cargados = (v.km_inicio !== null && v.km_final !== null) ? (v.km_final - v.km_inicio) : null;
    if (v.km_cargados !== null && v.km_cargados <= 0) {
      errores.push('Viaje ' + (i + 1) + ': km cargados no positivos (' + v.km_inicio + ' -> ' + v.km_final + ').');
      marcar(v, 'km cargados no positivos (' + v.km_inicio + ' -> ' + v.km_final + ')');
      v.km_cargados = null;
    }
    // GUARDA B: multiplo exacto de 500. Un odometro real casi nunca lo es.
    // Cubre las hojas de un solo viaje, donde la guarda de uniformidad no puede disparar.
    if (v.km_cargados !== null && v.km_cargados % 500 === 0) {
      errores.push('Viaje ' + (i + 1) + ': km cargados ' + v.km_cargados + ' es multiplo exacto de 500. Los odometros reales casi nunca lo son; probable invencion. Se anulan.');
      marcar(v, 'km cargados ' + v.km_cargados + ' multiplo exacto de 500; odometros anulados por probable invencion');
      v.km_cargados = null; v.km_inicio = null; v.km_final = null; v.km_recorridos = null;
    }
    if (v.km_recorridos !== null && v.km_cargados !== null && Math.abs(v.km_recorridos - v.km_cargados) > 5) {
      errores.push('Viaje ' + (i + 1) + ': la ficha escribe ' + v.km_recorridos + ' km recorridos pero final-inicio da ' + v.km_cargados + '. Odometro mal leido.');
      marcar(v, 'la ficha escribe ' + v.km_recorridos + ' km recorridos pero final-inicio da ' + v.km_cargados + '; odometro mal leido');
    }
    v.km_vacios = null;
    if (i > 0 && viajes[i - 1].hoja_idx === v.hoja_idx) {
      const prev = viajes[i - 1].km_final;
      if (prev !== null && v.km_inicio !== null) {
        v.km_vacios = v.km_inicio - prev;
        if (v.km_vacios < 0) {
          avisos.push('Viaje ' + (i + 1) + ': km vacios negativos, falta un viaje intermedio.');
          marcar(v, 'km vacios negativos; falta un viaje intermedio');
        }
      }
    }
    if (v.docs.length === 0) { errores.push('Viaje ' + (i + 1) + ' (' + (v.nombre_carga || 'sin cliente') + ', ' + (v.fecha_carga_texto || v.fecha_carga || 'sin fecha') + '): SIN DOCUMENTACION. No facturable.'); }
    if (!v.fecha_carga) {
      avisos.push('Viaje ' + (i + 1) + ': sin fecha utilizable (en la ficha: "' + (v.fecha_carga_texto || 'ilegible') + '").');
      marcar(v, 'sin fecha utilizable (en la ficha: "' + (v.fecha_carga_texto || 'ilegible') + '")');
    }
    if (v.cantidad_kg !== null && v.kg_documento !== null && Math.abs(v.cantidad_kg - v.kg_documento) > 200) {
      avisos.push('Viaje ' + (i + 1) + ': ficha ' + v.cantidad_kg + ' kg vs documento ' + v.kg_documento + ' kg. Prevalece el documento.');
      marcar(v, 'ficha ' + v.cantidad_kg + ' kg vs documento ' + v.kg_documento + ' kg');
    }
  }

  // ---- GUARDA C: odometros uniformes dentro de una hoja ----
  for (let h = 0; h < hojasRaw.length; h++) {
    const vs = viajes.filter(function (v) { return v.hoja_idx === h; });
    const kms = vs.map(function (v) { return v.km_cargados; }).filter(function (x) { return x !== null; });
    if (kms.length >= 2) {
      let iguales = true;
      for (const k of kms) { if (k !== kms[0]) { iguales = false; } }
      if (iguales) {
        errores.push('Hoja ' + (h + 1) + ': los ' + kms.length + ' viajes dan exactamente ' + kms[0] + ' km. Odometros probablemente inventados; se anulan.');
        for (const v of vs) {
          marcar(v, 'los ' + kms.length + ' viajes de la hoja dan exactamente ' + kms[0] + ' km; odometros anulados por probable invencion');
          v.km_cargados = null; v.km_inicio = null; v.km_final = null; v.km_recorridos = null;
        }
      }
    }
    const pares = vs.filter(function (v) { return v.cantidad_kg !== null && v.kg_documento !== null; });
    if (pares.length >= 2) {
      let todosIguales = true;
      for (const v of pares) { if (v.cantidad_kg !== v.kg_documento) { todosIguales = false; } }
      if (todosIguales) { avisos.push('Hoja ' + (h + 1) + ': el peso de la ficha coincide EXACTAMENTE con el del documento en todos los viajes. Verificar que no sea copia.'); }
    }
  }
  for (const o of docsHuerfanos) { errores.push('Documento pag ' + (o.d.pagina || '?') + ' (' + (nz(o.d.referencia) || 'sin ref') + ', ' + (nz(o.d.matricula_tractor) || 'sin matricula') + '): ' + o.motivo + '.'); }

  // ---- Estado de lectura por fila ----
  // Cubre la calidad de LECTURA de la ficha. Deliberadamente NO incluye
  // "sin documentacion" (eje aparte, ya cubierto por `estado`) ni la ambiguedad
  // de correlacion documento->viaje (encargo 3).
  let nRevisar = 0;
  for (const v of viajes) {
    v.estado_lectura = v.motivos_revision.length ? ESTADO_LECTURA.REVISAR : ESTADO_LECTURA.OK;
    v.motivo_revision = v.motivos_revision.join('; ');
    if (v.estado_lectura === ESTADO_LECTURA.REVISAR) { nRevisar++; }
  }

  logInfo('fichas=' + hojasRaw.length + ' viajes=' + viajes.length + ' documentos=' + docsRaw.length +
    ' lectura_ok=' + (viajes.length - nRevisar) + ' lectura_revisar=' + nRevisar +
    ' errores=' + errores.length + ' avisos=' + avisos.length);
  if (nRevisar > 0) { logInfo(nRevisar + ' viaje(s) marcados REVISAR: la lectura no es confiable, requieren revision humana.'); }

  return { ok: true, hojas: hojasRaw, viajes: viajes, documentos: docsRaw, errores: errores, avisos: avisos };
}

/**
 * Informe legible. Mismo formato que v3.1 mas la linea de estado de lectura por
 * viaje y el conteo en la cabecera.
 */
function renderInforme(res) {
  const hojasRaw = res.hojas; const viajes = res.viajes; const docsRaw = res.documentos;
  const errores = res.errores; const avisos = res.avisos;
  const f = function (x) { return (x === null || x === undefined || x === '') ? '(falta)' : String(x); };
  const nRevisar = viajes.filter(function (v) { return v.estado_lectura === ESTADO_LECTURA.REVISAR; }).length;
  const L = [];
  L.push('======== INGESTA v3 ========');
  L.push('Fichas detectadas: ' + hojasRaw.length + '   Viajes: ' + viajes.length + '   Documentos: ' + docsRaw.length);
  L.push('Lectura: ' + (viajes.length - nRevisar) + ' OK / ' + nRevisar + ' REVISAR');
  if (nRevisar > 0) {
    L.push('  >> ATENCION: ' + nRevisar + ' de ' + viajes.length + ' viajes tienen lectura dudosa.');
    L.push('     No son datos buenos. Requieren revision humana antes de facturar.');
  }
  L.push('');
  for (let h = 0; h < hojasRaw.length; h++) {
    const H = hojasRaw[h];
    L.push('---- FICHA ' + (h + 1) + ' (pag ' + f(H.pagina) + ') ----');
    L.push('CONDUCTOR: ' + f(nz(H.conductor)) + '   TRACTORA: ' + f(nz(H.tractora)) + '   REMOLQUE: ' + f(nz(H.remolque)) + '   EMPRESA: ' + f(nz(H.empresa)));
    const vs = viajes.filter(function (v) { return v.hoja_idx === h; });
    for (const v of vs) {
      const n = viajes.indexOf(v) + 1;
      L.push('  VIAJE ' + n + ' | ' + f(v.cliente) + ' | ' + f(v.fecha_carga || v.fecha_carga_texto));
      L.push('    ' + f(v.origen) + ' -> ' + f(v.destino) + '   ' + f(v.material));
      L.push('    Ref: ' + f(v.referencia) + ' [' + f(v.tipo_doc) + ']   Docs asociados: ' + v.docs.length + (v.docs.length ? ' (pag ' + v.docs.map(function (d) { return d.pagina; }).join(', ') + ')' : ''));
      L.push('    Peso ficha: ' + f(v.cantidad_kg) + ' kg | documento: ' + f(v.kg_documento) + ' kg [' + f(v.fuente_peso) + ']');
      L.push('    KM: ' + f(v.km_inicio) + ' -> ' + f(v.km_final) + ' = ' + f(v.km_cargados) + (v.km_recorridos !== null ? '  (ficha: ' + v.km_recorridos + ')' : '  (ficha no lo trae)') + '   vacios: ' + f(v.km_vacios));
      if (v.importe_documento !== null) { L.push('    Importe doc: ' + v.importe_documento + ' EUR'); }
      if (v.tarifa_tn_documento !== null) { L.push('    Tarifa doc: ' + v.tarifa_tn_documento + ' EUR/TN'); }
      L.push('    LECTURA: ' + v.estado_lectura + (v.estado_lectura === ESTADO_LECTURA.REVISAR ? ' -> ' + v.motivo_revision : ''));
    }
    const gs = Array.isArray(H.gastos) ? H.gastos : [];
    L.push('  GASTOS: ' + (gs.length ? gs.map(function (g) { return f(g.tipo) + ' ' + f(g.importe) + ' (' + f(g.forma) + ')'; }).join(' | ') : 'ninguno'));
    if (nz(H.observaciones)) { L.push('  OBS: ' + H.observaciones); }
    L.push('');
  }
  L.push('---- ERRORES (' + errores.length + ') ----');
  if (!errores.length) { L.push('Ninguno.'); } else { for (const e of errores) { L.push('  X ' + e); } }
  L.push('');
  L.push('---- AVISOS (' + avisos.length + ') ----');
  if (!avisos.length) { L.push('Ninguno.'); } else { for (const a of avisos) { L.push('  ! ' + a); } }
  L.push('============================');
  return L.join('\n');
}

/** Parsea un item de respuesta de OpenAI a objeto. */
function parseRespuesta(it) {
  if (!it || !it.json) { return null; }
  const c = (it.json.choices && it.json.choices[0] && it.json.choices[0].message) ? it.json.choices[0].message.content : null;
  if (!c) { return null; }
  try { return JSON.parse(c); } catch (e) { return null; }
}

/**
 * Ensambla las respuestas del modelo (v3.4: loop por pagina) y corre la
 * correlacion. Cada respuesta se empareja POR INDICE con su meta de "Preparar
 * Payload" ($('Preparar Payload').all()), que dice si el item era una pasada de
 * ficha (con su numero de pagina) o la de documentos.
 *
 *   - N respuestas pass:'fichas', cada una {hojas:[0..1]}. Se les inyecta la
 *     `pagina` real (el modelo ve una sola imagen y no la conoce). Se juntan en
 *     un unico rA = {hojas:[...todas...]}, en orden de pagina.
 *   - 1 respuesta pass:'documentos' -> rB = {documentos:[...]}.
 *
 * Perdida de fichas imposible en silencio: si una pasada de ficha devuelve JSON
 * invalido, es un ERROR explicito (no un hueco). Si devuelve hojas:[] es que esa
 * pagina no era una ficha (documento impreso) -> no cuenta como perdida.
 *
 * @param {Array} respuestas  salida de "Extraer GPT-4o" ($input.all()).
 * @param {Array} metas       $('Preparar Payload').all().map(i => i.json).
 */
function procesar(respuestas, metas, docaiPorPagina) {
  metas = Array.isArray(metas) ? metas : [];
  docaiPorPagina = docaiPorPagina || {};
  const erroresPrevios = [];
  const hojasAll = [];
  let rB = null;
  let paginasFicha = 0;

  for (let i = 0; i < respuestas.length; i++) {
    const meta = metas[i] || {};
    const parsed = parseRespuesta(respuestas[i]);
    if (meta.pass === 'documentos') {
      rB = parsed;
      continue;
    }
    // pass 'fichas' (o desconocido: se trata como ficha, es el default del canal).
    paginasFicha++;
    const pagina = (typeof meta.pagina === 'number' && isFinite(meta.pagina)) ? meta.pagina : (i + 1);
    if (!parsed) {
      // JSON invalido: la ficha de esta pagina NO se leyo. Se hace visible.
      erroresPrevios.push('Pagina ' + pagina + ': el modelo de ficha no devolvio JSON valido; esa ficha NO se leyo (no se pierde en silencio).');
      continue;
    }
    const hojas = Array.isArray(parsed.hojas) ? parsed.hojas : [];
    if (hojas.length === 0) {
      // hojas:[] = esa pagina no era una ficha (documento impreso). No es perdida.
      continue;
    }
    for (let h = 0; h < hojas.length; h++) {
      const hoja = hojas[h];
      hoja.pagina = pagina; // el sistema asigna la pagina real; pisa lo que diga el modelo
      hojasAll.push(hoja);
    }
    if (hojas.length > 1) {
      erroresPrevios.push('Pagina ' + pagina + ': el modelo devolvio ' + hojas.length + ' fichas para una sola imagen; se cargan todas con esta pagina. Revisar.');
    }
  }

  const res = correlacionar({ hojas: hojasAll }, rB, docaiPorPagina);
  if (!res.ok) {
    return { ok: false, linea: 'ERROR: ninguna pasada de FICHAS devolvio JSON valido.', datos_json: '', avisos: 1, errores: 1, lectura_revisar: 0 };
  }

  // Los errores de ensamblado (fichas no leidas) van al frente del informe.
  res.errores = erroresPrevios.concat(res.errores);

  logInfo('loop por pagina: ' + paginasFicha + ' llamada(s) de ficha -> ' +
    hojasAll.length + ' ficha(s) leida(s), ' + res.viajes.length + ' viaje(s); ' +
    erroresPrevios.length + ' fallo(s) de lectura de pagina.');

  const salida = { hojas: res.hojas, viajes: res.viajes, documentos: res.documentos, errores: res.errores, avisos: res.avisos };
  const nRevisar = res.viajes.filter(function (v) { return v.estado_lectura === ESTADO_LECTURA.REVISAR; }).length;
  return {
    ok: true,
    linea: renderInforme(res),
    datos_json: JSON.stringify(salida),
    avisos: res.avisos.length,
    errores: res.errores.length,
    lectura_revisar: nRevisar
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ESTADO_LECTURA: ESTADO_LECTURA, correlacionar: correlacionar, renderInforme: renderInforme, parseRespuesta: parseRespuesta, procesar: procesar, setLogActivo: setLogActivo };
}
