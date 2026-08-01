// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/cruce.js + ficha/correlacionar.js + ficha/nodo-formatear.wrapper.js
// Contenido exacto del nodo Code "Formatear Linea Gesruta" (WD0q9Ic0oDvUoJwp).

// ===== CRUCE FICHA<->DOCUMENTO — reglas del modelo "albaran = unidad facturable" =====
//
// Fase 2 (encargo 2026-08-01). Corrige el supuesto "1 bloque de ficha = 1 viaje".
//
//   El albaran (o documento de origen equivalente) es la unidad FACTURABLE.
//   El bloque de la ficha es la DECLARACION del chofer sobre su jornada.
//   Un bloque puede representar N viajes; quien define N son los documentos.
//
// Este modulo aisla las piezas CONFIGURABLES y las funciones PURAS del cruce, para
// que no queden hardcodeadas en el medio de correlacionar.js y sean testeables
// solas. La logica de expansion/consolidacion que las usa vive en correlacionar.js.
//
// !!! ADVERTENCIA: el camino MULTI-VIAJE (bloque = N viajes) NO se probo nunca
// !!! contra papel real. No hay ninguna ficha FORESA Villagarcia->Caldas en el
// !!! set de referencia (las 3 fichas reales son todas de bloque simple). Esta
// !!! cubierto solo con tests unitarios. Es el punto de mas riesgo del modelo
// !!! nuevo: cuando aparezca una ficha real de ese caso, es la PRIMERA prueba a
// !!! correr. Ver docs y encargo §7.5.

'use strict';

// --- RUTAS_MULTIVIAJE: lista configurable, facil de ampliar ------------------
// Cada entrada es una ruta (cliente, origen, destino) donde el chofer escribe en
// el campo `cantidad` de la ficha el NUMERO DE VIAJES, no los kg. Arranca con la
// unica confirmada (FORESA Villagarcia -> Caldas de Reis, metanol). Para sumar
// una ruta: agregar un objeto aca, NO tocar la logica.
var RUTAS_MULTIVIAJE = [
  { cliente: 'FORESA', origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS' },
];

// Red de seguridad: los pesos SIEMPRE van en miles de kg. Un valor de uno o dos
// digitos es imposible como peso -> probable numero de viajes de una ruta que
// todavia no esta en RUTAS_MULTIVIAJE. En vez de meter "4 kg" en silencio, se
// manda a REVISAR para que aparezca en el tablero. Cuando se confirme la ruta,
// se agrega arriba y deja de preguntar.
var UMBRAL_CANTIDAD_KG = 100;

// --- Normalizacion de texto para el match de rutas ---------------------------
// La ficha escribe "Villagarcía"/"VILLAGARCIA", "Caldas"/"Caldas de Reis". Se
// compara sin acentos, en mayusculas y por inclusion en ambos sentidos, para que
// "CALDAS" matchee "CALDAS DE REIS" sin volverse laxo (no matchea vacios).
function quitarAcentos(s) {
  return (s === null || s === undefined ? '' : String(s)).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function norm(s) {
  return quitarAcentos(s).toUpperCase().replace(/\s+/g, ' ').trim();
}
function coincideTexto(valorFicha, valorRuta) {
  var a = norm(valorFicha);
  var b = norm(valorRuta);
  if (!a || !b) { return false; }
  return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
}

/**
 * ¿La terna (cliente, origen, destino) de la ficha es una ruta multi-viaje?
 * @returns {object|null} la entrada de RUTAS_MULTIVIAJE que coincide, o null.
 */
function esRutaMultiviaje(cliente, origen, destino, rutas) {
  var lista = Array.isArray(rutas) ? rutas : RUTAS_MULTIVIAJE;
  for (var i = 0; i < lista.length; i++) {
    var r = lista[i];
    if (coincideTexto(cliente, r.cliente) && coincideTexto(origen, r.origen) && coincideTexto(destino, r.destino)) {
      return r;
    }
  }
  return null;
}

/**
 * Regla determinista del §1: decide si `cantidad` de la ficha son kg o numero de
 * viajes. NO adivina: o la ruta esta registrada, o la red de seguridad la manda
 * a REVISAR.
 *
 * @param {number|null} cantidad  el valor leido del campo cantidad de la ficha.
 * @returns {{modo:'viajes'|'kg'|'revisar', n_viajes:number|null, kg:number|null,
 *            motivo:string|null, ruta:object|null}}
 */
function clasificarCantidad(cantidad, cliente, origen, destino, rutas) {
  var ruta = esRutaMultiviaje(cliente, origen, destino, rutas);
  var c = (typeof cantidad === 'number' && isFinite(cantidad)) ? cantidad : null;
  if (ruta) {
    // Ruta multi-viaje: cantidad = numero de viajes. Si no se leyo, el caller lo
    // manda a REVISAR (no se puede expandir sin saber cuantos).
    return { modo: 'viajes', n_viajes: (c && c > 0) ? c : null, kg: null, motivo: null, ruta: ruta };
  }
  if (c !== null && c < UMBRAL_CANTIDAD_KG) {
    return { modo: 'revisar', n_viajes: 1, kg: null, motivo: 'posible_multiviaje_ruta_no_registrada', ruta: null };
  }
  return { modo: 'kg', n_viajes: 1, kg: c, motivo: null, ruta: null };
}

/**
 * Regimen de indexacion (suplemento gasoleo) por cliente + ruta (D-03 y D-06).
 * NO calcula la indexacion — solo marca el regimen; el calculo se cierra en la
 * facturacion (D-03, encargo §8 fuera de alcance). Routing de dominio, tabla
 * configurable como RUTAS_MULTIVIAJE.
 *
 *   incluida            Baltransa: la tarifa ya la contiene, no se agrega.
 *   agregada_mensual    FORESA Villagarcia -> Caldas (metanol): un total por mes.
 *   agregada_quincenal  FORESA Caldas de Reis -> Ourense (Orember): total quincenal.
 *   linea               caso general (FORESA otros destinos, Quimidroga, RNM...).
 *
 * @returns {'incluida'|'agregada_mensual'|'agregada_quincenal'|'linea'}
 */
function regimenIndexacion(cliente, origen, destino) {
  var cl = norm(cliente);
  if (cl.indexOf('BALTRANSA') >= 0) { return 'incluida'; }
  var esForesa = cl.indexOf('FORESA') >= 0 || cl.indexOf('BRESFOR') >= 0;
  if (esForesa) {
    if (coincideTexto(origen, 'VILLAGARCIA') && coincideTexto(destino, 'CALDAS DE REIS')) { return 'agregada_mensual'; }
    if (coincideTexto(origen, 'CALDAS') && (coincideTexto(destino, 'OURENSE') || coincideTexto(destino, 'ORENSE'))) { return 'agregada_quincenal'; }
    return 'linea'; // FORESA a cualquier otro destino: por viaje (D-06).
  }
  return 'linea';
}

/**
 * Reparte los km del bloque entre n viajes (§1). Piso entero a cada uno y el
 * RESTO al ultimo, para que la suma de los n cierre EXACTAMENTE con el total del
 * bloque. Regla fija y documentada; si cambia, cambia aca y en el test.
 *
 * @returns {number[]} n enteros cuya suma es kmBloque (o [] si no hay dato).
 */
function repartirKm(kmBloque, n) {
  if (kmBloque === null || kmBloque === undefined || !isFinite(kmBloque)) { return []; }
  if (!Number.isInteger(n) || n <= 0) { return []; }
  var base = Math.floor(kmBloque / n);
  var out = [];
  for (var i = 0; i < n; i++) { out.push(base); }
  out[n - 1] += (kmBloque - base * n);
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RUTAS_MULTIVIAJE: RUTAS_MULTIVIAJE,
    UMBRAL_CANTIDAD_KG: UMBRAL_CANTIDAD_KG,
    norm: norm,
    coincideTexto: coincideTexto,
    esRutaMultiviaje: esRutaMultiviaje,
    clasificarCantidad: clasificarCantidad,
    regimenIndexacion: regimenIndexacion,
    repartirKm: repartirKm,
  };
}

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

// --- Reglas del modelo albaran=unidad (Fase 2, ficha/cruce.js) ---------------
// En n8n el build (build-nodo.js) concatena cruce.js ANTES que este archivo, asi
// que sus funciones quedan globales; en node/test se requieren. `typeof X ===
// 'function'` sobre un identificador no declarado devuelve 'undefined' sin lanzar,
// asi que el ternario elige la fuente correcta en cada entorno.
var CRUCE = (typeof clasificarCantidad === 'function')
  ? { clasificarCantidad: clasificarCantidad, regimenIndexacion: regimenIndexacion, repartirKm: repartirKm, esRutaMultiviaje: esRutaMultiviaje, RUTAS_MULTIVIAJE: RUTAS_MULTIVIAJE }
  : require('./cruce.js');

// Fuente legible de un dato para el audit trail (§4): que papel/pagina lo aporto.
var fuenteDoc = function (d) { return d ? ('documento:' + (nz(d.tipo_doc) || 'doc') + ':pag' + (d.pagina || '?')) : null; };

/**
 * Correlaciona la pasada de fichas (rA) con la de documentos (rB).
 *
 * @param {object|null} rA JSON de la pasada de fichas   ({hojas:[...]}).
 * @param {object|null} rB JSON de la pasada de documentos ({documentos:[...]}).
 * @param {object} [opts] {rutas} lista RUTAS_MULTIVIAJE (default la de cruce.js).
 * @returns {{ok:boolean, hojas:Array, viajes:Array, documentos:Array,
 *            errores:Array, avisos:Array}}
 */
function correlacionar(rA, rB, opts) {
  const rutas = (opts && opts.rutas) ? opts.rutas : CRUCE.RUTAS_MULTIVIAJE;
  if (!rA) {
    logError('la pasada de FICHAS no devolvio JSON valido');
    return { ok: false, hojas: [], viajes: [], documentos: [], errores: [], avisos: [] };
  }
  const hojasRaw = Array.isArray(rA.hojas) ? rA.hojas : [];
  const docsRaw = (rB && Array.isArray(rB.documentos)) ? rB.documentos : [];

  const errores = []; const avisos = [];
  const ANIO_HOY = new Date().getFullYear();

  // Marca la fila i para revision humana y registra el motivo, ademas de dejar
  // el mensaje en la lista global (que es lo que ya lee la oficina).
  const marcar = function (v, motivo) { v.motivos_revision.push(motivo); };

  // ---- Viajes desde las fichas ----
  // `let` (no const): la expansion multi-viaje (Fase 2) reasigna el array.
  let viajes = [];
  for (let h = 0; h < hojasRaw.length; h++) {
    const H = hojasRaw[h];
    const bloques = Array.isArray(H.bloques) ? H.bloques : [];
    for (let i = 0; i < bloques.length; i++) {
      const b = bloques[i];
      // Modelo albaran=unidad (§1): `cantidad` de la ficha puede ser kg o numero
      // de viajes. Discriminacion determinista (cruce.js), con lo que DECLARA la
      // ficha (nombre y lugares del bloque): ruta registrada -> viajes; valor <100
      // en ruta no registrada -> REVISAR (red de seguridad); si no -> kg.
      const clz = CRUCE.clasificarCantidad(num(b.cantidad_kg), nz(b.nombre_carga), nz(b.lugar_carga), nz(b.lugar_descarga), rutas);
      viajes.push({
        hoja_idx: h, orden: num(b.orden) || (i + 1),
        conductor: nz(H.conductor), tractora: nz(H.tractora), remolque: nz(H.remolque), empresa: nz(H.empresa),
        tractoraN: mat(H.tractora),
        pagina_origen: (typeof H.pagina === 'number' && isFinite(H.pagina)) ? H.pagina : null,
        fecha_carga: nz(b.fecha_carga), fecha_carga_texto: nz(b.fecha_carga_texto), fecha_descarga: nz(b.fecha_descarga),
        nombre_carga: nz(b.nombre_carga), lugar_carga: nz(b.lugar_carga),
        nombre_descarga: nz(b.nombre_descarga), lugar_descarga: nz(b.lugar_descarga),
        tipo_mercancia: nz(b.tipo_mercancia),
        // En modo kg, `cantidad_kg` = lo leido (identico a v3.2). En viajes/REVISAR
        // NO es un peso, asi que queda null: nunca se factura un "6 kg" espurio.
        cantidad_kg: (clz.modo === 'kg') ? clz.kg : null,
        cantidad_declarada: num(b.cantidad_kg),
        modo_cantidad: clz.modo,
        es_multiviaje: (clz.modo === 'viajes'),
        n_viajes_declarado: clz.n_viajes,
        km_inicio: num(b.km_inicio), km_final: num(b.km_final), km_recorridos: num(b.km_recorridos),
        origen_km: 'leido',
        regimen_indexacion: null,
        estado: null, pendiente_falta: null, pendiente_reclamar_a: null,
        origen_campos: {},
        motivos_revision: [],
        docs: []
      });
      // Red de seguridad §1: valor demasiado chico para ser kg en una ruta que no
      // esta registrada como multiviaje -> a REVISAR, visible en el tablero, en vez
      // de meter "N kg" en silencio. Cuando se confirme la ruta se agrega a la lista.
      if (clz.motivo === 'posible_multiviaje_ruta_no_registrada') {
        const vLast = viajes[viajes.length - 1];
        marcar(vLast, 'posible_multiviaje_ruta_no_registrada: cantidad ' + num(b.cantidad_kg) + ' < 100; ni kg valido ni ruta multiviaje registrada');
        errores.push('Viaje ' + viajes.length + ': cantidad ' + num(b.cantidad_kg) + ' demasiado baja para kg y ruta (' + (nz(b.nombre_carga) || '?') + ' ' + (nz(b.lugar_carga) || '?') + '->' + (nz(b.lugar_descarga) || '?') + ') no registrada en RUTAS_MULTIVIAJE. REVISAR (posible_multiviaje_ruta_no_registrada).');
      }
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
    // --- Fase 2: regimen de indexacion, estado de documentacion y audit ---
    // Regimen (D-03/D-06): SOLO se marca; el calculo se cierra en facturacion (F4).
    v.regimen_indexacion = CRUCE.regimenIndexacion(v.cliente, v.origen, v.destino);
    // Estado de documentacion (§3): un unico estado para lo incompleto, con QUE
    // falta y a QUIEN reclamar. Es un eje distinto del de LECTURA (estado_lectura).
    if (v.docs.length === 0) {
      v.estado = 'PENDIENTE_DOCUMENTACION';
      v.pendiente_falta = 'documentos del viaje (albaran/CMR/carta de porte)';
      v.pendiente_reclamar_a = 'chofer / cliente cargador';
    } else {
      v.estado = 'con_documentacion';
    }
    // Audit trail (§4): de que papel/pagina salio cada campo. kg y referencia
    // vienen del documento (D-01); km, de la ficha; el resto, del que gano el pick.
    v.origen_campos = {
      cliente: (mx > 0) ? 'documento:cliente_probable' : (v.nombre_carga ? 'ficha:nombre_carga' : null),
      referencia: v.referencia ? fuenteDoc(dRef) : null,
      kg_documento: (v.kg_documento !== null) ? fuenteDoc(dKg) : null,
      origen: (dOD && nz(dOD.origen)) ? fuenteDoc(dOD) : (v.lugar_carga ? 'ficha:lugar_carga' : null),
      destino: (dOD && nz(dOD.destino)) ? fuenteDoc(dOD) : (v.lugar_descarga ? 'ficha:lugar_descarga' : null),
      material: (dMt && nz(dMt.material)) ? fuenteDoc(dMt) : (v.tipo_mercancia ? 'ficha:tipo_mercancia' : null),
      km: (v.km_cargados !== null) ? ('ficha:odometro:' + v.origen_km) : null,
      cantidad_ficha: (v.cantidad_kg !== null) ? 'ficha:cantidad' : null
    };
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

  // ---- Fase 2: expansion multi-viaje (bloque = N viajes) ----
  // Un bloque de ruta multiviaje declara N viajes (campo cantidad). Cada viaje
  // real trae SU propio albaran (kg propio, D-01). Se generan N filas: las que
  // tienen albaran quedan consolidadas con su kg; las que faltan quedan
  // PENDIENTE_DOCUMENTACION, VISIBLES para reclamar (§3). Los km del bloque (la
  // jornada completa) se reparten entre los N y se marcan `derivado_de_bloque`.
  // Si el odometro del bloque quedo dudoso, los N heredan REVISAR: no se reparte
  // un numero dudoso y salen N confiables.
  // !!! Este camino NO se probo contra papel real (encargo §7.5): no hay ficha
  // !!! FORESA Villagarcia->Caldas en el set. Solo tests unitarios. Cuando aparezca
  // !!! una real, es la PRIMERA prueba a correr.
  if (viajes.some(function (v) { return v.es_multiviaje; })) {
    const expandidos = [];
    for (let i = 0; i < viajes.length; i++) {
      const v = viajes[i];
      if (!v.es_multiviaje) { expandidos.push(v); continue; }
      const N = v.n_viajes_declarado;
      const albaranes = v.docs.filter(function (d) { return (d.tipo_doc || '') === 'albaran'; });
      const secundarios = v.docs.filter(function (d) { return (d.tipo_doc || '') !== 'albaran'; });
      const M = albaranes.length;
      if (!N) {
        // Multiviaje pero no se leyo cuantos: no se puede desglosar. Una fila, REVISAR.
        marcar(v, 'bloque multiviaje sin numero de viajes legible; no se pudo desglosar');
        errores.push('Bloque multiviaje (' + (v.cliente || '?') + ' ' + (v.origen || '?') + '->' + (v.destino || '?') + '): no se leyo el numero de viajes en la ficha. No se desgloso.');
        expandidos.push(v);
        continue;
      }
      const nSlots = Math.max(N, M);
      if (M > N) { avisos.push('Bloque multiviaje ' + (v.cliente || '') + ' ' + (v.origen || '') + '->' + (v.destino || '') + ': declara ' + N + ' viajes y llegaron ' + M + ' albaranes; se generan ' + nSlots + '.'); }
      const reparto = CRUCE.repartirKm(v.km_cargados, nSlots); // [] si el bloque no trae km
      const bloqueDudoso = v.motivos_revision.length > 0;
      for (let j = 0; j < nSlots; j++) {
        const alb = (j < M) ? albaranes[j] : null;
        const nv = {
          hoja_idx: v.hoja_idx, orden: v.orden, sub_orden: j + 1,
          conductor: v.conductor, tractora: v.tractora, remolque: v.remolque, empresa: v.empresa, tractoraN: v.tractoraN,
          pagina_origen: v.pagina_origen,
          fecha_carga: v.fecha_carga, fecha_carga_texto: v.fecha_carga_texto, fecha_descarga: v.fecha_descarga,
          nombre_carga: v.nombre_carga, lugar_carga: v.lugar_carga, nombre_descarga: v.nombre_descarga, lugar_descarga: v.lugar_descarga,
          tipo_mercancia: v.tipo_mercancia,
          cantidad_kg: null, cantidad_declarada: v.cantidad_declarada, modo_cantidad: 'viajes',
          es_multiviaje: true, n_viajes_declarado: N,
          cliente: v.cliente, origen: v.origen, destino: v.destino, material: v.material,
          referencia: null, tipo_doc: null, fecha_documento: null,
          kg_documento: null, fuente_peso: null,
          importe_documento: null, tarifa_tn_documento: null,
          km_inicio: null, km_final: null, km_recorridos: null,
          km_cargados: reparto.length ? reparto[j] : null, km_vacios: null,
          origen_km: 'derivado_de_bloque',
          regimen_indexacion: v.regimen_indexacion,
          motivos_revision: bloqueDudoso ? v.motivos_revision.slice() : [],
          docs: alb ? [alb] : []
        };
        if (alb) {
          // Documento de origen del viaje: kg y referencia de SU albaran (D-01).
          nv.kg_documento = num(alb.kg_neto);
          nv.fuente_peso = nz(alb.tipo_doc);
          nv.referencia = nz(alb.referencia);
          nv.tipo_doc = nz(alb.tipo_doc);
          nv.fecha_documento = nz(alb.fecha);
          nv.estado = 'con_documentacion';
          nv.pendiente_falta = null; nv.pendiente_reclamar_a = null;
        } else {
          nv.estado = 'PENDIENTE_DOCUMENTACION';
          nv.pendiente_falta = 'albaran del viaje ' + (j + 1) + ' de ' + N + ' (multiviaje)';
          nv.pendiente_reclamar_a = 'cliente';
          errores.push('Bloque ' + (v.cliente || '') + ' ' + (v.origen || '') + '->' + (v.destino || '') + ': falta el albaran del viaje ' + (j + 1) + ' de ' + N + '. PENDIENTE_DOCUMENTACION (reclamar al cliente).');
        }
        nv.origen_campos = {
          cliente: v.origen_campos ? v.origen_campos.cliente : null,
          referencia: alb ? fuenteDoc(alb) : null,
          kg_documento: alb ? fuenteDoc(alb) : null,
          origen: v.origen_campos ? v.origen_campos.origen : null,
          destino: v.origen_campos ? v.origen_campos.destino : null,
          material: v.origen_campos ? v.origen_campos.material : null,
          km: (nv.km_cargados !== null) ? 'ficha:odometro:derivado_de_bloque' : null,
          cantidad_ficha: null
        };
        expandidos.push(nv);
      }
      // Secundarios (CMR/ticket) del bloque: sin dato real para asignarlos a un
      // viaje puntual, se anotan a nivel de bloque en vez de perderse en silencio.
      if (secundarios.length > 0) {
        avisos.push('Bloque multiviaje ' + (v.cliente || '') + ': ' + secundarios.length + ' documento(s) no-albaran (CMR/ticket) sin viaje puntual asignado; quedan a nivel de bloque. Revisar.');
      }
    }
    viajes = expandidos;
  }

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
 * @param {object} [opts]     {rutas} pasa a correlacionar (default cruce.js).
 */
function procesar(respuestas, metas, opts) {
  metas = Array.isArray(metas) ? metas : [];
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

  const res = correlacionar({ hojas: hojasAll }, rB, opts);
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

// Envoltorio especifico de n8n para el nodo Code "Formatear Linea Gesruta" del
// workflow [ESTEVEZ] Ingesta Viaje — WD0q9Ic0oDvUoJwp.
//
// Solo hace de puente: toma las respuestas de OpenAI (v3.4: N pasadas de ficha,
// una por pagina, + 1 pasada de documentos) y las empareja por indice con las
// metas de "Preparar Payload" (que dicen pass y pagina). Toda la logica vive en
// correlacionar.js. `node ficha/build-nodo.js` pega correlacionar.js delante de
// este archivo y produce el script final del nodo.

const respuestas = $input.all();
const metas = $('Preparar Payload').all().map(function (it) { return it.json || {}; });
return [{ json: procesar(respuestas, metas) }];
