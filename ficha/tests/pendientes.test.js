// Tests Cierre v1, pieza 2 — vista de pendientes.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { filtrarPendientes, renderHTML, diasEsperando, esPendiente } = require('../pendientes.js');

function viajeBase(campos) {
  return Object.assign({
    id: 1, fecha: '2026-07-13', conductor: 'Asensi', cliente: 'FORESA',
    origen: 'CALDAS', destino: 'ORENSE',
    estado: 'con_documentacion', estado_lectura: 'OK', motivo_revision: '',
    pendiente_falta: null, pendiente_reclamar_a: null,
    createdAt: '2026-08-02T12:00:00.000Z'
  }, campos);
}

test('cierre-v1 pendientes: viaje PENDIENTE_DOCUMENTACION aparece con su falta y a quien reclamar', () => {
  const v = viajeBase({
    estado: 'PENDIENTE_DOCUMENTACION',
    pendiente_falta: 'documentos del viaje (albaran/CMR/carta de porte)',
    pendiente_reclamar_a: 'chofer / cliente cargador'
  });
  const out = filtrarPendientes([v]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].que_falta, 'documentos del viaje (albaran/CMR/carta de porte)');
  assert.strictEqual(out[0].reclamar_a, 'chofer / cliente cargador');
});

test('cierre-v1 pendientes: viaje REVISAR por cliente_no_reconocido aparece con el valor leido visible', () => {
  const v = viajeBase({
    estado: 'con_documentacion', // tiene documentos, no es eso lo que falla
    estado_lectura: 'REVISAR',
    motivo_revision: 'cliente_no_reconocido: FORBA'
  });
  const out = filtrarPendientes([v]);
  assert.strictEqual(out.length, 1);
  assert.match(out[0].motivo_revision, /cliente_no_reconocido: FORBA/);
  assert.strictEqual(out[0].que_falta, null, 'este viaje no tiene documentacion pendiente, solo lectura dudosa');
});

test('cierre-v1 pendientes: los dias esperando se calculan bien', () => {
  const ahora = Date.parse('2026-08-05T12:00:00.000Z');
  assert.strictEqual(diasEsperando('2026-08-02T12:00:00.000Z', ahora), 3);
  assert.strictEqual(diasEsperando('2026-08-05T11:00:00.000Z', ahora), 0, 'menos de un dia -> 0, no negativo');
  assert.strictEqual(diasEsperando(null, ahora), null);
  const v = viajeBase({ estado: 'PENDIENTE_DOCUMENTACION', createdAt: '2026-07-20T12:00:00.000Z' });
  const out = filtrarPendientes([v], ahora);
  assert.strictEqual(out[0].dias_esperando, 16);
});

test('cierre-v1 pendientes: un viaje completo y OK NO aparece', () => {
  const v = viajeBase({ estado: 'con_documentacion', estado_lectura: 'OK' });
  assert.strictEqual(esPendiente(v), false);
  const out = filtrarPendientes([v]);
  assert.strictEqual(out.length, 0);
});

test('cierre-v1 pendientes: lista vacia no rompe -> mensaje claro, no error', () => {
  const out = filtrarPendientes([]);
  assert.strictEqual(out.length, 0);
  const html = renderHTML(out);
  assert.match(html, /No hay viajes pendientes ni en revision/);
  assert.doesNotThrow(() => renderHTML(null));
  assert.doesNotThrow(() => renderHTML(undefined));
});

test('cierre-v1 pendientes: orden por defecto — dias esperando descendente, mas viejo primero', () => {
  const ahora = Date.parse('2026-08-05T12:00:00.000Z');
  const viejo = viajeBase({ id: 1, estado: 'PENDIENTE_DOCUMENTACION', createdAt: '2026-07-01T12:00:00.000Z' });
  const nuevo = viajeBase({ id: 2, estado: 'PENDIENTE_DOCUMENTACION', createdAt: '2026-08-04T12:00:00.000Z' });
  const out = filtrarPendientes([nuevo, viejo], ahora); // entran en orden inverso al esperado
  assert.strictEqual(out[0].id, 1, 'el mas viejo (mas dias esperando) va primero');
  assert.strictEqual(out[1].id, 2);
});

test('cierre-v1 pendientes: viaje con ambos ejes (pendiente Y revisar) aparece una sola vez', () => {
  const v = viajeBase({
    id: 9, estado: 'PENDIENTE_DOCUMENTACION', pendiente_falta: 'albaran', pendiente_reclamar_a: 'cliente',
    estado_lectura: 'REVISAR', motivo_revision: 'km cargados no positivos'
  });
  const out = filtrarPendientes([v]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].que_falta, 'albaran');
  assert.match(out[0].motivo_revision, /km cargados/);
});

test('cierre-v1 pendientes: HTML escapa contenido (motivo con caracteres especiales no rompe el markup)', () => {
  const v = viajeBase({ estado_lectura: 'REVISAR', motivo_revision: 'cliente_no_reconocido: <script>&"test"' });
  const out = filtrarPendientes([v]);
  const html = renderHTML(out);
  assert.ok(!html.includes('<script>'), 'no debe inyectar HTML sin escapar');
  assert.ok(html.includes('&lt;script&gt;'));
});

// ============================================================================
// v1.1 pieza 1 — acciones en la misma pantalla (render)
// ============================================================================
test('v1.1 render: cada fila trae un form que postea a /webhook/viajes-accion con los 3 botones', () => {
  const v = viajeBase({ id: 42, estado: 'PENDIENTE_DOCUMENTACION' });
  const out = filtrarPendientes([v]);
  const html = renderHTML(out);
  assert.match(html, /action="\/webhook\/viajes-accion"/);
  assert.match(html, /method="post"/);
  assert.match(html, /value="42"/, 'id del viaje va en un campo oculto');
  assert.match(html, /name="accion" value="corregir"/);
  assert.match(html, /name="accion" value="resolver"/);
  assert.match(html, /name="accion" value="incidencia"/);
});

test('v1.1 render: las notas (incidencias) del historial se muestran en la fila', () => {
  const v = viajeBase({
    estado: 'PENDIENTE_DOCUMENTACION',
    historial_correcciones: JSON.stringify([
      { accion: 'incidencia', usuario: 'julio', fecha: '2026-08-03T10:00:00.000Z', campo: null, valor_anterior: null, valor_nuevo: 'Cliente confirmo por telefono' }
    ])
  });
  const out = filtrarPendientes([v]);
  assert.deepStrictEqual(out[0].notas, ['Cliente confirmo por telefono']);
  const html = renderHTML(out);
  assert.match(html, /Cliente confirmo por telefono/);
});
