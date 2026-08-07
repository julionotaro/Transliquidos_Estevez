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
// gpt-4o es el lector de produccion desde el §8 del encargo lectura-confiable
// (29/07/2026): sobre banda ampliada (B.1) lee 5/9 OK todos correctos y sus
// misreads rompen la consistencia -> los caza la guarda, cero OK malo oculto.
// mini quedo fuera del proceso: sobre banda igual leia mal digitos legibles
// (techo de capacidad del modelo). Se puede pisar por corrida con `modelo_fichas`
// en el body del webhook (lo usa el barrido/pruebas de idoneidad).
const MODELO_FICHAS = 'gpt-4o';
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
const respuestasRast = $input.all().map(function (it) { return it.json || {}; });
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
