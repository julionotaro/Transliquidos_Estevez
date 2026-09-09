// ===== INDEXACION (suplemento gasoleo) — planilla carga/auditoria (v1.1 p.2) =
//
// Resuelve el % de indexacion para viajes en regimen 'linea' contra la tabla
// real `Indexacion` (or1otD9WsjJ3V8Cr). Schema real confirmado por readback
// 2026-08-03: cliente (en realidad GRUPO, no el cliente del viaje), tipo,
// pct (string), desde, hasta.
//
// HALLAZGO del readback: la tabla tiene 37.660 filas en bruto, pero son 70
// tramos reales duplicados exactamente x538 (= el numero de filas de
// Tarifas -- huella de un bug de carga, probablemente un cruce accidental
// contra Tarifas al popular la tabla). docs/brief-v3-oficina-agentica.md ya
// documentaba "70 tramos, 6 solapas oficiales" -- consistente con los 70
// tramos unicos verificados. deduplicarIndexacion() hace esa limpieza; el
// nodo que lee la tabla la llama antes de armar la planilla (ver
// nodo-planilla.wrapper.js). NO corrige la tabla en n8n -- eso es un cambio de
// datos, fuera de alcance de esta pieza; solo evita arrastrar el bug a la
// busqueda.
//
// Grupos reales confirmados (docs/reglas-facturacion.md "Grupos de indexacion
// (confirmado)"): FORESA-BRESFOR, QUIMIDROGA, HELM, OTROS, AGENCIA, AUTONOMOS.
// AGENCIA/AUTONOMOS no tienen regla de asignacion por cliente documentada
// ("pendientes" en docs/reglas-facturacion.md) -- este modulo NO los asigna
// nunca via cliente, para no inventar una regla de negocio que no esta
// confirmada.
//
// D-03 / nota del encargo: la indexacion AGREGADA (quincenal/mensual) NUNCA
// se calcula aca -- se cierra en facturacion. Este modulo la marca (regimen
// visible) y no toca un numero.

'use strict';

var CRUCE_IDX = (typeof norm === 'function') ? { norm: norm } : require('./cruce.js');

function round2(n) { return Math.round(n * 100) / 100; }

/**
 * Limpia la duplicacion x538 de la tabla real (ver nota de cabecera): agrupa
 * por (cliente, tipo, pct, desde, hasta) y se queda con una fila por
 * combinacion unica. Idempotente -- correrla sobre datos ya limpios no cambia
 * nada. NO escribe de vuelta en n8n, solo filtra en memoria para la busqueda.
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
    if (CRUCE_IDX.norm(f.cliente) !== grupo) { continue; }
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
