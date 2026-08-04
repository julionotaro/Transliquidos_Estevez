// Tests — carga de tarifas desde Tarifas_general.xls (encargo 2026-08-04, tarea B).
//
// Los casos de conflicto/duplicado usan los valores REALES encontrados en el
// Excel (readback contra el archivo que subio Julio, 2026-08-04), no datos
// inventados.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { mapearFilaExcel, claveTarifa, deduplicarTarifasExcel, procesarTarifasExcel } = require('../carga-tarifas.js');

function filaExcel(campos) {
  return Object.assign({
    Cliente: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.', Origen: 'CALDAS DE REIS', Destino: 'TERUEL',
    Carga: 'Cualquiera', Precio: 56.0, 'U.M.': 'TONELADAS', 'Fec.Ult.Apli.': '2026-01-01', Desde: ''
  }, campos);
}

// ============================================================================
// Mapeo U.M. -> columna (el punto critico del encargo)
// ============================================================================
test('carga-tarifas: U.M. TONELADAS -> tarifa_tn, precio_fijo vacio', () => {
  const r = mapearFilaExcel(filaExcel({ Precio: 30.21, 'U.M.': 'TONELADAS' }));
  assert.strictEqual(r.fila.tarifa_tn, '30.21');
  assert.strictEqual(r.fila.precio_fijo, '');
  assert.strictEqual(r.aviso, null);
});

test('carga-tarifas: U.M. "Cualquiera" (flete alto, real: RUBI->VIGO 1300) -> precio_fijo, tarifa_tn vacio', () => {
  const r = mapearFilaExcel(filaExcel({ Origen: 'RUBI', Destino: 'VIGO', Precio: 1300, 'U.M.': 'Cualquiera' }));
  assert.strictEqual(r.fila.precio_fijo, '1300');
  assert.strictEqual(r.fila.tarifa_tn, '');
  assert.strictEqual(r.aviso, null, '"Cualquiera" es un caso limpio, no genera aviso');
});

test('carga-tarifas: U.M. UNIDADES -> precio_fijo', () => {
  const r = mapearFilaExcel(filaExcel({ Precio: 1935, 'U.M.': 'UNIDADES' }));
  assert.strictEqual(r.fila.precio_fijo, '1935');
  assert.strictEqual(r.fila.tarifa_tn, '');
});

test('carga-tarifas: U.M. KILOMETROS -> precio_fijo PERO con aviso (no es flete cerrado)', () => {
  const r = mapearFilaExcel(filaExcel({ Precio: 1.52, 'U.M.': 'KILOMETROS' }));
  assert.strictEqual(r.fila.precio_fijo, '1.52');
  assert.match(r.aviso, /KILOMETROS/);
  assert.match(r.aviso, /no es un flete cerrado/i);
});

test('carga-tarifas: U.M. LITROS -> precio_fijo PERO con aviso', () => {
  const r = mapearFilaExcel(filaExcel({ Precio: 0.5, 'U.M.': 'LITROS' }));
  assert.strictEqual(r.fila.precio_fijo, '0.5');
  assert.match(r.aviso, /LITROS/);
});

test('carga-tarifas: U.M. desconocida -> fila excluida, no se inventa a que columna va', () => {
  const r = mapearFilaExcel(filaExcel({ Precio: 99, 'U.M.': 'BULTOS' }));
  assert.strictEqual(r.fila, null);
  assert.match(r.aviso, /desconocida "BULTOS"/);
  assert.match(r.aviso, /EXCLUIDA/);
});

// ============================================================================
// vigente_desde: Fec.Ult.Apli. primero, Desde como fallback
// ============================================================================
test('carga-tarifas: vigente_desde usa Fec.Ult.Apli. cuando esta presente', () => {
  const r = mapearFilaExcel(filaExcel({ 'Fec.Ult.Apli.': '2026-04-27', Desde: '2026-03-11' }));
  assert.strictEqual(r.fila.vigente_desde, '2026-04-27');
});

test('carga-tarifas: vigente_desde cae a Desde cuando Fec.Ult.Apli. esta vacio', () => {
  const r = mapearFilaExcel(filaExcel({ 'Fec.Ult.Apli.': '', Desde: '2026-04-16' }));
  assert.strictEqual(r.fila.vigente_desde, '2026-04-16');
});

test('carga-tarifas: vigente_desde vacio si ambas fechas faltan (null legitimo, no bug de mapeo)', () => {
  const r = mapearFilaExcel(filaExcel({ 'Fec.Ult.Apli.': '', Desde: '' }));
  assert.strictEqual(r.fila.vigente_desde, '');
});

// ============================================================================
// Dedup — casos reales del Excel (readback 2026-08-04)
// ============================================================================
test('carga-tarifas: FORESA Barcelona->Caldas de Reis (3 filas, mismo precio) colapsa a 1, sin conflicto, gana la mas reciente', () => {
  // Caso real: 72.36 EUR/t, tres versiones con distinto vigente_desde.
  const filas = [
    { cliente: 'FORESA', origen: 'BARCELONA', destino: 'CALDAS DE REIS', material: 'Cualquiera', tarifa_tn: '72.36', precio_fijo: '', vigente_desde: '2026-03-11' },
    { cliente: 'FORESA', origen: 'BARCELONA', destino: 'CALDAS DE REIS', material: 'Cualquiera', tarifa_tn: '72.36', precio_fijo: '', vigente_desde: '2026-04-16' },
    { cliente: 'FORESA', origen: 'BARCELONA', destino: 'CALDAS DE REIS', material: 'Cualquiera', tarifa_tn: '72.36', precio_fijo: '', vigente_desde: '2026-04-16' },
  ];
  const { filas: out, conflictos } = deduplicarTarifasExcel(filas);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(conflictos.length, 0, 'mismo precio en las 3 -> no es un conflicto que reportar');
  assert.strictEqual(out[0].vigente_desde, '2026-04-16');
});

test('carga-tarifas: FORESA Tarragona->Caldas de Reis "Cualquiera" y "DIETILENGLICOL" son claves DISTINTAS (no se funden)', () => {
  // Real: dos filas "Cualquiera" (misma clave, dedup a 1) + una fila con material
  // DIETILENGLICOL (clave distinta, queda aparte).
  const filas = [
    { cliente: 'FORESA', origen: 'TARRAGONA', destino: 'CALDAS DE REIS', material: 'Cualquiera', tarifa_tn: '72.36', precio_fijo: '', vigente_desde: '2026-04-09' },
    { cliente: 'FORESA', origen: 'TARRAGONA', destino: 'CALDAS DE REIS', material: 'Cualquiera', tarifa_tn: '72.36', precio_fijo: '', vigente_desde: '2026-04-16' },
    { cliente: 'FORESA', origen: 'TARRAGONA', destino: 'CALDAS DE REIS', material: 'DIETILENGLICOL', tarifa_tn: '72.36', precio_fijo: '', vigente_desde: '2026-08-03' },
  ];
  const { filas: out, conflictos } = deduplicarTarifasExcel(filas);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(conflictos.length, 0);
});

test('carga-tarifas: CONFLICTO real — DROGAS VIGO Santander->Porriño, 43.48 vs 38.0 — se reporta y gana la mas reciente', () => {
  const filas = [
    { cliente: 'DROGAS VIGO, S.L.', origen: 'SANTANDER', destino: 'PORRIÑO', material: 'Cualquiera', tarifa_tn: '43.48', precio_fijo: '', vigente_desde: '2024-12-16' },
    { cliente: 'DROGAS VIGO, S.L.', origen: 'SANTANDER', destino: 'PORRIÑO', material: 'Cualquiera', tarifa_tn: '38', precio_fijo: '', vigente_desde: '2023-01-16' },
  ];
  const { filas: out, conflictos } = deduplicarTarifasExcel(filas);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(conflictos.length, 1);
  assert.strictEqual(out[0].tarifa_tn, '43.48', 'gana la fila con vigente_desde mas reciente (2024-12-16 > 2023-01-16)');
  assert.strictEqual(conflictos[0].filas.length, 2);
});

test('carga-tarifas: CONFLICTO real — HELM Bilbao->Monzon, ambas fechas vacias en una fila (vacio = la mas vieja)', () => {
  const filas = [
    { cliente: 'HELM IBERICA, S.A.', origen: 'BILBAO', destino: 'MONZON (HUESCA)', material: 'SOSA', tarifa_tn: '', precio_fijo: '708.1', vigente_desde: '' },
    { cliente: 'HELM IBERICA, S.A.', origen: 'BILBAO', destino: 'MONZON (HUESCA)', material: 'SOSA', tarifa_tn: '', precio_fijo: '764.75', vigente_desde: '2026-01-01' },
  ];
  const { filas: out, conflictos } = deduplicarTarifasExcel(filas);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(conflictos.length, 1);
  assert.strictEqual(out[0].precio_fijo, '764.75', 'la fila con fecha vacia no puede ganarle a una con vigente_desde real');
});

test('carga-tarifas: claveTarifa es (cliente, origen, destino, material) -- no incluye precio ni fecha', () => {
  const a = { cliente: 'X', origen: 'Y', destino: 'Z', material: 'W' };
  const b = { cliente: 'X', origen: 'Y', destino: 'Z', material: 'W', tarifa_tn: '999', vigente_desde: '2020-01-01' };
  assert.strictEqual(claveTarifa(a), claveTarifa(b));
});

// ============================================================================
// Pipeline completo
// ============================================================================
test('carga-tarifas: procesarTarifasExcel — pipeline completo sobre un lote mixto', () => {
  const crudas = [
    filaExcel({ Cliente: 'A', Origen: 'X', Destino: 'Y', Carga: 'Z', Precio: 50, 'U.M.': 'TONELADAS', 'Fec.Ult.Apli.': '2026-01-01' }),
    filaExcel({ Cliente: 'A', Origen: 'X', Destino: 'Y', Carga: 'Z', Precio: 55, 'U.M.': 'TONELADAS', 'Fec.Ult.Apli.': '2026-06-01' }), // conflicto real, gana esta
    filaExcel({ Cliente: 'B', Origen: 'X2', Destino: 'Y2', Carga: 'Z2', Precio: 200, 'U.M.': 'Cualquiera' }),
    filaExcel({ Cliente: 'C', Origen: 'X3', Destino: 'Y3', Carga: 'Z3', Precio: 1.2, 'U.M.': 'KILOMETROS' }),
    filaExcel({ Cliente: 'D', Origen: 'X4', Destino: 'Y4', Carga: 'Z4', Precio: 10, 'U.M.': 'RARO' }),
  ];
  const out = procesarTarifasExcel(crudas);
  assert.strictEqual(out.filas.length, 3, '5 crudas - 1 excluida (RARO) = 4 mapeadas; el conflicto A (2 filas) funde a 1 -> 3 filas finales (A,B,C)');
  assert.strictEqual(out.excluidas, 1);
  assert.strictEqual(out.conflictos.length, 1);
  assert.strictEqual(out.avisos.length, 2, 'un aviso de KILOMETROS + un aviso de U.M. desconocida');
  const filaA = out.filas.find(f => f.cliente === 'A');
  assert.strictEqual(filaA.tarifa_tn, '55', 'el conflicto A se resuelve con la vigencia mas reciente');
});
