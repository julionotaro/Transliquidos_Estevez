// Nodo Code "Aplicar Accion" del workflow "[ESTEVEZ] Vista Pendientes".
//
// Entrada: la fila de Viajes que matcheo el id del POST (nodo dataTable
// "Leer Viaje Accion"), mas el body del webhook "Hook Accion"
// ($('Hook Accion').first().json.body: id, accion, usuario, valor, campo, motivo).
// Aplica la accion pedida (logica en acciones-pendientes.js) y emite el SNAPSHOT
// COMPLETO del viaje ya actualizado, para que "Actualizar Viaje" escriba de
// vuelta sin tener que razonar sobre que cambio y que no.
//
// CAMBIO 2/3: dos verbos nuevos sobre el MISMO webhook (no hay canal nuevo):
//   - corregir_celda: corrige una celda SIN revalidar (todo menos `cliente`).
//     Ademas del snapshot, adjunta `_correccion`: la fila para la tabla nueva
//     `correcciones` (opcion 2, preserva el valor original del modelo).
//   - confirmar: transiciona estado_carga pendiente_revision -> confirmada.
// `cliente` sigue yendo por el verbo `corregir` (aplicarCorregir, que revalida).
//
// RUTEO DE `_correccion` EN EL GRAFO (deploy manual, ver instructivo):
//   Aplicar Accion  --main-->  Actualizar Viaje        (escribe columnas de Viajes;
//                                                        ignora `_correccion`)
//   Aplicar Accion  --main-->  IF "¿Hay correccion?"   (condicion: $json._correccion
//                                 --true--> Insertar Correccion (dataTable insert
//                                           en `correcciones`, mapea $json._correccion.*)
// Asi una correccion de celda escribe en Viajes Y en correcciones; el resto de
// las acciones solo tocan Viajes (la rama IF no dispara).

const filas = $input.all();
if (filas.length === 0) {
  throw new Error('Aplicar Accion: no se encontro el viaje (id inexistente o ya no esta en la tabla).');
}
const viaje = filas[0].json || {};
const body = ($('Hook Accion').first().json || {}).body || {};
const accion = (body.accion || '').toString();

let resultado;
if (accion === 'corregir') {
  resultado = aplicarCorregir(viaje, 'cliente', body.valor, body.usuario);
} else if (accion === 'corregir_celda') {
  resultado = aplicarCorregirCelda(viaje, (body.campo || '').toString(), body.valor, body.usuario, body.motivo);
} else if (accion === 'confirmar') {
  resultado = aplicarConfirmar(viaje, body.usuario);
} else if (accion === 'resolver') {
  resultado = aplicarResolver(viaje, body.usuario);
} else if (accion === 'incidencia') {
  resultado = aplicarIncidencia(viaje, body.valor, body.usuario);
} else {
  throw new Error('Aplicar Accion: accion desconocida "' + accion + '" (esperada corregir/corregir_celda/confirmar/resolver/incidencia).');
}
if (!resultado.ok) {
  throw new Error('Aplicar Accion: ' + resultado.motivo);
}

const actualizado = Object.assign({}, viaje, resultado.cambios);
// La fila para `correcciones` viaja adjunta; la rama IF del grafo la enruta a la
// tabla nueva. Las columnas de Viajes no incluyen `_correccion`, asi que
// "Actualizar Viaje" la ignora.
if (resultado.correccion) {
  actualizado._correccion = resultado.correccion;
}
// Status JSON para "Responder Accion" (CAMBIO fetch-acciones): el webhook
// responde ESTO (no HTML ni redirect), y el front actualiza la fila in-place sin
// navegar. Se arma DESPUES de aplicar la accion, asi refleja el estado real que
// se va a persistir. `Responder Accion` responde con {{ $('Aplicar Accion').first().json._status }}.
// Como _status no es columna de Viajes, "Actualizar Viaje" lo ignora (igual que _correccion).
actualizado._status = {
  ok: true,
  viaje_id: (actualizado.id === undefined || actualizado.id === null) ? null : String(actualizado.id),
  accion: accion || null,
  campo: (body.campo === undefined || body.campo === null || body.campo === '') ? null : String(body.campo),
  valor: (body.valor === undefined) ? null : body.valor,
  estado_carga: actualizado.estado_carga || null,
  cliente: (actualizado.cliente === undefined) ? null : actualizado.cliente,
  estado_lectura: actualizado.estado_lectura || null,
  motivo_revision: actualizado.motivo_revision || null
};
return [{ json: actualizado }];
