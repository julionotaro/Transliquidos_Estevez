// Envoltorio especifico de n8n para el nodo Code "Formatear Linea Gesruta" del
// workflow [ESTEVEZ] Ingesta Viaje — WD0q9Ic0oDvUoJwp.
//
// Solo hace de puente: toma las respuestas de OpenAI (v3.4: N pasadas de ficha,
// una por pagina, + 1 pasada de documentos) y las empareja por indice con las
// metas de "Preparar Payload" (que dicen pass y pagina). Toda la logica vive en
// correlacionar.js. `node ficha/build-nodo.js` pega correlacionar.js delante de
// este archivo y produce el script final del nodo.
//
// KM VACIOS (2026-08-26): se le inyecta el ULTIMO ODOMETRO CONOCIDO de cada
// tractora, leido de la tabla Viajes por el nodo "Leer Viajes Existentes". Sin
// eso el primer viaje de cada ficha no puede tener km vacios (falta el dato de
// donde venia el camion) — era 1 de cada 3 viajes. El nodo lector debe tener
// `Execute Once` y `Always Output Data`: con la tabla vacia debe emitir un item,
// no cero, o este nodo se saltea (ver docs/grafo-ingesta-tarifa.md).

const respuestas = $input.all();
const metas = $('Preparar Payload').all().map(function (it) { return it.json || {}; });

let ultimosOdo = null;
try {
  const filasViajes = $('Leer Viajes Existentes').all().map(function (it) { return it.json || {}; });
  ultimosOdo = ultimosOdometros(filasViajes);
} catch (e) {
  // El nodo lector puede no existir todavia en el grafo. Sin padron la ingesta
  // sigue: los km vacios del primer viaje de cada ficha quedan null con motivo
  // `sin_odometro_previo`, que es exactamente lo que pasaba antes.
  ultimosOdo = null;
}

return [{ json: procesar(respuestas, metas, { ultimosOdometros: ultimosOdo }) }];
