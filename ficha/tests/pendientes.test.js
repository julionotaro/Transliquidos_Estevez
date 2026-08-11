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
  assert.match(html, /action="https:\/\/studio-julio\.duckdns\.org\/webhook\/viajes-accion"/);
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

// ============================================================================
// CAMBIO 2 — tabla editable, "!" por celda, faltante prominente, confirmar
// ============================================================================
function viajeReal(campos) {
  return viajeBase(Object.assign({
    estado: 'con_documentacion', estado_lectura: 'REVISAR', motivo_revision: 'algo a revisar',
    tractora: '2498KZL', semi: 'R1007BCV', material: 'Tobera', referencia: '2002854',
    fecha: '2026-07-07', fecha_descarga: '2026-07-08', kg_documento: 23140, kg_hoja: 23000,
    regimen_indexacion: 'linea', km_cargados: 800, km_vacios: 120
  }, campos));
}

test('CAMBIO 2: la tabla trae las columnas reales (no codigos Gesruta) + Dieta + Estado carga + Confirmar', () => {
  const html = renderHTML(filtrarPendientes([viajeReal({})]));
  ['Matricula tractora', 'Remolque', 'Chofer', 'Cliente', 'Origen', 'Destino',
   'Material', 'Referencia', 'Fecha de carga', 'Fecha de descarga', 'Cantidad',
   'Regimen indexacion', 'Km cargado', 'Km vacio', 'Dieta', 'Estado carga'].forEach(t => {
    assert.ok(html.indexOf('>' + t + '<') >= 0, 'columna ' + t);
  });
  assert.match(html, /name="accion" value="confirmar"/);
  // no debe existir columna de codigo Gesruta
  assert.ok(html.indexOf('Cod ') === -1 && html.indexOf('cod_') === -1, 'no hay codigos Gesruta');
});

test('CAMBIO 2 (a): matricula tractora invalida -> celda con "!" y form corregir_celda campo=tractora', () => {
  const html = renderHTML(filtrarPendientes([viajeReal({ tractora: 'AVEIRO' })]));
  assert.match(html, /class="warn"/);
  assert.match(html, /name="campo" value="tractora"/);
  assert.match(html, /name="accion" value="corregir_celda"/);
});

test('CAMBIO 2 (b): fecha descarga < carga -> ambas celdas de fecha marcadas', () => {
  const p = filtrarPendientes([viajeReal({ fecha: '2026-07-07', fecha_descarga: '2026-07-05' })])[0];
  assert.ok(p.marcas.fecha && p.marcas.fecha_descarga, 'ambas fechas marcadas en el modelo de fila');
});

test('CAMBIO 2 (c): cantidad 0 -> celda cantidad marcada; sin doc alguno, la correccion apunta a kg_hoja', () => {
  // kg_documento=0 esta PRESENTE (es el 0 malo que se ve): corregir apunta ahi.
  const conDoc = filtrarPendientes([viajeReal({ kg_documento: 0, kg_hoja: null })])[0];
  assert.ok(conDoc.marcas.cantidad, 'cantidad 0 marcada');
  assert.strictEqual(conDoc.cantidad_campo, 'kg_documento', 'el 0 vive en kg_documento; se corrige ahi');
  // sin kg_documento (null), la cantidad y su correccion caen en kg_hoja
  const sinDoc = filtrarPendientes([viajeReal({ kg_documento: null, kg_hoja: null })])[0];
  assert.ok(sinDoc.marcas.cantidad, 'cantidad ausente marcada');
  assert.strictEqual(sinDoc.cantidad_campo, 'kg_hoja');
});

test('CAMBIO 2: faltante de documentacion se muestra PROMINENTE (FALTA DOC + que falta + a quien)', () => {
  const v = viajeReal({ estado: 'PENDIENTE_DOCUMENTACION', estado_lectura: 'OK',
    pendiente_falta: 'albaran/CMR', pendiente_reclamar_a: 'chofer' });
  const html = renderHTML(filtrarPendientes([v]));
  assert.match(html, /FALTA DOC/);
  assert.match(html, /albaran\/CMR/);
  assert.match(html, /chofer/);
});

test('CAMBIO 2 (D conservador): REVISAR se muestra a nivel fila (motivo como observacion), NO atribuido a una celda', () => {
  const v = viajeReal({ estado_lectura: 'REVISAR', motivo_revision: 'cliente_no_reconocido: FORBA (origen dudoso)' });
  const p = filtrarPendientes([v])[0];
  // no hay marca de forma sobre origen (no se inventa atribucion por celda)
  assert.strictEqual(p.marcas.origen, undefined);
  const html = renderHTML([p]);
  assert.match(html, /REVISAR: cliente_no_reconocido: FORBA/);
});

test('CAMBIO 2: cliente NO se edita por celda (va por la barra, verbo corregir que revalida)', () => {
  const html = renderHTML(filtrarPendientes([viajeReal({})]));
  assert.ok(html.indexOf('name="campo" value="cliente"') === -1, 'ninguna celda corrige cliente por corregir_celda');
  assert.match(html, /name="accion" value="corregir"/, 'cliente se corrige por el verbo corregir en la barra');
});

test('CAMBIO 2: dieta leida del JSON detalle se muestra', () => {
  const v = viajeReal({ detalle: JSON.stringify({ gastos: [{ tipo: 'dieta', importe: 45 }] }) });
  const p = filtrarPendientes([v])[0];
  assert.strictEqual(p.dieta, 45);
});

// ============================================================================
// CAMBIO 1 (correcciones-url) — la URL de accion debe ser ABSOLUTA
// (relativa da DNS_PROBE_FINISHED_NXDOMAIN y no guarda nada). Guard de regresion.
// ============================================================================
test('CAMBIO 1: las acciones postean a la URL ABSOLUTA (no relativa)', () => {
  const html = renderHTML(filtrarPendientes([viajeReal({})]));
  // todas las acciones apuntan a la URL absoluta
  assert.match(html, /action="https:\/\/studio-julio\.duckdns\.org\/webhook\/viajes-accion"/);
  // y NINGUNA usa ruta relativa (raiz-relativa o path-relativa)
  assert.ok(!/action="\/webhook\/viajes-accion"/.test(html), 'no debe quedar action raiz-relativa');
  assert.ok(!/action="webhook\/viajes-accion"/.test(html), 'no debe quedar action path-relativa');
});
