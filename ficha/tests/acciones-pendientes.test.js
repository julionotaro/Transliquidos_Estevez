// Tests v1.1, pieza 1 — acciones de correccion sobre pendientes.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const acciones = require('../acciones-pendientes.js');
const { esPendiente } = require('../pendientes.js');

function viajeBase(campos) {
  return Object.assign({
    id: 1, cliente: 'FORBA', origen: 'CALDAS', destino: 'ORENSE',
    estado: 'PENDIENTE_DOCUMENTACION', estado_lectura: 'REVISAR',
    motivo_revision: 'cliente_no_reconocido: FORBA',
    pendiente_falta: 'documentos del viaje (albaran/CMR/carta de porte)',
    pendiente_reclamar_a: 'chofer / cliente cargador',
    historial_correcciones: null
  }, campos);
}

test('v1.1 corregir: FORBA->FORESA en Caldas->Orense -> agregada_quincenal, sale de REVISAR, registro con valor anterior', () => {
  const v = viajeBase({});
  const r = acciones.aplicarCorregir(v, 'cliente', 'FORESA', 'julio');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.cambios.cliente, 'FORESA');
  assert.strictEqual(r.cambios.regimen_indexacion, 'agregada_quincenal');
  assert.strictEqual(r.cambios.estado_lectura, 'OK', 'sale de REVISAR: no quedan mas motivos');
  assert.strictEqual(r.cambios.motivo_revision, '');
  const hist = JSON.parse(r.cambios.historial_correcciones);
  assert.strictEqual(hist.length, 1);
  assert.strictEqual(hist[0].accion, 'corregir');
  assert.strictEqual(hist[0].usuario, 'julio');
  assert.strictEqual(hist[0].campo, 'cliente');
  assert.strictEqual(hist[0].valor_anterior, 'FORBA');
  assert.strictEqual(hist[0].valor_nuevo, 'FORESA');
  assert.ok(hist[0].fecha, 'fecha registrada');
});

test('v1.1 corregir: si el viaje tenia OTROS motivos de REVISAR, sigue en REVISAR (solo se quita el de cliente)', () => {
  const v = viajeBase({ motivo_revision: 'cliente_no_reconocido: FORBA; km cargados no positivos (100 -> 50)' });
  const r = acciones.aplicarCorregir(v, 'cliente', 'FORESA', 'julio');
  assert.strictEqual(r.cambios.estado_lectura, 'REVISAR', 'queda el motivo de km, no relacionado al cliente');
  assert.match(r.cambios.motivo_revision, /km cargados no positivos/);
  assert.doesNotMatch(r.cambios.motivo_revision, /cliente_no_reconocido/);
});

test('v1.1 corregir: campo no corregible se rechaza sin tocar nada', () => {
  const v = viajeBase({});
  const r = acciones.aplicarCorregir(v, 'kg_documento', '99999', 'julio');
  assert.strictEqual(r.ok, false);
  assert.match(r.motivo, /campo_no_corregible/);
});

test('v1.1 resolver: marcar resuelto un PENDIENTE_DOCUMENTACION -> sale de la lista, queda registro', () => {
  // estado_lectura OK: este viaje solo esta pendiente por documentacion, no por
  // lectura dudosa -- asi "sale de la lista" se demuestra sobre el eje que
  // resolver() realmente toca.
  const v = viajeBase({ estado_lectura: 'OK', motivo_revision: '' });
  assert.strictEqual(esPendiente(v), true, 'precondicion: estaba pendiente');
  const r = acciones.aplicarResolver(v, 'oficina');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.cambios.estado, 'RESUELTO_MANUAL');
  assert.strictEqual(r.cambios.pendiente_falta, null);
  const vResuelto = Object.assign({}, v, r.cambios);
  assert.strictEqual(esPendiente(vResuelto), false, 'ya no aparece en pendientes (via estado_lectura tampoco -- ojo, sigue REVISAR)');
  const hist = JSON.parse(r.cambios.historial_correcciones);
  assert.strictEqual(hist.length, 1);
  assert.strictEqual(hist[0].accion, 'resolver');
  assert.strictEqual(hist[0].valor_anterior, 'PENDIENTE_DOCUMENTACION');
  assert.strictEqual(hist[0].valor_nuevo, 'RESUELTO_MANUAL');
});

test('v1.1 incidencia: el viaje permanece, la nota se ve, queda registro', () => {
  const v = viajeBase({});
  const r = acciones.aplicarIncidencia(v, 'Cliente confirmo por telefono que el albaran llega manana', 'oficina');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.cambios.estado, undefined, 'no se toca estado');
  assert.strictEqual(r.cambios.estado_lectura, undefined, 'no se toca estado_lectura');
  const vConNota = Object.assign({}, v, r.cambios);
  assert.strictEqual(esPendiente(vConNota), true, 'sigue en la lista');
  const notas = acciones.incidenciasDe(vConNota.historial_correcciones);
  assert.strictEqual(notas.length, 1);
  assert.match(notas[0], /albaran llega manana/);
});

test('v1.1 incidencia: texto vacio se rechaza', () => {
  const v = viajeBase({});
  const r = acciones.aplicarIncidencia(v, '   ', 'oficina');
  assert.strictEqual(r.ok, false);
});

test('v1.1 historial acumula: dos correcciones sobre el mismo viaje -> dos entradas', () => {
  const v = viajeBase({});
  const r1 = acciones.aplicarIncidencia(v, 'primera nota', 'julio');
  const v2 = Object.assign({}, v, r1.cambios);
  const r2 = acciones.aplicarCorregir(v2, 'cliente', 'FORESA', 'julio');
  const histFinal = JSON.parse(r2.cambios.historial_correcciones);
  assert.strictEqual(histFinal.length, 2, 'append, nunca overwrite');
  assert.strictEqual(histFinal[0].accion, 'incidencia');
  assert.strictEqual(histFinal[1].accion, 'corregir');
});

// ============================================================================
// CAMBIO 2/3 — correccion de celda SIN revalidar + tabla correcciones
// ============================================================================
test('CAMBIO 3 corregir_celda: Aveira->Aveiro escribe la celda y produce UNA fila de correccion con el original', () => {
  const v = viajeBase({ id: 7, origen: 'Aveira', estado_lectura: 'OK', motivo_revision: '' });
  const r = acciones.aplicarCorregirCelda(v, 'origen', 'Aveiro', 'julio', 'origen dudoso');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.cambios.origen, 'Aveiro', 'viajes.origen queda con el valor corregido');
  assert.ok(r.correccion, 'produce fila para tabla correcciones');
  assert.strictEqual(r.correccion.viaje_id, '7');
  assert.strictEqual(r.correccion.campo, 'origen');
  assert.strictEqual(r.correccion.valor_original, 'Aveira', 'el original se preserva');
  assert.strictEqual(r.correccion.valor_corregido, 'Aveiro');
  assert.strictEqual(r.correccion.motivo_original, 'origen dudoso');
  assert.strictEqual(r.correccion.editado_por, 'julio');
  assert.ok(r.correccion.editado_en, 'timestamp ISO');
});

test('CAMBIO 3 corregir_celda: NO revalida (no toca estado_lectura ni motivo_revision)', () => {
  const v = viajeBase({ id: 7, origen: 'Aveira', estado_lectura: 'REVISAR', motivo_revision: 'km cargados no positivos' });
  const r = acciones.aplicarCorregirCelda(v, 'origen', 'Avero', 'julio'); // valor fuera de catalogo: se acepta igual
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.cambios.origen, 'Avero', 'valor humano aceptado como verdad, sin re-chequear catalogo');
  assert.strictEqual(r.cambios.estado_lectura, undefined, 'no revalida estado_lectura');
  assert.strictEqual(r.cambios.motivo_revision, undefined, 'no revalida motivo_revision');
});

test('CAMBIO 3 corregir_celda: dos campos de la misma fila -> dos filas de correccion (dos llamadas)', () => {
  const v = viajeBase({ id: 8, origen: 'Aveira', destino: 'Terel' });
  const r1 = acciones.aplicarCorregirCelda(v, 'origen', 'Aveiro', 'julio');
  const v2 = Object.assign({}, v, r1.cambios);
  const r2 = acciones.aplicarCorregirCelda(v2, 'destino', 'Teruel', 'julio');
  assert.ok(r1.correccion && r2.correccion);
  assert.strictEqual(r1.correccion.campo, 'origen');
  assert.strictEqual(r2.correccion.campo, 'destino');
  assert.strictEqual(r2.correccion.valor_original, 'Terel');
  const hist = JSON.parse(r2.cambios.historial_correcciones);
  assert.strictEqual(hist.length, 2, 'historial acumula ambas');
});

test('CAMBIO 3 corregir_celda: campo numerico se coerce (km_vacios)', () => {
  const v = viajeBase({ id: 9, km_vacios: 120 });
  const r = acciones.aplicarCorregirCelda(v, 'km_vacios', '135', 'julio');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.cambios.km_vacios, 135);
  assert.strictEqual(typeof r.cambios.km_vacios, 'number');
});

test('CAMBIO 3 corregir_celda: cliente NO se corrige por aca (va por corregir, que revalida)', () => {
  const v = viajeBase({ id: 10, cliente: 'FORBA' });
  const r = acciones.aplicarCorregirCelda(v, 'cliente', 'FORESA', 'julio');
  assert.strictEqual(r.ok, false);
  assert.match(r.motivo, /cliente_no_se_corrige_por_celda/);
});

test('CAMBIO 3 corregir_celda: campo desconocido se rechaza', () => {
  const v = viajeBase({ id: 11 });
  const r = acciones.aplicarCorregirCelda(v, 'factura_id', 'X', 'julio');
  assert.strictEqual(r.ok, false);
  assert.match(r.motivo, /campo_no_corregible_por_celda/);
});

test('CAMBIO 3 confirmar: estado_carga pendiente_revision -> confirmada; nunca cargada_gesruta', () => {
  const v = viajeBase({ id: 12, estado_carga: 'pendiente_revision' });
  const r = acciones.aplicarConfirmar(v, 'julio');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.cambios.estado_carga, 'confirmada');
  assert.notStrictEqual(r.cambios.estado_carga, 'cargada_gesruta');
  const hist = JSON.parse(r.cambios.historial_correcciones);
  assert.strictEqual(hist[hist.length - 1].accion, 'confirmar');
});

test('CAMBIO cliente->correcciones: aplicarCorregir(cliente) tambien produce fila de correccion con el original preservado', () => {
  const v = viajeBase({ id: 20, cliente: null, motivo_revision: 'emisor BALTRANSA no resuelto a cliente conocido' });
  const r = acciones.aplicarCorregir(v, 'cliente', 'BALTRANSA', 'julio');
  assert.strictEqual(r.ok, true);
  assert.ok(r.correccion, 'la correccion de cliente ahora va a la tabla correcciones');
  assert.strictEqual(r.correccion.viaje_id, '20');
  assert.strictEqual(r.correccion.campo, 'cliente');
  assert.strictEqual(r.correccion.valor_original, '', 'cliente era null -> original vacio');
  assert.strictEqual(r.correccion.valor_corregido, 'BALTRANSA');
  assert.match(r.correccion.motivo_original, /emisor BALTRANSA/);
  assert.strictEqual(r.correccion.editado_por, 'julio');
});
