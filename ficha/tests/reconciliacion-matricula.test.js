// Tests — correlacion robusta ante matricula de ficha mal leida.
// Fallback tolerante, ASIMETRICO (el documento impreso manda sobre la ficha
// manuscrita) y con SALVAGUARDA DE CONVERGENCIA (no adivina si los documentos no
// coinciden entre si -> posible envio de dos camiones).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { correlacionar, setLogActivo } = require('../correlacionar.js');

setLogActivo(false);

// --- helpers de construccion -------------------------------------------------
function ficha(tractora, remolque, bloques) {
  return { pagina: 1, conductor: 'Chofer', tractora: tractora, remolque: remolque, empresa: 'TLE', bloques: bloques };
}
function bloque(campos) {
  return Object.assign({
    orden: 1, fecha_carga: '2026-07-31', fecha_carga_texto: '31-07-26', fecha_descarga: '2026-08-01',
    nombre_carga: 'Foresa', lugar_carga: 'Caldas', lugar_descarga: 'Cella', tipo_mercancia: 'Res 0541',
    cantidad_kg: 22300, km_inicio: 733815, km_final: 734740
  }, campos);
}
function doc(tractor, campos) {
  return Object.assign({
    pagina: 1, tipo_doc: 'orden_transporte', matricula_tractor: tractor, matricula_remolque: 'CR03084R',
    referencia: '706013', fecha: '2026-07-31', origen: 'Barcelona', destino: 'Moraleja',
    material: 'Lisina', kg_neto: null, cliente_probable: 'QUIMIDROGA'
  }, campos);
}
function viajeDe(res, orden) { return res.viajes.find(v => v.orden === orden) || res.viajes[0]; }

// ============================================================================
// 1. El caso #708: ficha 0337LPL + documentos todos 0332LPL -> se corrige.
// ============================================================================
test('reconciliacion: ficha 0337 + N documentos 0332 -> correlaciona, corrige matricula, toma ref/cliente del doc, sale de PENDIENTE_DOC', () => {
  const rA = { hojas: [ficha('0337LPL', 'CR03204-R', [bloque({})])] };
  const rB = { documentos: [
    doc('0332LPL', { pagina: 1, referencia: '706013', cliente_probable: 'QUIMIDROGA' }),
    doc('0332LPL', { pagina: 2, tipo_doc: 'cmr', referencia: '706013', cliente_probable: 'QUIMIDROGA' }),
    doc('0332LPL', { pagina: 3, tipo_doc: 'bascula', referencia: null, kg_neto: 22380, cliente_probable: null }),
  ] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.strictEqual(v.tractoraN, '0332LPL', 'la matricula del viaje pasa a la del documento');
  assert.strictEqual(v.tractora, '0332LPL');
  assert.strictEqual(v.tractora_original, '0337LPL', 'la lectura original de la ficha queda para auditoria');
  assert.strictEqual(v.referencia, '706013', 'referencia del documento');
  assert.strictEqual(v.cliente, 'QUIMIDROGA', 'cliente facturable del documento, no el lugar de carga');
  assert.notStrictEqual(v.estado, 'PENDIENTE_DOCUMENTACION', 'ya no falta documentacion');
  assert.strictEqual(v.estado_lectura, 'REVISAR');
  assert.match(v.motivo_revision, /matricula ficha 0337LPL corregida a 0332LPL/);
});

// ============================================================================
// 2. Camino feliz: match exacto intacto, sin marca de correccion (no regresion).
// ============================================================================
test('reconciliacion: match exacto (ficha y documentos 0332) -> correlaciona sin marca de correccion', () => {
  const rA = { hojas: [ficha('0332LPL', 'CR03084R', [bloque({})])] };
  const rB = { documentos: [doc('0332LPL', { referencia: '706013', cliente_probable: 'QUIMIDROGA' })] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.strictEqual(v.tractoraN, '0332LPL');
  assert.strictEqual(v.tractora_original, undefined, 'no hubo correccion');
  assert.strictEqual(v.referencia, '706013');
  assert.strictEqual(v.cliente, 'QUIMIDROGA');
  assert.ok(!/corregida a/.test(v.motivo_revision || ''), 'sin motivo de correccion de matricula');
});

// ============================================================================
// 3. Salvaguarda de convergencia (camiones de lote): documentos MEZCLADOS.
// ============================================================================
test('reconciliacion: documentos que NO convergen (0332 vs 0337) -> NO corrige por cercania, motivo explica no-convergencia', () => {
  const rA = { hojas: [ficha('0337LPL', 'CR03204-R', [bloque({})])] };
  const rB = { documentos: [
    doc('0332LPL', { pagina: 1, referencia: 'A1' }),
    doc('0337LPL', { pagina: 2, referencia: 'B1' }),
  ] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.strictEqual(v.tractoraN, '0337LPL', 'la matricula de la ficha NO se toca');
  assert.strictEqual(v.tractora_original, undefined, 'no hubo correccion por cercania');
  assert.match(v.motivo_revision, /no coinciden entre si|dos camiones/);
});

// ============================================================================
// 4. Candidato no unico: dos fichas a distancia 1 de la matricula convergente.
// ============================================================================
test('reconciliacion: convergen en 0335 pero hay dos fichas (0332 y 0337) a distancia 1 -> ambiguo, no adivina', () => {
  const rA = { hojas: [
    ficha('0332LPL', 'CR1', [bloque({ orden: 1 })]),
    ficha('0337LPL', 'CR2', [bloque({ orden: 2, nombre_carga: 'Diversey', lugar_carga: 'Valdemoro', lugar_descarga: 'Curtis' })]),
  ] };
  const rB = { documentos: [
    doc('0335LPL', { pagina: 1, referencia: 'X1' }),
    doc('0335LPL', { pagina: 2, referencia: 'X2' }),
  ] };
  const res = correlacionar(rA, rB);
  assert.ok(res.viajes.every(v => v.tractora_original === undefined), 'ninguna ficha se corrige');
  assert.ok(res.viajes.some(v => /candidatas a distancia/.test(v.motivo_revision || '')), 'motivo explica ambiguedad');
});

// ============================================================================
// 5. Distancia > 1: no se puede afirmar mismo camion.
// ============================================================================
test('reconciliacion: ficha 0399 vs documentos 0332 (distancia > 1) -> NO corrige, motivo lo explica', () => {
  const rA = { hojas: [ficha('0399LPL', 'CR03084R', [bloque({})])] };
  const rB = { documentos: [doc('0332LPL', { referencia: '706013' })] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.strictEqual(v.tractoraN, '0399LPL', 'no se corrige');
  assert.strictEqual(v.tractora_original, undefined);
  assert.match(v.motivo_revision, /distancia > 1|no se puede afirmar/);
  assert.strictEqual(v.estado, 'PENDIENTE_DOCUMENTACION', 'sin documento correlacionado sigue pendiente');
});

// ============================================================================
// 6. Documento con matricula ilegible: no cuenta para convergencia ni rompe.
// ============================================================================
test('reconciliacion: un documento con matricula null no rompe la convergencia de los demas', () => {
  const rA = { hojas: [ficha('0337LPL', 'CR03204-R', [bloque({})])] };
  const rB = { documentos: [
    doc('0332LPL', { pagina: 1, referencia: '706013', cliente_probable: 'QUIMIDROGA' }),
    doc(null, { pagina: 2, tipo_doc: 'otro', referencia: null, cliente_probable: null }),
  ] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.strictEqual(v.tractoraN, '0332LPL', 'converge en 0332 ignorando el doc sin matricula');
  assert.strictEqual(v.tractora_original, '0337LPL');
  assert.match(v.motivo_revision, /corregida a 0332LPL/);
});

// ============================================================================
// 7. MAYORIA CLARA (ejec. 944): el envio tuvo DOS camiones — un viaje lo cubrio
//    otro camion (7347LBB, lejano). La mayoria (0332LPL) corrige la ficha; el
//    camion lejano NO bloquea los viajes limpios. Antes: unanimidad -> docs:[].
// ============================================================================
test('reconciliacion: ficha 0332LPZ + mayoria 0332LPL + un 7347LBB lejano -> corrige a 0332LPL y pega los docs limpios (el camion lejano no bloquea)', () => {
  const rA = { hojas: [ficha('0332LPZ', 'CR03204-R', [
    bloque({ orden: 1, nombre_carga: 'Foresa', lugar_carga: 'Caldas', lugar_descarga: 'Cella', cantidad_kg: 22600 }),
    bloque({ orden: 2, nombre_carga: 'Tepsa', lugar_carga: 'Barcelona', lugar_descarga: 'Orense', cantidad_kg: 23920 }),
  ])] };
  const rB = { documentos: [
    doc('0332LPL', { pagina: 1, tipo_doc: 'cmr', referencia: '2017842', cliente_probable: 'FORESA', kg_neto: 22600 }),
    doc('0332LPL', { pagina: 2, tipo_doc: 'orden_transporte', referencia: '706162', cliente_probable: 'QUIMIDROGA', kg_neto: 23920 }),
    doc('7347LBB', { pagina: 3, tipo_doc: 'cmr', referencia: 'R427972', cliente_probable: 'RNM', kg_neto: 23760 }),
  ] };
  const res = correlacionar(rA, rB);
  res.viajes.forEach(function (v) {
    assert.strictEqual(v.tractoraN, '0332LPL', 'la ficha se corrige a la matricula mayoritaria');
    assert.match(v.motivo_revision, /corregida a 0332LPL/);
  });
  const v1 = viajeDe(res, 1);
  const v2 = viajeDe(res, 2);
  assert.ok(v1.docs.length >= 1, 'el viaje limpio 1 recibe su documento (ya no docs:[])');
  assert.ok(v2.docs.length >= 1, 'el viaje limpio 2 recibe su documento');
  assert.notStrictEqual(v1.cliente, null, 'el viaje 1 sale de sin-cliente');
});

// ============================================================================
// 8. CONTRASTE: dos matriculas de documento CERCANAS entre si (par de lote)
//    siguen siendo ambiguas -> NO se corrige. No aflojamos ese caso peligroso.
// ============================================================================
test('reconciliacion: ficha 0333LPL + docs 0332LPL y 0334LPL (ambos cercanos) -> ambiguo, no corrige', () => {
  const rA = { hojas: [ficha('0333LPL', 'CR1', [bloque({})])] };
  const rB = { documentos: [
    doc('0332LPL', { pagina: 1, referencia: 'A1' }),
    doc('0334LPL', { pagina: 2, referencia: 'B1' }),
  ] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.strictEqual(v.tractora_original, undefined, 'no se corrige: dos candidatas cercanas (par de lote)');
  assert.match(v.motivo_revision, /no coinciden entre si|dos camiones/);
});
