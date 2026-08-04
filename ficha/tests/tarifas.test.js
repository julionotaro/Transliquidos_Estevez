// Tests v1.1 pieza 2 — lookup de tarifas (planilla carga/auditoria).
//
// Fixtures tomadas 1:1 del readback real contra la tabla Tarifas
// (Siwhv2AUWTSeFlrJ, 538 filas, ejecucion 622/624 sobre WD v6wjsdY20vzpPEop,
// 2026-08-03) -- no son numeros inventados.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { clienteParaTarifa, matchCampo, buscarTarifa } = require('../tarifas.js');

function filaTarifa(campos) {
  return Object.assign({
    cliente: 'FORESA', origen: '', destino: '', material: '',
    tarifa_tn: '', precio_fijo: '', vigente_desde: '', id: 0
  }, campos);
}

// Subconjunto real: FORESA CALDAS/VILLAGARCIA(+BRESFOR AVEIRO)->TERUEL, dos
// vigencias superpuestas (2025-01-01 y 2026-01-01).
const TARIFAS_FORESA_TERUEL = [
  filaTarifa({ origen: 'CALDAS/VILLAGARCIA', destino: 'TERUEL', tarifa_tn: '54.9', vigente_desde: '2025-01-01', id: 37 }),
  filaTarifa({ origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL', tarifa_tn: '54.9', vigente_desde: '2025-01-01', id: 70 }),
  filaTarifa({ origen: 'CALDAS/VILLAGARCIA', destino: 'TERUEL', tarifa_tn: '56.0', vigente_desde: '2026-01-01', id: 248 }),
  filaTarifa({ origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL', tarifa_tn: '56.0', vigente_desde: '2026-01-01', id: 274 }),
];

// Real: QUIMIDROGA BARCELONA->LEIRIA (PT), id 363.
const TARIFAS_QUIMIDROGA_LEIRIA = [
  filaTarifa({ cliente: 'QUIMIDROGA', origen: 'BARCELONA', destino: 'LEIRIA (PT)', tarifa_tn: '88.25', vigente_desde: '2026-01-15', id: 363 }),
];

// Real: RNM AVEIRO->PORRIÑO, id 166.
const TARIFAS_RNM = [
  filaTarifa({ cliente: 'RNM', origen: 'AVEIRO', destino: 'PORRIÑO', tarifa_tn: '19.0', vigente_desde: '2025-01-01', id: 166 }),
];

test('tarifas: clienteParaTarifa mapea BRESFOR a FORESA (mismo criterio que cruce.regimenIndexacion)', () => {
  assert.strictEqual(clienteParaTarifa('FORESA'), 'FORESA');
  assert.strictEqual(clienteParaTarifa('BRESFOR'), 'FORESA');
  assert.strictEqual(clienteParaTarifa('QUIMIDROGA'), 'QUIMIDROGA');
  assert.strictEqual(clienteParaTarifa('RNM'), 'RNM');
  assert.strictEqual(clienteParaTarifa('HELM'), 'HELM');
  assert.strictEqual(clienteParaTarifa('QUIMICAS DEL JARAMA'), 'QUIMICAS DEL JARAMA');
  assert.strictEqual(clienteParaTarifa('TEPSA'), null, 'cliente fuera del tarifario -> null, no inventa mapeo');
});

test('tarifas: hit DIRECTO en destino, elige la vigencia correcta por fecha del viaje', () => {
  const viaje = { cliente: 'FORESA', origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL', fecha: '2026-07-07' };
  const r = buscarTarifa(viaje, TARIFAS_FORESA_TERUEL);
  assert.strictEqual(r.estado, 'DIRECTO');
  assert.strictEqual(r.tarifa.tipo, 'tn');
  assert.strictEqual(r.tarifa.valor, 56.0, 'fecha 2026-07-07 cae en la vigencia 2026-01-01, no en la 2025-01-01');
  assert.strictEqual(r.fila.id, 274);
});

test('tarifas: fecha anterior a la vigencia nueva usa la version vieja (viaje 2025)', () => {
  const viaje = { cliente: 'FORESA', origen: 'CALDAS/VILLAGARCIA', destino: 'TERUEL', fecha: '2025-06-01' };
  const r = buscarTarifa(viaje, TARIFAS_FORESA_TERUEL);
  assert.strictEqual(r.tarifa.valor, 54.9);
  assert.strictEqual(r.fila.id, 37);
});

test('tarifas: FALLBACK por fragmento — ficha "CALDAS DE REIS" matchea tarifa "CALDAS/VILLAGARCIA" real', () => {
  // Caso real verificado: la ficha lee "CALDAS DE REIS", la tarifa FORESA
  // trae el origen como celda multi-valor "CALDAS/VILLAGARCIA". El texto
  // completo no coincide -- el fragmento "CALDAS" si.
  assert.strictEqual(matchCampo('CALDAS DE REIS', 'CALDAS/VILLAGARCIA'), 'TOKEN');
  const viaje = { cliente: 'FORESA', origen: 'CALDAS DE REIS', destino: 'TERUEL', fecha: '2026-07-07' };
  const r = buscarTarifa(viaje, TARIFAS_FORESA_TERUEL);
  assert.strictEqual(r.estado, 'FALLBACK_PROVINCIA');
  assert.strictEqual(r.tarifa.valor, 56.0);
});

test('tarifas: hit directo real no se degrada a fallback (TERUEL == TERUEL)', () => {
  assert.strictEqual(matchCampo('TERUEL', 'TERUEL'), 'DIRECTO');
});

test('tarifas: QUIMIDROGA Barcelona->Leiria es un HIT real (fallback por fragmento), NO SIN_TARIFA', () => {
  // OJO: este es el ejemplo que se asumio como caso SIN_TARIFA antes del
  // readback. La tabla real SI tiene esta ruta (id 363, 88.25 EUR/t,
  // vigente_desde 2026-01-15) -- la ficha suele leer el destino como "LEIRIA
  // PORTUGAL" en vez de "LEIRIA (PT)", que matchea por fragmento "LEIRIA".
  const viaje = { cliente: 'QUIMIDROGA', origen: 'BARCELONA', destino: 'LEIRIA PORTUGAL', fecha: '2026-07-13' };
  const r = buscarTarifa(viaje, TARIFAS_QUIMIDROGA_LEIRIA);
  assert.notStrictEqual(r.estado, 'SIN_TARIFA');
  assert.strictEqual(r.estado, 'FALLBACK_PROVINCIA');
  assert.strictEqual(r.tarifa.valor, 88.25);
});

test('tarifas: SIN_TARIFA cuando el cliente no esta en el tarifario en absoluto (TEPSA, real -- 0 filas)', () => {
  const viaje = { cliente: 'TEPSA', origen: 'BARCELONA', destino: 'LEIRIA PORTUGAL', fecha: '2026-07-13' };
  const r = buscarTarifa(viaje, TARIFAS_QUIMIDROGA_LEIRIA);
  assert.strictEqual(r.estado, 'SIN_TARIFA');
  assert.match(r.motivo, /cliente_sin_tarifario: TEPSA/);
});

test('tarifas: SIN_TARIFA cuando el cliente tiene tarifario pero no hay fila para esa ruta (FORESA CALDAS->ORENSE, hueco real confirmado)', () => {
  // Confirmado por readback: FORESA no tiene NINGUNA fila con destino
  // ORENSE/OURENSE en la tabla real, pese a ser la ruta agregada-quincenal
  // mas frecuente en los viajes reales. Es un hueco real del tarifario, no
  // un bug de matching -- por eso el fixture aca es deliberadamente el mismo
  // universo FORESA/TERUEL (no un ORENSE inventado).
  const viaje = { cliente: 'FORESA', origen: 'CALDAS', destino: 'ORENSE', fecha: '2026-07-13' };
  const r = buscarTarifa(viaje, TARIFAS_FORESA_TERUEL);
  assert.strictEqual(r.estado, 'SIN_TARIFA');
  assert.match(r.motivo, /sin_tarifa: FORESA CALDAS -> ORENSE/);
});

test('tarifas: RNM Aveiro->Porriño hit directo', () => {
  const viaje = { cliente: 'RNM', origen: 'AVEIRO', destino: 'PORRIÑO', fecha: '2026-07-16' };
  const r = buscarTarifa(viaje, TARIFAS_RNM);
  assert.strictEqual(r.estado, 'DIRECTO');
  assert.strictEqual(r.tarifa.valor, 19.0);
});

test('tarifas: OCR "AVEPTO" (misread real de AVEIRO) no matchea la fila AVEIRO -- SIN_TARIFA visible, no se disfraza', () => {
  // Ficha real (viaje id 3, hoja 29): la lectura de gpt-4o dio "AVEPTO" en vez
  // de "AVEIRO". Sin alias de misread (mismo criterio que CLIENTES_CONOCIDOS
  // en cruce.js): esto debe fallar visible, no matchear por casualidad.
  const viaje = { cliente: 'RNM', origen: 'AVEPTO', destino: 'PORRIÑO', fecha: '2026-07-16' };
  const r = buscarTarifa(viaje, TARIFAS_RNM);
  assert.strictEqual(r.estado, 'SIN_TARIFA');
});

test('tarifas: BUG real encontrado en la corrida en vivo del 2026-08-03 -- "AVEPTO" NO debe matchear "AZAMBUJA(PT)" via el fragmento suelto "PT"', () => {
  // La primera corrida en vivo asigno a un viaje RNM con origen "AVEPTO" (OCR
  // de AVEIRO) la tarifa de la fila RNM AZAMBUJA(PT)->PORRIÑO (29.83 EUR/t,
  // id real 171) -- "AVEPTO" contiene el substring "PT" (posiciones 3-4), que
  // coincidia con el fragmento suelto "PT" de "AZAMBUJA(PT)". Country-code de
  // 2 letras nunca debe ser un fragmento de match valido.
  const filas = [
    filaTarifa({ cliente: 'RNM', origen: 'AZAMBUJA(PT)', destino: 'PORRIÑO', tarifa_tn: '29.83', vigente_desde: '2026-01-01', id: 171 }),
  ];
  const viaje = { cliente: 'RNM', origen: 'AVEPTO', destino: 'PORRIÑO', fecha: '2026-07-16' };
  const r = buscarTarifa(viaje, filas);
  assert.strictEqual(r.estado, 'SIN_TARIFA', 'AVEPTO no debe matchear AZAMBUJA(PT) via el fragmento "PT"');
});

test('tarifas: matchCampo descarta fragmentos de pais de 2 letras (PT/ES) como criterio de match', () => {
  assert.strictEqual(matchCampo('AVEPTO', 'AZAMBUJA(PT)'), null);
  // pero un lugar real de 3+ letras dentro de parentesis SI matchea
  assert.strictEqual(matchCampo('LEIRIA PORTUGAL', 'LEIRIA (PT)'), 'TOKEN');
});

test('tarifas: precio_fijo (EUR/viaje) se distingue de tarifa_tn (EUR/t)', () => {
  const filas = [filaTarifa({ cliente: 'HELM', origen: 'X', destino: 'Y', precio_fijo: '250', vigente_desde: '2026-01-01', id: 900 })];
  const r = buscarTarifa({ cliente: 'HELM', origen: 'X', destino: 'Y', fecha: '2026-07-01' }, filas);
  assert.strictEqual(r.tarifa.tipo, 'fijo');
  assert.strictEqual(r.tarifa.valor, 250);
});
