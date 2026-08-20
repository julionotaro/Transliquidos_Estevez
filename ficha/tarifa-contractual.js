// ===== TARIFA CONTRACTUAL para la ingesta (tabla Tarifas -> columna del viaje) ==
//
// Busca, para un viaje ya armado (cliente + origen + destino + material), su
// tarifa contractual en la tabla `Tarifas`. Es la pieza que cierra el circulo
// ingesta -> facturacion: hoy el viaje solo copia la tarifa que venga IMPRESA en
// la OC (casi nunca hay OC); esto la trae de la tabla de tarifas pactadas.
//
// DOS PUENTES (sin ellos no matchea, §):
//   Puente 1 — PUNTOS CANONICOS. Tarifas usa el NOMBRE del punto ("CALDAS DE
//     REIS"); el viaje trae el literal del documento ("CALDAS"). Se resuelve el
//     literal con resolver-punto.js y se matchea por el nombre canonico.
//   Puente 2 — RAZON SOCIAL. Tarifas usa la razon social completa ("FORESA
//     IND.QUIMICAS DEL NOROESTE, S.A."); el viaje trae el nombre corto ("FORESA").
//     Se matchea por CONTENCION de tokens normalizados (el corto dentro del largo),
//     sin necesidad de una columna nueva.
//
// NUNCA inventa: si no hay match unico devuelve tarifa:null + motivo (para REVISAR).
// Logica PURA. En el nodo, build-nodo.js inlinea resolver-punto.js antes.

'use strict';

var RP = (typeof resolverPunto === 'function')
  ? { resolverPunto: resolverPunto, normalizar: normalizar }
  : require('../catalogo/resolver-punto.js');

function norm(s) { return RP.normalizar(s); }
function num(x) {
  if (x === null || x === undefined || x === '') { return null; }
  if (typeof x === 'number') { return isFinite(x) ? x : null; }
  var n = Number(String(x).replace(',', '.'));
  return isFinite(n) ? n : null;
}

// Puente 2: el cliente corto del viaje matchea la razon social larga de Tarifas
// si TODOS sus tokens estan contenidos en la razon social (o coincidencia exacta).
function clienteCoincide(clienteViaje, clienteTarifa) {
  var a = norm(clienteViaje), b = norm(clienteTarifa);
  if (!a || !b) { return false; }
  if (a === b) { return true; }
  var tb = {}; b.split(' ').forEach(function (t) { if (t) { tb[t] = true; } });
  var ta = a.split(' ').filter(function (t) { return t.length >= 2; });
  if (!ta.length) { return false; }
  for (var i = 0; i < ta.length; i++) { if (!tb[ta[i]]) { return false; } }
  return true;
}

// Material: "Cualquiera"/vacio = comodin; si no, inclusion en cualquier sentido.
function materialCoincide(matViaje, matTarifa) {
  var mt = norm(matTarifa);
  if (!mt || mt === 'CUALQUIERA') { return true; }
  var mv = norm(matViaje);
  if (!mv) { return false; }
  return mv.indexOf(mt) >= 0 || mt.indexOf(mv) >= 0;
}

// Puente 1: literal de lugar -> nombre canonico del punto (para matchear Tarifas).
function canonPunto(literal, catalogo) {
  if (catalogo && catalogo.length) {
    var r = RP.resolverPunto(literal, 'documento', catalogo);
    if (r.id_punto) { return { n: norm(r.nombre_canonico), resuelto: true, revisar: !!r.revisar, id: r.id_punto }; }
  }
  return { n: norm(literal), resuelto: false, revisar: false, id: null };
}

/**
 * Busca la tarifa contractual del viaje.
 * @param {{cliente,origen,destino,material}} viaje
 * @param {Array} tarifas  filas de la tabla Tarifas {cliente,origen,destino,material,tarifa_tn,precio_fijo}
 * @param {Array} [catalogo]  filas de la tabla puntos (para resolver origen/destino)
 * @returns {null | {tarifa_tn, precio_fijo, material_tarifa, origen_canon, destino_canon, revisar} | {tarifa:null, motivo, candidatas?}}
 */
function buscarTarifaContractual(viaje, tarifas, catalogo) {
  if (!viaje || !Array.isArray(tarifas) || !tarifas.length) { return null; }
  var oc = canonPunto(viaje.origen, catalogo);
  var dc = canonPunto(viaje.destino, catalogo);
  if (!oc.n || !dc.n) { return { tarifa: null, motivo: 'origen/destino del viaje vacios; no se busca tarifa' }; }
  if (!norm(viaje.cliente)) { return { tarifa: null, motivo: 'viaje sin cliente resuelto; no se busca tarifa' }; }

  var cand = [];
  for (var i = 0; i < tarifas.length; i++) {
    var t = tarifas[i];
    if (!clienteCoincide(viaje.cliente, t.cliente)) { continue; }
    if (norm(t.origen) !== oc.n || norm(t.destino) !== dc.n) { continue; }
    if (!materialCoincide(viaje.material, t.material)) { continue; }
    cand.push(t);
  }
  if (cand.length === 0) {
    return { tarifa: null, motivo: 'sin tarifa cargada para ' + oc.n + ' -> ' + dc.n + ' (cliente ' + (norm(viaje.cliente)) + ')' };
  }
  // Preferir material ESPECIFICO sobre el comodin "Cualquiera".
  var esp = cand.filter(function (t) { var m = norm(t.material); return m && m !== 'CUALQUIERA'; });
  var elegidas = esp.length ? esp : cand;
  if (elegidas.length > 1) {
    return { tarifa: null, motivo: elegidas.length + ' tarifas posibles para ' + oc.n + ' -> ' + dc.n + ' — revisar cual aplica', candidatas: elegidas };
  }
  var g = elegidas[0];
  return {
    tarifa_tn: num(g.tarifa_tn),
    precio_fijo: num(g.precio_fijo),
    material_tarifa: g.material || null,
    origen_canon: oc.id, destino_canon: dc.id,
    revisar: oc.revisar || dc.revisar
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buscarTarifaContractual: buscarTarifaContractual,
    clienteCoincide: clienteCoincide,
    materialCoincide: materialCoincide,
  };
}
