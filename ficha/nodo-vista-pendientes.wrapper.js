// Nodo Code "Pendientes" del workflow "[ESTEVEZ] Vista Pendientes".
//
// Lee dos tablas por NOMBRE (no por $input, porque los lectores van en serie y
// el input directo es el ultimo de la cadena):
//   - "Leer Viajes": la tabla Viajes (lrBxWpTUxMtO8U48).
//   - "Leer Puntos Pendientes": la tabla puntos (YjxcHHb5B4hT0RFU), para resolver
//     los CODIGOS Gesruta de origen/destino (columnas amarillas).
// Ambos lectores: Execute Once. El de puntos, ademas, Always Output Data (con la
// tabla vacia debe emitir un item, no cero, o el nodo siguiente se saltea).
//
// Toda la logica vive en pendientes.js; build-nodo.js la pega delante.

function _leer(nombre) {
  try { return $(nombre).all().map(function (it) { return it.json || {}; }); } catch (e) { return []; }
}
const viajes = _leer('Leer Viajes');
const puntos = _leer('Leer Puntos Pendientes');
const pendientes = filtrarPendientes(viajes, undefined, puntos);
return [{ json: { html: renderHTML(pendientes), total: pendientes.length } }];
