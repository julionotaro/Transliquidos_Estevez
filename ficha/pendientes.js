// ===== VISTA DE PENDIENTES — filtro y render =====
//
// Cierre v1 pieza 2 + v1.1 pieza 1 + CAMBIO 2 (tabla de resultado editable).
//
// Lista consultable de todo lo que quedo esperando algo: falta documentacion
// (estado === 'PENDIENTE_DOCUMENTACION') o la lectura fue dudosa
// (estado_lectura === 'REVISAR', incluye el cliente_no_reconocido de cierre-v1).
// Son DOS EJES independientes (un viaje puede estar en uno, el otro, los dos, o
// ninguno) — el filtro es OR, no AND.
//
// CAMBIO 2: cada viaje se muestra como una fila editable con las columnas reales
// de `viajes` (nombres resueltos; los codigos Gesruta son de la Pieza C, no van).
//   - "!" por celda = validaciones de FORMA (validaciones-forma.js): patron de
//     matricula, fecha descarga >= carga, cantidad > 0. Marca la celda concreta.
//   - Resaltado a nivel FILA: estado_lectura=REVISAR muestra el motivo como
//     observacion (no se puede atribuir a una celda sin campos_dudosos, que es
//     encargo futuro — decision D del addendum).
//   - Faltante de documentacion: marcado PROMINENTE (banda ⚠) con que falta y a
//     quien reclamar (dato ya en la base: PENDIENTE_DOCUMENTACION + pendiente_*).
//   - dieta: se lee del JSON `detalle`/gastos (dato de lectura, no columna); si
//     el viaje no la trae, celda vacia.
//   - Edicion de celda: postea a /webhook/viajes-accion. `cliente` va por el
//     verbo `corregir` (revalida regimen/pais); el resto por `corregir_celda`
//     (sin revalidar, el humano es la autoridad). `confirmar` marca la fila
//     lista para Gesruta (estado_carga -> confirmada).
//
// Lee directo de la tabla `Viajes` (lrBxWpTUxMtO8U48) via el nodo dataTable
// "Leer Viajes".

'use strict';

// Modulo de validaciones de forma: inlineado antes que este archivo en el nodo
// (build-nodo.js), o require en tests.
// Resolvedores de codigo Gesruta (conjunto cerrado). En el nodo se inlinean con
// build-nodo.js; en tests se hace require. cod_origen/cod_destino necesitan el
// catalogo de puntos, que llega por parametro (Leer Puntos Pendientes).
var GES = (typeof resolverMaterial === 'function')
  ? { resolverMaterial: resolverMaterial, resolverChofer: resolverChofer }
  : require('../catalogo/gesruta.js');
var PUN = (typeof resolverPunto === 'function')
  ? { resolverPunto: resolverPunto }
  : require('../catalogo/resolver-punto.js');
var CLIG = (typeof codigoCliente === 'function')
  ? { codigoCliente: codigoCliente }
  : require('../catalogo/clientes-gesruta.js');

var VF = (typeof marcasForma === 'function')
  ? { marcasForma: marcasForma, cantidadDe: cantidadDe, dietaDeDetalle: dietaDeDetalle }
  : require('./validaciones-forma.js');

// URL del webhook de acciones. DEBE ser ABSOLUTA: la pagina se sirve desde
// studio-julio.duckdns.org/webhook/viajes-pendientes; una ruta relativa
// ("webhook/viajes-accion") resuelve mal en el navegador (DNS_PROBE_FINISHED_
// NXDOMAIN) y ninguna correccion/confirmacion se guarda. Igual que el HTML de
// ingesta, que postea a su webhook por URL absoluta.
var WEBHOOK_ACCION = 'https://studio-julio.duckdns.org/webhook/viajes-accion';

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

// Lectura de historial_correcciones SOLO para mostrar notas (incidencias) en la
// fila. Copia deliberadamente chica de la logica que vive en
// acciones-pendientes.js (que ESCRIBE el historial), para no inflar este nodo.
function notasDeHistorial(historialStr) {
  if (!historialStr) { return []; }
  var lista;
  try { lista = JSON.parse(historialStr); } catch (e) { return []; }
  if (!Array.isArray(lista)) { return []; }
  var out = [];
  for (var i = 0; i < lista.length; i++) {
    var h = lista[i];
    if (h && h.accion === 'incidencia' && h.valor_nuevo) { out.push(h.valor_nuevo); }
  }
  return out;
}

/**
 * Filtra los viajes pendientes, enriquece cada uno con lo que la tabla editable
 * necesita (celdas + marcas de forma + dieta + faltante), calcula dias_esperando
 * y ordena por antiguedad descendente (lo mas viejo primero).
 * @param {Array<object>} viajes  filas crudas de la tabla Viajes.
 * @param {number} [ahoraMs]      instante de referencia (tests deterministas).
 * @returns {Array<object>}
 */
// El campo origen/destino del viaje puede venir ya con formato "CODIGO · NOMBRE"
// (lo arma Preparar Filas Viajes con puntoGesruta). Para la tabla se separa: el
// codigo va a su columna propia y el nombre a la columna origen/destino, sin
// duplicar el codigo pegado al nombre (era el "COGER · COGER" de la captura).
var SEP_PUNTO = ' \u00b7 '; // " · "
function soloNombrePunto(valor) {
  var s = (valor === null || valor === undefined) ? '' : String(valor);
  var i = s.indexOf('\u00b7');
  return (i >= 0) ? s.slice(i + 1).trim() : s.trim();
}
function codigoPunto(valor, puntos) {
  var s = (valor === null || valor === undefined) ? '' : String(valor);
  var i = s.indexOf('\u00b7');
  if (i > 0) { return s.slice(0, i).trim(); }       // ya trae el codigo delante
  var r = PUN.resolverPunto(s, 'documento', puntos); // fila vieja sin codigo: resolver
  return (r && r.id_punto) ? r.id_punto : null;
}

function filtrarPendientes(viajes, ahoraMs, puntos) {
  var lista = Array.isArray(viajes) ? viajes : [];
  var out = [];
  for (var i = 0; i < lista.length; i++) {
    var v = lista[i] || {};
    if (!esPendiente(v)) { continue; }
    var cant = VF.cantidadDe(v);
    out.push({
      id: v.id,
      // --- resumen (compat cierre-v1) ---
      fecha_carga: v.fecha || null,
      chofer: v.conductor || null,
      cliente: v.cliente || null,
      ruta: (v.origen || '?') + ' → ' + (v.destino || '?'),
      que_falta: v.pendiente_falta || null,
      reclamar_a: v.pendiente_reclamar_a || null,
      motivo_revision: v.motivo_revision || null,
      dias_esperando: diasEsperando(v.createdAt, ahoraMs),
      notas: notasDeHistorial(v.historial_correcciones),
      // --- ejes de atencion ---
      falta_doc: v.estado === 'PENDIENTE_DOCUMENTACION',
      revisar: v.estado_lectura === 'REVISAR',
      // --- celdas de la tabla editable (valores crudos) ---
      tractora: v.tractora || '',
      semi: v.semi || '',
      conductor: v.conductor || '',
      origen: soloNombrePunto(v.origen),
      destino: soloNombrePunto(v.destino),
      material: v.material || '',
      referencia: v.referencia || '',
      fecha: v.fecha || '',
      fecha_descarga: v.fecha_descarga || '',
      cantidad_valor: cant.valor,
      cantidad_um: cant.um,
      // que columna real corrige la celda "cantidad" (el doc manda; si no, la hoja)
      cantidad_campo: (typeof v.kg_documento === 'number' && isFinite(v.kg_documento)) ? 'kg_documento' : 'kg_hoja',
      regimen_indexacion: v.regimen_indexacion || '',
      km_cargados: (v.km_cargados === null || v.km_cargados === undefined) ? '' : v.km_cargados,
      km_vacios: (v.km_vacios === null || v.km_vacios === undefined) ? '' : v.km_vacios,
      dieta: VF.dietaDeDetalle(v.detalle),
      estado_carga: v.estado_carga || 'pendiente_revision',
      // --- CODIGOS GESRUTA (display, read-only): las columnas amarillas ---
      codigo_cliente: CLIG.codigoCliente(v.cliente).codigo,
      codigo_chofer: GES.resolverChofer(v.conductor).codigo,
      codigo_material: GES.resolverMaterial(v.material).codigo,
      codigo_origen: codigoPunto(v.origen, puntos),
      codigo_destino: codigoPunto(v.destino, puntos),
      // marcas de forma por celda { campo: [motivos] }
      marcas: VF.marcasForma(v)
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

// --- HTML: server-rendered, sin framework, sin JS de cliente ----------------
function escHtml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Motivo(s) de forma de una celda (unido), o '' si esta limpia. */
function marcaDe(p, campo) {
  var m = p.marcas && p.marcas[campo];
  return (m && m.length) ? m.join('; ') : '';
}

/**
 * Celda EDITABLE: valor + form inline [input][✓] que postea al webhook. `cliente`
 * usa el verbo `corregir` (revalida); el resto `corregir_celda` (sin revalidar).
 * El "!" (marca de forma) es una pista visual; corregir el valor lo limpia solo
 * en el proximo render.
 */
function celdaEditable(p, campo, valor, accion, marcaKey) {
  var marca = marcaDe(p, marcaKey || campo); // marcas indexadas por su clave real
  var warn = marca ? ' class="warn"' : '';
  var bang = marca ? '<span class="bang" title="' + escHtml(marca) + '">!</span> ' : '';
  var motivoHidden = marca ? '<input type="hidden" name="motivo" value="' + escHtml(marca) + '">' : '';
  return '<td' + warn + ' data-campo="' + escHtml(campo) + '">' + bang +
    '<form class="cell">' +
    '<input type="hidden" name="id" value="' + escHtml(p.id) + '">' +
    '<input type="hidden" name="accion" value="' + accion + '">' +
    '<input type="hidden" name="campo" value="' + escHtml(campo) + '">' +
    motivoHidden +
    '<input type="text" name="valor" value="' + escHtml(valor) + '" size="9">' +
    '<button type="submit" title="Guardar (se acepta como verdad, sin revalidar)">✓</button>' +
    '</form></td>';
}

/** Celda de cantidad: input editable (columna real) + U.M. al lado. */
function celdaCantidad(p) {
  var marca = marcaDe(p, 'cantidad');
  var warn = marca ? ' class="warn"' : '';
  var bang = marca ? '<span class="bang" title="' + escHtml(marca) + '">!</span> ' : '';
  var motivoHidden = marca ? '<input type="hidden" name="motivo" value="' + escHtml(marca) + '">' : '';
  var valor = (p.cantidad_valor === null || p.cantidad_valor === undefined) ? '' : p.cantidad_valor;
  return '<td' + warn + ' data-campo="' + escHtml(p.cantidad_campo) + '">' + bang +
    '<form class="cell">' +
    '<input type="hidden" name="id" value="' + escHtml(p.id) + '">' +
    '<input type="hidden" name="accion" value="corregir_celda">' +
    '<input type="hidden" name="campo" value="' + escHtml(p.cantidad_campo) + '">' +
    motivoHidden +
    '<input type="text" name="valor" value="' + escHtml(valor) + '" size="7">' +
    '<span class="um"> ' + escHtml(p.cantidad_um) + '</span>' +
    '<button type="submit" title="Guardar (sin revalidar)">✓</button>' +
    '</form></td>';
}

/** Celda de solo lectura (valor derivado o dato de lectura). */
function celdaDisplay(valor) {
  return '<td>' + escHtml((valor === null || valor === undefined || valor === '') ? '-' : valor) + '</td>';
}

/**
 * Acciones de fila: usuario compartido + valor (cliente/nota) + botones. El
 * cliente va por `corregir` (revalida); resolver/incidencia/confirmar completan.
 */
function accionesHTML(p) {
  return '<form class="acc">' +
    '<input type="hidden" name="id" value="' + escHtml(p.id) + '">' +
    '<input type="text" name="usuario" placeholder="Tu nombre" size="9">' +
    '<input type="text" name="valor" placeholder="Cliente correcto / nota" size="14">' +
    '<button type="submit" name="accion" value="corregir" title="Corrige el cliente y re-evalua el regimen (revalida)">Corregir cliente</button>' +
    '<button type="submit" name="accion" value="resolver" title="La documentacion llego por otra via">Marcar resuelto</button>' +
    '<button type="submit" name="accion" value="incidencia" title="Nota libre, no saca el viaje de la lista">Anotar incidencia</button>' +
    '<button type="submit" name="accion" value="confirmar" title="Revisado/ok: lista para Gesruta (estado_carga -> confirmada)">Confirmar viaje</button>' +
    '</form>';
}

var COLS_TABLA = [
  'Matricula tractora', 'Remolque', 'Chofer', 'Cod. chofer',
  'Cliente', 'Cod. cliente', 'Cod. origen', 'Origen', 'Cod. destino', 'Destino',
  'Material', 'Cod. material', 'Referencia', 'Fecha de carga', 'Fecha de descarga', 'Cantidad',
  'Regimen indexacion', 'Km cargado', 'Km vacio', 'Dieta', 'Estado carga', 'Acciones'
];

/** Fila principal (celdas) + fila de observaciones (faltante/motivo/notas). */
function filasDeViaje(p) {
  var main = '<tr data-viaje="' + escHtml(p.id) + '">' +
    celdaEditable(p, 'tractora', p.tractora, 'corregir_celda') +
    celdaEditable(p, 'semi', p.semi, 'corregir_celda') +
    celdaEditable(p, 'conductor', p.conductor, 'corregir_celda') +
    celdaDisplay(p.codigo_chofer) +
    // cliente: no inline por celda; se corrige por la barra de acciones (verbo
    // corregir, que revalida regimen/pais). Aca solo se muestra el valor.
    '<td class="cli">' + escHtml(p.cliente || '-') + '</td>' +
    celdaDisplay(p.codigo_cliente) +
    celdaDisplay(p.codigo_origen) +
    celdaEditable(p, 'origen', p.origen, 'corregir_celda') +
    celdaDisplay(p.codigo_destino) +
    celdaEditable(p, 'destino', p.destino, 'corregir_celda') +
    celdaEditable(p, 'material', p.material, 'corregir_celda') +
    celdaDisplay(p.codigo_material) +
    celdaEditable(p, 'referencia', p.referencia, 'corregir_celda') +
    celdaEditable(p, 'fecha', p.fecha, 'corregir_celda') +
    celdaEditable(p, 'fecha_descarga', p.fecha_descarga, 'corregir_celda') +
    // cantidad: corrige la columna real (kg_documento o kg_hoja); muestra la
    // U.M. al lado (el numero sin unidad miente). Marca indexada por 'cantidad'.
    celdaCantidad(p) +
    celdaDisplay(p.regimen_indexacion) +
    celdaEditable(p, 'km_cargados', p.km_cargados, 'corregir_celda') +
    celdaEditable(p, 'km_vacios', p.km_vacios, 'corregir_celda') +
    celdaDisplay(p.dieta === null ? '' : p.dieta) +
    '<td class="ecarga">' + escHtml(p.estado_carga) + '</td>' +
    '<td>' + accionesHTML(p) + '</td>' +
    '</tr>';

  // Fila de observaciones: faltante de doc PROMINENTE + motivo de revision + notas.
  var obs = [];
  if (p.falta_doc) {
    obs.push('<span class="falta">⚠ FALTA DOC: ' + escHtml(p.que_falta || 'documentacion del viaje') +
      ' — reclamar a: ' + escHtml(p.reclamar_a || '?') + '</span>');
  }
  if (p.revisar && p.motivo_revision) {
    obs.push('<span class="rev">REVISAR: ' + escHtml(p.motivo_revision) + '</span>');
  }
  if (p.notas && p.notas.length) {
    obs.push('<span class="notas">Notas: ' + p.notas.map(escHtml).join(' | ') + '</span>');
  }
  var obsRow = obs.length
    ? '<tr class="obs"><td colspan="' + COLS_TABLA.length + '">' + obs.join(' &nbsp; ') + '</td></tr>'
    : '';
  return main + obsRow;
}

// JS de cliente: envia las acciones por FETCH (no por form nativo), asi la
// pagina NO navega al guardar. El webhook responde JSON {ok, ...} y este script
// actualiza la fila IN-PLACE (quita el "!", refleja estado_carga/cliente). Ante
// error (HTTP !ok, ok:false o red) marca la celda sin navegar ni perder lo
// tipeado. Sin localStorage/sessionStorage/clipboard/createObjectURL: todo el
// estado vive en el DOM durante la sesion.
var SCRIPT_ACCIONES = [
  '(function(){',
  '  var WEBHOOK=' + JSON.stringify(WEBHOOK_ACCION) + ';',
  '  function filaDe(el){while(el&&el.tagName!=="TR"){el=el.parentNode;}return el;}',
  '  function flash(el,cls){if(!el)return;el.classList.add(cls);setTimeout(function(){el.classList.remove(cls);},1600);}',
  '  function limpiarErr(el){if(el){el.classList.remove("err");el.removeAttribute("title");}}',
  '  function aplicar(form,data){',
  '    var tr=filaDe(form), td=form.parentNode;',
  '    if(form.className.indexOf("cell")>=0){',
  '      td.classList.remove("warn");',
  '      var b=td.querySelector(".bang");if(b){b.parentNode.removeChild(b);}',
  '      var mv=form.querySelector(\'[name="motivo"]\');if(mv){mv.parentNode.removeChild(mv);}',
  '      limpiarErr(td);flash(td,"ok");',
  '    }',
  '    if(tr&&data){',
  '      if(data.estado_carga){var ec=tr.querySelector("td.ecarga");if(ec)ec.textContent=data.estado_carga;}',
  '      if(data.accion==="corregir"){var cc=tr.querySelector("td.cli");if(cc)cc.textContent=data.cliente||"-";}',
  '      if(form.className.indexOf("acc")>=0){limpiarErr(td);flash(tr,"ok");}',
  '    }',
  '  }',
  '  function error(form,msg){var td=form.parentNode;td.classList.add("err");td.setAttribute("title",msg||"Error al guardar");}',
  '  document.addEventListener("submit",function(e){',
  '    var form=e.target;',
  '    if(!form||!form.className||(form.className.indexOf("cell")<0&&form.className.indexOf("acc")<0)){return;}',
  '    e.preventDefault();',
  '    var fd=new FormData(form);',
  '    if(e.submitter&&e.submitter.name){fd.append(e.submitter.name,e.submitter.value);}',
  '    var body=new URLSearchParams();fd.forEach(function(v,k){body.append(k,v);});',
  '    if(!body.get("accion")){return;}',
  '    fetch(WEBHOOK,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()})',
  '      .then(function(r){if(!r.ok){throw new Error("HTTP "+r.status);}return r.json().catch(function(){return {ok:true};});})',
  '      .then(function(d){if(d&&d.ok===false){throw new Error(d.error||"accion rechazada");}aplicar(form,d||{});})',
  '      .catch(function(err){error(form,err&&err.message);});',
  '  });',
  '})();'
].join('\n');

/**
 * Pagina HTML autocontenida: tabla editable ordenada por dias_esperando desc.
 * Lista vacia -> mensaje claro. @param {Array<object>} pendientes salida de
 * filtrarPendientes().
 */
function renderHTML(pendientes) {
  var lista = Array.isArray(pendientes) ? pendientes : [];
  var cuerpo;
  if (lista.length === 0) {
    cuerpo = '<tr><td colspan="' + COLS_TABLA.length + '" class="vacio">No hay viajes pendientes ni en revision. Todo al dia.</td></tr>';
  } else {
    cuerpo = lista.map(filasDeViaje).join('');
  }
  var ths = COLS_TABLA.map(function (t) { return '<th>' + escHtml(t) + '</th>'; }).join('');
  return [
    '<!doctype html><html lang="es"><head><meta charset="utf-8">',
    '<title>Pendientes - Transliquidos Estevez</title>',
    '<style>',
    'body{font-family:system-ui,Arial,sans-serif;margin:1.5rem;background:#f7f7f7;color:#222}',
    'h1{font-size:1.3rem;margin-bottom:.2rem}',
    'p.sub{color:#555;margin-top:0}',
    'table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}',
    'th,td{border:1px solid #ddd;padding:.35rem .45rem;text-align:left;font-size:.82rem;vertical-align:top}',
    'th{background:#333;color:#fff;position:sticky;top:0}',
    '.vacio{text-align:center;padding:2rem;color:#666}',
    'td.warn{background:#fff5d6}',
    '.bang{color:#b34700;font-weight:bold}',
    'td.cli{font-weight:bold}',
    'td.ecarga{white-space:nowrap;color:#555}',
    'form.cell{display:flex;gap:2px;margin:0}',
    'form.cell input[type=text]{padding:.1rem;font-size:.78rem;width:6.5rem}',
    'form.cell button{font-size:.75rem;padding:0 .3rem;cursor:pointer}',
    'form.acc{display:flex;flex-wrap:wrap;gap:.2rem;min-width:230px}',
    'form.acc input{padding:.15rem;font-size:.75rem}',
    'form.acc button{font-size:.72rem;padding:.15rem .35rem;cursor:pointer}',
    'tr.obs td{background:#fbfbfb;font-size:.8rem}',
    '.falta{color:#a11;font-weight:bold}',
    '.rev{color:#b34700}',
    '.notas{color:#555}',
    // feedback in-place del fetch (CAMBIO fetch-acciones): guardado / error.
    'td.ok{background:#d7f5dd !important;transition:background .25s}',
    'tr.ok>td{background:#eafaef}',
    'td.err{outline:2px solid #d11;outline-offset:-2px}',
    '</style></head><body>',
    '<h1>Pendientes (' + lista.length + ')</h1>',
    '<p class="sub">Documentacion faltante o lectura a revisar. Celdas con ! fallan una validacion de forma; corregilas y confirma. Ordenado por antiguedad, lo mas viejo primero.</p>',
    '<table><thead><tr>', ths, '</tr></thead><tbody>',
    cuerpo,
    '</tbody></table>',
    '<script>' + SCRIPT_ACCIONES + '</script>',
    '</body></html>'
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    diasEsperando: diasEsperando,
    esPendiente: esPendiente,
    notasDeHistorial: notasDeHistorial,
    filtrarPendientes: filtrarPendientes,
    escHtml: escHtml,
    accionesHTML: accionesHTML,
    renderHTML: renderHTML,
    COLS_TABLA: COLS_TABLA
  };
}
