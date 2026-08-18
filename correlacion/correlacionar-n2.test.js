// Tests — correlacion N2 documento<->viaje (Encargo 3, §5.2 / §7).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { correlacionarN2, clasificarDocumento } = require('./correlacionar-n2.js');

const CAT = [
  { id_punto: 'VALDEM', nombre_canonico: 'VALDEMORO', alias: '' },
  { id_punto: 'CURTIS', nombre_canonico: 'CURTIS', alias: '' },
  { id_punto: 'VILLAG', nombre_canonico: 'VILLAGARCIA', alias: '' },
  { id_punto: 'CALDAS', nombre_canonico: 'CALDAS DE REIS', alias: '' },
];

function oc(over) {
  return Object.assign({ tipo_doc: 'orden_transporte', referencia: '', cliente: 'BALTRANSA',
    origen: 'VALDEMORO', destino: 'CURTIS', material: 'A. Nitrico', fecha: '2026-08-10', kg_neto: 14000 }, over);
}
function viaje(over) {
  return Object.assign({ id: 1, referencia: '', origen: 'VALDEMORO', destino: 'CURTIS',
    material: 'A. Nitrico', fecha_carga: '2026-08-11', cantidad_kg: 14000 }, over);
}

test('clasificador binario: orden vs transporte vs desconocido', () => {
  assert.strictEqual(clasificarDocumento({ tipo_doc: 'orden_carga' }), 'orden');
  assert.strictEqual(clasificarDocumento({ tipo_doc: 'cmr' }), 'transporte');
  assert.strictEqual(clasificarDocumento({ tipo_doc: 'otro', encabezado: 'ORDEN DE CARGA nº 333' }), 'orden');
  assert.strictEqual(clasificarDocumento({ tipo_doc: '' }), 'desconocido');
});

test('1) Baltransa: OC dia 10, viaje dia 11 -> correlaciona por N2', () => {
  const r = correlacionarN2(oc({ fecha: '2026-08-10' }), [viaje({ id: 1, fecha_carga: '2026-08-11' })], CAT);
  assert.strictEqual(r.correlacion, 'N2');
  assert.strictEqual(r.viaje.id, 1);
});

test('2) OC dia 10, viaje dia 14 -> NO correlaciona (fuera de ventana de 2)', () => {
  const r = correlacionarN2(oc({ fecha: '2026-08-10' }), [viaje({ id: 1, fecha_carga: '2026-08-14' })], CAT);
  assert.strictEqual(r.correlacion, 'sin_correlacion');
  assert.strictEqual(r.viaje, null);
});

test('3) OC dia 10, viaje dia 9 -> NO correlaciona (ventana hacia adelante, no simetrica)', () => {
  const r = correlacionarN2(oc({ fecha: '2026-08-10' }), [viaje({ id: 1, fecha_carga: '2026-08-09' })], CAT);
  assert.strictEqual(r.correlacion, 'sin_correlacion');
});

test('4) CMR dia 10, viaje dia 10 -> correlaciona (documento contemporaneo)', () => {
  const doc = oc({ tipo_doc: 'cmr', fecha: '2026-08-10' });
  const r = correlacionarN2(doc, [viaje({ id: 1, fecha_carga: '2026-08-10' })], CAT);
  assert.strictEqual(r.correlacion, 'N2');
});

test('5) dos viajes misma ruta/material/fecha, pesos distintos -> desempata por peso', () => {
  const doc = oc({ tipo_doc: 'cmr', fecha: '2026-08-10', kg_neto: 24000, origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS', material: 'metanol' });
  const viajes = [
    viaje({ id: 1, origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS', material: 'metanol', fecha_carga: '2026-08-10', cantidad_kg: 24000 }),
    viaje({ id: 2, origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS', material: 'metanol', fecha_carga: '2026-08-10', cantidad_kg: 20000 }),
  ];
  const r = correlacionarN2(doc, viajes, CAT);
  assert.strictEqual(r.correlacion, 'N2');
  assert.strictEqual(r.viaje.id, 1, 'el de peso 24000');
});

test('6) dos viajes identicos en todo -> REVISAR con ambos candidatos listados', () => {
  const doc = oc({ tipo_doc: 'cmr', fecha: '2026-08-10', kg_neto: 24000, origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS', material: 'metanol' });
  const viajes = [
    viaje({ id: 1, origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS', material: 'metanol', fecha_carga: '2026-08-10', cantidad_kg: 24000, referencia: 'A1' }),
    viaje({ id: 2, origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS', material: 'metanol', fecha_carga: '2026-08-10', cantidad_kg: 24000, referencia: 'A2' }),
  ];
  const r = correlacionarN2(doc, viajes, CAT);
  assert.strictEqual(r.correlacion, 'sin_correlacion');
  assert.strictEqual(r.revisar, true);
  assert.strictEqual(r.candidatos.length, 2);
  assert.match(r.motivo, /A1.*A2|candidatos/);
});

test('7) Foresa metanol: 3 albaranes misma ruta mismo dia -> 3 correlaciones, no 1 (§7 intacto)', () => {
  // Pesos separables (>2% entre si): sin referencia, el peso es lo unico que
  // distingue una rotacion de otra. El punto del test es que las 3 correlacionan
  // a SU rotacion, no que las 3 colapsen a un solo viaje (§7 intacto).
  const viajes = [
    viaje({ id: 1, cliente: 'FORESA', origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS', material: 'metanol', fecha_carga: '2026-08-10', cantidad_kg: 20000 }),
    viaje({ id: 2, cliente: 'FORESA', origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS', material: 'metanol', fecha_carga: '2026-08-10', cantidad_kg: 24000 }),
    viaje({ id: 3, cliente: 'FORESA', origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS', material: 'metanol', fecha_carga: '2026-08-10', cantidad_kg: 28000 }),
  ];
  const kgs = [20000, 24000, 28000];
  const asignados = kgs.map(function (kg) {
    const doc = oc({ tipo_doc: 'albaran', cliente: 'FORESA', origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS', material: 'metanol', fecha: '2026-08-10', kg_neto: kg });
    return correlacionarN2(doc, viajes, CAT);
  });
  assert.ok(asignados.every(function (r) { return r.correlacion === 'N2'; }), 'las 3 correlacionan');
  assert.deepStrictEqual(asignados.map(function (r) { return r.viaje.id; }), [1, 2, 3], 'cada albaran a su rotacion, no todas a una');
});

test('8) documento sin origen legible -> no correlaciona por N2, REVISAR', () => {
  const r = correlacionarN2(oc({ tipo_doc: 'cmr', origen: null }), [viaje({ id: 1 })], CAT);
  assert.strictEqual(r.correlacion, 'sin_correlacion');
  assert.strictEqual(r.revisar, true);
});

test('9) referencia presente -> resuelve por N1 sin llegar a N2', () => {
  const doc = oc({ referencia: '706013', origen: 'PUNTO RARO', destino: 'OTRO RARO' }); // origen no resoluble a proposito
  const r = correlacionarN2(doc, [viaje({ id: 9, referencia: '706013' })], CAT);
  assert.strictEqual(r.correlacion, 'N1', 'N1 corta antes de N2 (que fallaria por origen)');
  assert.strictEqual(r.viaje.id, 9);
});
