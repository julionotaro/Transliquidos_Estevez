// ===== MINI-MAPA CHOFER -> TIPO DE CONDUCTOR ================================
//
// Marca cada viaje con el tipo de conductor (autonomo | dependiente) segun quien
// firma la ficha. Confirmado por Julio: son AUTONOMOS los apellidos Abal, Fraga y
// Alfonsin; el resto de la flota es DEPENDIENTE. Sirve para el regimen de
// facturacion (los autonomos liquidan distinto) y para la solapa AUTONOMOS de
// indexacion.
//
// OJO — match por APELLIDO EXACTO (token), no por substring: en la flota conviven
// "JUAN MANUEL ABAL" (autonomo) con "CARLOS ABALO" / "RUBEN ABELO" (dependientes).
// Un match por inclusion marcaria ABALO/ABELO como Abal por error. Por eso se
// comparan tokens completos normalizados, nunca fragmentos.
//
// Logica PURA (sin n8n). Reusa el normalizador de resolver-punto.js cuando esta
// inlineado; si no, cae a una normalizacion local equivalente.

'use strict';

var _N = (typeof normalizar === 'function')
  ? normalizar
  : function (s) {
      var t = (s === null || s === undefined) ? '' : String(s);
      return t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    };

// Apellidos autonomos (normalizados). Ampliar aqui si Julio suma otro autonomo.
var APELLIDOS_AUTONOMOS = { 'ABAL': true, 'FRAGA': true, 'ALFONSIN': true };

/**
 * Devuelve 'autonomo' | 'dependiente' segun el nombre del conductor.
 * Un chofer vacio/ilegible -> '' (no se afirma nada; queda a la vista).
 * @param {string} nombre  nombre libre tal como sale de la ficha
 */
function tipoConductor(nombre) {
  var norm = _N(nombre);
  if (!norm) { return ''; }
  var tokens = norm.split(' ');
  for (var i = 0; i < tokens.length; i++) {
    if (APELLIDOS_AUTONOMOS[tokens[i]]) { return 'autonomo'; }
  }
  return 'dependiente';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tipoConductor: tipoConductor, APELLIDOS_AUTONOMOS: APELLIDOS_AUTONOMOS };
}
