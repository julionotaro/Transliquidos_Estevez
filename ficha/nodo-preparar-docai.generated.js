// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/nodo-preparar-docai.wrapper.js
// Contenido exacto del nodo Code "Preparar DocAI" (WD0q9Ic0oDvUoJwp).

// Nodo Code "Preparar DocAI" del workflow [ESTEVEZ] Ingesta Viaje (WD0q9Ic0oDvUoJwp).
//
// Arma UNA llamada a Document AI por PAGINA (modalidad B: pagina completa + bbox).
// Entrada directa: la salida de "Rasterizar Ficha" (/rasterizar-regiones con
// incluir_pagina_completa=true) — una respuesta por PDF con paginas[].png_base64.
//
// El numero de `pagina` que se emite debe coincidir con el `pagina_origen` que el
// correlacionador le asigna al viaje: es el indice secuencial (1-based) sobre las
// paginas CON imagen, en orden de llegada — exactamente como lo numera
// concatPaginasConRegiones/armarItemsFichaPorPaginaConBandas en "Preparar Payload".

const respuestas = $input.all().map(function (it) { return it.json || {}; });
const out = [];
let n = 0;
for (const r of respuestas) {
  const paginas = Array.isArray(r.paginas) ? r.paginas : [];
  for (const p of paginas) {
    if (!p || !p.png_base64) { continue; }
    n++;
    out.push({ json: { pagina: n, body: { rawDocument: { content: p.png_base64, mimeType: 'image/png' } } } });
  }
}
if (out.length === 0) {
  throw new Error('Preparar DocAI: "Rasterizar Ficha" no devolvio paginas completas. Document AI (modalidad B) necesita la pagina entera; revisar incluir_pagina_completa=true.');
}
return out;
