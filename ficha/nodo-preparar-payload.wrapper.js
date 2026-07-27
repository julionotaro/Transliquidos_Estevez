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
