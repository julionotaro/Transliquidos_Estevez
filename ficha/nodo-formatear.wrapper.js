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

// --- N2 doc<->viaje (§5.2), GATED por cableado del grafo ----------------------
// El correlacionador puede correlacionar un documento sin ficha en el envio
// contra el pool de viajes YA cargados en Gesruta (por referencia N1 o
// ruta+material+peso+fecha N2), usando el punto canonico del documento. Para eso
// necesita dos entradas que vienen de nodos dataTable-get OPCIONALES, upstream de
// ESTE nodo (deben ejecutarse ANTES que Formatear; p. ej. como ramas colgadas de
// "Hook Viaje"). NOMBRES dedicados para no chocar con "Leer Viajes Existentes"
// (que existe pero corre DESPUES de Formatear, alimentando el dedup):
//   - "Leer Viajes N2"          (tabla viajes lrBxWpTUxMtO8U48, filtro fecha >= hoy-45d)
//   - "Cargar Catalogo Puntos"  (tabla puntos YjxcHHb5B4hT0RFU, 324 canonicos)
// Si el grafo AUN no los cablea, $(nombre) lanza y se leen como [] -> opts vacio
// -> el nodo se comporta EXACTAMENTE como antes (N2 OFF). Ver docs/correlacion-n2.md.
function leerNodoOpcional(nombre) {
  try { return $(nombre).all().map(function (it) { return it.json || {}; }); }
  catch (e) { return []; }
}
const viajesExistentes = leerNodoOpcional('Leer Viajes N2');
const catalogoPuntos = leerNodoOpcional('Cargar Catalogo Puntos');
const opts = {};
if (viajesExistentes.length) { opts.viajesExistentes = viajesExistentes; }
if (catalogoPuntos.length) { opts.catalogoPuntos = catalogoPuntos; }

return [{ json: procesar(respuestas, metas, opts) }];
