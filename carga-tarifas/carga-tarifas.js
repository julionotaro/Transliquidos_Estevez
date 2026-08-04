// ===== CARGA DE TARIFAS DESDE EXCEL — reemplazo de la tabla Tarifas ==========
//
// Encargo 2026-08-04, tarea B. El Excel (`Tarifas_general.xls`, exportacion
// directa del sistema de escritorio) REEMPLAZA la tabla `Tarifas`
// (Siwhv2AUWTSeFlrJ) entera -- no la complementa. Decision de Julio, no un
// merge.
//
// Este modulo es la logica PURA (mapeo columna por columna + dedup); no toca
// el Excel ni n8n directamente. `scripts/parsear-excel.py` convierte el .xls
// a JSON (fechas ya resueltas a 'YYYY-MM-DD'); `scripts/cargar.js` encadena
// ese JSON con este modulo y con las llamadas a n8n.
//
// EL PUNTO CRITICO (ver encargo): la columna Precio del Excel no siempre es
// EUR/tonelada. U.M. decide a que columna va:
//   TONELADAS                       -> tarifa_tn
//   UNIDADES / Cualquiera           -> precio_fijo (flete cerrado por viaje)
//   KILOMETROS / LITROS             -> precio_fijo, PERO con aviso: no es un
//                                       flete cerrado, es una tarifa por otra
//                                       unidad -- Julio lo tiene que ver.
//   cualquier otra U.M. (ninguna en el Excel real de hoy, pero el codigo no
//   asume)                          -> fila excluida + aviso, no se inventa.

'use strict';

var UM_TONELADAS = 'TONELADAS';
var UM_FIJO_LIMPIO = ['UNIDADES', 'Cualquiera'];
var UM_FIJO_CON_AVISO = ['KILOMETROS', 'LITROS'];

/**
 * Convierte una fila cruda del Excel (ya con fechas resueltas a 'YYYY-MM-DD'
 * o '' por scripts/parsear-excel.py) a la forma de fila de la tabla Tarifas.
 *
 * @param {object} filaExcel  {Cliente, Origen, Destino, Carga, Precio,
 *   'U.M.', 'Fec.Ult.Apli.', Desde} -- nombres tal cual las columnas del Excel.
 * @returns {{fila: object|null, aviso: string|null}}
 *   fila null si la U.M. es desconocida (no se inventa a que columna va).
 */
function mapearFilaExcel(filaExcel) {
  var um = filaExcel['U.M.'];
  var vigenteDesde = filaExcel['Fec.Ult.Apli.'] || filaExcel['Desde'] || '';
  var base = {
    cliente: filaExcel.Cliente,
    origen: filaExcel.Origen,
    destino: filaExcel.Destino,
    material: filaExcel.Carga,
    tarifa_tn: '',
    precio_fijo: '',
    vigente_desde: vigenteDesde
  };

  if (um === UM_TONELADAS) {
    base.tarifa_tn = String(filaExcel.Precio);
    return { fila: base, aviso: null };
  }
  if (UM_FIJO_LIMPIO.indexOf(um) >= 0) {
    base.precio_fijo = String(filaExcel.Precio);
    return { fila: base, aviso: null };
  }
  if (UM_FIJO_CON_AVISO.indexOf(um) >= 0) {
    base.precio_fijo = String(filaExcel.Precio);
    return {
      fila: base,
      aviso: 'U.M. "' + um + '" (' + filaExcel.Cliente + ': ' + filaExcel.Origen + ' -> ' + filaExcel.Destino +
        ') va a precio_fijo pero NO es un flete cerrado por viaje -- es una tarifa por ' + um.toLowerCase() +
        '. Revisar con Julio antes de facturar con esta fila.'
    };
  }
  return {
    fila: null,
    aviso: 'U.M. desconocida "' + um + '" (' + filaExcel.Cliente + ': ' + filaExcel.Origen + ' -> ' + filaExcel.Destino +
      ') -- fila EXCLUIDA de la carga, no se asume a que columna va. Revisar manualmente.'
  };
}

/** Clave de dedup: misma ruta+carga+cliente = mismo precio real (D-encargo). */
function claveTarifa(fila) {
  return [fila.cliente, fila.origen, fila.destino, fila.material].join('|');
}

/**
 * Agrupa filas ya mapeadas por claveTarifa y se queda con la de
 * vigente_desde mas reciente por grupo ('' cuenta como la mas vieja). Si dos
 * filas del mismo grupo tienen distinto (tarifa_tn, precio_fijo) -- precio
 * real distinto, o U.M. que las manda a columnas distintas -- es un
 * CONFLICTO: se resuelve igual (la mas reciente gana) pero se reporta para
 * que Julio lo revise, nunca se elige en silencio sin dejar rastro.
 *
 * @param {Array<object>} filasMapeadas  salida de mapearFilaExcel(...).fila, ya sin nulls.
 * @returns {{filas: Array<object>, conflictos: Array<{clave:string, filas:Array<object>, elegida:object}>}}
 */
function deduplicarTarifasExcel(filasMapeadas) {
  var grupos = {};
  var orden = [];
  for (var i = 0; i < filasMapeadas.length; i++) {
    var f = filasMapeadas[i];
    var k = claveTarifa(f);
    if (!grupos[k]) { grupos[k] = []; orden.push(k); }
    grupos[k].push(f);
  }

  var filasFinal = [];
  var conflictos = [];
  for (var j = 0; j < orden.length; j++) {
    var clave = orden[j];
    var grupo = grupos[clave];
    var ordenado = grupo.slice().sort(function (a, b) {
      return (b.vigente_desde || '').localeCompare(a.vigente_desde || '');
    });
    var elegida = ordenado[0];

    var precios = {};
    for (var m = 0; m < grupo.length; m++) {
      precios[grupo[m].tarifa_tn + '|' + grupo[m].precio_fijo] = true;
    }
    if (Object.keys(precios).length > 1) {
      conflictos.push({ clave: clave, filas: grupo, elegida: elegida });
    }
    filasFinal.push(elegida);
  }
  return { filas: filasFinal, conflictos: conflictos };
}

/**
 * Pipeline completo: mapea todas las filas crudas del Excel y dedupe.
 * @param {Array<object>} filasExcelCrudas
 * @returns {{filas: Array<object>, conflictos: Array<object>, avisos: Array<string>, excluidas: number}}
 */
function procesarTarifasExcel(filasExcelCrudas) {
  var avisos = [];
  var mapeadas = [];
  var excluidas = 0;
  for (var i = 0; i < filasExcelCrudas.length; i++) {
    var r = mapearFilaExcel(filasExcelCrudas[i]);
    if (r.aviso) { avisos.push(r.aviso); }
    if (r.fila) { mapeadas.push(r.fila); } else { excluidas++; }
  }
  var dedup = deduplicarTarifasExcel(mapeadas);
  return { filas: dedup.filas, conflictos: dedup.conflictos, avisos: avisos, excluidas: excluidas };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mapearFilaExcel: mapearFilaExcel,
    claveTarifa: claveTarifa,
    deduplicarTarifasExcel: deduplicarTarifasExcel,
    procesarTarifasExcel: procesarTarifasExcel
  };
}
