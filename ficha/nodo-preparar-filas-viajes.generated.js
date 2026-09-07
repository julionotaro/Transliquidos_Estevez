// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/../catalogo/resolver-punto.js + ficha/../catalogo/gesruta.js + ficha/tarifa-contractual.js + ficha/rutas-conocidas.js + ficha/plantillas.js + ficha/../catalogo/tarifa-por-analogia.json (como ANALOGIAS_EMBEBIDAS) + ficha/../catalogo/rutas-por-cliente-test.json (como RUTAS_CLIENTE_EMBEBIDAS) + ficha/../catalogo/plantillas-cliente.json (como PLANTILLAS_EMBEBIDAS) + ficha/conductores.js + ficha/dedup.js + ficha/nodo-preparar-filas-viajes.wrapper.js
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
                    ' POLIGONO ', ' POL ', ' IND ', ' PUERTO ',
                    // Marcador de PAIS en el catalogo Gesruta: "LEIRIA (PT)",
                    // "ALCANENA(PT)". El documento escribe solo la localidad, asi
                    // que el marcador impide el match. No aporta identidad: el
                    // codigo del punto ya distingue.
                    ' PT ', ' PORTUGAL ', ' ESPANA ', ' SPAIN '];

// Abreviaturas toponimicas portuguesas/gallegas: la ficha y los documentos
// escriben "V.N. Famalicao" o "Vila Nova de Famalicao" y Gesruta "VILANOVA
// FAMALICAO". Es convencion de escritura, no ambiguedad: se unifican antes de
// comparar. Se aplican como frase, tras limpiar la puntuacion.
var ABREVIATURAS = [
  [' V N ', ' VILANOVA '], [' VILA NOVA ', ' VILANOVA '], [' VN ', ' VILANOVA '],
  [' STO ', ' SANTO '], [' STA ', ' SANTA '], [' S ', ' SAN ']
];

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
  for (i = 0; i < ABREVIATURAS.length; i++) { while (s.indexOf(ABREVIATURAS[i][0]) >= 0) { s = s.replace(ABREVIATURAS[i][0], ABREVIATURAS[i][1]); } }
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
    // Gana el que aparece ANTES en el literal, no el mas largo: las direcciones
    // van de lo ESPECIFICO a lo GENERAL ("Navia Asturias", "Monte Redondo -
    // Leiria", "Teixeiro (Curtis)"). Con "el mas largo" se elegia ASTURIAS (la
    // provincia) sobre NAVIA (el pueblo), que es el punto real de descarga.
    // A igual posicion, desempata el mas largo (mas especifico).
    var dentro = {}, mejorPos = -1, mejorLen = 0;
    var espaciado = ' ' + norm + ' ';
    for (i = 0; i < idx.length; i++) {
      var cand = idx[i].norm;
      if (!cand || cand.length < 4) { continue; }
      var pos = espaciado.indexOf(' ' + cand + ' ');
      if (pos < 0) { continue; }
      if (mejorPos < 0 || pos < mejorPos || (pos === mejorPos && cand.length > mejorLen)) {
        mejorPos = pos; mejorLen = cand.length; dentro = {};
      }
      if (pos === mejorPos && cand.length === mejorLen) { dentro[idx[i].id_punto] = idx[i]; }
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
// CATALOGO DE MATERIAL: los 558 codigos del listado oficial de Gesruta
// (Materiales.csv, columnas Cod.Car. / Carga). CHOFERES: los 25 del export real.
//
// Logica PURA (sin n8n). Los catalogos se pueden inyectar (data table a futuro).

'use strict';

// --- Catalogo de MATERIAL: codigo Gesruta -> nombre canonico ----------------
var MATERIALES = {
  "ESTEAR":"A.ESTEARICO", "A12666":"A126666", "79":"ABONO", "13":"ABONO FRA. 06/4",
  "ABONO":"ABONO FRA.07/120", "AC8":"AC81511", "21":"ACEITE", "AQUILA":"ACET.ALQUILAMINA",
  "98":"ACETATO", "24":"ACETATO DE BUTILO", "31":"ACETATO DE ETILO",
  "VINILO":"ACETATO DE VINILO", "ISOBUT":"ACETATO ISOBUTILO", "53":"ACETATO METILO",
  "ACETON":"ACETONA", "ACETIC":"ACIDO ACETICO", "102":"ACIDO ACRILICO",
  "CITRIC":"ACIDO CITRICO", "100":"ACIDO CLORH.", "FENOLS":"ACIDO FENOLSOFINICO",
  "FORMIC":"ACIDO FORMICO", "67":"ACIDO FOSFORICO", "FUMARI":"ACIDO FUMARICO",
  "ACIDOG":"ACIDO GRASO", "INORGA":"ACIDO INORGANICO", "METACR":"ACIDO METACRILICO",
  "89":"ACIDO NITRICO", "OLEICO":"ACIDO OLEICO", "PALMIT":"ACIDO PALMITICO",
  "PROPIO":"ACIDO PROPIONICO", "ACIDOS":"ACIDO SULFONICO", "20":"ACIDO SULFURICO",
  "ARILSU":"ACIDOS ARILSULFORNICOS", "ACIFEE":"ACIFEED", "ACRELA":"ACRELATO BUTILO",
  "ACREL":"ACRELATO ETILO", "ACRETI":"ACRIL.ETILO", "ACRODU":"ACRODUR", "37":"ACRONAL",
  "ADBLUE":"ADBLUE", "ADDITI":"ADDITIF", "ADICRI":"ADICRIL", "14":"ADITIVO", "AEMOIL":"AEMOIL",
  "11":"AGUA", "DESMIN":"AGUA DESMINER.", "76":"AGUARDIENTE", "AGUARR":"AGUARRAS",
  "50":"AGUAS RESIDUALES", "AIRBLU":"AIRBLUE", "103":"ALAMBRE", "ALARIA":"ALARIA",
  "83":"ALCOHOL", "26":"ALCUPOL", "ALIMEN":"ALIMENTACION", "ALKANO":"ALKANOLAMINE",
  "ALQUIL":"ALQUILER", "BULK":"ALS-LC BULK", "ALUMNA":"ALUMINATO SODICO", "ALUMIN":"ALUMINIO",
  "ALULIQ":"ALUMINIO LIQUIDO", "33":"AMONIACO", "ANDAMI":"ANDAMIOS", "ANILIN":"ANILINA",
  "APERIT":"APERITIVOS", "AQUA":"AQUA-QUENCH", "ARGINA":"ARGINA", "ARROZ":"ARROZ",
  "ARTPIS":"ART.PISCINAS", "ASFALT":"ASFALTO", "AUTOMO":"AUTOMOCION", "AXILA":"AXILAT",
  "96":"AZEOTROPO", "AZUCAR":"AZUCAR", "BAKELI":"BAKELITE", "BANAST":"BANASTAS",
  "BARAN":"BARANDILLAS", "BARQUA":"BARQUAT", "BATERI":"BATERIAS", "BAZAR":"BAZAR",
  "BRIAL":"BD BRIAL", "48":"BEBIDAS", "BENCEN":"BENCENOGT", "BETA":"BETA MSHF",
  "BETUN":"BETUN ALSF.", "BIDONE":"BIDONES", "BIODIE":"BIODIESEL", "BIOETA":"BIOETANOL",
  "OIL":"BIOHEATING OIL", "BIOPOL":"BIOPOL", "46":"BISULFITO SODICO", "BOBIN":"BOBINAS",
  "BOBINA":"BOBINAS HOJALATA", "BOLLER":"BOLLERIA", "43":"BORRASPERSE", "BOTELL":"BOTELLAS",
  "87":"BRADOL", "12669":"BREAS-DISTILL.RESIDUE", "BROQUE":"BROQUETAS", "BRYTEN":"BRYTEN",
  "BUTANO":"BUTANOL", "BUTILD":"BUTILDIGLICOL", "BUTIL":"BUTILGLICOL", "BUTYL":"BUTYLGLYCOL",
  "C810":"C-810L", "CABALL":"CABALLETES", "10":"CABEZA TR.", "CAFE":"CAFE", "CAJAS":"CAJAS",
  "CAJA":"CAJAS", "CAMBIO":"CAMBIO PAPELES", "CAPRI":"CAPRILATO METILO", "CARBOM":"CARBOMAP",
  "BARIO":"CARBONATO BARIO", "CARGA":"CARGA ADICIONAL", "CARDES":"CARGA/DESCARGA",
  "12672":"CARGA/DESCARGA COLA PINATURE", "93":"CARGAS", "101":"CARNE", "CARTON":"CARTON",
  "CATAL":"CATALYST BDMA", "CATALY":"CATLYST", "CAUCHO":"CAUCHO", "CBA":"CBA 1140",
  "CEBOLL":"CEBOLLAS", "CELTIS":"CELTIS 902", "CEMENT":"CEMENTO", "CERVEZ":"CERVEZA",
  "CHAPA":"CHAPA", "CHOCOL":"CHOCOLATE", "CHRYSO":"CHRYSO", "CICLOH":"CICLOHEXANO",
  "CIDOMI":"CIDOMIX", "CIPTON":"CIPTON", "ABO\u00d1O":"CISTERNA EN ABOÑO",
  "12":"CISTERNA EN DEPOSITO", "CALCIC":"CLOR.CALCICO", "CLORAT":"CLORATO", "CLORIT":"CLORITO",
  "CLOALU":"CLORURO DE ALUMINIO", "28":"CLORURO DE METILENO", "CLT":"CLT-105",
  "CMS":"CMS-VINAZA", "1":"COLA", "FENOLI":"COLA FENOLICA", "ROJA":"COLA ROJA",
  "17":"COLA SACO", "COLAFO":"COLA/FORMOL", "COLCHO":"COLCHONES", "COLOR":"COLORANTE",
  "COMEST":"COMESTIBLES", "COMPLE":"COMPLEMENTO", "CG/CAJ":"CONGELAD/CAJAS", "6":"CONGELADO",
  "CG/MAQ":"CONGELADO/MAQUINAS", "CG/REF":"CONGELADO/REFRIGERADO", "15":"CONSERVA",
  "CONTEN":"CONTENEDORES", "CONTRA":"CONTRAPESOS", "CRISTA":"CRISTAL", "12677":"CUTMAX",
  "D40":"D 40", "DABEER":"DABEERSEN", "DABERS":"DABEERSEN", "DEHYDO":"DEHYDOL",
  "DEHYT":"DEHYTON", "DEMULS":"DEMULSENE", "DERMUL":"DERMULSENE", "DESCAR":"DESCARGA",
  "12671":"DESCARGA EN SABADO", "DESPLA":"DESPLAZAMIENTO", "DESVIO":"DESVIO",
  "DETERG":"DETERGENTE", "DEVOLU":"DEVOLUC.COLA", "DEVOL.":"DEVOLUC.MERCANCIA",
  "DEV":"DEVOLUCION", "DIACET":"DIACETONA ALCOHOL", "DIAMIN":"DIAMIN T",
  "DIETAN":"DIETANOLAMINA", "61":"DIETILENGLICOL", "DIMETI":"DIMETILBENC.",
  "DIM":"DIMETILFORM.", "DIPROP":"DIPROPILENGLICOL", "90":"DISOLVENTE", "DIVOST":"DIVOSTAR",
  "58":"DK-FLOC", "DMBA":"DMBA", "DOP":"DOP", "DOTP":"DOTP", "DOWANO":"DOWANOL",
  "DP":"DP 5/50", "DROGUE":"DROGUERIA", "DROVI":"DROVISOL", "EASYCO":"EASYCOL", "63":"ECOLUBE",
  "EKA":"EKA", "1374":"ELECTROCLOR", "ELECTR":"ELECTRODOMEST.", "EMPAT":"EMPATEN",
  "EMULSI":"EMULSIBER", "EMULTE":"EMULTEX", "ENVASA":"ENVASADO", "ENV":"ENVASES",
  "82":"ENVASES BEBIDAS", "DIRECT":"ENVIO DIR.", "12670":"EQ-23-V", "ESPUMA":"ESPUMA",
  "ESTERM":"ESTERMETIL", "59":"ESTIRENO", "ETANOL":"ETANOL", "ETHYL":"ETHYLHEXANOL",
  "EXPOSI":"EXPOSITORES", "EXTENS":"EXTENSOIL", "EXTRAC":"EXTRACTO 60",
  "FECULA":"FECULA PATATA", "FENNOS":"FENNOSIZE", "TRENGH":"FENNOSTRENGHT",
  "FENOL":"FENOL FUNDIDO", "FERRET":"FERRETERIA", "FERRIC":"FERRICALAR",
  "FERTIL":"FERTILIZANTE", "FIBROC":"FIBROCEMENTO", "41":"FIMAPAN", "55":"FIMAPAN/PALETS",
  "FINCAT":"FINCAT", "FINTES":"FINRES TEST", "FLEJE":"FLEJE", "FLOCU":"FLOCUSOL",
  "FLOQUA":"FLOQUAT", "FLOTAD":"FLOTADORES", "70":"FLUBE", "FORLAC":"FORLAC 75",
  "FORMIP":"FORMIPRO", "3":"FORMOL", "FORMET":"FORMOL/METANOL", "FOSFAT":"FOSFATION",
  "80":"FR CROS", "FRUTA":"FRUTA", "FRUTCO":"FRUTA-CONG.", "2":"FUEL", "CALDE":"FUEL CALD.",
  "FUNGI":"FUNGI-GAL", "8":"GALLETAS", "GARDOB":"GARDOBOND", "GARDO":"GARDOCLEAN",
  "GASOLE":"GASOLEO", "35":"GEOTEX HD 40", "GLICER":"GLICERINA", "GLICOL":"GLICOL",
  "GOMAS":"GOMAS", "GRANA":"GRANALLA", "GRANOD":"GRANODINE", "GRASA":"GRASA",
  "GRINCO":"GRINCO M", "GRUPAJ":"GRUPAJE", "18":"HARINA", "60":"HAVOLINE", "HELAD":"HELADOS",
  "99":"HEPTANO", "HEXAMO":"HEXAMOLL", "HEXANO":"HEXANO", "HIDR":"HIDROXIDO POTASICO",
  "65":"HIDROXIDO SODICO", "HIELO":"HIELO", "HIERRO":"HIERRO", "HOJAL":"HOJALATA",
  "HOOPOL":"HOOPOL", "HUEVOS":"HUEVOS", "IBERPA":"IBERPAN", "ILUMIN":"ILUMINACION",
  "IMPRES":"IMPRESS", "INOPON":"INOPON", "IPA":"IPA", "IQOXIN":"IQOXINOL", "ISOB":"ISOBUTANOL",
  "91":"ISOPROPANOL", "16":"JABON", "JAYFLE":"JAYLEX DINP", "JUGUET":"JUGUETES",
  "KEMFLU":"KEMFLUID", "KYMENE":"KYMENE", "LACTEO":"LACTEOS", "LADRIL":"LADRILLO",
  "LASACI":"LASACID", "LATEX":"LATEX", "LAURIL":"LAURIL ETER", "25":"LAVADO",
  "LECHAV":"LECHAVIT", "LECHE":"LECHE", "LEUCOP":"LEUCOPHOR", "FLEX":"LG FLEX",
  "LIAS":"LIAS VINO", "LIBROS":"LIBROS", "38":"LIGNEX NAL", "42":"LIGNEX NAL",
  "LIGNOB":"LIGNOBOND", "KA\u00d1A":"LIGNOKAÑA", "LIGNOK":"LIGNOKAÑA", "34":"LIGNOSULFONATE",
  "LINOSU":"LINOSULFORATO", "ORGAN":"LIQ.ORGAN.CORROSIVO", "62":"LISINA", "LUPRO":"LUPROMIX",
  "MADERA":"MADERA", "MAGNES":"MAGNESITA", "MAMMFO":"MAMMFOR", "MANGAN":"MANGANESO",
  "MANTEC":"MANTECA", "MAQUIN":"MAQUINA", "MAQU":"MAQUINAS", "MARGAR":"MARGARINA",
  "MARMOL":"MARMOL", "MASPHA":"MASPHATE", "MAT":"MAT 330D", "OBRA":"MAT. OBRA",
  "1373":"MATERIAL FERIA", "MEG":"MEG", "MELAZA":"MELAZA", "VARIAS":"MERCANC.VARIAS",
  "METAL":"METAL", "METALT":"METALEST", "5":"METANOL", "METANO":"METANOL DEVUELTO",
  "METHAN":"METHAM-NA", "METHYL":"METHYL GLYCOL", "77":"METIL ESTER", "METIL":"METIL ESTER",
  "ETER":"METIL ETER", "22":"METIL ETIL CETONA", "METILP":"METIL PROXITOL",
  "METMET":"METILMETACRILATO", "97":"METILO", "METOXI":"METOXIPROPANOL",
  "METROX":"METROXIPROPILO", "MEXIFL":"MEXIFLEX", "MONOET":"MONOETHANOLAMINA",
  "MONOE":"MONOETILENGLICOL", "45":"MOWILIT", "MUEBLE":"MUEBLES", "N32":"N-32",
  "NARANJ":"NARANJAS", "NATA":"NATA", "NEMOL":"NEMOL", "AMONIC":"NITR.AMONICO",
  "ETILHE":"NITR.ETILHEXILO", "NITRMA":"NITRAT.MAGNES.", "36":"NOPCOMASTER", "NORLAN":"NORLAN",
  "73":"NORSODYNE", "NOVA":"NOVADEX", "1375":"NTA NA3", "NYFLEX":"NYFLEX", "NYTEX":"NYTEX",
  "29":"NYTRO", "NITRO":"NYTRO TAURUS", "OLCUPO":"OLCUPOL", "OLEINA":"OLEINA", "47":"OROTAN",
  "OXIDMA":"OXIDO DE MANGANESO", "OXILAN":"OXILAN", "OXSILA":"OXSILAN", "PAJA":"PAJA",
  "68":"PALATINOL", "PALETI":"PALETIZADO", "54":"PALETS", "PALLET":"PALLETS", "PAN":"PAN",
  "PANCON":"PAN CONGELADO", "RALLAD":"PAN RALLADO", "PANEL":"PANEL", "PANELE":"PANELES",
  "PAPEL":"PAPEL", "32":"PAPEL HIGIENICO", "PAQUET":"PAQUETERIA", "PARAC":"PARACHLOR-52",
  "4":"PARAFINA", "PARAFL":"PARAFLOU FO2", "39":"PARALIZACION", "PARALI":"PARALIZACION",
  "PASCAL":"PASCAL", "PASTAP":"PASTA DE PAPEL", "PASTA":"PASTA PAPEL", "66":"PATATAS",
  "PAVIME":"PAVIMENTOS", "PAX":"PAX", "PA\u00d1ALE":"PAÑALES", "PEAJES":"PEAJES",
  "PELLET":"PELLETS", "PERCLO":"PERCLORORETILENO", "92":"PESCADO", "12667":"PET 9331",
  "PETRIL":"PETRIL", "PETROS":"PETROSOL", "PIEDRA":"PIEDRA", "PIENSO":"PIENSO",
  "PIGMEN":"PIGMENTANTE", "PINATU":"PINATURE", "PINTUR":"PINTURA", "PIROTE":"PIROTECNIA",
  "PISCIN":"PISCINAS", "PIZARR":"PIZARRA", "PLADUR":"PLADUR", "PLANTA":"PLANTAS",
  "PLAS":"PLASTICOS", "PLASTI":"PLASTIFICANTE", "PLAXTE":"PLAXTER", "PLETIN":"PLETINA",
  "1372":"PO 1372 R", "POLIAM":"POLIAMINAS", "84":"POLICLORURO", "POLIET":"POLIETILENGLICOL",
  "POLIFL":"POLIFLUX", "POLIFO":"POLIFOSFATO", "POLI":"POLIOL", "POLIOL":"POLIOLESINA",
  "POLYFO":"POLYFOAN", "POLYNT":"POLYNT", "POLYOL":"POLYOL", "PHOSPH":"POLYPHOSPHATE",
  "POLYSO":"POLYSOL", "95":"PORCELANA", "POS":"POS COD", "POTASA":"POTASA CAUSTICA",
  "POZZO":"POZZOLITH", "PREFHO":"PREF.HORMIGON", "64":"PRIMAL", "FARMAC":"PROD.FARMAC.",
  "ADR":"PRODUCTO ADR", "NO ADR":"PRODUCTO NO ADR", "PROPAN":"PROPANO",
  "PROPIL":"PROPILENGLICOL", "PURE":"PURE MANZANA", "QUAT":"Q QUAT", "SOL":"Q-SOL",
  "FEED":"QD FEED", "QDPOL":"QDPOL", "QPOL":"QPOL", "QUAKER":"QUAKERCUT", "QUAK":"QUAKEROL",
  "QUATTR":"QUATTRO", "QUESO":"QUESO", "QUINTO":"QUINTOLUBRIC", "RADIAD":"RADIADORES",
  "57":"REBAJAR Y DESCARGAR", "RECICL":"RECICLAJE", "REDEMU":"REDEMUL", "REFRES":"REFRESCOS",
  "REFRIG":"REFRIGERADO", "7":"REPARTOS", "REPEX":"REPEX", "UF":"RES UF-85",
  "RESID":"RES.COD.LER 070504", "RESIDU":"RES.COD.LER 190814", "BIODEG":"RESID.BIODEGRADABLES",
  "12676":"RESIDUO UN 3082", "23":"RESINA", "RESINO":"RESINOLINE", "RETARD":"RETARDAN",
  "RETORN":"RETORNO", "RF-401":"RF-401", "74":"RHODIMET", "86":"RHODIMET", "RHODOP":"RHODOPAS",
  "52":"RM 245", "ROPA":"ROPA", "ROPOL":"ROPOL", "ROQUAT":"ROQUAT", "RP":"RP CIRCULACION",
  "RUEDAS":"RUEDAS", "SAL":"SAL", "SALMO":"SALMO-GAL", "SALMOG":"SALMOGAL",
  "SANITA":"SANITARIOS", "SCRIPT":"SCRIPTANE", "SECO":"SECO", "SEC/CG":"SECO/CONGELADO",
  "SIKACE":"SIKACERAM", "SIKAME":"SIKAMENT", "49":"SILICATO", "30":"SN 300",
  "COSTE":"SOBRECOSTE", "SODAL":"SODAL", "SODIO":"SODIO SILICATO", "SOKALA":"SOKALAN",
  "81":"SOLUC.NITROGENADA", "SOLUCI":"SOLUCION ACUOSA", "SOLVES":"SOLVESSO",
  "SORBIT":"SORBITOL", "51":"SOSA", "SOSALC":"SOSA-ALCOHOL", "SPIRDA":"SPIRDANE",
  "STAND":"STAND FERIA", "STEARI":"STEARINE", "69":"STYROFAN", "SUERO":"SUERO",
  "SULFAM":"SULF.AMONICO", "27":"SULFANONA", "56":"SULFATO ALUMINA",
  "SULFFE":"SULFATO FERRICO", "SULFSO":"SULFATO SODICO", "SUPERM":"SUPERMERCADO",
  "12674":"SUPLEM. DIESEL-FORESA 18.38%", "12675":"SUPLEM.DIESEL-QUIMIDROGA 5.96%",
  "SUPLEM":"SUPLEMENTO", "12673":"SUPLEMENTO DIESEL-HELM 8.02%", "SURFAC":"SURFACTAN",
  "SYNOLA":"SYNOLAC", "TABLER":"TABLERO", "88":"TADAFLOT", "TALL":"TALL OIL",
  "TALUPA":"TALUPAC", "TCPP":"TCPP", "TENSIO":"TENSION", "TEREMB":"TEREBEMTINA",
  "TERRAZ":"TERRAZO", "75":"TEXAPON", "TEXTIL":"TEXTIL", "78":"THERMISOL", "TIERRA":"TIERRA",
  "TINNOL":"TINNOL", "TINTAS":"TINTAS", "85":"TOLUENO", "TOMATE":"TOMATE", "TOTM":"TOTM-S",
  "TRACT":"TRACTORES", "SIDER":"TRANSF.SIDERURG.", "TRANSF":"TRANSFORMADORES",
  "TRIACE":"TRIACETINA", "TRIETA":"TRIETANOLAM.", "TRIETI":"TRIETILENGLICOL",
  "TRONCO":"TRONCOIL", "TUBO":"TUBOS", "TUBOS":"TUBOS PLASTICO", "UAN":"UAN-32", "19":"UF",
  "URALIT":"URALITA", "UREA":"UREA", "ZICLUS":"V-ZICLUS", "VACIO":"VACIO", "VANASO":"VANASOL",
  "9":"VARIOS", "VARNIS":"VARNISH", "VIDRIO":"VIDRIO", "VINAGE":"VINAGRE",
  "VINKA":"VINKA-PLAST", "40":"VINO", "VISCO":"VISCOCRETE", "VISOM":"VISOM", "VM 410":"VM 410",
  "VOLUTA":"VOLUTA H 300", "VORANO":"VORANOL", "12668":"WAC AB", "44":"WHITE SPIRIT",
  "WP70":"WP 70", "94":"XILENO", "71":"YOGUR", "ZINC":"ZINC", "72":"ZUMOS"
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
    // AMBOS LADOS AL CANONICO (bug real ejec 1076): el viaje se traducia a punto
    // canonico ("FAMALICAO" -> "VILANOVA FAMALICAO") pero la fila de la tabla
    // Tarifas se comparaba EN CRUDO, donde dice literalmente "FAMALICAO". Nunca
    // matcheaba -> ninguna tarifa se encontraba nunca. La tabla la cargo un
    // humano con el nombre corriente; el viaje viene del documento. Solo son
    // comparables si los DOS pasan por el mismo resolvedor de puntos.
    var to = canonPunto(t.origen, catalogo);
    var td = canonPunto(t.destino, catalogo);
    if (to.n !== oc.n || td.n !== dc.n) { continue; }
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

// ===== SEGUNDO ESCALON: TARIFA POR ANALOGIA ==================================
//
// Medido sobre el año entero (7.578 portes): 532 combinaciones cliente x ruta x
// material — 1.973 viajes, el 26 % — no tienen tarifa oficial. No es un problema
// de nombres: el tarifario y los viajes usan el mismo catalogo de 790 puntos
// (294/294 y 293/295). El tarifario esta INCOMPLETO respecto de lo que se
// transporta (ver docs/INDICE.md R-05).
//
// Cuando el destino real no esta tarifado, la oficina aplica a mano la tarifa de
// otra ruta del mismo cliente y origen. Este escalon reproduce ese gesto, y solo
// con las analogias que Julio CONFIRMO una por una (2026-08-27: 12 confirmadas,
// 3 "negociables" —precio que se pacta viaje a viaje, no es tarifa—, 5
// descartadas y 1 que resulto ser sinonimo de punto, no analogia).
//
// DOS REGLAS DURAS
//
//   1. Solo entra estado === 'confirmado'. Una analogia sin confirmar aplicada
//      sola es un precio inventado con pinta de bueno: el fallo mas caro que
//      puede tener este archivo. 'negociable' NO entra: que dos viajes hayan
//      coincidido de precio no significa que el tercero valga lo mismo.
//
//   2. La analogia SIEMPRE marca revisar. Es una tarifa observada, no pactada.
//      La fila se factura, pero se ve que se factura por analogia.

/**
 * Las analogias que se pueden usar. Filtra aca, no en el punto de uso: asi no
 * hay forma de saltarse la regla 1 por olvido.
 *
 * Se exigen las DOS condiciones (estado y confirmado) a proposito: un JSON
 * editado a mano a medias no debe poder colar un precio.
 */
function analogiasConfirmadas(analogias) {
  var lista = (analogias && analogias.candidatos) ? analogias.candidatos
            : (Array.isArray(analogias) ? analogias : []);
  var out = [];
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].estado === 'confirmado' && lista[i].confirmado === true) { out.push(lista[i]); }
  }
  return out;
}

/**
 * Busca la analogia que aplica a este viaje.
 *
 * El cliente NO se compara por igualdad: el JSON guarda la razon social larga
 * ("FORESA IND.QUIMICAS DEL NOROESTE, S.A.") porque sale del export de Gesruta,
 * y el viaje trae el nombre corto que se leyo del documento ("FORESA"). Es el
 * mismo puente que ya usa la busqueda de tarifa (§ Puente 2); compararlos por
 * igualdad hacia que ninguna analogia matcheara nunca.
 */
function buscarAnalogia(viaje, analogias) {
  var lista = analogiasConfirmadas(analogias);
  var o = norm(viaje.origen), d = norm(viaje.destino);
  for (var i = 0; i < lista.length; i++) {
    var a = lista[i];
    if (!clienteCoincide(viaje.cliente, a.cliente)) { continue; }
    if (norm(a.origen) !== o) { continue; }
    if (norm(a.destino_real) !== d) { continue; }
    return a;
  }
  return null;
}

/**
 * Precio del viaje, con la cascada completa y diciendo SIEMPRE de donde sale.
 *
 * 1. tarifa CONTRACTUAL (tabla Tarifas)          -> origen_del_precio 'contractual'
 * 2. tarifa POR ANALOGIA confirmada              -> 'analogia'   (+ revisar)
 * 3. precio impreso en la ORDEN del cliente      -> 'orden'      (+ revisar)
 * 4. nada, con el motivo escrito                 -> null
 *
 * El campo origen_del_precio no es decorativo: es lo que permite ver en la
 * planilla que una fila se esta cobrando por analogia y no por tarifa pactada.
 *
 * @param {{cliente,origen,destino,material,precio_orden?}} viaje
 * @param {Array} tarifas    filas de la tabla Tarifas
 * @param {object} analogias contenido de catalogo/tarifa-por-analogia.json
 * @param {Array} [catalogo] filas de la tabla puntos
 */
function resolverPrecio(viaje, tarifas, analogias, catalogo) {
  var motivos = [];

  var contractual = buscarTarifaContractual(viaje, tarifas, catalogo);
  if (contractual && contractual.tarifa !== null && contractual.tarifa_tn !== undefined) {
    contractual.origen_del_precio = 'contractual';
    return contractual;
  }
  if (contractual && contractual.motivo) { motivos.push(contractual.motivo); }

  // --- Escalon 2 ---------------------------------------------------------
  var a = buscarAnalogia(viaje, analogias);
  if (a) {
    // Se rehace la busqueda contractual sustituyendo SOLO el destino. No se
    // copia el precio guardado en la analogia: si la tarifa de la ruta modelo
    // cambio, el viaje tiene que seguir esa tarifa, no un numero congelado.
    var comoSi = {
      cliente: viaje.cliente, origen: viaje.origen,
      destino: a.destino_tarifado, material: viaje.material,
    };
    var t = buscarTarifaContractual(comoSi, tarifas, catalogo);
    if (t && t.tarifa_tn !== undefined) {
      t.origen_del_precio = 'analogia';
      t.revisar = true;              // regla 2: observada, no pactada
      t.analogia = {
        destino_real: a.destino_real,
        destino_tarifado: a.destino_tarifado,
        confirmado_por: a.revisado_por || null,
        fecha: a.fecha_revision || null,
      };
      t.motivo = 'sin tarifa propia para ' + a.destino_real + ': se aplica la de ' +
                 a.destino_tarifado + ', analogia confirmada por ' +
                 (a.revisado_por || 'la oficina');
      return t;
    }
    motivos.push('hay analogia confirmada hacia ' + a.destino_tarifado +
                 ' pero esa ruta tampoco tiene tarifa');
  }

  // --- Escalon 3 ---------------------------------------------------------
  var po = num(viaje.precio_orden);
  if (po !== null) {
    return {
      tarifa_tn: null, precio_fijo: po, material_tarifa: null,
      origen_del_precio: 'orden', revisar: true,
      motivo: 'sin tarifa cargada: se usa el precio impreso en la orden del cliente',
    };
  }

  return {
    tarifa: null, origen_del_precio: null, revisar: true,
    motivo: motivos.length ? motivos.join('; ') : 'sin precio: no hay tarifa ni orden',
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buscarTarifaContractual: buscarTarifaContractual,
    resolverPrecio: resolverPrecio,
    analogiasConfirmadas: analogiasConfirmadas,
    buscarAnalogia: buscarAnalogia,
    clienteCoincide: clienteCoincide,
    materialCoincide: materialCoincide,
  };
}

// ===== RUTAS CONOCIDAS DEL CLIENTE — el conjunto cerrado que faltaba ==========
//
// EL CAMBIO DE PREGUNTA. Hasta ahora el sistema resolvia asi:
//
//     "dado este literal de direccion, ¿cual de los 790 puntos es?"
//
// Conjunto ABIERTO, 790 opciones, matcheo de texto contra direcciones postales
// que a veces vienen mal impresas. Es el problema dificil, y es de donde salieron
// los errores caros: la guia de RNM trae "Asturiana de Zinc ... 46002 Teruel"
// cuando la planta esta en Aviles, y el sistema resolvia TERUEL tan contento.
//
// La pregunta correcta es la que hace la oficina sin pensarlo:
//
//     "dado que el cliente es RNM, ¿cual de SUS rutas conocidas es?"
//
// Conjunto CERRADO de 5 a 20 opciones, con frecuencias reales. RNM nunca viajo a
// Teruel: la respuesta mala ni siquiera esta sobre la mesa.
//
// El conjunto sale de catalogo/rutas-por-cliente.json, construido desde los
// 7.578 portes que la empresa facturo de verdad en el año (no de lo que alguien
// supone que se transporta). Medido: 287 de los 790 puntos se usan alguna vez, y
// los 40 mas usados cubren el 91,6 % de los usos. El conjunto util es chico.
//
// TRES REGLAS
//
//   1. NO se rechaza una ruta nueva. Un cliente puede estrenar destino cualquier
//      dia, y un sistema que dice "eso no existe" ante algo real es inservible.
//      Lo que se hace es MARCARLA: resuelve, pero con aviso de que ese cliente
//      nunca fue ahi. Esa es la guarda que caza el TERUEL de RNM.
//
//   2. Dentro del conjunto cerrado se puede matchear mas flojo, porque hay 6
//      candidatos y no 790. "VILANOVA FAMALICAO" no resuelve contra el catalogo
//      entero, pero contra los 6 destinos de RNM es inequivoco. Fuera del
//      conjunto ese mismo criterio seria temerario.
//
//   3. Empate = no se elige. Si el literal casa con dos destinos conocidos del
//      cliente, se devuelven los dos y decide un humano. La frecuencia sirve para
//      ORDENAR lo que se le muestra, nunca para desempatar sola: "el cliente
//      suele ir a X" no es prueba de que ESTE viaje fue a X.
//
// Logica PURA. El JSON de rutas se inyecta; este modulo no lee archivos.

'use strict';

var RC_RP = (typeof resolverPunto === 'function')
  ? { resolverPunto: resolverPunto, normalizar: normalizar }
  : require('../catalogo/resolver-punto.js');

var RC_TC = (typeof clienteCoincide === 'function')
  ? { clienteCoincide: clienteCoincide }
  : require('./tarifa-contractual.js');

function nrm(s) { return RC_RP.normalizar(s); }

/**
 * Los puntos que ESTE cliente uso de verdad, en el rol pedido.
 *
 * @param {object} rutas  contenido de catalogo/rutas-por-cliente.json
 * @param {string} cliente  nombre corto leido del documento ("FORESA")
 * @param {'destino'|'origen'} rol
 * @param {string} [origen]  si se da, limita a las rutas que salen de ahi
 * @returns {Array<{nombre, n_viajes, materiales:Array<string>}>} ordenado por frecuencia
 */
function puntosConocidos(rutas, cliente, rol, origen) {
  var clientes = (rutas && rutas.clientes) ? rutas.clientes : {};
  var campo = (rol === 'origen') ? 'nombre_origen' : 'nombre_destino';
  var acc = {};
  var oFiltro = origen ? nrm(origen) : null;

  for (var cid in clientes) {
    if (!Object.prototype.hasOwnProperty.call(clientes, cid)) { continue; }
    var c = clientes[cid];
    // El JSON guarda la razon social larga; el viaje trae el nombre corto.
    if (!RC_TC.clienteCoincide(cliente, c.nombre)) { continue; }
    for (var i = 0; i < (c.rutas || []).length; i++) {
      var R = c.rutas[i];
      if (oFiltro && rol === 'destino' && nrm(R.nombre_origen) !== oFiltro) { continue; }
      var nom = R[campo];
      if (!nom) { continue; }
      var k = nrm(nom);
      if (!acc[k]) { acc[k] = { nombre: nom, n_viajes: 0, materiales: [] }; }
      acc[k].n_viajes += R.n_viajes || 0;
      if (R.nombre_material && acc[k].materiales.indexOf(R.nombre_material) < 0) {
        acc[k].materiales.push(R.nombre_material);
      }
    }
  }
  var out = [];
  for (var k2 in acc) { if (Object.prototype.hasOwnProperty.call(acc, k2)) { out.push(acc[k2]); } }
  out.sort(function (a, b) { return b.n_viajes - a.n_viajes; });
  return out;
}

// Regla 2: dentro del conjunto cerrado se matchea por contencion de tokens en
// cualquier sentido ("FAMALICAO" casa con "VILANOVA FAMALICAO" y al reves).
function casaEnConjunto(literal, nombre) {
  var a = nrm(literal), b = nrm(nombre);
  if (!a || !b) { return false; }
  if (a === b) { return true; }
  return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
}

/**
 * Resuelve un punto usando primero lo que ESTE cliente hizo de verdad.
 *
 * @param {string} literal  lo que dice el documento
 * @param {{cliente, rol, origen}} ctx
 * @param {Array} catalogo  filas de la tabla puntos
 * @param {object} rutas    catalogo/rutas-por-cliente.json
 * @returns el resultado de resolverPunto, enriquecido con:
 *          ruta_conocida  true|false|null (null = no se pudo evaluar)
 *          aviso_ruta     texto cuando el cliente nunca fue ahi
 *          candidatos     cuando hay empate dentro del conjunto cerrado
 */
function resolverPuntoDeCliente(literal, ctx, catalogo, rutas) {
  ctx = ctx || {};
  var base = RC_RP.resolverPunto(literal, 'documento', catalogo);
  var conocidos = puntosConocidos(rutas, ctx.cliente, ctx.rol || 'destino', ctx.origen);

  // Sin cliente resuelto o sin historia, no hay conjunto cerrado que aplicar.
  if (!ctx.cliente || !conocidos.length) {
    base.ruta_conocida = null;
    return base;
  }

  // --- Caso A: el resolvedor global encontro un punto ---------------------
  if (base.id_punto) {
    var enConjunto = null;
    for (var i = 0; i < conocidos.length; i++) {
      if (nrm(conocidos[i].nombre) === nrm(base.nombre_canonico)) { enConjunto = conocidos[i]; break; }
    }
    if (enConjunto) {
      base.ruta_conocida = true;
      base.n_viajes_historicos = enConjunto.n_viajes;
      base.motivo += '; ruta conocida de ' + ctx.cliente + ' (' + enConjunto.n_viajes + ' viajes)';

      // CORROBORACION — el uso mas valioso del conjunto cerrado, y el que no
      // era evidente hasta ver correr el resolvedor global.
      //
      // resolverPunto ya resuelve "FAMALICAO" -> VILANOVA FAMALICAO por
      // CONTENCION, pero marca revisar: contra 790 puntos, un nombre contenido
      // en otro es una apuesta razonable y nada mas. Si ademas resulta que ese
      // punto es una ruta que ESTE cliente hizo 120 veces, la apuesta deja de
      // serlo: dos evidencias independientes (el texto y la historia) apuntan al
      // mismo sitio. Ahi se puede bajar la bandera.
      //
      // Solo se corrobora lo DEBIL (contencion / edicion). Un 'canonico' exacto
      // ya venia sin revisar, y lo que trae revisar por otro motivo —un
      // duplicado del catalogo, un conflicto doc/ficha— NO se toca: la historia
      // del cliente no dice nada sobre esos.
      var debil = (base.metodo === 'contencion' || base.metodo === 'edicion');
      if (debil && base.revisar) {
        base.revisar = false;
        base.confianza = 'alta';
        base.corroborado_por_historico = true;
        base.motivo += '; lectura debil CORROBORADA por el historico: se mantiene sin revisar';
      }
      return base;
    }
    // Regla 1: NO se rechaza. Se marca. Aca es donde se caza el TERUEL de RNM.
    base.ruta_conocida = false;
    base.revisar = true;
    base.aviso_ruta = ctx.cliente + ' nunca ' +
      (ctx.rol === 'origen' ? 'cargo en ' : 'viajo a ') + base.nombre_canonico +
      ' en el historico; sus ' + (ctx.rol === 'origen' ? 'origenes' : 'destinos') +
      ' habituales son ' + conocidos.slice(0, 3).map(function (p) { return p.nombre; }).join(', ');
    base.motivo += '; ' + base.aviso_ruta;
    return base;
  }

  // --- Caso B: el catalogo global no lo resolvio; se prueba el cerrado ----
  var casan = [];
  for (var j = 0; j < conocidos.length; j++) {
    if (casaEnConjunto(literal, conocidos[j].nombre)) { casan.push(conocidos[j]); }
  }
  if (casan.length === 1) {
    var elegido = casan[0];
    var idx = RC_RP.resolverPunto(elegido.nombre, 'documento', catalogo);
    if (idx.id_punto) {
      idx.ruta_conocida = true;
      idx.n_viajes_historicos = elegido.n_viajes;
      idx.confianza = 'media';   // se resolvio por el conjunto cerrado, no por el catalogo
      idx.revisar = false;
      idx.literal_original = literal;
      idx.metodo = 'ruta_conocida_cliente';
      idx.motivo = 'el catalogo no reconocia "' + literal + '", pero es el unico ' +
        (ctx.rol === 'origen' ? 'origen' : 'destino') + ' de ' + ctx.cliente +
        ' que encaja (' + elegido.nombre + ', ' + elegido.n_viajes + ' viajes)';
      return idx;
    }
  }
  if (casan.length > 1) {
    // Regla 3: empate no se rompe con la frecuencia; solo se ordena por ella.
    base.ruta_conocida = null;
    base.candidatos = casan.map(function (p) { return { nombre: p.nombre, n_viajes: p.n_viajes }; });
    base.motivo += '; encaja con ' + casan.length + ' rutas conocidas de ' + ctx.cliente +
      ' (' + casan.map(function (p) { return p.nombre; }).join(' / ') + '): decide un humano';
    return base;
  }

  base.ruta_conocida = false;
  return base;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    puntosConocidos: puntosConocidos,
    resolverPuntoDeCliente: resolverPuntoDeCliente,
    casaEnConjunto: casaEnConjunto,
  };
}

// ===== PLANTILLAS POR CLIENTE — de documentacion a produccion ================
//
// POR QUE EXISTE ESTE ARCHIVO. catalogo/plantillas-cliente.json guarda, cliente
// por cliente y documento por documento, DONDE esta cada campo: la etiqueta
// impresa exacta, la casilla, el formato, y —lo que mas vale— que numeros
// PARECEN el dato bueno y no lo son. Todo eso lo confirmo Julio entre el 28 y el
// 31/08/2026 contra documentos reales.
//
// Pero un JSON que nadie lee es un documento, no un sistema. Este modulo es el
// que lo pone a trabajar, en dos sitios:
//
//   1. promptDeCliente()  -> el trozo de prompt que le dice al modelo, para ESE
//      emisor, que ancla mirar y que ignorar. Sustituye al "extrae los datos
//      clave", que es lo que hacia que eligiera mal entre cinco numeros.
//
//   2. verificarReferencia() -> la guarda que corre DESPUES de leer. Comprueba
//      que lo extraido cumple el formato del emisor y, sobre todo, que NO es uno
//      de los numeros marcados como trampa. Esto no depende del modelo: es
//      codigo, y por eso es lo que de verdad sostiene el resultado.
//
// EL PRINCIPIO, que salio de mirar los documentos y no de suponerlo: la
// referencia NO se extrae por FORMATO —varia: 6 digitos, 7, 10, guia remessa, o
// ninguno— sino por la ETIQUETA ANCLA que la precede, que si es estable por
// emisor. Y el ancla pertenece al EMISOR, no al tipo de documento: FORESA y
// BRESFOR emiten papeles casi identicos y su regla es la OPUESTA (Foresa el 2o
// numero de 7 digitos, Bresfor el 1o de 10). Por eso todo aca se indexa por
// emisor, nunca por "es un CMR".
//
// Logica PURA: las plantillas se inyectan, este modulo no lee archivos.

'use strict';

var PL_TC = (typeof clienteCoincide === 'function')
  ? { clienteCoincide: clienteCoincide }
  : require('./tarifa-contractual.js');

function txt(s) { return (s === null || s === undefined) ? '' : String(s); }

function soloDigitos(s) { return txt(s).replace(/[^0-9]/g, ''); }

/**
 * La plantilla que aplica a un emisor. Se busca por nombre de cliente con el
 * mismo puente corto<->razon social que usa la tarifa, porque el documento dice
 * "FORESA" y la plantilla guarda "FORESA IND. QUIMICAS DEL NOROESTE SA".
 */
function plantillaDe(cliente, plantillas) {
  var lista = (plantillas && plantillas.plantillas) ? plantillas.plantillas
            : (Array.isArray(plantillas) ? plantillas : []);
  if (!txt(cliente)) { return null; }
  for (var i = 0; i < lista.length; i++) {
    var p = lista[i];
    if (PL_TC.clienteCoincide(cliente, p.cliente) ||
        PL_TC.clienteCoincide(cliente, p.razon_social_impresa || '')) {
      return p;
    }
  }
  return null;
}

/**
 * El trozo de prompt para ESE emisor: donde mirar cada campo y que ignorar.
 *
 * La seccion "NO CONFUNDIR" no es un adorno: en los documentos observados hay
 * entre tres y cinco numeros que compiten con la referencia (pedido, ref. del
 * comprador, albaran interno, referencia de la terminal). Decir cual NO es vale
 * tanto como decir cual SI.
 */
function promptDeCliente(cliente, plantillas) {
  var p = plantillaDe(cliente, plantillas);
  if (!p) { return ''; }
  var L = ['REGLAS DE EXTRACCION PARA ' + p.cliente + ' (confirmadas con documentos reales):'];

  for (var i = 0; i < (p.documentos || []).length; i++) {
    var doc = p.documentos[i];
    L.push('');
    L.push('DOCUMENTO: ' + doc.tipo + (doc.titulos ? ' — se reconoce por: ' + doc.titulos.join(' / ') : ''));
    if (doc._forma) { L.push('  (' + doc._forma + ')'); }

    var campos = doc.campos || {};
    for (var campo in campos) {
      if (!Object.prototype.hasOwnProperty.call(campos, campo)) { continue; }
      var c = campos[campo];
      if (!c || !c.donde) { continue; }
      L.push('  - ' + campo + ': ' + c.donde);
      if (c.fuente_habitual) { L.push('      lo normal es que salga de: ' + c.fuente_habitual); }
      if (c.formato) { L.push('      formato: ' + c.formato); }
      var ej = c.ejemplos_verificados || c.ejemplos || (c.ejemplo ? [c.ejemplo] : null);
      if (ej && ej.length) { L.push('      ejemplos reales: ' + ej.join(' | ')); }
      if (c._no_confundir) { L.push('      OJO: ' + c._no_confundir); }
    }
    if ((doc.ignorar || []).length) {
      L.push('  NO CONFUNDIR — esto PARECE el dato correcto y NO lo es:');
      for (var j = 0; j < doc.ignorar.length; j++) { L.push('    * ' + doc.ignorar[j]); }
    }
  }
  return L.join('\n');
}

/**
 * Guarda de la referencia: corre DESPUES de leer, y no depende del modelo.
 *
 * Dos comprobaciones, y la segunda es la que ataja el error caro:
 *   a) el formato declarado del emisor (si la plantilla lo declara)
 *   b) que el valor NO coincida con ninguno de los numeros que la plantilla
 *      marco como trampa. Un numero de pedido tiene formato de numero y pasa
 *      cualquier validacion de forma; solo se lo caza comparandolo con el resto
 *      de numeros del documento.
 *
 * @param {string} valor       lo que se extrajo como referencia
 * @param {string} cliente     emisor resuelto
 * @param {object} plantillas  catalogo/plantillas-cliente.json
 * @param {object} [otros]     otros numeros leidos del documento, por nombre de
 *                             campo: {pedido_cliente:'...', n_albaran:'...'}
 * @returns {{ok, revisar, motivo}}
 */
function verificarReferencia(valor, cliente, plantillas, otros) {
  var v = soloDigitos(valor);
  if (!v) {
    return { ok: false, revisar: true, motivo: 'referencia vacia' };
  }
  var p = plantillaDe(cliente, plantillas);
  if (!p) {
    return { ok: true, revisar: false, motivo: 'sin plantilla para "' + txt(cliente) + '": no se puede verificar el formato' };
  }

  var campo = null;
  for (var i = 0; i < (p.documentos || []).length; i++) {
    var c = (p.documentos[i].campos || {}).referencia;
    if (c) { campo = c; break; }
  }
  if (!campo) { return { ok: true, revisar: false, motivo: '' }; }

  // (b) primero: chocar con otro numero del documento es mas grave que un
  // formato raro, porque produce un dato lleno, valido y equivocado.
  var o = otros || {};
  for (var k in o) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) { continue; }
    if (k === 'referencia') { continue; }
    if (soloDigitos(o[k]) && soloDigitos(o[k]) === v) {
      return { ok: false, revisar: true,
        motivo: 'la referencia leida (' + v + ') es la MISMA que el campo "' + k +
                '" del documento: es muy probable que se haya tomado el numero equivocado' };
    }
  }

  // (a) formato declarado: se comprueba el largo, que es lo unico que las
  // plantillas afirman con certeza ("7 digitos", "10 digitos").
  var m = /(\d+)\s*digitos/i.exec(txt(campo.formato));
  if (m) {
    var esperado = Number(m[1]);
    if (v.length !== esperado) {
      return { ok: false, revisar: true,
        motivo: 'la referencia de ' + p.cliente + ' debe tener ' + esperado + ' digitos y "' +
                v + '" tiene ' + v.length + (campo._no_confundir ? '. ' + campo._no_confundir : '') };
    }
  }
  return { ok: true, revisar: false, motivo: '' };
}

/**
 * De donde debe salir un campo segun la tabla que dio Julio: del documento, de
 * la ficha del chofer, de una tabla de Gesruta, o de un calculo.
 *
 * Sirve para no ir a buscar al documento algo que manda la ficha. El caso claro
 * es la FECHA DE CARGA: esta impresa en todos los documentos y aun asi manda la
 * ficha (regla R-01, reconfirmada por Julio el 31/08 para todos los clientes).
 */
function fuenteDelCampo(campo, cliente, plantillas) {
  var p = plantillaDe(cliente, plantillas);
  var mapa = p && p._mapa_campo_fuente_de_julio;
  if (!mapa || !Object.prototype.hasOwnProperty.call(mapa, campo)) { return null; }
  var v = txt(mapa[campo]);
  var n = v.toUpperCase();
  var origen = 'documento';
  if (n.indexOf('FICHA') >= 0) { origen = 'ficha'; }
  else if (n.indexOf('GESRUTA') >= 0) { origen = 'tabla_gesruta'; }
  else if (n.indexOf('CALCULO') >= 0 || n.indexOf('SISTEMA') >= 0) { origen = 'calculo'; }
  else if (n.indexOf('PENDIENTE') >= 0) { origen = 'pendiente'; }
  return { origen: origen, literal: v };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    plantillaDe: plantillaDe,
    promptDeCliente: promptDeCliente,
    verificarReferencia: verificarReferencia,
    fuenteDelCampo: fuenteDelCampo,
  };
}

// datos embebidos de ../catalogo/tarifa-por-analogia.json
var ANALOGIAS_EMBEBIDAS = {
 "nota": "CANDIDATOS de TARIFA POR ANALOGIA, deducidos porque el importe facturado coincide EXACTAMENTE con el de otra ruta del mismo cliente+origen. Significa \"aqui se cobra la tarifa de aquella otra ruta\", NO \"este destino es aquel otro\". Requieren confirmacion humana: poner confirmado=true. Sin confirmar NO se factura con ellos.",
 "veredictos_arrastrados": 20,
 "veredictos_huerfanos": [],
 "candidatos": [
  {
   "cliente": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
   "origen": "VILLAGARCIA",
   "destino_real": "CURIA SPAIN, SAU",
   "destino_tarifado": "VALLADOLID",
   "precio": 38.66,
   "n_viajes": 73,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
   "origen": "VILLAGARCIA",
   "destino_real": "COGERSA",
   "destino_tarifado": "ASTURIAS",
   "precio": 33.1,
   "n_viajes": 34,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
   "origen": "CALDAS DE REIS",
   "destino_real": "SERVYECO IBERIA,SL",
   "destino_tarifado": "CASTELLON",
   "precio": 64.91,
   "n_viajes": 8,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "AMBERES CHEMICAL, S.A.",
   "origen": "TARRAGONA",
   "destino_real": "CUNTIS",
   "destino_tarifado": "PONTEVEDRA",
   "precio": 79.95,
   "n_viajes": 3,
   "confirmado": false,
   "estado": "descartado",
   "veredicto": "Julio no puede confirmarlo",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
   "origen": "CALDAS DE REIS",
   "destino_real": "GERMAN RDGUEZ.IND.SA",
   "destino_tarifado": "GUADALAJARA",
   "precio": 48.17,
   "n_viajes": 2,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
   "origen": "VILLAGARCIA",
   "destino_real": "PORRIÑO",
   "destino_tarifado": "DROGAS VIGO, S.L.",
   "precio": 12.64,
   "n_viajes": 2,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "QUIMIDROGA, S.A.",
   "origen": "BARCELONA",
   "destino_real": "BEGONTE",
   "destino_tarifado": "LUGO",
   "precio": 74.73,
   "n_viajes": 2,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "HELM IBERICA, S.A.",
   "origen": "BARCELONA",
   "destino_real": "FORESA FRANCE SAS",
   "destino_tarifado": "AMBARES",
   "precio": 1350,
   "n_viajes": 2,
   "confirmado": false,
   "estado": "negociable",
   "veredicto": "precio por viaje, se negocia cada vez: no es tarifa estable",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "AMBERES CHEMICAL, S.A.",
   "origen": "TARRAGONA",
   "destino_real": "AZPEITIA",
   "destino_tarifado": "GUIPUZCOA",
   "precio": 36.9,
   "n_viajes": 2,
   "confirmado": false,
   "estado": "descartado",
   "veredicto": "Julio no puede confirmarlo",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
   "origen": "CALDAS DE REIS",
   "destino_real": "CORUÑA",
   "destino_tarifado": "DROGAS CONDE, S.A.",
   "precio": 18.61,
   "n_viajes": 1,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
   "origen": "VILLAGARCIA",
   "destino_real": "GIJON",
   "destino_tarifado": "ASTURIAS",
   "precio": 33.1,
   "n_viajes": 1,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
   "origen": "CALDAS DE REIS",
   "destino_real": "PADRON",
   "destino_tarifado": "CESURES",
   "precio": 4.27,
   "n_viajes": 1,
   "confirmado": false,
   "estado": "tarifa_faltante",
   "veredicto": "Julio 27/08: PADRON y CESURES son sitios DISTINTOS, separados por unos km. La diferencia de tarifa de TRANSTAMBRE entre los dos (3,34 vs 3,21) esta justificada por la distancia, y las diferencias entre clientes para una misma ruta son acuerdos comerciales. No es alias ni analogia: a FORESA le FALTA la fila CALDAS DE REIS -> PADRON COLA 4,27. Se da de alta en Gesruta; no se resuelve por codigo.",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
   "origen": "CALDAS DE REIS",
   "destino_real": "LANGREO",
   "destino_tarifado": "ASTURIAS",
   "precio": 33.1,
   "n_viajes": 1,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
   "origen": "VILLAGARCIA",
   "destino_real": "GIJON",
   "destino_tarifado": "ASTURIAS",
   "precio": 33.1,
   "n_viajes": 1,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "QUIMIDROGA, S.A.",
   "origen": "TARRAGONA",
   "destino_real": "AVEIRO",
   "destino_tarifado": "COIMBRA",
   "precio": 80.8,
   "n_viajes": 1,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "DROVIGO PORTUGAL UNIPESSOAL, LDA",
   "origen": "TARRAGONA",
   "destino_real": "COIMBRA",
   "destino_tarifado": "AVEIRO",
   "precio": 1900,
   "n_viajes": 1,
   "confirmado": false,
   "estado": "negociable",
   "veredicto": "precio por viaje, se negocia cada vez: no es tarifa estable",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "HELM IBERICA, S.A.",
   "origen": "TARRAGONA",
   "destino_real": "CASARRUBIOS",
   "destino_tarifado": "TOLEDO",
   "precio": 1050,
   "n_viajes": 1,
   "confirmado": false,
   "estado": "negociable",
   "veredicto": "precio por viaje, se negocia cada vez: no es tarifa estable",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "AMBERES CHEMICAL, S.A.",
   "origen": "TARRAGONA",
   "destino_real": "IRURENA",
   "destino_tarifado": "GUIPUZCOA",
   "precio": 36.9,
   "n_viajes": 1,
   "confirmado": false,
   "estado": "descartado",
   "veredicto": "Julio no puede confirmarlo",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "AMBERES CHEMICAL, S.A.",
   "origen": "TARRAGONA",
   "destino_real": "LOGROÑO",
   "destino_tarifado": "OYON",
   "precio": 31.15,
   "n_viajes": 1,
   "confirmado": false,
   "estado": "descartado",
   "veredicto": "Julio no puede confirmarlo",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "ACIDEKA, S.A.",
   "origen": "ZIERBANA",
   "destino_real": "MONFORTE LEMOS",
   "destino_tarifado": "LUGO",
   "precio": 36.57,
   "n_viajes": 1,
   "confirmado": false,
   "estado": "descartado",
   "veredicto": "Julio no puede confirmarlo",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  },
  {
   "cliente": "QUIMICAS DEL JARAMA, S.A.",
   "origen": "MADRID",
   "destino_real": "PORTUGAL",
   "destino_tarifado": "LANDIN (PT)",
   "precio": 46.35,
   "n_viajes": 1,
   "confirmado": true,
   "estado": "confirmado",
   "veredicto": "confirmado por Julio 2026-08-27",
   "revisado_por": "Julio",
   "fecha_revision": "2026-08-27"
  }
 ]
};

// datos embebidos de ../catalogo/rutas-por-cliente-test.json
var RUTAS_CLIENTE_EMBEBIDAS = {
 "generado_de": "rutas-por-cliente.json",
 "nota": "RECORTE para pruebas: solo los 4 clientes confirmados y los campos que usa rutas-conocidas.js. Derivado; se regenera con herramientas/recortar-rutas-clientes.py. No editar a mano.",
 "clientes": {
  "1": {
   "nombre": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
   "nif": "A28141224",
   "rutas": [
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "OREMBER",
     "nombre_material": "COLA",
     "n_viajes": 2131
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "METANOL",
     "n_viajes": 835
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "OREMBER",
     "nombre_material": "FINCAT",
     "n_viajes": 389
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "UTISA TERUEL",
     "nombre_material": "COLA",
     "n_viajes": 178
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "IP DECOR SPAIN, SAU",
     "nombre_material": "COLA",
     "n_viajes": 167
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TERMOLAN, S.A.",
     "nombre_material": "COLA",
     "n_viajes": 132
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "CURIA SPAIN, SAU",
     "nombre_material": "METANOL",
     "n_viajes": 73
    },
    {
     "nombre_origen": "HUELVA",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "FENOL FUNDIDO",
     "n_viajes": 61
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "NEFAB PONTEV. SL",
     "nombre_material": "COLA",
     "n_viajes": 60
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "URSA IBERICA, S.A.",
     "nombre_material": "COLA",
     "n_viajes": 55
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "DIETILENGLICOL",
     "n_viajes": 46
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "BARCELONA",
     "nombre_material": "COLA",
     "n_viajes": 46
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "HARINAS ALMELA,SC",
     "nombre_material": "COLA",
     "n_viajes": 41
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TERUEL",
     "nombre_material": "COLA",
     "n_viajes": 37
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "ACETATO DE VINILO",
     "n_viajes": 35
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "COGERSA",
     "nombre_material": "METANOL",
     "n_viajes": 34
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "DROGAS VIGO, S.L.",
     "nombre_material": "METANOL",
     "n_viajes": 32
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "ZNDS TABLEROS, S.L.",
     "nombre_material": "COLA",
     "n_viajes": 27
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "AVEIRO",
     "nombre_material": "METANOL",
     "n_viajes": 26
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TARRAGONA",
     "nombre_material": "COLA",
     "n_viajes": 26
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "DIETILENGLICOL",
     "n_viajes": 25
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "VALLADOLID",
     "nombre_material": "METANOL",
     "n_viajes": 23
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "ALCOVER QUIMINA, S.L.",
     "nombre_material": "FORMOL",
     "n_viajes": 16
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "VALENCIA",
     "nombre_material": "COLA",
     "n_viajes": 16
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "HARINAS ALMELA,SC",
     "nombre_material": "REPARTOS",
     "n_viajes": 14
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CLARIANT, S.A.",
     "nombre_material": "FORMOL",
     "n_viajes": 14
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "IND.QUIM.CUADRADO,SA",
     "nombre_material": "METANOL",
     "n_viajes": 10
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TABLESTUY, S.L.",
     "nombre_material": "COLA",
     "n_viajes": 9
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "LORCOL",
     "nombre_material": "COLA",
     "n_viajes": 9
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TERUEL",
     "nombre_material": "PINATURE",
     "n_viajes": 9
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "SERVYECO IBERIA,SL",
     "nombre_material": "COLA/FORMOL",
     "n_viajes": 8
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "SERVYECO IBERIA,SL",
     "nombre_material": "REPARTOS",
     "n_viajes": 8
    },
    {
     "nombre_origen": "VIGO",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "HIDROXIDO SODICO",
     "n_viajes": 8
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "ASTURIAS",
     "nombre_material": "METANOL",
     "n_viajes": 7
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "COMERCIAL GODO, S.L.",
     "nombre_material": "FORMOL",
     "n_viajes": 5
    },
    {
     "nombre_origen": "VIGO",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "SOSA",
     "n_viajes": 5
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "HELDER ROB.MOREIRA",
     "nombre_material": "COLA",
     "n_viajes": 5
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "ADHESIVOS GIMPEX, S.L",
     "nombre_material": "COLA",
     "n_viajes": 5
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "DROGAS CONDE, S.A.",
     "nombre_material": "FORMOL",
     "n_viajes": 5
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "MADERAS BENIGANIM, SAL",
     "nombre_material": "COLA",
     "n_viajes": 5
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TARRAGONA",
     "nombre_material": "FORMOL",
     "n_viajes": 5
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TORDERA",
     "nombre_material": "COLA",
     "n_viajes": 5
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "GARNICA PLYWOOD",
     "nombre_material": "COLA",
     "n_viajes": 4
    },
    {
     "nombre_origen": "ORENSE",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "AGUA DESMINER.",
     "n_viajes": 4
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "LUSO FINSA",
     "nombre_material": "COLA",
     "n_viajes": 3
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CATENVA, S.L.",
     "nombre_material": "COLA",
     "n_viajes": 3
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "PURIPLAST IBERICA,SA",
     "nombre_material": "FORMOL",
     "n_viajes": 3
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "SELENA IBERIA, SLU",
     "nombre_material": "COLA",
     "n_viajes": 3
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "SERVYECO IBERIA,SL",
     "nombre_material": "FORMOL",
     "n_viajes": 3
    },
    {
     "nombre_origen": "UTISA TERUEL",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "VACIO",
     "n_viajes": 3
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "SANTIAGO",
     "nombre_material": "COLA",
     "n_viajes": 3
    },
    {
     "nombre_origen": "PADRON",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "AGUA",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "ACETATO DE VINILO",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "MADERAS DE LLODIO,SA",
     "nombre_material": "COLA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "REKAR IBERICA, S.A.",
     "nombre_material": "REPARTOS",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "REKAR IBERICA, S.A.",
     "nombre_material": "COLA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TACON DECOR, SL",
     "nombre_material": "FORMOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "BAKELITE IBERICA, SAU",
     "nombre_material": "FORMOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "ARCHELA CONTRACHAPADOS,SL",
     "nombre_material": "COLA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "ORENSE",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "AGUA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "UTISA TERUEL",
     "nombre_material": "PINATURE",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "GERMAN RDGUEZ.IND.SA",
     "nombre_material": "FORMOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "UTISA TERUEL",
     "nombre_material": "REPARTOS",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CONTRACHAP.LUBADI,SL",
     "nombre_material": "COLA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CONTRACHAP.LUBADI,SL",
     "nombre_material": "REPARTOS",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "UTISA TERUEL",
     "nombre_material": "PARALIZACION",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CASTELLON",
     "nombre_material": "COLA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CASTELLON",
     "nombre_material": "REPARTOS",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "LA RIOJA",
     "nombre_material": "COLA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CASTELLON",
     "nombre_material": "COLA/FORMOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "VALENCIA",
     "nombre_material": "REPARTOS",
     "n_viajes": 2
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "PORRIÑO",
     "nombre_material": "METANOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "TERUEL",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "RETORNO",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TERMOLAN, S.A.",
     "nombre_material": "FINCAT",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TABLEROS GARFER, S.A.",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "LICEMA,SA",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "ENCE",
     "nombre_material": "UREA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "ESTARREJA",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "HIDROXIDO SODICO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "ADIEGO HERMANOS, S.A.",
     "nombre_material": "METANOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "BRENNTAG QUIMICA,SA",
     "nombre_material": "FORMOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "ITALIA",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "UTISA TERUEL",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "DEVOLUC.COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CONTRACHAPADOS INDUSTRIALES, S.L.",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CONTRACHAPADOS INDUSTRIALES, S.L.",
     "nombre_material": "REPARTOS",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "COLAS ARTIACH, SL",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "ARCHELA CONTRACHAPADOS,SL",
     "nombre_material": "REPARTOS",
     "n_viajes": 1
    },
    {
     "nombre_origen": "IP DECOR SPAIN, SAU",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "DEVOLUC.COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "LLODIO",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "UTISA TERUEL",
     "nombre_material": "FINCAT",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "VARIOS",
     "n_viajes": 1
    },
    {
     "nombre_origen": "ESTARREJA",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "SOSA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "EGGER PANNEAUX",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CESURES",
     "nombre_material": "FINCAT",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "UTISA TERUEL",
     "nombre_material": "PARALIZACION",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "MADERAS BENIGANIM, SAL",
     "nombre_material": "PARALIZACION",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "LOGROÑO",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TERMOLAN, S.A.",
     "nombre_material": "ADITIVO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "LUGO",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "AGUA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CASTELLON",
     "nombre_material": "VARIOS",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "TERUEL",
     "nombre_material": "FINCAT",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "ALAVA",
     "nombre_material": "FORMOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "TOLEDO",
     "nombre_material": "METANOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "CORUÑA",
     "nombre_material": "FORMOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "GIJON",
     "nombre_material": "METANOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "PADRON",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "LA RIOJA",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "SOSA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CALDAS DE REIS",
     "nombre_destino": "LANGREO",
     "nombre_material": "FORMOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "VILLAGARCIA",
     "nombre_destino": "GIJON",
     "nombre_material": "METANOL",
     "n_viajes": 1
    }
   ]
  },
  "42": {
   "nombre": "BRESFOR IND. DO FORMOL, S.A.",
   "nif": "PT500047944",
   "rutas": [
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "UTISA TERUEL",
     "nombre_material": "COLA",
     "n_viajes": 336
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "OREMBER",
     "nombre_material": "COLA",
     "n_viajes": 38
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "SEVILLA",
     "nombre_material": "METANOL",
     "n_viajes": 20
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "KRONOSPAN, S.L.",
     "nombre_material": "COLA",
     "n_viajes": 15
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "FORMOL",
     "n_viajes": 9
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "SEVILLA",
     "nombre_material": "FORMOL",
     "n_viajes": 5
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "HUELVA",
     "nombre_material": "METANOL",
     "n_viajes": 5
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "CALDAS DE REIS",
     "nombre_material": "COLA",
     "n_viajes": 4
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "CORDOBA",
     "nombre_material": "METANOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "BURGOS",
     "nombre_material": "COLA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BURGOS",
     "nombre_destino": "AVEIRO",
     "nombre_material": "VACIO",
     "n_viajes": 2
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "CURIA SPAIN, SAU",
     "nombre_material": "METANOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "ALCOVER",
     "nombre_material": "FORMOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "TARRAGONA",
     "nombre_material": "FORMOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "ORENSE",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "SANTIAGO",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "CADIZ",
     "nombre_material": "COLA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "IND.QUIM.CUADRADO,SA",
     "nombre_material": "METANOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "VALLADOLID",
     "nombre_material": "METANOL",
     "n_viajes": 1
    }
   ]
  },
  "403": {
   "nombre": "QUIMIDROGA, S.A.",
   "nif": "A08002073",
   "rutas": [
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "ORENSE",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 101
    },
    {
     "nombre_origen": "MIRANDA DE EBRO",
     "nombre_destino": "BRAGA (PT)",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 78
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LEIRIA (PT)",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 73
    },
    {
     "nombre_origen": "MIRANDA DE EBRO",
     "nombre_destino": "VILANOVA FAMALICAO",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 19
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "ZAMORA",
     "nombre_material": "LISINA",
     "n_viajes": 19
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SANTAREM",
     "nombre_material": "QDPOL",
     "n_viajes": 17
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VILARINHO(PT)",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 15
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MEM MARTINS (PT)",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 14
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "AVEIRO",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 14
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LEIRIA (PT)",
     "nombre_material": "LISINA",
     "n_viajes": 14
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "PONTEVEDRA",
     "nombre_material": "LISINA",
     "n_viajes": 11
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SOBRALINHO(PT)",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 10
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SILLEDA",
     "nombre_material": "LISINA",
     "n_viajes": 10
    },
    {
     "nombre_origen": "BURGOS",
     "nombre_destino": "VILANOVA FAMALICAO",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 10
    },
    {
     "nombre_origen": "MIRANDA DE EBRO",
     "nombre_destino": "GUIMARAES",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 8
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "PONTEVEDRA",
     "nombre_material": "ACETATO DE VINILO",
     "n_viajes": 7
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MENDAVIA",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 7
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LEIRIA (PT)",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 7
    },
    {
     "nombre_origen": "BURGOS",
     "nombre_destino": "BRAGA (PT)",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 7
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SANTIAGO",
     "nombre_material": "DIETANOLAMINA",
     "n_viajes": 6
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MEM MARTINS (PT)",
     "nombre_material": "ACRELATO BUTILO",
     "n_viajes": 6
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "CASTANHEIRA RIBATEJO(PT)",
     "nombre_material": "METIL ETER",
     "n_viajes": 5
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LEIRIA (PT)",
     "nombre_material": "GLICERINA",
     "n_viajes": 5
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SARIEGO",
     "nombre_material": "SURFACTAN",
     "n_viajes": 5
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "LEON",
     "nombre_material": "ACETATO METILO",
     "n_viajes": 5
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "PORRIÑO",
     "nombre_material": "SURFACTAN",
     "n_viajes": 5
    },
    {
     "nombre_origen": "ARTEIXO",
     "nombre_destino": "BARCELONA",
     "nombre_material": "Q QUAT",
     "n_viajes": 5
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "ORENSE",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 5
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VALLADOLID",
     "nombre_material": "ACETATO DE ETILO",
     "n_viajes": 4
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "RABADE",
     "nombre_material": "WHITE SPIRIT",
     "n_viajes": 4
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "ZAMORA",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 4
    },
    {
     "nombre_origen": "BURGOS",
     "nombre_destino": "GUIMARAES",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 4
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "GUARDA (PT)",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 4
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VILLATUERTA",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LOUSADA",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "ERMESINDE(PT)",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "GUARDA (PT)",
     "nombre_material": "LG FLEX",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LOUSADA",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 3
    },
    {
     "nombre_origen": "ARTEIXO",
     "nombre_destino": "BARCELONA",
     "nombre_material": "POLICLORURO",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "ZAMORA",
     "nombre_material": "QD FEED",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VALADARES(PT)",
     "nombre_material": "GLICERINA",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VALLADOLID",
     "nombre_material": "LISINA",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "BENAVENTE(PORT.)",
     "nombre_material": "LISINA",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "PONTEVEDRA",
     "nombre_material": "SURFACTAN",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LUGO",
     "nombre_material": "WHITE SPIRIT",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BURGOS",
     "nombre_destino": "VILANOVA FAMALICAO",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "CASTANHEIRA RIBATEJO(PT)",
     "nombre_material": "PARALIZACION",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LEIRIA (PT)",
     "nombre_material": "LG FLEX",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "GUARDA (PT)",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "PAREDES (PT)",
     "nombre_material": "SURFACTAN",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "CARREGADO",
     "nombre_material": "GLICERINA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "PORRIÑO",
     "nombre_material": "ISOPROPANOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "OVAR",
     "nombre_material": "TCPP",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "TABOADA (LU)",
     "nombre_material": "ACIDO PROPIONICO",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "O PORTO",
     "nombre_material": "GLICERINA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SANTAREM",
     "nombre_material": "POLYOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LEON",
     "nombre_material": "LISINA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "TOLEDO",
     "nombre_material": "METANOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MAIA",
     "nombre_material": "ISOBUTANOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "GUARNIZO",
     "nombre_material": "MONOETILENGLICOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "PADRON",
     "nombre_material": "LISINA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "GUARNIZO",
     "nombre_material": "MONOETILENGLICOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SANTAREM",
     "nombre_material": "POLIOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "VALLADOLID",
     "nombre_material": "MONOETILENGLICOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VIANA DO CASTELO",
     "nombre_material": "DIETILENGLICOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "BEGONTE",
     "nombre_material": "SALMO-GAL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "BURGOS",
     "nombre_material": "LISINA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "MIRANDA DE EBRO",
     "nombre_destino": "VILANOVA FAMALICAO",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "CORUÑA",
     "nombre_material": "LISINA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SEGOVIA",
     "nombre_material": "LISINA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SEGOVIA",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BURGOS",
     "nombre_destino": "BRAGA (PT)",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 2
    },
    {
     "nombre_origen": "CAPARROSO",
     "nombre_destino": "CARREGADO",
     "nombre_material": "GLICERINA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LEIRIA (PT)",
     "nombre_material": "TOTM-S",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "BILBAO",
     "nombre_material": "ACETATO METILO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "MIRANDA DE EBRO",
     "nombre_destino": "GUARDA (PT)",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "BARCELONA",
     "nombre_material": "PARALIZACION",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MAIA",
     "nombre_material": "ACETATO METILO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "BEGONTE",
     "nombre_material": "SALMOGAL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "TABOADA (LU)",
     "nombre_material": "SALMO-GAL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "RABADE",
     "nombre_material": "PARALIZACION",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "ST.PAUL (FR)",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 1
    },
    {
     "nombre_origen": "LAVERA",
     "nombre_destino": "BARCELONA",
     "nombre_material": "BUTANOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "O PORTO",
     "nombre_material": "LG FLEX",
     "n_viajes": 1
    },
    {
     "nombre_origen": "VALDEMORO",
     "nombre_destino": "VALADARES(PT)",
     "nombre_material": "GLICERINA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "LISBOA",
     "nombre_destino": "LISBOA",
     "nombre_material": "PARALIZACION",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "ARNEDO",
     "nombre_material": "POLIOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "PONTEVEDRA",
     "nombre_material": "ACETATO DE VINILO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "BRAGA (PT)",
     "nombre_material": "ACIDO ACRILICO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SOBRALINHO(PT)",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "POLANCO",
     "nombre_material": "METIL ETER",
     "n_viajes": 1
    },
    {
     "nombre_origen": "MIRANDA DE EBRO",
     "nombre_destino": "BRAGA (PT)",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 1
    },
    {
     "nombre_origen": "MIRANDA DE EBRO",
     "nombre_destino": "SOBRALINHO(PT)",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SONDIKA",
     "nombre_material": "ESTIRENO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LLEIDA",
     "nombre_material": "LISINA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "CORTEGAÇA(PT)",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MUGARDOS",
     "nombre_material": "DIETILENGLICOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "ARRANCUDIAGA",
     "nombre_material": "SURFACTAN",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VILANOVA FAMALICAO",
     "nombre_material": "ACIDO ACRILICO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VILARINHO(PT)",
     "nombre_material": "TOTM-S",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "OVAR",
     "nombre_material": "FOSFATION",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "OVAR",
     "nombre_material": "LISINA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SINDE (PT)",
     "nombre_material": "QDPOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MAIA",
     "nombre_material": "VARIOS",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MAIA",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LUGO",
     "nombre_material": "SALMO-GAL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "PORTUGAL",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 1
    },
    {
     "nombre_origen": "MIRANDA DE EBRO",
     "nombre_destino": "BRAGA (PT)",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "CORUÑA",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "PONTEVEDRA",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "ASTURIAS",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LUGO",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LUGO",
     "nombre_material": "DESCARGA EN SABADO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MEM MARTINS (PT)",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CORUÑA",
     "nombre_destino": "BARCELONA",
     "nombre_material": "Q QUAT",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CORUÑA",
     "nombre_destino": "BARCELONA",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VILARINHO(PT)",
     "nombre_material": "VARIOS",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VILARINHO(PT)",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CAPARROSO",
     "nombre_destino": "CARREGADO",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MINDELO",
     "nombre_material": "ACETATO DE BUTILO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MINDELO",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "AVEIRO",
     "nombre_material": "POTASA CAUSTICA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "AVEIRO",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "AVEIRO",
     "nombre_material": "PARALIZACION",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "O PORTO",
     "nombre_material": "MEXIFLEX",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "O PORTO",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MANGUALDE(PT)",
     "nombre_material": "TRIETANOLAM.",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MANGUALDE(PT)",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BURGOS",
     "nombre_destino": "GUIMARAES",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "ASTURIAS",
     "nombre_material": "MONOETILENGLICOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "AZPEITIA",
     "nombre_material": "ACETATO METILO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "GUARDA (PT)",
     "nombre_material": "LG FLEX",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "GERONA",
     "nombre_material": "TCPP",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VISEU",
     "nombre_material": "DIETANOLAMINA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "OVIEDO",
     "nombre_material": "BUTILDIGLICOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "CORUÑA",
     "nombre_material": "DIETILENGLICOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "NAVARRA",
     "nombre_destino": "CARREGADO",
     "nombre_material": "GLICERINA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LISBOA",
     "nombre_material": "VINKA-PLAST",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MINDELO",
     "nombre_material": "METILMETACRILATO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "LUGO",
     "nombre_material": "TENSION",
     "n_viajes": 1
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "O PORTO",
     "nombre_material": "SURFACTAN",
     "n_viajes": 1
    }
   ]
  },
  "514": {
   "nombre": "QUIMIDROGA PORTUGAL, LDA",
   "nif": "PT504216260",
   "rutas": [
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "COIMBRA",
     "nombre_material": "MONOETILENGLICOL",
     "n_viajes": 4
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "COIMBRA",
     "nombre_material": "MONOETILENGLICOL",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "SEIXO DE MIRA(PT)",
     "nombre_material": "MONOETILENGLICOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "MEM MARTINS (PT)",
     "nombre_material": "DIETILENGLICOL",
     "n_viajes": 2
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VIANA DO CASTELO",
     "nombre_material": "DIETILENGLICOL",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CAPARROSO",
     "nombre_destino": "LEIRIA (PT)",
     "nombre_material": "GLICERINA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "CAPARROSO",
     "nombre_destino": "LEIRIA (PT)",
     "nombre_material": "SUPLEMENTO",
     "n_viajes": 1
    }
   ]
  },
  "661": {
   "nombre": "RNM TRANSPORTES QUIMICOS, LDA",
   "nif": "PT507663993",
   "rutas": [
    {
     "nombre_origen": "ESTARREJA",
     "nombre_destino": "HUELVA",
     "nombre_material": "ACIDO NITRICO",
     "n_viajes": 9
    },
    {
     "nombre_origen": "AVILES",
     "nombre_destino": "VILANOVA FAMALICAO",
     "nombre_material": "ACIDO SULFURICO",
     "n_viajes": 4
    },
    {
     "nombre_origen": "ESTARREJA",
     "nombre_destino": "BADAJOZ",
     "nombre_material": "ACIDO NITRICO",
     "n_viajes": 4
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "NAVIA",
     "nombre_material": "SOSA",
     "n_viajes": 4
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "PONTEVEDRA",
     "nombre_material": "SOSA",
     "n_viajes": 3
    },
    {
     "nombre_origen": "BARCELONA",
     "nombre_destino": "VILANOVA FAMALICAO",
     "nombre_material": "ACIDO ACETICO",
     "n_viajes": 2
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "PORRIÑO",
     "nombre_material": "SOSA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "VIGO",
     "nombre_destino": "NAVIA",
     "nombre_material": "SOSA",
     "n_viajes": 2
    },
    {
     "nombre_origen": "ZAMUDIO",
     "nombre_destino": "VILANOVA FAMALICAO",
     "nombre_material": "SILICATO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "TORRELAVEGA",
     "nombre_destino": "PONTEVEDRA",
     "nombre_material": "SOSA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "AVILES",
     "nombre_destino": "ALCANENA(PT)",
     "nombre_material": "ACIDO SULFURICO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "VILANOVA FAMALICAO",
     "nombre_destino": "GUADALAJARA",
     "nombre_material": "WAC AB",
     "n_viajes": 1
    },
    {
     "nombre_origen": "ZAMUDIO",
     "nombre_destino": "VILANOVA FAMALICAO",
     "nombre_material": "SODIO SILICATO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "JAEN",
     "nombre_material": "HEXANO",
     "n_viajes": 1
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "LEZO",
     "nombre_material": "SOSA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "AVEIRO",
     "nombre_destino": "CORUÑA",
     "nombre_material": "SOSA",
     "n_viajes": 1
    },
    {
     "nombre_origen": "AZAMBUJA(PT)",
     "nombre_destino": "SEVILLA",
     "nombre_material": "INOPON",
     "n_viajes": 1
    },
    {
     "nombre_origen": "TARRAGONA",
     "nombre_destino": "CORDOBA",
     "nombre_material": "ACETATO DE ETILO",
     "n_viajes": 1
    }
   ]
  },
  "669": {
   "nombre": "RNM TRANSPORTES QUIMICOS ESPAÑA,SLU",
   "nif": "B27880905",
   "rutas": [
    {
     "nombre_origen": "AZAMBUJA(PT)",
     "nombre_destino": "SILLEDA",
     "nombre_material": "INOPON",
     "n_viajes": 1
    }
   ]
  }
 }
};

// datos embebidos de ../catalogo/plantillas-cliente.json
var PLANTILLAS_EMBEBIDAS = {
 "_nota": "QUE y DONDE buscar cada campo, cliente por cliente y documento por documento. Es el punto A: en vez de pedirle al modelo 'datos clave', se le dice la etiqueta impresa exacta y la casilla. ORIGEN DE ESTOS DATOS: observacion directa de los PDF que Julio subio el 27/08/2026. Cada plantilla dice de cuantos documentos salio y que esta pendiente de confirmar con el instructivo por cliente. Una plantilla observada de 1 documento NO es una regla: es una hipotesis con evidencia.",
 "_schema": {
  "cliente": "nombre corto tal como se resuelve en el sistema",
  "razon_social_impresa": "como aparece literalmente en el papel, para identificar al emisor",
  "documentos": "un bloque por tipo de documento que ese cliente emite",
  "titulos": "textos impresos que identifican el documento (para clasificarlo)",
  "campos": "por cada campo facturable: etiqueta impresa, casilla del CMR si aplica, formato esperado y notas",
  "ignorar": "campos que PARECEN el dato correcto y no lo son. Vale tanto como el resto junto",
  "estado": "observado | confirmado — solo 'confirmado' cuando Julio lo valide con el instructivo"
 },
 "plantillas": [
  {
   "cliente": "FORESA",
   "razon_social_impresa": "FORESA IND. QUÍMICAS DEL NOROESTE SA",
   "nif": "A28141224",
   "estado": "confirmado",
   "observado_de": "2 albaranes CMR/ALBARAN, uno de ellos ANOTADO A MANO por Julio",
   "fuente": "PDF 20260819180805 pag.1 y 20260831183358 (anotado por Julio el 31/08)",
   "documentos": [
    {
     "tipo": "cmr_albaran",
     "titulos": [
      "CMR/ALBARAN"
     ],
     "campos": {
      "referencia": {
       "donde": "bajo el titulo 'CMR/ALBARAN', SEGUNDO numero de los dos",
       "formato": "7 digitos",
       "ejemplos_verificados": [
        "2017065",
        "2016400"
       ],
       "_confirmado_por_julio": "En el PDF del 31/08 Julio encerro y rotulo REFERENCIA el 2016400, que es el SEGUNDO. Confirma la lectura.",
       "_no_confundir": "El PRIMER numero (5030294491 / 5030294310, 10 digitos) NO es la referencia de FORESA. OJO: en BRESFOR es al reves — alli manda el de 10 digitos. Documentos casi identicos, reglas opuestas.",
       "_decidido_por_julio": "2026-08-31: \"para bresfor es el numero de 10 digitos, para Foresa el de 7\"."
      },
      "origen": {
       "donde": "casilla 1 'Remitente/Sender (Empresa Cargadora)' — Julio lo rotulo ORIGEN ahi. Corrobora con casilla 4 'Lugar y fecha carga'.",
       "ejemplos_verificados": [
        "FORESA IND. QUIMICAS DEL NOROESTE SA, AVDA Dª URRACA 91, 36650 CALDAS DE REIS -> CALDAS DE REIS"
       ]
      },
      "destino": {
       "donde": "casilla 3 'Destino. Lugar entrega mercancia'",
       "ejemplos_verificados": [
        "Finsa Orember, POLIGONO INDUSTRIAL, SAN CIPRIAN DE VIÑAS 32911 Orense -> OREMBER",
        "TERMOLAN (FABRICA 1), LUGAR DA BARCA - VILA DAS AVES -> VILA DAS AVES"
       ],
       "nota": "Trae la PLANTA, no el pueblo del catalogo: necesita alias empresa->punto."
      },
      "fecha_carga": {
       "donde": "FICHA DEL CHOFER. Regla R-01 del INDICE, reconfirmada por Julio el 31/08 para TODOS los clientes SIN EXCEPCION, incluido RNM. Es la excepcion al principio general de que el documento manda sobre la ficha: para la FECHA DE CARGA, y solo para ella, manda la ficha.",
       "en_el_documento_para_corroborar": "casilla 4.",
       "ejemplos_en_documento": [
        "03.08.2026 18:18:08",
        "10.08.2026 09:04:36"
       ]
      },
      "material": {
       "donde": "linea de mercancia, codigo propio de Foresa",
       "ejemplos_verificados": [
        "FORESA RES 2061",
        "FORESA RES 3169"
       ],
       "nota": "Traducir al material Gesruta."
      },
      "peso_kg": {
       "donde": "casilla 13 'Peso/Weight (Kg)', y repetido en la linea de mercancia",
       "formato": "numero con punto de miles",
       "ejemplo": "22.440",
       "nota": "aparece DOS veces en la misma hoja; si no coinciden, revisar"
      },
      "matricula_tractora": {
       "donde": "casilla 6/7, etiqueta 'Tractor'",
       "formato": "NNNNLLL",
       "ejemplo": "3729JWP",
       "ejemplos_verificados": [
        "3729JLH",
        "3729JWP"
       ]
      },
      "matricula_remolque": {
       "donde": "casilla 6/7, etiqueta 'Plataforma'",
       "ejemplo": "PO02662R",
       "ejemplos_verificados": [
        "R7749BDB",
        "PO02662R"
       ]
      },
      "pedido_cliente": {
       "donde": "columna derecha de la linea de mercancia",
       "ejemplo": "2005046565-000001",
       "nota": "hay ademas un 'P.Clte 2026/442' debajo; no confundirlos"
      },
      "cantidad": {
       "donde": "casilla 13 'Peso/Weight (Kg)', repetido en la linea de mercancia",
       "ejemplos_verificados": [
        "25.800",
        "22.440"
       ],
       "nota": "Aparece dos veces en la hoja; si no coinciden, revisar."
      }
     },
     "ignorar": [
      "casilla 6 'Porteador': es TRANSPORTES LIQUIDOS ESTEVEZ, o sea nosotros. NUNCA es el cliente",
      "casilla 2 'CLIENTE/Consignee': es el DESTINATARIO de la mercancia, no quien nos paga el porte. El cliente que factura es el REMITENTE (casilla 1) salvo que la orden diga otra cosa",
      "casilla 15 'OBSERVACIONES / Entrega': trae otra fecha (07.08.2025) que no es la de carga"
     ]
    }
   ],
   "_mapa_campo_fuente_de_julio": {
    "_nota": "Tabla FORESA/BRESFOR de Julio (31/08). Para estos dos clientes CASI TODO sale del ALBARAN.",
    "cliente": "Albaran",
    "origen": "Albaran",
    "destino": "Albaran",
    "carga_material": "Albaran",
    "referencia": "Albaran",
    "cantidad": "Albaran",
    "fecha_carga": "FICHA CHOFER (no el albaran) — es la excepcion R-01 del INDICE",
    "cabeza_matricula": "Ficha chofer",
    "remolque_matricula": "Ficha chofer",
    "chofer": "Ficha chofer",
    "proveedor": "Ficha chofer",
    "gastos": "Ficha chofer",
    "km_cargado": "Ficha chofer",
    "km_vacio": "Ficha chofer",
    "cod_cliente": "Tabla Gesruta",
    "cod_origen": "Tabla Gesruta",
    "cod_destino": "Tabla Gesruta",
    "cod_material": "Tabla Gesruta",
    "cod_chofer": "Tabla Gesruta",
    "precio": "Tabla Gesruta",
    "regimen_indexacion": "Tabla Gesruta",
    "porcentaje_indexacion": "Tabla Gesruta",
    "importe": "Calculo de sistema",
    "indexacion": "Calculo de sistema",
    "numero_viaje": "Sistema (id ficha)",
    "n_albaran": "Sistema (nro de viaje dentro de la ficha)",
    "reparto": "PENDIENTE DE VER (lo marco Julio)"
   },
   "_confirmado_por": "Julio, 2026-08-31"
  },
  {
   "cliente": "BRESFOR",
   "razon_social_impresa": "BRESFOR IND. DO FORMOL, S.A.",
   "nif": "PT500047944",
   "estado": "confirmado",
   "observado_de": "2 CMR/GUIA DE REMESSA, uno ANOTADO A MANO por Julio",
   "fuente": "PDF 20260819180805 pag.2 y 20260831183405 (anotado por Julio el 31/08)",
   "documentos": [
    {
     "tipo": "cmr_guia_remessa",
     "titulos": [
      "CMR/GUIA DE REMESSA",
      "CIM/DELIVERY NOTE"
     ],
     "campos": {
      "referencia": {
       "donde": "bajo el titulo 'CMR/GUIA DE REMESSA', linea 'Doc. int:', PRIMER numero",
       "formato": "10 digitos",
       "ejemplos_verificados": [
        "5050139934",
        "5050139937"
       ],
       "_decidido_por_julio": "2026-08-31: \"para bresfor es el numero de 10 digitos, para Foresa el de 7\".",
       "_no_confundir": "El SEGUNDO numero (2017609 / 2017612, 7 digitos) NO es la referencia de Bresfor, aunque en FORESA el que manda si sea el segundo. Los dos documentos se parecen mucho y la regla es la OPUESTA en cada uno: es la trampa mas facil de este par de clientes.",
       "_correccion": "Yo habia elegido el segundo por analogia con Foresa y habia dado por equivocada la regla vieja del repo (\"Bresfor 10 digitos\"). La regla vieja era correcta; el error fue mio."
      },
      "origen": {
       "donde": "casilla 1 'Remitente/Sender' — Julio lo rotulo ORIGEN ahi. Corrobora con casilla 4.",
       "ejemplos_verificados": [
        "BRESFOR IND. DO FORMOL, GAFANHA DA NAZARE"
       ]
      },
      "destino": {
       "donde": "casilla 3 'Place of delivery of the goods'",
       "ejemplos_verificados": [
        "Finsa Cella 2, BARRIO DE LA ESTACION, CELLA-TERUEL 44370 -> CELLA (Teruel)"
       ],
       "nota": "El literal mezcla planta, barrio, pueblo y provincia en una linea. De aqui salio la confusion \"CELLA DE ESTACION\"/\"TERUEL\"."
      },
      "fecha_carga": {
       "donde": "FICHA DEL CHOFER. Regla R-01 del INDICE, reconfirmada por Julio el 31/08 para TODOS los clientes SIN EXCEPCION, incluido RNM. Es la excepcion al principio general de que el documento manda sobre la ficha: para la FECHA DE CARGA, y solo para ella, manda la ficha.",
       "en_el_documento_para_corroborar": "FICHA DEL CHOFER (Julio, tabla 31/08). En el documento, casilla 4, para corroborar.",
       "ejemplos_en_documento": [
        "10.08.2026 16:14:59",
        "10.08.2026 17:35:05"
       ]
      },
      "material": {
       "donde": "linea de mercancia",
       "ejemplo": "FORESA RES 1350"
      },
      "peso_kg": {
       "donde": "casilla 13 'Peso/Weight (Kg)'",
       "ejemplo": "21.980"
      },
      "matricula_tractora": {
       "donde": "etiqueta 'Tractor'",
       "ejemplo": "3729JWP",
       "ejemplos_verificados": [
        "7394LZP",
        "3729JWP"
       ]
      },
      "matricula_remolque": {
       "donde": "etiqueta 'Plataforma'",
       "ejemplo": "PO02662R",
       "ejemplos_verificados": [
        "R1832BBC",
        "PO02662R"
       ]
      },
      "cantidad": {
       "donde": "casilla 13 'Peso/Weight (Kg)'",
       "ejemplos_verificados": [
        "22.500",
        "21.980"
       ]
      }
     },
     "ignorar": [
      "'DESTINATARIO/Consignee' (FINANCIERA MADERERA S.A., Santiago de Compostela): es la sede social del cliente final, NO el destino fisico. El destino real esta en la casilla 3 (Cella, Teruel). Confundirlos manda el viaje a Galicia en vez de a Aragon.",
      "'Custo de referencia do gasoleo': mencion legal portuguesa, no es la indexacion de TLE.",
      "'ATCUD' y el QR: control fiscal portugues, no son la referencia."
     ]
    }
   ],
   "_mapa_campo_fuente_de_julio": {
    "_nota": "Tabla FORESA/BRESFOR de Julio (31/08). Para estos dos clientes CASI TODO sale del ALBARAN.",
    "cliente": "Albaran",
    "origen": "Albaran",
    "destino": "Albaran",
    "carga_material": "Albaran",
    "referencia": "Albaran",
    "cantidad": "Albaran",
    "fecha_carga": "FICHA CHOFER (no el albaran) — es la excepcion R-01 del INDICE",
    "cabeza_matricula": "Ficha chofer",
    "remolque_matricula": "Ficha chofer",
    "chofer": "Ficha chofer",
    "proveedor": "Ficha chofer",
    "gastos": "Ficha chofer",
    "km_cargado": "Ficha chofer",
    "km_vacio": "Ficha chofer",
    "cod_cliente": "Tabla Gesruta",
    "cod_origen": "Tabla Gesruta",
    "cod_destino": "Tabla Gesruta",
    "cod_material": "Tabla Gesruta",
    "cod_chofer": "Tabla Gesruta",
    "precio": "Tabla Gesruta",
    "regimen_indexacion": "Tabla Gesruta",
    "porcentaje_indexacion": "Tabla Gesruta",
    "importe": "Calculo de sistema",
    "indexacion": "Calculo de sistema",
    "numero_viaje": "Sistema (id ficha)",
    "n_albaran": "Sistema (nro de viaje dentro de la ficha)",
    "reparto": "PENDIENTE DE VER (lo marco Julio)"
   },
   "_confirmado_por": "Julio, 2026-08-31"
  },
  {
   "cliente": "RNM",
   "razon_social_impresa": "RNM (grupornm.pt) — quien FACTURA es RNM TRANSPORTES QUIMICOS. OJO: no es lo mismo que RNM PRODUTOS QUIMICOS, que es una PLANTA (destino en Vila Nova Famalicao). Mismo grupo, entidades distintas: una paga el porte, la otra recibe carga.",
   "estado": "confirmado",
   "observado_de": "3 juegos COMPLETOS (todas las paginas)",
   "fuente": "PDF 20260828173449 (5 pag), 173513 (3 pag), 173525 (3 pag) — leidos enteros el 29/08",
   "_mapa_campo_fuente_de_julio": {
    "_nota": "Tabla que dio Julio: de donde sale cada columna de la planilla. Se transcribe entera porque es el instructivo, no solo los campos del documento. FC=ficha chofer, OC=orden de carga (email), CMR=CMR/Guia Remessa, GES=tabla Gesruta, SYS=calculo del sistema.",
    "numero_viaje": "SYS (id ficha chofer)",
    "n_albaran": "SYS (nro de viaje dentro de la ficha)",
    "cabeza_matricula": "FC",
    "remolque_matricula": "FC",
    "chofer": "FC",
    "cod_chofer": "GES",
    "proveedor": "FC",
    "cliente": "OC (mail solicitante)",
    "cod_cliente": "GES",
    "origen": "CMR",
    "cod_origen": "GES",
    "destino": "Guia Remessa / CMR / OC  (orden invertido por Julio el 31/08)",
    "cod_destino": "GES",
    "carga_material": "CMR",
    "cod_material": "GES",
    "referencia": "Observacion de OC / Guia Remessa / CMR",
    "fecha_carga": "FICHA CHOFER (R-01, reconfirmado 31/08 para todos)",
    "cantidad": "CMR/Guia Remessa",
    "precio": "GES",
    "importe": "SYS",
    "regimen_indexacion": "GES",
    "porcentaje_indexacion": "GES",
    "indexacion": "SYS",
    "gastos": "FC",
    "reparto": "PENDIENTE DE VER (lo marco Julio)",
    "km_cargado": "FC",
    "km_vacio": "FC"
   },
   "documentos": [
    {
     "tipo": "juego_rnm",
     "titulos": [
      "mail de grupornm.pt",
      "Guia Remessa",
      "ALBARAN/SHIPPING DOCUMENT",
      "DECLARACAO DE EXPEDICAO INTERNACIONAL"
     ],
     "_forma": "NO es un formulario con casillas: es un EMAIL EN PROSA. Los campos estan en frases, en orden bastante estable pero sin casilla fija. Es el PEDIDO; el dato definitivo lo confirma el CMR al cargar. OC y CMR se corroboran entre si.",
     "campos": {
      "cliente": {
       "donde": "DOMINIO del remitente del email: @grupornm.pt -> RNM. Regla robusta.",
       "nota": "El nombre 'RNM' a veces esta en el cuerpo ('la carga es para RNM') y a veces no. El dominio del remitente SIEMPRE esta. No usar el asunto para el cliente."
      },
      "origen": {
       "donde": "GUIA REMESSA \"Local Carga / Loading loc\" (o \"Cargador\"). Respaldo: CMR casilla 4.",
       "ejemplos_verificados": [
        "1052 - LOCAL EXP. AVEIRO -> AVEIRO",
        "GAFANHA DA NAZARE",
        "SAN JUAN DE NIEVA"
       ],
       "_alias_necesario": "SAN JUAN DE NIEVA es el puerto de AVILES (planta de Asturiana de Zinc). Julio lo anoto \"(AVILES)\" a mano. Hace falta el alias SAN JUAN DE NIEVA -> AVILES."
      },
      "destino": {
       "donde": "JERARQUIA (Julio 31/08, invirtio el orden): 1) GUIA REMESSA \"Morada de Entrega / Delivery Address\", 2) CMR casilla 3, 3) OC.",
       "ejemplos_verificados": [
        "DIVERSEY ESPAÑA PRODUCTION S.L., AVENIDA CONDE DUQUE 5-7-9, 28343 VALDEMORO",
        "DIMENSA SL, CARRETERA EX-105 KM 101.5, 06173 NOGALES"
       ],
       "_ojo_cmr": "LA CASILLA 3 DEL CMR NO SIEMPRE SIRVE, y Julio lo anoto a mano: \"MAL! DESTINO INCORRECTO SIEMPRE\". Verificado en los 3 juegos, y el patron es mas fino que eso:\n  - Juego Aviles->Nogales: el CMR lo emite FERQUIMER (un tercero) y su casilla 3 dice \"RNM PRODUTOS QUIMICOS, RUA DA FABRICA, CARREIRA PORTUGAL\" = la SEDE de RNM. El destino real era DIMENSA en Nogales (Badajoz). MAL.\n  - Juego Barcelona->Famalicao: CMR emitido con RNM de destinatario, casilla 3 = FAMALICAO. BIEN.\n  - Juego Aveiro->Valdemoro: CMR emitido por RNM, casilla 3 = VALDEMORO. BIEN.\nLA REGLA que explica los tres: cuando el CMR lo emite un TERCERO y RNM figura como CONSIGNATARIO, el CMR describe el tramo hasta RNM, no hasta el cliente final. Por eso la GUIA REMESSA manda para el destino: en los tres juegos es correcta.",
       "_decidido_por_julio": "2026-08-31: \"Invierte el orden\". La guia manda sobre el CMR para el destino."
      },
      "material": {
       "donde": "GUIA REMESSA, Descripcion/Description de la linea.",
       "ejemplos_verificados": [
        "CAUSTIC SODA LIQUOR 50% - BULK",
        "ACIDO SULFURICO 98% - GRANEL",
        "ACIDO FOSFORICO 80%"
       ]
      },
      "referencia": {
       "donde": "JERARQUIA DE JULIO, por prioridad: 1) observacion de la OC si la trae, 2) GUIA REMESSA campo \"Numero/Number\", 3) CMR casilla 5 \"Documentos anexados\".",
       "fuente_habitual": "GUIA REMESSA, campo \"Numero/Number\" (arriba, junto a la fecha). Julio lo marco a mano como REFERENCIA en los dos juegos que traen guia.",
       "formato": "10 digitos que empiezan en 0",
       "ejemplos_verificados": [
        "0941026332",
        "0141163512"
       ],
       "_confirma_a_julio": "Los dos formatos que Julio dio de memoria (0941026332 / 0141163512) son EXACTAMENTE los dos numeros de guia de estos juegos. Su indicacion era correcta al digito.",
       "_ancla_secundaria": "El CMR repite el mismo numero en la casilla 5: \"PQ - Guia Remessa No 0141163512\". Y en el encabezado del CMR aparece SIN el cero inicial (141163512): sirve para corroborar, pero la forma que manda es la de la guia, con el 0.",
       "_no_confundir": "La OC trae \"REF CARGA: 3100082364\" y la carta de porte del cargador \"PEDIDO No 3100082201\". Ese 31000xxxxx es el PEDIDO DE COMPRA de RNM al proveedor, NO la referencia del transporte."
      },
      "cantidad": {
       "donde": "GUIA REMESSA \"Quant./Qty\" y Total. Corrobora con CMR casilla 11 y con el NETO de la carta de porte del cargador.",
       "ejemplos_verificados": [
        "23.920",
        "23.880",
        "23.740"
       ],
       "nota": "En estos 3 juegos la guia y el CMR coinciden. La carta de porte del cargador da ademas tara y bruto."
      },
      "matricula": {
       "donde": "GUIA REMESSA \"Matricula/Plate\" y \"Reboque/Trailer\". Respaldo: CMR casilla 18.",
       "ejemplos_verificados": [
        "0557JMS / PO-1956-R",
        "7585MCG / R3697BDK",
        "ES 7347LBB / ES 9990BDD"
       ],
       "nota": "Julio la marco a mano en los tres. Se resuelve igual contra el padron, nunca se copia."
      },
      "chofer": {
       "donde": "GUIA REMESSA \"Motorista/Driver\". Respaldo: CMR recuadro 23 con DNI.",
       "ejemplos_verificados": [
        "BREOGAN MARQUEZ SILVA",
        "JACOBO GRANDE MENDEZ"
       ]
      },
      "fecha_carga": {
       "donde": "FICHA DEL CHOFER. Regla R-01 del INDICE, reconfirmada por Julio el 31/08 para TODOS los clientes SIN EXCEPCION, incluido RNM. Es la excepcion al principio general de que el documento manda sobre la ficha: para la FECHA DE CARGA, y solo para ella, manda la ficha.",
       "en_el_documento_para_corroborar": "GUIA REMESSA \"Data Carga/Loading date\" + \"Hora Carga\". Respaldo: CMR casilla 4.",
       "ejemplos_en_documento": [
        "21.07.2026 08:27:00",
        "28.07.2026 10:29:27"
       ]
      }
     },
     "ignorar": [
      "EL ASUNTO del mail usa genericos provinciales (\"Aveiro - Madrid\", \"SULFURICO AVILES - BADAJOZ\") mientras el cuerpo y la guia tienen el punto exacto (Valdemoro, Nogales). Leer el cuerpo, nunca el asunto.",
      "\"NMR CLIENTE: 628\" (OC) — numero interno de RNM, no es la referencia.",
      "\"REF CARGA 31000xxxxx\" (OC) y \"PEDIDO No 31000xxxxx\" (carta de porte) — es el pedido de COMPRA de RNM a su proveedor, no la referencia del transporte.",
      "CASILLA 3 DEL CMR cuando el CMR lo emite un tercero: trae la sede de RNM en Carreira/Landim, no el destino. Ver el campo destino.",
      "La direccion de RNM en el pie de la guia (Avenida das Searas 132, Landim-Famalicao) es la SEDE del emisor.",
      "\"Preco de Referencia do Combustivel 1.35EUR/L\" (CMR) — mencion legal portuguesa, no es la indexacion de TLE."
     ]
    }
   ],
   "_correccion_2026_08_29": "Primera version hecha leyendo solo la pagina 1 (la OC). Los juegos tienen 3 a 5 paginas y la GUIA REMESSA — la fuente habitual de la referencia — estaba en las que no lei.",
   "_estructura_del_juego": {
    "1_oc_email": "Pedido por mail de grupornm.pt. Aviso previo; pesos y datos provisionales.",
    "2_guia_remessa": "La emite RNM. \"Guia Remessa\" o \"ALBARAN/SHIPPING DOCUMENT\". ES EL DOCUMENTO CENTRAL: trae referencia, destino real, matricula, chofer, cantidad y hora de carga.",
    "3_cmr": "Declaracion de expedicion internacional. Corrobora, y trae la referencia otra vez en la casilla 5.",
    "4_carta_de_porte_del_cargador": "Opcional, la emite quien carga (Asturiana de Zinc, Tepsa...). Trae pesos de bascula (tara/bruto/neto) y el pedido 31000xxxxx.",
    "5_certificado_de_calidad": "Opcional. No aporta datos de facturacion."
   },
   "_confirmado_por": "Julio, 2026-08-31"
  },
  {
   "cliente": "QUIMIDROGA",
   "razon_social_impresa": "QUIMIDROGA, S.A. — figura como EXPEDIDOR en la orden de transporte. TUSET 26, 08006 Barcelona (sede; NO es el origen del viaje).",
   "estado": "confirmado",
   "observado_de": "4 juegos completos (OC + carta de porte + CMR)",
   "fuente": "PDF 20260828183738/748/759/808, TODAS sus paginas",
   "_hallazgo": "Quimidroga es el caso MAS FACIL de todos: su OC es un formulario IMPRESO con etiquetas fijas, y trae la referencia DOS veces con dos anclas distintas que siempre coinciden: 'Orden de transporte NNNNNN' (arriba) y 'Referencia en factura: NNNNNN' (bajo el total). Las 4 observadas: 703965, 704269, 704453, 705439 — 6 digitos, empiezan en 70. La segunda ancla, 'Referencia en factura:', es la mas robusta: el propio documento declara cual de los 5 numeros va a factura.",
   "documentos": [
    {
     "tipo": "orden_transporte",
     "titulos": [
      "Quimidroga",
      "Orden de transporte"
     ],
     "_forma": "Formulario impreso con etiquetas fijas a la izquierda. Determinista por ancla.",
     "campos": {
      "cliente": {
       "donde": "recuadro 'Expedidor'",
       "ejemplo": "QUIMIDROGA, S.A.",
       "nota": "el cliente es el EXPEDIDOR, no el destinatario"
      },
      "referencia": {
       "donde": "ancla 'Referencia en factura:' (bajo el Total). Respaldo: 'Orden de transporte' (arriba). Las dos coinciden siempre.",
       "formato": "VARIABLE — 6 digitos en estas 4 OC (70xxxx); Julio indica que tambien aparece de 8 (10068385) segun el comprador. NO validar por longitud: validar por el ANCLA.",
       "ejemplos": [
        "703965",
        "704269",
        "704453",
        "705439"
       ],
       "_matiz_tepsa": "En el juego cargado en Tepsa, la OC dice \"Referencia en factura: 704453\" y la carta de porte de Tepsa dice \"Referencia pedido: 7044531\" (un digito mas). Es la misma referencia con sufijo de la terminal. MANDA LA OC: es la que el cliente declara para factura."
      },
      "origen": {
       "donde": "'Lugar de Carga'",
       "ejemplos": [
        "Miranda de Ebro (Burgos)",
        "Barcelona",
        "TEPSA Barcelona",
        "Relisa Barcelona"
       ],
       "nota": "trae la planta/terminal + localidad",
       "donde_por_formato": {
        "OC": "'Lugar de Carga'",
        "carta de porte Quimidroga": "'Cargador' (recuadro derecho)",
        "carta de porte RELISA": "'DESTINO/ORIGEN' (el recuadro los junta; la planta que emite es el origen)",
        "carta de porte TEPSA": "'Planta cargadora / Loading Plant'",
        "CMR": "casilla 4"
       }
      },
      "destino": {
       "donde": "'Destino' + 'Fecha de entrega'",
       "ejemplos": [
        "Braga (PT)",
        "BEGONTE (Lugo)",
        "Leiria (PT) - Cabopol",
        "SILLEDA-PONTEVEDRA - Nudeza"
       ],
       "donde_por_formato": {
        "OC": "'Destino'",
        "carta de porte Quimidroga": "'Destinatario' + 'Fecha de entrega'",
        "carta de porte RELISA": "'DESTINO/ORIGEN'",
        "carta de porte TEPSA": "'Destinatario / Consignee' y 'Lugar de entrega / Place of delivery'",
        "CMR": "casilla 2 (consignatario) y casilla 3 (lugar de entrega)"
       }
      },
      "material": {
       "donde": "linea 'Posicion', tras el codigo de 6 digitos",
       "ejemplos": [
        "MEXIFLEX 911P",
        "TENSIO-GAL NF",
        "VINKA-PLAST DINP",
        "LISINA LIQUIDA 50%"
       ]
      },
      "cantidad": {
       "donde": "PESO NETO de la CARTA DE PORTE. NUNCA el de la OC.",
       "_evidencia": "En los 3 juegos con peso comparable, el de la OC es REDONDO y PREVISTO, y el real difiere siempre: OC 24.000 -> real 24.040 | OC 24.000 -> real 23.980 | OC 25.000 -> real 24.300. Facturar con el peso de la OC es facturar mal en los tres.",
       "donde_por_formato": {
        "Quimidroga": "\"Peso Neto\" de la linea de mercancia y del TOTAL",
        "RELISA": "\"NETO:\" (junto a TARA y PESO BRUTO)",
        "TEPSA": "\"Peso Neto (Kg) / Net Weight\""
       },
       "_cierra": "Este es el defecto F6 del plan (peso tomado de la OC), ahora con evidencia documental de por que ocurre."
      },
      "n_albaran": {
       "donde": "OC: numero suelto bajo el recuadro Expedidor. Carta de porte: \"ALBARAN / CARTA DE PORTE\" (formato Quimidroga), \"Pedido Cliente\" (formato RELISA), \"Albaran:\" con ceros a la izquierda (formato TEPSA).",
       "formato": "8 digitos que empiezan por 833",
       "ejemplos": [
        "83303431",
        "83303609",
        "83305441",
        "83309254"
       ],
       "_correccion": "ANTES ESTABA EN \"ignorar\" COMO \"interno de Quimidroga\". Era un error: es la LLAVE QUE UNE la OC con su carta de porte. Verificado en los 4 juegos: el numero suelto de la OC reaparece en la carta de porte, en los tres formatos distintos."
      },
      "matriculas": {
       "donde": "Carta de porte y CMR. La OC NO las trae.",
       "donde_por_formato": {
        "Quimidroga": "\"Matricula Tractora\" / \"Matricula Remolque\"",
        "RELISA": "\"TRACTORA...:\" / \"REMOLQUE:\"",
        "TEPSA": "\"Vehiculo tractor\" / \"Cisterna portatil\""
       },
       "ejemplos": [
        "8504-KDR / R-4905-BDF",
        "0332 LPL / CR-03804-R",
        "ES 6557JMS / ES PO01956R"
       ],
       "_discrepancia_real": "En el juego de Tepsa la carta de porte dice tractora ES 6557JMS y el CMR dice ES 0557JMS. En el padron de flota la que existe es 0557JMS. Caso real de por que la matricula se resuelve SIEMPRE contra el padron y nunca se copia del papel."
      },
      "chofer": {
       "donde": "CMR, recuadro 23 (firma del transportista): nombre y DNI",
       "ejemplo": "BREOGAN MARQUEZ SILVA, DNI ES 77412657Q",
       "nota": "Julio da el chofer como campo de la ficha; el CMR sirve de CORROBORACION independiente."
      },
      "fecha_carga": {
       "donde": "FICHA DEL CHOFER. Regla R-01 del INDICE, reconfirmada por Julio el 31/08 para TODOS los clientes SIN EXCEPCION, incluido RNM. Es la excepcion al principio general de que el documento manda sobre la ficha: para la FECHA DE CARGA, y solo para ella, manda la ficha.",
       "en_el_documento_para_corroborar": "FICHA DEL CHOFER (manda, regla R-01 del INDICE). En el documento, para corroborar: OC \"Fecha de Carga\"; carta de porte \"Fecha emision\"/\"FECHA...:\"/\"Fecha de despacho\"; CMR casilla 4.",
       "ejemplos_en_documento": [
        "09/07/2026 (OC)",
        "29-07-2026 09:44 (RELISA)",
        "17/07/2026 17:15 (TEPSA)"
       ]
      }
     },
     "ignorar": [
      "\"Pedido: 2894017/80\" (OC) — pedido interno de Quimidroga, NO la referencia.",
      "\"Ref. cliente / Su Referencia\" (226024, 260875, 1000000571) — referencia del COMPRADOR FINAL, no la de factura. Aparece en la OC y se repite en la carta de porte como \"Su Referencia\".",
      "TUSET 26 / 08006 Barcelona — SEDE de Quimidroga, nunca el origen. El origen es \"Lugar de Carga\" (OC) o \"Cargador\"/\"Planta cargadora\" (carta de porte).",
      "El PESO de la OC: es previsto y redondo. Ver el campo cantidad.",
      "En el formato RELISA, \"TRANSPORTISTA: JUAN MANUEL ABAL IGLESIAS\" es el conductor/autonomo; el nuestro figura abajo como \"Transportista Contractual: TRANSPORTES LIQUIDOS ESTEVEZ\"."
     ]
    }
   ],
   "_correccion_2026_08_29": "ERROR PROPIO CORREGIDO. La primera version de esta plantilla se hizo leyendo solo la PAGINA 1 de cada PDF (la OC). Cada PDF es un JUEGO de 2-3 paginas: 1o OC, 2o CARTA DE PORTE, 3o CMR. Julio lo detecto. Las paginas que faltaban cambian tres conclusiones, y una de ellas al reves.",
   "_estructura_del_juego": {
    "1_oc": "Orden de transporte de Quimidroga. Es el PEDIDO: dice lo que se va a cargar. Pesos REDONDOS previstos.",
    "2_carta_de_porte": "La emite QUIEN CARGA, y por eso CAMBIA DE FORMATO segun la planta. Tres formatos distintos observados en 4 juegos: Quimidroga (ALBARAN/CARTA DE PORTE), RELISA, TEPSA IBERIA. Trae el peso REAL de bascula y las matriculas.",
    "3_cmr": "Carta de porte internacional. A veces IMPRESA (Tepsa) y a veces MANUSCRITA (juego 1). Trae matriculas, chofer y peso neto.",
    "nota": "Esto confirma lo que dijo Julio: \"dependiendo donde cargan son los documentos con los que nos encontramos y sus formatos\". El cliente es uno; los formatos de carta de porte son varios."
   },
   "_confirmado_por": "Julio, 2026-08-28 (tabla campo->fuente) y 2026-08-31 (regla de peso de carga)",
   "_mapa_campo_fuente_de_julio": {
    "fecha_carga": "FICHA CHOFER (R-01, reconfirmado 31/08 para todos)"
   }
  }
 ],
 "_principio_extraccion_por_ancla": "LA RESPUESTA a la pregunta de Julio ('sos capaz de dar referencias segun cada documento y formato'). SI, pero la clave NO es adivinar el formato del numero — que Julio confirma que varia (6 digitos, 8 digitos, guia remessa 0941026332, o ninguno). La clave es la ETIQUETA ANCLA que precede al numero, que SI es estable por emisor: Quimidroga 'Referencia en factura:', Foresa el 2do numero bajo 'CMR/ALBARAN', Bresfor el 2do tras 'Doc. int:', RNM 'REF CARGA:' en el mail. Se extrae por ancla, no por formato. El formato sirve solo como verificacion secundaria. Perseguir el formato es fragil (cambia); perseguir el ancla es determinista (no cambia). Por eso cada campo de estas plantillas dice 'donde' (el ancla) antes que 'formato'.",
 "_jerarquia_de_fuentes": "Julio, 28/08: cuando un campo lista varias fuentes ('Observacion OC/Guia Remessa/CMR'), es una JERARQUIA por orden: se usa la 1a que tenga el dato, y si no, la siguiente. Para la referencia de RNM: 1) observacion de la OC, 2) Guia Remessa, 3) CMR. No es que las tres den lo mismo: es un fallback ordenado.",
 "_pendiente": [
  "Anotar el resto de clientes: CLAVO, BALTRANSA, TRANSTAMBRE, HELM, Q. DEL JARAMA",
  "HELM: la orden de transporte trae el PRECIO impreso (\"Coste de transporte: 2.071,92 EUR\"), y tres numeros distintos que Julio marco a mano: Orden de flete 6100302451, REFERENCIA DE CARGA TPS022186, No PEDIDO 200846006. Falta saber cual es la referencia de factura."
 ],
 "_estructura_de_los_pdf": "CORRECCION DE FONDO (29/08). Un PDF NO es un juego de un viaje. Verificado en el de 6 paginas 20260819180805, que contiene TRES viajes de clientes distintos:\n  pag 1  FORESA  CMR/ALBARAN            Caldas -> Termolan\n  pag 2  BRESFOR CMR/GUIA REMESSA       Gafanha -> Finsa Cella\n  pag 3  FINSA   MOVIMIENTO MERCANCIA   bascula de DESCARGA del viaje de la pag 2\n  pag 4  HELM    Orden de transporte    Barcelona -> Foresa Caldas\n  pag 5  MILADERTO Albaran de entrega   el mismo viaje de la pag 4\n  pag 6  FORESA  MOVIMIENTO MERCANCIA   bascula de descarga del viaje de la pag 4\nLos PDF son LOTES escaneados de corrido. Hay que clasificar pagina por pagina por emisor y tipo, y despues agrupar en juegos por matricula + fecha + material. No se puede asumir \"1 PDF = 1 viaje\" ni \"pagina 1 = el documento principal\".",
 "_regla_peso": "DECIDIDO POR JULIO 2026-08-31: para facturar MANDA EL PESO DE CARGA, el del ALBARAN / CMR. El ticket de bascula de la planta que DESCARGA (\"MOVIMIENTO MERCANCIA\" de FINSA o FORESA) NO se usa para facturar, aunque de un neto distinto (21.980 carga vs 21.960 descarga). Sirve solo como corroboracion. Y sigue en pie lo de Quimidroga: dentro de los documentos de CARGA, manda la CARTA DE PORTE/ALBARAN (peso real de bascula al cargar), nunca la OC (previsto, redondo).",
 "_regla_referencia_foresa_bresfor": "FORESA y BRESFOR emiten documentos casi identicos (mismo diseño, dos numeros arriba a la derecha) y la regla de la referencia es la OPUESTA en cada uno. Decidido por Julio el 31/08/2026:\n    FORESA  -> el SEGUNDO numero, 7 digitos   (2016400, 2017065)\n    BRESFOR -> el PRIMER numero, 10 digitos   (5050139934, 5050139937)\nPor eso la referencia NO se puede extraer con una regla comun de \"documento tipo CMR\": hay que identificar primero al EMISOR (casilla 1 / remitente) y recien despues aplicar su regla.",
 "_regla_fecha_de_carga": "FICHA DEL CHOFER. Regla R-01 del INDICE, reconfirmada por Julio el 31/08 para TODOS los clientes SIN EXCEPCION, incluido RNM. Es la excepcion al principio general de que el documento manda sobre la ficha: para la FECHA DE CARGA, y solo para ella, manda la ficha."
};

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
//   - columnas nuevas: regimen_indexacion, origen_km, origen_km_vacios, origen_campos (audit JSON),
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
// CASCADA DE PRECIO (resolverPrecio, inlineado): 1) tarifa contractual, 2) tarifa
// por ANALOGIA confirmada por Julio (embebida en ANALOGIAS_EMBEBIDAS), 3) precio
// impreso en la orden, 4) vacio con motivo. Antes solo corria el escalon 1
// (buscarTarifaContractual) y las 12 analogias confirmadas no se aplicaban nunca.
// `origen_del_precio` viaja a la fila para que la vista muestre de donde salio.
var ANALOGIAS = (typeof ANALOGIAS_EMBEBIDAS !== 'undefined') ? ANALOGIAS_EMBEBIDAS : {};
var RUTAS_CLIENTE = (typeof RUTAS_CLIENTE_EMBEBIDAS !== 'undefined') ? RUTAS_CLIENTE_EMBEBIDAS : {};
var PLANTILLAS = (typeof PLANTILLAS_EMBEBIDAS !== 'undefined') ? PLANTILLAS_EMBEBIDAS : {};
// GUARDA DE REFERENCIA POR EMISOR (verificarReferencia, inlineado). Solo el
// formato del emisor: Foresa referencia de 7 digitos, Bresfor de 10 — reglas
// OPUESTAS en documentos casi identicos. Si el numero leido no cumple el formato
// de ESE cliente, es casi seguro que se tomo el numero equivocado (el otro que hay
// en el documento) -> REVISAR. La comprobacion CRUZADA contra los demas numeros
// del documento (mas potente) necesita que el prompt los extraiga por separado;
// queda para cuando se toque el prompt. Sin plantilla del cliente no opina.
const chequearReferencia = function (v) {
  if (typeof verificarReferencia !== 'function' || !v.referencia || !v.cliente) { return ''; }
  const r = verificarReferencia(v.referencia, v.cliente, PLANTILLAS);
  return (r && r.ok === false && r.revisar) ? (r.motivo || 'referencia con formato inesperado para el cliente') : '';
};
const tarifaDe = function (v, origenLit, destinoLit) {
  if (typeof resolverPrecio !== 'function' || !tarifasTbl.length) { return { tn: null, fijo: null, motivo: '', origen_precio: null }; }
  const viaje = { cliente: v.cliente, origen: origenLit, destino: destinoLit, material: v.material, precio_orden: v.tarifa_tn_documento };
  const r = resolverPrecio(viaje, tarifasTbl, ANALOGIAS, puntosTbl);
  if (!r) { return { tn: null, fijo: null, motivo: '', origen_precio: null }; }
  if (r.tarifa === null && r.tarifa_tn === undefined && r.precio_fijo === undefined) {
    return { tn: null, fijo: null, motivo: r.motivo || '', origen_precio: null };
  }
  return {
    tn: (r.tarifa_tn === undefined ? null : r.tarifa_tn),
    fijo: (r.precio_fijo === undefined ? null : r.precio_fijo),
    motivo: r.revisar ? (r.motivo || ('tarifa via punto resuelto — verificar (' + s(origenLit) + '->' + s(destinoLit) + ')')) : '',
    origen_precio: r.origen_del_precio || null,
  };
};

const filas = [];
for (const v of viajes) {
  // Literal de lugar que SI resuelve a punto (documento, si no la ficha).
  let origenLit = mejorLiteralPunto(v.origen, v.lugar_carga);
  let destinoLit = mejorLiteralPunto(v.destino, v.lugar_descarga);
  // GUARDA ORIGEN != DESTINO (bug real ejec 1065). GPT leyo el CMR y puso como
  // ORIGEN el lugar de ENTREGA ("CELLA, TERUEL"); los dos literales resolvieron
  // al MISMO punto y el viaje quedo "TE · TERUEL -> TE · TERUEL". Ninguna tarifa
  // existe para una ruta a si misma, asi que ademas se perdia el precio. Un viaje
  // nunca carga y descarga en el mismo punto: si eso pasa, el documento se leyo
  // mal -> manda la FICHA. Se compara el PUNTO CANONICO, no el literal, porque el
  // colapso ocurre justo al traducir ("CELLA, TERUEL" y "CELLA" -> TERUEL).
  let avisoRuta = '';
  const pg0 = puntoGesruta(origenLit), pg1 = puntoGesruta(destinoLit);
  if (pg0 && pg0 === pg1) {
    const oF = s(v.lugar_carga), dF = s(v.lugar_descarga);
    if (oF && dF && puntoGesruta(oF) !== puntoGesruta(dF)) {
      avisoRuta = 'el documento daba el mismo punto como origen y destino (' + pg0 + '); se usa la ruta de la ficha (' + oF + ' -> ' + dF + ')';
      origenLit = oF; destinoLit = dF;
    } else {
      avisoRuta = 'origen y destino resuelven al mismo punto (' + pg0 + ') y la ficha no los distingue; ruta anulada por imposible';
      origenLit = ''; destinoLit = '';
    }
  }
  // CONJUNTO CERRADO DEL CLIENTE (rutas-conocidas, embebido). No cambia QUE punto
  // se elige: pregunta si ESTE cliente hizo alguna vez esta ruta. No rechaza rutas
  // nuevas, las MARCA -> la fila va a REVISAR con el motivo. Es la guarda que caza
  // el TERUEL de RNM: una direccion postal mal impresa que resuelve a un punto al
  // que el cliente nunca viajo. Un cliente fuera del recorte de prueba (RUTAS
  // vacio para el) no genera aviso: degrada a silencio, no a falso positivo.
  if (typeof resolverPuntoDeCliente === 'function' && origenLit && destinoLit) {
    const rc = resolverPuntoDeCliente(destinoLit, { cliente: v.cliente, rol: 'destino', origen: origenLit }, puntosTbl, RUTAS_CLIENTE);
    if (rc && rc.ruta_conocida === false && rc.aviso_ruta) {
      avisoRuta = [avisoRuta, rc.aviso_ruta].filter(Boolean).join('; ');
    }
  }
  const avisoRef = chequearReferencia(v);
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
    // De donde salio el precio: 'contractual' | 'analogia' | 'orden' | ''. La
    // analogia y la orden son observadas, no pactadas: la vista las muestra a parte.
    origen_del_precio: s(tar.origen_precio),
    pais_facturacion: paisDe(v.cliente, v.referencia),
    fecha_descarga: s(v.fecha_descarga),
    km_inicio: n(v.km_inicio),
    km_final: n(v.km_final),
    km_cargados: n(v.km_cargados),
    km_vacios: n(v.km_vacios),
    // De donde salio el km vacio, o por que no se pudo calcular:
    //   cadena_tabla        encadenado con el ultimo odometro de la tabla Viajes
    //   cadena_lote         encadenado con otro viaje del mismo lote
    //   sin_odometro_previo primer viaje conocido de esa tractora
    //   sin_km_inicio / sin_matricula / negativo / salto_excesivo
    origen_km_vacios: s(v.origen_km_vacios),
    // Calidad de LECTURA de la ficha (v3.2). Eje distinto de `estado`, que habla
    // de documentacion. Sin valor por defecto: si el correlacionador no lo puso,
    // queda vacio y se ve como no determinado, nunca como un OK.
    // Si se corrigio la ruta por la guarda origen!=destino, la fila va a REVISAR
    // aunque la lectura fuera OK: el humano tiene que confirmar la ruta.
    estado_lectura: (avisoRuta || avisoRef) ? 'REVISAR' : s(v.estado_lectura),
    motivo_revision: [s(v.motivo_revision), avisoRuta, avisoRef].filter(Boolean).join('; '),
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
