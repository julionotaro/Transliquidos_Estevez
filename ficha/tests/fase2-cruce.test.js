// Tests Fase 2 — modelo "albaran = unidad facturable" (encargo 2026-08-01).
//
// Cubre §5 del encargo. OJO: el camino MULTI-VIAJE no tiene papel real (§7.5);
// estos tests unitarios son la UNICA verificacion hasta que aparezca una ficha
// FORESA Villagarcia->Caldas de verdad. Son exhaustivos a proposito.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const cruce = require('../cruce.js');
const { correlacionar } = require('../correlacionar.js');

// --- Helpers para armar entrada de correlacionar ---------------------------
function hoja(campos, bloques) {
  return Object.assign({ pagina: 1, conductor: 'X', tractora: '1234ABC', empresa: 'TLE', bloques: bloques, gastos: [], observaciones: null }, campos);
}
function bloque(campos) {
  return Object.assign({
    orden: 1, fecha_carga: '2026-07-13', fecha_carga_texto: '13/07/2026',
    nombre_carga: null, lugar_carga: null, lugar_descarga: null, tipo_mercancia: 'metanol',
    cantidad_kg: null, km_inicio: null, km_final: null, km_recorridos: null,
  }, campos);
}
function albaran(campos) {
  return Object.assign({
    pagina: 2, tipo_doc: 'albaran', matricula_tractor: '1234ABC', referencia: '2001000',
    fecha: '2026-07-13', origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS', material: 'metanol',
    kg_neto: 24000, cliente_probable: 'FORESA',
  }, campos);
}
function correr(hojas, docs) {
  return correlacionar({ hojas: hojas }, { documentos: docs || [] });
}

// ============================================================================
// Funciones puras (cruce.js)
// ============================================================================
test('cruce: reparto de km cierra exacto y el resto va al ultimo (895/6)', () => {
  const r = cruce.repartirKm(895, 6);
  assert.deepStrictEqual(r, [149, 149, 149, 149, 149, 150]);
  assert.strictEqual(r.reduce((a, b) => a + b, 0), 895);
});

test('cruce: reparto exacto sin resto (900/6)', () => {
  const r = cruce.repartirKm(900, 6);
  assert.deepStrictEqual(r, [150, 150, 150, 150, 150, 150]);
});

test('cruce: reparto sin km del bloque -> []', () => {
  assert.deepStrictEqual(cruce.repartirKm(null, 6), []);
});

test('cruce: clasificar cantidad kg normal (>=100, ruta no registrada)', () => {
  const c = cruce.clasificarCantidad(23140, 'FORESA', 'CALDAS', 'ORENSE');
  assert.strictEqual(c.modo, 'kg');
  assert.strictEqual(c.kg, 23140);
});

test('cruce: clasificar cantidad como numero de viajes (ruta registrada)', () => {
  const c = cruce.clasificarCantidad(6, 'FORESA', 'Villagarcía', 'Caldas de Reis');
  assert.strictEqual(c.modo, 'viajes');
  assert.strictEqual(c.n_viajes, 6);
  assert.strictEqual(c.kg, null);
});

test('cruce: red de seguridad <100 en ruta no registrada -> revisar', () => {
  const c = cruce.clasificarCantidad(4, 'RNM', 'AVEIRO', 'PORRINO');
  assert.strictEqual(c.modo, 'revisar');
  assert.strictEqual(c.motivo, 'posible_multiviaje_ruta_no_registrada');
});

test('cruce: regimen de indexacion por cliente/ruta (D-03/D-06)', () => {
  assert.strictEqual(cruce.regimenIndexacion('BALTRANSA', 'X', 'Y'), 'incluida');
  assert.strictEqual(cruce.regimenIndexacion('FORESA', 'Villagarcía', 'Caldas de Reis'), 'agregada_mensual');
  assert.strictEqual(cruce.regimenIndexacion('FORESA', 'Caldas de Reis', 'Ourense'), 'agregada_quincenal');
  assert.strictEqual(cruce.regimenIndexacion('FORESA', 'Caldas', 'Teruel'), 'linea');
  assert.strictEqual(cruce.regimenIndexacion('QUIMIDROGA', 'Barcelona', 'Leiria'), 'linea');
});

// ============================================================================
// §5 — Caso normal
// ============================================================================
test('§5 normal: 1 bloque + su albaran -> 1 viaje, kg del documento, km de ficha', () => {
  const h = hoja({}, [bloque({
    nombre_carga: 'FORESA', lugar_carga: 'CALDAS', lugar_descarga: 'ORENSE',
    cantidad_kg: 25000, km_inicio: 100000, km_final: 100123, km_recorridos: 123,
  })]);
  const d = albaran({ lugar_carga: 'CALDAS', origen: 'CALDAS', destino: 'ORENSE', kg_neto: 24980, referencia: '2009900' });
  const res = correr([h], [d]);
  assert.strictEqual(res.viajes.length, 1);
  const v = res.viajes[0];
  assert.strictEqual(v.es_multiviaje, false);
  assert.strictEqual(v.kg_documento, 24980, 'kg del documento (D-01)');
  assert.strictEqual(v.km_cargados, 123, 'km de la ficha');
  assert.strictEqual(v.origen_km, 'leido');
  assert.strictEqual(v.estado, 'con_documentacion');
  assert.strictEqual(v.regimen_indexacion, 'agregada_quincenal');
  assert.strictEqual(v.origen_campos.kg_documento, 'documento:albaran:pag2');
  assert.strictEqual(v.origen_campos.km, 'ficha:odometro:leido');
});

// ============================================================================
// §5 — Discrepancia de kg: prevalece el documento (D-01)
// ============================================================================
test('§5 discrepancia kg: prevalece el documento, y con diferencia grande alerta', () => {
  const h = hoja({}, [bloque({
    nombre_carga: 'FORESA', lugar_carga: 'CALDAS', lugar_descarga: 'ORENSE',
    cantidad_kg: 23140, km_inicio: 100000, km_final: 100120, km_recorridos: 120,
  })]);
  // Ficha 23140 vs albaran 22800 (dif 340 > 200): usa el documento y alerta.
  const d = albaran({ origen: 'CALDAS', destino: 'ORENSE', kg_neto: 22800 });
  const res = correr([h], [d]);
  const v = res.viajes[0];
  assert.strictEqual(v.kg_documento, 22800, 'prevalece el documento');
  assert.ok(res.avisos.some(a => /Prevalece el documento/.test(a)), 'alerta de discrepancia registrada');
});

// ============================================================================
// §5 — Multi-viaje FORESA completo (6 albaranes)
// ============================================================================
function fichaMultiviaje(cant, kmIni, kmFin, kmRec) {
  return hoja({}, [bloque({
    nombre_carga: 'FORESA', lugar_carga: 'Villagarcía', lugar_descarga: 'Caldas de Reis',
    cantidad_kg: cant, km_inicio: kmIni, km_final: kmFin, km_recorridos: kmRec,
  })]);
}
test('§5 multi-viaje completo: cantidad=6 + 6 albaranes -> 6 viajes con kg propio', () => {
  const h = fichaMultiviaje(6, 100000, 100895, 895);
  const docs = [];
  const kgs = [24000, 24010, 24020, 24030, 24040, 24050];
  for (let i = 0; i < 6; i++) { docs.push(albaran({ pagina: 2 + i, kg_neto: kgs[i], referencia: '200100' + i })); }
  const res = correr([h], docs);
  assert.strictEqual(res.viajes.length, 6, '6 viajes desde 1 bloque');
  // cada viaje con el kg de SU albaran
  for (let i = 0; i < 6; i++) {
    assert.strictEqual(res.viajes[i].kg_documento, kgs[i], 'viaje ' + (i + 1) + ' kg de su albaran');
    assert.strictEqual(res.viajes[i].origen_km, 'derivado_de_bloque');
    assert.strictEqual(res.viajes[i].estado, 'con_documentacion');
    assert.strictEqual(res.viajes[i].regimen_indexacion, 'agregada_mensual');
    assert.strictEqual(res.viajes[i].sub_orden, i + 1);
  }
  // km repartidos y suma = total del bloque
  const suma = res.viajes.reduce((a, v) => a + (v.km_cargados || 0), 0);
  assert.strictEqual(suma, 895, 'suma de km derivados = total del bloque');
  assert.deepStrictEqual(res.viajes.map(v => v.km_cargados), [149, 149, 149, 149, 149, 150]);
});

// ============================================================================
// §5 — Multi-viaje parcial (declara 6, llegan 4)
// ============================================================================
test('§5 multi-viaje parcial: declara 6, llegan 4 -> 4 consolidados + 2 PENDIENTE', () => {
  const h = fichaMultiviaje(6, 100000, 100895, 895);
  const docs = [];
  for (let i = 0; i < 4; i++) { docs.push(albaran({ pagina: 2 + i, kg_neto: 24000 + i, referencia: '200100' + i })); }
  const res = correr([h], docs);
  assert.strictEqual(res.viajes.length, 6, 'N=6 filas visibles');
  const conDoc = res.viajes.filter(v => v.estado === 'con_documentacion');
  const pend = res.viajes.filter(v => v.estado === 'PENDIENTE_DOCUMENTACION');
  assert.strictEqual(conDoc.length, 4);
  assert.strictEqual(pend.length, 2, '2 pendientes visibles para reclamar');
  for (const p of pend) {
    assert.match(p.pendiente_falta, /albaran/);
    assert.strictEqual(p.pendiente_reclamar_a, 'cliente');
    assert.strictEqual(p.kg_documento, null, 'pendiente no tiene kg facturable');
  }
  // km se siguen repartiendo entre los 6 y cierran
  assert.strictEqual(res.viajes.reduce((a, v) => a + (v.km_cargados || 0), 0), 895);
});

// ============================================================================
// §5 — Red de seguridad (cantidad<100 en ruta no registrada)
// ============================================================================
test('§5 red de seguridad: cantidad=4 en ruta no registrada -> REVISAR, no 4 kg', () => {
  const h = hoja({ tractora: '9999XXX' }, [bloque({
    nombre_carga: 'RNM', lugar_carga: 'AVEIRO', lugar_descarga: 'PORRINO',
    cantidad_kg: 4, km_inicio: 200000, km_final: 200150, km_recorridos: 150,
  })]);
  const res = correr([h], []);
  assert.strictEqual(res.viajes.length, 1, 'NO se expande a 4 viajes');
  const v = res.viajes[0];
  assert.strictEqual(v.es_multiviaje, false);
  assert.strictEqual(v.cantidad_kg, null, 'no se interpreta 4 como kg');
  assert.strictEqual(v.estado_lectura, 'REVISAR');
  assert.match(v.motivo_revision, /posible_multiviaje_ruta_no_registrada/);
});

// ============================================================================
// §5 — Ficha sin documentacion (bloqueo por viaje, no por ficha)
// ============================================================================
test('§5 ficha sin doc: bloque sin documentos -> PENDIENTE; otros bloques no se afectan', () => {
  const h = hoja({}, [
    bloque({ orden: 1, nombre_carga: 'FORESA', lugar_carga: 'CALDAS', lugar_descarga: 'ORENSE', cantidad_kg: 25000, km_inicio: 100000, km_final: 100123, km_recorridos: 123 }),
    bloque({ orden: 2, nombre_carga: 'FORESA', lugar_carga: 'CALDAS', lugar_descarga: 'ORENSE', cantidad_kg: 25000, km_inicio: 100123, km_final: 100246, km_recorridos: 123 }),
  ]);
  // Solo el bloque 2 tiene albaran.
  const d = albaran({ origen: 'CALDAS', destino: 'ORENSE', kg_neto: 24900, fecha: '2026-07-13' });
  const res = correr([h], [d]);
  const conDoc = res.viajes.filter(v => v.estado === 'con_documentacion');
  const pend = res.viajes.filter(v => v.estado === 'PENDIENTE_DOCUMENTACION');
  assert.strictEqual(conDoc.length, 1, 'el bloque con doc sigue su curso');
  assert.strictEqual(pend.length, 1, 'el bloque sin doc queda pendiente');
  assert.match(pend[0].pendiente_reclamar_a, /chofer|cliente/);
});

// ============================================================================
// §5 — Documento sin ficha (huerfano visible, no rompe la ingesta)
// ============================================================================
test('§5 doc sin ficha: matricula que no matchea -> huerfano visible como error', () => {
  const h = hoja({ tractora: '1111AAA' }, [bloque({ nombre_carga: 'FORESA', lugar_carga: 'CALDAS', lugar_descarga: 'ORENSE', cantidad_kg: 25000 })]);
  const d = albaran({ matricula_tractor: '2222BBB', referencia: '2009999' });
  const res = correr([h], [d]);
  assert.ok(res.errores.some(e => /2222BBB|no corresponde/.test(e)), 'documento huerfano visible');
  assert.strictEqual(res.viajes[0].docs.length, 0, 'no se cuelga de un viaje ajeno');
});

// ============================================================================
// §5 — Propagacion de duda (odometro del bloque dudoso -> N heredan REVISAR)
// ============================================================================
test('§5 propagacion de duda: bloque multiviaje con odometro dudoso -> los N heredan REVISAR', () => {
  // km_recorridos (800) != final-inicio (895) -> guarda de consistencia marca el bloque.
  const h = fichaMultiviaje(6, 100000, 100895, 800);
  const docs = [];
  for (let i = 0; i < 6; i++) { docs.push(albaran({ pagina: 2 + i, kg_neto: 24000 + i })); }
  const res = correr([h], docs);
  assert.strictEqual(res.viajes.length, 6);
  for (const v of res.viajes) {
    assert.strictEqual(v.estado_lectura, 'REVISAR', 'cada viaje derivado hereda la duda');
    assert.match(v.motivo_revision, /odometro mal leido/);
  }
});

// ============================================================================
// §5 — Regimen de indexacion en el viaje consolidado
// ============================================================================
test('§5 regimen: Villagarcia->Caldas=mensual, general=linea', () => {
  const hMulti = fichaMultiviaje(2, 100000, 100200, 200);
  const resMulti = correr([hMulti], [albaran({ pagina: 2 }), albaran({ pagina: 3 })]);
  assert.strictEqual(resMulti.viajes[0].regimen_indexacion, 'agregada_mensual');

  const hGen = hoja({ tractora: '3333CCC' }, [bloque({ nombre_carga: 'QUIMIDROGA', lugar_carga: 'BARCELONA', lugar_descarga: 'LEIRIA', cantidad_kg: 23820, km_inicio: 5000, km_final: 5100, km_recorridos: 100 })]);
  const resGen = correr([hGen], []);
  assert.strictEqual(resGen.viajes[0].regimen_indexacion, 'linea');
});

// ============================================================================
// §5 — Reparto no exacto cierra
// ============================================================================
test('§5 reparto no exacto: km_bloque=895, N=6 -> seis enteros que suman 895', () => {
  const r = cruce.repartirKm(895, 6);
  assert.strictEqual(r.length, 6);
  assert.ok(r.every(Number.isInteger));
  assert.strictEqual(r.reduce((a, b) => a + b, 0), 895);
});
