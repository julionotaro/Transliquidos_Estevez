// Tests v1.1 pieza 2 — render HTML de la planilla (resaltado de auditoria).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { armarFila, armarFilas, renderHTML, COLUMNAS } = require('../planilla.js');

function viajeBase(campos) {
  return Object.assign({
    id: 1, empresa: 'TLE', orden: 1, cliente: 'FORESA', origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL',
    material: 'Tobera Res 0541', referencia: '2002854', tractora: '2498KZL', semi: 'R1007BCV',
    conductor: 'Asensi', kg_documento: 23140, fecha: '2026-07-07',
    estado: 'con_documentacion', estado_lectura: 'OK', motivo_revision: '',
    regimen_indexacion: 'linea', pais_facturacion: 'ES'
  }, campos);
}

// `cliente` = razon social exacta (post-recarga Excel); el viaje trae "FORESA".
const TARIFAS = [
  { cliente: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.', origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL', material: '', tarifa_tn: '56.0', precio_fijo: '', vigente_desde: '2026-01-01', id: 274 },
];
const INDEXACION = [
  { cliente: '', tipo: 'FORESA-BRESFOR', pct: '0.1064', desde: '2026-07-01', hasta: '2026-07-15', id: 12 },
];

test('planilla html: lista vacia -> mensaje claro, no tabla rota', () => {
  const html = renderHTML([]);
  assert.match(html, /No hay viajes para mostrar/);
  assert.doesNotThrow(() => renderHTML(null));
  assert.doesNotThrow(() => renderHTML(undefined));
});

test('planilla html: headers en el mismo orden que COLUMNAS', () => {
  const html = renderHTML([]);
  const idxs = COLUMNAS.map(c => html.indexOf('<th>' + c.titulo.replace(/&/g, '&amp;')));
  for (let i = 1; i < idxs.length; i++) {
    assert.ok(idxs[i] > idxs[i - 1], 'columna "' + COLUMNAS[i].titulo + '" debe aparecer despues de "' + COLUMNAS[i - 1].titulo + '"');
  }
});

test('planilla html: viaje con REVISAR se muestra resaltado (no oculto)', () => {
  const fila = armarFila(viajeBase({ estado_lectura: 'REVISAR', motivo_revision: 'cliente_no_reconocido: FORBA' }), TARIFAS, INDEXACION);
  const html = renderHTML([fila]);
  assert.match(html, /class="resaltada"/);
  assert.match(html, /REVISAR: cliente_no_reconocido/);
  assert.match(html, /FORESA/, 'la fila sigue mostrando todos sus datos, no se oculta');
});

test('planilla html: viaje PENDIENTE_DOCUMENTACION se muestra resaltado', () => {
  const fila = armarFila(viajeBase({ estado: 'PENDIENTE_DOCUMENTACION' }), TARIFAS, INDEXACION);
  const html = renderHTML([fila]);
  assert.match(html, /class="resaltada"/);
  assert.match(html, /PENDIENTE_DOCUMENTACION/);
});

test('planilla html: viaje SIN_TARIFA se muestra resaltado', () => {
  const fila = armarFila(viajeBase({ origen: 'CALDAS', destino: 'ORENSE' }), TARIFAS, INDEXACION);
  const html = renderHTML([fila]);
  assert.match(html, /class="resaltada"/);
  assert.match(html, /SIN_TARIFA/);
});

test('planilla html: los tres estados (REVISAR, PENDIENTE_DOCUMENTACION, SIN_TARIFA) resaltan en la misma corrida', () => {
  const filas = armarFilas([
    viajeBase({ id: 1, estado_lectura: 'REVISAR', motivo_revision: 'x' }),
    viajeBase({ id: 2, estado: 'PENDIENTE_DOCUMENTACION' }),
    viajeBase({ id: 3, origen: 'CALDAS', destino: 'ORENSE' }),
    viajeBase({ id: 4 }), // normal, no resalta
  ], TARIFAS, INDEXACION);
  const html = renderHTML(filas);
  const resaltadas = (html.match(/class="resaltada"/g) || []).length;
  assert.strictEqual(resaltadas, 3);
});

test('planilla html: viaje normal NO se resalta', () => {
  const fila = armarFila(viajeBase(), TARIFAS, INDEXACION);
  const html = renderHTML([fila]);
  assert.doesNotMatch(html, /class="resaltada"/);
});

test('planilla html: escapa contenido (material con caracteres especiales no rompe el markup)', () => {
  const fila = armarFila(viajeBase({ material: '<script>&"malicioso"' }), TARIFAS, INDEXACION);
  const html = renderHTML([fila]);
  assert.ok(!html.includes('<script>&"malicioso"'), 'no debe inyectar HTML sin escapar');
  assert.ok(html.includes('&lt;script&gt;'));
});

test('planilla html: no llama a ningun CDN (assets locales, VPS los bloquea)', () => {
  const html = renderHTML([armarFila(viajeBase(), TARIFAS, INDEXACION)]);
  assert.doesNotMatch(html, /https?:\/\//, 'la pagina no debe referenciar ninguna URL externa');
  assert.doesNotMatch(html, /cdn\./i);
});
