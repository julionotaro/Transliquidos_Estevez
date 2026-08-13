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
  assert.strictEqual(cruce.regimenIndexacion('BALTRANSA', 'X', 'Y').regimen, 'incluida');
  assert.strictEqual(cruce.regimenIndexacion('FORESA', 'Villagarcía', 'Caldas de Reis').regimen, 'agregada_mensual');
  assert.strictEqual(cruce.regimenIndexacion('FORESA', 'Caldas de Reis', 'Ourense').regimen, 'agregada_quincenal');
  assert.strictEqual(cruce.regimenIndexacion('FORESA', 'Caldas', 'Teruel').regimen, 'linea');
  assert.strictEqual(cruce.regimenIndexacion('QUIMIDROGA', 'Barcelona', 'Leiria').regimen, 'linea');
  assert.strictEqual(cruce.regimenIndexacion('RNM', 'Aveiro', 'Porriño').regimen, 'linea');
  assert.strictEqual(cruce.regimenIndexacion('HELM', 'X', 'Y').regimen, 'linea');
});

// ============================================================================
// Cierre v1, pieza 1 — cliente no reconocido falla ruidoso (NO alias de FORBA)
// ============================================================================
test('cierre-v1: cliente conocido con regimen linea -> sin cambios (no regresion)', () => {
  const r = cruce.regimenIndexacion('QUIMIDROGA', 'Barcelona', 'Leiria');
  assert.strictEqual(r.regimen, 'linea');
  assert.strictEqual(r.motivo, null);
});

test('cierre-v1: BALTRANSA -> incluida (no cambia)', () => {
  const r = cruce.regimenIndexacion('BALTRANSA', 'X', 'Y');
  assert.strictEqual(r.regimen, 'incluida');
  assert.strictEqual(r.motivo, null);
});

test('cierre-v1: FORESA en Caldas->Orense -> agregada_quincenal (no cambia)', () => {
  const r = cruce.regimenIndexacion('FORESA', 'Caldas de Reis', 'Ourense');
  assert.strictEqual(r.regimen, 'agregada_quincenal');
  assert.strictEqual(r.motivo, null);
});

test('cierre-v1: cliente "FORBA" (misread de FORESA) -> NO alias, regimen null + motivo con el valor leido', () => {
  const r = cruce.regimenIndexacion('FORBA', 'Caldas', 'Orense');
  assert.strictEqual(r.regimen, null);
  assert.strictEqual(r.motivo, 'cliente_no_reconocido: FORBA');
});

test('cierre-v1: cliente null (no se leyo) -> mismo tratamiento, motivo indica que no se leyo', () => {
  const r = cruce.regimenIndexacion(null, 'Caldas', 'Orense');
  assert.strictEqual(r.regimen, null);
  assert.strictEqual(r.motivo, 'cliente_no_reconocido: (no se leyo)');
});

// CAMBIO 3 (2026-08-11): el cliente viene del EMISOR del documento, nunca de la
// ficha. El caso cierre-v1 "FORBA" (misread de FORESA) se TRASLADA: el fail-loud
// del cliente no reconocido ahora sale del emisor del DOCUMENTO, no del
// nombre_carga de la ficha. El cambio es intencional -- la ficha ya nos fallo
// (matricula y cliente=lugar de carga), no se la usa como fuente de cliente.
test('cierre-v1 (CAMBIO 3): documento con emisor no reconocido ("FORBA") -> REVISAR con el emisor visible', () => {
  const h = hoja({ tractora: '9999FRB' }, [bloque({
    nombre_carga: 'FORBA', lugar_carga: 'CALDAS', lugar_descarga: 'ORENSE',
    cantidad_kg: 22540, km_inicio: 100000, km_final: 100183, km_recorridos: 183,
  })]);
  const d = albaran({ matricula_tractor: '9999FRB', emisor: 'FORBA', cliente_probable: null,
    origen: 'CALDAS', destino: 'ORENSE', kg_neto: 22540, referencia: '2009901' });
  const res = correr([h], [d]);
  const v = res.viajes[0];
  assert.strictEqual(v.regimen_indexacion, null, 'cliente no reconocido -> sin regimen (no en silencio)');
  assert.strictEqual(v.estado_lectura, 'REVISAR');
  assert.match(v.motivo_revision, /emisor FORBA no resuelto a cliente conocido/);
});

test('cierre-v1 (CAMBIO 3): un misread de cliente en la FICHA no se usa; sin documento es PENDIENTE_DOCUMENTACION, no cliente_no_reconocido', () => {
  const h = hoja({ tractora: '9999FRB' }, [bloque({
    nombre_carga: 'FORBA', lugar_carga: 'CALDAS', lugar_descarga: 'ORENSE',
    cantidad_kg: 22540, km_inicio: 100000, km_final: 100183, km_recorridos: 183,
  })]);
  const res = correr([h], []);
  const v = res.viajes[0];
  assert.strictEqual(v.cliente, null, 'la ficha (nombre_carga="FORBA") NO es fuente de cliente');
  assert.strictEqual(v.estado, 'PENDIENTE_DOCUMENTACION', 'falta el documento');
  assert.ok(!/cliente_no_reconocido|FORBA/.test(v.motivo_revision || ''),
    'sin documento no es cliente_no_reconocido: es falta de documento (eje distinto)');
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

  // CAMBIO 3 (2026-08-11): el cliente (y por ende el regimen) sale del documento,
  // no de la ficha. Antes este caso resolvia QUIMIDROGA desde nombre_carga sin
  // papel; ahora se le da su orden de transporte (emisor Quimidroga) para probar
  // el ruteo de regimen "linea" del caso general.
  const hGen = hoja({ tractora: '3333CCC' }, [bloque({ nombre_carga: 'QUIMIDROGA', lugar_carga: 'BARCELONA', lugar_descarga: 'LEIRIA', cantidad_kg: 23820, km_inicio: 5000, km_final: 5100, km_recorridos: 100 })]);
  const dGen = albaran({ matricula_tractor: '3333CCC', tipo_doc: 'orden_transporte', emisor: 'Quimidroga', cliente_probable: 'QUIMIDROGA', origen: 'BARCELONA', destino: 'LEIRIA', kg_neto: 23820, referencia: '706100' });
  const resGen = correr([hGen], [dGen]);
  assert.strictEqual(resGen.viajes[0].cliente, 'QUIMIDROGA');
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

// ============================================================================
// CAMBIO 2 (2026-08-11) — kg del documento de PESO, NUNCA de la orden (D-01).
// La orden es doc de planificacion (kg pedido/nominal). El caso real: la orden
// Quimidroga traia 24000 y el albaran/recepcion 24400; el sistema facturaba
// 24000. Ahora la orden se excluye como fuente de kg.
// ============================================================================
test('CAMBIO 2: orden 24000 + albaran 24400 -> se factura 24400 (kg del documento de peso, no de la orden)', () => {
  const h = hoja({ tractora: '7777KGX' }, [bloque({ nombre_carga: 'QUIMIDROGA', lugar_carga: 'BARCELONA', lugar_descarga: 'MORALEJA', cantidad_kg: 24400, km_inicio: 1000, km_final: 1100, km_recorridos: 100 })]);
  const dOrden = albaran({ matricula_tractor: '7777KGX', tipo_doc: 'orden_transporte', emisor: 'Quimidroga', cliente_probable: 'QUIMIDROGA', kg_neto: 24000, referencia: '706013', origen: 'BARCELONA', destino: 'MORALEJA' });
  const dPeso = albaran({ pagina: 3, matricula_tractor: '7777KGX', tipo_doc: 'albaran', emisor: null, cliente_probable: null, kg_neto: 24400, referencia: '624300', origen: 'BARCELONA', destino: 'MORALEJA' });
  const v = correr([h], [dOrden, dPeso]).viajes[0];
  assert.strictEqual(v.kg_documento, 24400, 'gana el documento de peso, no la orden (24000)');
  assert.notStrictEqual(v.fuente_peso, 'orden_transporte');
});

test('CAMBIO 2: si el UNICO kg viene de la orden -> no se factura, REVISAR (falta documento de peso)', () => {
  const h = hoja({ tractora: '7777KGX' }, [bloque({ nombre_carga: 'QUIMIDROGA', lugar_carga: 'BARCELONA', lugar_descarga: 'MORALEJA', cantidad_kg: 24000, km_inicio: 1000, km_final: 1100, km_recorridos: 100 })]);
  const dOrden = albaran({ matricula_tractor: '7777KGX', tipo_doc: 'orden_transporte', emisor: 'Quimidroga', cliente_probable: 'QUIMIDROGA', kg_neto: 24000, referencia: '706013', origen: 'BARCELONA', destino: 'MORALEJA' });
  const v = correr([h], [dOrden]).viajes[0];
  assert.strictEqual(v.kg_documento, null, 'no hace fallback al kg de la orden');
  assert.strictEqual(v.estado_lectura, 'REVISAR');
  assert.match(v.motivo_revision, /solo la orden trae kg|falta documento de peso/);
});

test('CAMBIO 2: kg con decimal de tonelada (21350) se preserva exacto (no se redondea a miles)', () => {
  const h = hoja({ tractora: '7777KGX' }, [bloque({ nombre_carga: 'FORESA', lugar_carga: 'CALDAS', lugar_descarga: 'CELLA', cantidad_kg: 21350, km_inicio: 1000, km_final: 1100, km_recorridos: 100 })]);
  const d = albaran({ matricula_tractor: '7777KGX', tipo_doc: 'albaran', cliente_probable: 'FORESA', kg_neto: 21350, referencia: '2001234', origen: 'CALDAS', destino: 'CELLA' });
  assert.strictEqual(correr([h], [d]).viajes[0].kg_documento, 21350, 'valor exacto, no 21000');
});

// ============================================================================
// CAMBIO 2 refinamiento (2026-08-13) — peso ORIGEN > DESTINO (§4, D-01).
// Refinamiento confirmado con cliente: cuando hay peso de carga (origen) y de
// descarga (destino) y difieren, manda el de ORIGEN. La ficha aporta SOLO EL
// ROL del documento (via emisor<->nombre_carga/nombre_descarga), NUNCA el kg:
// el kg sale del documento. Salvaguarda dura: rol indeterminado + pesos que
// difieren -> no se factura, REVISAR (no se adivina cual es la carga).
// POR QUE estos tests: sin el refinamiento el sistema facturaba el primer peso
// que encontraba (a veces el de descarga, con merma), una incorreccion de
// facturacion silenciosa. El rol lo fija la ficha; el numero, el documento.
// ============================================================================
test('§4 origen>destino: peso de carga (origen) y de descarga difieren -> se factura el de ORIGEN', () => {
  const h = hoja({ tractora: '4444ODS' }, [bloque({
    nombre_carga: 'QUIMIDROGA', nombre_descarga: 'RELISA', lugar_carga: 'BARCELONA', lugar_descarga: 'MORALEJA',
    cantidad_kg: 24000, km_inicio: 1000, km_final: 1100, km_recorridos: 100,
  })]);
  // emisor=nombre_carga -> ORIGEN; emisor=nombre_descarga -> DESTINO. Difieren 400 kg.
  const dOrigen = albaran({ matricula_tractor: '4444ODS', tipo_doc: 'albaran', emisor: 'QUIMIDROGA', cliente_probable: 'QUIMIDROGA', kg_neto: 24000, referencia: 'ORI-1', origen: 'BARCELONA', destino: 'MORALEJA' });
  const dDestino = albaran({ pagina: 3, matricula_tractor: '4444ODS', tipo_doc: 'albaran', emisor: 'RELISA', cliente_probable: null, kg_neto: 23600, referencia: 'DES-1', origen: 'BARCELONA', destino: 'MORALEJA' });
  const res = correr([h], [dOrigen, dDestino]);
  const v = res.viajes[0];
  assert.strictEqual(v.kg_documento, 24000, 'manda el peso de carga (origen), no el de descarga (23600)');
  assert.ok(res.avisos.some(a => /peso origen 24000 kg manda sobre descarga 23600/.test(a)), 'se avisa que origen mando sobre descarga');
});

test('§4 solo descarga: sin doc de origen, la descarga es la mejor fuente disponible -> se factura', () => {
  const h = hoja({ tractora: '4445DES' }, [bloque({
    nombre_carga: 'QUIMIDROGA', nombre_descarga: 'RELISA', lugar_carga: 'BARCELONA', lugar_descarga: 'MORALEJA',
    cantidad_kg: 23600, km_inicio: 1000, km_final: 1100, km_recorridos: 100,
  })]);
  const dDestino = albaran({ matricula_tractor: '4445DES', tipo_doc: 'albaran', emisor: 'RELISA', cliente_probable: 'RELISA', kg_neto: 23600, referencia: 'DES-2', origen: 'BARCELONA', destino: 'MORALEJA' });
  const v = correr([h], [dDestino]).viajes[0];
  assert.strictEqual(v.kg_documento, 23600, 'sin origen, se usa la descarga (precedencia origen>descarga>orden)');
});

test('§4 salvaguarda dura: dos pesos de rol INDETERMINADO que difieren -> no se factura, REVISAR', () => {
  const h = hoja({ tractora: '4446INC' }, [bloque({
    nombre_carga: 'FORESA', lugar_carga: 'CALDAS', lugar_descarga: 'ORENSE',
    cantidad_kg: 24000, km_inicio: 1000, km_final: 1100, km_recorridos: 100,
  })]);
  // Ambos sin emisor -> rol incierto; kg difieren 400 (>100). No se adivina.
  const dA = albaran({ matricula_tractor: '4446INC', emisor: null, kg_neto: 24000, referencia: 'INC-1', origen: 'CALDAS', destino: 'ORENSE' });
  const dB = albaran({ pagina: 3, matricula_tractor: '4446INC', emisor: null, kg_neto: 24400, referencia: 'INC-2', origen: 'CALDAS', destino: 'ORENSE' });
  const v = correr([h], [dA, dB]).viajes[0];
  assert.strictEqual(v.kg_documento, null, 'no se factura un peso de rol incierto entre pesos que difieren');
  assert.strictEqual(v.estado_lectura, 'REVISAR');
  assert.match(v.motivo_revision, /rol indeterminado que difieren/);
});

test('§4 rol incierto pero pesos COINCIDEN -> no hay nada que adivinar, se factura', () => {
  const h = hoja({ tractora: '4447COI' }, [bloque({
    nombre_carga: 'FORESA', lugar_carga: 'CALDAS', lugar_descarga: 'ORENSE',
    cantidad_kg: 24000, km_inicio: 1000, km_final: 1100, km_recorridos: 100,
  })]);
  // Rol incierto (sin emisor) pero kg dentro de tolerancia (20 kg): no hay conflicto.
  const dA = albaran({ matricula_tractor: '4447COI', emisor: null, kg_neto: 24000, referencia: 'COI-1', origen: 'CALDAS', destino: 'ORENSE' });
  const dB = albaran({ pagina: 3, matricula_tractor: '4447COI', emisor: null, kg_neto: 24020, referencia: 'COI-2', origen: 'CALDAS', destino: 'ORENSE' });
  const v = correr([h], [dA, dB]).viajes[0];
  assert.strictEqual(v.kg_documento, 24000, 'un solo criterio de peso (coinciden): se factura sin marca de rol');
  assert.ok(!/rol indeterminado/.test(v.motivo_revision || ''), 'no se marca por rol cuando los pesos coinciden');
});
