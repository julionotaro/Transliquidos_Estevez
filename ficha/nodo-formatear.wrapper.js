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

// Odometros leidos por Document AI (nodo "Extraer DocAI"), indexados por pagina.
// Si el nodo no existe o no corrio, docaiPorPagina queda vacio y el correlacionador
// se comporta como antes (odometros de gpt-4o). Con DocAI activo, km_inicio/km_final
// vienen de ahi y se aplican las guardas de confianza/formato.
let docaiPorPagina = {};
try {
  const items = $('Extraer DocAI').all();
  for (const it of items) {
    const j = it.json || {};
    if (j.pagina !== undefined && j.pagina !== null) {
      docaiPorPagina[j.pagina] = { km_v1: j.km_v1, km_v2: j.km_v2, km_v3: j.km_v3 };
    }
  }
} catch (e) { docaiPorPagina = {}; }

return [{ json: procesar(respuestas, metas, docaiPorPagina) }];
