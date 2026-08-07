// ===== INDEXACION (suplemento gasoleo) — planilla carga/auditoria (v1.1 p.2) =
//
// Resuelve el % de indexacion para viajes en regimen 'linea' contra la tabla
// real `Indexacion` (or1otD9WsjJ3V8Cr). Schema: cliente, tipo, pct, desde,
// hasta (todas string).
//
// RECARGA 2026-08-06 (encargo recarga-indexacion, desde SUPLEMENTO_GASOLEO.xlsx):
// la CATEGORIA vive ahora en `tipo` (FORESA-BRESFOR / HELM / QUIMIDROGA / OTROS,
// nombre de la solapa del Excel) y `cliente` queda VACIO. La identidad
// cliente->categoria se resuelve en codigo (grupoIndexacion), NO en la tabla --
// mismo patron que ficha/clientes.js para tarifas. Antes la categoria vivia en
// `cliente` (mal nombrado) y `tipo` era el literal 'gasoleo'; el match paso a
// ser por `tipo` (ver buscarPct).
//
// Una fila por tramo (~48 filas activas), no una por cliente. La tabla vieja
// llego a tener 37.660 filas por un cross-join accidental contra Tarifas
// (538 x 70); la recarga la deja limpia. deduplicarIndexacion() queda como
// defensa idempotente (el nodo la llama antes de armar la planilla, ver
// nodo-planilla.wrapper.js); sobre datos limpios no cambia nada.
//
// Categorias activas en v1 (docs/dominio-facturacion.md §4.1): FORESA-BRESFOR,
// QUIMIDROGA, HELM, OTROS. Todo cliente que no caiga en una nombrada usa OTROS
// (fallback por defecto). Las solapas AGENCIA/AUTONOMOS del Excel NO se cargan
// (circuito de subcontratacion, fuera de v1). BALTRANSA es caso aparte (0% en
// factura, no depende de esta tabla).
//
// D-03 / nota del encargo: la indexacion AGREGADA (quincenal/mensual) NUNCA
// se calcula aca -- se cierra en facturacion. Este modulo la marca (regimen
// visible) y no toca un numero.

'use strict';

var CRUCE_IDX = (typeof norm === 'function') ? { norm: norm } : require('./cruce.js');

function round2(n) { return Math.round(n * 100) / 100; }
// pct 0.1838 -> "18.38%" (para los motivos de REVISAR, legible por la oficina).
function pctTxt(p) { return round2(p * 100) + '%'; }

/**
 * Defensa idempotente contra duplicados: agrupa por (cliente, tipo, pct, desde,
 * hasta) y se queda con una fila por combinacion unica. Tras la recarga
 * 2026-08-06 la tabla ya esta limpia, asi que sobre datos buenos no cambia nada;
 * queda por si un cross-join accidental (como el x538 historico) volviera a
 * colarse. NO escribe de vuelta en n8n, solo filtra en memoria para la busqueda.
 */
function deduplicarIndexacion(indexacionRows) {
  var filas = Array.isArray(indexacionRows) ? indexacionRows : [];
  var vistos = {};
  var out = [];
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    var clave = [f.cliente, f.tipo, f.pct, f.desde, f.hasta].join('|');
    if (vistos[clave]) { continue; }
    vistos[clave] = true;
    out.push(f);
  }
  return out;
}

/**
 * Grupo de indexacion (solapa) para un cliente de viaje, segun
 * docs/reglas-facturacion.md "Grupos de indexacion (confirmado)":
 *   FORESA, BRESFOR -> FORESA-BRESFOR
 *   QUIMIDROGA -> QUIMIDROGA
 *   HELM -> HELM
 *   RNM -> OTROS (RNM no tiene solapa propia, confirmado en factura)
 *   QUIMICAS DEL JARAMA -> OTROS (confirmado, "indexacion (OTROS)")
 *   cualquier otro cliente -> OTROS por defecto (D-5), con aviso visible.
 */
function grupoIndexacion(clienteViaje) {
  var cl = CRUCE_IDX.norm(clienteViaje);
  if (cl && (cl.indexOf('FORESA') >= 0 || cl.indexOf('BRESFOR') >= 0)) { return { grupo: 'FORESA-BRESFOR', motivo: null }; }
  if (cl && cl.indexOf('QUIMIDROGA') >= 0) { return { grupo: 'QUIMIDROGA', motivo: null }; }
  if (cl && cl.indexOf('HELM') >= 0) { return { grupo: 'HELM', motivo: null }; }
  if (cl && cl.indexOf('RNM') >= 0) { return { grupo: 'OTROS', motivo: null }; }
  if (cl && cl.indexOf('JARAMA') >= 0) { return { grupo: 'OTROS', motivo: null }; }
  return { grupo: 'OTROS', motivo: 'grupo_por_defecto: cliente "' + (clienteViaje || '(no leido)') + '" sin regla explicita (D-5)' };
}

/**
 * Resuelve el tramo de indexacion para un grupo+fecha. NO devuelve el primero en
 * silencio: aplica la regla de borde §4.4 (docs/dominio-facturacion.md).
 *
 * La categoria vive en `tipo` (recarga 2026-08-06 desde el Excel); `cliente`
 * queda vacio. La identidad cliente->categoria se resuelve en codigo
 * (grupoIndexacion), no en la tabla -- mismo patron que ficha/clientes.js.
 *
 * @returns {{estado:'ok', pct:number, fila:object}}                     un unico % cubre la fecha
 *        | {{estado:'sin_tramo', pct:null, fila:null}}                  ningun tramo cubre la fecha (hueco / fuera de rango)
 *        | {{estado:'sin_fecha', pct:null, fila:null}}                  no hay fecha del viaje
 *        | {{estado:'ambiguo', pct:null, fila:null, candidatos:number[], filas:object[]}}  la fecha cae en >1 tramo con % DISTINTO (dia de corte)
 */
function buscarPct(grupo, fecha, indexacionRows) {
  var filas = Array.isArray(indexacionRows) ? indexacionRows : [];
  if (!fecha) { return { estado: 'sin_fecha', pct: null, fila: null }; }
  var matches = [];
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (CRUCE_IDX.norm(f.tipo) !== grupo) { continue; }
    if ((f.desde || '') <= fecha && fecha <= (f.hasta || '')) {
      var pct = parseFloat(f.pct);
      if (isFinite(pct)) { matches.push({ pct: pct, fila: f }); }
    }
  }
  if (matches.length === 0) { return { estado: 'sin_tramo', pct: null, fila: null }; }
  var distintos = [];
  for (var j = 0; j < matches.length; j++) { if (distintos.indexOf(matches[j].pct) < 0) { distintos.push(matches[j].pct); } }
  // Solape en dia de corte (hasta de un tramo = desde del siguiente) con %
  // distinto: la fecha es ambigua. NO se elige uno en silencio (§4.4) -> REVISAR.
  // Si todos los tramos que cubren la fecha traen el MISMO %, no hay ambiguedad.
  if (distintos.length > 1) {
    return { estado: 'ambiguo', pct: null, fila: null, candidatos: distintos, filas: matches.map(function (m) { return m.fila; }) };
  }
  return { estado: 'ok', pct: matches[0].pct, fila: matches[0].fila };
}

/**
 * Indexacion para una fila de la planilla. NUNCA calcula un importe para
 * regimen agregado (D-03): solo marca el regimen. Para 'linea' SI calcula,
 * sobre el importe de transporte de la linea (D-08).
 *
 * @param {object} viaje  {cliente, fecha, regimen_indexacion}
 * @param {number|null} importeLinea  cantidad x tarifa ya calculado (D-08 base).
 * @param {Array<object>} indexacionRows  filas DEDUPLICADAS de Indexacion.
 * @returns {{modo:'calculada'|'regimen_pendiente'|'incluida'|'sin_regimen'|'revisar',
 *            pct:number|null, importe:number|null, grupo:string|null,
 *            etiqueta:string, motivo:string|null}}
 */
function indexacionDeFila(viaje, importeLinea, indexacionRows) {
  var v = viaje || {};
  var regimen = v.regimen_indexacion;

  if (regimen === 'incluida') {
    return { modo: 'incluida', pct: 0, importe: 0, grupo: null, etiqueta: 'incluida', motivo: null };
  }
  if (regimen === 'agregada_quincenal' || regimen === 'agregada_mensual') {
    return {
      modo: 'regimen_pendiente', pct: null, importe: null, grupo: null,
      etiqueta: regimen + ' (pendiente cierre en facturacion)', motivo: null
    };
  }
  if (regimen !== 'linea') {
    return { modo: 'sin_regimen', pct: null, importe: null, grupo: null, etiqueta: '-', motivo: 'sin_regimen_indexacion' };
  }

  var g = grupoIndexacion(v.cliente);
  var hit = buscarPct(g.grupo, v.fecha, indexacionRows);

  // §4.4 (regla de borde): la fecha cae en un dia de corte que pertenece a dos
  // tramos con % distinto. NO se elige uno en silencio -> REVISAR, con los pct
  // candidatos y la fecha en el motivo para que la oficina defina la convencion.
  if (hit.estado === 'ambiguo') {
    return {
      modo: 'revisar', pct: null, importe: null, grupo: g.grupo, etiqueta: 'REVISAR',
      motivo: 'indexacion_ambigua: ' + g.grupo + ' @ ' + (v.fecha || '(sin fecha)') +
        ' cae en tramos con % distinto (' + hit.candidatos.map(pctTxt).join(' / ') + '); definir convencion de dia de corte'
    };
  }
  // §4.4: fecha no cubierta por ningun tramo del Excel (hueco o fuera de rango).
  // NO se aplica 0 ni el tramo vecino -> REVISAR, con la fecha en el motivo.
  if (hit.estado !== 'ok') {
    return {
      modo: 'revisar', pct: null, importe: null, grupo: g.grupo, etiqueta: 'REVISAR',
      motivo: 'indexacion_sin_tramo: ' + g.grupo + ' @ ' + (v.fecha || '(sin fecha)') + ' fuera de los tramos cargados'
    };
  }

  var importe = (typeof importeLinea === 'number' && isFinite(importeLinea)) ? round2(importeLinea * hit.pct) : null;
  return {
    modo: 'calculada', pct: hit.pct, importe: importe, grupo: g.grupo,
    etiqueta: round2(hit.pct * 100) + '%' + (g.motivo ? ' (' + g.motivo + ')' : ''),
    motivo: null
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    deduplicarIndexacion: deduplicarIndexacion,
    grupoIndexacion: grupoIndexacion,
    buscarPct: buscarPct,
    indexacionDeFila: indexacionDeFila
  };
}
