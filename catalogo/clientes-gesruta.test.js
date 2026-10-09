// Tests — cliente -> codigo Gesruta (conjunto cerrado minado del CSV real).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { codigoCliente, CLIENTES_GESRUTA } = require('./clientes-gesruta.js');

test('codigos reales del export (cli_codcli)', () => {
  // RNM = 661 es el de la tabla de referencia de Julio.
  const casos = { 'RNM': '661', 'FORESA': '1', 'BRESFOR': '42', 'HELM': '323',
    'BALTRANSA': '10', 'TRANSTAMBRE': '20', 'QUIMIDROGA, S.A.': '403' };
  Object.keys(casos).forEach(function (c) {
    assert.strictEqual(codigoCliente(c).codigo, casos[c], c);
  });
});

test('el nombre corto del viaje resuelve igual que la razon social completa', () => {
  assert.strictEqual(codigoCliente('RNM').codigo, codigoCliente('RNM TRANSPORTES QUIMICOS, LDA').codigo);
});

test('QUIMIDROGA solo -> S.A. (403); QUIMIDROGA PORTUGAL -> 514 (por cobertura)', () => {
  assert.strictEqual(codigoCliente('QUIMIDROGA').codigo, '403');
  assert.strictEqual(codigoCliente('QUIMIDROGA PORTUGAL, LDA').codigo, '514');
});

test('la puntuacion pegada al token no rompe el match (coma en "BALTRANSA, S.A.")', () => {
  assert.strictEqual(codigoCliente('BALTRANSA').codigo, '10');
});

test('cliente desconocido o vacio -> null + motivo, nunca un codigo inventado', () => {
  assert.strictEqual(codigoCliente('EMPRESA QUE NO EXISTE SL').codigo, null);
  assert.strictEqual(codigoCliente('').codigo, null);
  assert.strictEqual(codigoCliente(null).codigo, null);
  assert.match(codigoCliente('DESCONOCIDA').motivo, /sin_codigo_gesruta/);
});

test('el catalogo es el del export real', () => {
  assert.strictEqual(CLIENTES_GESRUTA.length, 35);
});
