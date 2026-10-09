// Tests — deduplicacion de viajes (modelo-dominio-lectura.md §5.1).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { dedupViajes } = require('../dedup.js');

function viaje(over) {
  return Object.assign({
    id: undefined, tractora: '0332LPL', km_inicio: 735220, fecha: '2026-08-04',
    cliente: 'QUIMIDROGA', origen: 'Barcelona', destino: 'Moraleja', material: 'Lisina',
    referencia: '706013', kg_documento: 24420, motivo_revision: ''
  }, over);
}

test('dedup: re-subir un viaje identico (misma matricula+km_inicio, mismos datos) -> NO se inserta (duplicado puro)', () => {
  const existente = viaje({ id: 1 });
  const nuevo = viaje({ id: undefined });
  const r = dedupViajes([nuevo], [existente]);
  assert.strictEqual(r.insertar.length, 0, 'no se crea segunda fila');
  assert.strictEqual(r.omitidos.length, 1);
  assert.strictEqual(r.actualizarMotivo.length, 0);
});

test('dedup: dos rotaciones Foresa mismo dia/cliente/ruta/material, km_inicio distinto -> DOS filas (§7 no se rompe)', () => {
  const rot1 = viaje({ cliente: 'FORESA', origen: 'Villagarcia', destino: 'Caldas', material: 'metanol', km_inicio: 100000, referencia: '2016120' });
  const rot2 = viaje({ cliente: 'FORESA', origen: 'Villagarcia', destino: 'Caldas', material: 'metanol', km_inicio: 100600, referencia: '2016121' });
  const r = dedupViajes([rot1, rot2], []);
  assert.strictEqual(r.insertar.length, 2, 'cada rotacion es un viaje (km_inicio distinto)');
  assert.strictEqual(r.omitidos.length, 0);
});

test('dedup: matricula+ruta iguales pero km_inicio MUY distinto -> dos viajes reales (se insertan)', () => {
  const existente = viaje({ id: 1, km_inicio: 100000 });
  const nuevo = viaje({ km_inicio: 200000 });
  const r = dedupViajes([nuevo], [existente]);
  assert.strictEqual(r.insertar.length, 1, 'km lejano -> viaje distinto');
  assert.ok(!r.insertar[0]._motivo_dedup, 'sin sospecha de km mal leido');
});

test('dedup: misma ruta, km_inicio por POCO distinto -> se inserta PERO marcado REVISAR (no duplicado encubierto)', () => {
  const existente = viaje({ id: 1, km_inicio: 100000 });
  const nuevo = viaje({ km_inicio: 100030 }); // 30 km, dentro del umbral (50)
  const r = dedupViajes([nuevo], [existente]);
  assert.strictEqual(r.insertar.length, 1);
  assert.match(r.insertar[0]._motivo_dedup, /km_inicio discrepante: 100030 vs 100000/);
});

test('dedup: reingreso (mismo matricula+km_inicio) con DATOS que difieren -> NO inserta, actualiza motivo ADITIVO de la fila existente', () => {
  const existente = viaje({ id: 7, cliente: 'QUIMIDROGA', motivo_revision: 'algo previo del humano' });
  const nuevo = viaje({ cliente: 'RELISA' }); // dato distinto
  const r = dedupViajes([nuevo], [existente]);
  assert.strictEqual(r.insertar.length, 0, 'no se duplica');
  assert.strictEqual(r.actualizarMotivo.length, 1);
  assert.strictEqual(r.actualizarMotivo[0].id, 7);
  assert.match(r.actualizarMotivo[0].motivo_revision, /^algo previo del humano; reingreso de viaje ya existente/, 'aditivo: conserva el motivo previo');
  assert.strictEqual(r.actualizarMotivo[0].estado_lectura, 'REVISAR');
});

test('dedup: dentro del mismo lote, dos candidatos con la misma llave -> uno se inserta, el otro se omite', () => {
  const a = viaje({ km_inicio: 500000 });
  const b = viaje({ km_inicio: 500000 });
  const r = dedupViajes([a, b], []);
  assert.strictEqual(r.insertar.length, 1);
  assert.strictEqual(r.omitidos.length, 1);
});

test('dedup: candidato sin km_inicio (no se puede deduplicar) -> se inserta (no se pierde el viaje)', () => {
  const nuevo = viaje({ km_inicio: null });
  const r = dedupViajes([nuevo], [viaje({ id: 1 })]);
  assert.strictEqual(r.insertar.length, 1);
});
