// Tests del lector de odometros Document AI (modalidad B).
//   node --test ficha/tests/*.test.js
//
// Los fixtures reproducen las lecturas REALES de la prueba (ejec. 583/584,
// docs/prueba-document-ai.md): el split de "839 056" en dos tokens, los
// malformados 94/030 y 94/533, y las confianzas por token medidas.

const test = require('node:test');
const assert = require('node:assert');
const {
  UMBRAL_CONFIANZA_DOCAI,
  analizarValor,
  parsearBandaKm,
  evaluarCampoDocai,
} = require('../docai.js');

// Arma los tokens de una banda de km como los devuelve Document AI: etiquetas
// impresas + numeros, con X creciente. `ini/fin/rec` = arrays de {t,c}.
function banda(ini, fin, rec) {
  const toks = [];
  let x = 0.02;
  const push = (t, c) => { toks.push({ t: t, c: (c == null ? 0.99 : c), x: x }); x += 0.03; };
  ['KM', '.', 'AL', 'INICIO', 'DEL', 'VIAJE'].forEach((t) => push(t));
  ini.forEach((o) => push(o.t, o.c));
  ['KM', '.', 'AL', 'FINAL', 'DEL', 'VIAJE'].forEach((t) => push(t));
  fin.forEach((o) => push(o.t, o.c));
  ['KM', '.', 'RECORRIDOS'].forEach((t) => push(t));
  rec.forEach((o) => push(o.t, o.c));
  return toks;
}

// ============================================================================
// 1. analizarValor: quita separadores de miles, detecta malformado
// ============================================================================

test('analizarValor: numero limpio con puntos de miles', () => {
  assert.deepStrictEqual(analizarValor('838.163'), { valor: 838163, malformado: false, raw: '838.163' });
});

test('analizarValor: numero ya unido sin separadores', () => {
  assert.strictEqual(analizarValor('739056').valor, 739056);
});

test('analizarValor: puntos internos multiples se limpian (1053.90.6 -> 1053906)', () => {
  assert.strictEqual(analizarValor('1053.90.6').valor, 1053906);
});

test('analizarValor: token con "/" es MALFORMADO, no se parsea', () => {
  const r = analizarValor('94/030');
  assert.strictEqual(r.malformado, true);
  assert.strictEqual(r.valor, null);
});

test('analizarValor: token con "%" es MALFORMADO', () => {
  const r = analizarValor('841.06%');
  assert.strictEqual(r.malformado, true);
  assert.strictEqual(r.valor, null);
});

// ============================================================================
// 2. parsearBandaKm: une tokens partidos, usa etiquetas como ancla
// ============================================================================

test('V1 real: km_final partido "739"+"056" se une en 739056; conf = la minima', () => {
  const b = banda([{ t: '838.163', c: 0.973 }], [{ t: '739', c: 0.755 }, { t: '056', c: 0.975 }], [{ t: '893', c: 0.875 }]);
  const r = parsearBandaKm(b);
  assert.strictEqual(r.inicio.valor, 838163);
  assert.strictEqual(r.inicio.conf, 0.973);
  assert.strictEqual(r.final.valor, 739056, 'los dos tokens del final se unen');
  assert.strictEqual(r.final.conf, 0.755, 'la confianza del campo es la MINIMA de sus tokens');
  assert.strictEqual(r.final.malformado, false);
});

test('V4 real: km_final malformado "94/030" -> valor null, malformado true', () => {
  const b = banda([{ t: '940907', c: 0.925 }], [{ t: '94/030', c: 0.835 }], [{ t: '123' }]);
  const r = parsearBandaKm(b);
  assert.strictEqual(r.inicio.valor, 940907);
  assert.strictEqual(r.final.valor, null);
  assert.strictEqual(r.final.malformado, true);
});

test('V9 real: km_final limpio pero MAL (1059410) con confianza baja .614', () => {
  const b = banda([{ t: '1054286', c: 0.953 }], [{ t: '1059410', c: 0.614 }], [{ t: '124' }]);
  const r = parsearBandaKm(b);
  assert.strictEqual(r.inicio.valor, 1054286);
  assert.strictEqual(r.final.valor, 1059410);
  assert.strictEqual(r.final.malformado, false);
  assert.strictEqual(r.final.conf, 0.614);
});

test('parseo robusto al orden: aunque los tokens vengan desordenados, X manda', () => {
  const b = banda([{ t: '1054286', c: 0.953 }], [{ t: '1059410', c: 0.614 }], [{ t: '124' }]);
  const desordenado = b.slice().reverse();
  const r = parsearBandaKm(desordenado);
  assert.strictEqual(r.inicio.valor, 1054286);
  assert.strictEqual(r.final.valor, 1059410);
});

test('fallback sin etiquetas: toma los dos numeros largos por X como inicio/final', () => {
  const toks = [
    { t: '1053783', c: 0.83, x: 0.2 },
    { t: '1053906', c: 0.95, x: 0.5 },
    { t: '123', c: 0.9, x: 0.8 },
  ];
  const r = parsearBandaKm(toks);
  assert.strictEqual(r.inicio.valor, 1053783);
  assert.strictEqual(r.final.valor, 1053906);
});

// ============================================================================
// 3. evaluarCampoDocai: la guarda de confianza/formato (encargo §2)
// ============================================================================

test('umbral por defecto es 0.80', () => {
  assert.strictEqual(UMBRAL_CONFIANZA_DOCAI, 0.80);
});

test('campo limpio y confiado (>=0.80) -> OK', () => {
  assert.deepStrictEqual(evaluarCampoDocai({ valor: 838163, malformado: false, conf: 0.973 }), { ok: true, motivo: null });
});

test('confianza < 0.80 -> REVISAR baja_confianza_docai (V1 final .755, V9 final .614)', () => {
  assert.deepStrictEqual(evaluarCampoDocai({ valor: 739056, malformado: false, conf: 0.755 }), { ok: false, motivo: 'baja_confianza_docai' });
  assert.deepStrictEqual(evaluarCampoDocai({ valor: 1059410, malformado: false, conf: 0.614 }), { ok: false, motivo: 'baja_confianza_docai' });
});

test('malformado -> REVISAR formato_invalido_docai (V4/V6), sin importar la confianza', () => {
  assert.deepStrictEqual(evaluarCampoDocai({ valor: null, malformado: true, conf: 0.889 }), { ok: false, motivo: 'formato_invalido_docai' });
});

test('V7 en modalidad B: inicio 1053783 a conf .834 (>=0.80) -> OK, sin falso REVISAR', () => {
  // El que gpt-4o erro (1057823). En modalidad A la conf era .74 (< umbral, falso
  // REVISAR); en B es .834 -> se acepta. Es un punto a favor de la modalidad B.
  assert.strictEqual(evaluarCampoDocai({ valor: 1053783, malformado: false, conf: 0.834 }).ok, true);
});

test('V2/V5: correctos pero con conf < 0.80 -> REVISAR (falso positivo, costo aceptado)', () => {
  // V2 inicio 839489 @ .76 y V5 final 941275 @ .656: valores CORRECTOS que el
  // umbral 0.80 manda a REVISAR. Es el trade-off documentado (§7.4): un REVISAR
  // de mas es seguro; un OK malo no. Se reporta para recalibrar el umbral.
  assert.strictEqual(evaluarCampoDocai({ valor: 839489, malformado: false, conf: 0.76 }).ok, false);
  assert.strictEqual(evaluarCampoDocai({ valor: 941275, malformado: false, conf: 0.656 }).ok, false);
});
