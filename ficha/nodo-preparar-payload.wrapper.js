// Envoltorio de n8n para el nodo Code "Preparar Payload" del workflow
// [ESTEVEZ] Ingesta Viaje — WD0q9Ic0oDvUoJwp.
//
// Entrada: los items de "Rasterizar Ficha" (una respuesta del microservicio por
// PDF de entrada). El binario original se relee de "Hook Viaje" para la pasada
// de documentos, que sigue yendo como type:file.
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
const bins = hook.binary || {};
const body = (hook.json && hook.json.body) ? hook.json.body : {};
const empresaHint = body['Empresa'] || hook.json['Empresa'] || '';
const notas = body['Notas'] || hook.json['Notas'] || '';

// Override por corrida, para el barrido sin tocar el nodo.
const modeloFichas = body['modelo_fichas'] || MODELO_FICHAS;

const keys = Object.keys(bins);
if (keys.length === 0) { throw new Error('No se recibieron archivos'); }

// --- Pasada A: paginas rasterizadas -> image_url ---------------------------
const respuestasRast = $input.all().map(function (it) { return it.json || {}; });
const pngs = concatPaginasRasterizadas(respuestasRast);
if (pngs.length === 0) {
  throw new Error('El rasterizador no devolvio ninguna pagina. La ficha NO se puede leer sobre PDF-archivo (rinde mal en manuscrito); se aborta en vez de degradar en silencio.');
}
const adjuntosFicha = adjuntosImagenesDesdePng(pngs);

// --- Pasada B: archivos originales (PDF como file, sin cambios) ------------
const archivos = [];
for (const key of keys) {
  const b = bins[key];
  let buf;
  try { buf = await this.helpers.getBinaryDataBuffer(0, key); }
  catch (e1) { if (b.data) { buf = Buffer.from(b.data, 'base64'); } else { throw new Error('No se pudo leer el binario ' + key); } }
  archivos.push({ nombre: b.fileName || (key + '.pdf'), mime: (b.mimeType || '').toLowerCase(), b64: buf.toString('base64') });
}
const adjuntosDocs = adjuntosDocsDesdeArchivos(archivos);

const hint = componerHint(empresaHint, notas);

logInfo('modelo_fichas=' + modeloFichas + ' modelo_docs=' + MODELO_DOCS +
  ' paginas_rasterizadas=' + pngs.length + ' archivos=' + archivos.length);

return [
  { json: { pass: 'fichas', modelo: modeloFichas, paginas_rasterizadas: pngs.length, payload: armarPayloadFichas(modeloFichas, adjuntosFicha, hint) } },
  { json: { pass: 'documentos', modelo: MODELO_DOCS, payload: armarPayloadDocs(MODELO_DOCS, adjuntosDocs, hint) } }
];
