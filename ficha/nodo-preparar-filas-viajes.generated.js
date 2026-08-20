// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/../catalogo/resolver-punto.js + ficha/tarifa-contractual.js + ficha/dedup.js + ficha/nodo-preparar-filas-viajes.wrapper.js
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
let tarifasTbl = [], puntosTbl = [];
try { tarifasTbl = $('Leer Tarifas').all().map(function (it) { return (it && it.json) ? it.json : {}; }); } catch (e) {}
try { puntosTbl = $('Leer Puntos').all().map(function (it) { return (it && it.json) ? it.json : {}; }); } catch (e) {}
const tarifaDe = function (v) {
  if (typeof buscarTarifaContractual !== 'function' || !tarifasTbl.length) { return { tn: null, fijo: null, motivo: '' }; }
  const r = buscarTarifaContractual({ cliente: v.cliente, origen: v.origen, destino: v.destino, material: v.material }, tarifasTbl, puntosTbl);
  if (!r) { return { tn: null, fijo: null, motivo: '' }; }
  if (r.tarifa === null) { return { tn: null, fijo: null, motivo: r.motivo || '' }; }
  return { tn: r.tarifa_tn, fijo: r.precio_fijo, motivo: r.revisar ? ('tarifa via punto resuelto — verificar (' + s(v.origen) + '->' + s(v.destino) + ')') : '' };
};

const filas = [];
for (const v of viajes) {
  const tar = tarifaDe(v);
  filas.push({
    hoja_id: idDe(v.hoja_idx),
    orden: n(v.orden),
    fecha: s(v.fecha_carga),
    empresa: s(v.empresa),
    tractora: s(v.tractora),
    semi: s(v.remolque),
    conductor: s(v.conductor),
    cliente: s(v.cliente),
    origen: s(v.origen),
    destino: s(v.destino),
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
