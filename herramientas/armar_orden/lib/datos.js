// ===== Cargadores de datos para el armador de orden.json (Corrida 2) =========
//
// Leen del repo los catalogos/tablas que los modulos reusados (ficha/*.js,
// catalogo/*.js) esperan por parametro. Un solo lugar para parsear; el armador
// no sabe de formatos de archivo.
'use strict';

var fs = require('fs');
var path = require('path');

// Raiz del repo = dos niveles arriba de este archivo (herramientas/armar_orden/lib).
var ROOT = path.resolve(__dirname, '..', '..', '..');
function p(rel) { return path.join(ROOT, rel); }

/** Parsea un CSV simple separado por ';' con cabecera. Devuelve array de objetos. */
function parseCsv(texto, columnas) {
  var lineas = texto.split(/\r?\n/).filter(function (l) { return l.length > 0; });
  if (!lineas.length) { return []; }
  var hdr = columnas || lineas[0].split(';');
  var desde = columnas ? 0 : 1;
  var out = [];
  for (var i = desde; i < lineas.length; i++) {
    var celdas = lineas[i].split(';');
    var o = {};
    for (var j = 0; j < hdr.length; j++) { o[hdr[j]] = (celdas[j] === undefined ? '' : celdas[j]); }
    out.push(o);
  }
  return out;
}

/** Tabla Tarifas (699 filas). Schema: cliente;origen;destino;material;tarifa_tn;precio_fijo;vigente_desde;id;... */
function cargarTarifas() {
  var txt = fs.readFileSync(p('datos/n8n-export/tarifas.csv'), 'utf8');
  return parseCsv(txt); // la cabecera del archivo ya trae los nombres correctos
}

/** Indexacion por grupo -> filas {cliente:grupo, pct, desde, hasta} (lo que espera buscarPct). */
function cargarIndexacion() {
  var j = JSON.parse(fs.readFileSync(p('datos/gesruta/indexacion-gasoleo.json'), 'utf8'));
  var filas = [];
  var grupos = j.grupos || {};
  Object.keys(grupos).forEach(function (g) {
    (grupos[g] || []).forEach(function (tramo) {
      filas.push({ cliente: g, pct: String(tramo.factor), desde: tramo.desde, hasta: tramo.hasta });
    });
  });
  return filas;
}

/** Catalogo de puntos para resolver-punto.js: [{id_punto, nombre_canonico, alias}]. */
function cargarPuntos() {
  return JSON.parse(fs.readFileSync(p('catalogo/puntos-alta.json'), 'utf8'));
}

/** Materiales: nombre de carga (MAYUS) -> codigo Gesruta. materiales.csv (cp850; nombres ASCII). */
function cargarMateriales() {
  var txt = fs.readFileSync(p('datos/gesruta/materiales.csv'), 'latin1');
  var lineas = txt.split(/\r?\n/);
  var mapa = {};
  for (var i = 1; i < lineas.length; i++) {
    var c = lineas[i].split(';');
    if (c.length < 3) { continue; }
    var cod = (c[1] || '').trim();
    var carga = (c[2] || '').trim().toUpperCase();
    if (carga && cod && !(carga in mapa)) { mapa[carga] = cod; }
  }
  return mapa;
}

/** Analogias CONFIRMADAS de tarifa (destino real -> destino tarifado). Solo confirmado:true. */
function cargarAnalogiasConfirmadas() {
  var j = JSON.parse(fs.readFileSync(p('catalogo/tarifa-por-analogia.json'), 'utf8'));
  return (j.candidatos || []).filter(function (c) { return c.confirmado === true; });
}

/** Tarifario propio de RNM: {origen, destino, eur_viaje, eur_tn}. RNM factura por EUR/TN. */
function cargarTarifarioRNM() {
  var txt = fs.readFileSync(p('datos/gesruta/tarifarios/tarifario-RNM-2026.csv'), 'utf8');
  var filas = parseCsv(txt); // cabecera: origen;destino;eur_viaje;eur_tn
  return filas.map(function (r) {
    return { origen: r.origen, destino: r.destino, eur_viaje: r.eur_viaje, eur_tn: r.eur_tn };
  });
}

module.exports = {
  ROOT: ROOT,
  cargarTarifas: cargarTarifas,
  cargarIndexacion: cargarIndexacion,
  cargarPuntos: cargarPuntos,
  cargarMateriales: cargarMateriales,
  cargarAnalogiasConfirmadas: cargarAnalogiasConfirmadas,
  cargarTarifarioRNM: cargarTarifarioRNM,
};
