// Tests v1.1 pieza 2 — indexacion (planilla carga/auditoria).
//
// Fixtures de pct/desde/hasta tomadas del readback real contra la tabla
// Indexacion (or1otD9WsjJ3V8Cr). Tras la recarga 2026-08-06 la CATEGORIA vive en
// `tipo` (FORESA-BRESFOR/HELM/QUIMIDROGA/OTROS) y `cliente` queda vacio; el match
// de buscarPct es por `tipo` -- ver nota en indexacion.js.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { deduplicarIndexacion, grupoIndexacion, buscarPct, indexacionDeFila } = require('../indexacion.js');

// Esquema post-recarga: categoria en `tipo`, `cliente` vacio.
function filaIdx(campos) {
  return Object.assign({ cliente: '', tipo: 'FORESA-BRESFOR', pct: '0.10', desde: '', hasta: '', id: 0 }, campos);
}

// Tramos reales FORESA-BRESFOR: las 14 filas EXACTAS del Excel/tabla recargada
// (2026-08-06). Se usan completas a proposito para que aparezcan las
// caracteristicas reales de borde (§4.4): el hueco 2026-05-15->05-18 (05-16/17
// sin cubrir) y los dias de corte con % distinto (05-01: 0.1838 vs 0.1717;
// 06-15: 0.1452 vs 0.1279). Los cortes con MISMO % (06-07: 0.1452/0.1452) NO
// son ambiguos.
const TRAMOS_FORESA_BRESFOR = [
  filaIdx({ desde: '2026-04-20', hasta: '2026-04-26', pct: '0.1838', id: 1 }),
  filaIdx({ desde: '2026-04-27', hasta: '2026-05-01', pct: '0.1838', id: 2 }),
  filaIdx({ desde: '2026-05-01', hasta: '2026-05-10', pct: '0.1717', id: 3 }),
  filaIdx({ desde: '2026-05-11', hasta: '2026-05-15', pct: '0.1717', id: 4 }),
  filaIdx({ desde: '2026-05-18', hasta: '2026-05-24', pct: '0.1584', id: 5 }),
  filaIdx({ desde: '2026-05-25', hasta: '2026-05-31', pct: '0.1584', id: 6 }),
  filaIdx({ desde: '2026-06-01', hasta: '2026-06-07', pct: '0.1452', id: 7 }),
  filaIdx({ desde: '2026-06-07', hasta: '2026-06-15', pct: '0.1452', id: 8 }),
  filaIdx({ desde: '2026-06-15', hasta: '2026-06-21', pct: '0.1279', id: 9 }),
  filaIdx({ desde: '2026-06-22', hasta: '2026-06-28', pct: '0.1279', id: 10 }),
  filaIdx({ desde: '2026-06-29', hasta: '2026-06-30', pct: '0.1279', id: 11 }),
  filaIdx({ desde: '2026-07-01', hasta: '2026-07-15', pct: '0.1064', id: 12 }),
  filaIdx({ desde: '2026-07-16', hasta: '2026-07-31', pct: '0.0665', id: 13 }),
  filaIdx({ desde: '2026-08-01', hasta: '2026-08-15', pct: '0.0918', id: 14 }),
];

// Tramo real HELM open-ended (vigente hasta 2099-12-31).
const TRAMOS_HELM = [
  filaIdx({ tipo: 'HELM', desde: '2026-07-20', hasta: '2099-12-31', pct: '0.039', id: 26 }),
];

test('indexacion: deduplicarIndexacion colapsa duplicados exactos (defensa contra cross-join)', () => {
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
  assert.strictEqual(hit.estado, 'ok');
  assert.strictEqual(hit.pct, 0.1064);
  assert.strictEqual(hit.fila.id, 12);
});

test('indexacion: buscarPct — fecha en un hueco real del Excel (2026-05-16, entre 05-15 y 05-18) -> sin_tramo', () => {
  const hit = buscarPct('FORESA-BRESFOR', '2026-05-16', TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(hit.estado, 'sin_tramo');
  assert.strictEqual(hit.pct, null);
});

test('indexacion: buscarPct — dia de corte con % DISTINTO (2026-05-01: 0.1838 vs 0.1717) -> ambiguo con los candidatos', () => {
  const hit = buscarPct('FORESA-BRESFOR', '2026-05-01', TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(hit.estado, 'ambiguo');
  assert.strictEqual(hit.pct, null);
  assert.deepStrictEqual(hit.candidatos.slice().sort(), [0.1717, 0.1838]);
});

test('indexacion: buscarPct — dia de corte con MISMO % (2026-06-07: 0.1452/0.1452) NO es ambiguo', () => {
  const hit = buscarPct('FORESA-BRESFOR', '2026-06-07', TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(hit.estado, 'ok');
  assert.strictEqual(hit.pct, 0.1452);
});

test('indexacion: buscarPct respeta el tramo abierto (HELM hasta 2099-12-31)', () => {
  const hit = buscarPct('HELM', '2026-09-01', TRAMOS_HELM);
  assert.strictEqual(hit.estado, 'ok');
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

test('indexacion §4.4: linea con fecha NO cubierta (hueco 2026-05-16) -> REVISAR, no null mudo, no 0, no vecino', () => {
  const viaje = { cliente: 'FORESA', fecha: '2026-05-16', regimen_indexacion: 'linea' };
  const r = indexacionDeFila(viaje, 1000, TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(r.modo, 'revisar');
  assert.strictEqual(r.pct, null);
  assert.strictEqual(r.importe, null, 'no aplica 0 ni el tramo vecino');
  assert.match(r.motivo, /indexacion_sin_tramo/);
  assert.match(r.motivo, /2026-05-16/, 'el motivo trae la fecha del viaje');
});

test('indexacion §4.4: linea en dia de corte con % distinto (2026-05-01) -> REVISAR con los pct candidatos y la fecha', () => {
  const viaje = { cliente: 'FORESA', fecha: '2026-05-01', regimen_indexacion: 'linea' };
  const r = indexacionDeFila(viaje, 1000, TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(r.modo, 'revisar');
  assert.strictEqual(r.pct, null);
  assert.strictEqual(r.importe, null, 'no elige un tramo en silencio');
  assert.match(r.motivo, /indexacion_ambigua/);
  assert.match(r.motivo, /2026-05-01/, 'el motivo trae la fecha del viaje');
  assert.match(r.motivo, /18\.38%/, 'el motivo trae los pct candidatos');
  assert.match(r.motivo, /17\.17%/);
});

test('indexacion §4.4: el dia de corte con MISMO % NO va a REVISAR (2026-06-07 -> calculada 14.52%)', () => {
  const viaje = { cliente: 'FORESA', fecha: '2026-06-07', regimen_indexacion: 'linea' };
  const r = indexacionDeFila(viaje, 1000, TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(r.modo, 'calculada');
  assert.strictEqual(r.pct, 0.1452);
});

test('indexacion: linea sin importe de base (kg_documento null) -> pct visible, importe null (no 0 falso)', () => {
  const viaje = { cliente: 'FORESA', fecha: '2026-07-07', regimen_indexacion: 'linea' };
  const r = indexacionDeFila(viaje, null, TRAMOS_FORESA_BRESFOR);
  assert.strictEqual(r.modo, 'calculada');
  assert.strictEqual(r.pct, 0.1064);
  assert.strictEqual(r.importe, null);
});
