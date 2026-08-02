// ===== VISTA DE PENDIENTES — filtro y render (Cierre v1, pieza 2) ===========
//
// Lista minima y consultable de todo lo que quedo esperando algo: falta
// documentacion (estado === 'PENDIENTE_DOCUMENTACION') o la lectura fue dudosa
// (estado_lectura === 'REVISAR', incluye el nuevo cliente_no_reconocido de la
// pieza 1). Son DOS EJES independientes (un viaje puede estar en uno, el otro,
// los dos, o ninguno) — por eso el filtro es OR, no AND.
//
// Esto NO es el tablero de Fase 4: no hay edicion ni flujo de resolucion, solo
// se mira. Lee directo de la tabla `Viajes` (lrBxWpTUxMtO8U48) via el nodo
// dataTable "Leer Viajes" del workflow "[ESTEVEZ] Vista Pendientes".

'use strict';

/** Dias transcurridos desde createdAt, redondeados hacia abajo, nunca negativo. */
function diasEsperando(createdAt, ahoraMs) {
  if (!createdAt) { return null; }
  var t = Date.parse(createdAt);
  if (!isFinite(t)) { return null; }
  var ahora = (typeof ahoraMs === 'number') ? ahoraMs : Date.now();
  return Math.max(0, Math.floor((ahora - t) / 86400000));
}

/**
 * ¿El viaje espera algo? Dos ejes independientes (§3 estado de documentacion,
 * estado_lectura de la ficha/cierre-v1): cualquiera de los dos alcanza.
 */
function esPendiente(v) {
  return v.estado === 'PENDIENTE_DOCUMENTACION' || v.estado_lectura === 'REVISAR';
}

/**
 * Filtra los viajes pendientes de la tabla Viajes, calcula dias_esperando y
 * ordena por antiguedad descendente (lo mas viejo primero — lo que mas urge
 * reclamar).
 * @param {Array<object>} viajes  filas crudas de la tabla Viajes.
 * @param {number} [ahoraMs]      instante de referencia (tests deterministas).
 * @returns {Array<object>}
 */
function filtrarPendientes(viajes, ahoraMs) {
  var lista = Array.isArray(viajes) ? viajes : [];
  var out = [];
  for (var i = 0; i < lista.length; i++) {
    var v = lista[i] || {};
    if (!esPendiente(v)) { continue; }
    out.push({
      id: v.id,
      fecha_carga: v.fecha || null,
      chofer: v.conductor || null,
      cliente: v.cliente || null,
      ruta: (v.origen || '?') + ' → ' + (v.destino || '?'),
      que_falta: v.pendiente_falta || null,
      reclamar_a: v.pendiente_reclamar_a || null,
      motivo_revision: v.motivo_revision || null,
      dias_esperando: diasEsperando(v.createdAt, ahoraMs)
    });
  }
  out.sort(function (a, b) {
    var da = (a.dias_esperando === null) ? -1 : a.dias_esperando;
    var db = (b.dias_esperando === null) ? -1 : b.dias_esperando;
    if (db !== da) { return db - da; }
    return (a.id || 0) - (b.id || 0);
  });
  return out;
}

// --- HTML minimo: sin framework, sin build, sin JS de cliente ---------------
function escHtml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Pagina HTML autocontenida: tabla legible, ordenada por dias_esperando desc.
 * Lista vacia -> mensaje claro, no una tabla rota ni un error.
 * @param {Array<object>} pendientes  salida de filtrarPendientes().
 */
function renderHTML(pendientes) {
  var lista = Array.isArray(pendientes) ? pendientes : [];
  var filas;
  if (lista.length === 0) {
    filas = '<tr><td colspan="8" class="vacio">No hay viajes pendientes ni en revision. Todo al dia.</td></tr>';
  } else {
    filas = lista.map(function (p) {
      return '<tr>' +
        '<td>' + escHtml(p.fecha_carga || '-') + '</td>' +
        '<td>' + escHtml(p.chofer || '-') + '</td>' +
        '<td>' + escHtml(p.cliente || '-') + '</td>' +
        '<td>' + escHtml(p.ruta) + '</td>' +
        '<td>' + escHtml(p.que_falta || '-') + '</td>' +
        '<td>' + escHtml(p.reclamar_a || '-') + '</td>' +
        '<td class="dias">' + (p.dias_esperando === null ? '-' : p.dias_esperando) + '</td>' +
        '<td>' + escHtml(p.motivo_revision || '-') + '</td>' +
        '</tr>';
    }).join('');
  }
  return [
    '<!doctype html><html lang="es"><head><meta charset="utf-8">',
    '<title>Pendientes - Transliquidos Estevez</title>',
    '<style>',
    'body{font-family:system-ui,Arial,sans-serif;margin:2rem;background:#f7f7f7;color:#222}',
    'h1{font-size:1.3rem;margin-bottom:.2rem}',
    'p.sub{color:#555;margin-top:0}',
    'table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}',
    'th,td{border:1px solid #ddd;padding:.5rem .6rem;text-align:left;font-size:.9rem;vertical-align:top}',
    'th{background:#333;color:#fff;position:sticky;top:0}',
    'tr:nth-child(even){background:#fafafa}',
    '.dias{text-align:right;font-weight:bold;white-space:nowrap}',
    '.vacio{text-align:center;padding:2rem;color:#666}',
    '</style></head><body>',
    '<h1>Pendientes (' + lista.length + ')</h1>',
    '<p class="sub">Documentacion faltante o lectura a revisar. Ordenado por antiguedad, lo mas viejo primero.</p>',
    '<table><thead><tr>',
    '<th>Fecha de carga</th><th>Chofer</th><th>Cliente</th><th>Ruta</th>',
    '<th>Que falta</th><th>A quien reclamar</th><th>Dias esperando</th><th>Motivo de revision</th>',
    '</tr></thead><tbody>',
    filas,
    '</tbody></table>',
    '</body></html>'
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    diasEsperando: diasEsperando,
    esPendiente: esPendiente,
    filtrarPendientes: filtrarPendientes,
    escHtml: escHtml,
    renderHTML: renderHTML
  };
}
