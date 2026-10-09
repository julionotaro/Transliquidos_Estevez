// Tests — mini-mapa chofer -> tipo_conductor.
// El riesgo real: distinguir "ABAL" (autonomo) de "ABALO"/"ABELO"/"ABEY"
// (dependientes), que conviven en la flota. Match por token, nunca por substring.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { tipoConductor } = require('../conductores.js');

test('autonomos: Abal, Fraga, Alfonsin (nombres reales de ficha)', () => {
  assert.strictEqual(tipoConductor('JUAN MANUEL ABAL'), 'autonomo');
  assert.strictEqual(tipoConductor('PEDRO FRAGA'), 'autonomo');
  assert.strictEqual(tipoConductor('JOSE CARLOS ALFONSIN'), 'autonomo');
});

test('autonomos: tolerante a acentos y minusculas', () => {
  assert.strictEqual(tipoConductor('José Carlos Alfonsín'), 'autonomo');
  assert.strictEqual(tipoConductor('pedro fraga'), 'autonomo');
});

test('NO confundir Abal con Abalo/Abelo/Abey (son dependientes)', () => {
  assert.strictEqual(tipoConductor('CARLOS ABALO'), 'dependiente');
  assert.strictEqual(tipoConductor('CARLOS ABELO'), 'dependiente');
  assert.strictEqual(tipoConductor('RUBEN ABELO'), 'dependiente');
  assert.strictEqual(tipoConductor('MANUEL ABEY'), 'dependiente');
});

test('resto de la flota: dependiente', () => {
  ['MARCOS', 'ASENSI', 'BREOGAN', 'JOSE ARIAS', 'NUNO PAIVA', 'OSCAR SAYANS'].forEach(function (n) {
    assert.strictEqual(tipoConductor(n), 'dependiente', n + ' deberia ser dependiente');
  });
});

test('chofer vacio/ilegible -> "" (no se afirma nada)', () => {
  assert.strictEqual(tipoConductor(''), '');
  assert.strictEqual(tipoConductor(null), '');
  assert.strictEqual(tipoConductor(undefined), '');
  assert.strictEqual(tipoConductor('   '), '');
});
