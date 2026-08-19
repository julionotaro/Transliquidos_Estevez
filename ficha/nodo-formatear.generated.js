// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/../catalogo/resolver-punto.js + ficha/cruce.js + ficha/../correlacion/correlacionar-n2.js + ficha/correlacionar.js + ficha/nodo-formatear.wrapper.js
// Contenido exacto del nodo Code "Formatear Linea Gesruta" (WD0q9Ic0oDvUoJwp).

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

// ===== CRUCE FICHA<->DOCUMENTO — reglas del modelo "albaran = unidad facturable" =====
//
// Fase 2 (encargo 2026-08-01). Corrige el supuesto "1 bloque de ficha = 1 viaje".
//
//   El albaran (o documento de origen equivalente) es la unidad FACTURABLE.
//   El bloque de la ficha es la DECLARACION del chofer sobre su jornada.
//   Un bloque puede representar N viajes; quien define N son los documentos.
//
// Este modulo aisla las piezas CONFIGURABLES y las funciones PURAS del cruce, para
// que no queden hardcodeadas en el medio de correlacionar.js y sean testeables
// solas. La logica de expansion/consolidacion que las usa vive en correlacionar.js.
//
// ESTRUCTURA confirmada contra dato real (encargo v1.1 2026-08-03): la
// exportacion del sistema de escritorio (expediente 00050461, CALDAS DE
// REIS->OREMBER) trae exactamente este patron -- 3 viajes Nº 01/02/03, cada uno
// con su propia referencia e importe, mismo cabeza/remolque. El modelo
// bloque=N viajes ya NO esta "no verificado" a nivel de dominio.
//
// Lo que SIGUE sin probar es la LECTURA: no hay todavia una ficha manuscrita
// real de un bloque multi-viaje para confirmar que gpt-4o lee bien `cantidad=3`
// en el campo de la ficha (riesgo de OCR, distinto del riesgo de estructura que
// ya se cerro). Cuando aparezca esa ficha escaneada, es la primera corrida a
// hacer. Ver docs/fase2-cierre-y-fase3-bloqueantes.md.

'use strict';

// --- RUTAS_MULTIVIAJE: lista configurable, facil de ampliar ------------------
// Cada entrada es una ruta (cliente, origen, destino) donde el chofer escribe en
// el campo `cantidad` de la ficha el NUMERO DE VIAJES, no los kg. Arranca con la
// unica confirmada (FORESA Villagarcia -> Caldas de Reis, metanol). Para sumar
// una ruta: agregar un objeto aca, NO tocar la logica.
var RUTAS_MULTIVIAJE = [
  { cliente: 'FORESA', origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS' },
];

// Red de seguridad: los pesos SIEMPRE van en miles de kg. Un valor de uno o dos
// digitos es imposible como peso -> probable numero de viajes de una ruta que
// todavia no esta en RUTAS_MULTIVIAJE. En vez de meter "4 kg" en silencio, se
// manda a REVISAR para que aparezca en el tablero. Cuando se confirme la ruta,
// se agrega arriba y deja de preguntar.
var UMBRAL_CANTIDAD_KG = 100;

// --- Normalizacion de texto para el match de rutas ---------------------------
// La ficha escribe "Villagarcía"/"VILLAGARCIA", "Caldas"/"Caldas de Reis". Se
// compara sin acentos, en mayusculas y por inclusion en ambos sentidos, para que
// "CALDAS" matchee "CALDAS DE REIS" sin volverse laxo (no matchea vacios).
function quitarAcentos(s) {
  return (s === null || s === undefined ? '' : String(s)).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function norm(s) {
  return quitarAcentos(s).toUpperCase().replace(/\s+/g, ' ').trim();
}
function coincideTexto(valorFicha, valorRuta) {
  var a = norm(valorFicha);
  var b = norm(valorRuta);
  if (!a || !b) { return false; }
  return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
}

/**
 * ¿La terna (cliente, origen, destino) de la ficha es una ruta multi-viaje?
 * @returns {object|null} la entrada de RUTAS_MULTIVIAJE que coincide, o null.
 */
function esRutaMultiviaje(cliente, origen, destino, rutas) {
  var lista = Array.isArray(rutas) ? rutas : RUTAS_MULTIVIAJE;
  for (var i = 0; i < lista.length; i++) {
    var r = lista[i];
    if (coincideTexto(cliente, r.cliente) && coincideTexto(origen, r.origen) && coincideTexto(destino, r.destino)) {
      return r;
    }
  }
  return null;
}

/**
 * Regla determinista del §1: decide si `cantidad` de la ficha son kg o numero de
 * viajes. NO adivina: o la ruta esta registrada, o la red de seguridad la manda
 * a REVISAR.
 *
 * @param {number|null} cantidad  el valor leido del campo cantidad de la ficha.
 * @returns {{modo:'viajes'|'kg'|'revisar', n_viajes:number|null, kg:number|null,
 *            motivo:string|null, ruta:object|null}}
 */
function clasificarCantidad(cantidad, cliente, origen, destino, rutas) {
  var ruta = esRutaMultiviaje(cliente, origen, destino, rutas);
  var c = (typeof cantidad === 'number' && isFinite(cantidad)) ? cantidad : null;
  if (ruta) {
    // Ruta multi-viaje: cantidad = numero de viajes. Si no se leyo, el caller lo
    // manda a REVISAR (no se puede expandir sin saber cuantos).
    return { modo: 'viajes', n_viajes: (c && c > 0) ? c : null, kg: null, motivo: null, ruta: ruta };
  }
  if (c !== null && c < UMBRAL_CANTIDAD_KG) {
    return { modo: 'revisar', n_viajes: 1, kg: null, motivo: 'posible_multiviaje_ruta_no_registrada', ruta: null };
  }
  return { modo: 'kg', n_viajes: 1, kg: c, motivo: null, ruta: null };
}

// --- CLIENTES_CONOCIDOS: lista configurable, unico lugar (Cierre v1, pieza 1) -
// Un cliente leido fuera de esta lista NUNCA recibe regimen por defecto: eso fue
// el bug real (gpt-4o leyo "FORBA" -- misread de FORESA -- y el sistema le asigno
// 'linea' en silencio, cuando por D-06 le tocaba 'agregada_quincenal'). La solucion
// NO es un alias de FORBA: un alias por cada misread convierte un error de lectura
// en regla de negocio, y manana aparece "FORESAA" o "FORFSA". Un cliente fuera de
// esta lista falla RUIDOSO (REVISAR con el valor leido en el motivo), nunca en
// silencio. Para sumar un cliente real nuevo: agregarlo aca, nada mas.
var CLIENTES_CONOCIDOS = ['FORESA', 'BRESFOR', 'QUIMIDROGA', 'RNM', 'HELM', 'BALTRANSA'];

/** ¿El cliente leido esta en la lista de clientes conocidos? */
function esClienteConocido(cliente, clientes) {
  var lista = Array.isArray(clientes) ? clientes : CLIENTES_CONOCIDOS;
  var cl = norm(cliente);
  if (!cl) { return false; }
  for (var i = 0; i < lista.length; i++) {
    if (cl.indexOf(norm(lista[i])) >= 0) { return true; }
  }
  return false;
}

/**
 * Regimen de indexacion (suplemento gasoleo) por cliente + ruta (D-03 y D-06).
 * NO calcula la indexacion — solo marca el regimen; el calculo se cierra en la
 * facturacion (D-03, encargo §8 fuera de alcance). Routing de dominio, tabla
 * configurable como RUTAS_MULTIVIAJE.
 *
 *   incluida            Baltransa: la tarifa ya la contiene, no se agrega.
 *   agregada_mensual    FORESA Villagarcia -> Caldas (metanol): un total por mes.
 *   agregada_quincenal  FORESA Caldas de Reis -> Ourense (Orember): total quincenal.
 *   linea               caso general (FORESA otros destinos, Quimidroga, RNM...).
 *
 * Cliente fuera de CLIENTES_CONOCIDOS (o no leido): NO se asigna regimen por
 * defecto. Devuelve motivo para que el caller marque el viaje REVISAR con el
 * valor leido visible (Cierre v1, pieza 1) — el error de lectura no debe
 * disfrazarse de decision de negocio.
 *
 * @returns {{regimen: 'incluida'|'agregada_mensual'|'agregada_quincenal'|'linea'|null,
 *            motivo: string|null}}
 */
function regimenIndexacion(cliente, origen, destino, clientes) {
  if (!esClienteConocido(cliente, clientes)) {
    return { regimen: null, motivo: 'cliente_no_reconocido: ' + (nz_local(cliente) || '(no se leyo)') };
  }
  var cl = norm(cliente);
  if (cl.indexOf('BALTRANSA') >= 0) { return { regimen: 'incluida', motivo: null }; }
  var esForesa = cl.indexOf('FORESA') >= 0 || cl.indexOf('BRESFOR') >= 0;
  if (esForesa) {
    if (coincideTexto(origen, 'VILLAGARCIA') && coincideTexto(destino, 'CALDAS DE REIS')) { return { regimen: 'agregada_mensual', motivo: null }; }
    if (coincideTexto(origen, 'CALDAS') && (coincideTexto(destino, 'OURENSE') || coincideTexto(destino, 'ORENSE'))) { return { regimen: 'agregada_quincenal', motivo: null }; }
    return { regimen: 'linea', motivo: null }; // FORESA a cualquier otro destino: por viaje (D-06).
  }
  return { regimen: 'linea', motivo: null }; // QUIMIDROGA, RNM, HELM: por viaje (regla general).
}
// nz_local: version standalone de nz (correlacionar.js la tiene con otro nombre;
// aca solo hace falta para el mensaje de motivo, sin acoplar los dos modulos).
function nz_local(x) { if (x === null || x === undefined) { return null; } var s = String(x).trim(); return (s === '' || s.toLowerCase() === 'null') ? null : s; }

/**
 * Reparte los km del bloque entre n viajes (§1). Piso entero a cada uno y el
 * RESTO al ultimo, para que la suma de los n cierre EXACTAMENTE con el total del
 * bloque. Regla fija y documentada; si cambia, cambia aca y en el test.
 *
 * @returns {number[]} n enteros cuya suma es kmBloque (o [] si no hay dato).
 */
function repartirKm(kmBloque, n) {
  if (kmBloque === null || kmBloque === undefined || !isFinite(kmBloque)) { return []; }
  if (!Number.isInteger(n) || n <= 0) { return []; }
  var base = Math.floor(kmBloque / n);
  var out = [];
  for (var i = 0; i < n; i++) { out.push(base); }
  out[n - 1] += (kmBloque - base * n);
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RUTAS_MULTIVIAJE: RUTAS_MULTIVIAJE,
    UMBRAL_CANTIDAD_KG: UMBRAL_CANTIDAD_KG,
    CLIENTES_CONOCIDOS: CLIENTES_CONOCIDOS,
    norm: norm,
    coincideTexto: coincideTexto,
    esRutaMultiviaje: esRutaMultiviaje,
    esClienteConocido: esClienteConocido,
    clasificarCantidad: clasificarCantidad,
    regimenIndexacion: regimenIndexacion,
    repartirKm: repartirKm,
  };
}

// ===== CORRELACION documento<->viaje NIVEL 2 (modelo-dominio-lectura.md §5.2) =
//
// Cascada de correlacion:
//   Nivel 1  -> por `referencia` (la mas fuerte, la emite el cliente).
//   Nivel 2  -> por origen + destino + material + fecha + peso, cuando no hay
//               referencia o para desambiguar dias multi-pata (caso Baltransa:
//               la OC lleva fecha de EMISION, distinta de la del viaje).
//
// Reglas duras:
//   - El km NO correlaciona (no existe en ningun documento de transporte, §5).
//   - Nunca se asigna por fecha sola, ni cliente solo, ni ruta sola: sin
//     origen+destino+material NO hay N2.
//   - Respeta §7 (cardinalidad N:1): un viaje ya correlacionado NO sale del pool
//     si la ruta esta en RUTAS_MULTIVIAJE (rotaciones Foresa metanol).
//
// Logica PURA. Reusa resolver-punto.js (puntos canonicos) y cruce.js
// (RUTAS_MULTIVIAJE), no los duplica.

'use strict';

var RP = (typeof resolverPunto === 'function')
  ? { resolverPunto: resolverPunto }
  : require('../catalogo/resolver-punto.js');
var N2_CRUCE = (typeof esRutaMultiviaje === 'function')
  ? { esRutaMultiviaje: esRutaMultiviaje }
  : require('../ficha/cruce.js');

var VENTANA_OC_DIAS = 2;     // decision de Julio: la OC se emite hasta 2 dias antes
var TOL_PESO = 0.02;         // ±2% para el desempate por peso

function s(x) { return (x === null || x === undefined) ? '' : String(x); }
function n2num(x) { var n = (typeof x === 'number') ? x : Number(x); return isFinite(n) ? n : null; }
function normTxt(x) { return s(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }

// Compatibilidad de material: inclusion en cualquier sentido, sin acentos. No
// matchea vacios (fail-loud: sin material no hay N2).
function materialCompatible(a, b) {
  var na = normTxt(a), nb = normTxt(b);
  if (!na || !nb) { return false; }
  return na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0;
}

// Dias entre dos fechas ISO (b - a). null si alguna no parsea.
function diffDias(a, b) {
  var da = Date.parse(s(a) + 'T00:00:00Z'), db = Date.parse(s(b) + 'T00:00:00Z');
  if (!isFinite(da) || !isFinite(db)) { return null; }
  return Math.round((db - da) / 86400000);
}

/**
 * Clasificador BINARIO de documento (CAMBIO 1): orden vs documento de transporte.
 * La ventana temporal depende de esto. Usa tipo_doc ya extraido; si no alcanza,
 * busca marcadores en el encabezado. Sin señal -> 'desconocido' (ventana ancha,
 * comportamiento seguro).
 * @returns {'orden'|'transporte'|'desconocido'}
 */
function clasificarDocumento(doc) {
  var tipo = normTxt(doc && doc.tipo_doc);
  if (tipo === 'ORDEN_TRANSPORTE' || tipo === 'ORDEN_CARGA' || tipo === 'ORDEN') { return 'orden'; }
  if (tipo === 'CMR' || tipo === 'ALBARAN' || tipo === 'CARTA_PORTE' || tipo === 'BASCULA') { return 'transporte'; }
  var cab = normTxt((doc && (doc.encabezado || doc.texto || doc.titulo)) || '');
  if (cab.indexOf('ORDEN DE TRANSPORTE') >= 0 || cab.indexOf('ORDEN DE CARGA') >= 0) { return 'orden'; }
  if (cab.indexOf('CMR') >= 0 || cab.indexOf('ALBARAN') >= 0 || cab.indexOf('CARTA DE PORTE') >= 0 || cab.indexOf('TICKET DE BASCULA') >= 0) { return 'transporte'; }
  return 'desconocido';
}

// Ventana temporal segun clase (asimetrica: la orden se emite ANTES del viaje).
function ventana(clase, opts) {
  var vo = (opts && typeof opts.ventanaOcDias === 'number') ? opts.ventanaOcDias : VENTANA_OC_DIAS;
  if (clase === 'orden') { return { antes: 0, despues: vo }; }        // solo hacia adelante
  if (clase === 'transporte') { return { antes: 1, despues: 1 }; }    // contemporaneo
  return { antes: 1, despues: 2 };                                    // desconocido: ancha
}
function dentroVentana(fechaDoc, fechaViaje, clase, opts) {
  var d = diffDias(fechaDoc, fechaViaje);
  if (d === null) { return false; }
  var v = ventana(clase, opts);
  return d >= -v.antes && d <= v.despues;
}

function idCanon(literal, catalogo) {
  var r = RP.resolverPunto(literal, 'documento', catalogo);
  return r.id_punto || null;
}

/**
 * Correlaciona UN documento contra un pool de viajes candidatos.
 * @returns {{correlacion, viaje, confianza, revisar, motivo, candidatos}}
 *   correlacion: 'N1' | 'N2' | 'sin_correlacion'
 */
function correlacionarN2(doc, viajes, catalogo, opts) {
  opts = opts || {};
  var lista = Array.isArray(viajes) ? viajes : [];

  // ---- Nivel 1: referencia ----
  var ref = normTxt(doc && doc.referencia);
  if (ref) {
    for (var i = 0; i < lista.length; i++) {
      if (normTxt(lista[i].referencia) === ref) {
        return { correlacion: 'N1', viaje: lista[i], confianza: 'alta', revisar: false, motivo: '', candidatos: [lista[i]] };
      }
    }
  }

  // ---- Nivel 2: origen + destino + material + fecha + peso ----
  var clase = clasificarDocumento(doc);
  var oDoc = idCanon(doc && doc.origen, catalogo);
  var dDoc = idCanon(doc && doc.destino, catalogo);
  if (!oDoc || !dDoc) {
    return { correlacion: 'sin_correlacion', viaje: null, confianza: 'ninguna', revisar: true,
      motivo: 'N2 imposible: documento sin origen/destino resoluble (origen="' + s(doc && doc.origen) + '", destino="' + s(doc && doc.destino) + '")', candidatos: [] };
  }
  var matDoc = doc && doc.material;

  // Requisitos duros: mismo origen_canonico + destino_canonico + material compatible.
  var compat = lista.filter(function (v) {
    return idCanon(v.origen, catalogo) === oDoc &&
           idCanon(v.destino, catalogo) === dDoc &&
           materialCompatible(matDoc, v.material);
  });
  // Señal de desempate 1: ventana temporal (por tipo de documento).
  var enVentana = compat.filter(function (v) { return dentroVentana(doc && doc.fecha, v.fecha_carga || v.fecha, clase, opts); });

  if (enVentana.length === 0) {
    return { correlacion: 'sin_correlacion', viaje: null, confianza: 'ninguna', revisar: true,
      motivo: '0 viajes compatibles por ruta+material+fecha (' + oDoc + '->' + dDoc + ', ' + clase + ')', candidatos: [] };
  }
  if (enVentana.length === 1) {
    return { correlacion: 'N2', viaje: enVentana[0], confianza: 'media', revisar: false,
      motivo: 'N2 por ruta+material+fecha (' + oDoc + '->' + dDoc + ')', candidatos: enVentana };
  }

  // Señal de desempate 2: peso ±2% (sobre el kg del documento).
  var kgDoc = n2num(doc && doc.kg_neto);
  if (kgDoc) {
    var porPeso = enVentana.filter(function (v) {
      var kv = n2num(v.kg_documento) !== null ? n2num(v.kg_documento) : n2num(v.cantidad_kg);
      return kv !== null && Math.abs(kv - kgDoc) <= kgDoc * TOL_PESO;
    });
    if (porPeso.length === 1) {
      return { correlacion: 'N2', viaje: porPeso[0], confianza: 'media', revisar: false,
        motivo: 'N2 desempatado por peso (±2%)', candidatos: enVentana };
    }
  }

  // >1 y no se pudo desempatar -> REVISAR listando los candidatos (no adivinar).
  var multiv = N2_CRUCE.esRutaMultiviaje(doc && doc.cliente, doc && doc.origen, doc && doc.destino) ? ' [ruta multiviaje §7: pueden ser rotaciones]' : '';
  var lst = enVentana.map(function (v) { return (v.referencia || v.id || '?') + ' (' + s(v.fecha_carga || v.fecha) + ')'; }).join('; ');
  return { correlacion: 'sin_correlacion', viaje: null, confianza: 'ninguna', revisar: true,
    motivo: enVentana.length + ' candidatos compatibles, no se puede desambiguar: ' + lst + multiv, candidatos: enVentana };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VENTANA_OC_DIAS: VENTANA_OC_DIAS,
    clasificarDocumento: clasificarDocumento,
    dentroVentana: dentroVentana,
    materialCompatible: materialCompatible,
    correlacionarN2: correlacionarN2
  };
}

// ===== CORRELACIONADOR v3.2: dos pasadas + match determinista + guardas + estado_lectura =====
//
// Logica del nodo Code "Formatear Linea Gesruta" del workflow [ESTEVEZ] Ingesta
// Viaje (WD0q9Ic0oDvUoJwp). Extraida aqui para que el repo sea la fuente de verdad
// y no se separe del workflow en silencio (ESTADO-Y-TRASPASO §4).
//
// Cambio v3.1 -> v3.2: NADA de la logica de correlacion ni de las guardas. Lo unico
// que cambia es que las guardas ahora marcan LA FILA, no solo el texto global.
//
//   estado_lectura   'OK' | 'REVISAR'
//   motivo_revision  por que quedo en REVISAR
//   pagina_origen    pagina del PDF de la que salio el viaje (trazabilidad)
//
// El defecto que corrige: en v3.1 las guardas escribian en un blob de texto y la
// fila se persistia igual en la tabla Viajes con estado 'pendiente'. Un viaje con
// el odometro ANULADO por la guarda del multiplo de 500 entraba indistinguible de
// uno bien leido. Mismo principio que el validador: un dato no confiable jamas
// puede parecerse a uno verificado.
//
// El informe de texto y el `datos_json` conservan exactamente el formato de v3.1;
// los campos nuevos son aditivos. El test de regresion compara el informe generado
// por este modulo contra el del fuente original, caracter a caracter.

// --- Estados de lectura ---
var ESTADO_LECTURA = { OK: 'OK', REVISAR: 'REVISAR' };

// Logging estandar del runtime, visible en el log de ejecucion de n8n.
var LOG_ACTIVO = true;
function setLogActivo(v) { LOG_ACTIVO = !!v; }
function logInfo(msg) { if (LOG_ACTIVO) { console.log('[ficha] ' + msg); } }
function logError(msg) { if (LOG_ACTIVO) { console.error('[ficha] ERROR ' + msg); } }

var nz = function (x) { if (x === null || x === undefined) { return null; } if (typeof x === 'string') { const s = x.trim(); return (s === '' || s.toLowerCase() === 'null') ? null : x; } return x; };
// num() devuelve null para 0: el marcador 0 que el modelo copiaba del esquema
// nunca debe entrar como dato (ESTADO §4, error 2).
var num = function (x) { if (typeof x === 'number') { return (isFinite(x) && x !== 0) ? x : null; } if (typeof x === 'string' && x.trim() !== '') { const n = Number(x.replace(/\./g, '').replace(',', '.')); return (isFinite(n) && n !== 0) ? n : null; } return null; };
var mat = function (x) { return (x || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, ''); };
var upp = function (x) { return (x || '').toString().toUpperCase(); };
var dias = function (a, b) { if (!a || !b) { return null; } const da = Date.parse(a + 'T00:00:00Z'); const db = Date.parse(b + 'T00:00:00Z'); if (!isFinite(da) || !isFinite(db)) { return null; } return Math.round((db - da) / 86400000); };

// --- Coincidencia laxa de nombres de empresa/lugar ---------------------------
// Se usa SOLO para inferir el ROL de un documento de peso (carga=origen vs
// descarga=destino) via heuristica emisor<->ficha (CAMBIO 2, §4). Normaliza
// (mayusculas, sin acentos, sin formas societarias) y acepta inclusion o un
// token significativo compartido. Objetivo: robustez, no exactitud milimetrica.
function normNombre(x) {
  return upp(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\b(SA|SL|SLU|SAU|SCA|SC|CB|SLL|SLNE|LDA|SARL)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function coincideNombre(a, b) {
  var na = normNombre(a), nb = normNombre(b);
  if (!na || !nb) { return false; }
  if (na === nb || na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0) { return true; }
  var ta = na.split(' ').filter(function (t) { return t.length >= 4; });
  var sb = {}; nb.split(' ').forEach(function (t) { if (t.length >= 4) { sb[t] = true; } });
  for (var i = 0; i < ta.length; i++) { if (sb[ta[i]]) { return true; } }
  return false;
}
// "Difieren" el peso de carga y el de descarga: tolerancia en kg (bascula/merma).
// Configurable sin reescribir la logica.
var PESO_TOL_DIFIEREN_KG = 100;

// --- Reconciliacion de matricula ficha <-> documento (correlacion robusta) ----
// El documento IMPRESO es la fuente CONFIABLE de la matricula; la ficha
// MANUSCRITA es la SOSPECHOSA. La relacion es ASIMETRICA: cuando los documentos
// del envio convergen en UNA matricula y hay UNA sola ficha a distancia <= umbral,
// se corrige la FICHA (nunca al reves). Parametros configurables (endurecer o
// aflojar sin reescribir la logica):
//   MATRICULA_DIST_MAX  distancia de edicion maxima ficha<->documento del fallback.
//   Convergencia (salvaguarda anti "dos camiones"): TODAS las matriculas de tractor
//   legibles de los documentos deben coincidir en una sola. Si divergen, jamas se
//   correlaciona por cercania.
// NOTA (decidir con datos, NO ahora): la convergencia por UNANIMIDAD es el lado
// seguro para arrancar. Si en operacion real un solo documento con OCR sucio
// rompe la unanimidad seguido, aflojar a "mayoria clara" (que domine una
// matricula) -- se decide con datos, no por diseno anticipado.
var MATRICULA_DIST_MAX = 1;

// Distancia de edicion (Levenshtein). Matriculas cortas, sin optimizacion agresiva.
function distanciaEdicion(a, b) {
  a = a || ''; b = b || '';
  if (a === b) { return 0; }
  var la = a.length, lb = b.length;
  if (la === 0) { return lb; }
  if (lb === 0) { return la; }
  var prev = []; var i, j;
  for (j = 0; j <= lb; j++) { prev[j] = j; }
  for (i = 1; i <= la; i++) {
    var cur = [i];
    var ca = a.charAt(i - 1);
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

/**
 * Reconcilia la matricula de la ficha (manuscrita, sospechosa) contra la de los
 * documentos (impresos, confiables) ANTES del match documento->viaje. Muta los
 * viajes IN PLACE. Asimetrica (el documento manda) y con salvaguarda de
 * convergencia (no adivina si los documentos no coinciden entre si).
 *
 * Cascada:
 *   - Si algun documento no matchea exacto ninguna ficha Y los documentos
 *     convergen en UNA matricula que esta a distancia <= MATRICULA_DIST_MAX de
 *     EXACTAMENTE UNA ficha: se corrige esa ficha (tractora/tractoraN <- matricula
 *     del documento), se guarda la lectura original en tractora_original /
 *     tractoraN_original (auditoria; viaja en `detalle`) y se marca REVISAR. Luego
 *     el match exacto de mas abajo los correlaciona solo.
 *   - Si los documentos NO convergen, o el candidato no es unico, o la distancia
 *     es > umbral: NO se toca nada, pero se agrega un motivo_revision que EXPLICA
 *     por que no se correlaciono (no un PENDIENTE_DOC mudo).
 *
 * @param {Array} viajes   viajes de las fichas (se mutan).
 * @param {Array} docsRaw  documentos del envio (impresos).
 * @param {function} marcar  marcar(v, motivo) para acumular motivos de REVISAR.
 */
function reconciliarMatriculaFicha(viajes, docsRaw, marcar) {
  if (!viajes.length || !docsRaw.length) { return; }

  // Matriculas de tractor legibles de los documentos (sin duplicados de pagina).
  var docMats = [];
  var remolqueDocs = {};
  for (var di = 0; di < docsRaw.length; di++) {
    var d = docsRaw[di];
    if (d.duplicado_de) { continue; }
    var dm = mat(d.matricula_tractor);
    if (dm) { docMats.push(dm); }
    var rm = mat(d.matricula_remolque);
    if (rm) { remolqueDocs[rm] = true; }
  }
  if (docMats.length === 0) { return; } // ningun documento con matricula legible

  // Fichas del envio agrupadas por matricula normalizada.
  var fichas = {};
  for (var vi = 0; vi < viajes.length; vi++) {
    var v = viajes[vi];
    if (!v.tractoraN) { continue; }
    if (!fichas[v.tractoraN]) { fichas[v.tractoraN] = []; }
    fichas[v.tractoraN].push(v);
  }
  var fichaMats = Object.keys(fichas);
  if (fichaMats.length === 0) { return; }

  // ¿Algun documento NO matchea exacto ninguna ficha? Solo entonces hay algo que
  // reconciliar; si todos matchean exacto es el camino feliz y no se toca.
  var hayHuerfano = false;
  for (var hi = 0; hi < docMats.length; hi++) { if (fichaMats.indexOf(docMats[hi]) === -1) { hayHuerfano = true; break; } }
  if (!hayHuerfano) { return; }

  var marcarFicha = function (fm, motivo) { var a = fichas[fm]; for (var k = 0; k < a.length; k++) { marcar(a[k], motivo); } };

  // Convergencia: ¿los documentos legibles coinciden todos en UNA matricula?
  var distintas = {};
  for (var ci = 0; ci < docMats.length; ci++) { distintas[docMats[ci]] = true; }
  var convergen = Object.keys(distintas);

  if (convergen.length > 1) {
    // SALVAGUARDA DURA: los documentos NO convergen -> posible envio de dos
    // camiones (matriculas de lote consecutivas). Nunca correlacionar por cercania.
    var lista = convergen.join(' vs ');
    for (var fi = 0; fi < fichaMats.length; fi++) {
      var fm = fichaMats[fi];
      for (var cj = 0; cj < convergen.length; cj++) {
        if (fm !== convergen[cj] && distanciaEdicion(fm, convergen[cj]) <= MATRICULA_DIST_MAX) {
          marcarFicha(fm, 'documentos del envio no coinciden entre si en la matricula (' + lista + ') — posible envio de dos camiones, revisar manualmente');
          break;
        }
      }
    }
    return;
  }

  // Convergen en UNA matricula que no matchea exacto ninguna ficha.
  var dmConv = convergen[0];
  var candidatas = [];
  for (var fj = 0; fj < fichaMats.length; fj++) {
    if (distanciaEdicion(fichaMats[fj], dmConv) <= MATRICULA_DIST_MAX) { candidatas.push(fichaMats[fj]); }
  }

  if (candidatas.length === 0) {
    // Distancia > umbral: no se puede afirmar que sea el mismo camion.
    for (var fk = 0; fk < fichaMats.length; fk++) {
      marcarFicha(fichaMats[fk], 'documentos con matricula ' + dmConv + ' no correlacionados: la ficha dice ' + fichaMats[fk] + ' (distancia > ' + MATRICULA_DIST_MAX + '), no se puede afirmar que sea el mismo camion');
    }
    return;
  }
  if (candidatas.length > 1) {
    // Candidato NO unico: dmConv a distancia <= umbral de dos o mas fichas (par
    // peligroso de matriculas de lote). Ambiguo: no adivinar.
    for (var fl = 0; fl < candidatas.length; fl++) {
      marcarFicha(candidatas[fl], 'documentos con matricula ' + dmConv + ' no correlacionados: ' + candidatas.length + ' fichas candidatas a distancia ' + MATRICULA_DIST_MAX + ' (' + candidatas.join(', ') + ') — revisar cual camion es');
    }
    return;
  }

  // ---- Candidato UNICO a distancia <= umbral: corregir la ficha (documento manda) ----
  var fmUnica = candidatas[0];
  var arr = fichas[fmUnica];
  // Refuerzo por remolque (senal secundaria, NO puerta): si el remolque de la ficha
  // tambien difiere del de los documentos, refuerza que la ficha se leyo mal. Si el
  // remolque coincide exacto pero la tractora no, se corrige igual (convergencia +
  // candidato unico mandan) pero se deja constancia para mirarlo con mas atencion.
  var remolqueFichaN = arr[0].remolque ? mat(arr[0].remolque) : '';
  var remolqueCoincide = remolqueFichaN && remolqueDocs[remolqueFichaN];
  var nota = remolqueCoincide ? ' (el remolque si coincide, verificar con atencion)' : '';
  for (var ai = 0; ai < arr.length; ai++) {
    var vv = arr[ai];
    vv.tractora_original = vv.tractora;
    vv.tractoraN_original = vv.tractoraN;
    vv.tractora = dmConv;
    vv.tractoraN = dmConv;
    marcar(vv, 'matricula ficha ' + (vv.tractora_original || fmUnica) + ' corregida a ' + dmConv + ' segun ' + docMats.length + ' documento(s) coincidente(s) — verificar que sea el mismo camion' + nota);
  }
}

// --- Reglas del modelo albaran=unidad (Fase 2, ficha/cruce.js) ---------------
// En n8n el build (build-nodo.js) concatena cruce.js ANTES que este archivo, asi
// que sus funciones quedan globales; en node/test se requieren. `typeof X ===
// 'function'` sobre un identificador no declarado devuelve 'undefined' sin lanzar,
// asi que el ternario elige la fuente correcta en cada entorno.
var CRUCE = (typeof clasificarCantidad === 'function')
  ? { clasificarCantidad: clasificarCantidad, regimenIndexacion: regimenIndexacion, repartirKm: repartirKm, esRutaMultiviaje: esRutaMultiviaje, RUTAS_MULTIVIAJE: RUTAS_MULTIVIAJE, CLIENTES_CONOCIDOS: CLIENTES_CONOCIDOS }
  : require('./cruce.js');

// Correlacion documento<->viaje NIVEL 2 (modelo-dominio-lectura.md §5.2). En el
// nodo, build-nodo.js inlinea correlacion/correlacionar-n2.js (y catalogo/
// resolver-punto.js, del que depende) ANTES de este archivo, asi que
// correlacionarN2 queda global; en node/test se requiere. Ver el uso GATED en el
// match documento->viaje: solo actua si el grafo cablea el pool de viajes
// existentes + el catalogo de puntos; sin eso, el comportamiento es identico.
var CN2 = (typeof correlacionarN2 === 'function')
  ? { correlacionarN2: correlacionarN2 }
  : require('../correlacion/correlacionar-n2.js');

// Fuente legible de un dato para el audit trail (§4): que papel/pagina lo aporto.
var fuenteDoc = function (d) { return d ? ('documento:' + (nz(d.tipo_doc) || 'doc') + ':pag' + (d.pagina || '?')) : null; };

/**
 * Correlaciona la pasada de fichas (rA) con la de documentos (rB).
 *
 * @param {object|null} rA JSON de la pasada de fichas   ({hojas:[...]}).
 * @param {object|null} rB JSON de la pasada de documentos ({documentos:[...]}).
 * @param {object} [opts] {rutas, clientes} listas configurables (default cruce.js).
 * @returns {{ok:boolean, hojas:Array, viajes:Array, documentos:Array,
 *            errores:Array, avisos:Array}}
 */
function correlacionar(rA, rB, opts) {
  const rutas = (opts && opts.rutas) ? opts.rutas : CRUCE.RUTAS_MULTIVIAJE;
  const clientes = (opts && opts.clientes) ? opts.clientes : CRUCE.CLIENTES_CONOCIDOS;
  // --- N2 doc<->viaje (§5.2): pool de viajes YA cargados en Gesruta + catalogo de
  // puntos canonicos. GATED: si el grafo no los cablea, viajesExistentes=[] y
  // catalogoPuntos=null y el nodo se comporta EXACTAMENTE como antes (los
  // documentos sin ficha en el envio quedan huerfanos, igual que hoy). N2 nunca
  // usa la matricula ni la ficha: correlaciona por el punto canonico del documento
  // impreso (que coincide 100% con Gesruta) + material + peso + ventana temporal.
  const viajesExistentes = (opts && Array.isArray(opts.viajesExistentes)) ? opts.viajesExistentes : [];
  const catalogoPuntos = (opts && opts.catalogoPuntos) ? opts.catalogoPuntos : null;
  const correlacionesExternas = [];
  if (!rA) {
    logError('la pasada de FICHAS no devolvio JSON valido');
    return { ok: false, hojas: [], viajes: [], documentos: [], errores: [], avisos: [] };
  }
  const hojasRaw = Array.isArray(rA.hojas) ? rA.hojas : [];
  const docsRaw = (rB && Array.isArray(rB.documentos)) ? rB.documentos : [];

  const errores = []; const avisos = [];
  const ANIO_HOY = new Date().getFullYear();

  // Marca la fila i para revision humana y registra el motivo, ademas de dejar
  // el mensaje en la lista global (que es lo que ya lee la oficina).
  const marcar = function (v, motivo) { v.motivos_revision.push(motivo); };

  // ---- Viajes desde las fichas ----
  // `let` (no const): la expansion multi-viaje (Fase 2) reasigna el array.
  let viajes = [];
  for (let h = 0; h < hojasRaw.length; h++) {
    const H = hojasRaw[h];
    const bloques = Array.isArray(H.bloques) ? H.bloques : [];
    for (let i = 0; i < bloques.length; i++) {
      const b = bloques[i];
      // Modelo albaran=unidad (§1): `cantidad` de la ficha puede ser kg o numero
      // de viajes. Discriminacion determinista (cruce.js), con lo que DECLARA la
      // ficha (nombre y lugares del bloque): ruta registrada -> viajes; valor <100
      // en ruta no registrada -> REVISAR (red de seguridad); si no -> kg.
      const clz = CRUCE.clasificarCantidad(num(b.cantidad_kg), nz(b.nombre_carga), nz(b.lugar_carga), nz(b.lugar_descarga), rutas);
      viajes.push({
        hoja_idx: h, orden: num(b.orden) || (i + 1),
        conductor: nz(H.conductor), tractora: nz(H.tractora), remolque: nz(H.remolque), empresa: nz(H.empresa),
        tractoraN: mat(H.tractora),
        pagina_origen: (typeof H.pagina === 'number' && isFinite(H.pagina)) ? H.pagina : null,
        fecha_carga: nz(b.fecha_carga), fecha_carga_texto: nz(b.fecha_carga_texto), fecha_descarga: nz(b.fecha_descarga),
        nombre_carga: nz(b.nombre_carga), lugar_carga: nz(b.lugar_carga),
        nombre_descarga: nz(b.nombre_descarga), lugar_descarga: nz(b.lugar_descarga),
        tipo_mercancia: nz(b.tipo_mercancia),
        // En modo kg, `cantidad_kg` = lo leido (identico a v3.2). En viajes/REVISAR
        // NO es un peso, asi que queda null: nunca se factura un "6 kg" espurio.
        cantidad_kg: (clz.modo === 'kg') ? clz.kg : null,
        cantidad_declarada: num(b.cantidad_kg),
        modo_cantidad: clz.modo,
        es_multiviaje: (clz.modo === 'viajes'),
        n_viajes_declarado: clz.n_viajes,
        km_inicio: num(b.km_inicio), km_final: num(b.km_final), km_recorridos: num(b.km_recorridos),
        origen_km: 'leido',
        regimen_indexacion: null,
        estado: null, pendiente_falta: null, pendiente_reclamar_a: null,
        origen_campos: {},
        motivos_revision: [],
        docs: [],
        // Documentos que matchean la matricula pero NO se pudieron atar a ESTA
        // pata del dia (mismo camion, varios viajes): quedan aparte, no definen
        // la carga del viaje. Ver el match documento->viaje mas abajo.
        docs_ambiguos: []
      });
      // Red de seguridad §1: valor demasiado chico para ser kg en una ruta que no
      // esta registrada como multiviaje -> a REVISAR, visible en el tablero, en vez
      // de meter "N kg" en silencio. Cuando se confirme la ruta se agrega a la lista.
      if (clz.motivo === 'posible_multiviaje_ruta_no_registrada') {
        const vLast = viajes[viajes.length - 1];
        marcar(vLast, 'posible_multiviaje_ruta_no_registrada: cantidad ' + num(b.cantidad_kg) + ' < 100; ni kg valido ni ruta multiviaje registrada');
        errores.push('Viaje ' + viajes.length + ': cantidad ' + num(b.cantidad_kg) + ' demasiado baja para kg y ruta (' + (nz(b.nombre_carga) || '?') + ' ' + (nz(b.lugar_carga) || '?') + '->' + (nz(b.lugar_descarga) || '?') + ') no registrada en RUTAS_MULTIVIAJE. REVISAR (posible_multiviaje_ruta_no_registrada).');
      }
    }
  }
  if (viajes.length === 0) { errores.push('No se detecto ninguna ficha de chofer con bloques rellenos.'); }

  // ---- GUARDA A: ano fuera de rango (mala lectura del ano en el manuscrito) ----
  // Se aplica ANTES del match porque la fecha se usa para desempatar documentos.
  for (let i = 0; i < viajes.length; i++) {
    const v = viajes[i];
    if (!v.fecha_carga) { continue; }
    const y = Number(String(v.fecha_carga).slice(0, 4));
    if (isFinite(y) && (y < ANIO_HOY - 1 || y > ANIO_HOY + 1)) {
      errores.push('Viaje ' + (i + 1) + ': fecha ' + v.fecha_carga + ' (ano ' + y + ') fuera del rango razonable. Ano mal leido; se anula la fecha. En la ficha dice: "' + (v.fecha_carga_texto || 'ilegible') + '".');
      marcar(v, 'ano ' + y + ' fuera de rango; fecha anulada');
      v.fecha_carga = null;
      v.fecha_descarga = null;
    }
  }

  // ---- Reconciliacion de matricula de ficha mal leida (asimetrica + convergencia) ----
  // Corrige la matricula de la ficha ANTES del match cuando los documentos impresos
  // convergen en una matricula a distancia <= MATRICULA_DIST_MAX de una UNICA ficha
  // (el documento manda sobre la ficha manuscrita). Los casos inseguros (no
  // convergen / candidato no unico / distancia mayor) quedan sin correlacionar, con
  // motivo_revision explicito. Ver reconciliarMatriculaFicha.
  reconciliarMatriculaFicha(viajes, docsRaw, marcar);

  // ---- Match documento -> viaje (N docs : 1 viaje) ----
  const docsHuerfanos = [];

  // Fallback N2 (§5.2): correlaciona UN documento sin ficha en el envio contra el
  // pool de viajes ya cargados en Gesruta. GATED por viajesExistentes+catalogoPuntos
  // (sin cablear -> devuelve false, el documento sigue su camino de huerfano de
  // antes: cambio ADITIVO puro). Devuelve true cuando ya trato al documento (lo
  // correlaciono, o lo dejo anotado como candidato ambiguo para revision humana).
  const intentarN2 = function (d, et) {
    if (!viajesExistentes.length || !catalogoPuntos) { return false; }
    const docN2 = {
      referencia: d.referencia, origen: d.origen, destino: d.destino,
      material: d.material, fecha: nz(d.fecha), kg_neto: d.kg_neto,
      cliente: nz(d.cliente_probable) || nz(d.emisor) || null, tipo_doc: d.tipo_doc,
    };
    const r = CN2.correlacionarN2(docN2, viajesExistentes, catalogoPuntos, opts);
    if ((r.correlacion === 'N1' || r.correlacion === 'N2') && !r.revisar && r.viaje) {
      correlacionesExternas.push({ documento: d, viaje: r.viaje, correlacion: r.correlacion, confianza: r.confianza, revisar: false, motivo: r.motivo });
      avisos.push('Documento ' + et + ' correlacionado ' + r.correlacion + ' con viaje ya cargado (' + (nz(r.viaje.referencia) || r.viaje.id || '?') + '): ' + r.motivo + '.');
      return true;
    }
    if (r.revisar && r.candidatos && r.candidatos.length) {
      correlacionesExternas.push({ documento: d, viaje: null, correlacion: 'sin_correlacion', confianza: 'ninguna', revisar: true, motivo: r.motivo });
      docsHuerfanos.push({ d: d, motivo: 'sin ficha en el envio; N2 hallo ' + r.candidatos.length + ' viaje(s) candidato(s) pero no desambiguo — revisar: ' + r.motivo });
      return true;
    }
    return false; // N2 no aplica (documento sin origen/destino resoluble, o 0 candidatos)
  };

  for (const d of docsRaw) {
    if (d.duplicado_de) { continue; }
    const dm = mat(d.matricula_tractor);
    const df = nz(d.fecha);
    const et = 'pag ' + (d.pagina || '?') + ' ' + (nz(d.referencia) || 'sin ref');
    // N2 (§5.2) — fallback cuando el documento NO ata a ninguna ficha de ESTE
    // envio (sin matricula legible, o matricula que no corresponde a ninguna
    // ficha). Antes de declararlo huerfano se intenta correlacionarlo contra el
    // pool de viajes ya cargados en Gesruta, por referencia (N1) o
    // ruta+material+peso+fecha (N2). GATED: solo si el grafo cablea el pool. El
    // documento aporta el punto CANONICO (coincide con Gesruta); no se toca la
    // ficha ni la matricula. Ver intentarN2() abajo.
    if (!dm) {
      if (intentarN2(d, et)) { continue; }
      docsHuerfanos.push({ d: d, motivo: 'sin matricula de tractor legible' }); continue;
    }
    let cands = viajes.filter(function (v) { return v.tractoraN && v.tractoraN === dm; });
    if (cands.length === 0) {
      if (intentarN2(d, et)) { continue; }
      docsHuerfanos.push({ d: d, motivo: 'matricula ' + d.matricula_tractor + ' no corresponde a ninguna ficha de este envio' }); continue;
    }
    if (cands.length > 1 && df) {
      const enVentana = cands.filter(function (v) {
        const ini = v.fecha_carga; const fin = v.fecha_descarga || v.fecha_carga;
        if (!ini && !fin) { return true; }
        const antes = ini ? dias(ini, df) : 1;
        const despues = fin ? dias(df, fin) : 1;
        return antes >= -1 && despues >= -1;
      });
      if (enVentana.length > 0) { cands = enVentana; }
    }
    if (cands.length > 1) {
      const dk = num(d.kg_neto);
      if (dk) {
        let best = null; let bd = null;
        for (const v of cands) { if (v.cantidad_kg) { const diff = Math.abs(v.cantidad_kg - dk); if (bd === null || diff < bd) { bd = diff; best = v; } } }
        if (best && bd !== null && bd <= 1500) { cands = [best]; }
      }
    }
    if (cands.length > 1) {
      // No se pudo desambiguar (mismo camion, varias patas el mismo dia; ni la
      // fecha ni el kg separan). NO se le presta la carga a ningun viaje: un
      // documento de la pata B no puede definir material/origen/destino de la
      // pata A (fue el bug real -- un CMR de acido sulfurico contaminaba una
      // pata de sosa). Queda adjunto APARTE, para traza y para que un humano lo
      // asigne; el viaje conserva lo que dice su ficha y, si no tiene doc propio,
      // queda PENDIENTE_DOCUMENTACION (honesto), no facturado con datos de otro.
      d.ambiguo = true;
      cands.sort(function (a, b) { return a.docs.length - b.docs.length; });
      cands[0].docs_ambiguos.push(d);
      avisos.push('Documento ' + et + ' matchea ' + cands.length + ' viajes de ' + d.matricula_tractor + ' y no se pudo desambiguar (fecha/kg). NO se le asigna la carga a ningun viaje; queda adjunto al bloque ' + cands[0].orden + ' para revision humana.');
      continue;
    }
    cands[0].docs.push(d);
  }

  // ---- Consolidacion por viaje ----
  for (let i = 0; i < viajes.length; i++) {
    const v = viajes[i];
    const pick = function (tipos, campo) {
      for (const t of tipos) { for (const d of v.docs) { if ((d.tipo_doc || '') === t && nz(d[campo]) !== null) { return d; } } }
      for (const d of v.docs) { if (nz(d[campo]) !== null) { return d; } }
      return null;
    };
    // ---- CAMBIO 3: cliente facturable = EMISOR de la orden/documento de transporte ----
    // NUNCA el lugar de carga (nombre_carga de la ficha). El `emisor` del documento
    // de transporte (orden primero, luego CMR/albaran) identifica al cliente
    // facturable; cliente_probable (guess del modelo) queda de respaldo. Si no hay
    // emisor ni cliente_probable, `cliente` queda null -> REVISAR (fail-loud), sin
    // inventar cliente desde el lugar de carga.
    const TIPOS_EMISOR_CLIENTE = ['orden_transporte', 'orden_carga', 'cmr', 'albaran', 'carta_porte', 'guia'];
    let clienteEmisor = null;
    for (const t of TIPOS_EMISOR_CLIENTE) {
      for (const d of v.docs) { if ((d.tipo_doc || '') === t && nz(d.emisor)) { clienteEmisor = upp(nz(d.emisor)); break; } }
      if (clienteEmisor) { break; }
    }
    const votos = {};
    for (const d of v.docs) { const c = nz(d.cliente_probable); if (c) { votos[upp(c)] = (votos[upp(c)] || 0) + 1; } }
    let clienteProbable = null; let mx = 0;
    for (const k of Object.keys(votos)) { if (votos[k] > mx) { mx = votos[k]; clienteProbable = k; } }
    const cliente = clienteEmisor || clienteProbable || null;
    v.cliente = cliente;
    const clienteFuente = clienteEmisor ? 'documento:emisor' : (clienteProbable ? 'documento:cliente_probable' : null);
    const esForesa = cliente ? (cliente.indexOf('FORESA') >= 0 || cliente.indexOf('BRESFOR') >= 0) : false;
    const dRef = pick(esForesa ? ['albaran', 'cmr'] : ['orden_transporte', 'orden_carga', 'guia', 'cmr', 'carta_porte', 'albaran'], 'referencia');
    v.referencia = dRef ? nz(dRef.referencia) : null;
    v.tipo_doc = dRef ? nz(dRef.tipo_doc) : null;
    v.fecha_documento = dRef ? nz(dRef.fecha) : null;
    // ---- CAMBIO 2 (§4, D-01): peso facturable — precedencia ORIGEN > DESTINO ----
    // Dos reglas encadenadas:
    //  (a) El kg SIEMPRE sale del DOCUMENTO de peso, NUNCA de la orden (la orden es
    //      planificacion: kg pedido/nominal, no real). Se EXCLUYE la orden.
    //  (b) Refinamiento §4: cuando hay peso de carga (ORIGEN) y de descarga (DESTINO)
    //      y DIFIEREN, manda el de ORIGEN (CMR/albaran de carga). Precedencia:
    //      origen > descarga > (nunca) orden.
    // La FICHA aporta SOLO EL ROL del documento (¿carga o descarga?), NUNCA el kg:
    // el kg sale del documento. El rol se infiere por heuristica emisor<->ficha
    // (el emisor del doc de peso se compara con nombre_carga=cargador y
    // nombre_descarga=receptor de la ficha):
    //      emisor ~ carga   (y no descarga) -> ORIGEN
    //      emisor ~ descarga (y no carga)   -> DESTINO
    //      ambos / ninguno                  -> INCIERTO
    // Salvaguarda dura (P2): NO se factura el peso de un documento de rol incierto
    // cuando eso obligaria a ADIVINAR entre pesos que difieren -> REVISAR. Si hay un
    // solo peso (o todos coinciden) no hay nada que adivinar: se factura (no se
    // pierde el viaje por un rol que no cambia el importe).
    const esOrden = function (d) { return d && (d.tipo_doc === 'orden_transporte' || d.tipo_doc === 'orden_carga'); };
    const pesos = v.docs.filter(function (d) { return !esOrden(d) && num(d.kg_neto) !== null; });
    const rolPeso = function (d) {
      const em = nz(d.emisor);
      const enCarga = !!(em && coincideNombre(em, v.nombre_carga));
      const enDescarga = !!(em && coincideNombre(em, v.nombre_descarga));
      if (enCarga && !enDescarga) { return 'origen'; }
      if (enDescarga && !enCarga) { return 'destino'; }
      return 'incierto';
    };
    const tiposPref = esForesa ? ['albaran', 'cmr', 'bascula'] : ['cmr', 'carta_porte', 'guia', 'bascula', 'albaran'];
    const elegirPorTipo = function (lista) {
      for (const t of tiposPref) { for (const d of lista) { if ((d.tipo_doc || '') === t) { return d; } } }
      return lista.length ? lista[0] : null;
    };
    const porRol = { origen: [], destino: [], incierto: [] };
    for (const d of pesos) { porRol[rolPeso(d)].push(d); }
    let dKg = null;
    if (porRol.origen.length) {
      dKg = elegirPorTipo(porRol.origen); // §4: el peso de carga manda
      const dDest = elegirPorTipo(porRol.destino);
      if (dDest && Math.abs(num(dDest.kg_neto) - num(dKg.kg_neto)) > PESO_TOL_DIFIEREN_KG) {
        avisos.push('Viaje ' + (i + 1) + ': peso origen ' + num(dKg.kg_neto) + ' kg manda sobre descarga ' + num(dDest.kg_neto) + ' kg (difieren) — §4.');
      }
    } else if (porRol.destino.length) {
      dKg = elegirPorTipo(porRol.destino); // sin origen: la descarga es la mejor fuente disponible
    } else if (porRol.incierto.length) {
      const kgs = porRol.incierto.map(function (d) { return num(d.kg_neto); });
      const spread = Math.max.apply(null, kgs) - Math.min.apply(null, kgs);
      if (porRol.incierto.length > 1 && spread > PESO_TOL_DIFIEREN_KG) {
        // Varios pesos de rol indeterminado que difieren: adivinar cual es el de
        // carga seria facturar a ciegas. No se factura -> el humano decide (§4, P2).
        marcar(v, 'pesos de documentos con rol indeterminado que difieren (' + kgs.join('/') + ' kg): no se factura sin saber cual es el de carga (§4)');
      } else {
        dKg = elegirPorTipo(porRol.incierto); // uno solo, o todos coinciden: sin ambiguedad
      }
    }
    v.kg_documento = dKg ? num(dKg.kg_neto) : null;
    v.fuente_peso = dKg ? nz(dKg.tipo_doc) : null;
    // D-01 fail-loud: si el UNICO kg disponible venia de una orden, no se factura;
    // falta documento de peso -> REVISAR (nunca fallback al kg de la orden).
    if (v.kg_documento === null && v.docs.some(function (d) { return esOrden(d) && num(d.kg_neto) !== null; })) {
      marcar(v, 'solo la orden trae kg; falta documento de peso (albaran/bascula) — no se factura el kg de la orden');
    }
    const dOD = pick(['cmr', 'carta_porte', 'albaran', 'orden_transporte', 'guia'], 'destino');
    v.origen = (dOD && nz(dOD.origen)) ? nz(dOD.origen) : v.lugar_carga;
    v.destino = (dOD && nz(dOD.destino)) ? nz(dOD.destino) : v.lugar_descarga;
    const dMt = pick(['cmr', 'carta_porte', 'albaran', 'guia', 'orden_transporte'], 'material');
    v.material = (dMt && nz(dMt.material)) ? nz(dMt.material) : v.tipo_mercancia;
    const dIm = pick(['orden_carga', 'orden_transporte'], 'importe');
    v.importe_documento = dIm ? num(dIm.importe) : null;
    const dTa = pick(['orden_carga', 'orden_transporte'], 'tarifa_tn');
    v.tarifa_tn_documento = dTa ? num(dTa.tarifa_tn) : null;
    // KM: el calculo lo hace SIEMPRE el sistema; km_recorridos, si existe, es verificacion.
    v.km_cargados = (v.km_inicio !== null && v.km_final !== null) ? (v.km_final - v.km_inicio) : null;
    if (v.km_cargados !== null && v.km_cargados <= 0) {
      errores.push('Viaje ' + (i + 1) + ': km cargados no positivos (' + v.km_inicio + ' -> ' + v.km_final + ').');
      marcar(v, 'km cargados no positivos (' + v.km_inicio + ' -> ' + v.km_final + ')');
      v.km_cargados = null;
    }
    // GUARDA B: multiplo exacto de 500. Un odometro real casi nunca lo es.
    // Cubre las hojas de un solo viaje, donde la guarda de uniformidad no puede disparar.
    if (v.km_cargados !== null && v.km_cargados % 500 === 0) {
      errores.push('Viaje ' + (i + 1) + ': km cargados ' + v.km_cargados + ' es multiplo exacto de 500. Los odometros reales casi nunca lo son; probable invencion. Se anulan.');
      marcar(v, 'km cargados ' + v.km_cargados + ' multiplo exacto de 500; odometros anulados por probable invencion');
      v.km_cargados = null; v.km_inicio = null; v.km_final = null; v.km_recorridos = null;
    }
    if (v.km_recorridos !== null && v.km_cargados !== null && Math.abs(v.km_recorridos - v.km_cargados) > 5) {
      errores.push('Viaje ' + (i + 1) + ': la ficha escribe ' + v.km_recorridos + ' km recorridos pero final-inicio da ' + v.km_cargados + '. Odometro mal leido.');
      marcar(v, 'la ficha escribe ' + v.km_recorridos + ' km recorridos pero final-inicio da ' + v.km_cargados + '; odometro mal leido');
    }
    v.km_vacios = null;
    if (i > 0 && viajes[i - 1].hoja_idx === v.hoja_idx) {
      const prev = viajes[i - 1].km_final;
      if (prev !== null && v.km_inicio !== null) {
        v.km_vacios = v.km_inicio - prev;
        if (v.km_vacios < 0) {
          avisos.push('Viaje ' + (i + 1) + ': km vacios negativos, falta un viaje intermedio.');
          marcar(v, 'km vacios negativos; falta un viaje intermedio');
        }
      }
    }
    if (v.docs.length === 0) { errores.push('Viaje ' + (i + 1) + ' (' + (v.nombre_carga || 'sin cliente') + ', ' + (v.fecha_carga_texto || v.fecha_carga || 'sin fecha') + '): SIN DOCUMENTACION. No facturable.'); }
    if (!v.fecha_carga) {
      avisos.push('Viaje ' + (i + 1) + ': sin fecha utilizable (en la ficha: "' + (v.fecha_carga_texto || 'ilegible') + '").');
      marcar(v, 'sin fecha utilizable (en la ficha: "' + (v.fecha_carga_texto || 'ilegible') + '")');
    }
    if (v.cantidad_kg !== null && v.kg_documento !== null && Math.abs(v.cantidad_kg - v.kg_documento) > 200) {
      avisos.push('Viaje ' + (i + 1) + ': ficha ' + v.cantidad_kg + ' kg vs documento ' + v.kg_documento + ' kg. Prevalece el documento.');
      marcar(v, 'ficha ' + v.cantidad_kg + ' kg vs documento ' + v.kg_documento + ' kg');
    }
    // --- Fase 2: regimen de indexacion, estado de documentacion y audit ---
    // Regimen (D-03/D-06): SOLO se marca; el calculo se cierra en facturacion (F4).
    // Cierre v1 pieza 1: cliente fuera de CLIENTES_CONOCIDOS (o no leido) NO recibe
    // regimen por defecto -- eso fue el bug real (FORBA, misread de FORESA, se
    // llevo 'linea' en silencio en vez de 'agregada_quincenal'). Ahora falla
    // ruidoso: regimen_indexacion queda null y el viaje va a REVISAR con el valor
    // leido en el motivo, visible sin abrir el escaneo. NO es un alias de FORBA.
    const ridx = CRUCE.regimenIndexacion(v.cliente, v.origen, v.destino, clientes);
    v.regimen_indexacion = ridx.regimen;
    // Fail-loud del cliente: si vino de un emisor pero no se resolvio a un cliente
    // conocido, decirlo con el emisor a la vista (CAMBIO 3), asi el operador sabe
    // que es. Si no habia emisor, se conserva el motivo generico (no leido).
    // Guard: un viaje SIN documento no marca cliente_no_reconocido -- su cliente no
    // se puede resolver sin doc, y eso ya lo cubre el eje PENDIENTE_DOCUMENTACION
    // (no es un problema de LECTURA). Solo se exige cliente cuando hay documento.
    if (ridx.motivo && v.docs.length > 0) { marcar(v, clienteEmisor ? ('emisor ' + clienteEmisor + ' no resuelto a cliente conocido') : ridx.motivo); }
    // Estado de documentacion (§3): un unico estado para lo incompleto, con QUE
    // falta y a QUIEN reclamar. Es un eje distinto del de LECTURA (estado_lectura).
    if (v.docs.length === 0) {
      v.estado = 'PENDIENTE_DOCUMENTACION';
      v.pendiente_falta = 'documentos del viaje (albaran/CMR/carta de porte)';
      v.pendiente_reclamar_a = 'chofer / cliente cargador';
    } else {
      v.estado = 'con_documentacion';
    }
    // Audit trail (§4): de que papel/pagina salio cada campo. kg y referencia
    // vienen del documento (D-01); km, de la ficha; el resto, del que gano el pick.
    v.origen_campos = {
      cliente: clienteFuente,
      referencia: v.referencia ? fuenteDoc(dRef) : null,
      kg_documento: (v.kg_documento !== null) ? fuenteDoc(dKg) : null,
      origen: (dOD && nz(dOD.origen)) ? fuenteDoc(dOD) : (v.lugar_carga ? 'ficha:lugar_carga' : null),
      destino: (dOD && nz(dOD.destino)) ? fuenteDoc(dOD) : (v.lugar_descarga ? 'ficha:lugar_descarga' : null),
      material: (dMt && nz(dMt.material)) ? fuenteDoc(dMt) : (v.tipo_mercancia ? 'ficha:tipo_mercancia' : null),
      km: (v.km_cargados !== null) ? ('ficha:odometro:' + v.origen_km) : null,
      cantidad_ficha: (v.cantidad_kg !== null) ? 'ficha:cantidad' : null
    };
  }

  // ---- GUARDA C: odometros uniformes dentro de una hoja ----
  for (let h = 0; h < hojasRaw.length; h++) {
    const vs = viajes.filter(function (v) { return v.hoja_idx === h; });
    const kms = vs.map(function (v) { return v.km_cargados; }).filter(function (x) { return x !== null; });
    if (kms.length >= 2) {
      let iguales = true;
      for (const k of kms) { if (k !== kms[0]) { iguales = false; } }
      if (iguales) {
        errores.push('Hoja ' + (h + 1) + ': los ' + kms.length + ' viajes dan exactamente ' + kms[0] + ' km. Odometros probablemente inventados; se anulan.');
        for (const v of vs) {
          marcar(v, 'los ' + kms.length + ' viajes de la hoja dan exactamente ' + kms[0] + ' km; odometros anulados por probable invencion');
          v.km_cargados = null; v.km_inicio = null; v.km_final = null; v.km_recorridos = null;
        }
      }
    }
    const pares = vs.filter(function (v) { return v.cantidad_kg !== null && v.kg_documento !== null; });
    if (pares.length >= 2) {
      let todosIguales = true;
      for (const v of pares) { if (v.cantidad_kg !== v.kg_documento) { todosIguales = false; } }
      if (todosIguales) { avisos.push('Hoja ' + (h + 1) + ': el peso de la ficha coincide EXACTAMENTE con el del documento en todos los viajes. Verificar que no sea copia.'); }
    }
  }
  for (const o of docsHuerfanos) { errores.push('Documento pag ' + (o.d.pagina || '?') + ' (' + (nz(o.d.referencia) || 'sin ref') + ', ' + (nz(o.d.matricula_tractor) || 'sin matricula') + '): ' + o.motivo + '.'); }

  // ---- Fase 2: expansion multi-viaje (bloque = N viajes) ----
  // Un bloque de ruta multiviaje declara N viajes (campo cantidad). Cada viaje
  // real trae SU propio albaran (kg propio, D-01). Se generan N filas: las que
  // tienen albaran quedan consolidadas con su kg; las que faltan quedan
  // PENDIENTE_DOCUMENTACION, VISIBLES para reclamar (§3). Los km del bloque (la
  // jornada completa) se reparten entre los N y se marcan `derivado_de_bloque`.
  // Si el odometro del bloque quedo dudoso, los N heredan REVISAR: no se reparte
  // un numero dudoso y salen N confiables.
  // Estructura confirmada contra dato real (v1.1, exportacion sistema de
  // escritorio, expediente 00050461). Falta cerrar el riesgo de LECTURA: ver
  // ficha/cruce.js y docs/fase2-cierre-y-fase3-bloqueantes.md.
  if (viajes.some(function (v) { return v.es_multiviaje; })) {
    const expandidos = [];
    for (let i = 0; i < viajes.length; i++) {
      const v = viajes[i];
      if (!v.es_multiviaje) { expandidos.push(v); continue; }
      const N = v.n_viajes_declarado;
      const albaranes = v.docs.filter(function (d) { return (d.tipo_doc || '') === 'albaran'; });
      const secundarios = v.docs.filter(function (d) { return (d.tipo_doc || '') !== 'albaran'; });
      const M = albaranes.length;
      if (!N) {
        // Multiviaje pero no se leyo cuantos: no se puede desglosar. Una fila, REVISAR.
        marcar(v, 'bloque multiviaje sin numero de viajes legible; no se pudo desglosar');
        errores.push('Bloque multiviaje (' + (v.cliente || '?') + ' ' + (v.origen || '?') + '->' + (v.destino || '?') + '): no se leyo el numero de viajes en la ficha. No se desgloso.');
        expandidos.push(v);
        continue;
      }
      const nSlots = Math.max(N, M);
      if (M > N) { avisos.push('Bloque multiviaje ' + (v.cliente || '') + ' ' + (v.origen || '') + '->' + (v.destino || '') + ': declara ' + N + ' viajes y llegaron ' + M + ' albaranes; se generan ' + nSlots + '.'); }
      const reparto = CRUCE.repartirKm(v.km_cargados, nSlots); // [] si el bloque no trae km
      const bloqueDudoso = v.motivos_revision.length > 0;
      for (let j = 0; j < nSlots; j++) {
        const alb = (j < M) ? albaranes[j] : null;
        const nv = {
          hoja_idx: v.hoja_idx, orden: v.orden, sub_orden: j + 1,
          conductor: v.conductor, tractora: v.tractora, remolque: v.remolque, empresa: v.empresa, tractoraN: v.tractoraN,
          pagina_origen: v.pagina_origen,
          fecha_carga: v.fecha_carga, fecha_carga_texto: v.fecha_carga_texto, fecha_descarga: v.fecha_descarga,
          nombre_carga: v.nombre_carga, lugar_carga: v.lugar_carga, nombre_descarga: v.nombre_descarga, lugar_descarga: v.lugar_descarga,
          tipo_mercancia: v.tipo_mercancia,
          cantidad_kg: null, cantidad_declarada: v.cantidad_declarada, modo_cantidad: 'viajes',
          es_multiviaje: true, n_viajes_declarado: N,
          cliente: v.cliente, origen: v.origen, destino: v.destino, material: v.material,
          referencia: null, tipo_doc: null, fecha_documento: null,
          kg_documento: null, fuente_peso: null,
          importe_documento: null, tarifa_tn_documento: null,
          km_inicio: null, km_final: null, km_recorridos: null,
          km_cargados: reparto.length ? reparto[j] : null, km_vacios: null,
          origen_km: 'derivado_de_bloque',
          regimen_indexacion: v.regimen_indexacion,
          motivos_revision: bloqueDudoso ? v.motivos_revision.slice() : [],
          docs: alb ? [alb] : [],
          docs_ambiguos: []
        };
        if (alb) {
          // Documento de origen del viaje: kg y referencia de SU albaran (D-01).
          nv.kg_documento = num(alb.kg_neto);
          nv.fuente_peso = nz(alb.tipo_doc);
          nv.referencia = nz(alb.referencia);
          nv.tipo_doc = nz(alb.tipo_doc);
          nv.fecha_documento = nz(alb.fecha);
          nv.estado = 'con_documentacion';
          nv.pendiente_falta = null; nv.pendiente_reclamar_a = null;
        } else {
          nv.estado = 'PENDIENTE_DOCUMENTACION';
          nv.pendiente_falta = 'albaran del viaje ' + (j + 1) + ' de ' + N + ' (multiviaje)';
          nv.pendiente_reclamar_a = 'cliente';
          errores.push('Bloque ' + (v.cliente || '') + ' ' + (v.origen || '') + '->' + (v.destino || '') + ': falta el albaran del viaje ' + (j + 1) + ' de ' + N + '. PENDIENTE_DOCUMENTACION (reclamar al cliente).');
        }
        nv.origen_campos = {
          cliente: v.origen_campos ? v.origen_campos.cliente : null,
          referencia: alb ? fuenteDoc(alb) : null,
          kg_documento: alb ? fuenteDoc(alb) : null,
          origen: v.origen_campos ? v.origen_campos.origen : null,
          destino: v.origen_campos ? v.origen_campos.destino : null,
          material: v.origen_campos ? v.origen_campos.material : null,
          km: (nv.km_cargados !== null) ? 'ficha:odometro:derivado_de_bloque' : null,
          cantidad_ficha: null
        };
        expandidos.push(nv);
      }
      // Secundarios (CMR/ticket) del bloque: sin dato real para asignarlos a un
      // viaje puntual, se anotan a nivel de bloque en vez de perderse en silencio.
      if (secundarios.length > 0) {
        avisos.push('Bloque multiviaje ' + (v.cliente || '') + ': ' + secundarios.length + ' documento(s) no-albaran (CMR/ticket) sin viaje puntual asignado; quedan a nivel de bloque. Revisar.');
      }
    }
    viajes = expandidos;
  }

  // ---- Estado de lectura por fila ----
  // Cubre la calidad de LECTURA de la ficha. Deliberadamente NO incluye
  // "sin documentacion" (eje aparte, ya cubierto por `estado`) ni la ambiguedad
  // de correlacion documento->viaje (encargo 3).
  let nRevisar = 0;
  for (const v of viajes) {
    v.estado_lectura = v.motivos_revision.length ? ESTADO_LECTURA.REVISAR : ESTADO_LECTURA.OK;
    v.motivo_revision = v.motivos_revision.join('; ');
    if (v.estado_lectura === ESTADO_LECTURA.REVISAR) { nRevisar++; }
  }

  logInfo('fichas=' + hojasRaw.length + ' viajes=' + viajes.length + ' documentos=' + docsRaw.length +
    ' lectura_ok=' + (viajes.length - nRevisar) + ' lectura_revisar=' + nRevisar +
    ' errores=' + errores.length + ' avisos=' + avisos.length);
  if (nRevisar > 0) { logInfo(nRevisar + ' viaje(s) marcados REVISAR: la lectura no es confiable, requieren revision humana.'); }

  return { ok: true, hojas: hojasRaw, viajes: viajes, documentos: docsRaw, errores: errores, avisos: avisos, correlaciones_externas: correlacionesExternas };
}

/**
 * Informe legible. Mismo formato que v3.1 mas la linea de estado de lectura por
 * viaje y el conteo en la cabecera.
 */
function renderInforme(res) {
  const hojasRaw = res.hojas; const viajes = res.viajes; const docsRaw = res.documentos;
  const errores = res.errores; const avisos = res.avisos;
  const f = function (x) { return (x === null || x === undefined || x === '') ? '(falta)' : String(x); };
  const nRevisar = viajes.filter(function (v) { return v.estado_lectura === ESTADO_LECTURA.REVISAR; }).length;
  const L = [];
  L.push('======== INGESTA v3 ========');
  L.push('Fichas detectadas: ' + hojasRaw.length + '   Viajes: ' + viajes.length + '   Documentos: ' + docsRaw.length);
  L.push('Lectura: ' + (viajes.length - nRevisar) + ' OK / ' + nRevisar + ' REVISAR');
  if (nRevisar > 0) {
    L.push('  >> ATENCION: ' + nRevisar + ' de ' + viajes.length + ' viajes tienen lectura dudosa.');
    L.push('     No son datos buenos. Requieren revision humana antes de facturar.');
  }
  L.push('');
  for (let h = 0; h < hojasRaw.length; h++) {
    const H = hojasRaw[h];
    L.push('---- FICHA ' + (h + 1) + ' (pag ' + f(H.pagina) + ') ----');
    L.push('CONDUCTOR: ' + f(nz(H.conductor)) + '   TRACTORA: ' + f(nz(H.tractora)) + '   REMOLQUE: ' + f(nz(H.remolque)) + '   EMPRESA: ' + f(nz(H.empresa)));
    const vs = viajes.filter(function (v) { return v.hoja_idx === h; });
    for (const v of vs) {
      const n = viajes.indexOf(v) + 1;
      L.push('  VIAJE ' + n + ' | ' + f(v.cliente) + ' | ' + f(v.fecha_carga || v.fecha_carga_texto));
      L.push('    ' + f(v.origen) + ' -> ' + f(v.destino) + '   ' + f(v.material));
      L.push('    Ref: ' + f(v.referencia) + ' [' + f(v.tipo_doc) + ']   Docs asociados: ' + v.docs.length + (v.docs.length ? ' (pag ' + v.docs.map(function (d) { return d.pagina; }).join(', ') + ')' : ''));
      if (v.docs_ambiguos && v.docs_ambiguos.length) { L.push('    Docs ambiguos (NO asignados, revisar): pag ' + v.docs_ambiguos.map(function (d) { return d.pagina; }).join(', ')); }
      L.push('    Peso ficha: ' + f(v.cantidad_kg) + ' kg | documento: ' + f(v.kg_documento) + ' kg [' + f(v.fuente_peso) + ']');
      L.push('    KM: ' + f(v.km_inicio) + ' -> ' + f(v.km_final) + ' = ' + f(v.km_cargados) + (v.km_recorridos !== null ? '  (ficha: ' + v.km_recorridos + ')' : '  (ficha no lo trae)') + '   vacios: ' + f(v.km_vacios));
      if (v.importe_documento !== null) { L.push('    Importe doc: ' + v.importe_documento + ' EUR'); }
      if (v.tarifa_tn_documento !== null) { L.push('    Tarifa doc: ' + v.tarifa_tn_documento + ' EUR/TN'); }
      L.push('    LECTURA: ' + v.estado_lectura + (v.estado_lectura === ESTADO_LECTURA.REVISAR ? ' -> ' + v.motivo_revision : ''));
    }
    const gs = Array.isArray(H.gastos) ? H.gastos : [];
    L.push('  GASTOS: ' + (gs.length ? gs.map(function (g) { return f(g.tipo) + ' ' + f(g.importe) + ' (' + f(g.forma) + ')'; }).join(' | ') : 'ninguno'));
    if (nz(H.observaciones)) { L.push('  OBS: ' + H.observaciones); }
    L.push('');
  }
  L.push('---- ERRORES (' + errores.length + ') ----');
  if (!errores.length) { L.push('Ninguno.'); } else { for (const e of errores) { L.push('  X ' + e); } }
  L.push('');
  L.push('---- AVISOS (' + avisos.length + ') ----');
  if (!avisos.length) { L.push('Ninguno.'); } else { for (const a of avisos) { L.push('  ! ' + a); } }
  // Correlaciones N2 documento<->viaje existente. Solo se imprime si las hubo
  // (grafo cableado): sin cablear, esta seccion no aparece y el informe es
  // identico al de v3.2 (regresion intacta).
  const cx = Array.isArray(res.correlaciones_externas) ? res.correlaciones_externas : [];
  if (cx.length) {
    L.push('');
    L.push('---- CORRELACION N2 doc<->viaje existente (' + cx.length + ') ----');
    for (const c of cx) {
      const dref = f(nz(c.documento && c.documento.referencia)) + ' pag ' + f(c.documento && c.documento.pagina);
      if (c.viaje) {
        L.push('  = ' + c.correlacion + ' [' + f(c.confianza) + '] doc ' + dref + ' -> viaje ' + f(nz(c.viaje.referencia) || c.viaje.id) + ': ' + c.motivo);
      } else {
        L.push('  ? REVISAR doc ' + dref + ': ' + c.motivo);
      }
    }
  }
  L.push('============================');
  return L.join('\n');
}

/** Parsea un item de respuesta de OpenAI a objeto. */
function parseRespuesta(it) {
  if (!it || !it.json) { return null; }
  const c = (it.json.choices && it.json.choices[0] && it.json.choices[0].message) ? it.json.choices[0].message.content : null;
  if (!c) { return null; }
  try { return JSON.parse(c); } catch (e) { return null; }
}

/**
 * Ensambla las respuestas del modelo (v3.4: loop por pagina) y corre la
 * correlacion. Cada respuesta se empareja POR INDICE con su meta de "Preparar
 * Payload" ($('Preparar Payload').all()), que dice si el item era una pasada de
 * ficha (con su numero de pagina) o la de documentos.
 *
 *   - N respuestas pass:'fichas', cada una {hojas:[0..1]}. Se les inyecta la
 *     `pagina` real (el modelo ve una sola imagen y no la conoce). Se juntan en
 *     un unico rA = {hojas:[...todas...]}, en orden de pagina.
 *   - 1 respuesta pass:'documentos' -> rB = {documentos:[...]}.
 *
 * Perdida de fichas imposible en silencio: si una pasada de ficha devuelve JSON
 * invalido, es un ERROR explicito (no un hueco). Si devuelve hojas:[] es que esa
 * pagina no era una ficha (documento impreso) -> no cuenta como perdida.
 *
 * @param {Array} respuestas  salida de "Extraer GPT-4o" ($input.all()).
 * @param {Array} metas       $('Preparar Payload').all().map(i => i.json).
 * @param {object} [opts]     {rutas} pasa a correlacionar (default cruce.js).
 */
function procesar(respuestas, metas, opts) {
  metas = Array.isArray(metas) ? metas : [];
  const erroresPrevios = [];
  const hojasAll = [];
  let rB = null;
  let paginasFicha = 0;

  for (let i = 0; i < respuestas.length; i++) {
    const meta = metas[i] || {};
    const parsed = parseRespuesta(respuestas[i]);
    if (meta.pass === 'documentos') {
      rB = parsed;
      continue;
    }
    // pass 'fichas' (o desconocido: se trata como ficha, es el default del canal).
    paginasFicha++;
    const pagina = (typeof meta.pagina === 'number' && isFinite(meta.pagina)) ? meta.pagina : (i + 1);
    if (!parsed) {
      // JSON invalido: la ficha de esta pagina NO se leyo. Se hace visible.
      erroresPrevios.push('Pagina ' + pagina + ': el modelo de ficha no devolvio JSON valido; esa ficha NO se leyo (no se pierde en silencio).');
      continue;
    }
    const hojas = Array.isArray(parsed.hojas) ? parsed.hojas : [];
    if (hojas.length === 0) {
      // hojas:[] = esa pagina no era una ficha (documento impreso). No es perdida.
      continue;
    }
    for (let h = 0; h < hojas.length; h++) {
      const hoja = hojas[h];
      hoja.pagina = pagina; // el sistema asigna la pagina real; pisa lo que diga el modelo
      hojasAll.push(hoja);
    }
    if (hojas.length > 1) {
      erroresPrevios.push('Pagina ' + pagina + ': el modelo devolvio ' + hojas.length + ' fichas para una sola imagen; se cargan todas con esta pagina. Revisar.');
    }
  }

  const res = correlacionar({ hojas: hojasAll }, rB, opts);
  if (!res.ok) {
    return { ok: false, linea: 'ERROR: ninguna pasada de FICHAS devolvio JSON valido.', datos_json: '', avisos: 1, errores: 1, lectura_revisar: 0 };
  }

  // Los errores de ensamblado (fichas no leidas) van al frente del informe.
  res.errores = erroresPrevios.concat(res.errores);

  logInfo('loop por pagina: ' + paginasFicha + ' llamada(s) de ficha -> ' +
    hojasAll.length + ' ficha(s) leida(s), ' + res.viajes.length + ' viaje(s); ' +
    erroresPrevios.length + ' fallo(s) de lectura de pagina.');

  const salida = { hojas: res.hojas, viajes: res.viajes, documentos: res.documentos, errores: res.errores, avisos: res.avisos };
  // Aditivo: solo se agrega la clave si N2 produjo correlaciones (grafo cableado).
  // Sin cablear, `salida` (y por tanto datos_json) es identico al de v3.2.
  if (Array.isArray(res.correlaciones_externas) && res.correlaciones_externas.length) {
    salida.correlaciones_externas = res.correlaciones_externas;
  }
  const nRevisar = res.viajes.filter(function (v) { return v.estado_lectura === ESTADO_LECTURA.REVISAR; }).length;
  return {
    ok: true,
    linea: renderInforme(res),
    datos_json: JSON.stringify(salida),
    avisos: res.avisos.length,
    errores: res.errores.length,
    lectura_revisar: nRevisar
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ESTADO_LECTURA: ESTADO_LECTURA, correlacionar: correlacionar, renderInforme: renderInforme, parseRespuesta: parseRespuesta, procesar: procesar, setLogActivo: setLogActivo };
}

// Envoltorio especifico de n8n para el nodo Code "Formatear Linea Gesruta" del
// workflow [ESTEVEZ] Ingesta Viaje — WD0q9Ic0oDvUoJwp.
//
// Solo hace de puente: toma las respuestas de OpenAI (v3.4: N pasadas de ficha,
// una por pagina, + 1 pasada de documentos) y las empareja por indice con las
// metas de "Preparar Payload" (que dicen pass y pagina). Toda la logica vive en
// correlacionar.js. `node ficha/build-nodo.js` pega correlacionar.js delante de
// este archivo y produce el script final del nodo.

const respuestas = $input.all();
const metas = $('Preparar Payload').all().map(function (it) { return it.json || {}; });
return [{ json: procesar(respuestas, metas) }];
