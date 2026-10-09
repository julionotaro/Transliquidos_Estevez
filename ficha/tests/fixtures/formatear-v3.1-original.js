// ===== CORRELACIONADOR v3.1: dos pasadas independientes + match determinista + guardas =====
const respuestas = $input.all();
const parse = function (it) {
  if (!it || !it.json) { return null; }
  const c = (it.json.choices && it.json.choices[0] && it.json.choices[0].message) ? it.json.choices[0].message.content : null;
  if (!c) { return null; }
  try { return JSON.parse(c); } catch (e) { return null; }
};
const rA = parse(respuestas[0]);
const rB = parse(respuestas[1]);
if (!rA) { return [{ json: { ok: false, linea: 'ERROR: la pasada de FICHAS no devolvio JSON valido.', datos_json: '', avisos: 1, errores: 1 } }]; }
const hojasRaw = Array.isArray(rA.hojas) ? rA.hojas : [];
const docsRaw = (rB && Array.isArray(rB.documentos)) ? rB.documentos : [];

const nz = function (x) { if (x === null || x === undefined) { return null; } if (typeof x === 'string') { const s = x.trim(); return (s === '' || s.toLowerCase() === 'null') ? null : x; } return x; };
const num = function (x) { if (typeof x === 'number') { return (isFinite(x) && x !== 0) ? x : null; } if (typeof x === 'string' && x.trim() !== '') { const n = Number(x.replace(/\./g, '').replace(',', '.')); return (isFinite(n) && n !== 0) ? n : null; } return null; };
const mat = function (x) { return (x || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, ''); };
const upp = function (x) { return (x || '').toString().toUpperCase(); };
const dias = function (a, b) { if (!a || !b) { return null; } const da = Date.parse(a + 'T00:00:00Z'); const db = Date.parse(b + 'T00:00:00Z'); if (!isFinite(da) || !isFinite(db)) { return null; } return Math.round((db - da) / 86400000); };
const errores = []; const avisos = [];
const ANIO_HOY = new Date().getFullYear();

// ---- Viajes desde las fichas ----
const viajes = [];
for (let h = 0; h < hojasRaw.length; h++) {
  const H = hojasRaw[h];
  const bloques = Array.isArray(H.bloques) ? H.bloques : [];
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    viajes.push({
      hoja_idx: h, orden: num(b.orden) || (i + 1),
      conductor: nz(H.conductor), tractora: nz(H.tractora), remolque: nz(H.remolque), empresa: nz(H.empresa),
      tractoraN: mat(H.tractora),
      fecha_carga: nz(b.fecha_carga), fecha_carga_texto: nz(b.fecha_carga_texto), fecha_descarga: nz(b.fecha_descarga),
      nombre_carga: nz(b.nombre_carga), lugar_carga: nz(b.lugar_carga),
      nombre_descarga: nz(b.nombre_descarga), lugar_descarga: nz(b.lugar_descarga),
      tipo_mercancia: nz(b.tipo_mercancia), cantidad_kg: num(b.cantidad_kg),
      km_inicio: num(b.km_inicio), km_final: num(b.km_final), km_recorridos: num(b.km_recorridos),
      docs: []
    });
  }
}
if (viajes.length === 0) { errores.push('No se detecto ninguna ficha de chofer con bloques rellenos.'); }

// ---- GUARDA A: ano fuera de rango (mala lectura del ano en el manuscrito) ----
// Se aplica ANTES del match porque la fecha se usa para desempatar documentos.
for (let i = 0; i < viajes.length; i++) {
  const v = viajes[i];
  if (!v.fecha_carga) { continue; }
  const y = Number(String(v.fecha_carga).slice(0, 4));
  if (isFinite(y) && (y < ANIO_HOY - 1 || y > ANIO_HOY + 1)) {
    errores.push('Viaje ' + (i + 1) + ': fecha ' + v.fecha_carga + ' (ano ' + y + ') fuera del rango razonable. Ano mal leido; se anula la fecha. En la ficha dice: "' + (v.fecha_carga_texto || 'ilegible') + '".');
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
  if (v.km_cargados !== null && v.km_cargados <= 0) { errores.push('Viaje ' + (i + 1) + ': km cargados no positivos (' + v.km_inicio + ' -> ' + v.km_final + ').'); v.km_cargados = null; }
  // GUARDA B: multiplo exacto de 500. Un odometro real casi nunca lo es.
  // Cubre las hojas de un solo viaje, donde la guarda de uniformidad no puede disparar.
  if (v.km_cargados !== null && v.km_cargados % 500 === 0) {
    errores.push('Viaje ' + (i + 1) + ': km cargados ' + v.km_cargados + ' es multiplo exacto de 500. Los odometros reales casi nunca lo son; probable invencion. Se anulan.');
    v.km_cargados = null; v.km_inicio = null; v.km_final = null; v.km_recorridos = null;
  }
  if (v.km_recorridos !== null && v.km_cargados !== null && Math.abs(v.km_recorridos - v.km_cargados) > 5) {
    errores.push('Viaje ' + (i + 1) + ': la ficha escribe ' + v.km_recorridos + ' km recorridos pero final-inicio da ' + v.km_cargados + '. Odometro mal leido.');
  }
  v.km_vacios = null;
  if (i > 0 && viajes[i - 1].hoja_idx === v.hoja_idx) {
    const prev = viajes[i - 1].km_final;
    if (prev !== null && v.km_inicio !== null) { v.km_vacios = v.km_inicio - prev; if (v.km_vacios < 0) { avisos.push('Viaje ' + (i + 1) + ': km vacios negativos, falta un viaje intermedio.'); } }
  }
  if (v.docs.length === 0) { errores.push('Viaje ' + (i + 1) + ' (' + (v.nombre_carga || 'sin cliente') + ', ' + (v.fecha_carga_texto || v.fecha_carga || 'sin fecha') + '): SIN DOCUMENTACION. No facturable.'); }
  if (!v.fecha_carga) { avisos.push('Viaje ' + (i + 1) + ': sin fecha utilizable (en la ficha: "' + (v.fecha_carga_texto || 'ilegible') + '").'); }
  if (v.cantidad_kg !== null && v.kg_documento !== null && Math.abs(v.cantidad_kg - v.kg_documento) > 200) { avisos.push('Viaje ' + (i + 1) + ': ficha ' + v.cantidad_kg + ' kg vs documento ' + v.kg_documento + ' kg. Prevalece el documento.'); }
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
      for (const v of vs) { v.km_cargados = null; v.km_inicio = null; v.km_final = null; v.km_recorridos = null; }
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

// ---- Informe ----
const f = function (x) { return (x === null || x === undefined || x === '') ? '(falta)' : String(x); };
const L = [];
L.push('======== INGESTA v3 ========');
L.push('Fichas detectadas: ' + hojasRaw.length + '   Viajes: ' + viajes.length + '   Documentos: ' + docsRaw.length);
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
const salida = { hojas: hojasRaw, viajes: viajes, documentos: docsRaw, errores: errores, avisos: avisos };
return [{ json: { ok: true, linea: L.join('\n'), datos_json: JSON.stringify(salida), avisos: avisos.length, errores: errores.length } }];
