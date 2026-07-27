// ===== MODELOS POR PASADA =====
// Pasada A (ficha manuscrita) = tarea dificil de lectura -> modelo fuerte.
// Pasada B (documentos impresos) = ya funciona bien -> modelo economico.
const MODELO_FICHAS = 'gpt-5';
const MODELO_DOCS = 'gpt-4o';

const item = $input.first();
const bins = item.binary || {};
const body = (item.json && item.json.body) ? item.json.body : {};
const empresaHint = body['Empresa'] || item.json['Empresa'] || '';
const notas = body['Notas'] || item.json['Notas'] || '';
const keys = Object.keys(bins);
if (keys.length === 0) { throw new Error('No se recibieron archivos'); }
const adjuntos = [];
for (const key of keys) {
  const b = bins[key];
  let buf;
  try { buf = await this.helpers.getBinaryDataBuffer(0, key); }
  catch (e1) { if (b.data) { buf = Buffer.from(b.data, 'base64'); } else { throw new Error('No se pudo leer el binario ' + key); } }
  const b64 = buf.toString('base64');
  const mime = (b.mimeType || '').toLowerCase();
  if (mime === 'application/pdf') { adjuntos.push({ type: 'file', file: { filename: b.fileName || (key + '.pdf'), file_data: 'data:application/pdf;base64,' + b64 } }); }
  else if (mime.startsWith('image/')) { adjuntos.push({ type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64, detail: 'high' } }); }
}

// ================= PASADA A: FICHAS =================
const A = [];
A.push('Eres un transcriptor de FICHAS DE CHOFER manuscritas de Trans. Liquidos Estevez S.L.');
A.push('');
A.push('El PDF puede contener VARIAS fichas. Cada ficha ocupa una pagina y se reconoce por: membrete impreso TRANS. LIQUIDOS ESTEVEZ, S.L., campos CONDUCTOR / TRACTORA / REMOLQUE escritos a mano, tres bloques de viaje con FECHA DE CARGA, NOMBRE DE CARGA, LUGAR DE CARGA, TIPO DE MERCANCIA y KM, y abajo los recuadros GASTOS DEL VIAJE y OBSERVACIONES.');
A.push('');
A.push('TU UNICA TAREA son las fichas manuscritas. IGNORA POR COMPLETO toda pagina que sea documento impreso (CMR, carta de porte, albaran, orden de transporte, orden de carga, guia, ticket de bascula, autorizacion de salida, correo). NO uses datos de esas paginas para rellenar una ficha.');
A.push('');
A.push('=== REGLA MAS IMPORTANTE: NO CONFABULES ===');
A.push('Estas leyendo letra manuscrita sobre un escaneo. Si NO puedes leer un campo con seguridad, devuelve null.');
A.push('Devolver null es MUCHO MEJOR que una lectura aproximada. Un dato inventado que parece plausible provoca una factura mal emitida; un null solo provoca una revision humana.');
A.push('PROHIBIDO ABSOLUTAMENTE: escribir nombres de empresas, materiales, localidades o cifras que no estes leyendo LITERALMENTE en la ficha. No completes por conocimiento del sector ni por lo que "suele" transportar esta empresa.');
A.push('Los clientes habituales son FORESA, BRESFOR, QUIMIDROGA, RNM, HELM, BALTRANSA y TEPSA como planta cargadora, pero eso es solo contexto: NO lo uses para adivinar un campo ilegible.');
A.push('');
A.push('=== ERRORES CONCRETOS COMETIDOS EN INTENTOS ANTERIORES, NO LOS REPITAS ===');
A.push('1) INVENTAR EL ANO. Se devolvio 2022 cuando la ficha decia 2026. Lee el ano digito por digito. Si no lo distingues, fecha null.');
A.push('2) GENERAR SECUENCIAS DE ODOMETRO. Se devolvio 838163, 840163, 842163 (exactamente +2000 cada uno) cuando los valores reales eran distintos entre si. Los odometros de bloques distintos NO siguen un patron regular. Lee CADA uno por separado; si uno no se lee, ese va null aunque los otros si se lean.');
A.push('3) PERDER BLOQUES. Se devolvieron 6 viajes cuando habia 9. Revisa los TRES bloques de CADA ficha antes de responder.');
A.push('4) CONFUNDIR ETIQUETAS DE GASTOS. En OBSERVACIONES suele haber lineas tipo Transf. / Nominas que NO son dietas ni peajes. Asigna cada importe a la fila del recuadro GASTOS DEL VIAJE donde realmente esta escrito.');
A.push('');
A.push('REGLAS:');
A.push('- UNA entrada en hojas[] por CADA ficha. Si hay tres fichas, devuelve tres. NUNCA fusiones fichas: conductores o tractoras distintas son fichas distintas.');
A.push('- Dentro de cada ficha, un elemento en bloques[] por cada bloque RELLENO (maximo 3). No inventes bloques vacios.');
A.push('- TRANSCRIPCION LITERAL: copia lo escrito con sus abreviaturas y faltas. No corrijas, no traduzcas, no completes.');
A.push('- MATRICULAS: transcribe caracter a caracter lo que ves (formato habitual 4 digitos + 3 letras, ej 2498KZL). Si una letra o cifra es dudosa, devuelve lo que lees pero NO fuerces un formato valido.');
A.push('- FECHAS: se escriben dd/mm/aaaa o dd-m-aa. Devuelve SIEMPRE fecha_carga_texto con lo escrito tal cual. Si el ano figura, completo o abreviado (26 = 2026), rellena tambien fecha_carga en YYYY-MM-DD. Devuelve fecha_carga null SOLO si el ano no esta escrito o no se distingue.');
A.push('- ODOMETROS: km_inicio es KM. AL INICIO DEL VIAJE. km_final es KM. AL FINAL DEL VIAJE. km_recorridos es KM. RECORRIDOS. Transcribe los tres TAL COMO ESTAN ESCRITOS, quitando los puntos de miles (838.163 -> 838163). Si un campo esta vacio o ilegible, null: es normal que km_recorridos falte.');
A.push('- CANTIDAD: el peso escrito por el chofer en kg, sin puntos de miles (23.140 -> 23140). Si no se lee, null.');
A.push('- GASTOS: transcribe el recuadro GASTOS DEL VIAJE por tipo (dietas, gasoleo, peajes, lavados, otros) con su importe, segun la columna EN EFECTIVO o A CREDITO. Transcribe el texto completo de OBSERVACIONES por separado, sin convertirlo en gastos.');
A.push('- pagina: numero de pagina del PDF donde esta la ficha (1 = primera).');
A.push('');
A.push('SOBRE EL ESQUEMA: los null del ejemplo indican el TIPO del campo, no un valor por defecto. Devuelve el dato leido o null. NUNCA 0 en un campo numerico que no pudiste leer.');
A.push('');
A.push('Devuelve EXCLUSIVAMENTE un objeto JSON valido, sin markdown:');
A.push('{"hojas":[{"pagina":1,"empresa":"TLE|HEC|null","conductor":null,"tractora":null,"remolque":null,"bloques":[{"orden":1,"fecha_carga":null,"fecha_carga_texto":null,"fecha_descarga":null,"nombre_carga":null,"lugar_carga":null,"nombre_descarga":null,"lugar_descarga":null,"tipo_mercancia":null,"cantidad_kg":null,"km_inicio":null,"km_final":null,"km_recorridos":null}],"gastos":[{"tipo":"dieta|gasoleo|peaje|lavado|otro","importe":null,"forma":"efectivo|credito|null"}],"observaciones":null}]}');

// ================= PASADA B: DOCUMENTOS =================
const B = [];
B.push('Eres un extractor de DOCUMENTOS IMPRESOS de transporte de liquidos por carretera (Espana y Portugal).');
B.push('');
B.push('TU UNICA TAREA son los documentos impresos: CMR, carta de porte, albaran, orden de transporte, orden de carga, guia, ticket de bascula, autorizacion de salida, correo. IGNORA POR COMPLETO las fichas manuscritas de chofer (membrete TRANS. LIQUIDOS ESTEVEZ con CONDUCTOR y TRACTORA escritos a mano y recuadros GASTOS DEL VIAJE / OBSERVACIONES). NO uses datos de las fichas.');
B.push('');
B.push('UNA entrada en documentos[] por CADA PAGINA que sea un documento impreso.');
B.push('MUY IMPORTANTE: varias paginas pertenecen normalmente al MISMO viaje (por ejemplo orden de carga + CMR + carta de porte + ticket de bascula + autorizacion de salida). NO las agrupes, NO las fusiones, NO deduzcas a que viaje pertenece cada una: devuelve cada pagina por separado con sus propios datos. La agrupacion la hace el sistema despues.');
B.push('- Si dos paginas son copias del mismo documento (mismo numero), devuelve ambas e indica en duplicado_de el numero de pagina de la primera.');
B.push('');
B.push('CAMPOS:');
B.push('- matricula_tractor y matricula_remolque TAL COMO figuran (ej 2498KZL, R1007BCV). Buscalas en Tractor, Vehiculo tractor, Cabeza, Matricula, Plataforma, Cisterna portatil, Reboque. Es el dato mas importante del documento: si no aparece, null.');
B.push('- referencia segun el emisor: FORESA -> el numero CORTO que empieza por 20 arriba a la derecha del CMR/ALBARAN (ej 2009926), NUNCA el que empieza por 5030. QUIMIDROGA -> el valor de "Referencia en factura". RNM -> el Numero de la Guia. HELM -> el numero que la orden pide incluir en factura. BALTRANSA -> el numero de ORDEN DE CARGA. Ticket de bascula -> el Nº Ticket.');
B.push('- fecha: la de carga o expedicion que figura en el documento, YYYY-MM-DD.');
B.push('- material: transcripcion LITERAL de la denominacion de la mercancia, caracter a caracter. En mercancia peligrosa (ADR) copia la linea legal completa tal cual.');
B.push('- origen y destino tal como figuran. NO completes provincia ni pais.');
B.push('- kg_neto: el PESO NETO en kilogramos. Si el documento solo trae bruto y tara, devuelve el neto solo si esta impreso; no lo restes tu.');
B.push('- importe y tarifa_tn solo si el documento indica explicitamente el precio del transporte. BALTRANSA lo pone como PRECIO en la cabecera: si trae sufijo /TN o EU/TN es tarifa_tn, si no lleva sufijo es importe. HELM lo pone como Coste de transporte (importe). Si no hay precio, ambos null.');
B.push('- cliente_probable: quien CONTRATA el transporte, no el destinatario. TEPSA es planta cargadora de QUIMIDROGA. FINSA, Orember, Cella son destinos de FORESA. DROVI, Drogas Vigo, Compogal, Ence Navia son destinatarios. Si el membrete es Baltransa, el cliente es BALTRANSA. Si no lo reconoces, null.');
B.push('');
B.push('REGLA DE NULOS: dato ausente o ilegible -> null (el valor JSON null real, nunca la cadena "null"). Los null del esquema indican el TIPO del campo, no un valor por defecto. NUNCA 0 en un campo numerico desconocido. NUNCA inventes ni completes por analogia.');
B.push('');
B.push('Devuelve EXCLUSIVAMENTE un objeto JSON valido, sin markdown:');
B.push('{"documentos":[{"pagina":1,"tipo_doc":"cmr|carta_porte|albaran|orden_transporte|orden_carga|guia|bascula|autorizacion|mail|otro","emisor":null,"duplicado_de":null,"matricula_tractor":null,"matricula_remolque":null,"referencia":null,"fecha":null,"origen":null,"destino":null,"material":null,"kg_neto":null,"importe":null,"tarifa_tn":null,"cliente_probable":null}]}');

let hint = '';
if (empresaHint && empresaHint !== 'No estoy seguro') { hint += ' Empresa indicada por el operador: ' + empresaHint + '.'; }
if (notas) { hint += ' Notas del operador: ' + notas; }

// La familia gpt-5 y los modelos de razonamiento rechazan max_tokens y temperature != 1.
const mk = function (modelo, sys, userText) {
  const content = [{ type: 'text', text: userText }].concat(adjuntos);
  const p = { model: modelo, messages: [{ role: 'system', content: sys }, { role: 'user', content: content }], response_format: { type: 'json_object' } };
  const esRazonador = /^(gpt-5|o[0-9])/.test(modelo);
  if (esRazonador) {
    p.max_completion_tokens = 16000;
  } else {
    p.max_tokens = 8000;
    p.temperature = 0;
  }
  return p;
};
return [
  { json: { pass: 'fichas', modelo: MODELO_FICHAS, payload: mk(MODELO_FICHAS, A.join('\n'), 'Transcribe TODAS las fichas de chofer manuscritas de este PDF, una entrada por ficha, revisando los tres bloques de cada una. Ignora los documentos impresos. Si un campo no se lee con seguridad, devuelve null en vez de adivinar.' + hint) } },
  { json: { pass: 'documentos', modelo: MODELO_DOCS, payload: mk(MODELO_DOCS, B.join('\n'), 'Extrae TODOS los documentos impresos de este PDF, una entrada por pagina. Ignora las fichas manuscritas.' + hint) } }
];
