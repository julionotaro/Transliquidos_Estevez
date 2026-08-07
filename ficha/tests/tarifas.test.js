// Tests v1.1 pieza 2 — lookup de tarifas (planilla carga/auditoria).
//
// Fixtures: valores de ruta/tarifa tomados del readback real contra `Tarifas`;
// la columna `cliente` usa la RAZON SOCIAL exacta tal cual quedo tras la recarga
// del Excel (Siwhv2AUWTSeFlrJ, 698 filas, 2026-08-04) -- que es contra lo que
// hoy matchea buscarTarifa. Los objetos `viaje` usan el codigo corto leido
// ("FORESA", "RNM"...), que buscarTarifa resuelve via ficha/clientes.js.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { matchCampo, buscarTarifa } = require('../tarifas.js');

const CLI_FORESA = 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.';
const CLI_QUIMIDROGA = 'QUIMIDROGA, S.A.';
const CLI_RNM = 'RNM TRANSPORTES QUIMICOS, LDA';
const CLI_HELM = 'HELM IBERICA, S.A.';

function filaTarifa(campos) {
  return Object.assign({
    cliente: CLI_FORESA, origen: '', destino: '', material: '',
    tarifa_tn: '', precio_fijo: '', vigente_desde: '', id: 0
  }, campos);
}

// Escenario FORESA ->TERUEL con dos vigencias, para cubrir el selector por
// fecha. La recarga atomizo los origenes y dedup dejo una sola vigencia por
// ruta en la tabla real (FORESA CALDAS DE REIS->TERUEL: 56, 2026-08-03), asi
// que este fixture es CONSTRUIDO sobre esa fila real para no perder la cobertura
// del selector; conserva ademas una forma con parentesis ("BRESFOR (AVEIRO)")
// para ejercitar el fallback por fragmento en origen.
const TARIFAS_FORESA_TERUEL = [
  filaTarifa({ origen: 'CALDAS DE REIS', destino: 'TERUEL', tarifa_tn: '54.9', vigente_desde: '2025-01-01', id: 37 }),
  filaTarifa({ origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL', tarifa_tn: '54.9', vigente_desde: '2025-01-01', id: 70 }),
  filaTarifa({ origen: 'CALDAS DE REIS', destino: 'TERUEL', tarifa_tn: '56.0', vigente_desde: '2026-01-01', id: 248 }),
  filaTarifa({ origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL', tarifa_tn: '56.0', vigente_desde: '2026-01-01', id: 274 }),
];

// Real: QUIMIDROGA BARCELONA->LEIRIA (PT).
const TARIFAS_QUIMIDROGA_LEIRIA = [
  filaTarifa({ cliente: CLI_QUIMIDROGA, origen: 'BARCELONA', destino: 'LEIRIA (PT)', tarifa_tn: '88.25', vigente_desde: '2026-01-15', id: 363 }),
];

// Real: RNM AVEIRO->PORRIÑO.
const TARIFAS_RNM = [
  filaTarifa({ cliente: CLI_RNM, origen: 'AVEIRO', destino: 'PORRIÑO', tarifa_tn: '19.0', vigente_desde: '2025-01-01', id: 166 }),
];

test('tarifas: cliente leido con codigo corto resuelve la razon social y matchea EXACTO', () => {
  // El viaje trae "FORESA" (codigo corto); la tabla trae la razon social
  // completa. buscarTarifa resuelve la identidad y matchea exacto -- este es
  // justo el caso que regresionaba tras la recarga.
  const viaje = { cliente: 'FORESA', origen: 'CALDAS DE REIS', destino: 'TERUEL', fecha: '2026-07-07' };
  const r = buscarTarifa(viaje, TARIFAS_FORESA_TERUEL);
  assert.notStrictEqual(r.estado, 'SIN_TARIFA', 'FORESA (codigo corto) debe resolver contra la razon social');
  assert.strictEqual(r.tarifa.valor, 56.0);
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
  const viaje = { cliente: 'FORESA', origen: 'CALDAS DE REIS', destino: 'TERUEL', fecha: '2025-06-01' };
  const r = buscarTarifa(viaje, TARIFAS_FORESA_TERUEL);
  assert.strictEqual(r.tarifa.valor, 54.9);
  assert.strictEqual(r.fila.id, 37);
});

test('tarifas: FALLBACK por fragmento en origen — ficha "PORTO DE AVEIRO" matchea tarifa "BRESFOR (AVEIRO)"', () => {
  // El fallback por fragmento sigue vivo para las formas con parentesis que la
  // recarga NO atomizo (codigo de pais / origen entre parentesis). La ficha lee
  // "PORTO DE AVEIRO", la tarifa trae "BRESFOR (AVEIRO)": el texto completo no
  // coincide, el fragmento "AVEIRO" si. (matchCampo tambien maneja las celdas
  // multi-valor con "/", aunque el tarifario nuevo ya casi no las trae.)
  assert.strictEqual(matchCampo('CALDAS DE REIS', 'CALDAS/VILLAGARCIA'), 'TOKEN');
  assert.strictEqual(matchCampo('PORTO DE AVEIRO', 'BRESFOR (AVEIRO)'), 'TOKEN');
  const viaje = { cliente: 'FORESA', origen: 'PORTO DE AVEIRO', destino: 'TERUEL', fecha: '2026-07-07' };
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
  // Codigo de cliente sin razon social mapeada -> REVISAR ruidoso con el valor
  // leido (mismo patron que "cliente no reconocido"), no tarifa a ciegas.
  assert.match(r.motivo, /cliente_no_mapeado: TEPSA/);
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
  // El motivo nombra la razon social resuelta (identidad ok), la ruta es la que falta.
  assert.match(r.motivo, /sin_tarifa: FORESA IND\.QUIMICAS DEL NOROESTE, S\.A\. CALDAS -> ORENSE/);
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
  //
  // NOTA (fix de identidad 2026-08-04): con la razon social resuelta, la
  // IDENTIDAD de cliente RNM ahora si matchea (antes fallaba por eso). Lo que
  // sigue sin resolver es la GEOGRAFIA: "AVEPTO" no es "AVEIRO". El encargo
  // listaba este viaje como "debe volver a resolver", pero resolverlo exigiria
  // un alias de misread AVEPTO->AVEIRO, prohibido por la misma disciplina del
  // encargo (nada de fuzzy sobre identidad; y el guardia de 2 letras del PR #1).
  // Queda SIN_TARIFA por razon real de lectura, no por el bug de identidad.
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
    filaTarifa({ cliente: CLI_RNM, origen: 'AZAMBUJA(PT)', destino: 'PORRIÑO', tarifa_tn: '29.83', vigente_desde: '2026-01-01', id: 171 }),
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
  const filas = [filaTarifa({ cliente: CLI_HELM, origen: 'X', destino: 'Y', precio_fijo: '250', vigente_desde: '2026-01-01', id: 900 })];
  const r = buscarTarifa({ cliente: 'HELM', origen: 'X', destino: 'Y', fecha: '2026-07-01' }, filas);
  assert.strictEqual(r.tarifa.tipo, 'fijo');
  assert.strictEqual(r.tarifa.valor, 250);
});
