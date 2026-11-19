// Regresion del tarifario oficial de QUIMIDROGA (pedido-armador-lee-tarifarios, Julio 19/11).
// Correr: node --test herramientas/armar_orden/tarifa-quimidroga.test.js
'use strict';
var test = require('node:test');
var assert = require('node:assert');
var datos = require('./lib/datos.js');
var cruce = require('../../ficha/cruce.js');

var q = datos.cargarTarifarioQuimidroga();

// Replica el match del armador (tarifaQuimidroga): origen+destino (coincideTexto) + vigencia.
function tq(o, d, f) {
  for (var i = 0; i < q.length; i++) {
    var r = q[i];
    if (!cruce.coincideTexto(o, r.origen) || !cruce.coincideTexto(d, r.destino)) { continue; }
    if (r.desde && f && f < r.desde) { continue; }
    if (r.hasta && f && f > r.hasta) { continue; }
    var tn = parseFloat(String(r.precio_tn).replace(',', '.'));
    if (isFinite(tn)) { return tn; }
  }
  return null;
}

test('Barcelona->Vilarinho 2026 = 84,68 (el caso que disparo el pedido)', function () {
  assert.strictEqual(tq('BARCELONA', 'VILARINHO', '2026-11-17'), 84.68);
});

test('Barcelona->Aveiro 2026 = 84,68 (zona Aveiro)', function () {
  assert.strictEqual(tq('BARCELONA', 'AVEIRO', '2026-11-17'), 84.68);
});

test('respeta vigencia: Espinho solo 2025 -> null en 2026, 84,68 en 2025', function () {
  assert.strictEqual(tq('BARCELONA', 'ESPINHO', '2026-11-17'), null);
  assert.strictEqual(tq('BARCELONA', 'ESPINHO', '2025-06-01'), 84.68);
});

test('usa precio_tn_40 (no el de 44 TN) y trae vigencia', function () {
  var row = q.find(function (r) { return cruce.coincideTexto('BARCELONA', r.origen) && cruce.coincideTexto('VILARINHO', r.destino); });
  assert.ok(row, 'existe la fila Barcelona->Vilarinho');
  assert.strictEqual(String(row.precio_tn), '84.68');
  assert.ok(row.desde && row.hasta, 'trae vigencia desde/hasta');
});
