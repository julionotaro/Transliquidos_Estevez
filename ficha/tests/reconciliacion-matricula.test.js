// Tests — resolucion de matricula y asociacion de documentos.
//
// ARQUITECTURA (2026-08-22): la matricula se resuelve PRIMERO contra el PADRON DE
// FLOTA (ficha/flota.js, ~28 tractoras reales). Una lectura con 1-3 caracteres mal
// se convierte en la matricula CIERTA, y ficha y documentos convergen solos. La
// reconciliacion asimetrica (documento manda sobre ficha) queda como respaldo para
// lo que el padron no cubre (ficha ilegible, vehiculo subcontratado).
//
// Propiedades que NO se negocian:
//   - Si el padron no puede elegir sin ambiguedad, NO se inventa una matricula.
//   - Un cambio de matricula SIEMPRE deja traza y manda el viaje a REVISAR.
//   - Un documento que no se puede atribuir no le presta su carga a ningun viaje.

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
// 1. CASO REAL: la ficha se leyo 0332LPZ (Z por L). El padron la resuelve a
//    0332LPL y los documentos se pegan solos.
// ============================================================================
test('padron: ficha 0332LPZ + documentos 0332LPL -> converge, pega documentos, toma ref/cliente y sale de PENDIENTE_DOC', () => {
  const rA = { hojas: [ficha('0332LPZ', 'CR03204-R', [bloque({})])] };
  const rB = { documentos: [
    doc('0332LPL', { pagina: 1, referencia: '706013', cliente_probable: 'QUIMIDROGA' }),
    doc('0332LPL', { pagina: 2, tipo_doc: 'cmr', referencia: '706013', cliente_probable: 'QUIMIDROGA' }),
    doc('0332LPL', { pagina: 3, tipo_doc: 'bascula', referencia: null, kg_neto: 22380, cliente_probable: null }),
  ] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.strictEqual(v.tractoraN, '0332LPL', 'el padron resuelve la matricula real');
  assert.ok(v.docs.length >= 1, 'los documentos se asocian');
  assert.strictEqual(v.referencia, '706013');
  assert.strictEqual(v.cliente, 'QUIMIDROGA', 'cliente facturable del documento, no el lugar de carga');
  assert.notStrictEqual(v.estado, 'PENDIENTE_DOCUMENTACION');
  assert.strictEqual(v.estado_lectura, 'REVISAR', 'cambiar la matricula nunca pasa en silencio');
  assert.match(v.motivo_revision, /0332LPL/, 'el motivo deja traza del cambio');
});

// ============================================================================
// 2. Camino feliz: lectura exacta -> sin marca de correccion (no regresion).
// ============================================================================
test('padron: lectura exacta de una matricula de la flota -> sin marca de correccion', () => {
  const rA = { hojas: [ficha('0332LPL', 'CR03084R', [bloque({})])] };
  const rB = { documentos: [doc('0332LPL', { referencia: '706013', cliente_probable: 'QUIMIDROGA' })] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.strictEqual(v.tractoraN, '0332LPL');
  assert.strictEqual(v.referencia, '706013');
  assert.strictEqual(v.cliente, 'QUIMIDROGA');
  assert.ok(!/padron de flota|corregida a/.test(v.motivo_revision || ''), 'sin motivo de correccion');
});

// ============================================================================
// 3. SALVAGUARDA: lectura a mitad de camino entre dos matriculas REALES de la
//    flota (3729JLH / 3729JWP) -> no se elige ninguna.
// ============================================================================
test('padron: lectura ambigua entre dos matriculas reales -> no inventa, deja traza', () => {
  const rA = { hojas: [ficha('3729JXX', 'CR1', [bloque({})])] };
  const rB = { documentos: [doc('3729JLH', { referencia: 'A1' })] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.notStrictEqual(v.tractoraN, '3729JWP', 'no elige arbitrariamente una de las dos');
  assert.match(v.motivo_revision || '', /se parece por igual|corregida a|no coinciden/,
    'la ambiguedad o la correccion quedan explicadas');
});

// ============================================================================
// 4. Vehiculo FUERA del padron (subcontratado): no se fuerza ni se bloquea.
// ============================================================================
test('padron: matricula que no es de la flota -> se respeta tal cual, no bloquea la correlacion', () => {
  const rA = { hojas: [ficha('1234ABC', 'CR1', [bloque({})])] };
  const rB = { documentos: [doc('1234ABC', { referencia: 'S1', cliente_probable: 'QUIMIDROGA' })] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.strictEqual(v.tractoraN, '1234ABC', 'no se fuerza a una matricula de la flota');
  assert.strictEqual(v.docs.length, 1, 'igual correlaciona con su documento');
  assert.strictEqual(v.referencia, 'S1');
});

// ============================================================================
// 5. Documento con matricula ilegible: no rompe a los demas.
// ============================================================================
test('un documento con matricula null no rompe la asociacion de los demas', () => {
  const rA = { hojas: [ficha('0332LPZ', 'CR03204-R', [bloque({})])] };
  const rB = { documentos: [
    doc('0332LPL', { pagina: 1, referencia: '706013', cliente_probable: 'QUIMIDROGA' }),
    doc(null, { pagina: 2, tipo_doc: 'otro', referencia: null, cliente_probable: null }),
  ] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.strictEqual(v.tractoraN, '0332LPL');
  assert.strictEqual(v.referencia, '706013');
});

// ============================================================================
// 6. DOS CAMIONES REALES en el envio (ejec. 944): un viaje lo cubrio otro camion
//    (7347LBB). El camion ajeno NO bloquea los viajes limpios.
// ============================================================================
test('dos camiones reales en el envio: el ajeno no bloquea los viajes limpios', () => {
  const rA = { hojas: [ficha('0332LPZ', 'CR03204-R', [
    bloque({ orden: 1, nombre_carga: 'Foresa', lugar_carga: 'Caldas', lugar_descarga: 'Cella', cantidad_kg: 22600 }),
    bloque({ orden: 2, nombre_carga: 'Tepsa', lugar_carga: 'Barcelona', lugar_descarga: 'Orense', cantidad_kg: 23920 }),
  ])] };
  const rB = { documentos: [
    doc('0332LPL', { pagina: 1, tipo_doc: 'cmr', referencia: '2017842', emisor: 'FORESA', cliente_probable: 'FORESA', kg_neto: 22600 }),
    doc('0332LPL', { pagina: 2, tipo_doc: 'orden_transporte', referencia: '706162', emisor: 'TEPSA', cliente_probable: 'QUIMIDROGA', kg_neto: 23920 }),
    doc('7347LBB', { pagina: 3, tipo_doc: 'cmr', referencia: 'R427972', emisor: 'RNM', cliente_probable: 'RNM', kg_neto: 23760 }),
  ] };
  const res = correlacionar(rA, rB);
  assert.ok(res.viajes.every(v => v.tractoraN === '0332LPL'), 'la ficha resuelve a su matricula real');
  assert.ok(viajeDe(res, 1).docs.length >= 1, 'el viaje limpio 1 recibe su documento');
  assert.ok(viajeDe(res, 2).docs.length >= 1, 'el viaje limpio 2 recibe su documento');
});

// ============================================================================
// 7. CASO REAL 967: documentos SUCIOS — matricula null (el PDF dice "Vehiculo
//    tractor: ES 0332LPL"), sin cero inicial ("332LPL") y ANO mal (2020 por 2026,
//    que inutiliza el desempate por fecha). Igual deben llegar a su viaje.
// ============================================================================
test('caso 967: docs con matricula null / sin cero inicial / ano mal -> se asignan por peso, emisor y destino', () => {
  const rA = { hojas: [ficha('0332LPZ', 'CR-03204-R', [
    bloque({ orden: 1, fecha_carga: '2026-08-07', fecha_descarga: '2026-08-10', nombre_carga: 'Foresa', lugar_carga: 'Caldas', lugar_descarga: 'Cella', nombre_descarga: 'Finsa Cella', tipo_mercancia: 'Res 0201', cantidad_kg: 22600 }),
    bloque({ orden: 2, fecha_carga: '2026-08-11', fecha_descarga: '2026-08-12', nombre_carga: 'Tepsa', lugar_carga: 'Barcelona', lugar_descarga: 'Orense', nombre_descarga: 'Reivi', tipo_mercancia: 'Vinka-Plast.', cantidad_kg: 23920 }),
    bloque({ orden: 3, fecha_carga: '2026-08-12', fecha_descarga: '2026-08-13', nombre_carga: 'Tepsa', lugar_carga: null, lugar_descarga: 'V. Formalicao', nombre_descarga: 'RNM', tipo_mercancia: 'A. Acetico', cantidad_kg: 23760 }),
  ])] };
  const rB = { documentos: [
    doc('0332LPL', { pagina: 1, tipo_doc: 'albaran', emisor: 'FORESA', referencia: '2017842', fecha: '2020-08-10', destino: 'FINANCIERA MADERERA SA', material: 'Resina colofonia', kg_neto: null, cliente_probable: null }),
    doc(null, { pagina: 3, tipo_doc: 'carta_porte', emisor: 'TEPSA', referencia: '202610005532CRP', fecha: '2020-08-12', destino: 'REVI', material: 'VINKA PLAST', kg_neto: 23920, cliente_probable: null }),
    doc(null, { pagina: 5, tipo_doc: 'carta_porte', emisor: 'TEPSA', referencia: '202610005532CRP', fecha: '2020-08-11', destino: 'RNM', material: 'ACIDO ACETICO', kg_neto: 23760, cliente_probable: null }),
    doc('332LPL', { pagina: 6, tipo_doc: 'cmr', referencia: '202610005532CMR', fecha: '2020-08-11', destino: 'RNM', material: 'ACIDO ACETICO', kg_neto: 23760, cliente_probable: null }),
  ] };
  const res = correlacionar(rA, rB);
  const v1 = viajeDe(res, 1), v2 = viajeDe(res, 2), v3 = viajeDe(res, 3);
  assert.ok(res.viajes.every(v => v.tractoraN === '0332LPL'), 'todas resuelven a la matricula real');
  assert.strictEqual(v1.docs.length, 1, 'viaje 1 <- albaran Foresa (desempate por emisor)');
  assert.strictEqual(v2.docs.length, 1, 'viaje 2 <- doc de 23920 kg');
  assert.strictEqual(v3.docs.length, 2, 'viaje 3 <- los dos de 23760 kg (uno entraba sin el cero inicial)');
  assert.ok(res.viajes.every(v => v.estado !== 'PENDIENTE_DOCUMENTACION'), 'ninguno queda sin documentacion');
});

// ============================================================================
// 8. CASO REAL 975: la vision NO leyo la matricula de la ficha (null). Los
//    documentos si -> se adopta del documento (asimetria) y todo se asocia.
// ============================================================================
test('caso 975: ficha con tractora null -> adopta la matricula dominante de los documentos y asocia', () => {
  const rA = { hojas: [ficha(null, 'CR-03204-R', [
    bloque({ orden: 1, fecha_carga: '2026-08-07', fecha_descarga: '2026-08-10', nombre_carga: 'Foresa', lugar_carga: 'Caldas', lugar_descarga: 'Cella', nombre_descarga: 'Finsa Cella', tipo_mercancia: 'Res 0701', cantidad_kg: 22600 }),
    bloque({ orden: 2, fecha_carga: '2026-08-11', fecha_descarga: '2026-08-12', nombre_carga: 'Tepsa', lugar_carga: 'Barcelona', lugar_descarga: 'Orense', nombre_descarga: 'Revi', tipo_mercancia: 'Vinka-Plast.', cantidad_kg: 23920 }),
    bloque({ orden: 3, fecha_carga: '2026-08-12', fecha_descarga: '2026-08-13', nombre_carga: 'Tepsa', lugar_carga: null, lugar_descarga: 'V. Formalicao', nombre_descarga: 'RNM', tipo_mercancia: 'A. Acetico', cantidad_kg: 23760 }),
  ])] };
  const rB = { documentos: [
    doc('0332LPL', { pagina: 1, tipo_doc: 'albaran', emisor: 'FORESA IND. QUIMICAS DEL NOROESTE SA', referencia: '2009926', fecha: '2026-08-10', destino: 'FINSA CELLA', material: 'Resorcinol', kg_neto: null, cliente_probable: 'FORESA' }),
    doc(null, { pagina: 2, tipo_doc: 'orden_transporte', emisor: 'Quimidroga', referencia: '706162', fecha: '2026-08-03', destino: 'COMQUIMICOS ELECTROQUIMICOS REVI', material: 'VINA PLAST OD 390 BULK', kg_neto: null, cliente_probable: 'QUIMIDROGA' }),
    doc(null, { pagina: 3, tipo_doc: 'carta_porte', emisor: 'TEPSA', referencia: '202610005532CRP', fecha: '2026-08-12', destino: 'COMQUIMICOS ELECTROQUIMICOS REVI', material: 'VINA PLAST OD 390', kg_neto: 23920, cliente_probable: 'QUIMIDROGA' }),
    doc(null, { pagina: 5, tipo_doc: 'carta_porte', emisor: 'TEPSA', referencia: '202610005532CRP', fecha: '2026-08-11', destino: 'RENI - PRODUTOS QUIMICOS S.A.', material: 'Acido Acetico', kg_neto: 23760, cliente_probable: null }),
    doc('0332LPL', { pagina: 6, tipo_doc: 'cmr', emisor: 'TEPSA', referencia: '202610005532CMR', fecha: '2026-08-11', destino: 'RENI - PRODUTOS QUIMICOS S.A.', material: 'Acido Acetico', kg_neto: 23760, cliente_probable: null }),
  ] };
  const res = correlacionar(rA, rB);
  const v1 = viajeDe(res, 1), v2 = viajeDe(res, 2), v3 = viajeDe(res, 3);
  assert.ok(res.viajes.every(v => v.tractoraN === '0332LPL'), 'se adopta la matricula de los documentos');
  assert.ok(res.viajes.every(v => /no traia matricula legible/.test(v.motivo_revision || '')), 'queda trazado y en REVISAR');
  assert.strictEqual(v1.docs.length, 1, 'viaje 1 <- albaran Foresa (por emisor)');
  assert.strictEqual(v2.docs.length, 2, 'viaje 2 <- orden Quimidroga (por destino Revi) + carta 23920 kg');
  assert.strictEqual(v3.docs.length, 2, 'viaje 3 <- carta + CMR de 23760 kg');
  assert.ok(res.viajes.every(v => v.estado !== 'PENDIENTE_DOCUMENTACION'), 'ninguno queda sin documentacion');
  assert.match(v1.cliente || '', /FORESA/, 'viaje 1 resuelve cliente desde el documento');
  assert.strictEqual(v1.referencia, '2009926', 'y toma la referencia del albaran');
});

// ============================================================================
// 9. Normalizacion en codigo: prefijo de pais y cero inicial perdido.
// ============================================================================
test('normalizacion: prefijo ES/PT y cero inicial perdido se resuelven sin depender del modelo', () => {
  const rA = { hojas: [ficha('0332LPL', 'CR1', [bloque({ cantidad_kg: 22600 })])] };
  const rB = { documentos: [
    doc('ES 0332LPL', { pagina: 1, referencia: 'A1', kg_neto: 22600 }),
    doc('332LPL', { pagina: 2, tipo_doc: 'cmr', referencia: 'A2', kg_neto: 22600 }),
  ] };
  const res = correlacionar(rA, rB);
  const v = viajeDe(res, 1);
  assert.strictEqual(v.docs.length, 2, 'ambas variantes sucias se resuelven a 0332LPL');
});
