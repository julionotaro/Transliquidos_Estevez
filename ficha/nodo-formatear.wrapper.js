// Envoltorio especifico de n8n para el nodo Code "Formatear Linea Gesruta" del
// workflow [ESTEVEZ] Ingesta Viaje — WD0q9Ic0oDvUoJwp.
//
// Solo hace de puente: toma los dos items de respuesta de OpenAI (pasada de
// fichas y pasada de documentos) y delega en procesar(). Toda la logica vive en
// correlacionar.js. `node ficha/build-nodo.js` pega correlacionar.js delante de
// este archivo y produce el script final del nodo.

const respuestas = $input.all();
return [{ json: procesar(respuestas) }];
