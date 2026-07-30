// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/docai.js + ficha/nodo-extraer-docai.wrapper.js
// Contenido exacto del nodo Code "Extraer DocAI" (WD0q9Ic0oDvUoJwp).

// ===== Lector de odometros con Document AI (modalidad B: pagina + bbox) =====
//
// Parsea la respuesta de Document AI (Document OCR) de UNA pagina completa y
// devuelve, por banda de km, el km_inicio y km_final con su confianza y un flag
// de formato. Es la logica del nodo Code "Extraer DocAI" del canal ficha
// (WD0q9Ic0oDvUoJwp); vive aca para que el repo sea la fuente de verdad.
//
// Por que asi (evidencia de la prueba, ejec. 583/584, docs/prueba-document-ai.md):
//   - Document AI lee km_inicio 9/9 perfecto; km_final es el punto flojo.
//   - Cuando se equivoca, o escupe un token malformado (94/030, 841.06%) o baja
//     la confianza. NO tiene el error confiado-invisible de gpt-4o.
//   - A veces PARTE un numero en dos tokens ("839" + "056") y el orden de lectura
//     salta. Por eso NO se confia en el orden del texto: se ordena por X y se usan
//     las etiquetas impresas (INICIO / FINAL / RECORRIDOS) como anclas, uniendo
//     los tokens numericos que caen entre una etiqueta y la siguiente.

'use strict';

// Umbral de confianza para aceptar un odometro de Document AI SIN revision.
// PRELIMINAR: sale de una muestra de 9 viajes (prueba 583/584). Se recalibrara
// con mas fichas reales (encargo aparte). No hardcodear en el medio de la logica.
var UMBRAL_CONFIANZA_DOCAI = 0.80;

// Bandas de la linea KM de cada viaje, en coordenadas relativas Y de la pagina
// (mismas de REGIONES_FICHA, ceñidas a la linea de km para NO tragar la linea
// CANTIDAD de arriba ni GASTOS de abajo).
var BANDAS_KM = {
  km_v1: [0.30, 0.35],
  km_v2: [0.435, 0.485],
  km_v3: [0.57, 0.62],
};

// Etiquetas impresas de la linea de km (no son datos).
var ES_ETIQUETA = /^(KM|AL|DEL|VIAJE|INICIO|FINAL|RECORRIDOS)$/i;

function tokenText(text, layout) {
  var s = '';
  if (layout && layout.textAnchor && Array.isArray(layout.textAnchor.textSegments)) {
    for (var i = 0; i < layout.textAnchor.textSegments.length; i++) {
      var seg = layout.textAnchor.textSegments[i];
      var a = parseInt(seg.startIndex || 0, 10), b = parseInt(seg.endIndex || 0, 10);
      s += text.substring(a, b);
    }
  }
  return s.replace(/\s+/g, ' ').trim();
}

function centro(layout, k) {
  try {
    var v = layout.boundingPoly.normalizedVertices;
    var s = 0, n = 0;
    for (var i = 0; i < v.length; i++) { if (typeof v[i][k] === 'number') { s += v[i][k]; n++; } }
    return n ? s / n : null;
  } catch (e) { return null; }
}

// Analiza un valor de odometro ya unido (p.ej. "838.163", "739056", "94/030").
// Quita separadores de miles (. , espacio). Si queda algun caracter no-digito
// (/, %, letra), es MALFORMADO: no se parsea el numero roto, valor = null.
function analizarValor(raw) {
  var limpio = (raw || '').replace(/[.,\s]/g, '');
  var malformado = !/^\d+$/.test(limpio);
  return {
    valor: malformado ? null : parseInt(limpio, 10),
    malformado: malformado,
    raw: raw,
  };
}

// Combina los tokens numericos de un segmento en un solo valor. La confianza del
// campo es la MINIMA de sus tokens (el eslabon mas debil manda).
function combinar(segmento) {
  if (!segmento.length) { return { valor: null, malformado: false, conf: null, raw: '' }; }
  var raw = segmento.map(function (o) { return o.t; }).join('');
  var a = analizarValor(raw);
  var conf = Math.min.apply(null, segmento.map(function (o) { return (typeof o.c === 'number') ? o.c : 1; }));
  return { valor: a.valor, malformado: a.malformado, conf: conf, raw: raw };
}

/**
 * Parsea los tokens de UNA banda de km. `tokens` = [{t, c, x}] (texto, confianza,
 * centro-x), en cualquier orden. Usa las etiquetas INICIO/FINAL/RECORRIDOS como
 * anclas por X; los tokens numericos entre dos etiquetas forman un campo.
 * @returns {{inicio, final, recorridos}} cada uno {valor, malformado, conf, raw}
 */
function parsearBandaKm(tokens) {
  var sorted = tokens.slice().sort(function (a, b) { return a.x - b.x; });
  function labelX(re) { for (var i = 0; i < sorted.length; i++) { if (re.test(sorted[i].t)) { return sorted[i].x; } } return null; }
  var xIni = labelX(/^INICIO$/i);
  var xFin = labelX(/^FINAL$/i);
  var xRec = labelX(/^RECORRIDOS$/i);

  var nums = sorted.filter(function (o) { return /\d/.test(o.t) && !ES_ETIQUETA.test(o.t); });
  function seg(xLo, xHi) { return nums.filter(function (o) { return (xLo === null || o.x > xLo) && (xHi === null || o.x < xHi); }); }

  // Camino normal: etiquetas presentes -> segmentos por rango de X.
  if (xIni !== null && xFin !== null && xRec !== null) {
    return { inicio: combinar(seg(xIni, xFin)), final: combinar(seg(xFin, xRec)), recorridos: combinar(seg(xRec, null)) };
  }
  // Fallback: sin todas las etiquetas, tomar los numeros "largos" (>=5 digitos =
  // odometro) por X: 1o inicio, 2o final; el corto de la derecha, recorridos.
  var largos = nums.filter(function (o) { return o.t.replace(/[.,\s]/g, '').length >= 5; });
  var cortos = nums.filter(function (o) { return o.t.replace(/[.,\s]/g, '').length < 5; });
  return {
    inicio: combinar(largos.slice(0, 1)),
    final: combinar(largos.slice(1, 2)),
    recorridos: combinar(cortos.slice(-1)),
  };
}

/**
 * De la respuesta Document AI de UNA pagina, extrae los odometros de las 3 bandas.
 * @param {object} doc  el `document` de la respuesta (:process).
 * @returns {{km_v1, km_v2, km_v3}} cada uno el resultado de parsearBandaKm.
 */
function extraerOdometrosPagina(doc) {
  var text = (doc && doc.text) || '';
  var pages = (doc && Array.isArray(doc.pages)) ? doc.pages : [];
  var pg = pages[0] || {};
  var toks = Array.isArray(pg.tokens) ? pg.tokens : [];
  var out = {};
  for (var nombre in BANDAS_KM) {
    if (!BANDAS_KM.hasOwnProperty(nombre)) { continue; }
    var y0 = BANDAS_KM[nombre][0], y1 = BANDAS_KM[nombre][1];
    var band = [];
    for (var i = 0; i < toks.length; i++) {
      var cy = centro(toks[i].layout, 'y');
      if (cy === null || cy < y0 || cy > y1) { continue; }
      band.push({
        t: tokenText(text, toks[i].layout),
        c: (toks[i].layout && typeof toks[i].layout.confidence === 'number') ? toks[i].layout.confidence : null,
        x: centro(toks[i].layout, 'x'),
      });
    }
    out[nombre] = parsearBandaKm(band);
  }
  return out;
}

/**
 * Decide si un campo de odometro de Document AI se acepta o va a REVISAR.
 * Regla (encargo §2): se acepta solo si NO es malformado Y conf >= umbral.
 * @returns {{ok:boolean, motivo:string|null}}
 */
function evaluarCampoDocai(campo, umbral) {
  var u = (typeof umbral === 'number') ? umbral : UMBRAL_CONFIANZA_DOCAI;
  if (!campo || campo.valor === null || campo.malformado) {
    return { ok: false, motivo: 'formato_invalido_docai' };
  }
  if (typeof campo.conf === 'number' && campo.conf < u) {
    return { ok: false, motivo: 'baja_confianza_docai' };
  }
  return { ok: true, motivo: null };
}

/**
 * Analiza UNA pagina Document AI y devuelve, por banda de km, inicio/final ya
 * evaluados por la guarda (ok + motivo), listos para que el correlacionador los
 * fusione sin tener que conocer el umbral. `recorridos` se devuelve solo como
 * lectura de Document AI del numero escrito (contexto, no se usa para corregir).
 */
function analizarPaginaDocai(doc) {
  var bandas = extraerOdometrosPagina(doc);
  var out = {};
  for (var nombre in bandas) {
    if (!bandas.hasOwnProperty(nombre)) { continue; }
    var b = bandas[nombre];
    var eIni = evaluarCampoDocai(b.inicio);
    var eFin = evaluarCampoDocai(b.final);
    out[nombre] = {
      inicio: { valor: b.inicio.valor, conf: b.inicio.conf, malformado: b.inicio.malformado, raw: b.inicio.raw, ok: eIni.ok, motivo: eIni.motivo },
      final: { valor: b.final.valor, conf: b.final.conf, malformado: b.final.malformado, raw: b.final.raw, ok: eFin.ok, motivo: eFin.motivo },
      recorridos: { valor: b.recorridos.valor, raw: b.recorridos.raw },
    };
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UMBRAL_CONFIANZA_DOCAI: UMBRAL_CONFIANZA_DOCAI,
    BANDAS_KM: BANDAS_KM,
    analizarValor: analizarValor,
    parsearBandaKm: parsearBandaKm,
    extraerOdometrosPagina: extraerOdometrosPagina,
    evaluarCampoDocai: evaluarCampoDocai,
    analizarPaginaDocai: analizarPaginaDocai,
    tokenText: tokenText,
  };
}

// Nodo Code "Extraer DocAI" del workflow [ESTEVEZ] Ingesta Viaje (WD0q9Ic0oDvUoJwp).
//
// Toma las respuestas de Document AI (una por pagina, en $input) y las empareja
// por indice con las metas de "Preparar DocAI" (que traen el numero de pagina).
// Por cada pagina extrae los odometros de sus 3 bandas de km ya evaluados por la
// guarda de confianza/formato. Toda la logica vive en docai.js (analizarPaginaDocai);
// `node ficha/build-nodo.js` la pega delante de este envoltorio.

const metas = $('Preparar DocAI').all().map(function (it) { return it.json || {}; });
const items = $input.all();
const out = [];
for (let i = 0; i < items.length; i++) {
  const meta = metas[i] || {};
  const doc = (items[i].json && items[i].json.document) ? items[i].json.document : {};
  const bandas = analizarPaginaDocai(doc);
  out.push({ json: { pagina: meta.pagina, km_v1: bandas.km_v1, km_v2: bandas.km_v2, km_v3: bandas.km_v3 } });
}
return out;
