// Tests — padron de flota: resolver la matricula contra el conjunto CERRADO.
// La flota son ~28 tractoras muy separadas entre si (dato: export Gesruta de
// 8.756 viajes), asi que 4-5 caracteres bien leidos alcanzan para identificarla.
// Lo que NO debe pasar: resolver cuando la lectura queda a mitad de camino entre
// dos matriculas reales (par 3729JLH / 3729JWP).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { resolverMatricula, normalizarMatricula, FLOTA_TRACTORAS } = require('../flota.js');

test('match exacto: camino feliz, sin marca de correccion', () => {
  const r = resolverMatricula('0332LPL');
  assert.strictEqual(r.matricula, '0332LPL');
  assert.strictEqual(r.metodo, 'exacta');
  assert.strictEqual(r.corregida, false);
  assert.strictEqual(r.motivo, '');
});

test('normalizacion: prefijo de pais y cero inicial perdido', () => {
  assert.strictEqual(normalizarMatricula('ES 0332LPL'), '0332LPL');
  assert.strictEqual(normalizarMatricula('0332-LPL'), '0332LPL');
  assert.strictEqual(normalizarMatricula('332LPL'), '0332LPL', 'repone el cero inicial');
  assert.strictEqual(normalizarMatricula(null), '');
});

test('CASO REAL: la ficha se leyo 0332LPZ (Z por L) -> resuelve a 0332LPL de la flota', () => {
  const r = resolverMatricula('0332LPZ');
  assert.strictEqual(r.matricula, '0332LPL');
  assert.strictEqual(r.metodo, 'flota');
  assert.strictEqual(r.corregida, true);
  assert.strictEqual(r.aciertos, 6);
  assert.match(r.motivo, /padron de flota/);
});

test('lectura con 2 digitos y 1 letra mal (4 de 7) -> igual resuelve si es unica', () => {
  // 2498KZL es de la flota. Rompemos 3 caracteres.
  const r = resolverMatricula('2X98KZX');
  assert.strictEqual(r.matricula, '2498KZL');
  assert.strictEqual(r.metodo, 'flota');
});

test('SALVAGUARDA: lectura a mitad de camino entre 3729JLH y 3729JWP -> ambigua, no resuelve', () => {
  // 3729J?? con la ultima parte ilegible: ambas de la flota comparten 5 de 7.
  const r = resolverMatricula('3729JXX');
  assert.strictEqual(r.matricula, null, 'no elige entre dos matriculas reales de la flota');
  assert.strictEqual(r.metodo, 'ambigua');
  assert.ok(r.candidatas.length > 1, 'devuelve las candidatas para revision');
  assert.match(r.motivo, /se parece por igual/);
});

test('el par peligroso se resuelve cuando la lectura es exacta o casi', () => {
  assert.strictEqual(resolverMatricula('3729JLH').matricula, '3729JLH');
  assert.strictEqual(resolverMatricula('3729JWP').matricula, '3729JWP');
  // Un solo caracter mal sobre JLH: le saca 2 de ventaja a JWP (6 vs 4... o 5).
  const r = resolverMatricula('3729JLX');
  assert.strictEqual(r.matricula, '3729JLH', 'con 6 de 7 gana JLH por margen');
});

test('matricula que NO es de la flota (subcontratado) -> se devuelve tal cual, sin bloquear', () => {
  const r = resolverMatricula('1234ABC');
  assert.strictEqual(r.metodo, 'sin_padron');
  assert.strictEqual(r.matricula, '1234ABC', 'no se fuerza a una de la flota');
  assert.strictEqual(r.corregida, false);
  assert.match(r.motivo, /subcontratado/);
});

test('matricula ilegible/vacia -> ilegible, sin inventar', () => {
  const r = resolverMatricula(null);
  assert.strictEqual(r.matricula, null);
  assert.strictEqual(r.metodo, 'ilegible');
});

test('el padron se puede inyectar (tabla flota a futuro)', () => {
  const r = resolverMatricula('1234ABD', ['1234ABC']);
  assert.strictEqual(r.matricula, '1234ABC');
  assert.strictEqual(r.metodo, 'flota');
});

test('la semilla de flota tiene las 28 tractoras reales y formato valido', () => {
  assert.strictEqual(FLOTA_TRACTORAS.length, 28);
  FLOTA_TRACTORAS.forEach(function (m) {
    assert.match(m, /^\d{4}[A-Z]{3}$/, m + ' debe tener formato espanol DDDDLLL');
  });
  assert.strictEqual(new Set(FLOTA_TRACTORAS).size, 28, 'sin duplicados');
});
