// Nodo Code "Pendientes" del workflow "[ESTEVEZ] Vista Pendientes".
//
// Lee tres tablas por NOMBRE (los lectores van en serie; $input es el ultimo):
//   - "Leer Viajes": la tabla Viajes (lrBxWpTUxMtO8U48).
//   - "Leer Puntos Pendientes": la tabla puntos (YjxcHHb5B4hT0RFU) -> codigos
//     Gesruta de origen/destino.
//   - "Leer Tarifas Pendientes": la tabla Tarifas (Siwhv2AUWTSeFlrJ) -> Precio,
//     Ud., Importe y Origen del precio (formato objetivo de la tabla).
// Todos los lectores: Execute Once (+ Always Output Data en Puntos y Tarifas).
//
// Toda la logica vive en pendientes.js; build-nodo.js la pega delante.

function _leer(nombre) {
  try { return $(nombre).all().map(function (it) { return it.json || {}; }); } catch (e) { return []; }
}
const viajes = _leer('Leer Viajes');
const puntos = _leer('Leer Puntos Pendientes');
const tarifas = _leer('Leer Tarifas Pendientes');
const pendientes = filtrarPendientes(viajes, undefined, puntos, tarifas);
return [{ json: { html: renderHTML(pendientes), total: pendientes.length } }];
