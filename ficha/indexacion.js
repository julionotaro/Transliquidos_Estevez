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

/** Tramo vigente [desde,hasta] (inclusive, string ISO) para un grupo+fecha. null si no hay tramo. */
function buscarPct(grupo, fecha, indexacionRows) {
  var filas = Array.isArray(indexacionRows) ? indexacionRows : [];
  if (!fecha) { return null; }
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    // La categoria vive en `tipo` (recarga 2026-08-06 desde el Excel); `cliente`
    // queda vacio. La identidad cliente->categoria se resuelve en codigo
    // (grupoIndexacion), no en la tabla -- mismo patron que ficha/clientes.js.
    if (CRUCE_IDX.norm(f.tipo) !== grupo) { continue; }
    if ((f.desde || '') <= fecha && fecha <= (f.hasta || '')) {
      var pct = parseFloat(f.pct);
      if (isFinite(pct)) { return { pct: pct, fila: f }; }
    }
  }
  return null;
}

/**
 * Indexacion para una fila de la planilla. NUNCA calcula un importe para
 * regimen agregado (D-03): solo marca el regimen. Para 'linea' SI calcula,
 * sobre el importe de transporte de la linea (D-08).
 *
 * @param {object} viaje  {cliente, fecha, regimen_indexacion}
 * @param {number|null} importeLinea  cantidad x tarifa ya calculado (D-08 base).
 * @param {Array<object>} indexacionRows  filas DEDUPLICADAS de Indexacion.
 * @returns {{modo:'calculada'|'regimen_pendiente'|'incluida'|'sin_regimen',
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
  if (!hit) {
    return {
      modo: 'sin_regimen', pct: null, importe: null, grupo: g.grupo, etiqueta: '-',
      motivo: 'sin_tramo_vigente: ' + g.grupo + ' @ ' + (v.fecha || '(sin fecha)')
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
