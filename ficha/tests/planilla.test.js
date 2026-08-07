// Tests v1.1 pieza 2 — armado de filas de la planilla (copilot de carga +
// auditoria, misma tabla). El render HTML se testea aparte (planilla-html.test.js).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { COLUMNAS, armarFila, armarFilas, valoresEnOrden, calcularImporte, tipoIva } = require('../planilla.js');

function viajeBase(campos) {
  return Object.assign({
    id: 1, empresa: 'TLE', orden: 1, cliente: 'FORESA', origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL',
    material: 'Tobera Res 0541', referencia: '2002854', tractora: '2498KZL', semi: 'R1007BCV',
    conductor: 'Asensi', kg_documento: 23140, fecha: '2026-07-07',
    estado: 'con_documentacion', estado_lectura: 'OK', motivo_revision: '',
    regimen_indexacion: 'linea', pais_facturacion: 'ES'
  }, campos);
}

// `cliente` = razon social exacta de la tabla real (post-recarga Excel
// 2026-08-04); el viaje trae el codigo corto "FORESA", que buscarTarifa resuelve
// via ficha/clientes.js. El origen "BRESFOR (AVEIRO)" ejercita el fallback por
// fragmento (la ficha lo lee distinto).
const CLI_FORESA = 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.';
const TARIFAS = [
  { cliente: CLI_FORESA, origen: 'CALDAS/VILLAGARCIA', destino: 'TERUEL', material: '', tarifa_tn: '54.9', precio_fijo: '', vigente_desde: '2025-01-01', id: 37 },
  { cliente: CLI_FORESA, origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL', material: '', tarifa_tn: '56.0', precio_fijo: '', vigente_desde: '2026-01-01', id: 274 },
];

const INDEXACION = [
  { cliente: '', tipo: 'FORESA-BRESFOR', pct: '0.1064', desde: '2026-07-01', hasta: '2026-07-15', id: 12 },
];

// ============================================================================
// Orden de columnas == sistema de escritorio (encargo, tabla exacta)
// ============================================================================
test('planilla: orden de columnas == orden del sistema de escritorio (encargo 2026-08-03)', () => {
  const ordenEsperado = [
    'Empresa', 'Nº', 'Cliente', 'Origen', 'Destino', 'Carga', 'Referencia',
    'Cabeza', 'Remolque', 'Chofer', 'Cantidad (kg)', 'Tarifa', 'Precio / Importe',
    '% Indexación', 'Importe indexación', 'Tipo IVA'
  ];
  assert.deepStrictEqual(COLUMNAS.map(c => c.titulo), ordenEsperado);
});

test('planilla: valoresEnOrden respeta el mismo orden que COLUMNAS (headers y celdas no pueden desincronizarse)', () => {
  const fila = armarFila(viajeBase(), TARIFAS, INDEXACION);
  const valores = valoresEnOrden(fila);
  assert.strictEqual(valores.length, COLUMNAS.length);
  assert.strictEqual(valores[0], fila.empresa);
  assert.strictEqual(valores[COLUMNAS.length - 1], fila.tipo_iva);
});

// ============================================================================
// Un viaje normal FORESA — todas las columnas pobladas, importe = cantidad x tarifa
// ============================================================================
test('planilla: viaje normal FORESA — todas las columnas pobladas, importe = cantidad x tarifa (D-02)', () => {
  const fila = armarFila(viajeBase(), TARIFAS, INDEXACION);
  assert.strictEqual(fila.empresa, 'TLE');
  assert.strictEqual(fila.numero, 1);
  assert.strictEqual(fila.cliente, 'FORESA');
  assert.strictEqual(fila.origen, 'BRESFOR (AVEIRO)');
  assert.strictEqual(fila.destino, 'TERUEL');
  assert.strictEqual(fila.material, 'Tobera Res 0541');
  assert.strictEqual(fila.referencia, '2002854');
  assert.strictEqual(fila.cabeza, '2498KZL');
  assert.strictEqual(fila.remolque, 'R1007BCV');
  assert.strictEqual(fila.chofer, 'Asensi');
  assert.strictEqual(fila.cantidad_kg, 23140);
  assert.strictEqual(fila.tarifa, '56 €/t');
  // 23140 kg = 23.14 t x 56.0 EUR/t = 1295.84
  assert.strictEqual(fila.importe, 1295.84);
  assert.strictEqual(calcularImporte(23140, { tarifa: { tipo: 'tn', valor: 56.0 } }), 1295.84);
  assert.strictEqual(fila.pct_indexacion, '10.64%');
  assert.strictEqual(fila.importe_indexacion, round2(1295.84 * 0.1064));
  assert.strictEqual(fila.tipo_iva, '21%');
  assert.strictEqual(fila.resaltar, false);
  function round2(n) { return Math.round(n * 100) / 100; }
});

// ============================================================================
// Multi-viaje (expediente con Nº 01/02/03) — tres filas
// ============================================================================
test('planilla: multi-viaje (expediente Nº 01/02/03) -> tres filas, cada una con su referencia/kg/importe', () => {
  const viajes = [
    viajeBase({ id: 10, orden: 1, referencia: '2002854', kg_documento: 24000 }),
    viajeBase({ id: 11, orden: 2, referencia: '2002844', kg_documento: 24500 }),
    viajeBase({ id: 12, orden: 3, referencia: '2002866', kg_documento: 23800 }),
  ];
  const filas = armarFilas(viajes, TARIFAS, INDEXACION);
  assert.strictEqual(filas.length, 3);
  assert.deepStrictEqual(filas.map(f => f.numero), [1, 2, 3]);
  assert.deepStrictEqual(filas.map(f => f.referencia), ['2002854', '2002844', '2002866']);
  assert.notStrictEqual(filas[0].importe, filas[1].importe, 'cada viaje tiene su propio importe segun su kg');
  assert.notStrictEqual(filas[1].importe, filas[2].importe);
});

// ============================================================================
// Regimen agregado — columna indexacion muestra el regimen, NO un numero (D-03)
// ============================================================================
test('planilla: viaje con regimen agregado_quincenal -> columna indexacion muestra el regimen, no un numero', () => {
  const fila = armarFila(viajeBase({ regimen_indexacion: 'agregada_quincenal', origen: 'CALDAS', destino: 'ORENSE' }), TARIFAS, INDEXACION);
  assert.match(fila.pct_indexacion, /agregada_quincenal/);
  assert.strictEqual(fila.importe_indexacion, null, 'nunca inventa un importe agregado (D-03)');
});

// ============================================================================
// Resaltado (auditoria) — REVISAR / PENDIENTE_DOCUMENTACION / SIN_TARIFA
// ============================================================================
test('planilla: viaje con estado_lectura REVISAR -> resaltar true', () => {
  const fila = armarFila(viajeBase({ estado_lectura: 'REVISAR', motivo_revision: 'cliente_no_reconocido: FORBA' }), TARIFAS, INDEXACION);
  assert.strictEqual(fila.resaltar, true);
  assert.ok(fila.motivos_resaltado.some(m => m.indexOf('REVISAR') === 0));
});

test('planilla: viaje PENDIENTE_DOCUMENTACION -> resaltar true', () => {
  const fila = armarFila(viajeBase({ estado: 'PENDIENTE_DOCUMENTACION' }), TARIFAS, INDEXACION);
  assert.strictEqual(fila.resaltar, true);
  assert.ok(fila.motivos_resaltado.indexOf('PENDIENTE_DOCUMENTACION') >= 0);
});

test('planilla: viaje SIN_TARIFA (ruta no cubierta por el tarifario) -> resaltar true', () => {
  const fila = armarFila(viajeBase({ origen: 'CALDAS', destino: 'ORENSE' }), TARIFAS, INDEXACION);
  assert.strictEqual(fila.tarifa_estado, 'SIN_TARIFA');
  assert.strictEqual(fila.resaltar, true);
  assert.strictEqual(fila.importe, null, 'sin tarifa no hay importe que calcular');
});

test('planilla §4.4: viaje linea con fecha de indexacion NO cubierta -> resaltar true (INDEXACION REVISAR)', () => {
  // fecha 2026-05-16 no cae en el unico tramo del fixture (07-01..07-15); la
  // tarifa TERUEL sigue resolviendo, asi que el resaltado viene SOLO de la
  // indexacion sin tramo.
  const fila = armarFila(viajeBase({ fecha: '2026-05-16' }), TARIFAS, INDEXACION);
  assert.strictEqual(fila.resaltar, true);
  assert.ok(fila.motivos_resaltado.some(m => m.indexOf('INDEXACION REVISAR') === 0),
    'la indexacion sin tramo marca la fila REVISAR, no queda muda');
  assert.strictEqual(fila.pct_indexacion, 'REVISAR');
});

test('planilla: viaje normal, sin ningun motivo -> resaltar false', () => {
  const fila = armarFila(viajeBase(), TARIFAS, INDEXACION);
  assert.strictEqual(fila.resaltar, false);
  assert.deepStrictEqual(fila.motivos_resaltado, []);
});

// ============================================================================
// Tipo IVA
// ============================================================================
test('planilla: tipoIva — ES 21%, BALTRANSA siempre 21% aunque destino extranjero, otro pais 0%', () => {
  assert.strictEqual(tipoIva({ cliente: 'FORESA', pais_facturacion: 'ES' }), '21%');
  assert.strictEqual(tipoIva({ cliente: 'BALTRANSA', pais_facturacion: 'PT' }), '21%');
  assert.strictEqual(tipoIva({ cliente: 'RNM', pais_facturacion: 'PT' }), '0% (PT)');
});

// ============================================================================
// kg_documento null (sin documento cruzado) — cantidad legitimamente vacia,
// no un cero ni un bug de mapeo (D-01, distincion pedida en el encargo).
// ============================================================================
test('planilla: sin documento cruzado (kg_documento null) -> cantidad e importe null, no cero', () => {
  const fila = armarFila(viajeBase({ kg_documento: null, estado: 'PENDIENTE_DOCUMENTACION' }), TARIFAS, INDEXACION);
  assert.strictEqual(fila.cantidad_kg, null);
  assert.strictEqual(fila.importe, null);
  assert.notStrictEqual(fila.tarifa, null, 'la tarifa SI se puede resolver aunque falte el documento (no depende de kg)');
});
