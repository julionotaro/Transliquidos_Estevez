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
