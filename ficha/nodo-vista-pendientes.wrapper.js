// Nodo Code "Pendientes" del workflow "[ESTEVEZ] Vista Pendientes".
//
// Entrada: la salida de "Leer Viajes" (dataTable, returnAll sobre la misma
// tabla Viajes -- lrBxWpTUxMtO8U48 -- que usa Guardar Viajes y Export Excel).
// Filtra los viajes pendientes (documentacion o revision de lectura), calcula
// dias_esperando y arma el HTML autocontenido. Toda la logica vive en
// pendientes.js; `node ficha/build-nodo.js` la pega delante de este archivo.

const viajes = $input.all().map(function (it) { return it.json || {}; });
const pendientes = filtrarPendientes(viajes);
return [{ json: { html: renderHTML(pendientes), total: pendientes.length } }];
