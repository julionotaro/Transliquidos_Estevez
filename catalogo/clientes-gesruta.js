// ===== CLIENTES GESRUTA — nombre del cliente -> CODIGO Gesruta ================
//
// El codigo de cliente (RNM = 661, FORESA = 1, ...) es un dato de Gesruta que NO
// estaba en ningun modulo: la planilla y la vista de pendientes mostraban el
// NOMBRE resuelto pero no el codigo. Se mina del export real de facturacion
// PRUEBA_2608_LINEA_FACTURACION.CSV (columna cli_codcli -> cli_nomcli), 35
// clientes reales.
//
// Es un conjunto CERRADO como el resto (materiales, choferes, puntos): se elige
// dentro de la lista por coincidencia de nombre; si no hay match unico, se
// devuelve null con motivo. NUNCA se inventa un codigo.

'use strict';

var CLIG_CRUCE = (typeof norm === 'function') ? { norm: norm } : require('../ficha/cruce.js');

// [codigo, razon social] tal como Gesruta la factura.
var CLIENTES_GESRUTA = [
  ['1', 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.'],
  ['4', 'CLAVO FOOD FACTORY, S.A.'],
  ['10', 'BALTRANSA, S.A.'],
  ['16', 'TRANSP. ALONSO DE PALENCIA, S.L.'],
  ['19', 'TRANSPORTES SANTOS, S.A.'],
  ['20', 'TRANSTAMBRE, S.L.'],
  ['33', 'COMATRA, S.C.L.'],
  ['42', 'BRESFOR IND. DO FORMOL, S.A.'],
  ['64', 'TTES.ARAGUNDE E HIJOS, S.L.'],
  ['212', 'TRANSVEGA E HIJOS, S.L.L.'],
  ['242', 'TAMATA LOGISTICA, S.L.'],
  ['247', 'VICENTE AT LOGISTICA, S.L.'],
  ['268', 'A.G.E. GODOY, S.L.'],
  ['280', 'TRANSPORTES A MARTIN, S.L.U.'],
  ['309', 'FERQUIASTUR, S.L.'],
  ['321', 'FORESTAL DEL ATLANTICO, S.A.'],
  ['323', 'HELM IBERICA, S.A.'],
  ['329', 'ARACHEM, S.A.'],
  ['403', 'QUIMIDROGA, S.A.'],
  ['405', 'ABERRI-TRANS, S.L.'],
  ['450', 'TRANSVASA, S.A.'],
  ['499', 'R.O.R. OPERADOR DE TRANSPORTES, S.L.'],
  ['514', 'QUIMIDROGA PORTUGAL, LDA'],
  ['528', 'ORGANIZ.TRANSPORTES ONATRA, S.L.'],
  ['547', 'TRANSARE 81, S.L.'],
  ['628', 'SOCIEDAD AGRICOLA GALLEGA,SL'],
  ['637', 'QUIMICAS DEL JARAMA, S.A.'],
  ['642', 'AMBERES CHEMICAL, S.A.'],
  ['653', 'AROUSA SEAFOOD, S.L.'],
  ['658', 'TANK SOLUTIONS, S.L.'],
  ['661', 'RNM TRANSPORTES QUIMICOS, LDA'],
  ['662', 'MAXLOGTRANS, S.L.'],
  ['668', 'THINKFORWARD, S.L.'],
  ['670', 'LIQUIADUBOS, LDA'],
  ['672', 'HISPALENSE DE LIQUIDOS SL'],
];

/**
 * Codigo Gesruta de un cliente por su nombre (el que quedo en el viaje, ya sea
 * "RNM" o "RNM TRANSPORTES QUIMICOS, LDA"). Match por token contenido, el mas
 * largo gana (para que "QUIMIDROGA PORTUGAL" no matchee la fila de "QUIMIDROGA").
 *
 * @returns {{codigo:string|null, nombre:string|null, motivo:string|null}}
 */
var GENERICOS = { SL: 1, SA: 1, SAU: 1, SLU: 1, SLL: 1, SCL: 1, LDA: 1, IND: 1,
  DEL: 1, DE: 1, LA: 1, LAS: 1, LOS: 1, DO: 1, QUIMICAS: 1, QUIMICOS: 1, HIJOS: 1, E: 1, Y: 1 };

// norm de cruce.js sube a mayusculas y quita acentos, pero DEJA la puntuacion
// ("BALTRANSA, S.A." -> "BALTRANSA, S.A."), y la coma pegada al token distintivo
// impedia el match. Aca se quita toda puntuacion antes de tokenizar.
function normFuerte(s) {
  return CLIG_CRUCE.norm(s).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokensSig(nom) {
  return normFuerte(nom).split(' ').filter(function (t) { return t.length >= 3 && !GENERICOS[t]; });
}

/**
 * Codigo Gesruta de un cliente por su nombre (el que quedo en el viaje, sea
 * "RNM" o "RNM TRANSPORTES QUIMICOS, LDA"). Se puntua cada fila por CUANTOS de
 * sus tokens distintivos aparecen en el cliente; gana la de mayor cobertura, y a
 * igualdad, la de tokens mas largos. Asi "QUIMIDROGA" solo -> QUIMIDROGA S.A.
 * (403) y "QUIMIDROGA PORTUGAL" -> QUIMIDROGA PORTUGAL (514).
 *
 * @returns {{codigo:string|null, nombre:string|null, motivo:string|null}}
 */
function codigoCliente(cliente) {
  var cl = normFuerte(cliente);
  if (!cl) { return { codigo: null, nombre: null, motivo: 'cliente_no_leido' }; }
  var mejor = null, mejorCob = 0, mejorLen = 0;
  for (var i = 0; i < CLIENTES_GESRUTA.length; i++) {
    var toks = tokensSig(CLIENTES_GESRUTA[i][1]);
    if (!toks.length) { continue; }
    var cob = 0, len = 0;
    for (var j = 0; j < toks.length; j++) {
      if (cl.indexOf(toks[j]) >= 0) { cob++; len += toks[j].length; }
    }
    // Solo cuenta si AL MENOS un token distintivo aparece.
    if (cob > 0 && (cob > mejorCob || (cob === mejorCob && len > mejorLen))) {
      mejor = CLIENTES_GESRUTA[i]; mejorCob = cob; mejorLen = len;
    }
  }
  if (mejor) { return { codigo: mejor[0], nombre: mejor[1], motivo: null }; }
  return { codigo: null, nombre: null, motivo: 'cliente_sin_codigo_gesruta: ' + (cliente || '(no leido)') };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CLIENTES_GESRUTA: CLIENTES_GESRUTA, codigoCliente: codigoCliente };
}
