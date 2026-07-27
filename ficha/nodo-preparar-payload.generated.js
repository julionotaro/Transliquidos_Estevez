// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/payload.js + ficha/nodo-preparar-payload.wrapper.js
// Contenido exacto del nodo Code "Preparar Payload" (WD0q9Ic0oDvUoJwp).

// ===== PREPARAR PAYLOAD v3.3: lectura de ficha sobre imagen rasterizada =====
//
// Logica pura del nodo Code "Preparar Payload" del workflow [ESTEVEZ] Ingesta
// Viaje (WD0q9Ic0oDvUoJwp). Extraida aqui para que el repo sea la fuente de
// verdad; el nodo se genera con `node ficha/build-nodo.js`.
//
// Cambio v3.2 -> v3.3: la pasada de FICHAS ahora va al modelo como imagen
// rasterizada a 300 DPI (image_url, detail:high), no como PDF-archivo. Ese es el
// bug de fondo probado el 26/07: manuscrito sobre PDF-archivo rinde mal, sobre
// imagen rinde bien. La pasada de DOCUMENTOS no se toca — sigue con type:file y
// gpt-4o, que funciona.
//
// La rasterizacion la hace el nodo HTTP "Rasterizar Ficha" (multipart al
// microservicio en http://rasterizador:8000/rasterizar?dpi=300, un run por PDF).
// El wrapper de este nodo lee $('Rasterizar Ficha').all() y las paginas
// resultantes se concatenan en adjuntos[]. Prompt sin cambios.
//
// Arnes de barrido:
//   MODELO_FICHAS es la variable a swappear entre corridas. Modelos cableados:
//   gpt-4o-mini, gpt-4o (OpenAI, credencial ya existe). Slot Gemini Flash
//   documentado en ficha/README.md, no wired: requiere HTTP node aparte con la
//   credencial de Google AI Studio.

'use strict';

// Barrido: modelos candidatos para MODELO_FICHAS. La eleccion final la hace el
// operador con la tabla comparativa (fase PRUEBA); no cambiar el default sin OK.
var MODELOS_BARRIDO = [
  { id: 'gpt-4o-mini', proveedor: 'openai', wired: true },
  { id: 'gemini-flash', proveedor: 'google', wired: false, nota: 'requiere credencial Google AI Studio; ver README' },
  { id: 'gpt-4o', proveedor: 'openai', wired: true },
];

// La familia gpt-5 y los modelos de razonamiento rechazan max_tokens y
// temperature != 1; usan max_completion_tokens.
function esRazonadorOpenAI(modelo) { return /^(gpt-5|o[0-9])/.test(modelo || ''); }
function esOpenAI(modelo) { return /^(gpt-|o[0-9])/.test(modelo || ''); }
function esGemini(modelo) { return /^gemini/i.test(modelo || ''); }

// Logging estandar del runtime (console). Silenciable en tests.
var LOG_ACTIVO = true;
function setLogActivo(v) { LOG_ACTIVO = !!v; }
function logInfo(m) { if (LOG_ACTIVO) { console.log('[ficha:payload] ' + m); } }
function logError(m) { if (LOG_ACTIVO) { console.error('[ficha:payload] ERROR ' + m); } }

// --- Prompts ---------------------------------------------------------------
// PROMPT_FICHAS y PROMPT_DOCS son COPIAS LITERALES del nodo v3.2. No modificar
// aqui — el prompt ya tiene reglas anti-fabricacion validadas. Cualquier cambio
// va como fase aparte, con test que muestre que rinde mejor sobre las 3 fichas.

var PROMPT_FICHAS = [
  'Eres un transcriptor de FICHAS DE CHOFER manuscritas de Trans. Liquidos Estevez S.L.',
  '',
  'El PDF puede contener VARIAS fichas. Cada ficha ocupa una pagina y se reconoce por: membrete impreso TRANS. LIQUIDOS ESTEVEZ, S.L., campos CONDUCTOR / TRACTORA / REMOLQUE escritos a mano, tres bloques de viaje con FECHA DE CARGA, NOMBRE DE CARGA, LUGAR DE CARGA, TIPO DE MERCANCIA y KM, y abajo los recuadros GASTOS DEL VIAJE y OBSERVACIONES.',
  '',
  'TU UNICA TAREA son las fichas manuscritas. IGNORA POR COMPLETO toda pagina que sea documento impreso (CMR, carta de porte, albaran, orden de transporte, orden de carga, guia, ticket de bascula, autorizacion de salida, correo). NO uses datos de esas paginas para rellenar una ficha.',
  '',
  '=== REGLA MAS IMPORTANTE: NO CONFABULES ===',
  'Estas leyendo letra manuscrita sobre un escaneo. Si NO puedes leer un campo con seguridad, devuelve null.',
  'Devolver null es MUCHO MEJOR que una lectura aproximada. Un dato inventado que parece plausible provoca una factura mal emitida; un null solo provoca una revision humana.',
  'PROHIBIDO ABSOLUTAMENTE: escribir nombres de empresas, materiales, localidades o cifras que no estes leyendo LITERALMENTE en la ficha. No completes por conocimiento del sector ni por lo que "suele" transportar esta empresa.',
  'Los clientes habituales son FORESA, BRESFOR, QUIMIDROGA, RNM, HELM, BALTRANSA y TEPSA como planta cargadora, pero eso es solo contexto: NO lo uses para adivinar un campo ilegible.',
  '',
  '=== ERRORES CONCRETOS COMETIDOS EN INTENTOS ANTERIORES, NO LOS REPITAS ===',
  '1) INVENTAR EL ANO. Se devolvio 2022 cuando la ficha decia 2026. Lee el ano digito por digito. Si no lo distingues, fecha null.',
  '2) GENERAR SECUENCIAS DE ODOMETRO. Se devolvio 838163, 840163, 842163 (exactamente +2000 cada uno) cuando los valores reales eran distintos entre si. Los odometros de bloques distintos NO siguen un patron regular. Lee CADA uno por separado; si uno no se lee, ese va null aunque los otros si se lean.',
  '3) PERDER BLOQUES. Se devolvieron 6 viajes cuando habia 9. Revisa los TRES bloques de CADA ficha antes de responder.',
  '4) CONFUNDIR ETIQUETAS DE GASTOS. En OBSERVACIONES suele haber lineas tipo Transf. / Nominas que NO son dietas ni peajes. Asigna cada importe a la fila del recuadro GASTOS DEL VIAJE donde realmente esta escrito.',
  '',
  'REGLAS:',
  '- UNA entrada en hojas[] por CADA ficha. Si hay tres fichas, devuelve tres. NUNCA fusiones fichas: conductores o tractoras distintas son fichas distintas.',
  '- Dentro de cada ficha, un elemento en bloques[] por cada bloque RELLENO (maximo 3). No inventes bloques vacios.',
  '- TRANSCRIPCION LITERAL: copia lo escrito con sus abreviaturas y faltas. No corrijas, no traduzcas, no completes.',
  '- MATRICULAS: transcribe caracter a caracter lo que ves (formato habitual 4 digitos + 3 letras, ej 2498KZL). Si una letra o cifra es dudosa, devuelve lo que lees pero NO fuerces un formato valido.',
  '- FECHAS: se escriben dd/mm/aaaa o dd-m-aa. Devuelve SIEMPRE fecha_carga_texto con lo escrito tal cual. Si el ano figura, completo o abreviado (26 = 2026), rellena tambien fecha_carga en YYYY-MM-DD. Devuelve fecha_carga null SOLO si el ano no esta escrito o no se distingue.',
  '- ODOMETROS: km_inicio es KM. AL INICIO DEL VIAJE. km_final es KM. AL FINAL DEL VIAJE. km_recorridos es KM. RECORRIDOS. Transcribe los tres TAL COMO ESTAN ESCRITOS, quitando los puntos de miles (838.163 -> 838163). Si un campo esta vacio o ilegible, null: es normal que km_recorridos falte.',
  '- CANTIDAD: el peso escrito por el chofer en kg, sin puntos de miles (23.140 -> 23140). Si no se lee, null.',
  '- GASTOS: transcribe el recuadro GASTOS DEL VIAJE por tipo (dietas, gasoleo, peajes, lavados, otros) con su importe, segun la columna EN EFECTIVO o A CREDITO. Transcribe el texto completo de OBSERVACIONES por separado, sin convertirlo en gastos.',
  '- pagina: numero de pagina del PDF donde esta la ficha (1 = primera).',
  '',
  'SOBRE EL ESQUEMA: los null del ejemplo indican el TIPO del campo, no un valor por defecto. Devuelve el dato leido o null. NUNCA 0 en un campo numerico que no pudiste leer.',
  '',
  'Devuelve EXCLUSIVAMENTE un objeto JSON valido, sin markdown:',
  '{"hojas":[{"pagina":1,"empresa":"TLE|HEC|null","conductor":null,"tractora":null,"remolque":null,"bloques":[{"orden":1,"fecha_carga":null,"fecha_carga_texto":null,"fecha_descarga":null,"nombre_carga":null,"lugar_carga":null,"nombre_descarga":null,"lugar_descarga":null,"tipo_mercancia":null,"cantidad_kg":null,"km_inicio":null,"km_final":null,"km_recorridos":null}],"gastos":[{"tipo":"dieta|gasoleo|peaje|lavado|otro","importe":null,"forma":"efectivo|credito|null"}],"observaciones":null}]}',
].join('\n');

var PROMPT_DOCS = [
  'Eres un extractor de DOCUMENTOS IMPRESOS de transporte de liquidos por carretera (Espana y Portugal).',
  '',
  'TU UNICA TAREA son los documentos impresos: CMR, carta de porte, albaran, orden de transporte, orden de carga, guia, ticket de bascula, autorizacion de salida, correo. IGNORA POR COMPLETO las fichas manuscritas de chofer (membrete TRANS. LIQUIDOS ESTEVEZ con CONDUCTOR y TRACTORA escritos a mano y recuadros GASTOS DEL VIAJE / OBSERVACIONES). NO uses datos de las fichas.',
  '',
  'UNA entrada en documentos[] por CADA PAGINA que sea un documento impreso.',
  'MUY IMPORTANTE: varias paginas pertenecen normalmente al MISMO viaje (por ejemplo orden de carga + CMR + carta de porte + ticket de bascula + autorizacion de salida). NO las agrupes, NO las fusiones, NO deduzcas a que viaje pertenece cada una: devuelve cada pagina por separado con sus propios datos. La agrupacion la hace el sistema despues.',
  '- Si dos paginas son copias del mismo documento (mismo numero), devuelve ambas e indica en duplicado_de el numero de pagina de la primera.',
  '',
  'CAMPOS:',
  '- matricula_tractor y matricula_remolque TAL COMO figuran (ej 2498KZL, R1007BCV). Buscalas en Tractor, Vehiculo tractor, Cabeza, Matricula, Plataforma, Cisterna portatil, Reboque. Es el dato mas importante del documento: si no aparece, null.',
  '- referencia segun el emisor: FORESA -> el numero CORTO que empieza por 20 arriba a la derecha del CMR/ALBARAN (ej 2009926), NUNCA el que empieza por 5030. QUIMIDROGA -> el valor de "Referencia en factura". RNM -> el Numero de la Guia. HELM -> el numero que la orden pide incluir en factura. BALTRANSA -> el numero de ORDEN DE CARGA. Ticket de bascula -> el Nº Ticket.',
  '- fecha: la de carga o expedicion que figura en el documento, YYYY-MM-DD.',
  '- material: transcripcion LITERAL de la denominacion de la mercancia, caracter a caracter. En mercancia peligrosa (ADR) copia la linea legal completa tal cual.',
  '- origen y destino tal como figuran. NO completes provincia ni pais.',
  '- kg_neto: el PESO NETO en kilogramos. Si el documento solo trae bruto y tara, devuelve el neto solo si esta impreso; no lo restes tu.',
  '- importe y tarifa_tn solo si el documento indica explicitamente el precio del transporte. BALTRANSA lo pone como PRECIO en la cabecera: si trae sufijo /TN o EU/TN es tarifa_tn, si no lleva sufijo es importe. HELM lo pone como Coste de transporte (importe). Si no hay precio, ambos null.',
  '- cliente_probable: quien CONTRATA el transporte, no el destinatario. TEPSA es planta cargadora de QUIMIDROGA. FINSA, Orember, Cella son destinos de FORESA. DROVI, Drogas Vigo, Compogal, Ence Navia son destinatarios. Si el membrete es Baltransa, el cliente es BALTRANSA. Si no lo reconoces, null.',
  '',
  'REGLA DE NULOS: dato ausente o ilegible -> null (el valor JSON null real, nunca la cadena "null"). Los null del esquema indican el TIPO del campo, no un valor por defecto. NUNCA 0 en un campo numerico desconocido. NUNCA inventes ni completes por analogia.',
  '',
  'Devuelve EXCLUSIVAMENTE un objeto JSON valido, sin markdown:',
  '{"documentos":[{"pagina":1,"tipo_doc":"cmr|carta_porte|albaran|orden_transporte|orden_carga|guia|bascula|autorizacion|mail|otro","emisor":null,"duplicado_de":null,"matricula_tractor":null,"matricula_remolque":null,"referencia":null,"fecha":null,"origen":null,"destino":null,"material":null,"kg_neto":null,"importe":null,"tarifa_tn":null,"cliente_probable":null}]}',
].join('\n');

// --- Adjuntos --------------------------------------------------------------

/**
 * Convierte una lista de PNGs base64 (una por pagina rasterizada) en items
 * `image_url` para la pasada de ficha.
 */
function adjuntosImagenesDesdePng(pngB64Array) {
  var out = [];
  for (var i = 0; i < pngB64Array.length; i++) {
    var b64 = pngB64Array[i];
    if (!b64) continue;
    out.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64, detail: 'high' } });
  }
  return out;
}

/**
 * Adjuntos para la pasada de documentos: PDFs como type:file (sin cambios
 * v3.2), imagenes directas como image_url.
 * @param {Array<{nombre:string, mime:string, b64:string}>} archivos
 */
function adjuntosDocsDesdeArchivos(archivos) {
  var out = [];
  for (var i = 0; i < archivos.length; i++) {
    var a = archivos[i];
    var mime = (a.mime || '').toLowerCase();
    if (mime === 'application/pdf') {
      out.push({ type: 'file', file: { filename: a.nombre || 'documento.pdf', file_data: 'data:application/pdf;base64,' + a.b64 } });
    } else if (mime.indexOf('image/') === 0) {
      out.push({ type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + a.b64, detail: 'high' } });
    }
  }
  return out;
}

// --- Payloads --------------------------------------------------------------

function mkPayloadOpenAI(modelo, sys, userText, adjuntos) {
  var content = [{ type: 'text', text: userText }].concat(adjuntos);
  var p = { model: modelo, messages: [{ role: 'system', content: sys }, { role: 'user', content: content }], response_format: { type: 'json_object' } };
  if (esRazonadorOpenAI(modelo)) {
    p.max_completion_tokens = 16000;
  } else {
    p.max_tokens = 8000;
    p.temperature = 0;
  }
  return p;
}

var USER_TEXT_FICHAS = 'Transcribe TODAS las fichas de chofer manuscritas de este PDF, una entrada por ficha, revisando los tres bloques de cada una. Ignora los documentos impresos. Si un campo no se lee con seguridad, devuelve null en vez de adivinar.';
var USER_TEXT_DOCS = 'Extrae TODOS los documentos impresos de este PDF, una entrada por pagina. Ignora las fichas manuscritas.';

/** Construye el payload de la pasada de fichas para un modelo dado. */
function armarPayloadFichas(modelo, adjuntos, hint) {
  if (esGemini(modelo)) {
    throw new Error('MODELO_FICHAS="' + modelo + '": Gemini no esta cableado todavia. Falta credencial de Google AI Studio + HTTP node dedicado. Ver ficha/README.md ("Activar el slot Gemini").');
  }
  if (!esOpenAI(modelo)) {
    throw new Error('MODELO_FICHAS="' + modelo + '": proveedor desconocido. Modelos cableados: ' + MODELOS_BARRIDO.filter(function (m) { return m.wired; }).map(function (m) { return m.id; }).join(', ') + '.');
  }
  var texto = USER_TEXT_FICHAS + (hint || '');
  return mkPayloadOpenAI(modelo, PROMPT_FICHAS, texto, adjuntos);
}

/** Construye el payload de la pasada de documentos. */
function armarPayloadDocs(modelo, adjuntos, hint) {
  if (!esOpenAI(modelo)) {
    throw new Error('MODELO_DOCS="' + modelo + '": solo OpenAI esta cableado en la pasada de documentos.');
  }
  var texto = USER_TEXT_DOCS + (hint || '');
  return mkPayloadOpenAI(modelo, PROMPT_DOCS, texto, adjuntos);
}

/** Concatena las paginas rasterizadas de N respuestas de rasterizador en orden. */
function concatPaginasRasterizadas(respuestasRast) {
  var out = [];
  for (var i = 0; i < respuestasRast.length; i++) {
    var r = respuestasRast[i] || {};
    var paginas = Array.isArray(r.paginas) ? r.paginas : [];
    for (var j = 0; j < paginas.length; j++) {
      var p = paginas[j];
      if (p && p.png_base64) { out.push(p.png_base64); }
    }
  }
  return out;
}

/** Compone el hint que va al final del user text a partir de body/empresa/notas. */
function componerHint(empresaHint, notas) {
  var hint = '';
  if (empresaHint && empresaHint !== 'No estoy seguro') { hint += ' Empresa indicada por el operador: ' + empresaHint + '.'; }
  if (notas) { hint += ' Notas del operador: ' + notas; }
  return hint;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MODELOS_BARRIDO: MODELOS_BARRIDO,
    esRazonadorOpenAI: esRazonadorOpenAI,
    esOpenAI: esOpenAI,
    esGemini: esGemini,
    setLogActivo: setLogActivo,
    PROMPT_FICHAS: PROMPT_FICHAS,
    PROMPT_DOCS: PROMPT_DOCS,
    adjuntosImagenesDesdePng: adjuntosImagenesDesdePng,
    adjuntosDocsDesdeArchivos: adjuntosDocsDesdeArchivos,
    mkPayloadOpenAI: mkPayloadOpenAI,
    armarPayloadFichas: armarPayloadFichas,
    armarPayloadDocs: armarPayloadDocs,
    concatPaginasRasterizadas: concatPaginasRasterizadas,
    componerHint: componerHint,
  };
}

// Envoltorio de n8n para el nodo Code "Preparar Payload" del workflow
// [ESTEVEZ] Ingesta Viaje — WD0q9Ic0oDvUoJwp.
//
// Entrada: los items de "Rasterizar Ficha" (una respuesta del microservicio por
// PDF). El base64 de los adjuntos para la pasada de documentos NO se lee de aca:
// viene ya resuelto en `archivos`, desde "Preparar Rasterizacion".
//
// Por que: `getBinaryDataBuffer` resuelve contra la entrada del nodo actual, que
// a esta altura es la respuesta JSON del rasterizador y no tiene binarios. Y
// leer `binary[key].data` de un nodo anterior devuelve la cadena "filesystem-v2"
// (modo de almacenamiento filesystem), que decodificada da basura sin lanzar
// error. Verificado en esta instancia (ejec. 550).
//
// Salida: dos items, uno por pasada, igual que v3.2 — "Extraer GPT-4o" corre una
// vez por item.

// ===== BARRIDO DE MODELOS =====
// Pasada A (ficha manuscrita) sobre IMAGEN rasterizada a 300 DPI.
// Cambiar MODELO_FICHAS para correr el barrido. Cableados: gpt-4o-mini, gpt-4o.
// Se puede pisar por corrida mandando `modelo_fichas` en el body del webhook.
const MODELO_FICHAS = 'gpt-4o-mini';
const MODELO_DOCS = 'gpt-4o';

const hook = $('Hook Viaje').first();
const body = (hook.json && hook.json.body) ? hook.json.body : {};
const empresaHint = body['Empresa'] || hook.json['Empresa'] || '';
const notas = body['Notas'] || hook.json['Notas'] || '';

// Override por corrida, para el barrido sin tocar el nodo.
const modeloFichas = body['modelo_fichas'] || MODELO_FICHAS;

// --- Pasada A: paginas rasterizadas -> image_url ---------------------------
const respuestasRast = $input.all().map(function (it) { return it.json || {}; });
const pngs = concatPaginasRasterizadas(respuestasRast);
if (pngs.length === 0) {
  throw new Error('El rasterizador no devolvio ninguna pagina. La ficha NO se puede leer sobre PDF-archivo (rinde mal en manuscrito); se aborta en vez de degradar en silencio.');
}
const adjuntosFicha = adjuntosImagenesDesdePng(pngs);

// --- Pasada B: adjuntos originales, con el base64 leido aguas arriba --------
const archivos = ($('Preparar Rasterizacion').first().json || {}).archivos || [];
if (archivos.length === 0) {
  throw new Error('No llegaron los adjuntos para la pasada de documentos (Preparar Rasterizacion no devolvio `archivos`).');
}
const adjuntosDocs = adjuntosDocsDesdeArchivos(archivos);

const hint = componerHint(empresaHint, notas);

logInfo('modelo_fichas=' + modeloFichas + ' modelo_docs=' + MODELO_DOCS +
  ' paginas_rasterizadas=' + pngs.length + ' archivos=' + archivos.length);

return [
  { json: { pass: 'fichas', modelo: modeloFichas, paginas_rasterizadas: pngs.length, payload: armarPayloadFichas(modeloFichas, adjuntosFicha, hint) } },
  { json: { pass: 'documentos', modelo: MODELO_DOCS, payload: armarPayloadDocs(MODELO_DOCS, adjuntosDocs, hint) } }
];
