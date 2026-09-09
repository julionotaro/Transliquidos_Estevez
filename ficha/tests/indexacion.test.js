// Tests v1.1 pieza 2 — indexacion (planilla carga/auditoria).
//
// Fixtures de pct/desde/hasta tomadas 1:1 del readback real contra la tabla
// Indexacion (or1otD9WsjJ3V8Cr) DESPUES de deduplicar (37.660 filas en bruto,
// 70 tramos reales x538 duplicados -- ver nota en indexacion.js).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { deduplicarIndexacion, grupoIndexacion, buscarPct, indexacionDeFila } = require('../indexacion.js');

function filaIdx(campos) {
  return Object.assign({ cliente: 'FORESA-BRESFOR', tipo: 'gasoleo', pct: '0.10', desde: '', hasta: '', id: 0 }, campos);
}

// Tramos reales FORESA-BRESFOR (subconjunto).
const TRAMOS_FORESA_BRESFOR = [
  filaIdx({ desde: '2026-06-01', hasta: '2026-06-07', pct: '0.1452', id: 7 }),
  filaIdx({ desde: '2026-06-07', hasta: '2026-06-15', pct: '0.1452', id: 8 }),
  filaIdx({ desde: '2026-06-15', hasta: '2026-06-21', pct: '0.1279', id: 9 }),
  filaIdx({ desde: '2026-07-01', hasta: '2026-07-15', pct: '0.1064', id: 12 }),
  filaIdx({ desde: '2026-07-16', hasta: '2026-07-31', pct: '0.0665', id: 69 }),
];

// Tramo real HELM open-ended (vigente hasta 2099-12-31).
const TRAMOS_HELM = [
  filaIdx({ cliente: 'HELM', desde: '2026-07-20', hasta: '2099-12-31', pct: '0.039', id: 26 }),
];

test('indexacion: deduplicarIndexacion colapsa la duplicacion x538 real de la tabla', () => {
  const original = [];
  for (let i = 0; i < 538; i++) { original.push(filaIdx({ desde: '2026-07-01', hasta: '2026-07-15', pct: '0.1064', id: 12 })); }
  original.push(filaIdx({ desde: '2026-07-16', hasta: '2026-07-31', pct: '0.0665', id: 69 })); // sin duplicar en este fixture
  const out = deduplicarIndexacion(original);
  assert.strictEqual(out.length, 2);
});

test('indexacion: deduplicarIndexacion es idempotente sobre datos ya limpios', () => {
  const out = deduplicarIndexacion(TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(out.length, TRAMOS_FORESA_BRESFOR.length);
});

test('indexacion: grupoIndexacion — FORESA/BRESFOR->FORESA-BRESFOR, QUIMIDROGA/HELM propios, RNM y QUIMICAS DEL JARAMA->OTROS (confirmado, sin solapa propia)', () => {
  assert.strictEqual(grupoIndexacion('FORESA').grupo, 'FORESA-BRESFOR');
  assert.strictEqual(grupoIndexacion('BRESFOR').grupo, 'FORESA-BRESFOR');
  assert.strictEqual(grupoIndexacion('QUIMIDROGA').grupo, 'QUIMIDROGA');
  assert.strictEqual(grupoIndexacion('HELM').grupo, 'HELM');
  assert.strictEqual(grupoIndexacion('RNM').grupo, 'OTROS');
  assert.strictEqual(grupoIndexacion('RNM').motivo, null, 'RNM->OTROS es regla confirmada, no un default silencioso');
  assert.strictEqual(grupoIndexacion('QUIMICAS DEL JARAMA').grupo, 'OTROS');
});

test('indexacion: grupoIndexacion — cliente sin regla explicita cae en OTROS con aviso (D-5)', () => {
  const g = grupoIndexacion('TRANSTAMBRE');
  assert.strictEqual(g.grupo, 'OTROS');
  assert.match(g.motivo, /grupo_por_defecto/);
});

test('indexacion: buscarPct encuentra el tramo vigente por fecha', () => {
  const hit = buscarPct('FORESA-BRESFOR', '2026-07-07', TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(hit.pct, 0.1064);
  assert.strictEqual(hit.fila.id, 12);
});

test('indexacion: buscarPct no inventa un tramo cuando la fecha cae en un hueco real', () => {
  // Hueco real entre 2026-06-21 (fin id 9) y 2026-07-01 (inicio id 12).
  const hit = buscarPct('FORESA-BRESFOR', '2026-06-25', TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(hit, null);
});

test('indexacion: buscarPct respeta el tramo abierto (HELM hasta 2099-12-31)', () => {
  const hit = buscarPct('HELM', '2026-09-01', TRAMOS_HELM);
  assert.strictEqual(hit.pct, 0.039);
});

// ============================================================================
// Los cuatro regimenes — D-03: SOLO 'linea' calcula un importe. El resto marca.
// ============================================================================
test('indexacion: regimen linea CALCULA pct e importe sobre el importe de la linea (D-08)', () => {
  const viaje = { cliente: 'FORESA', fecha: '2026-07-07', regimen_indexacion: 'linea' };
  const r = indexacionDeFila(viaje, 1000, TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(r.modo, 'calculada');
  assert.strictEqual(r.pct, 0.1064);
  assert.strictEqual(r.importe, 106.4);
});

test('indexacion: regimen agregada_quincenal marca el regimen, NUNCA calcula un importe (D-03)', () => {
  const viaje = { cliente: 'FORESA', fecha: '2026-07-13', regimen_indexacion: 'agregada_quincenal' };
  const r = indexacionDeFila(viaje, 1500, TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(r.modo, 'regimen_pendiente');
  assert.strictEqual(r.importe, null, 'nunca inventa un importe para agregada, aunque haya base para calcularlo');
  assert.match(r.etiqueta, /agregada_quincenal/);
});

test('indexacion: regimen agregada_mensual marca el regimen, NUNCA calcula un importe (D-03)', () => {
  const viaje = { cliente: 'FORESA', fecha: '2026-06-10', regimen_indexacion: 'agregada_mensual' };
  const r = indexacionDeFila(viaje, 2000, TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(r.modo, 'regimen_pendiente');
  assert.strictEqual(r.importe, null);
  assert.match(r.etiqueta, /agregada_mensual/);
});

test('indexacion: regimen incluida (Baltransa) — 0, sin buscar tramo', () => {
  const viaje = { cliente: 'BALTRANSA', fecha: '2026-07-01', regimen_indexacion: 'incluida' };
  const r = indexacionDeFila(viaje, 500, []);
  assert.strictEqual(r.modo, 'incluida');
  assert.strictEqual(r.importe, 0);
  assert.strictEqual(r.pct, 0);
});

test('indexacion: sin regimen (cliente no reconocido) no calcula ni marca un regimen falso', () => {
  const viaje = { cliente: 'FORBA', fecha: '2026-07-01', regimen_indexacion: null };
  const r = indexacionDeFila(viaje, 500, TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(r.modo, 'sin_regimen');
  assert.strictEqual(r.importe, null);
});

test('indexacion: linea sin tramo vigente para la fecha -> sin_regimen, no inventa pct', () => {
  const viaje = { cliente: 'FORESA', fecha: '2026-06-25', regimen_indexacion: 'linea' };
  const r = indexacionDeFila(viaje, 1000, TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(r.modo, 'sin_regimen');
  assert.strictEqual(r.importe, null);
  assert.match(r.motivo, /sin_tramo_vigente/);
});

test('indexacion: linea sin importe de base (kg_documento null) -> pct visible, importe null (no 0 falso)', () => {
  const viaje = { cliente: 'FORESA', fecha: '2026-07-07', regimen_indexacion: 'linea' };
  const r = indexacionDeFila(viaje, null, TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(r.modo, 'calculada');
  assert.strictEqual(r.pct, 0.1064);
  assert.strictEqual(r.importe, null);
});
