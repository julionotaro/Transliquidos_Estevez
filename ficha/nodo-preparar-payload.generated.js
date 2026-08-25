// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/payload.js + ficha/nodo-preparar-payload.wrapper.js
// Contenido exacto del nodo Code "Preparar Payload" (WD0q9Ic0oDvUoJwp).

// ===== PREPARAR PAYLOAD v3.4: una llamada por pagina (loop) =================
//
// Logica pura del nodo Code "Preparar Payload" del workflow [ESTEVEZ] Ingesta
// Viaje (WD0q9Ic0oDvUoJwp). Extraida aqui para que el repo sea la fuente de
// verdad; el nodo se genera con `node ficha/build-nodo.js`.
//
// Cambio v3.3 -> v3.4: la pasada de FICHAS emite UN item por pagina rasterizada,
// cada uno con UNA sola imagen. "Extraer GPT-4o" corre una vez por pagina y cada
// llamada devuelve una ficha. Antes (v3.3) las N imagenes iban en UNA sola
// llamada, y gpt-4o-mini devolvia una sola ficha perdiendo el resto en silencio
// (ejec. 552: prompt_tokens 111878 = recibio las 3 imagenes, devolvio 1). Con
// una imagen por llamada es imposible perder una ficha por diseno, sin depender
// del modelo. El prompt se ajusto a "esta imagen es UNA ficha".
//
// Cambio v3.2 -> v3.3 (vigente): la ficha va como imagen rasterizada a 300 DPI
// (image_url, detail:high), no como PDF-archivo. La pasada de DOCUMENTOS no se
// toca — sigue con type:file y gpt-4o sobre el PDF entero, que funciona.
//
// La rasterizacion la hace el nodo HTTP "Rasterizar Ficha" (multipart al
// microservicio en http://rasterizador:8000/rasterizar?dpi=300, un run por PDF).
//
// Nota: con loop por pagina, las paginas que sean DOCUMENTOS impresos tambien
// llegan al modelo de ficha. El prompt les manda devolver hojas:[] (no inventar
// una ficha a partir de un CMR). La agregacion aguas abajo trata hojas:[] como
// "esa pagina no era ficha", no como perdida.
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
  { id: 'gpt-5.6-sol', proveedor: 'openai', wired: true, nota: 'GPT-5 vision; default de FICHAS desde 2026-08-07' },
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
// PROMPT_DOCS es copia literal del nodo v3.2 (no tocar). PROMPT_FICHAS cambio en
// v3.4: "una ficha por pagina del PDF" -> "esta imagen es UNA ficha", porque
// ahora cada llamada recibe una sola imagen. Las reglas anti-fabricacion
// (null indica el TIPO nunca 0, no inventar ano/odometros, etc.) NO cambiaron.
// El test compara byte a byte contra el fixture prompt-fichas-esperado.

var PROMPT_FICHAS = [
  'Eres un transcriptor de FICHAS DE CHOFER manuscritas de Trans. Liquidos Estevez S.L.',
  '',
  'ESTA IMAGEN ES UNA SOLA FICHA de chofer. Se reconoce por: membrete impreso TRANS. LIQUIDOS ESTEVEZ, S.L., campos CONDUCTOR / TRACTORA / REMOLQUE escritos a mano, tres bloques de viaje con FECHA DE CARGA, NOMBRE DE CARGA, LUGAR DE CARGA, TIPO DE MERCANCIA y KM, y abajo los recuadros GASTOS DEL VIAJE y OBSERVACIONES. Extrae TODOS los viajes de esta ficha.',
  '',
  'TU UNICA TAREA son las fichas manuscritas. Si esta imagen NO es una ficha manuscrita sino un documento impreso (CMR, carta de porte, albaran, orden de transporte, orden de carga, guia, ticket de bascula, autorizacion de salida, correo), devuelve hojas vacio: {"hojas":[]}. NO inventes una ficha a partir de un documento impreso.',
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
  '=== RECORTES AMPLIADOS ADJUNTOS ===',
  'Ademas de la ficha completa recibiras recortes ampliados de las zonas que mas importan, cada uno rotulado con un texto ANTES de su imagen:',
  '- "RECORTE MATRICULA": la fila CONDUCTOR / TRACTORA / REMOLQUE.',
  '- "RECORTE KM VIAJE 1|2|3": la linea KM AL INICIO DEL VIAJE / KM AL FINAL DEL VIAJE / KM RECORRIDOS del bloque de viaje 1, 2 y 3 (de arriba hacia abajo).',
  'Para la MATRICULA de la tractora y para los tres KM de cada viaje, LEE DEL RECORTE AMPLIADO correspondiente: se ve mas grande y nitido que en la ficha completa. Usa la ficha completa para el resto de los campos y para el contexto (que bloque es cual, gastos, observaciones). El recorte "KM VIAJE N" pertenece al bloque de viaje N; NO cruces valores entre viajes. Si un recorte sale en blanco o no contiene el dato, vuelve a la ficha completa para ese campo. Seguis leyendo digito por digito: el recorte ampliado no te autoriza a adivinar.',
  '',
  'REGLAS:',
  '- hojas[] debe tener EXACTAMENTE UNA entrada: la ficha de esta imagen. NO inventes fichas adicionales; NO devuelvas mas de una.',
  '- Dentro de la ficha, un elemento en bloques[] por cada bloque RELLENO (maximo 3). No inventes bloques vacios.',
  '- TRANSCRIPCION LITERAL: copia lo escrito con sus abreviaturas y faltas. No corrijas, no traduzcas, no completes.',
  '- MATRICULAS: transcribe caracter a caracter lo que ves (formato habitual 4 digitos + 3 letras, ej 2498KZL). Si una letra o cifra es dudosa, devuelve lo que lees pero NO fuerces un formato valido.',
  '- FECHAS: se escriben dd/mm/aaaa o dd-m-aa. Devuelve SIEMPRE fecha_carga_texto con lo escrito tal cual. Si el ano figura, completo o abreviado (26 = 2026), rellena tambien fecha_carga en YYYY-MM-DD. Devuelve fecha_carga null SOLO si el ano no esta escrito o no se distingue.',
  '- ODOMETROS: km_inicio es KM. AL INICIO DEL VIAJE. km_final es KM. AL FINAL DEL VIAJE. km_recorridos es KM. RECORRIDOS. Transcribe los tres TAL COMO ESTAN ESCRITOS, quitando los puntos de miles (838.163 -> 838163). Si un campo esta vacio o ilegible, null: es normal que km_recorridos falte.',
  '- CANTIDAD: el peso escrito por el chofer en kg, sin puntos de miles (23.140 -> 23140). Si no se lee, null.',
  '- GASTOS: transcribe el recuadro GASTOS DEL VIAJE por tipo (dietas, gasoleo, peajes, lavados, otros) con su importe, segun la columna EN EFECTIVO o A CREDITO. Transcribe el texto completo de OBSERVACIONES por separado, sin convertirlo en gastos.',
  '- pagina: pon 1 (esta imagen es una sola ficha; el sistema asigna el numero de pagina real del PDF).',
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
  '=== FORMATOS POR CLIENTE (los documentos de cada emisor son SIEMPRE iguales) ===',
  'Estas son las reglas exactas, sacadas de leer la documentacion real. Usalas para',
  'saber QUE CAMPO del documento va en cada dato, en vez de interpretar.',
  '',
  'FORESA — "ORDEN DE CARGA" (mail con tabla verde) y ALBARAN:',
  '  * La orden trae los campos ETIQUETADOS: LUGAR DE CARGA, LUGAR DE ENTREGA,',
  '    DESCRIPCION PRODUCTO, CANTIDAD (KG), ORDEN DE CARGA y **FACTURAR A**.',
  '  * cliente_probable = el de "FACTURAR A" (es definitivo).',
  '  * referencia = el numero de "ORDEN DE CARGA" (numero CORTO, empieza por 20 o 26).',
  '    NUNCA el que empieza por 5030.',
  'BRESFOR — "CMR/GUIA DE REMESSA":',
  '  * referencia = el numero LARGO DE 10 DIGITOS que esta al lado (ej 5050139934).',
  '  * cliente_probable = BRESFOR (es quien vende y contrata).',
  'QUIMIDROGA — "Orden de transporte" (cabecera verde):',
  '  * referencia = el valor de "Referencia en factura".',
  '  * origen = "Lugar de Carga"; destino = "Destino". cliente_probable = QUIMIDROGA.',
  '  * El "Peso neto" de la ORDEN es NOMINAL: el peso real esta en el albaran.',
  'RNM — MAIL de encargo (remitente @grupornm.pt) + "Guia de Remessa"/"Guia InterComp":',
  '  * cliente_probable = RNM (es quien encarga, aunque el albaran diga otro Cliente).',
  '  * referencia = el Numero de la Guia. origen/destino = "CARGA EN"/"DESCARGA EN" del mail.',
  'BALTRANSA — "ORDEN DE TRANSPORTE nnn.nnn":',
  '  * referencia = ese numero. cliente_probable = BALTRANSA.',
  '  * trae "PRECIO: n.nnn,nn EU" -> ponelo en importe (es viaje cotizado).',
  'TRANSTAMBRE — "ORDEN DE TRANSPORTE" con DATOS DE CARGA / DATOS DE DESCARGA:',
  '  * cliente_probable = TRANSTAMBRE. Trae "PRECIO: nnnn EUR/VIAJE + n,nn % INDEX GASOIL".',
  'QUIMICAS DEL JARAMA — "Pedido de Compras" (PROVEEDOR: TL ESTEVEZ) + ALBARAN:',
  '  * cliente_probable = QUIMICAS DEL JARAMA. referencia = el numero de ALBARAN.',
  '',
  '=== QUIEN ES EL CLIENTE (regla general) ===',
  'El cliente es QUIEN ENCARGA EL TRANSPORTE: aquel en cuyo documento TLE (TRANS.',
  'LIQUIDOS ESTEVEZ) figura como PROVEEDOR, TRANSPORTISTA CONTRATADO o TRANSPORTISTA',
  'EFECTIVO. Prioridad: orden/pedido/mail de encargo > guia o albaran del vendedor >',
  'CMR o carta de porte (ultimo recurso).',
  'ERRORES REALES QUE NO DEBES REPETIR:',
  '  (a) El "Cliente/Customer" impreso en el albaran del proveedor es el cliente DE',
  '      ELLOS, no de TLE. En un albaran de RNM figura "Cliente: BIOETANOL GALICIA":',
  '      el cliente sigue siendo RNM, que encargo el transporte.',
  '  (b) El REMITENTE del CMR (recuadro 1) tampoco es el cliente. Se devolvio',
  '      CELLMARK (dueño sueco de la carga) en un viaje que habia encargado RNM.',
  '  (c) "Mercancia por cuenta de" es el dueño de la carga, no quien contrata.',
  'Un mismo viaje puede tener CINCO empresas distintas (cargador, expedidor, agencia,',
  'destinatario, transportista) y solo UNA es el cliente. Ante la duda, null.',
  '',
  '=== ORIGEN Y DESTINO: el campo ETIQUETADO, nunca el domicilio ===',
  'origen = "Lugar de Carga" / "CARGA EN" / "Local Carga" / "Planta cargadora" /',
  '  recuadro 4 del CMR ("Lugar y fecha de carga de la mercancia").',
  'destino = "Destino" / "DESCARGA EN" / "Lugar de entrega" / recuadro 3 del CMR.',
  'PROHIBIDO usar el domicilio social del remitente (recuadro 1 del CMR): de ahi salio',
  '"CELLMARK AB, SE-001 18967, SUECIA" como origen de una carga hecha en Barcelona.',
  'Devuelve el texto del campo COMPLETO (con direccion si la trae): el sistema extrae',
  'la localidad. Los puertos y plantas suelen escribirse con su nombre legal',
  '(GAFANHA DA NAZARE = Aveiro; SAN JUAN DE NIEVA = Aviles): transcribilo tal cual.',
  '',
  'CAMPOS:',
  '- matricula_tractor y matricula_remolque TAL COMO figuran (ej 2498KZL, R1007BCV). Buscalas en Tractor, Vehiculo tractor, Cabeza, Matricula, Plataforma, Cisterna portatil, Reboque. Es el dato mas importante del documento: si no aparece, null.',
  '  ATENCION MATRICULAS (errores reales cometidos): (a) suelen venir con el PAIS delante, pegado o con espacio: "Vehiculo tractor: ES 0332LPL", "Vehiculo tractor:ES 0332LPL", "ES 7347LBB". ESO ES UNA MATRICULA: devuelve solo la parte de matricula (0332LPL, 7347LBB), SIN el prefijo ES/PT. NO devuelvas null por el prefijo. (b) NO pierdas el CERO INICIAL: si lees "0332-LPL" devuelve 0332LPL, nunca 332LPL. La matricula espanola son 4 digitos + 3 letras: si te salen 3 digitos, releela, falta un digito. (c) puede estar MANUSCRITA en un recuadro del CMR (recuadro 18 Reservas u observaciones): tambien vale, transcribela igual.',
  '  ATENCION FECHAS: estos documentos son del ano en curso. Se han devuelto fechas con el ANO equivocado (2020 en vez de 2026) leyendo mal el ultimo digito. Lee el ano digito por digito; si no lo distingues con seguridad, devuelve fecha null en vez de un ano inventado.',
  '- referencia segun el emisor: FORESA -> el numero CORTO que empieza por 20 arriba a la derecha del CMR/ALBARAN (ej 2009926), NUNCA el que empieza por 5030. QUIMIDROGA -> el valor de "Referencia en factura". RNM -> el Numero de la Guia. HELM -> el numero que la orden pide incluir en factura. BALTRANSA -> el numero de ORDEN DE CARGA. Ticket de bascula -> el Nº Ticket.',
  '- fecha: la de carga o expedicion que figura en el documento, YYYY-MM-DD.',
  '- material: transcripcion LITERAL de la denominacion de la mercancia, caracter a caracter. En mercancia peligrosa (ADR) copia la linea legal completa tal cual.',
  '  ATENCION MATERIAL (errores reales): se devolvio "Resorcinol" cuando el albaran decia "FORESA RES 0201", y "LATEX-PLAST CD 390 BULK" cuando decia "VINKA PLAST QD 390". NO traduzcas, NO interpretes el nombre comercial ni lo sustituyas por el nombre quimico que te parezca: COPIA los caracteres que ves, incluidos codigos y numeros de producto (RES 0201, QD 390). Si no podes leer el nombre completo con seguridad, devuelve null.',
  '- origen = LUGAR DE CARGA (donde se toma la mercancia). destino = LUGAR DE ENTREGA/DESCARGA (direccion del DESTINATARIO/consignatario). En el CMR son recuadros DISTINTOS: "Lugar de carga / Taking over the goods" es el ORIGEN; "Lugar de entrega / Delivery" (o el destinatario del recuadro 2) es el DESTINO. NUNCA uses el pueblo, puerto o terminal de CARGA como destino (ej.: carga en "Gafanha da Nazare / Puerto de Aveiro" con entrega en Asturias -> origen Aveiro, destino Asturias; NO al reves). En albaran/guia: origen = cargador/expedidor/lugar de expedicion; destino = cliente destinatario / direccion de entrega. Transcribe tal como figuran, NO completes provincia ni pais.',
  '- kg_neto: el PESO NETO en kilogramos. Si el documento solo trae bruto y tara, devuelve el neto solo si esta impreso; no lo restes tu.',
  '  El peso que vale es el del documento de CARGA (albaran del cargador, guia de remessa, ticket de bascula de origen). El peso de la ORDEN es nominal/pedido, no real: si el documento es una orden de transporte, devuelve kg_neto null salvo que traiga un peso medido.',
  '- importe y tarifa_tn solo si el documento indica explicitamente el precio del transporte. BALTRANSA lo pone como PRECIO en la cabecera: si trae sufijo /TN o EU/TN es tarifa_tn, si no lleva sufijo es importe. HELM lo pone como Coste de transporte (importe). Si no hay precio, ambos null.',
  '- cliente_probable: quien CONTRATA el transporte, no el destinatario. TEPSA es planta cargadora de QUIMIDROGA. FINSA, Orember, Cella son destinos de FORESA. DROVI, Drogas Vigo, Compogal, Ence Navia son destinatarios. Si el membrete es Baltransa, el cliente es BALTRANSA. Si no lo reconoces, null.',
  '  ATENCION CLIENTE (error real): en un CMR con remitente CELLMARK AB (Suecia) y destinatario RNM PRODUTOS QUIMICOS se devolvio CELLMARK como cliente; el cliente correcto era RNM, que es quien encargo el transporte (habia un mail de RNM pidiendolo). El REMITENTE/expedidor de la mercancia NO es necesariamente el cliente: puede ser solo el dueño de la carga. Si el envio incluye un correo o una orden pidiendo el transporte, el cliente es QUIEN LO PIDE. Ante la duda entre remitente y destinatario, devuelve null antes que un cliente equivocado.',
  '  ATENCION ORIGEN (error real): en ese mismo CMR se devolvio como origen "CELLMARK AB, SE-001 18967, SUECIA" (el domicilio social del remitente) cuando la carga se hizo en Barcelona (la PLANTA CARGADORA que figura en el documento). El origen es el LUGAR FISICO donde se carga la cisterna, nunca el domicilio social de una empresa extranjera. Busca "Planta cargadora", "Lugar de carga", "Lugar de origen del transporte".',
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

// NOTA (ejec. 930): se probo reasoning_effort:'minimal' + max_completion_tokens
// 6000 para acelerar/abaratar el razonador. Con la MISMA ficha de 1 pagina que en
// 921 (97 s OK), la llamada se colgo >180 s y el nodo la reintento 5x (8 min, ~1
// EUR sin resultado): el endpoint de gpt-5.6-sol NO digiere ese combo. Revertido
// al config que funciona (sin reasoning_effort, max_completion_tokens 16000). La
// latencia/costo del razonador se ataca por otra via (config de reintentos del
// nodo HTTP + decision de modelo), no desde aca.
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

var USER_TEXT_FICHAS = 'Transcribe la ficha de chofer manuscrita de esta imagen, revisando sus tres bloques de viaje. Si esta imagen es un documento impreso y no una ficha, devuelve {"hojas":[]}. Si un campo no se lee con seguridad, devuelve null en vez de adivinar.';
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

/**
 * Loop por pagina: un item de payload por imagen rasterizada. Cada uno lleva UNA
 * sola imagen -> una llamada -> una ficha. Ese es el corazon del arreglo v3.4:
 * con una imagen por llamada es imposible perder una ficha, sin depender del
 * modelo. `pagina` (1-indexed) viaja en el item para que la agregacion aguas
 * abajo le asigne el numero de pagina real a la ficha.
 *
 * @returns {Array<{pass:'fichas', pagina:number, modelo:string, payload:object}>}
 */
function armarItemsFichaPorPagina(modelo, pngB64Array, hint) {
  var items = [];
  for (var i = 0; i < pngB64Array.length; i++) {
    var b64 = pngB64Array[i];
    if (!b64) continue;
    var adjuntos = adjuntosImagenesDesdePng([b64]);
    items.push({
      pass: 'fichas',
      pagina: i + 1,
      modelo: modelo,
      payload: armarPayloadFichas(modelo, adjuntos, hint),
    });
  }
  return items;
}

// --- B.1: recorte por banda ------------------------------------------------
//
// La ficha es un formulario de layout fijo. Los campos que facturan (matricula,
// km de cada viaje) viven en bandas horizontales estables, derivadas del raster
// real a 300 DPI (ver README del rasterizador). El nodo HTTP "Rasterizar Ficha"
// llama a /rasterizar-regiones con estas bandas (sin `pagina` -> se aplican a
// todas las paginas) e incluir_pagina_completa=true, asi cada pagina vuelve con
// la imagen completa (contexto) + los recortes ampliados de sus bandas.
//
// REGIONES_FICHA es la fuente de verdad de las coordenadas: el body del nodo
// HTTP debe ser exactamente JSON.stringify(REGIONES_FICHA) (test lo verifica).
var REGIONES_FICHA = [
  { nombre: 'band_matricula', x0: 0.03, y0: 0.150, x1: 0.99, y1: 0.212 },
  { nombre: 'km_v1', x0: 0.04, y0: 0.300, x1: 0.99, y1: 0.345 },
  { nombre: 'km_v2', x0: 0.04, y0: 0.435, x1: 0.99, y1: 0.478 },
  { nombre: 'km_v3', x0: 0.04, y0: 0.572, x1: 0.99, y1: 0.616 },
];

// Rotulo de cada banda (texto que precede a su imagen en el content) y orden.
var BANDAS_FICHA_LABEL = {
  band_matricula: 'RECORTE MATRICULA (fila CONDUCTOR / TRACTORA / REMOLQUE)',
  km_v1: 'RECORTE KM VIAJE 1',
  km_v2: 'RECORTE KM VIAJE 2',
  km_v3: 'RECORTE KM VIAJE 3',
};
var BANDAS_FICHA_ORDEN = ['band_matricula', 'km_v1', 'km_v2', 'km_v3'];

/**
 * Content parts (texto + imagen intercalados) de UNA pagina de la respuesta de
 * /rasterizar-regiones: primero la ficha completa rotulada, luego cada banda con
 * su rotulo. Una banda `parece_vacio` (escaneo desplazado -> crop en blanco) se
 * OMITE: el modelo cae en la ficha completa para ese campo (fallback B.1). Se
 * lee digito por digito igual; el recorte amplia, no autoriza a adivinar.
 * @param {{png_base64:string, regiones?:Array<{nombre,png_base64,parece_vacio}>}} pagina
 */
function adjuntosFichaConBandas(pagina) {
  var out = [];
  if (pagina && pagina.png_base64) {
    out.push({ type: 'text', text: 'FICHA COMPLETA:' });
    out.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + pagina.png_base64, detail: 'high' } });
  }
  var porNombre = {};
  var regs = (pagina && Array.isArray(pagina.regiones)) ? pagina.regiones : [];
  for (var i = 0; i < regs.length; i++) { if (regs[i] && regs[i].nombre) { porNombre[regs[i].nombre] = regs[i]; } }
  for (var k = 0; k < BANDAS_FICHA_ORDEN.length; k++) {
    var nombre = BANDAS_FICHA_ORDEN[k];
    var r = porNombre[nombre];
    if (!r || !r.png_base64 || r.parece_vacio) { continue; }
    out.push({ type: 'text', text: (BANDAS_FICHA_LABEL[nombre] || nombre) + ':' });
    out.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + r.png_base64, detail: 'high' } });
  }
  return out;
}

/**
 * Aplana las paginas de N respuestas de /rasterizar-regiones en orden,
 * conservando la imagen completa y las regiones de cada una.
 * @returns {Array<{png_base64:string, regiones:Array}>}
 */
function concatPaginasConRegiones(respuestasRast) {
  var out = [];
  for (var i = 0; i < respuestasRast.length; i++) {
    var r = respuestasRast[i] || {};
    var paginas = Array.isArray(r.paginas) ? r.paginas : [];
    for (var j = 0; j < paginas.length; j++) {
      var p = paginas[j];
      if (p && p.png_base64) { out.push({ png_base64: p.png_base64, regiones: Array.isArray(p.regiones) ? p.regiones : [] }); }
    }
  }
  return out;
}

/**
 * Loop por pagina con bandas (B.1): un item de payload por pagina, cada uno con
 * la ficha completa + los recortes ampliados de sus bandas. Mantiene la garantia
 * v3.4 (una imagen-pagina por llamada -> imposible perder una ficha) y agrega la
 * lectura sobre banda ampliada para los campos que facturan.
 * @returns {Array<{pass:'fichas', pagina:number, modelo:string, payload:object}>}
 */
function armarItemsFichaPorPaginaConBandas(modelo, paginas, hint) {
  var items = [];
  for (var i = 0; i < paginas.length; i++) {
    var pagina = paginas[i];
    if (!pagina || !pagina.png_base64) { continue; }
    var adjuntos = adjuntosFichaConBandas(pagina);
    items.push({
      pass: 'fichas',
      pagina: i + 1,
      modelo: modelo,
      payload: armarPayloadFichas(modelo, adjuntos, hint),
    });
  }
  return items;
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
    armarItemsFichaPorPagina: armarItemsFichaPorPagina,
    armarPayloadDocs: armarPayloadDocs,
    concatPaginasRasterizadas: concatPaginasRasterizadas,
    componerHint: componerHint,
    REGIONES_FICHA: REGIONES_FICHA,
    BANDAS_FICHA_LABEL: BANDAS_FICHA_LABEL,
    BANDAS_FICHA_ORDEN: BANDAS_FICHA_ORDEN,
    adjuntosFichaConBandas: adjuntosFichaConBandas,
    concatPaginasConRegiones: concatPaginasConRegiones,
    armarItemsFichaPorPaginaConBandas: armarItemsFichaPorPaginaConBandas,
  };
}

// Envoltorio de n8n para el nodo Code "Preparar Payload" del workflow
// [ESTEVEZ] Ingesta Viaje — WD0q9Ic0oDvUoJwp.
//
// Entrada: los items de "Rasterizar Ficha" (una respuesta del microservicio por
// PDF, con paginas[]). El base64 de los adjuntos para la pasada de documentos NO
// se lee de aca: viene ya resuelto en `archivos`, desde "Preparar Rasterizacion"
// (ver ese nodo: getBinaryDataBuffer resuelve contra la entrada del nodo actual,
// que aca ya no tiene binarios; leer binary[key].data devuelve "filesystem-v2").
//
// Salida (v3.4 — loop por pagina): N+1 items.
//   - N items pass:'fichas', uno por pagina rasterizada, cada uno con UNA imagen.
//   - 1 item  pass:'documentos', el PDF entero como type:file.
// "Extraer GPT-4o" corre una vez por item -> una llamada de ficha por pagina.
// "Formatear Linea Gesruta" reagrupa por indice contra $('Preparar Payload').

// ===== MODELO DE FICHAS =====
// Swap 2026-08-07 (encargo swap-modelo-lectura-gpt5): el lector de FICHAS
// manuscritas pasa de gpt-4o a GPT-5 con vision. gpt-4o (y 4o-mini, 4.1) fallan
// el origen/destino manuscrito -> factura no emitible ("Avello/Becerra" por
// "Aveiro/Begega"). Elegido: gpt-5.6-sol, el GPT-5 con vision mas capaz al que
// la cuenta tiene acceso (verificado con /v1/models + llamada de prueba de vision
// 2026-08-07: acepta el mismo shape chat/completions con image_url,
// max_completion_tokens y response_format json_object). El esquema de salida NO
// cambia; mkPayloadOpenAI ya rutea gpt-5* por max_completion_tokens (esRazonadorOpenAI).
// Se puede pisar por corrida con `modelo_fichas` en el body del webhook (barrido
// / A-B de idoneidad y de costo). El nodo HTTP en la UI se sigue llamando
// "Extraer GPT-4o" -- es solo el nombre, el modelo lo define este payload.
//
// DOCS (impresos) siguen en gpt-4o: leen bien lo impreso; el bloqueante era el
// manuscrito. Se puede subir aparte si hiciera falta.
const MODELO_FICHAS = 'gpt-5.6-sol';
const MODELO_DOCS = 'gpt-4o';

const hook = $('Hook Viaje').first();
const body = (hook.json && hook.json.body) ? hook.json.body : {};
const empresaHint = body['Empresa'] || hook.json['Empresa'] || '';
const notas = body['Notas'] || hook.json['Notas'] || '';

// Override por corrida, para el barrido sin tocar el nodo.
const modeloFichas = body['modelo_fichas'] || MODELO_FICHAS;

// --- Pasada A: una llamada por pagina rasterizada, con bandas ampliadas -----
// "Rasterizar Ficha" llama a /rasterizar-regiones (incluir_pagina_completa=true),
// asi cada pagina vuelve con la imagen completa (contexto) + los recortes de sus
// bandas (matricula, km_v1/v2/v3). B.1: los campos que facturan se leen sobre la
// banda ampliada, no sobre la A4 entera.
// NOTA: la entrada directa de este nodo ya no es "Rasterizar Ficha" (ahora la rama
// Document AI corre en el medio), asi que las paginas rasterizadas se leen por
// referencia explicita a "Rasterizar Ficha", no de $input.
const respuestasRast = $('Rasterizar Ficha').all().map(function (it) { return it.json || {}; });
const paginas = concatPaginasConRegiones(respuestasRast);
if (paginas.length === 0) {
  throw new Error('El rasterizador no devolvio ninguna pagina. La ficha NO se puede leer sobre PDF-archivo (rinde mal en manuscrito); se aborta en vez de degradar en silencio.');
}
const hint = componerHint(empresaHint, notas);
const itemsFicha = armarItemsFichaPorPaginaConBandas(modeloFichas, paginas, hint);

// --- Pasada B: adjuntos originales, con el base64 leido aguas arriba --------
const archivos = ($('Preparar Rasterizacion').first().json || {}).archivos || [];
if (archivos.length === 0) {
  throw new Error('No llegaron los adjuntos para la pasada de documentos (Preparar Rasterizacion no devolvio `archivos`).');
}
const adjuntosDocs = adjuntosDocsDesdeArchivos(archivos);

logInfo('modelo_fichas=' + modeloFichas + ' modelo_docs=' + MODELO_DOCS +
  ' llamadas_ficha=' + itemsFicha.length + ' (una por pagina) archivos=' + archivos.length);

// N items de ficha (uno por pagina) + 1 de documentos, en ese orden.
const out = [];
for (const it of itemsFicha) {
  out.push({ json: { pass: 'fichas', pagina: it.pagina, modelo: it.modelo, payload: it.payload } });
}
out.push({ json: { pass: 'documentos', modelo: MODELO_DOCS, payload: armarPayloadDocs(MODELO_DOCS, adjuntosDocs, hint) } });
return out;
