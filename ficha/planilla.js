// ===== PLANILLA DE CARGA / AUDITORIA (v1.1 pieza 2) =========================
//
// Una sola tabla, dos usos (encargo 2026-08-03): copilot de carga (columnas en
// el orden EXACTO del sistema de escritorio, para transcribir a mano) y
// auditoria de facturacion (mismas filas, resaltando REVISAR /
// PENDIENTE_DOCUMENTACION / SIN_TARIFA / indexacion sin cerrar antes de
// emitir). No son dos vistas: es la MISMA fila con un resaltado superpuesto,
// asi que un solo armarFila() + renderHTML() sirve para ambos usos, igual que
// pendientes.js sirve a la vez de lista y de tablero.
//
// COLUMNAS fija el orden del sistema de escritorio (derivado de la
// exportacion real que aporto Julio, expediente 00050461). Es la UNICA fuente
// de verdad del orden: tanto los headers como cada fila salen de recorrer este
// array, para que "orden de columnas == sistema de escritorio" no pueda
// desincronizarse entre el <thead> y el <tbody>.

'use strict';

var CRUCE_PLAN = (typeof norm === 'function') ? { norm: norm } : require('./cruce.js');
var TARIFAS_PLAN = (typeof buscarTarifa === 'function') ? { buscarTarifa: buscarTarifa } : require('./tarifas.js');
var INDEXACION_PLAN = (typeof indexacionDeFila === 'function')
  ? { indexacionDeFila: indexacionDeFila, deduplicarIndexacion: deduplicarIndexacion }
  : require('./indexacion.js');

var COLUMNAS = [
  { clave: 'empresa', titulo: 'Empresa' },
  { clave: 'numero', titulo: 'Nº' },
  { clave: 'cliente', titulo: 'Cliente' },
  { clave: 'origen', titulo: 'Origen' },
  { clave: 'destino', titulo: 'Destino' },
  { clave: 'material', titulo: 'Carga' },
  { clave: 'referencia', titulo: 'Referencia' },
  { clave: 'cabeza', titulo: 'Cabeza' },
  { clave: 'remolque', titulo: 'Remolque' },
  { clave: 'chofer', titulo: 'Chofer' },
  { clave: 'cantidad_kg', titulo: 'Cantidad (kg)' },
  { clave: 'tarifa', titulo: 'Tarifa' },
  { clave: 'importe', titulo: 'Precio / Importe' },
  { clave: 'pct_indexacion', titulo: '% Indexación' },
  { clave: 'importe_indexacion', titulo: 'Importe indexación' },
  { clave: 'tipo_iva', titulo: 'Tipo IVA' }
];

function round2(n) { return Math.round(n * 100) / 100; }

/** Tipo IVA (encargo: "segun cliente, BALTRANSA y clientes espanoles 21%", D-04). */
function tipoIva(viaje) {
  var cl = CRUCE_PLAN.norm(viaje.cliente);
  if (cl && cl.indexOf('BALTRANSA') >= 0) { return '21%'; }
  if (viaje.pais_facturacion === 'ES') { return '21%'; }
  return viaje.pais_facturacion ? ('0% (' + viaje.pais_facturacion + ')') : null;
}

/**
 * Precio/Importe (D-02): cantidad x tarifa. Tarifa por tonelada usa
 * kg_documento (D-01, NUNCA kg_hoja); tarifa fija por viaje ignora la
 * cantidad. Sin kg_documento y tarifa por tonelada -> null (legitimo: no hay
 * documento cruzado todavia, no es un cero disfrazado).
 */
function calcularImporte(kgDocumento, resultadoTarifa) {
  if (!resultadoTarifa || !resultadoTarifa.tarifa) { return null; }
  if (resultadoTarifa.tarifa.tipo === 'fijo') { return round2(resultadoTarifa.tarifa.valor); }
  if (typeof kgDocumento !== 'number' || !isFinite(kgDocumento)) { return null; }
  return round2((kgDocumento / 1000) * resultadoTarifa.tarifa.valor);
}

function textoTarifa(resultadoTarifa) {
  if (!resultadoTarifa || !resultadoTarifa.tarifa) { return null; }
  var t = resultadoTarifa.tarifa;
  return t.tipo === 'tn' ? (t.valor + ' €/t') : (t.valor + ' €/viaje');
}

/**
 * Arma una fila de la planilla a partir de un viaje real + las tablas Tarifas
 * e Indexacion (Indexacion YA deduplicada -- ver indexacion.js). No muta el
 * viaje de entrada.
 *
 * @returns {object}  claves de COLUMNAS + metadata de auditoria
 *   (fecha_carga, estado, estado_lectura, motivo_revision, resaltar,
 *   motivos_resaltado).
 */
function armarFila(viaje, tarifasRows, indexacionRows) {
  var v = viaje || {};
  var resultadoTarifa = TARIFAS_PLAN.buscarTarifa(v, tarifasRows);
  var importe = calcularImporte(v.kg_documento, resultadoTarifa);
  var idx = INDEXACION_PLAN.indexacionDeFila(v, importe, indexacionRows);

  var motivos = [];
  if (v.estado === 'PENDIENTE_DOCUMENTACION') { motivos.push('PENDIENTE_DOCUMENTACION'); }
  if (v.estado_lectura === 'REVISAR') { motivos.push('REVISAR: ' + (v.motivo_revision || '')); }
  if (resultadoTarifa.estado === 'SIN_TARIFA') { motivos.push('SIN_TARIFA: ' + (resultadoTarifa.motivo || '')); }
  if (idx.modo === 'regimen_pendiente') { motivos.push('indexacion sin cerrar: ' + idx.etiqueta); }

  return {
    id: v.id,
    empresa: v.empresa || null,
    numero: (v.orden === null || v.orden === undefined) ? null : v.orden,
    cliente: v.cliente || null,
    origen: v.origen || null,
    destino: v.destino || null,
    material: v.material || null,
    referencia: (v.referencia === '' || v.referencia === null || v.referencia === undefined) ? null : v.referencia,
    cabeza: v.tractora || null,
    remolque: v.semi || null,
    chofer: v.conductor || null,
    cantidad_kg: (typeof v.kg_documento === 'number') ? v.kg_documento : null,
    tarifa: textoTarifa(resultadoTarifa),
    importe: importe,
    pct_indexacion: idx.etiqueta,
    importe_indexacion: idx.importe,
    tipo_iva: tipoIva(v),
    // metadata de auditoria -- no son columnas del escritorio.
    fecha_carga: v.fecha || null,
    estado: v.estado || null,
    estado_lectura: v.estado_lectura || null,
    tarifa_estado: resultadoTarifa.estado,
    resaltar: motivos.length > 0,
    motivos_resaltado: motivos
  };
}

/** Proyecta una fila a un array de valores en el orden de COLUMNAS (para render y tests de orden). */
function valoresEnOrden(fila) {
  return COLUMNAS.map(function (c) { return fila[c.clave]; });
}

function armarFilas(viajes, tarifasRows, indexacionRowsCrudas) {
  var lista = Array.isArray(viajes) ? viajes : [];
  var indexacionRows = INDEXACION_PLAN.deduplicarIndexacion(indexacionRowsCrudas);
  return lista.map(function (v) { return armarFila(v, tarifasRows, indexacionRows); });
}

// --- HTML minimo: mismo estilo que ficha/pendientes.js (sin framework, sin build) --
function escHtml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function celda(valor) {
  if (valor === null || valor === undefined || valor === '') { return '<td class="vacio">-</td>'; }
  return '<td>' + escHtml(valor) + '</td>';
}

/**
 * Tabla HTML autocontenida. Doble uso en la MISMA tabla (no hay modo copilot
 * vs modo auditoria por separado): todas las columnas del escritorio siempre
 * visibles para transcribir, y las filas con REVISAR / PENDIENTE_DOCUMENTACION
 * / SIN_TARIFA / indexacion sin cerrar SIEMPRE resaltadas (no se ocultan --
 * el objetivo de la auditoria es justamente verlas). El motivo del resaltado
 * va en el atributo title de la fila, visible al pasar el mouse, sin agregar
 * una columna que no esta en el sistema de escritorio.
 *
 * @param {Array<object>} filas  salida de armarFilas().
 */
function renderHTML(filas) {
  var lista = Array.isArray(filas) ? filas : [];
  var nCols = COLUMNAS.length;
  var cuerpo;
  if (lista.length === 0) {
    cuerpo = '<tr><td colspan="' + nCols + '" class="vacio-tabla">No hay viajes para mostrar.</td></tr>';
  } else {
    cuerpo = lista.map(function (f) {
      var claseFila = f.resaltar ? ' class="resaltada"' : '';
      var titulo = f.resaltar ? ' title="' + escHtml(f.motivos_resaltado.join(' | ')) + '"' : '';
      var celdas = valoresEnOrden(f).map(celda).join('');
      return '<tr' + claseFila + titulo + ' data-id="' + escHtml(f.id) + '">' + celdas + '</tr>';
    }).join('');
  }
  var headers = COLUMNAS.map(function (c) { return '<th>' + escHtml(c.titulo) + '</th>'; }).join('');
  return [
    '<!doctype html><html lang="es"><head><meta charset="utf-8">',
    '<title>Planilla carga/auditoria - Transliquidos Estevez</title>',
    '<style>',
    'body{font-family:system-ui,Arial,sans-serif;margin:2rem;background:#f7f7f7;color:#222}',
    'h1{font-size:1.3rem;margin-bottom:.2rem}',
    'p.sub{color:#555;margin-top:0}',
    'table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}',
    'th,td{border:1px solid #ddd;padding:.4rem .5rem;text-align:left;font-size:.85rem;white-space:nowrap}',
    'th{background:#333;color:#fff;position:sticky;top:0}',
    'tr:nth-child(even){background:#fafafa}',
    'tr.resaltada{background:#fff3cd}',
    'tr.resaltada:hover{background:#ffe69c}',
    'td.vacio{color:#999}',
    '.vacio-tabla{text-align:center;padding:2rem;color:#666}',
    '.leyenda{margin:.5rem 0 1rem;font-size:.85rem;color:#555}',
    '.leyenda .muestra{display:inline-block;width:.9rem;height:.9rem;background:#fff3cd;border:1px solid #ddd;vertical-align:middle;margin-right:.3rem}',
    '</style></head><body>',
    '<h1>Planilla de carga / auditoria (' + lista.length + ')</h1>',
    '<p class="sub">Copilot de carga (transcribir al sistema de escritorio) + auditoria de facturacion (misma tabla).</p>',
    '<p class="leyenda"><span class="muestra"></span>Resaltado = revisar antes de facturar (REVISAR, PENDIENTE_DOCUMENTACION, SIN_TARIFA o indexacion agregada sin cerrar). Pasar el mouse por la fila para ver el motivo.</p>',
    '<table id="planilla"><thead><tr>' + headers + '</tr></thead><tbody>',
    cuerpo,
    '</tbody></table>',
    '</body></html>'
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    COLUMNAS: COLUMNAS,
    tipoIva: tipoIva,
    calcularImporte: calcularImporte,
    textoTarifa: textoTarifa,
    armarFila: armarFila,
    valoresEnOrden: valoresEnOrden,
    armarFilas: armarFilas,
    escHtml: escHtml,
    renderHTML: renderHTML
  };
}
