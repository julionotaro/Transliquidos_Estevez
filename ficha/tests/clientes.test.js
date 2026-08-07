// Tests — resolucion explicita de identidad de cliente (ficha/clientes.js).
//
// Razones sociales tomadas 1:1 de la tabla real `Tarifas` tras la recarga del
// Excel (Siwhv2AUWTSeFlrJ, 698 filas, 2026-08-04) -- no son inventadas.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { resolverCliente, ALIAS_CLIENTE } = require('../clientes.js');

test('clientes: resuelve el codigo corto leido a la razon social EXACTA de Tarifas', () => {
  assert.strictEqual(resolverCliente('FORESA').razonSocial, 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.');
  assert.strictEqual(resolverCliente('RNM').razonSocial, 'RNM TRANSPORTES QUIMICOS, LDA');
  assert.strictEqual(resolverCliente('QUIMIDROGA').razonSocial, 'QUIMIDROGA, S.A.');
  assert.strictEqual(resolverCliente('HELM').razonSocial, 'HELM IBERICA, S.A.');
  assert.strictEqual(resolverCliente('QUIMICAS DEL JARAMA').razonSocial, 'QUIMICAS DEL JARAMA, S.A.');
});

test('clientes: BRESFOR resuelve su PROPIA razon social, NO la de FORESA (cambio vs codigo viejo)', () => {
  // En la tabla vieja BRESFOR era solo un origen de FORESA; el Excel nuevo lo
  // trae como cliente propio. Conflarlo con FORESA facturaria la tarifa de un
  // cliente a otro -- exactamente lo que el mapa explicito evita.
  const r = resolverCliente('BRESFOR');
  assert.strictEqual(r.razonSocial, 'BRESFOR IND. DO FORMOL, S.A.');
  assert.notStrictEqual(r.razonSocial, 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.');
});

test('clientes: reconoce el token dentro de una lectura mas larga', () => {
  assert.strictEqual(resolverCliente('foresa').razonSocial, 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.');
  assert.strictEqual(resolverCliente('RNM TRANSPORTES').razonSocial, 'RNM TRANSPORTES QUIMICOS, LDA');
});

test('clientes: codigo sin alias mapeado -> razonSocial null + motivo ruidoso con el valor leido', () => {
  // Mismo patron que "cliente no reconocido falla ruidoso" (cruce.js). NUNCA
  // fuzzy-match ni tarifa a ciegas.
  const r = resolverCliente('TEPSA');
  assert.strictEqual(r.razonSocial, null);
  assert.match(r.motivo, /cliente_no_mapeado: TEPSA/);
});

test('clientes: cliente no leido -> motivo cliente_no_leido, sin excepcion', () => {
  assert.strictEqual(resolverCliente('').razonSocial, null);
  assert.strictEqual(resolverCliente(null).motivo, 'cliente_no_leido');
  assert.strictEqual(resolverCliente(undefined).motivo, 'cliente_no_leido');
});

test('clientes: NINGUN alias mapea a un fragmento generico (S.A., TRANSPORTES, QUIMICAS)', () => {
  // Guardia contra reintroducir el bug de identidad por fragmento: el token de
  // reconocimiento debe ser distintivo, no un sufijo/generico que cruce clientes.
  const genericos = ['S.A.', 'SA', 'TRANSPORTES', 'QUIMICAS', 'IND', 'LDA'];
  for (const a of ALIAS_CLIENTE) {
    assert.ok(!genericos.includes(a.token.toUpperCase().trim()),
      'token "' + a.token + '" es demasiado generico y cruzaria razones sociales');
  }
});
