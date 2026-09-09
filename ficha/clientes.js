// ===== IDENTIDAD DE CLIENTE — resolucion explicita a razon social ===========
//
// Unico lugar donde se resuelve QUIEN es el cliente de un viaje contra la
// identidad canonica que usa la tabla `Tarifas` (Siwhv2AUWTSeFlrJ). Reusable:
// cualquier modulo que necesite pasar del cliente leido a la fila de Tarifas
// (hoy tarifas.js; manana facturacion, cruces, etc.) resuelve por aca, no
// re-implementa el mapeo.
//
// POR QUE ESTE MODULO (encargo 2026-08-04): `Tarifas` fue reemplazada con el
// Excel del sistema de escritorio, que trae RAZON SOCIAL completa
// ("FORESA IND.QUIMICAS DEL NOROESTE, S.A."). El codigo viejo comparaba el
// codigo corto ("FORESA") por igualdad exacta contra esa columna -> 0 hits ->
// 9/9 viajes vivos en SIN_TARIFA. Regresion real confirmada por corrida.
//
// DECISION DE DISENO (no se re-discute): la identidad de cliente se resuelve
// por MAPA EXPLICITO, nunca por fragmento/substring sobre la razon social. Un
// fragmento cruza razones sociales sin relacion ("S.A.", "TRANSPORTES",
// "QUIMICAS" aparecen en decenas de nombres) y facturaria a un cliente la
// tarifa de otro EN SILENCIO. Mismo precedente ya establecido en el proyecto:
// "NO se uso alias para FORBA" (cruce.js, CLIENTES_CONOCIDOS) y "cliente no
// reconocido falla ruidoso". Un codigo sin razon social mapeada NO recibe
// tarifa a ciegas: devuelve motivo para que el viaje quede REVISAR.
//
// OJO — razones sociales que comparten prefijo son clientes DISTINTOS y solo
// una es la del viaje habitual:
//   "FORESA IND.QUIMICAS DEL NOROESTE, S.A."  (Galicia, el de los viajes)  != "FORESA FRANCE, SAS"
//   "QUIMIDROGA, S.A."                        (Espana)                     != "QUIMIDROGA PORTUGAL, LDA"
//   "HELM IBERICA, S.A."                                                   != "HELM PROMAN METHANOL AG"
// Por eso el `token` de reconocimiento apunta a UNA razon social exacta; si en
// el futuro aparece un viaje del otro cliente homonimo, se agrega su propia
// entrada con un token mas especifico ANTES en la lista, no se afloja el match.

'use strict';

var CRUCE_CLI = (typeof norm === 'function') ? { norm: norm } : require('./cruce.js');

// `token`: fragmento corto y distintivo con que la ficha/lectura nombra al
//   cliente. Se usa SOLO para reconocer la lectura (mismo criterio que
//   esClienteConocido en cruce.js: la lectura CONTIENE el token). Nunca se
//   compara el token contra Tarifas.cliente.
// `razonSocial`: identidad EXACTA tal cual quedo en Tarifas.cliente tras la
//   recarga del Excel (2026-08-04). Es lo unico que se compara — exacto — con
//   Tarifas.cliente.
//
// Poblado con los clientes de los 9 viajes vivos (FORESA, RNM) y los demas
// codigos referenciados en el codigo del proyecto (clienteParaTarifa /
// grupoIndexacion: QUIMIDROGA, HELM, QUIMICAS DEL JARAMA, BRESFOR). Para sumar
// un cliente: agregar una entrada aca, nada mas.
var ALIAS_CLIENTE = [
  { token: 'FORESA',              razonSocial: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.' },
  // BRESFOR: en la tabla VIEJA era solo un ORIGEN de FORESA; el Excel nuevo lo
  // trae como CLIENTE propio con sus filas ("BRESFOR IND. DO FORMOL, S.A."),
  // asi que un viaje BRESFOR resuelve su PROPIO tarifario, no el de FORESA
  // (cambio deliberado vs. el codigo viejo, que los conflaba). La agrupacion
  // FORESA-BRESFOR para la indexacion es otra cosa y sigue en indexacion.js.
  { token: 'BRESFOR',             razonSocial: 'BRESFOR IND. DO FORMOL, S.A.' },
  { token: 'QUIMIDROGA',          razonSocial: 'QUIMIDROGA, S.A.' },
  { token: 'RNM',                 razonSocial: 'RNM TRANSPORTES QUIMICOS, LDA' },
  { token: 'HELM',                razonSocial: 'HELM IBERICA, S.A.' },
  { token: 'JARAMA',              razonSocial: 'QUIMICAS DEL JARAMA, S.A.' },
];

/**
 * Resuelve el cliente leido de un viaje a su razon social canonica en Tarifas.
 * NO adivina: si la lectura no contiene ningun token conocido, devuelve
 * razonSocial null y un motivo con el valor leido (para que el caller marque
 * el viaje REVISAR, mismo patron que "cliente no reconocido").
 *
 * @param {string} clienteViaje  valor leido del cliente (ficha/documento).
 * @param {Array<object>} [alias] tabla de alias (default ALIAS_CLIENTE; inyectable en tests).
 * @returns {{razonSocial: string|null, token: string|null, motivo: string|null}}
 */
function resolverCliente(clienteViaje, alias) {
  var lista = Array.isArray(alias) ? alias : ALIAS_CLIENTE;
  var cl = CRUCE_CLI.norm(clienteViaje);
  if (!cl) {
    return { razonSocial: null, token: null, motivo: 'cliente_no_leido' };
  }
  for (var i = 0; i < lista.length; i++) {
    if (cl.indexOf(CRUCE_CLI.norm(lista[i].token)) >= 0) {
      return { razonSocial: lista[i].razonSocial, token: lista[i].token, motivo: null };
    }
  }
  return { razonSocial: null, token: null, motivo: 'cliente_no_mapeado: ' + (clienteViaje || '(no leido)') };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ALIAS_CLIENTE: ALIAS_CLIENTE,
    resolverCliente: resolverCliente,
  };
}
