// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/../catalogo/resolver-punto.js + ficha/../catalogo/gesruta.js + ficha/tarifa-contractual.js + ficha/conductores.js + ficha/dedup.js + ficha/nodo-preparar-filas-viajes.wrapper.js
// Contenido exacto del nodo Code "Preparar Filas Viajes" (WD0q9Ic0oDvUoJwp).

// ===== RESOLVEDOR CANONICO DE PUNTOS (modelo-dominio-lectura.md §9) ==========
//
// Los choferes y los documentos escriben lugares a mano; no coinciden con los
// nombres de las bases. Este modulo resuelve un literal cualquiera al PUNTO
// CANONICO (el id que entiende Gesruta), con una cascada de confianza explicita.
// NUNCA adivina en silencio: todo lo que no sea match exacto marca REVISAR
// (adivinar un punto envenena la tarifa, §2).
//
// Logica PURA (sin n8n), compartida por ingesta, auditor y (futuro) robot Gesruta.
//
// `catalogo`: Array<{ id_punto, nombre_canonico, alias, ... }>. `alias` es un
// string con variantes separadas por "|".

'use strict';

// Escalones de confianza (para poder "bajar un escalon" segun la fuente, §4).
var ESCALON = { alta: 3, media: 2, baja: 1, ninguna: 0 };
function bajarConfianza(c) {
  if (c === 'alta') { return 'media'; }
  if (c === 'media') { return 'baja'; }
  return c; // baja/ninguna no bajan mas
}

// Overrides INTENCIONALES de oficina (confirmados por Julio): un literal que
// coincide con un canonico Gesruta que EN LA PRACTICA no se usa para ese destino.
// Ganan sobre toda la cascada. Clave = literal normalizado; destino = nombre
// canonico al que debe resolver. Reversible: quitar la entrada revierte al
// comportamiento por catalogo. Trazabilidad: la nota viaja en el motivo del
// resultado aunque la confianza sea alta.
var OVERRIDES_LITERAL = {
  // 'Anleo' es una parroquia dentro de Navia (Asturias); la oficina SIEMPRE lo
  // carga como NAVIA. Gana sobre el canonico Gesruta 'ANLEO', que existe pero no
  // se usa en la practica (datos/alias-fichas-reales.md, confirmado por Julio).
  'ANLEO': { destino: 'NAVIA', nota: "'Anleo' es parroquia de Navia; la oficina siempre lo carga como NAVIA. Override intencional sobre el canonico Gesruta ANLEO (existe pero no se usa)." }
};

// Frases de ruido a quitar ANTES que los tokens sueltos (orden: mas larga primero).
var FRASES_RUIDO = [' S L U ', ' S A U ', ' S C A ', ' S L L ', ' S A ', ' S L ', ' S C ', ' C B ',
                    ' PUERTO DE ', ' POLIGONO INDUSTRIAL ', ' POL INDUSTRIAL ', ' POL IND '];
// Tokens de ruido sueltos.
var TOKENS_RUIDO = [' SA ', ' SL ', ' SLU ', ' SAU ', ' PLANTA ', ' FABRICA ', ' PTO ',
                    ' POLIGONO ', ' POL ', ' IND ', ' PUERTO '];

/**
 * Normaliza un literal: mayusculas, sin acentos, sin puntuacion, espacios
 * colapsados, y sin ruido (formas societarias, POL. IND., PLANTA, PUERTO DE...).
 */
function normalizar(literal) {
  var s = (literal === null || literal === undefined) ? '' : String(literal);
  s = s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // sin acentos
  s = s.replace(/[^A-Z0-9]+/g, ' ');                                    // puntuacion -> espacio
  s = ' ' + s.replace(/\s+/g, ' ').trim() + ' ';                        // bordes con espacio para matchear tokens
  var i;
  for (i = 0; i < FRASES_RUIDO.length; i++) { while (s.indexOf(FRASES_RUIDO[i]) >= 0) { s = s.replace(FRASES_RUIDO[i], ' '); } }
  for (i = 0; i < TOKENS_RUIDO.length; i++) { while (s.indexOf(TOKENS_RUIDO[i]) >= 0) { s = s.replace(TOKENS_RUIDO[i], ' '); } }
  return s.replace(/\s+/g, ' ').trim();
}

// Distancia de edicion (Levenshtein). Reutilizable, sin dependencias.
function distanciaEdicion(a, b) {
  a = a || ''; b = b || '';
  if (a === b) { return 0; }
  var la = a.length, lb = b.length;
  if (la === 0) { return lb; }
  if (lb === 0) { return la; }
  var prev = [], i, j;
  for (j = 0; j <= lb; j++) { prev[j] = j; }
  for (i = 1; i <= la; i++) {
    var cur = [i], ca = a.charAt(i - 1);
    for (j = 1; j <= lb; j++) {
      var cost = (ca === b.charAt(j - 1)) ? 0 : 1;
      var m = prev[j] + 1;
      if (cur[j - 1] + 1 < m) { m = cur[j - 1] + 1; }
      if (prev[j - 1] + cost < m) { m = prev[j - 1] + cost; }
      cur[j] = m;
    }
    prev = cur;
  }
  return prev[lb];
}

function tokens(norm) { return norm ? norm.split(' ') : []; }
function subconjuntoTokens(chico, grande) {
  // true si TODOS los tokens de `chico` estan en `grande` (y chico no vacio).
  var tc = tokens(chico), tg = {}, i;
  if (tc.length === 0) { return false; }
  tokens(grande).forEach(function (t) { tg[t] = true; });
  for (i = 0; i < tc.length; i++) { if (!tg[tc[i]]) { return false; } }
  return true;
}

// Indexa el catalogo: lista de { id_punto, nombre_canonico, norm } por cada
// nombre canonico y por cada alias.
function indexar(catalogo) {
  var entradas = [];
  (catalogo || []).forEach(function (p) {
    if (!p || !p.id_punto) { return; }
    if (p.nombre_canonico) { entradas.push({ id_punto: p.id_punto, nombre_canonico: p.nombre_canonico, norm: normalizar(p.nombre_canonico), es_alias: false }); }
    var al = (p.alias === null || p.alias === undefined) ? '' : String(p.alias);
    al.split('|').forEach(function (a) {
      var t = a.trim();
      if (t) { entradas.push({ id_punto: p.id_punto, nombre_canonico: p.nombre_canonico, norm: normalizar(t), es_alias: true }); }
    });
  });
  return entradas;
}

function resultadoResuelto(ent, confianza, metodo, literal, motivoExtra) {
  var revisar = (confianza !== 'alta');
  var motivo = 'punto "' + literal + '" -> ' + ent.nombre_canonico + ' (' + metodo + ', confianza ' + confianza + ')';
  if (motivoExtra) { motivo += '; ' + motivoExtra; }
  return {
    id_punto: ent.id_punto,
    nombre_canonico: ent.nombre_canonico,
    confianza: confianza,
    metodo: metodo,
    literal_original: literal,
    revisar: revisar,
    motivo: revisar ? motivo : ''
  };
}

function noReconocido(literal, motivoExtra) {
  var lit = (literal === null || literal === undefined) ? '' : String(literal);
  var motivo = 'punto_no_reconocido: no se pudo resolver el literal "' + lit + '"';
  if (motivoExtra) { motivo += ' (' + motivoExtra + ')'; }
  return {
    id_punto: null, nombre_canonico: null, confianza: 'ninguna', metodo: 'punto_no_reconocido',
    literal_original: lit, revisar: true, motivo: motivo
  };
}

/**
 * Resuelve UN literal contra el catalogo. Cascada estricta (§9).
 * @param {string} literal
 * @param {'documento'|'ficha'} [fuente='documento'] la ficha es sospechosa (§4):
 *   si resuelve, se le baja la confianza un escalon.
 * @param {Array} catalogo
 */
function resolverPunto(literal, fuente, catalogo) {
  fuente = fuente || 'documento';
  var norm = normalizar(literal);
  if (!norm) { return noReconocido(literal, 'literal vacio tras normalizar'); }
  var idx = indexar(catalogo);

  // 0) Override intencional de oficina (gana sobre TODA la cascada). Busca el
  // canonico destino en el catalogo y resuelve a el, con la nota en el motivo.
  if (Object.prototype.hasOwnProperty.call(OVERRIDES_LITERAL, norm)) {
    var ov = OVERRIDES_LITERAL[norm];
    var normDest = normalizar(ov.destino);
    for (var k = 0; k < idx.length; k++) {
      if (!idx[k].es_alias && idx[k].norm === normDest) {
        return {
          id_punto: idx[k].id_punto, nombre_canonico: idx[k].nombre_canonico,
          confianza: 'alta', metodo: 'override', literal_original: literal,
          revisar: false, override: true,
          motivo: 'override intencional de oficina: "' + literal + '" -> ' + idx[k].nombre_canonico + '. ' + ov.nota
        };
      }
    }
    return noReconocido(literal, 'override a "' + ov.destino + '" pero ese punto no esta en el catalogo');
  }

  // 1) exacto contra un nombre_canonico. 2) exacto contra un alias.
  var canon = null, alias = null, i;
  var canonIds = {}; // id_punto distintos con match canonico exacto (para duplicados)
  for (i = 0; i < idx.length; i++) {
    if (idx[i].norm === norm) {
      if (!idx[i].es_alias) { if (!canon) { canon = idx[i]; } canonIds[idx[i].id_punto] = idx[i]; }
      if (idx[i].es_alias && !alias) { alias = idx[i]; }
    }
  }
  // Duplicado en catalogo: mismo nombre EXACTO, dos Cod.Pto. distintos (ej. GARNICA
  // GARNI/GARNL). No se puede saber cual se uso desde el nombre -> NO elegir, es
  // decision de Julio (§ dato: 5 duplicados marcados pendientes).
  if (Object.keys(canonIds).length > 1) {
    var cods = Object.keys(canonIds).join(', ');
    return noReconocido(literal, 'duplicado en catalogo: mismo nombre con varios Cod.Pto. (' + cods + ') — decision pendiente de Julio');
  }
  var base = null, metodo = null;
  if (canon) { base = resultadoResuelto(canon, 'alta', 'canonico', literal); metodo = 'canonico'; }
  else if (alias) { base = resultadoResuelto(alias, 'alta', 'alias', literal); metodo = 'alias'; }

  if (!base) {
    // 3) distancia de edicion <=1 contra EXACTAMENTE un canonico.
    var cercanos = {};
    for (i = 0; i < idx.length; i++) {
      if (idx[i].es_alias) { continue; }
      if (distanciaEdicion(norm, idx[i].norm) <= 1) { cercanos[idx[i].id_punto] = idx[i]; }
    }
    var idsCerca = Object.keys(cercanos);
    if (idsCerca.length === 1) {
      base = resultadoResuelto(cercanos[idsCerca[0]], 'media', 'distancia', literal, 'lectura parecida a un canonico (distancia 1) — verificar');
    }
  }
  if (!base) {
    // 4) contencion de tokens UNIVOCA (CALDAS subconjunto de CALDAS DE REIS).
    var contiene = {};
    for (i = 0; i < idx.length; i++) {
      if (subconjuntoTokens(norm, idx[i].norm)) { contiene[idx[i].id_punto] = idx[i]; }
    }
    var idsCont = Object.keys(contiene);
    if (idsCont.length === 1) {
      base = resultadoResuelto(contiene[idsCont[0]], 'media', 'contencion', literal, 'nombre contenido en un unico canonico — verificar');
    } else if (idsCont.length > 1) {
      var nombres = idsCont.map(function (k) { return contiene[k].nombre_canonico; }).join(', ');
      return noReconocido(literal, 'ambiguo: contenido en varios canonicos (' + nombres + ')');
    }
  }
  if (!base) {
    // 5) LOCALIDAD DENTRO DE UNA DIRECCION (encargo Julio 2026-08-25).
    // Los documentos no escriben el pueblo suelto: escriben la direccion entera
    // ("CELLMARK, MUELLE DE LA ENERGIA S/N, 08039 BARCELONA", "Finsa Cella 2,
    // CELLA-TERUEL 44370 España"). Los pasos 1-4 buscan el literal DENTRO del
    // canonico (CALDAS -> CALDAS DE REIS); aca se busca al reves: el nombre
    // canonico como TOKENS COMPLETOS dentro del literal largo. Es lo que permite
    // traducir origen/destino de un CMR o una orden a punto Gesruta sin listas
    // por cliente. Gana el canonico MAS LARGO (mas especifico: "VILA NOVA DE
    // FAMALICAO" sobre "FAMALICAO"); si dos distintos empatan, es ambiguo.
    var dentro = {}, mejorLen = 0;
    var espaciado = ' ' + norm + ' ';
    for (i = 0; i < idx.length; i++) {
      var cand = idx[i].norm;
      if (!cand || cand.length < 4) { continue; }
      if (espaciado.indexOf(' ' + cand + ' ') < 0) { continue; }
      if (cand.length > mejorLen) { mejorLen = cand.length; dentro = {}; }
      if (cand.length === mejorLen) { dentro[idx[i].id_punto] = idx[i]; }
    }
    var idsDentro = Object.keys(dentro);
    if (idsDentro.length === 1) {
      base = resultadoResuelto(dentro[idsDentro[0]], 'media', 'localidad_en_direccion', literal,
        'nombre del punto hallado dentro de la direccion del documento — verificar');
    } else if (idsDentro.length > 1) {
      var nomsD = idsDentro.map(function (k) { return dentro[k].nombre_canonico; }).join(', ');
      return noReconocido(literal, 'la direccion menciona varios puntos (' + nomsD + ')');
    }
  }
  if (!base) { return noReconocido(literal); }

  // Precedencia por fuente (§4): la ficha es sospechosa -> baja un escalon.
  if (fuente === 'ficha' && base.confianza !== 'ninguna') {
    var cNueva = bajarConfianza(base.confianza);
    base.confianza = cNueva;
    base.revisar = (cNueva !== 'alta');
    var nota = 'valor de ficha (fuente sospechosa): confianza reducida a ' + cNueva;
    base.motivo = base.motivo ? (base.motivo + '; ' + nota) : ('punto "' + literal + '" -> ' + base.nombre_canonico + '; ' + nota);
  }
  return base;
}

/**
 * Resuelve un punto con precedencia documento > ficha (§4).
 * El documento manda; la ficha solo confirma. Si ambos resuelven y difieren,
 * gana el documento y se deja la correccion anotada en el motivo.
 */
function resolverPuntoDocFicha(literalDoc, literalFicha, catalogo) {
  var rDoc = literalDoc ? resolverPunto(literalDoc, 'documento', catalogo) : null;
  var rFicha = literalFicha ? resolverPunto(literalFicha, 'ficha', catalogo) : null;

  if (rDoc && rDoc.id_punto) {
    if (rFicha && rFicha.id_punto && rFicha.id_punto !== rDoc.id_punto) {
      rDoc.revisar = true;
      var corr = 'la ficha decia "' + literalFicha + '" (=' + rFicha.nombre_canonico + '); manda el documento (§4)';
      rDoc.motivo = rDoc.motivo ? (rDoc.motivo + '; ' + corr) : corr;
    }
    return rDoc;
  }
  if (rFicha && rFicha.id_punto) { return rFicha; } // solo ficha: ya viene con confianza reducida
  // Ninguno resolvio: reportar sobre el literal que exista (documento primero).
  return rDoc || rFicha || noReconocido(literalDoc || literalFicha);
}

/**
 * Aprendizaje automatico de alias (decision de Julio: sin cola de aprobacion).
 * Cuando el operador corrige un punto, el literal original se agrega como alias
 * del canonico elegido. Salvaguarda dura: un literal NO puede ser alias de dos
 * canonicos. Todo alias guarda procedencia (reversible).
 *
 * @returns {{escribir, alias, alias_norm, id_punto, procedencia, conflicto,
 *            id_conflicto, ya_existe, motivo}}
 */
function aprenderAlias(literal, idCanonicoElegido, catalogo, procedencia) {
  var norm = normalizar(literal);
  if (!norm) { return { escribir: false, conflicto: false, ya_existe: false, motivo: 'literal vacio, no se aprende alias' }; }
  var idx = indexar(catalogo);
  var duenoActual = null, i;
  for (i = 0; i < idx.length; i++) {
    if (idx[i].norm === norm) { duenoActual = idx[i].id_punto; break; }
  }
  if (duenoActual !== null) {
    if (duenoActual === idCanonicoElegido) {
      return { escribir: false, conflicto: false, ya_existe: true, id_punto: idCanonicoElegido, alias: literal, alias_norm: norm, motivo: 'el literal ya resuelve a ese canonico; no se duplica' };
    }
    // CONFLICTO: el literal ya es alias/canonico de OTRO punto. No se escribe.
    return {
      escribir: false, conflicto: true, ya_existe: true, id_punto: idCanonicoElegido, id_conflicto: duenoActual,
      alias: literal, alias_norm: norm,
      motivo: 'CONFLICTO: "' + literal + '" ya resuelve a ' + duenoActual + '; no puede ser alias de ' + idCanonicoElegido + ' — a cola-puntos.json'
    };
  }
  return {
    escribir: true, conflicto: false, ya_existe: false,
    id_punto: idCanonicoElegido, alias: literal, alias_norm: norm,
    procedencia: procedencia || null,
    motivo: 'alias nuevo "' + literal + '" -> ' + idCanonicoElegido
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizar: normalizar,
    distanciaEdicion: distanciaEdicion,
    resolverPunto: resolverPunto,
    resolverPuntoDocFicha: resolverPuntoDocFicha,
    aprenderAlias: aprenderAlias,
    indexar: indexar
  };
}

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

// ===== TARIFA CONTRACTUAL para la ingesta (tabla Tarifas -> columna del viaje) ==
//
// Busca, para un viaje ya armado (cliente + origen + destino + material), su
// tarifa contractual en la tabla `Tarifas`. Es la pieza que cierra el circulo
// ingesta -> facturacion: hoy el viaje solo copia la tarifa que venga IMPRESA en
// la OC (casi nunca hay OC); esto la trae de la tabla de tarifas pactadas.
//
// DOS PUENTES (sin ellos no matchea, §):
//   Puente 1 — PUNTOS CANONICOS. Tarifas usa el NOMBRE del punto ("CALDAS DE
//     REIS"); el viaje trae el literal del documento ("CALDAS"). Se resuelve el
//     literal con resolver-punto.js y se matchea por el nombre canonico.
//   Puente 2 — RAZON SOCIAL. Tarifas usa la razon social completa ("FORESA
//     IND.QUIMICAS DEL NOROESTE, S.A."); el viaje trae el nombre corto ("FORESA").
//     Se matchea por CONTENCION de tokens normalizados (el corto dentro del largo),
//     sin necesidad de una columna nueva.
//
// NUNCA inventa: si no hay match unico devuelve tarifa:null + motivo (para REVISAR).
// Logica PURA. En el nodo, build-nodo.js inlinea resolver-punto.js antes.

'use strict';

var RP = (typeof resolverPunto === 'function')
  ? { resolverPunto: resolverPunto, normalizar: normalizar }
  : require('../catalogo/resolver-punto.js');

function norm(s) { return RP.normalizar(s); }
function num(x) {
  if (x === null || x === undefined || x === '') { return null; }
  if (typeof x === 'number') { return isFinite(x) ? x : null; }
  var n = Number(String(x).replace(',', '.'));
  return isFinite(n) ? n : null;
}

// Puente 2: el cliente corto del viaje matchea la razon social larga de Tarifas
// si TODOS sus tokens estan contenidos en la razon social (o coincidencia exacta).
function clienteCoincide(clienteViaje, clienteTarifa) {
  var a = norm(clienteViaje), b = norm(clienteTarifa);
  if (!a || !b) { return false; }
  if (a === b) { return true; }
  var tb = {}; b.split(' ').forEach(function (t) { if (t) { tb[t] = true; } });
  var ta = a.split(' ').filter(function (t) { return t.length >= 2; });
  if (!ta.length) { return false; }
  for (var i = 0; i < ta.length; i++) { if (!tb[ta[i]]) { return false; } }
  return true;
}

// Material: "Cualquiera"/vacio = comodin; si no, inclusion en cualquier sentido.
function materialCoincide(matViaje, matTarifa) {
  var mt = norm(matTarifa);
  if (!mt || mt === 'CUALQUIERA') { return true; }
  var mv = norm(matViaje);
  if (!mv) { return false; }
  return mv.indexOf(mt) >= 0 || mt.indexOf(mv) >= 0;
}

// Puente 1: literal de lugar -> nombre canonico del punto (para matchear Tarifas).
function canonPunto(literal, catalogo) {
  if (catalogo && catalogo.length) {
    var r = RP.resolverPunto(literal, 'documento', catalogo);
    if (r.id_punto) { return { n: norm(r.nombre_canonico), resuelto: true, revisar: !!r.revisar, id: r.id_punto }; }
  }
  return { n: norm(literal), resuelto: false, revisar: false, id: null };
}

/**
 * Busca la tarifa contractual del viaje.
 * @param {{cliente,origen,destino,material}} viaje
 * @param {Array} tarifas  filas de la tabla Tarifas {cliente,origen,destino,material,tarifa_tn,precio_fijo}
 * @param {Array} [catalogo]  filas de la tabla puntos (para resolver origen/destino)
 * @returns {null | {tarifa_tn, precio_fijo, material_tarifa, origen_canon, destino_canon, revisar} | {tarifa:null, motivo, candidatas?}}
 */
function buscarTarifaContractual(viaje, tarifas, catalogo) {
  if (!viaje || !Array.isArray(tarifas) || !tarifas.length) { return null; }
  var oc = canonPunto(viaje.origen, catalogo);
  var dc = canonPunto(viaje.destino, catalogo);
  if (!oc.n || !dc.n) { return { tarifa: null, motivo: 'origen/destino del viaje vacios; no se busca tarifa' }; }
  if (!norm(viaje.cliente)) { return { tarifa: null, motivo: 'viaje sin cliente resuelto; no se busca tarifa' }; }

  var cand = [];
  for (var i = 0; i < tarifas.length; i++) {
    var t = tarifas[i];
    if (!clienteCoincide(viaje.cliente, t.cliente)) { continue; }
    if (norm(t.origen) !== oc.n || norm(t.destino) !== dc.n) { continue; }
    if (!materialCoincide(viaje.material, t.material)) { continue; }
    cand.push(t);
  }
  if (cand.length === 0) {
    return { tarifa: null, motivo: 'sin tarifa cargada para ' + oc.n + ' -> ' + dc.n + ' (cliente ' + (norm(viaje.cliente)) + ')' };
  }
  // Preferir material ESPECIFICO sobre el comodin "Cualquiera".
  var esp = cand.filter(function (t) { var m = norm(t.material); return m && m !== 'CUALQUIERA'; });
  var elegidas = esp.length ? esp : cand;
  if (elegidas.length > 1) {
    return { tarifa: null, motivo: elegidas.length + ' tarifas posibles para ' + oc.n + ' -> ' + dc.n + ' — revisar cual aplica', candidatas: elegidas };
  }
  var g = elegidas[0];
  return {
    tarifa_tn: num(g.tarifa_tn),
    precio_fijo: num(g.precio_fijo),
    material_tarifa: g.material || null,
    origen_canon: oc.id, destino_canon: dc.id,
    revisar: oc.revisar || dc.revisar
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buscarTarifaContractual: buscarTarifaContractual,
    clienteCoincide: clienteCoincide,
    materialCoincide: materialCoincide,
  };
}

// ===== MINI-MAPA CHOFER -> TIPO DE CONDUCTOR ================================
//
// Marca cada viaje con el tipo de conductor (autonomo | dependiente) segun quien
// firma la ficha. Confirmado por Julio: son AUTONOMOS los apellidos Abal, Fraga y
// Alfonsin; el resto de la flota es DEPENDIENTE. Sirve para el regimen de
// facturacion (los autonomos liquidan distinto) y para la solapa AUTONOMOS de
// indexacion.
//
// OJO — match por APELLIDO EXACTO (token), no por substring: en la flota conviven
// "JUAN MANUEL ABAL" (autonomo) con "CARLOS ABALO" / "RUBEN ABELO" (dependientes).
// Un match por inclusion marcaria ABALO/ABELO como Abal por error. Por eso se
// comparan tokens completos normalizados, nunca fragmentos.
//
// Logica PURA (sin n8n). Reusa el normalizador de resolver-punto.js cuando esta
// inlineado; si no, cae a una normalizacion local equivalente.

'use strict';

var _N = (typeof normalizar === 'function')
  ? normalizar
  : function (s) {
      var t = (s === null || s === undefined) ? '' : String(s);
      return t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    };

// Apellidos autonomos (normalizados). Ampliar aqui si Julio suma otro autonomo.
var APELLIDOS_AUTONOMOS = { 'ABAL': true, 'FRAGA': true, 'ALFONSIN': true };

/**
 * Devuelve 'autonomo' | 'dependiente' segun el nombre del conductor.
 * Un chofer vacio/ilegible -> '' (no se afirma nada; queda a la vista).
 * @param {string} nombre  nombre libre tal como sale de la ficha
 */
function tipoConductor(nombre) {
  var norm = _N(nombre);
  if (!norm) { return ''; }
  var tokens = norm.split(' ');
  for (var i = 0; i < tokens.length; i++) {
    if (APELLIDOS_AUTONOMOS[tokens[i]]) { return 'autonomo'; }
  }
  return 'dependiente';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tipoConductor: tipoConductor, APELLIDOS_AUTONOMOS: APELLIDOS_AUTONOMOS };
}

// ===== DEDUPLICACION DE VIAJES (modelo-dominio-lectura.md §5.1) =============
//
// Logica PURA (testeable) del control de idempotencia al ingestar viajes. El
// wrapper del nodo Code "Preparar Filas Viajes" lee los viajes ya existentes de
// la tabla (nodo "Leer Viajes Existentes") y llama a `dedupViajes` antes de
// insertar. NO vive en correlacionar.js: correlacionar solo ve la subida actual;
// la dedup necesita la tabla `viajes` completa.
//
// Llave de identidad (§5.1): `matricula_tractora + km_inicio`. El odometro es
// estrictamente creciente; dos viajes distintos del mismo camion no comparten
// km_inicio. Distingue N viajes del mismo cliente/ruta/dia (rotaciones §7: cada
// rotacion tiene km_inicio distinto -> NO se deduplican entre si).
//
// Comportamiento:
//   - Llave nueva                -> INSERTAR.
//   - Llave ya existe, datos =   -> OMITIR (reingreso identico, duplicado puro).
//   - Llave ya existe, datos !=  -> OMITIR insercion + ACTUALIZAR (aditivo) el
//                                   motivo_revision de la fila existente, sin
//                                   pisar ningun otro dato (el humano pudo haber
//                                   corregido algo ahi). Lo ve en Pendientes.
//   - Misma ruta (matricula+fecha+cliente+origen+destino+material), km_inicio por
//     POCO distinto -> posible mismo viaje con km mal leido: INSERTAR pero marcar
//     REVISAR (no un duplicado encubierto; el humano resuelve).
//
// `UMBRAL_KM_INICIO` (constante nombrada): "por poco". Configurable.

'use strict';

// km de tolerancia para sospechar km_inicio mal leido. PARAMETRO AJUSTABLE: 50
// es el valor de arranque. Ojo con rutas CORTAS y dos vueltas seguidas: dos
// viajes reales del mismo camion/ruta/dia podrian quedar a <50 km entre si y
// caer en la salvaguarda (igual se insertan, solo se marcan REVISAR — no se
// pierde ninguno). Si con dato real eso genera ruido, bajar el umbral aca.
var UMBRAL_KM_INICIO = 50;

// Campos que definen si un reingreso "difiere" del viaje ya guardado.
var CAMPOS_COMPARA = ['fecha', 'cliente', 'origen', 'destino', 'material', 'referencia', 'kg_documento'];
// Firma de "misma ruta" para la salvaguarda de km por poco (§5.1).
var CAMPOS_RUTA = ['fecha', 'cliente', 'origen', 'destino', 'material'];

function matDedup(x) { return (x === null || x === undefined ? '' : String(x)).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function dstr(x) { return (x === null || x === undefined) ? '' : String(x); }
function kmNum(x) { var n = (typeof x === 'number') ? x : Number(x); return isFinite(n) ? n : null; }

function difierenEn(a, b, campos) {
  for (var i = 0; i < campos.length; i++) { if (dstr(a[campos[i]]) !== dstr(b[campos[i]])) { return true; } }
  return false;
}

/**
 * @param {Array<object>} candidatos  viajes de la subida actual (a insertar).
 * @param {Array<object>} existentes  filas ya en la tabla `viajes`.
 * @param {object} [opts] {umbralKm}
 * @returns {{insertar:Array, actualizarMotivo:Array<{id,motivo_revision,estado_lectura}>, omitidos:Array}}
 *   `insertar`: filas a insertar (algunas con _motivo_dedup mergeado por el wrapper).
 *   `actualizarMotivo`: updates ADITIVOS de motivo sobre filas existentes (reingreso con diff).
 *   `omitidos`: reingresos identicos (duplicado puro), no se insertan.
 */
function dedupViajes(candidatos, existentes, opts) {
  var umbral = (opts && typeof opts.umbralKm === 'number') ? opts.umbralKm : UMBRAL_KM_INICIO;
  var cand = Array.isArray(candidatos) ? candidatos : [];
  var exist = Array.isArray(existentes) ? existentes : [];

  // Indexar existentes por matricula normalizada.
  var porTractora = {};
  for (var e = 0; e < exist.length; e++) {
    var t = matDedup(exist[e].tractora);
    if (!t) { continue; }
    if (!porTractora[t]) { porTractora[t] = []; }
    porTractora[t].push(exist[e]);
  }

  var insertar = [], actualizarMotivo = [], omitidos = [];
  var llavesInsertadas = {}; // dedup intra-lote (misma subida trae la misma llave)

  for (var c = 0; c < cand.length; c++) {
    var r = cand[c];
    var t2 = matDedup(r.tractora);
    var km = kmNum(r.km_inicio);

    // Sin llave utilizable (sin matricula o sin km_inicio): no se puede deduplicar
    // -> se inserta (mejor una fila de mas visible que perder un viaje en silencio).
    if (!t2 || km === null) { insertar.push(r); continue; }

    var llave = t2 + '|' + km;
    if (llavesInsertadas[llave]) { omitidos.push(r); continue; } // duplicado dentro del mismo lote

    var mismos = porTractora[t2] || [];

    // 1) Match EXACTO de llave (mismo camion, mismo km_inicio) = reingreso.
    var exacto = null;
    for (var m = 0; m < mismos.length; m++) { if (kmNum(mismos[m].km_inicio) === km) { exacto = mismos[m]; break; } }
    if (exacto) {
      if (difierenEn(r, exacto, CAMPOS_COMPARA)) {
        var motivoBase = dstr(exacto.motivo_revision);
        var motivoReingreso = 'reingreso de viaje ya existente (matricula ' + dstr(r.tractora) + ' km ' + km + '): datos nuevos difieren, verificar';
        actualizarMotivo.push({
          id: exacto.id,
          // ADITIVO: se conserva el motivo previo (y cualquier correccion del humano
          // que lo haya tocado); solo se suma el aviso de reingreso.
          motivo_revision: motivoBase ? (motivoBase + '; ' + motivoReingreso) : motivoReingreso,
          estado_lectura: 'REVISAR'
        });
      } else {
        omitidos.push(r); // reingreso identico: duplicado puro, se omite
      }
      continue;
    }

    // 2) Salvaguarda km mal leido: misma RUTA, km_inicio por poco distinto.
    var cerca = null;
    for (var n = 0; n < mismos.length; n++) {
      var ke = kmNum(mismos[n].km_inicio);
      if (ke === null) { continue; }
      var dist = Math.abs(ke - km);
      if (dist > 0 && dist <= umbral && !difierenEn(r, mismos[n], CAMPOS_RUTA)) { cerca = mismos[n]; break; }
    }
    if (cerca) {
      r._motivo_dedup = 'posible mismo viaje con km_inicio discrepante: ' + km + ' vs ' + kmNum(cerca.km_inicio) + ' — verificar (no duplicar)';
    }
    // Viaje distinto (o sospecha marcada): se inserta.
    llavesInsertadas[llave] = true;
    insertar.push(r);
  }

  return { insertar: insertar, actualizarMotivo: actualizarMotivo, omitidos: omitidos };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UMBRAL_KM_INICIO: UMBRAL_KM_INICIO,
    CAMPOS_COMPARA: CAMPOS_COMPARA,
    dedupViajes: dedupViajes
  };
}

// Nodo Code "Preparar Filas Viajes" del workflow [ESTEVEZ] Ingesta Viaje
// (WD0q9Ic0oDvUoJwp). Arma UNA fila de la tabla `viajes` por cada viaje del
// datos_json de "Formatear Linea Gesruta".
//
// Traido al repo como fuente de verdad en Fase 2: este nodo NO estaba versionado
// y ahi nacio el bug de `estado_lectura` (columna creada, no mapeada -> null en
// silencio). Toda columna nueva de `viajes` DEBE emitirse aca Y mapearse en el
// nodo dataTable "Guardar Viajes" (schema + value). Verificar por readback, no
// por codigo.
//
// Fase 2 (modelo albaran=unidad):
//   - estado: ahora es el estado UNICO de documentacion del correlacionador
//     (con_documentacion | PENDIENTE_DOCUMENTACION), no el viejo pendiente/
//     sin_documentacion. Ningun consumidor filtra por los valores viejos
//     (unico lector: Export Viajes Excel, passthrough). Conviven ambos
//     vocabularios en filas viejas; no hace falta migrar.
//   - columnas nuevas: regimen_indexacion, origen_km, origen_campos (audit JSON),
//     pendiente_falta, pendiente_reclamar_a.

const src = $('Formatear Linea Gesruta').first().json;
if (!src.ok || !src.datos_json) { return []; }
let S;
try { S = JSON.parse(src.datos_json); } catch (e) { return []; }
const viajes = Array.isArray(S.viajes) ? S.viajes : [];
let hojasGuardadas = [];
try { hojasGuardadas = $('Guardar Hoja').all(); } catch (e) {}
const idDe = function (idx) {
  const it = hojasGuardadas[idx];
  return (it && it.json && it.json.id !== undefined && it.json.id !== null) ? String(it.json.id) : '';
};
const s = function (x) { return (x === null || x === undefined) ? '' : String(x); };
const n = function (x) { return (typeof x === 'number' && isFinite(x)) ? x : null; };
// Porte / pais de facturacion: se conserva la regla de dominio del formateador v2.
const paisDe = function (cli, ref) {
  const c = (cli || '').toString().toUpperCase();
  if (!c) { return ''; }
  if (c.indexOf('RNM') >= 0) { return 'PT'; }
  if (c.indexOf('QUIMIDROGA') >= 0) {
    const d = (ref || '').toString().replace(/\D/g, '');
    if (d.indexOf('100') === 0) { return 'PT'; }
    if (d.indexOf('70') === 0) { return 'ES'; }
    return '';
  }
  return 'ES';
};
// ---- Tarifa contractual (tabla Tarifas -> columna del viaje) ----------------
// Reusa buscarTarifaContractual (inlineado, con resolver-punto delante). Los
// nodos lectores son OPCIONALES: si "Leer Tarifas"/"Leer Puntos" no existen aun
// (deploy parcial), degrada a vacio en vez de romper — mismo patron defensivo que
// la dedup. NUNCA inventa: sin match unico deja la tarifa vacia y el motivo a la
// vista para REVISAR.
// Los nodos dataTable `get` se ejecutan UNA vez por item de entrada y CONCATENAN
// su salida: si entran N items, cada fila de Tarifas/puntos aparece N veces. Sin
// deduplicar, buscarTarifaContractual veria la misma tarifa repetida y marcaria
// "2 tarifas posibles" (falsa ambiguedad). Se deduplican por identidad de fila.
function _leerTabla(nombre) {
  var filas = [];
  try { filas = $(nombre).all().map(function (it) { return (it && it.json) ? it.json : {}; }); } catch (e) { return []; }
  var vistos = {}, out = [];
  for (var i = 0; i < filas.length; i++) {
    var k = JSON.stringify(filas[i]);
    if (vistos[k]) { continue; }
    vistos[k] = true; out.push(filas[i]);
  }
  return out;
}
let tarifasTbl = _leerTabla('Leer Tarifas');
let puntosTbl = _leerTabla('Leer Puntos');
// Punto canonico Gesruta para MOSTRAR en origen/destino: "codigo · NOMBRE". El
// literal leido se conserva en `detalle`/origen_campos (no se pierde). Si no
// resuelve con seguridad, se deja el literal tal cual; el resolver ya marca
// REVISAR aparte cuando la resolucion no es exacta.
// LUGAR vs EMPRESA (ejec. 975): para identidad (cliente/referencia/kg) el
// documento manda, pero para el LUGAR suele escribir la EMPRESA ("FORESA IND.
// QUIMICAS...", "CELLMARK", "COMQUIMICOS...REVI") donde la ficha escribe el
// pueblo ("Caldas", "Barcelona", "Orense"). Una razon social no resuelve a punto
// Gesruta -> sin punto no hay tarifa. Cascada: se prueba el literal del documento
// y, si no resuelve, el de la ficha. (Cuando se carguen los alias empresa->punto
// el primero resolvera solo; hasta entonces la ficha es la red de seguridad.)
const mejorLiteralPunto = function (literalDoc, literalFicha) {
  if (typeof resolverPunto !== 'function' || !puntosTbl.length) { return literalDoc || literalFicha || ''; }
  if (literalDoc) {
    const r1 = resolverPunto(literalDoc, 'documento', puntosTbl);
    if (r1 && r1.id_punto) { return literalDoc; }
  }
  if (literalFicha) {
    const r2 = resolverPunto(literalFicha, 'ficha', puntosTbl);
    if (r2 && r2.id_punto) { return literalFicha; }
  }
  return literalDoc || literalFicha || '';
};
const puntoGesruta = function (literal) {
  if (!literal) { return ''; }
  if (typeof resolverPunto !== 'function' || !puntosTbl.length) { return s(literal); }
  const r = resolverPunto(literal, 'documento', puntosTbl);
  return (r && r.id_punto) ? (r.id_punto + ' · ' + r.nombre_canonico) : s(literal);
};
const tarifaDe = function (v, origenLit, destinoLit) {
  if (typeof buscarTarifaContractual !== 'function' || !tarifasTbl.length) { return { tn: null, fijo: null, motivo: '' }; }
  const r = buscarTarifaContractual({ cliente: v.cliente, origen: origenLit, destino: destinoLit, material: v.material }, tarifasTbl, puntosTbl);
  if (!r) { return { tn: null, fijo: null, motivo: '' }; }
  if (r.tarifa === null) { return { tn: null, fijo: null, motivo: r.motivo || '' }; }
  return { tn: r.tarifa_tn, fijo: r.precio_fijo, motivo: r.revisar ? ('tarifa via punto resuelto — verificar (' + s(origenLit) + '->' + s(destinoLit) + ')') : '' };
};

const filas = [];
for (const v of viajes) {
  // Literal de lugar que SI resuelve a punto (documento, si no la ficha).
  const origenLit = mejorLiteralPunto(v.origen, v.lugar_carga);
  const destinoLit = mejorLiteralPunto(v.destino, v.lugar_descarga);
  const tar = tarifaDe(v, origenLit, destinoLit);
  filas.push({
    hoja_id: idDe(v.hoja_idx),
    orden: n(v.orden),
    fecha: s(v.fecha_carga),
    empresa: s(v.empresa),
    tractora: s(v.tractora),
    semi: s(v.remolque),
    conductor: s(v.conductor),
    // Mini-mapa chofer -> tipo (autonomo | dependiente). Abal/Fraga/Alfonsin son
    // autonomos (confirmado Julio); el resto, dependientes. Vacio si no hay chofer.
    tipo_conductor: (typeof tipoConductor === 'function') ? tipoConductor(v.conductor) : '',
    cliente: s(v.cliente),
    // origen/destino como punto canonico Gesruta "codigo · NOMBRE" (el literal
    // leido queda en detalle/origen_campos). La tarifa se calcula arriba con el
    // literal crudo (buscarTarifaContractual resuelve por su cuenta).
    origen: puntoGesruta(origenLit),
    destino: puntoGesruta(destinoLit),
    material: s(v.material),
    referencia: s(v.referencia),
    tipo_doc: s(v.tipo_doc),
    kg_documento: n(v.kg_documento),
    kg_hoja: n(v.cantidad_kg),
    fuente_peso: s(v.fuente_peso),
    importe_documento: n(v.importe_documento),
    tarifa_tn_documento: n(v.tarifa_tn_documento),
    // Tarifa CONTRACTUAL (de la tabla Tarifas, no de la OC impresa). Vacia si no
    // hay match unico; el motivo dice por que (para REVISAR sin inventar).
    tarifa_contractual_tn: n(tar.tn),
    tarifa_contractual_fijo: n(tar.fijo),
    tarifa_contractual_motivo: s(tar.motivo),
    pais_facturacion: paisDe(v.cliente, v.referencia),
    fecha_descarga: s(v.fecha_descarga),
    km_inicio: n(v.km_inicio),
    km_final: n(v.km_final),
    km_cargados: n(v.km_cargados),
    km_vacios: n(v.km_vacios),
    // Calidad de LECTURA de la ficha (v3.2). Eje distinto de `estado`, que habla
    // de documentacion. Sin valor por defecto: si el correlacionador no lo puso,
    // queda vacio y se ve como no determinado, nunca como un OK.
    estado_lectura: s(v.estado_lectura),
    motivo_revision: s(v.motivo_revision),
    pagina_origen: n(v.pagina_origen),
    // Estado UNICO de documentacion (§3). Lo decide el correlacionador.
    estado: s(v.estado),
    // Fase 2: columnas nuevas (todas mapeadas tambien en "Guardar Viajes").
    regimen_indexacion: s(v.regimen_indexacion),
    origen_km: s(v.origen_km),
    origen_campos: v.origen_campos ? JSON.stringify(v.origen_campos) : '',
    pendiente_falta: s(v.pendiente_falta),
    pendiente_reclamar_a: s(v.pendiente_reclamar_a),
    // CAMBIO 3: ciclo de carga (eje distinto de `estado`=documentacion). Default
    // al ingresar. Regla de oro: mapear tambien en "Guardar Viajes". El robot
    // Gesruta (Pieza C) escribira 'cargada_gesruta'; aca solo el default.
    estado_carga: 'pendiente_revision',
    factura_id: '',
    detalle: JSON.stringify(v)
  });
}

// ---- Deduplicacion (§5.1) ---------------------------------------------------
// Idempotencia al reingestar: NO crear una segunda fila de un viaje ya guardado.
// Llave de identidad = matricula_tractora + km_inicio (odometro estrictamente
// creciente; distingue rotaciones del mismo dia/ruta, §7). La logica pura vive en
// dedup.js (inlineada por build-nodo.js). Lee los viajes ya en la tabla del nodo
// "Leer Viajes Existentes". Si ese nodo aun no existe (deploy parcial), degrada a
// "insertar todo" en vez de romper el pipeline — mismo patron defensivo que
// "Guardar Hoja" arriba.
let existentes = [];
try {
  existentes = $('Leer Viajes Existentes').all().map(function (it) { return (it && it.json) ? it.json : {}; });
} catch (e) { existentes = []; }

const ded = (typeof dedupViajes === 'function')
  ? dedupViajes(filas, existentes)
  : { insertar: filas, actualizarMotivo: [], omitidos: [] };

const out = [];
// (1) Filas NUEVAS -> se insertan (van al IF por la rama "no update" -> Guardar
// Viajes). Si la dedup sospecha km_inicio mal leido (misma ruta, km por poco),
// se suma el motivo y se fuerza REVISAR: se inserta pero visible, no encubierto.
for (const f of ded.insertar) {
  if (f._motivo_dedup) {
    f.motivo_revision = f.motivo_revision ? (f.motivo_revision + '; ' + f._motivo_dedup) : f._motivo_dedup;
    f.estado_lectura = 'REVISAR';
  }
  delete f._motivo_dedup;
  out.push({ json: f });
}
// (2) Reingresos con datos que DIFIEREN -> NO se insertan; se actualiza (ADITIVO)
// el motivo_revision de la fila existente. Tag `_dedup_update` para que el IF los
// enrute al dataTable "Actualizar Motivo Viaje" (update por id). Solo se tocan
// motivo_revision y estado_lectura: ningun otro dato de la fila (el humano pudo
// haber corregido algo ahi).
for (const u of ded.actualizarMotivo) {
  out.push({ json: { _dedup_update: true, id: u.id, motivo_revision: u.motivo_revision, estado_lectura: u.estado_lectura } });
}
// (3) ded.omitidos = reingresos identicos (duplicado puro): no se emiten.
return out;
