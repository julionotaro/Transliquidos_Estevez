// Nodo Code "Aplicar Accion" del workflow "[ESTEVEZ] Vista Pendientes".
//
// Entrada: la fila de Viajes que matcheo el id del POST (nodo dataTable
// "Leer Viaje Accion"), mas el body del webhook "Hook Accion"
// ($('Hook Accion').first().json.body: id, accion, usuario, valor).
// Aplica la accion pedida (corregir/resolver/incidencia; logica en
// acciones-pendientes.js) y emite el SNAPSHOT COMPLETO del viaje ya
// actualizado, para que "Actualizar Viaje" escriba de vuelta sin tener que
// razonar sobre que cambio y que no.

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
} else if (accion === 'resolver') {
  resultado = aplicarResolver(viaje, body.usuario);
} else if (accion === 'incidencia') {
  resultado = aplicarIncidencia(viaje, body.valor, body.usuario);
} else {
  throw new Error('Aplicar Accion: accion desconocida "' + accion + '" (esperada corregir/resolver/incidencia).');
}
if (!resultado.ok) {
  throw new Error('Aplicar Accion: ' + resultado.motivo);
}

const actualizado = Object.assign({}, viaje, resultado.cambios);
return [{ json: actualizado }];
