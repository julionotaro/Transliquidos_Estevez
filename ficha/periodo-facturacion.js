// ===== PERIODO DE FACTURACION Y GRUPO DE INDEXACION, CLIENTE POR CLIENTE ======
//
// Tabla entregada por Julio (2026-08-26) y contrastada contra el export real
// PRUEBA_2608_LINEA_FACTURACION.CSV (2.975 lineas de facturacion).
//
// TRES EJES DISTINTOS, que antes se confundian en uno solo:
//
//   1) GRUPO DE INDEXACION -> de que solapa del Suplemento Gasoleo sale el
//      porcentaje. Seis grupos: FORESA-BRESFOR, HELM, QUIMIDROGA, OTROS,
//      AGENCIA, AUTONOMOS.
//
//   2) MODALIDAD -> si la indexacion se itemiza por albaran o se acumula.
//      OJO: esto NO cambia el importe total. Verificado sobre el CSV: en los
//      clientes "por linea" el ratio indexacion/porte de cada albaran es
//      EXACTAMENTE el pct del tramo de esa fecha (Bresfor 0,1838 / 0,1452;
//      Helm 0,1385; RNM 0,1848). O sea el calculo siempre es base x pct del
//      tramo; lo unico que cambia es si esa cuenta aparece linea por linea o
//      sumada. Por eso la factura de Bresfor muestra "una linea por valor de
//      indexacion segun periodo de fecha" (Julio) aunque el detalle interno de
//      Gesruta tenga una linea por albaran: al facturar se agrupan por pct.
//
//   3) PERIODO DE FACTURACION -> cada cuanto se emite la factura (quincenal o
//      mensual). Es independiente de los otros dos: casi todos los clientes son
//      quincenales, incluidos los que no llevan indexacion.
//
// LA CONSECUENCIA QUE IMPORTA (advertencia literal de Julio): los tramos del
// suplemento son ~SEMANALES, asi que una quincena contiene dos o mas tramos. Si
// en una quincena hubo dos ajustes, esa factura lleva DOS lineas de indexacion
// con valores distintos. Caso real: HELM 06-01/06-07 = 0,1256 y 06-07/06-15 =
// 0,1141, las dos en la 1a quincena de junio. Por eso se agrupa por TRAMO y
// nunca por quincena natural (ver ficha/modalidad-indexacion.js).

'use strict';

var PF_CRUCE = (typeof norm === 'function') ? { norm: norm } : require('./cruce.js');

// --- Eje 3: periodo de facturacion (tabla de Julio) --------------------------
// El valor es el periodo en que se EMITE la factura. 'quincenal' | 'mensual'.
// 'mensual_opcional' = se puede facturar de las dos formas; no se asume.
var PERIODO_FACTURACION = [
  ['FORESA',                  'mensual_opcional', 'quincenal por defecto; el metanol Villagarcia-Caldas va mensual (mes completo) y los retornos admiten las dos'],
  ['BRESFOR',                 'quincenal', ''],
  ['QUIMIDROGA',              'quincenal', ''],
  ['QUIMIDROGA PORTUGAL',     'quincenal', ''],
  ['HELM',                    'quincenal', ''],
  ['RNM',                     'quincenal', ''],
  ['BALTRANSA',               'quincenal', ''],
  ['TRANSPORTES SANTOS',      'quincenal', ''],
  ['MAXLOGTRANS',             'quincenal', ''],
  ['A.G.E. GODOY',            'quincenal', ''],
  ['GODOY',                   'quincenal', ''],
  ['COMATRA',                 'quincenal', ''],
  ['FERQUIASTUR',             'quincenal', ''],
  ['TAMATA',                  'quincenal', ''],
  ['SAO LAZARO',              'quincenal', ''],
  ['TRANSTAMBRE',             'quincenal', ''],
  ['A MARTIN',                'quincenal', ''],
  ['A.MARTIN',                'quincenal', ''],
  ['CLAVO FOOD',              'mensual_opcional', 'mensual, aunque tambien se puede quincenal'],
  ['ROTANK',                  'quincenal', ''],
  ['LOGISTICA CARBALLO',      'quincenal', '']
];

// --- Eje 1: grupo de indexacion (solapa del Suplemento Gasoleo) --------------
// Verificado contra el CSV: los porcentajes que aparecen en cada cliente son
// EXACTAMENTE los de la solapa asignada.
//   RNM       -> 0,1848 0,15 0,08 0,0766  = OTROS
//   JARAMA    -> 0,1848 0,15 0,0766       = OTROS
//   FORESTAL  -> 0,1848 0,15              = OTROS
//   CLAVO     -> 0,1848 0,15 0,08         = OTROS
//   QUIMIDROGA-> 0,1848 0,1517 0,1171     = QUIMIDROGA
//   HELM      -> 0,1385 0,1409 0,1036 ... = HELM
//   BRESFOR   -> 0,1838 0,1717 0,1452 ... = FORESA-BRESFOR
var GRUPO_POR_CLIENTE = [
  ['FORESA',     'FORESA-BRESFOR'],
  ['BRESFOR',    'FORESA-BRESFOR'],
  ['QUIMIDROGA', 'QUIMIDROGA'],
  ['HELM',       'HELM']
  // Todo lo demas -> OTROS, salvo agencias y autonomos, que no se asignan por
  // nombre de cliente: no hay regla documentada y el porcentaje viene pactado en
  // la propia orden (ver PCT_DESDE_ORDEN).
];

// --- Eje 2: los servicios de FORESA que van AGREGADOS ------------------------
// Julio: "Para Foresa la indexacion por viaje solo se realiza en los viajes
// Foresa otros, Villagarcia otros y Retornos". Lo demas va agregado.
//
// VERIFICADO sobre el CSV, midiendo que FRACCION de los albaranes de cada ruta
// lleva su propia linea de indexacion. La separacion es tajante:
//     CALDAS -> OREMBER      COLA      586 albaranes, 2,0 % con linea  -> AGREGADA
//     VILLAGARCIA -> CALDAS  METANOL   236 albaranes, 3,0 % con linea  -> AGREGADA
//     CALDAS -> OREMBER      FINCAT    116 albaranes, 6,9 % con linea  -> AGREGADA
//     CALDAS -> TERUEL       COLA       42 albaranes, 83,3 % con linea -> POR LINEA
//     CALDAS -> TERMOLAN     COLA       50 albaranes, 78,0 % con linea -> POR LINEA
//     VILLAGARCIA -> VALLADOLID METANOL 23 albaranes, 69,6 % con linea -> POR LINEA
// Entre el 7 % y el 46 % no hay NADA: el umbral no es una eleccion nuestra, es
// un hueco que esta en el dato.
//
// El discriminador entre "metanol Villagarcia->Caldas" (agregado mensual) y un
// "retorno con destino Caldas" (por linea) es el ORIGEN: el metanol sale de
// Villagarcia; los retornos vuelven desde donde se hizo la entrega.
var SERVICIOS_AGREGADOS_FORESA = [
  { origen: 'VILLAGARCIA', destino: 'CALDAS', periodo: 'mensual',
    nombre: 'Metanol Villagarcia-Caldas', evidencia: '236 albaranes, 3,0% con linea propia' },
  { origen: null, destino: 'OREMBER', periodo: 'quincenal',
    nombre: 'Destino Orember', evidencia: '702 albaranes, 2,7% con linea propia' }
];

function buscaEn(tabla, texto, col) {
  var t = PF_CRUCE.norm(texto);
  if (!t) { return null; }
  var mejor = null;
  for (var i = 0; i < tabla.length; i++) {
    var clave = tabla[i][0];
    if (t.indexOf(clave) >= 0 && (!mejor || clave.length > mejor[0].length)) { mejor = tabla[i]; }
  }
  return mejor ? mejor[col === undefined ? 1 : col] : null;
}

/**
 * Periodo en que se EMITE la factura de este cliente.
 * @returns {{periodo:'quincenal'|'mensual'|'mensual_opcional'|null, revisar, motivo}}
 */
function periodoFacturacion(cliente) {
  var t = PF_CRUCE.norm(cliente);
  var fila = null;
  for (var i = 0; i < PERIODO_FACTURACION.length; i++) {
    var c = PERIODO_FACTURACION[i][0];
    if (t && t.indexOf(c) >= 0 && (!fila || c.length > fila[0].length)) { fila = PERIODO_FACTURACION[i]; }
  }
  if (!fila) {
    return { periodo: null, revisar: true,
      motivo: 'el cliente "' + (cliente || '(no leido)') + '" no esta en la tabla de periodos de facturacion' };
  }
  return {
    periodo: fila[1],
    revisar: fila[1] === 'mensual_opcional',
    motivo: fila[2] || ''
  };
}

/**
 * Solapa del Suplemento Gasoleo de la que sale el porcentaje.
 * Por defecto OTROS, que es la regla explicita de Julio ("para el resto usar la
 * categoria otros"), no una suposicion nuestra.
 */
function grupoSuplemento(cliente) {
  var g = buscaEn(GRUPO_POR_CLIENTE, cliente);
  if (g) { return { grupo: g, porDefecto: false, motivo: '' }; }
  return { grupo: 'OTROS', porDefecto: true,
    motivo: 'cliente sin solapa propia: se usa OTROS (regla de Julio para el resto de clientes)' };
}

/**
 * Modalidad de indexacion de un viaje de FORESA, que es el unico cliente que
 * factura de las dos formas segun el servicio.
 *
 * @returns {{modalidad:'agregada'|'linea', periodo:string|null, servicio:string|null, motivo:string}}
 */
function servicioForesa(origen, destino) {
  var o = PF_CRUCE.norm(origen), d = PF_CRUCE.norm(destino);
  for (var i = 0; i < SERVICIOS_AGREGADOS_FORESA.length; i++) {
    var s = SERVICIOS_AGREGADOS_FORESA[i];
    var okDestino = d && d.indexOf(s.destino) >= 0;
    var okOrigen = (s.origen === null) || (o && o.indexOf(s.origen) >= 0);
    if (okDestino && okOrigen) {
      return { modalidad: 'agregada', periodo: s.periodo, servicio: s.nombre,
        motivo: s.nombre + ': la indexacion NO va por viaje, se acumula por ' + s.periodo + ' (' + s.evidencia + ')' };
    }
  }
  return { modalidad: 'linea', periodo: 'quincenal', servicio: 'Foresa otros / Villagarcia otros / Retornos',
    motivo: 'servicio de Foresa que SI se indexa por viaje' };
}

/**
 * El porcentaje que viene IMPRESO en la orden manda sobre la tabla.
 *
 * Julio: "Los clientes que cotizan por viaje, en la OC figura el porcentaje de
 * indexacion". Confirmado en el CSV: TRANSTAMBRE aplica 0,0532 y 0,0877, y
 * A.G.E. GODOY 0,0748 — valores que NO estan en ninguna solapa. Son pactados por
 * operacion. Si se les aplicara la tabla se facturaria un porcentaje que el
 * cliente no acepto.
 *
 * @param {number|null} pctOrden  el leido de la orden (0.0532, no 5.32)
 * @returns {{pct:number|null, fuente:string, motivo:string}}
 */
function pctDeOrden(pctOrden) {
  if (pctOrden === null || pctOrden === undefined || !isFinite(pctOrden)) {
    return { pct: null, fuente: 'ninguna', motivo: '' };
  }
  var p = Number(pctOrden);
  // Tolerar que venga como 5.32 en vez de 0.0532: por encima de 1 es un
  // porcentaje escrito "en cien", no un decimal.
  if (p > 1) { p = Math.round(p * 100) / 10000; }
  if (p < 0 || p > 0.5) {
    return { pct: null, fuente: 'orden_descartada',
      motivo: 'el porcentaje leido en la orden (' + pctOrden + ') esta fuera de rango; no se aplica' };
  }
  return { pct: p, fuente: 'orden',
    motivo: 'porcentaje tomado de la ORDEN (' + (p * 100).toFixed(2) + '%): manda sobre la tabla del suplemento' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PERIODO_FACTURACION: PERIODO_FACTURACION,
    GRUPO_POR_CLIENTE: GRUPO_POR_CLIENTE,
    SERVICIOS_AGREGADOS_FORESA: SERVICIOS_AGREGADOS_FORESA,
    periodoFacturacion: periodoFacturacion,
    grupoSuplemento: grupoSuplemento,
    servicioForesa: servicioForesa,
    pctDeOrden: pctDeOrden
  };
}
