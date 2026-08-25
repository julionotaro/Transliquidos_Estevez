// ===== CATALOGOS GESRUTA: material y chofer (conjuntos CERRADOS) =============
//
// La planilla de carga a Gesruta no lleva texto libre: lleva el CODIGO Gesruta.
// Columnas del formato objetivo (Excelente_detalle_Code_Tabla):
//   "Cod. Material" -> "Material, traducido al listado de Gesruta para matchear"
//   "Cod. Chofer"   -> "Codigo de Gesruta"
//
// Mismo principio que el padron de flota (ficha/flota.js) y que el catalogo de
// puntos: NO se traduce con criterio libre, se ELIGE dentro de una lista conocida,
// y solo cuando la eleccion es inequivoca. Lo que no resuelve queda vacio con
// motivo, para revision humana — nunca se inventa un codigo.
//
// SEMILLAS derivadas del export REAL de Gesruta (viajesexportados_20260825,
// 765 lineas): 42 materiales y 25 choferes efectivamente usados.
//
// Logica PURA (sin n8n). Los catalogos se pueden inyectar (data table a futuro).

'use strict';

// --- Catalogo de MATERIAL: codigo Gesruta -> nombre canonico ----------------
var MATERIALES = {
  '21': 'ACEITE', '98': 'ACETATO', '53': 'ACETATO METILO', 'ACETIC': 'ACIDO ACETICO',
  '67': 'ACIDO FOSFORICO', '89': 'ACIDO NITRICO', '20': 'ACIDO SULFURICO', '33': 'AMONIACO',
  'CIPTON': 'CIPTON', 'CALCIC': 'CLOR.CALCICO', '1': 'COLA', '6': 'CONGELADO',
  '12677': 'CUTMAX', '61': 'DIETILENGLICOL', '90': 'DISOLVENTE', 'TRENGH': 'FENNOSTRENGHT',
  'FENOL': 'FENOL FUNDIDO', 'FINCAT': 'FINCAT', '3': 'FORMOL', '65': 'HIDROXIDO SODICO',
  'INOPON': 'INOPON', 'LATEX': 'LATEX', '62': 'LISINA', '5': 'METANOL',
  'METMET': 'METILMETACRILATO', 'MEXIFL': 'MEXIFLEX', 'MONOE': 'MONOETILENGLICOL',
  'OXSILA': 'OXSILAN', 'PAN': 'PAN', 'RALLAD': 'PAN RALLADO', '4': 'PARAFINA',
  'PINATU': 'PINATURE', 'POTASA': 'POTASA CAUSTICA', 'SEC/CG': 'SECO/CONGELADO',
  'SODIO': 'SODIO SILICATO', '81': 'SOLUC.NITROGENADA', '51': 'SOSA', 'SURFAC': 'SURFACTAN',
  'TENSIO': 'TENSION', '9': 'VARIOS', 'VINKA': 'VINKA-PLAST', '94': 'XILENO'
};

// ALIAS de material: como lo escriben los DOCUMENTOS y las FICHAS vs el nombre
// Gesruta. Derivados de los documentos reales analizados. Ampliable sin tocar
// logica. Clave = literal normalizado; valor = codigo Gesruta.
var ALIAS_MATERIAL = {
  // Resinas/colas de FORESA: la ficha y el albaran escriben "RES 0201",
  // "FORESA RES 0201", "Res 0541"... todas son COLA en Gesruta.
  'RES': '1', 'FORESA RES': '1', 'RESINA': '1', 'RESINA COLOFONIA': '1', 'COLA': '1',
  // Vinka-Plast (Quimidroga): en los documentos aparece "VINKA PLAST QD 390".
  'VINKA PLAST': 'VINKA', 'VINKAPLAST': 'VINKA', 'VINKA PLAST QD': 'VINKA',
  // La vision lee seguido "VINA PLAST" / "VINA-PLAST" (se come la K).
  'VINA PLAST': 'VINKA', 'VINAPLAST': 'VINKA',
  // Acidos y bases con nombre legal ADR largo.
  'ACIDO ACETICO GLACIAL': 'ACETIC', 'ACIDO ACETICO GLACIAL SOLUCION': 'ACETIC',
  'ACETIC ACID GLACIAL': 'ACETIC',
  // La ficha lo abrevia "A. Acetico".
  'A ACETICO': 'ACETIC', 'ACETICO': 'ACETIC',
  'SOSA CAUSTICA': '51', 'HIDROXIDO DE SODIO': '65', 'HIDROXIDO SODICO': '65',
  // Los documentos portugueses e ingleses la nombran distinto (guias de Bondalti,
  // RNM y los CMR internacionales): todas son SOSA en Gesruta.
  'SODA CAUSTICA': '51', 'CAUSTIC SODA': '51', 'CAUSTIC SODA LIQUOR': '51',
  'LIQUID CAUSTIC SODA': '51', 'SODA': '51',
  'ACIDO SULFURICO': '20', 'ACIDO NITRICO': '89',
  'METANOL': '5', 'ALCOHOL METILICO': '5',
  'FORMOL': '3', 'FORMALDEHIDO': '3',
  'LISINA': '62', 'L LISINA': '62', 'L LISINA LICA': '62',
  'MONOETILENGLICOL': 'MONOE', 'MEG': 'MONOE',
  'DIETILENGLICOL': '61', 'DEG': '61',
  'FENOL': 'FENOL', 'FENOL FUNDIDO': 'FENOL'
};

// --- Catalogo de CHOFER: codigo Gesruta -> nombre canonico ------------------
var CHOFERES = {
  'BREO': 'BREOGAN MARQUEZ', '37': 'CANDIDO JAMARDO', '2': 'CARLOS ABALO QUINTELA',
  '41': 'FRANCISCO ASENSI', 'JAC': 'JACOBO GRANDE MENDEZ', '45': 'JOSE ANTONIO VAZQUEZ HERMO',
  '39': 'JOSE CARLOS ALFONSIN', '19': 'JOSE CARLOS RODRIGUEZ', 'ARIA': 'JOSE ENRIQUE ARIAS',
  '5': 'JOSE JORGE FERREIRA GOLDAR', '34': 'JOSE MANUEL PAZ', '44': 'JOSE RAMON PIÑEIRO',
  '18': 'JOSE RUBEN ABALO RECUNA', '38': 'JUAN LUIS GLEZ LORENZO', '30': 'JUAN MANUEL ABAL',
  '42': 'LUIS M. TRIÑANES', '4': 'MANUEL ABOY GONZALEZ', '22': 'MANUEL FERREIRA GOLDAR',
  '40': 'MANUEL SABARIS', '12': 'MARCOS EIRIN FERNANDEZ', '36': 'NUNO FILIPE',
  '23': 'OSCAR SAYANS EIRIN', '6': 'PABLO CARLES SANTOS', '21': 'PEDRO FRAGA',
  '32': 'RODRIGO PEREZ BAHAMONDE'
};

function norm(s) {
  var t = (s === null || s === undefined) ? '' : String(s);
  return t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Distancia de edicion (Levenshtein) para tolerar un caracter mal leido.
function distanciaTexto(a, b) {
  a = a || ''; b = b || '';
  if (a === b) { return 0; }
  var la = a.length, lb = b.length;
  if (!la) { return lb; }
  if (!lb) { return la; }
  var prev = [], i, j;
  for (j = 0; j <= lb; j++) { prev[j] = j; }
  for (i = 1; i <= la; i++) {
    var cur = [i], ca = a.charAt(i - 1);
    for (j = 1; j <= lb; j++) {
      var cost = (ca === b.charAt(j - 1)) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[lb];
}

// Tokens de ruido en denominaciones de mercancia: concentraciones, envases,
// codigos ONU y palabras de embalaje que no distinguen el material.
var RUIDO_MATERIAL = /\b(UN\s*\d{3,4}|\d+\s*%|BULK|GRANEL|CISTERNA|SOLUCION|SOLUTION|GLACIAL|QD|CD|OD|KG|TN|ADR|CLASE|GRUPO)\b/g;

/**
 * Resuelve un material leido (ficha o documento) al codigo Gesruta.
 * Cascada: alias exacto -> nombre canonico exacto -> alias/canonico contenido
 * de forma UNIVOCA. Multi-candidato o sin match -> codigo null + motivo.
 *
 * @param {string} literal
 * @param {object} [catalogo] {materiales, alias} inyectables
 * @returns {{codigo:string|null, nombre:string|null, metodo:string, literal:string, revisar:boolean, motivo:string}}
 */
function resolverMaterial(literal, catalogo) {
  var mats = (catalogo && catalogo.materiales) || MATERIALES;
  var alias = (catalogo && catalogo.alias) || ALIAS_MATERIAL;
  var lit = (literal === null || literal === undefined) ? '' : String(literal);
  var n = norm(lit);
  if (!n) {
    return { codigo: null, nombre: null, metodo: 'vacio', literal: lit, revisar: true, motivo: 'material vacio o ilegible' };
  }
  // Limpieza de ruido (concentraciones, ONU, envase) para comparar.
  var limpio = norm(n.replace(RUIDO_MATERIAL, ' '));

  var res = function (cod, metodo, revisar, motivo) {
    return { codigo: cod, nombre: mats[cod] || null, metodo: metodo, literal: lit, revisar: !!revisar, motivo: motivo || '' };
  };

  // 1) Alias exacto (con y sin ruido).
  if (Object.prototype.hasOwnProperty.call(alias, n)) { return res(alias[n], 'alias', false); }
  if (limpio && Object.prototype.hasOwnProperty.call(alias, limpio)) { return res(alias[limpio], 'alias', false); }

  // 2) Nombre canonico exacto.
  var k;
  for (k in mats) {
    if (!Object.prototype.hasOwnProperty.call(mats, k)) { continue; }
    if (norm(mats[k]) === n || (limpio && norm(mats[k]) === limpio)) { return res(k, 'canonico', false); }
  }

  // 3) Contencion UNIVOCA: el nombre Gesruta aparece dentro del literal, o un
  // alias aparece dentro del literal. Debe apuntar a UN SOLO codigo.
  // Contencion por LIMITE DE PALABRA, nunca por substring crudo: "RES" no debe
  // matchear dentro de "RESORCINOL" (paso de verdad y habria facturado COLA por
  // un producto distinto). Se compara token completo.
  var hits = {};
  var base = ' ' + (limpio || n) + ' ';
  var contiene = function (frag) { return frag && frag.length >= 3 && base.indexOf(' ' + frag + ' ') >= 0; };
  for (k in mats) {
    if (!Object.prototype.hasOwnProperty.call(mats, k)) { continue; }
    if (contiene(norm(mats[k]))) { hits[k] = true; }
  }
  for (k in alias) {
    if (!Object.prototype.hasOwnProperty.call(alias, k)) { continue; }
    if (contiene(k)) { hits[alias[k]] = true; }
  }
  var ids = Object.keys(hits);
  if (ids.length === 1) {
    return res(ids[0], 'contencion', true, 'material "' + lit + '" -> ' + mats[ids[0]] + ' (' + ids[0] + ') por contencion — verificar');
  }
  if (ids.length > 1) {
    var nombres = ids.map(function (i) { return mats[i]; }).join(', ');
    return { codigo: null, nombre: null, metodo: 'ambiguo', literal: lit, revisar: true, motivo: 'material "' + lit + '" coincide con varios de Gesruta (' + nombres + ') — revisar cual es' };
  }
  return { codigo: null, nombre: null, metodo: 'no_reconocido', literal: lit, revisar: true, motivo: 'material "' + lit + '" no esta en el listado de Gesruta — dar de alta o corregir' };
}

/**
 * Resuelve el chofer de la ficha al codigo Gesruta. La ficha trae el nombre
 * abreviado ("Juan Manuel Abal", "MARCOS", "PEDRO FRAGA") y Gesruta el nombre
 * completo. Match por CONTENCION de todos los tokens del literal en el canonico,
 * exigiendo unicidad (dos "JOSE CARLOS" distintos no se resuelven a ciegas).
 */
function resolverChofer(literal, catalogo) {
  var chs = (catalogo && catalogo.choferes) || CHOFERES;
  var lit = (literal === null || literal === undefined) ? '' : String(literal);
  var n = norm(lit);
  if (!n) { return { codigo: null, nombre: null, metodo: 'vacio', literal: lit, revisar: true, motivo: 'chofer vacio o ilegible' }; }

  var k, exactos = [];
  for (k in chs) {
    if (!Object.prototype.hasOwnProperty.call(chs, k)) { continue; }
    if (norm(chs[k]) === n) { exactos.push(k); }
  }
  if (exactos.length === 1) { return { codigo: exactos[0], nombre: chs[exactos[0]], metodo: 'exacto', literal: lit, revisar: false, motivo: '' }; }

  // Contencion: TODOS los tokens del literal deben estar en el nombre canonico.
  // Se conservan las iniciales (1 caracter): 'M FERREIRA' necesita la M para
  // distinguir MANUEL FERREIRA de JOSE JORGE FERREIRA. Pesan poco (ver puntaje).
  var toks = n.split(' ').filter(function (t) { return t.length >= 1; });
  if (!toks.length) { return { codigo: null, nombre: null, metodo: 'no_reconocido', literal: lit, revisar: true, motivo: 'chofer "' + lit + '" ilegible' }; }
  // PUNTAJE PONDERADO POR CARACTERES (mismo criterio que el padron de flota):
  // cada token del literal que aparece en el nombre canonico suma su longitud,
  // asi un apellido distintivo ("CANDIDO", 7) pesa mas que un nombre comun
  // ("JOSE", 4) y no empatan todos los Jose entre si. Un token cuenta si es
  // prefijo de un token canonico (o al reves) o si difiere en 1 caracter
  // (>=3 letras): la ficha manuscrita se lee "ABELO" por "ABALO", "GLZ" por
  // "GLEZ". Gana el mejor SOLO si le saca ventaja al segundo; si empatan, es
  // ambiguo y no se elige (no se adivina entre homonimos).
  var puntajes = [];
  for (k in chs) {
    if (!Object.prototype.hasOwnProperty.call(chs, k)) { continue; }
    var canon = norm(chs[k]).split(' ');
    var pts = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      for (var j = 0; j < canon.length; j++) {
        var c2 = canon[j];
        // El puntaje es el SOLAPAMIENTO real, no la longitud del token leido: una
        // inicial canonica ('M' de "LUIS M. TRIÑANES") solo puede sumar 1, y no
        // puede empatarle a un nombre completo ("MARCOS" = 6). Sin esto, "MARCOS"
        // empataba con "LUIS M. TRIÑANES" y quedaba ambiguo.
        if (c2.indexOf(t) === 0 || t.indexOf(c2) === 0) { pts += Math.min(t.length, c2.length); break; }
        if (t.length >= 3 && c2.length >= 3 && distanciaTexto(t, c2) <= 1) { pts += t.length; break; }
      }
    }
    if (pts > 0) { puntajes.push({ cod: k, pts: pts }); }
  }
  puntajes.sort(function (a, b) { return b.pts - a.pts; });
  var cands = [];
  if (puntajes.length === 1) { cands = [puntajes[0].cod]; }
  else if (puntajes.length > 1) {
    if (puntajes[0].pts > puntajes[1].pts) { cands = [puntajes[0].cod]; }
    else { cands = puntajes.filter(function (x) { return x.pts === puntajes[0].pts; }).map(function (x) { return x.cod; }); }
  }
  if (cands.length === 1) {
    return { codigo: cands[0], nombre: chs[cands[0]], metodo: 'contencion', literal: lit, revisar: false, motivo: '' };
  }
  if (cands.length > 1) {
    var nn = cands.map(function (c) { return chs[c]; }).join(', ');
    return { codigo: null, nombre: null, metodo: 'ambiguo', literal: lit, revisar: true, motivo: 'chofer "' + lit + '" coincide con varios (' + nn + ') — revisar cual es' };
  }
  return { codigo: null, nombre: null, metodo: 'no_reconocido', literal: lit, revisar: true, motivo: 'chofer "' + lit + '" no esta en el listado de Gesruta — dar de alta o corregir' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MATERIALES: MATERIALES, ALIAS_MATERIAL: ALIAS_MATERIAL, CHOFERES: CHOFERES,
    resolverMaterial: resolverMaterial, resolverChofer: resolverChofer,
    normalizarGesruta: norm,
  };
}
