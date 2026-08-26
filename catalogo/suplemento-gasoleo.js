// ===== SUPLEMENTO GASOLEO — los porcentajes oficiales, tramo por tramo ========
//
// Transcripcion literal de SUPLEMENTO_GASOLEO.xlsx (entregado por Julio,
// 2026-08-26). SEIS solapas = los seis grupos de indexacion. AGENCIA y AUTONOMOS
// figuraban como "pendientes" en docs/reglas-facturacion.md: ya tienen valores.
//
// Formato de cada tramo: [desde, hasta, pct], fechas como texto ISO y pct en
// DECIMAL (0.1838 = 18,38 por ciento).
//
// LOS TRAMOS SON ~SEMANALES, NO QUINCENALES. Por eso una quincena contiene dos o
// mas tramos, y por eso una factura quincenal puede llevar DOS lineas de
// indexacion con valores distintos. Caso real en esta misma tabla:
//     HELM  2026-06-01 -> 06-07 = 0,1256
//     HELM  2026-06-07 -> 06-15 = 0,1141
// Las dos caen en la 1a quincena de junio. Agrupar por quincena en vez de por
// tramo facturaria mal la mitad de esos viajes. Es exactamente la advertencia de
// Julio y la razon de que la agregacion vaya por TRAMO (ver modalidad-indexacion).
//
// DEFECTOS DEL ARCHIVO — se transcriben TAL CUAL y se denuncian; NO se corrigen
// por nuestra cuenta, porque inventar un tramo es inventar un cobro:
//
//   1) FECHA CORRUPTA. FORESA-BRESFOR trae un tramo que empieza en '1900-01-16'
//      (artefacto de la epoca de Excel) y termina en 2026-06-21. Por el patron de
//      las otras cinco solapas, que en esa posicion tienen 2026-06-15 -> 06-21,
//      lo mas probable es que sea 2026-06-15. NO se asume: el tramo queda con la
//      fecha corrupta, verificarTramos() lo denuncia, y los viajes de
//      FORESA-BRESFOR entre el 15 y el 21 de junio quedan SIN tramo -> REVISAR.
//
//   2) HUECO DEL 16-17 DE MAYO. En LAS SEIS solapas se salta del 2026-05-15 al
//      2026-05-18. Un viaje del 16 o 17 de mayo no tiene porcentaje vigente. Es
//      sistematico (no un tipeo suelto), asi que hay que preguntarlo, no rellenarlo.
//
//   3) ABRIL SIN VALOR. QUIMIDROGA, OTROS, AGENCIA y AUTONOMOS tienen los dos
//      tramos de abril vacios. Un viaje de abril de esos grupos no tiene vigente.
//
//   4) SOLAPES EN LOS BORDES. Varios tramos comparten el dia de corte
//      (04-27->05-01 y 05-01->05-10; 06-01->06-07 y 06-07->06-15). Cuando los dos
//      tramos tienen el mismo valor da igual, pero en HELM el 06-07 cae en dos
//      tramos con valores distintos (0,1256 y 0,1141). Por eso buscarPct() no
//      puede quedarse con "el primero que matchea": ver indexacion.js.

'use strict';

var SUPLEMENTO_GASOLEO = {
  'FORESA-BRESFOR': [
    ['2026-04-20', '2026-04-26', 0.1838],
    ['2026-04-27', '2026-05-01', 0.1838],
    ['2026-05-01', '2026-05-10', 0.1717],
    ['2026-05-11', '2026-05-15', 0.1717],
    ['2026-05-18', '2026-05-24', 0.1584],
    ['2026-05-25', '2026-05-31', 0.1584],
    ['2026-06-01', '2026-06-07', 0.1452],
    ['2026-06-07', '2026-06-15', 0.1452],
    ['1900-01-16', '2026-06-21', 0.1279],
    ['2026-06-22', '2026-06-28', 0.1279],
    ['2026-06-29', '2026-06-30', 0.1279],
    ['2026-07-01', '2026-07-15', 0.1064],
    ['2026-07-16', '2026-07-31', 0.0665],
    ['2026-08-01', '2026-08-15', 0.0918],
    ['2026-08-16', '2026-08-31', 0.1316],
  ],
  'HELM': [
    ['2026-04-20', '2026-04-26', 0.0986],
    ['2026-04-27', '2026-05-01', 0.0802],
    ['2026-05-01', '2026-05-10', 0.1385],
    ['2026-05-11', '2026-05-15', 0.1409],
    ['2026-05-18', '2026-05-24', 0.1356],
    ['2026-05-25', '2026-05-31', 0.1254],
    ['2026-06-01', '2026-06-07', 0.1256],
    ['2026-06-07', '2026-06-15', 0.1141],
    ['2026-06-15', '2026-06-21', 0.1036],
    ['2026-06-22', '2026-06-28', 0.0965],
    ['2026-06-29', '2026-07-05', 0.0796],
    ['2026-07-06', '2026-07-12', 0.0687],
    ['2026-07-13', '2026-07-19', 0.0412],
    ['2026-07-20', '2026-07-26', 0.039],
    ['2026-07-27', '2026-07-31', 0.0598],
    ['2026-08-01', '2026-08-31', 0.0571],
  ],
  'QUIMIDROGA': [
    ['2026-04-20', '2026-04-26', null],
    ['2026-04-27', '2026-05-01', null],
    ['2026-05-01', '2026-05-10', 0.1848],
    ['2026-05-11', '2026-05-15', 0.1848],
    ['2026-05-18', '2026-05-24', 0.1848],
    ['2026-05-25', '2026-05-31', 0.1848],
    ['2026-06-01', '2026-06-07', 0.1517],
    ['2026-06-07', '2026-06-15', 0.1517],
    ['2026-06-15', '2026-06-21', 0.1517],
    ['2026-06-22', '2026-06-28', 0.1517],
    ['2026-06-29', '2026-06-30', 0.1517],
    ['2026-07-01', '2026-07-31', 0.1171],
    ['2026-08-01', '2026-08-15', 0.0766],
  ],
  'OTROS': [
    ['2026-04-20', '2026-04-26', null],
    ['2026-04-27', '2026-05-01', null],
    ['2026-05-01', '2026-05-10', 0.1848],
    ['2026-05-11', '2026-05-15', 0.1848],
    ['2026-05-18', '2026-05-24', 0.1848],
    ['2026-05-25', '2026-05-31', 0.1848],
    ['2026-06-01', '2026-06-07', 0.15],
    ['2026-06-07', '2026-06-15', 0.15],
    ['2026-06-15', '2026-06-21', 0.15],
    ['2026-06-22', '2026-06-28', 0.15],
    ['2026-06-29', '2026-06-30', 0.15],
    ['2026-07-01', '2026-07-15', 0.08],
    ['2026-07-16', '2026-07-31', 0.08],
    ['2026-08-01', '2026-08-31', 0.0766],
  ],
  'AGENCIA': [
    ['2026-04-20', '2026-04-26', null],
    ['2026-04-27', '2026-05-01', null],
    ['2026-05-01', '2026-05-10', 0.17],
    ['2026-05-11', '2026-05-15', 0.17],
    ['2026-05-18', '2026-05-24', 0.15],
    ['2026-05-25', '2026-05-31', 0.15],
    ['2026-06-01', '2026-06-07', 0.12],
    ['2026-06-07', '2026-06-15', 0.12],
    ['2026-06-15', '2026-06-21', 0.08],
    ['2026-06-22', '2026-06-28', 0.08],
    ['2026-06-29', '2026-06-30', 0.08],
    ['2026-07-01', '2026-07-15', 0.06],
    ['2026-07-16', '2026-07-31', 0.06],
    ['2026-08-01', '2026-08-15', 0.06],
    ['2026-08-16', '2026-08-31', 0.09],
  ],
  'AUTONOMOS': [
    ['2026-04-20', '2026-04-26', null],
    ['2026-04-27', '2026-05-01', null],
    ['2026-05-01', '2026-05-10', 0.17],
    ['2026-05-11', '2026-05-15', 0.17],
    ['2026-05-18', '2026-05-24', 0.15],
    ['2026-05-25', '2026-05-31', 0.15],
    ['2026-06-01', '2026-06-07', 0.14],
    ['2026-06-07', '2026-06-15', 0.14],
    ['2026-06-15', '2026-06-21', 0.11],
    ['2026-06-22', '2026-06-28', 0.11],
    ['2026-06-29', '2026-06-30', 0.11],
    ['2026-07-01', '2026-07-15', 0.08],
    ['2026-07-16', '2026-07-31', 0.06],
    ['2026-08-01', '2026-08-15', 0.0766],
  ],
};

var GRUPOS = ["FORESA-BRESFOR", "HELM", "QUIMIDROGA", "OTROS", "AGENCIA", "AUTONOMOS"];

/**
 * Revisa la calidad de la tabla y devuelve los defectos encontrados. Se corre al
 * cargar, no por viaje: sirve para avisar de que el archivo tiene agujeros ANTES
 * de que una factura salga mal.
 *
 * @returns {Array<{grupo,tipo,detalle}>}
 */
function verificarTramos(tabla) {
  var T = tabla || SUPLEMENTO_GASOLEO;
  var problemas = [];
  var dias = function (a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); };
  for (var g in T) {
    if (!Object.prototype.hasOwnProperty.call(T, g)) { continue; }
    var filas = T[g];
    var prevHasta = null;
    for (var i = 0; i < filas.length; i++) {
      var desde = filas[i][0], hasta = filas[i][1], pct = filas[i][2];
      if (!/^20[0-9][0-9]-/.test(desde)) {
        problemas.push({ grupo: g, tipo: 'fecha_corrupta', detalle: 'el tramo que termina el ' + hasta + ' empieza en "' + desde + '"' });
      }
      if (pct === null || pct === undefined) {
        problemas.push({ grupo: g, tipo: 'sin_pct', detalle: 'el tramo ' + desde + ' -> ' + hasta + ' no tiene porcentaje' });
      }
      if (prevHasta && /^20/.test(desde)) {
        if (desde < prevHasta) {
          problemas.push({ grupo: g, tipo: 'solape', detalle: 'el tramo que empieza el ' + desde + ' solapa con el que termina el ' + prevHasta });
        } else if (dias(prevHasta, desde) > 1) {
          problemas.push({ grupo: g, tipo: 'hueco', detalle: 'no hay tramo entre ' + prevHasta + ' y ' + desde });
        }
      }
      if (hasta) { prevHasta = hasta; }
    }
  }
  return problemas;
}

/** Los tramos de un grupo, en el formato de la tabla `Indexacion` de n8n. */
function tramosDe(grupo, tabla) {
  var filas = ((tabla || SUPLEMENTO_GASOLEO)[grupo]) || [];
  var out = [];
  for (var i = 0; i < filas.length; i++) {
    if (filas[i][2] === null) { continue; }
    out.push({ cliente: grupo, pct: String(filas[i][2]), desde: filas[i][0], hasta: filas[i][1] });
  }
  return out;
}

/** Todos los tramos de las seis solapas, listos para buscarPct(). */
function todosLosTramos(tabla) {
  var T = tabla || SUPLEMENTO_GASOLEO;
  var out = [];
  for (var g in T) {
    if (Object.prototype.hasOwnProperty.call(T, g)) { out = out.concat(tramosDe(g, T)); }
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUPLEMENTO_GASOLEO: SUPLEMENTO_GASOLEO,
    GRUPOS: GRUPOS,
    verificarTramos: verificarTramos,
    tramosDe: tramosDe,
    todosLosTramos: todosLosTramos
  };
}
