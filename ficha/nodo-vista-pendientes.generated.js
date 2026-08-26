// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/../catalogo/suplemento-gasoleo.js + ficha/cruce.js + ficha/clientes.js + ficha/tarifas.js + ficha/indexacion.js + ficha/modalidad-indexacion.js + ficha/periodo-facturacion.js + ficha/../catalogo/gesruta.js + ficha/../catalogo/resolver-punto.js + ficha/../catalogo/clientes-gesruta.js + ficha/validaciones-forma.js + ficha/pendientes.js + ficha/nodo-vista-pendientes.wrapper.js
// Contenido exacto del nodo Code "Pendientes" ([ESTEVEZ] Vista Pendientes (C3eZ1RteNAZDdaCV)).

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

// ===== CRUCE FICHA<->DOCUMENTO — reglas del modelo "albaran = unidad facturable" =====
//
// Fase 2 (encargo 2026-08-01). Corrige el supuesto "1 bloque de ficha = 1 viaje".
//
//   El albaran (o documento de origen equivalente) es la unidad FACTURABLE.
//   El bloque de la ficha es la DECLARACION del chofer sobre su jornada.
//   Un bloque puede representar N viajes; quien define N son los documentos.
//
// Este modulo aisla las piezas CONFIGURABLES y las funciones PURAS del cruce, para
// que no queden hardcodeadas en el medio de correlacionar.js y sean testeables
// solas. La logica de expansion/consolidacion que las usa vive en correlacionar.js.
//
// ESTRUCTURA confirmada contra dato real (encargo v1.1 2026-08-03): la
// exportacion del sistema de escritorio (expediente 00050461, CALDAS DE
// REIS->OREMBER) trae exactamente este patron -- 3 viajes Nº 01/02/03, cada uno
// con su propia referencia e importe, mismo cabeza/remolque. El modelo
// bloque=N viajes ya NO esta "no verificado" a nivel de dominio.
//
// Lo que SIGUE sin probar es la LECTURA: no hay todavia una ficha manuscrita
// real de un bloque multi-viaje para confirmar que gpt-4o lee bien `cantidad=3`
// en el campo de la ficha (riesgo de OCR, distinto del riesgo de estructura que
// ya se cerro). Cuando aparezca esa ficha escaneada, es la primera corrida a
// hacer. Ver docs/fase2-cierre-y-fase3-bloqueantes.md.

'use strict';

// --- RUTAS_MULTIVIAJE: lista configurable, facil de ampliar ------------------
// Cada entrada es una ruta (cliente, origen, destino) donde el chofer escribe en
// el campo `cantidad` de la ficha el NUMERO DE VIAJES, no los kg. Arranca con la
// unica confirmada (FORESA Villagarcia -> Caldas de Reis, metanol). Para sumar
// una ruta: agregar un objeto aca, NO tocar la logica.
var RUTAS_MULTIVIAJE = [
  { cliente: 'FORESA', origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS' },
];

// Red de seguridad: los pesos SIEMPRE van en miles de kg. Un valor de uno o dos
// digitos es imposible como peso -> probable numero de viajes de una ruta que
// todavia no esta en RUTAS_MULTIVIAJE. En vez de meter "4 kg" en silencio, se
// manda a REVISAR para que aparezca en el tablero. Cuando se confirme la ruta,
// se agrega arriba y deja de preguntar.
var UMBRAL_CANTIDAD_KG = 100;

// --- Normalizacion de texto para el match de rutas ---------------------------
// La ficha escribe "Villagarcía"/"VILLAGARCIA", "Caldas"/"Caldas de Reis". Se
// compara sin acentos, en mayusculas y por inclusion en ambos sentidos, para que
// "CALDAS" matchee "CALDAS DE REIS" sin volverse laxo (no matchea vacios).
function quitarAcentos(s) {
  return (s === null || s === undefined ? '' : String(s)).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function norm(s) {
  return quitarAcentos(s).toUpperCase().replace(/\s+/g, ' ').trim();
}
function coincideTexto(valorFicha, valorRuta) {
  var a = norm(valorFicha);
  var b = norm(valorRuta);
  if (!a || !b) { return false; }
  return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
}

/**
 * ¿La terna (cliente, origen, destino) de la ficha es una ruta multi-viaje?
 * @returns {object|null} la entrada de RUTAS_MULTIVIAJE que coincide, o null.
 */
function esRutaMultiviaje(cliente, origen, destino, rutas) {
  var lista = Array.isArray(rutas) ? rutas : RUTAS_MULTIVIAJE;
  for (var i = 0; i < lista.length; i++) {
    var r = lista[i];
    if (coincideTexto(cliente, r.cliente) && coincideTexto(origen, r.origen) && coincideTexto(destino, r.destino)) {
      return r;
    }
  }
  return null;
}

/**
 * Regla determinista del §1: decide si `cantidad` de la ficha son kg o numero de
 * viajes. NO adivina: o la ruta esta registrada, o la red de seguridad la manda
 * a REVISAR.
 *
 * @param {number|null} cantidad  el valor leido del campo cantidad de la ficha.
 * @returns {{modo:'viajes'|'kg'|'revisar', n_viajes:number|null, kg:number|null,
 *            motivo:string|null, ruta:object|null}}
 */
function clasificarCantidad(cantidad, cliente, origen, destino, rutas) {
  var ruta = esRutaMultiviaje(cliente, origen, destino, rutas);
  var c = (typeof cantidad === 'number' && isFinite(cantidad)) ? cantidad : null;
  if (ruta) {
    // Ruta multi-viaje: cantidad = numero de viajes. Si no se leyo, el caller lo
    // manda a REVISAR (no se puede expandir sin saber cuantos).
    return { modo: 'viajes', n_viajes: (c && c > 0) ? c : null, kg: null, motivo: null, ruta: ruta };
  }
  if (c !== null && c < UMBRAL_CANTIDAD_KG) {
    return { modo: 'revisar', n_viajes: 1, kg: null, motivo: 'posible_multiviaje_ruta_no_registrada', ruta: null };
  }
  return { modo: 'kg', n_viajes: 1, kg: c, motivo: null, ruta: null };
}

// --- CLIENTES_CONOCIDOS: lista configurable, unico lugar (Cierre v1, pieza 1) -
// Un cliente leido fuera de esta lista NUNCA recibe regimen por defecto: eso fue
// el bug real (gpt-4o leyo "FORBA" -- misread de FORESA -- y el sistema le asigno
// 'linea' en silencio, cuando por D-06 le tocaba 'agregada_quincenal'). La solucion
// NO es un alias de FORBA: un alias por cada misread convierte un error de lectura
// en regla de negocio, y manana aparece "FORESAA" o "FORFSA". Un cliente fuera de
// esta lista falla RUIDOSO (REVISAR con el valor leido en el motivo), nunca en
// silencio. Para sumar un cliente real nuevo: agregarlo aca, nada mas.
var CLIENTES_CONOCIDOS = ['FORESA', 'BRESFOR', 'QUIMIDROGA', 'RNM', 'HELM', 'BALTRANSA'];

/** ¿El cliente leido esta en la lista de clientes conocidos? */
function esClienteConocido(cliente, clientes) {
  var lista = Array.isArray(clientes) ? clientes : CLIENTES_CONOCIDOS;
  var cl = norm(cliente);
  if (!cl) { return false; }
  for (var i = 0; i < lista.length; i++) {
    if (cl.indexOf(norm(lista[i])) >= 0) { return true; }
  }
  return false;
}

/**
 * Regimen de indexacion (suplemento gasoleo) por cliente + ruta (D-03 y D-06).
 * NO calcula la indexacion — solo marca el regimen; el calculo se cierra en la
 * facturacion (D-03, encargo §8 fuera de alcance). Routing de dominio, tabla
 * configurable como RUTAS_MULTIVIAJE.
 *
 *   incluida            Baltransa: la tarifa ya la contiene, no se agrega.
 *   agregada_mensual    FORESA Villagarcia -> Caldas (metanol): un total por mes.
 *   agregada_quincenal  FORESA Caldas de Reis -> Ourense (Orember): total quincenal.
 *   linea               caso general (FORESA otros destinos, Quimidroga, RNM...).
 *
 * Cliente fuera de CLIENTES_CONOCIDOS (o no leido): NO se asigna regimen por
 * defecto. Devuelve motivo para que el caller marque el viaje REVISAR con el
 * valor leido visible (Cierre v1, pieza 1) — el error de lectura no debe
 * disfrazarse de decision de negocio.
 *
 * @returns {{regimen: 'incluida'|'agregada_mensual'|'agregada_quincenal'|'linea'|null,
 *            motivo: string|null}}
 */
function regimenIndexacion(cliente, origen, destino, clientes, modalidad) {
  if (!esClienteConocido(cliente, clientes)) {
    return { regimen: null, motivo: 'cliente_no_reconocido: ' + (nz_local(cliente) || '(no se leyo)') };
  }
  // EVIDENCIA PRIMERO. Si se inyecto la modalidad deducida del historico
  // (ficha/modalidad-indexacion.js), manda esa: dice como se le facturo REALMENTE
  // la indexacion a este cliente, en vez de adivinarlo por la ruta. Las reglas de
  // ruta de abajo quedan como respaldo para cuando no hay historico cargado.
  //   'sin_indexacion' se propaga tal cual: es una respuesta valida (hay clientes
  //     cuya factura no lleva indexacion) y hasta ahora se perdia bajo el default.
  //   'agregada' sin distinguir quincenal/mensual tambien se propaga: el corte
  //     real lo dan los tramos de pct, no el calendario (ver modalidad-indexacion).
  //   modalidad null (cliente que factura de las dos formas, o sin evidencia) NO
  //     cae al default: devuelve null + motivo para que el viaje vaya a REVISAR.
  var cl = norm(cliente);
  var esForesa = cl.indexOf('FORESA') >= 0 || cl.indexOf('BRESFOR') >= 0;

  // FORESA es el unico cliente MIXTO: parte de sus servicios se indexa por viaje
  // y parte agregado. Eso NO se resuelve por cliente, se resuelve por RUTA, con
  // las reglas confirmadas por Julio y verificadas sobre el CSV (cobertura de
  // linea por ruta): Metanol Villagarcia->Caldas = agregada mensual; destino
  // Orember = agregada quincenal; el resto (Foresa otros, Villagarcia otros,
  // Retornos) = por linea. Por eso, para Foresa, la ruta manda AUN cuando el
  // historico dijo 'mixta' — si dijera 'linea' o 'agregada' a secas seria una
  // media del cliente, no la del servicio.
  if (esForesa) {
    if (coincideTexto(origen, 'VILLAGARCIA') && coincideTexto(destino, 'CALDAS')) {
      return { regimen: 'agregada_mensual', motivo: null };
    }
    if (coincideTexto(destino, 'OREMBER')) {
      return { regimen: 'agregada_quincenal', motivo: null };
    }
    if (coincideTexto(origen, 'CALDAS') && (coincideTexto(destino, 'OURENSE') || coincideTexto(destino, 'ORENSE'))) {
      return { regimen: 'agregada_quincenal', motivo: null };
    }
    return { regimen: 'linea', motivo: null }; // Foresa otros / Villagarcia otros / Retornos (D-06, confirmado).
  }

  // EVIDENCIA PRIMERO para el resto. Si se inyecto la modalidad deducida del
  // historico (ficha/modalidad-indexacion.js), manda esa: dice como se le facturo
  // REALMENTE la indexacion a este cliente, en vez de adivinarla.
  //   'sin_indexacion' se propaga tal cual (hay clientes cuya factura no la lleva).
  //   'agregada' se propaga (el corte real lo dan los tramos de pct, no el mes).
  //   modalidad null (sin evidencia) NO cae al default: null + motivo -> REVISAR.
  if (modalidad && modalidad.fuente && modalidad.fuente !== 'ninguna') {
    if (modalidad.modalidad === null) {
      return { regimen: null, motivo: modalidad.motivo };
    }
    return { regimen: modalidad.modalidad, motivo: modalidad.revisar ? modalidad.motivo : null };
  }
  if (cl.indexOf('BALTRANSA') >= 0) { return { regimen: 'incluida', motivo: null }; }
  return { regimen: 'linea', motivo: null }; // QUIMIDROGA, RNM, HELM: por viaje (regla general).
}
// nz_local: version standalone de nz (correlacionar.js la tiene con otro nombre;
// aca solo hace falta para el mensaje de motivo, sin acoplar los dos modulos).
function nz_local(x) { if (x === null || x === undefined) { return null; } var s = String(x).trim(); return (s === '' || s.toLowerCase() === 'null') ? null : s; }

/**
 * Reparte los km del bloque entre n viajes (§1). Piso entero a cada uno y el
 * RESTO al ultimo, para que la suma de los n cierre EXACTAMENTE con el total del
 * bloque. Regla fija y documentada; si cambia, cambia aca y en el test.
 *
 * @returns {number[]} n enteros cuya suma es kmBloque (o [] si no hay dato).
 */
function repartirKm(kmBloque, n) {
  if (kmBloque === null || kmBloque === undefined || !isFinite(kmBloque)) { return []; }
  if (!Number.isInteger(n) || n <= 0) { return []; }
  var base = Math.floor(kmBloque / n);
  var out = [];
  for (var i = 0; i < n; i++) { out.push(base); }
  out[n - 1] += (kmBloque - base * n);
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RUTAS_MULTIVIAJE: RUTAS_MULTIVIAJE,
    UMBRAL_CANTIDAD_KG: UMBRAL_CANTIDAD_KG,
    CLIENTES_CONOCIDOS: CLIENTES_CONOCIDOS,
    norm: norm,
    coincideTexto: coincideTexto,
    esRutaMultiviaje: esRutaMultiviaje,
    esClienteConocido: esClienteConocido,
    clasificarCantidad: clasificarCantidad,
    regimenIndexacion: regimenIndexacion,
    repartirKm: repartirKm,
  };
}

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

// ===== LOOKUP DE TARIFAS — planilla carga/auditoria (v1.1 pieza 2) ==========
//
// Busca la tarifa vigente de un viaje contra la tabla real `Tarifas`
// (Siwhv2AUWTSeFlrJ, 698 filas tras la recarga del Excel 2026-08-04). Schema
// real: cliente, origen, destino, material, tarifa_tn (string), precio_fijo
// (string), vigente_desde (string).
//
// IDENTIDAD DE CLIENTE (encargo 2026-08-04): el Excel trae RAZON SOCIAL
// completa en `cliente` ("FORESA IND.QUIMICAS DEL NOROESTE, S.A."). El cliente
// del viaje se resuelve a esa razon social por MAPA EXPLICITO (ficha/clientes.js)
// y se compara EXACTO — nunca por fragmento sobre `cliente`, porque un fragmento
// cruza razones sociales distintas y facturaria en silencio la tarifa de otro.
//
// ORIGEN/DESTINO si admiten fallback por FRAGMENTO (geografia con solapes
// esperables): el schema mete a veces mas de un lugar o un codigo de pais en la
// misma celda ("LEIRIA (PT)", "BRESFOR (AVEIRO)"). El fallback matchea el
// fragmento separado por / ( ) , cuando el texto completo no coincide. Ejemplo
// real: ficha "LEIRIA PORTUGAL" vs tarifa "LEIRIA (PT)" -> el fragmento
// "LEIRIA" matchea. (La recarga atomizo los origenes empacados tipo
// "CALDAS/VILLAGARCIA" del tarifario viejo, pero el fallback se mantiene para
// las formas con parentesis/codigo de pais que siguen existiendo.)
//
// Cuando hay mas de una fila para la misma ruta con distinta vigencia, se elige
// la vigente a la fecha del viaje, no la primera que aparezca.

'use strict';

var CRUCE_TAR = (typeof coincideTexto === 'function')
  ? { coincideTexto: coincideTexto, norm: norm }
  : require('./cruce.js');

var CLIENTES_TAR = (typeof resolverCliente === 'function')
  ? { resolverCliente: resolverCliente }
  : require('./clientes.js');

// Fragmentos de 2 caracteres o menos (codigos de pais: PT, ES, IT, FR...) se
// descartan del fallback: son sustring de casi cualquier lectura de OCR con
// esas dos letras seguidas (bug real encontrado en la corrida en vivo del
// 2026-08-03 -- "AVEPTO", misread de AVEIRO, matcheaba "AZAMBUJA(PT)" por el
// fragmento suelto "PT", asignando una tarifa de una ruta que no tiene nada
// que ver). Ningun nombre de lugar real en esta tabla tiene 2 caracteres.
var LARGO_MINIMO_TOKEN = 3;

/** Separa "CALDAS/VILLAGARCIA", "BRESFOR (AVEIRO)", "LEIRIA (PT)" en fragmentos. */
function tokens(s) {
  var n = CRUCE_TAR.norm(s);
  if (!n) { return []; }
  return n.split(/[/(),]+/).map(function (t) { return t.trim(); }).filter(function (t) { return t.length >= LARGO_MINIMO_TOKEN; });
}

/**
 * Compara un valor de la ficha (origen o destino) contra el valor de una fila
 * de Tarifas. 'DIRECTO' si coincide el texto completo (coincideTexto de
 * cruce.js, ya bidireccional). 'TOKEN' si coincide algun fragmento separado
 * por / ( ) , -- esto ES el fallback por provincia (ver nota de cabecera).
 * null si no coincide de ninguna forma.
 */
function matchCampo(valorFicha, valorTarifa) {
  if (CRUCE_TAR.coincideTexto(valorFicha, valorTarifa)) { return 'DIRECTO'; }
  var tv = tokens(valorFicha);
  var tf = tokens(valorTarifa);
  for (var i = 0; i < tv.length; i++) {
    for (var j = 0; j < tf.length; j++) {
      if (CRUCE_TAR.coincideTexto(tv[i], tf[j])) { return 'TOKEN'; }
    }
  }
  return null;
}

function peorNivel(a, b) {
  return (a === 'TOKEN' || b === 'TOKEN') ? 'TOKEN' : 'DIRECTO';
}

/** {tipo:'tn'|'fijo', valor:number} desde tarifa_tn/precio_fijo (strings en la tabla real). */
function valorTarifa(fila) {
  if (fila.tarifa_tn !== '' && fila.tarifa_tn !== null && fila.tarifa_tn !== undefined) {
    var tn = parseFloat(fila.tarifa_tn);
    if (isFinite(tn)) { return { tipo: 'tn', valor: tn }; }
  }
  if (fila.precio_fijo !== '' && fila.precio_fijo !== null && fila.precio_fijo !== undefined) {
    var fijo = parseFloat(fila.precio_fijo);
    if (isFinite(fijo)) { return { tipo: 'fijo', valor: fijo }; }
  }
  return null;
}

/**
 * Busca la tarifa vigente de un viaje. NUNCA inventa: sin identidad de cliente
 * resuelta o sin match de razon social + origen + destino -> SIN_TARIFA con
 * motivo visible (el viaje queda REVISAR en la planilla).
 *
 * @param {object} viaje  {cliente, origen, destino, fecha}
 * @param {Array<object>} tarifasRows  filas crudas de la tabla Tarifas.
 * @returns {{estado:'DIRECTO'|'FALLBACK_PROVINCIA'|'SIN_TARIFA',
 *            tarifa:{tipo,valor}|null, fila:object|null, motivo:string|null}}
 */
function buscarTarifa(viaje, tarifasRows) {
  var v = viaje || {};
  var filas = Array.isArray(tarifasRows) ? tarifasRows : [];

  // 1) Identidad: cliente leido -> razon social exacta (mapa explicito). Un
  //    codigo sin razon social mapeada NO recibe tarifa a ciegas: falla ruidoso
  //    con el valor leido en el motivo (mismo patron que "cliente no reconocido").
  var ident = CLIENTES_TAR.resolverCliente(v.cliente);
  if (!ident.razonSocial) {
    return { estado: 'SIN_TARIFA', tarifa: null, fila: null, motivo: ident.motivo || 'cliente_no_mapeado' };
  }
  var clienteObjetivo = CRUCE_TAR.norm(ident.razonSocial);

  // 2) Candidatas: match EXACTO de razon social (identidad), fragmento solo en
  //    origen/destino (geografia).
  var candidatas = [];
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (CRUCE_TAR.norm(f.cliente) !== clienteObjetivo) { continue; }
    var nivelOrigen = matchCampo(v.origen, f.origen);
    var nivelDestino = matchCampo(v.destino, f.destino);
    if (!nivelOrigen || !nivelDestino) { continue; }
    candidatas.push({ fila: f, nivel: peorNivel(nivelOrigen, nivelDestino) });
  }

  if (!candidatas.length) {
    return {
      estado: 'SIN_TARIFA', tarifa: null, fila: null,
      motivo: 'sin_tarifa: ' + ident.razonSocial + ' ' + (v.origen || '?') + ' -> ' + (v.destino || '?')
    };
  }

  // vigente_desde <= fecha del viaje, la mas reciente de las vigentes; si no
  // hay fecha o ninguna vigencia es anterior, la mas reciente de todas.
  var fecha = v.fecha || null;
  var aplicables = fecha
    ? candidatas.filter(function (c) { return (c.fila.vigente_desde || '') <= fecha; })
    : [];
  var pool = aplicables.length ? aplicables : candidatas;
  pool.sort(function (a, b) { return (b.fila.vigente_desde || '').localeCompare(a.fila.vigente_desde || ''); });
  var elegida = pool[0];

  var tarifa = valorTarifa(elegida.fila);
  if (!tarifa) {
    return {
      estado: 'SIN_TARIFA', tarifa: null, fila: elegida.fila,
      motivo: 'tarifa_sin_valor: fila id ' + elegida.fila.id + ' sin tarifa_tn ni precio_fijo'
    };
  }

  return {
    estado: elegida.nivel === 'DIRECTO' ? 'DIRECTO' : 'FALLBACK_PROVINCIA',
    tarifa: tarifa,
    fila: elegida.fila,
    motivo: null
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // identidad de cliente vive en clientes.js; se re-exporta para que quien ya
    // importa tarifas.js pueda resolver sin conocer el modulo nuevo.
    resolverCliente: CLIENTES_TAR.resolverCliente,
    tokens: tokens,
    matchCampo: matchCampo,
    valorTarifa: valorTarifa,
    buscarTarifa: buscarTarifa
  };
}

// ===== INDEXACION (suplemento gasoleo) — planilla carga/auditoria (v1.1 p.2) =
//
// Resuelve el % de indexacion para viajes en regimen 'linea' contra la tabla
// real `Indexacion` (or1otD9WsjJ3V8Cr). Schema real confirmado por readback
// 2026-08-03: cliente (en realidad GRUPO, no el cliente del viaje), tipo,
// pct (string), desde, hasta.
//
// HALLAZGO del readback: la tabla tiene 37.660 filas en bruto, pero son 70
// tramos reales duplicados exactamente x538 (= el numero de filas de
// Tarifas -- huella de un bug de carga, probablemente un cruce accidental
// contra Tarifas al popular la tabla). docs/brief-v3-oficina-agentica.md ya
// documentaba "70 tramos, 6 solapas oficiales" -- consistente con los 70
// tramos unicos verificados. deduplicarIndexacion() hace esa limpieza; el
// nodo que lee la tabla la llama antes de armar la planilla (ver
// nodo-planilla.wrapper.js). NO corrige la tabla en n8n -- eso es un cambio de
// datos, fuera de alcance de esta pieza; solo evita arrastrar el bug a la
// busqueda.
//
// Grupos reales confirmados (docs/reglas-facturacion.md "Grupos de indexacion
// (confirmado)"): FORESA-BRESFOR, QUIMIDROGA, HELM, OTROS, AGENCIA, AUTONOMOS.
// AGENCIA/AUTONOMOS no tienen regla de asignacion por cliente documentada
// ("pendientes" en docs/reglas-facturacion.md) -- este modulo NO los asigna
// nunca via cliente, para no inventar una regla de negocio que no esta
// confirmada.
//
// D-03 / nota del encargo: la indexacion AGREGADA (quincenal/mensual) NO se
// CIERRA aca -- el importe de la fila sigue siendo null y se cierra en
// facturacion. Lo que SI hace ahora (2026-08-26) es resolver el tramo vigente y
// exponer la base que ese viaje aporta al periodo (`base_periodo`), para que
// ficha/modalidad-indexacion.js la acumule por tramo. Antes el caso agregado
// quedaba ciego hasta que llegaba la factura, que es justo cuando ya no se puede
// verificar. Exponer la base no es calcular el cobro: es poder auditarlo.
//
// De donde sale el regimen: ficha/modalidad-indexacion.js lo deduce del
// HISTORICO del cliente (que indexacion se le aplico realmente), no de reglas de
// ruta cableadas. Ver la cabecera de ese modulo para los tres defectos que eso
// corrige, entre ellos el default `linea` que le inventaba una indexacion a los
// clientes que no la llevan.

'use strict';

var CRUCE_IDX = (typeof norm === 'function') ? { norm: norm } : require('./cruce.js');

function round2(n) { return Math.round(n * 100) / 100; }

/**
 * Limpia la duplicacion x538 de la tabla real (ver nota de cabecera): agrupa
 * por (cliente, tipo, pct, desde, hasta) y se queda con una fila por
 * combinacion unica. Idempotente -- correrla sobre datos ya limpios no cambia
 * nada. NO escribe de vuelta en n8n, solo filtra en memoria para la busqueda.
 */
function deduplicarIndexacion(indexacionRows) {
  var filas = Array.isArray(indexacionRows) ? indexacionRows : [];
  var vistos = {};
  var out = [];
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    var clave = [f.cliente, f.tipo, f.pct, f.desde, f.hasta].join('|');
    if (vistos[clave]) { continue; }
    vistos[clave] = true;
    out.push(f);
  }
  return out;
}

/**
 * Grupo de indexacion (solapa) para un cliente de viaje, segun
 * docs/reglas-facturacion.md "Grupos de indexacion (confirmado)":
 *   FORESA, BRESFOR -> FORESA-BRESFOR
 *   QUIMIDROGA -> QUIMIDROGA
 *   HELM -> HELM
 *   RNM -> OTROS (RNM no tiene solapa propia, confirmado en factura)
 *   QUIMICAS DEL JARAMA -> OTROS (confirmado, "indexacion (OTROS)")
 *   cualquier otro cliente -> OTROS por defecto (D-5), con aviso visible.
 */
function grupoIndexacion(clienteViaje) {
  var cl = CRUCE_IDX.norm(clienteViaje);
  if (cl && (cl.indexOf('FORESA') >= 0 || cl.indexOf('BRESFOR') >= 0)) { return { grupo: 'FORESA-BRESFOR', motivo: null }; }
  if (cl && cl.indexOf('QUIMIDROGA') >= 0) { return { grupo: 'QUIMIDROGA', motivo: null }; }
  if (cl && cl.indexOf('HELM') >= 0) { return { grupo: 'HELM', motivo: null }; }
  if (cl && cl.indexOf('RNM') >= 0) { return { grupo: 'OTROS', motivo: null }; }
  if (cl && cl.indexOf('JARAMA') >= 0) { return { grupo: 'OTROS', motivo: null }; }
  return { grupo: 'OTROS', motivo: 'grupo_por_defecto: cliente "' + (clienteViaje || '(no leido)') + '" sin regla explicita (D-5)' };
}

/**
 * Tramo vigente [desde,hasta] (inclusive, texto ISO) para un grupo+fecha.
 *
 * SOLAPES: los tramos del Suplemento Gasoleo comparten el dia de corte
 * (2026-06-01->06-07 y 2026-06-07->06-15), asi que una fecha puede caer en dos.
 * Quedarse con "el primero que matchea" era arbitrario y en HELM cambia el
 * numero: el 2026-06-07 cae en un tramo al 0,1256 y en otro al 0,1141.
 *   - si todos los tramos que matchean tienen el MISMO pct -> no hay ambiguedad
 *   - si difieren -> NO se elige: se devuelve ambiguo para que el viaje vaya a
 *     REVISAR con los dos candidatos a la vista. Elegir uno es elegir cuanto se
 *     factura.
 *
 * @returns {{pct, fila, ambiguo:boolean, candidatas:Array}|null}
 */
function buscarPct(grupo, fecha, indexacionRows) {
  var filas = Array.isArray(indexacionRows) ? indexacionRows : [];
  if (!fecha) { return null; }
  var hits = [];
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (CRUCE_IDX.norm(f.cliente) !== grupo) { continue; }
    if ((f.desde || '') <= fecha && fecha <= (f.hasta || '')) {
      var pct = parseFloat(f.pct);
      if (isFinite(pct)) { hits.push({ pct: pct, fila: f }); }
    }
  }
  if (!hits.length) { return null; }
  var distintos = {};
  for (var j = 0; j < hits.length; j++) { distintos[hits[j].pct] = true; }
  var claves = Object.keys(distintos);
  if (claves.length === 1) {
    return { pct: hits[0].pct, fila: hits[0].fila, ambiguo: false, candidatas: hits };
  }
  return {
    pct: null, fila: null, ambiguo: true, candidatas: hits,
    motivo: 'la fecha ' + fecha + ' cae en ' + hits.length + ' tramos de ' + grupo +
      ' con porcentajes distintos (' + claves.join(' / ') + '): el suplemento tiene los bordes solapados, hay que decidir cual rige'
  };
}

/**
 * Indexacion para una fila de la planilla. NUNCA calcula un importe para
 * regimen agregado (D-03): solo marca el regimen. Para 'linea' SI calcula,
 * sobre el importe de transporte de la linea (D-08).
 *
 * @param {object} viaje  {cliente, fecha, regimen_indexacion}
 * @param {number|null} importeLinea  cantidad x tarifa ya calculado (D-08 base).
 * @param {Array<object>} indexacionRows  filas DEDUPLICADAS de Indexacion.
 * @returns {{modo:'calculada'|'regimen_pendiente'|'incluida'|'sin_regimen',
 *            pct:number|null, importe:number|null, grupo:string|null,
 *            etiqueta:string, motivo:string|null}}
 */
function indexacionDeFila(viaje, importeLinea, indexacionRows) {
  var v = viaje || {};
  var regimen = v.regimen_indexacion;

  if (regimen === 'incluida') {
    return { modo: 'incluida', pct: 0, importe: 0, grupo: null, etiqueta: 'incluida', motivo: null };
  }
  // El cliente NO lleva indexacion (Tank Solutions, Transportes Santos,
  // Hispalense — confirmado en facturas). Es una respuesta, no un hueco: cero es
  // el numero correcto y la fila no debe ir a REVISAR por esto.
  if (regimen === 'sin_indexacion') {
    return { modo: 'sin_indexacion', pct: 0, importe: 0, grupo: null, etiqueta: 'sin indexacion', motivo: null };
  }
  if (regimen === 'agregada_quincenal' || regimen === 'agregada_mensual' || regimen === 'agregada') {
    // La indexacion agregada NO se cierra por viaje (D-03): el importe de esta
    // fila sigue siendo null. Pero SI se resuelve el tramo vigente y se expone
    // la base que este viaje aporta al periodo, para que acumularPorPeriodo()
    // pueda sumarla y el operador vea cuanto lleva devengado antes de que
    // llegue la factura. Antes esto quedaba ciego hasta la facturacion.
    var gA = grupoIndexacion(v.cliente);
    var hitA = buscarPct(gA.grupo, v.fecha, indexacionRows);
    if (hitA && hitA.ambiguo) { hitA = null; }
    var baseA = (typeof importeLinea === 'number' && isFinite(importeLinea)) ? round2(importeLinea) : null;
    return {
      modo: 'regimen_pendiente', pct: hitA ? hitA.pct : null, importe: null,
      grupo: gA.grupo, base_periodo: baseA, aporta_al_periodo: true,
      etiqueta: regimen + ' (aporta ' + (baseA === null ? '?' : baseA) + ' EUR al periodo' +
        (hitA ? ' @ ' + round2(hitA.pct * 100) + '%' : ', sin tramo vigente') + ')',
      motivo: hitA ? null : ('sin_tramo_vigente: ' + gA.grupo + ' @ ' + (v.fecha || '(sin fecha)'))
    };
  }
  if (regimen !== 'linea') {
    return { modo: 'sin_regimen', pct: null, importe: null, grupo: null, etiqueta: '-', motivo: 'sin_regimen_indexacion' };
  }

  var g = grupoIndexacion(v.cliente);
  var hit = buscarPct(g.grupo, v.fecha, indexacionRows);
  if (hit && hit.ambiguo) {
    return { modo: 'sin_regimen', pct: null, importe: null, grupo: g.grupo, etiqueta: '-', motivo: hit.motivo };
  }
  if (!hit) {
    return {
      modo: 'sin_regimen', pct: null, importe: null, grupo: g.grupo, etiqueta: '-',
      motivo: 'sin_tramo_vigente: ' + g.grupo + ' @ ' + (v.fecha || '(sin fecha)')
    };
  }
  var importe = (typeof importeLinea === 'number' && isFinite(importeLinea)) ? round2(importeLinea * hit.pct) : null;
  return {
    modo: 'calculada', pct: hit.pct, importe: importe, grupo: g.grupo,
    etiqueta: round2(hit.pct * 100) + '%' + (g.motivo ? ' (' + g.motivo + ')' : ''),
    motivo: null
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    deduplicarIndexacion: deduplicarIndexacion,
    grupoIndexacion: grupoIndexacion,
    buscarPct: buscarPct,
    indexacionDeFila: indexacionDeFila
  };
}

// ===== MODALIDAD DE INDEXACION — por LINEA o por PERIODO ======================
//
// EL PROBLEMA (3 defectos reales del estado anterior, cruce.js:regimenIndexacion)
//
// 1) LA MODALIDAD SE DECIDIA POR RUTAS CABLEADAS.
//    `if (origen VILLAGARCIA && destino CALDAS DE REIS) -> agregada_mensual`.
//    Funciona para los dos servicios de Foresa que estaban a la vista y para
//    nada mas. El dia que Foresa agrega un tercer servicio agregado, o que otro
//    cliente pasa a facturar por periodo, la ruta nueva no matchea y el viaje se
//    va por `linea` EN SILENCIO: se le calcula una indexacion por viaje a algo
//    que el cliente factura acumulado. Se factura dos veces o se factura mal.
//
// 2) EL DEFAULT ERA `linea` PARA TODO CLIENTE CONOCIDO. Eso es empiricamente
//    FALSO. docs/reglas-facturacion.md, verificado contra facturas de junio:
//      TANK SOLUTIONS      "cerrado, SIN indexacion"
//      TRANSPORTES SANTOS  "cerrado, SIN indexacion"
//      HISPALENSE          "por tn, SIN indexacion"
//    A esos tres el default les inventaba una linea de indexacion que el cliente
//    no paga. Inventar un cobro es peor que dejarlo vacio: se descubre en la
//    reclamacion del cliente, no en la revision.
//
// 3) EL REGIMEN AGREGADO NUNCA PRODUCIA UN NUMERO. indexacion.js devolvia
//    `regimen_pendiente` con importe null y ahi moria. Como v1 era una parada
//    prudente, pero deja el caso agregado CIEGO: nadie sabe cuanta base lleva
//    acumulada el periodo hasta que llega la factura, que es exactamente cuando
//    ya no se puede verificar.
//
// LA SOLUCION
//
// A) LA MODALIDAD SALE DEL HISTORICO, no de reglas de ruta. Mismo principio que
//    el resto del sistema: conjunto cerrado + evidencia. Que indexacion se le
//    aplico REALMENTE a ese cliente durante el año lo dice el export de Gesruta:
//      - tiene portes y CERO lineas de indexacion  -> sin_indexacion
//      - lineas de indexacion todas a importe 0    -> incluida (Baltransa)
//      - base de la indexacion == importe del propio porte -> linea
//      - base acumulada (>> el porte de esa linea) -> agregada
//    Esto cubre Baltransa y los dos servicios agregados de Foresa sin nombrar
//    ninguna ruta, y cubre solo los tres "sin indexacion" porque el dato lo dice.
//
// B) EL PERIODO SE AGRUPA POR TRAMO DE PCT VIGENTE, NO POR CALENDARIO.
//    docs/reglas-facturacion.md lo advierte explicitamente:
//      "Los tramos dependen de como se actualizo ese mes: puede ser quincenal,
//       una vez al mes, o mas. NO asumir quincenas fijas."
//    y describe el metanol mensual "con lineas agregadas por tramo de pct dentro
//    del mes". O sea: la unidad real de agregacion es el TRAMO, y quincenal y
//    mensual son dos casos particulares de lo mismo. Agrupando por tramo salen
//    los dos bien, y tambien el "o mas" que todavia no vimos.
//    Las etiquetas G1Q / G2Q son texto de Gesruta, NO definen el corte.
//
// C) LA BASE ES SOLO PORTE (D-08). Los repartos (90 eur de traslado), la
//    paralizacion y los lavados quedan FUERA de la base de indexacion.
//    Confirmado en factura 298.
//
// Logica PURA (sin n8n): el historico y los tramos se inyectan.

'use strict';

var MI_CRUCE = (typeof norm === 'function') ? { norm: norm } : require('./cruce.js');

function round2(n) { return Math.round(n * 100) / 100; }

// Conceptos que suman a la BASE de indexacion. Solo transporte (D-08).
var CONCEPTOS_PORTE = { 'P': true, 'PI': true };
// Conceptos que SON lineas de indexacion.
var CONCEPTOS_INDEXACION = { 'G': true, 'GPT': true, 'G1Q': true, 'G2Q': true };

// Umbrales de COBERTURA (fraccion de albaranes con linea propia de indexacion).
// No son una eleccion: caen en el hueco que deja el dato real. Por ruta de Foresa
// las coberturas observadas son 2,0 / 3,0 / 6,9 % (agregadas) y 46,2 / 56,2 /
// 60,0 / 69,6 / 78,0 / 83,3 % (por viaje). Entre 7 y 46 % no hay ninguna.
var COBERTURA_LINEA = 0.40;
var COBERTURA_AGREGADA = 0.20;
// Con menos albaranes que esto, "sin indexacion" no es evidencia: puede ser que
// en esa muestra no hubo. Decirlo mal deja de facturar un cobro real.
var ALBARANES_MINIMOS = 8;

function num(x) {
  var n = Number(String(x === null || x === undefined ? '' : x).replace(',', '.'));
  return isFinite(n) ? n : null;
}

/**
 * Deduce, cliente por cliente, COMO se le aplica la indexacion, mirando lo que
 * realmente se le facturo durante el año.
 *
 * Se agrupa por albaran porque es la unidad donde conviven el porte y su linea
 * de indexacion; comparar la base contra el porte de ese mismo albaran es lo que
 * distingue "por linea" de "acumulada".
 *
 * @param {Array<object>} lineas  export de Gesruta: {cliente, albaran, viaje,
 *        codcon, cantid|cant, precio, import}
 * @returns {object} { codigoCliente: {modalidad, portes, conLinea, conAgregada,
 *                     enCero, sinIndexacion, evidencia} }
 */
function modalidadPorHistorico(lineas) {
  var filas = Array.isArray(lineas) ? lineas : [];

  // 1) Agrupar por albaran (cliente + viaje + albaran).
  var albaranes = {};
  for (var i = 0; i < filas.length; i++) {
    var L = filas[i] || {};
    var cli = String(L.cliente || '').trim();
    if (!cli) { continue; }
    var cod = String(L.codcon || L.concepto || '').toUpperCase();
    if (!CONCEPTOS_PORTE[cod] && !CONCEPTOS_INDEXACION[cod]) { continue; }
    var k = cli + '|' + String(L.viaje || '') + '|' + String(L.albaran || '');
    if (!albaranes[k]) { albaranes[k] = { cliente: cli, portes: [], idx: [] }; }
    var reg = {
      concepto: cod,
      cantidad: num(L.cantid !== undefined ? L.cantid : L.cant),
      precio: num(L.precio),
      importe: num(L.import !== undefined ? L.import : L.importe)
    };
    if (CONCEPTOS_PORTE[cod]) { albaranes[k].portes.push(reg); } else { albaranes[k].idx.push(reg); }
  }

  // 2) Por cliente, contar CUANTOS ALBARANES llevan su propia linea de indexacion.
  //
  // CORRECCION 2026-08-26, sobre PRUEBA_2608_LINEA_FACTURACION.CSV: la señal que
  // se usaba antes (comparar la BASE de la linea contra el porte) casi no aplica
  // en el dato real. Gesruta escribe el 94 % de las lineas de indexacion como
  // `cantidad = 1, precio = importe`, sin base explicita; solo 7 de 656 traen la
  // base en la cantidad. Esa heuristica se apoyaba en los G1Q/G2Q, que son minoria.
  //
  // La señal ROBUSTA es la COBERTURA: que fraccion de los albaranes con porte de
  // ese cliente (o de esa ruta) lleva su propia linea de indexacion.
  //   ~todos    -> se itemiza por viaje              -> linea
  //   ~ninguno  -> se acumula y se factura aparte    -> agregada
  //   todas a 0 -> la tarifa ya la contiene          -> incluida
  //   ninguna   -> ese cliente no lleva indexacion   -> sin_indexacion
  //
  // Y la separacion NO es una eleccion nuestra: esta en el dato. Por ruta de
  // Foresa las coberturas son 2,0 % / 3,0 % / 6,9 % (las agregadas) y luego
  // 46,2 % / 56,2 % / 60,0 % / 69,6 % / 78,0 % / 83,3 % (las de por viaje).
  // Entre el 7 % y el 46 % no hay ninguna ruta: el umbral cae en un hueco real.
  var CONT = {};
  for (var kk in albaranes) {
    if (!Object.prototype.hasOwnProperty.call(albaranes, kk)) { continue; }
    var A = albaranes[kk];
    if (!A.portes.length) { continue; }        // sin porte no hay base que juzgar
    if (!CONT[A.cliente]) {
      CONT[A.cliente] = { portes: 0, conLinea: 0, conAgregada: 0, enCero: 0, sinIndexacion: 0 };
    }
    var C = CONT[A.cliente];
    C.portes++;
    if (!A.idx.length) { C.sinIndexacion++; continue; }
    var algunaConValor = false, algunaCero = false;
    for (var j = 0; j < A.idx.length; j++) {
      if (A.idx[j].importe) { algunaConValor = true; } else { algunaCero = true; }
    }
    if (algunaConValor) { C.conLinea++; } else if (algunaCero) { C.enCero++; }
  }

  // 3) Decidir la modalidad de cada cliente.
  var out = {};
  for (var cli2 in CONT) {
    if (!Object.prototype.hasOwnProperty.call(CONT, cli2)) { continue; }
    var v = CONT[cli2];
    var cobertura = v.portes ? (v.conLinea / v.portes) : 0;
    var modalidad;
    if (v.conLinea === 0 && v.enCero === 0) {
      modalidad = 'sin_indexacion';
    } else if (v.conLinea === 0 && v.enCero > 0) {
      modalidad = 'incluida';
    } else if (cobertura >= COBERTURA_LINEA) {
      modalidad = 'linea';
    } else if (cobertura <= COBERTURA_AGREGADA) {
      modalidad = 'agregada';
    } else {
      // Zona intermedia: el cliente factura de las dos formas segun el servicio
      // (Foresa) o la muestra no alcanza. No se elige una: se decide por viaje.
      modalidad = 'mixta';
    }
    // EVIDENCIA MINIMA. "Sin indexacion" con 2 o 3 albaranes no es evidencia de
    // nada: puede ser que en esa muestra no hubo indexacion. Decir que un cliente
    // no se indexa cuando si se indexa deja de facturar un cobro real.
    var floja = (v.portes < ALBARANES_MINIMOS) && (modalidad === 'sin_indexacion');
    out[cli2] = {
      modalidad: floja ? 'mixta' : modalidad,
      cobertura: Math.round(cobertura * 1000) / 1000,
      portes: v.portes, conLinea: v.conLinea, conAgregada: v.conAgregada,
      enCero: v.enCero, sinIndexacion: v.sinIndexacion, evidenciaFloja: floja,
      evidencia: v.portes + ' albaranes con porte, ' + v.conLinea + ' con linea propia de indexacion (' +
        Math.round(cobertura * 100) + '%), ' + v.enCero + ' a cero, ' + v.sinIndexacion + ' sin linea' +
        (floja ? ' — MUESTRA INSUFICIENTE para afirmar que no se indexa' : '')
    };
  }
  return out;
}

// Clientes cuya modalidad esta CONFIRMADA en docs/reglas-facturacion.md contra
// facturas reales. Se usan solo cuando el historico no alcanza (cliente sin
// viajes en el export). No reemplazan al historico: lo respaldan.
var MODALIDAD_CONFIRMADA = {
  'BALTRANSA': 'incluida',            // "la factura SI lleva linea a 0,000"
  'TANK SOLUTIONS': 'sin_indexacion',
  'TRANSPORTES SANTOS': 'sin_indexacion',
  'HISPALENSE': 'sin_indexacion',
  'TRANSTAMBRE': 'linea',
  'FORESTAL DEL ATLANTICO': 'linea',
  'QUIMICAS DEL JARAMA': 'linea'
};

/**
 * Modalidad de indexacion de un viaje.
 *
 * Cascada: historico del cliente -> regla confirmada por razon social ->
 * desconocida + REVISAR. NUNCA devuelve `linea` por defecto: ese default fue el
 * defecto 2 de la cabecera, el que inventaba un cobro.
 *
 * @param {{cliente,codigoCliente,origen,destino}} viaje
 * @param {object} [mapa]  el de modalidadPorHistorico()
 * @returns {{modalidad, fuente, revisar, motivo}}
 */
function modalidadDeViaje(viaje, mapa) {
  var v = viaje || {};
  var cod = String(v.codigoCliente || '').trim();
  var nombre = String(v.cliente || '').trim();

  if (mapa && cod && mapa[cod]) {
    var m = mapa[cod];
    if (m.modalidad === 'mixta') {
      return {
        modalidad: null, fuente: 'historico', revisar: true,
        motivo: 'el cliente factura indexacion de las DOS formas segun el servicio (' +
          m.evidencia + '): decidir por viaje, no por cliente'
      };
    }
    return {
      modalidad: m.modalidad, fuente: 'historico', revisar: (m.modalidad === 'agregada'),
      motivo: m.modalidad === 'agregada'
        ? 'indexacion ACUMULADA por periodo (' + m.evidencia + '): no se cierra por viaje'
        : ''
    };
  }

  var n = MI_CRUCE.norm(nombre);
  if (n) {
    for (var clave in MODALIDAD_CONFIRMADA) {
      if (!Object.prototype.hasOwnProperty.call(MODALIDAD_CONFIRMADA, clave)) { continue; }
      if (n.indexOf(clave) >= 0) {
        return {
          modalidad: MODALIDAD_CONFIRMADA[clave], fuente: 'regla_confirmada', revisar: false,
          motivo: 'modalidad confirmada en docs/reglas-facturacion.md para ' + clave
        };
      }
    }
  }

  return {
    modalidad: null, fuente: 'ninguna', revisar: true,
    motivo: 'no hay evidencia de como se indexa a "' + (nombre || '(cliente no leido)') +
      '": sin historico y sin regla confirmada. NO se asume por linea.'
  };
}

/**
 * Acumula la base de indexacion de un periodo, agrupando POR TRAMO DE PCT
 * VIGENTE (no por quincena ni por mes: ver punto B de la cabecera).
 *
 * Un mes con dos actualizaciones de gasoleo produce DOS lineas agregadas, que es
 * exactamente lo que se ve en las facturas del metanol mensual de Foresa. Un mes
 * con una sola produce una. Sin asumir nada.
 *
 * @param {Array<object>} viajes  {cliente, codigoCliente, fecha, importe_porte}
 * @param {Array<object>} tramos  filas DEDUPLICADAS de Indexacion {cliente(grupo), pct, desde, hasta}
 * @param {function} grupoDe  (cliente) -> grupo de indexacion (indexacion.js)
 * @returns {Array<object>} una linea agregada por (cliente, tramo), mas las
 *          incluidas que no se pudieron asignar a ningun tramo.
 */
function acumularPorPeriodo(viajes, tramos, grupoDe) {
  var lista = Array.isArray(viajes) ? viajes : [];
  var trs = Array.isArray(tramos) ? tramos : [];
  var acc = {};
  var sinTramo = [];

  for (var i = 0; i < lista.length; i++) {
    var v = lista[i] || {};
    var imp = num(v.importe_porte);
    if (imp === null || imp <= 0) { continue; }
    var fecha = String(v.fecha || '');
    var grupo = grupoDe ? grupoDe(v.cliente) : null;
    var gNombre = (grupo && grupo.grupo) ? grupo.grupo : String(grupo || '');

    // Los tramos del suplemento solapan en el dia de corte. Si los que matchean
    // tienen pct distinto no se elige uno: ese viaje no puede acumularse todavia.
    var candidatos = [];
    for (var t = 0; t < trs.length; t++) {
      var f = trs[t];
      if (MI_CRUCE.norm(f.cliente) !== gNombre) { continue; }
      if (fecha && (f.desde || '') <= fecha && fecha <= (f.hasta || '')) { candidatos.push(f); }
    }
    var pcts = {}; candidatos.forEach(function (c) { pcts[parseFloat(c.pct)] = true; });
    var tramo = candidatos.length ? candidatos[0] : null;
    if (Object.keys(pcts).length > 1) {
      sinTramo.push({
        cliente: v.cliente, codigoCliente: v.codigoCliente, fecha: fecha, base: imp,
        pct: null, importe: null, revisar: true,
        motivo: 'la fecha ' + fecha + ' cae en ' + candidatos.length + ' tramos de ' + gNombre +
          ' con porcentajes distintos (' + Object.keys(pcts).join(' / ') + '): hay que decidir cual rige'
      });
      continue;
    }
    if (!tramo) {
      sinTramo.push({
        cliente: v.cliente, codigoCliente: v.codigoCliente, fecha: fecha, base: imp,
        pct: null, importe: null, revisar: true,
        motivo: 'no hay tramo de indexacion vigente para ' + gNombre + ' en ' + (fecha || '(sin fecha)')
      });
      continue;
    }

    var k = String(v.codigoCliente || v.cliente) + '|' + gNombre + '|' + tramo.desde + '|' + tramo.hasta;
    if (!acc[k]) {
      acc[k] = {
        cliente: v.cliente, codigoCliente: v.codigoCliente, grupo: gNombre,
        desde: tramo.desde, hasta: tramo.hasta, pct: parseFloat(tramo.pct),
        base: 0, viajes: 0, fechas: []
      };
    }
    acc[k].base = round2(acc[k].base + imp);
    acc[k].viajes++;
    if (acc[k].fechas.indexOf(fecha) < 0) { acc[k].fechas.push(fecha); }
  }

  var out = [];
  for (var kk in acc) {
    if (!Object.prototype.hasOwnProperty.call(acc, kk)) { continue; }
    var A = acc[kk];
    A.fechas.sort();
    A.importe = isFinite(A.pct) ? round2(A.base * A.pct) : null;
    A.revisar = !isFinite(A.pct);
    A.motivo = 'indexacion acumulada de ' + A.viajes + ' viaje(s) entre ' + A.desde +
      ' y ' + A.hasta + ': base ' + A.base + ' EUR x ' + round2(A.pct * 100) + '% = ' +
      A.importe + ' EUR';
    out.push(A);
  }
  // Orden estable: por cliente y despues por inicio de tramo.
  out.sort(function (a, b) {
    var c = String(a.codigoCliente || a.cliente).localeCompare(String(b.codigoCliente || b.cliente));
    return c !== 0 ? c : String(a.desde).localeCompare(String(b.desde));
  });
  return out.concat(sinTramo);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    modalidadPorHistorico: modalidadPorHistorico,
    modalidadDeViaje: modalidadDeViaje,
    acumularPorPeriodo: acumularPorPeriodo,
    MODALIDAD_CONFIRMADA: MODALIDAD_CONFIRMADA,
    CONCEPTOS_PORTE: CONCEPTOS_PORTE,
    CONCEPTOS_INDEXACION: CONCEPTOS_INDEXACION
  };
}

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

// ===== CATALOGOS GESRUTA: material y chofer (conjuntos CERRADOS) =============
//
// La planilla de carga a Gesruta no lleva texto libre: lleva el CODIGO Gesruta.
// Columnas del formato objetivo (Excelente_detalle_Code_Tabla):
//   "Cod. Material" -> "Material, traducido al listado de Gesruta para matchear"
//   "Cod. Chofer"   -> "Codigo de Gesruta"
//
// Mismo principio que el padron de flota (ficha/flota.js) y que el catalogo de
// puntos: NO se traduce con criterio libre, se ELIGE dentro de una lista conocida,
// y solo cuando la eleccion es inequivoca. Lo que no resuelve queda vacio con
// motivo, para revision humana — nunca se inventa un codigo.
//
// CATALOGO DE MATERIAL: los 558 codigos del listado oficial de Gesruta
// (Materiales.csv, columnas Cod.Car. / Carga). CHOFERES: los 25 del export real.
//
// Logica PURA (sin n8n). Los catalogos se pueden inyectar (data table a futuro).

'use strict';

// --- Catalogo de MATERIAL: codigo Gesruta -> nombre canonico ----------------
var MATERIALES = {
  "ESTEAR":"A.ESTEARICO", "A12666":"A126666", "79":"ABONO", "13":"ABONO FRA. 06/4",
  "ABONO":"ABONO FRA.07/120", "AC8":"AC81511", "21":"ACEITE", "AQUILA":"ACET.ALQUILAMINA",
  "98":"ACETATO", "24":"ACETATO DE BUTILO", "31":"ACETATO DE ETILO",
  "VINILO":"ACETATO DE VINILO", "ISOBUT":"ACETATO ISOBUTILO", "53":"ACETATO METILO",
  "ACETON":"ACETONA", "ACETIC":"ACIDO ACETICO", "102":"ACIDO ACRILICO",
  "CITRIC":"ACIDO CITRICO", "100":"ACIDO CLORH.", "FENOLS":"ACIDO FENOLSOFINICO",
  "FORMIC":"ACIDO FORMICO", "67":"ACIDO FOSFORICO", "FUMARI":"ACIDO FUMARICO",
  "ACIDOG":"ACIDO GRASO", "INORGA":"ACIDO INORGANICO", "METACR":"ACIDO METACRILICO",
  "89":"ACIDO NITRICO", "OLEICO":"ACIDO OLEICO", "PALMIT":"ACIDO PALMITICO",
  "PROPIO":"ACIDO PROPIONICO", "ACIDOS":"ACIDO SULFONICO", "20":"ACIDO SULFURICO",
  "ARILSU":"ACIDOS ARILSULFORNICOS", "ACIFEE":"ACIFEED", "ACRELA":"ACRELATO BUTILO",
  "ACREL":"ACRELATO ETILO", "ACRETI":"ACRIL.ETILO", "ACRODU":"ACRODUR", "37":"ACRONAL",
  "ADBLUE":"ADBLUE", "ADDITI":"ADDITIF", "ADICRI":"ADICRIL", "14":"ADITIVO", "AEMOIL":"AEMOIL",
  "11":"AGUA", "DESMIN":"AGUA DESMINER.", "76":"AGUARDIENTE", "AGUARR":"AGUARRAS",
  "50":"AGUAS RESIDUALES", "AIRBLU":"AIRBLUE", "103":"ALAMBRE", "ALARIA":"ALARIA",
  "83":"ALCOHOL", "26":"ALCUPOL", "ALIMEN":"ALIMENTACION", "ALKANO":"ALKANOLAMINE",
  "ALQUIL":"ALQUILER", "BULK":"ALS-LC BULK", "ALUMNA":"ALUMINATO SODICO", "ALUMIN":"ALUMINIO",
  "ALULIQ":"ALUMINIO LIQUIDO", "33":"AMONIACO", "ANDAMI":"ANDAMIOS", "ANILIN":"ANILINA",
  "APERIT":"APERITIVOS", "AQUA":"AQUA-QUENCH", "ARGINA":"ARGINA", "ARROZ":"ARROZ",
  "ARTPIS":"ART.PISCINAS", "ASFALT":"ASFALTO", "AUTOMO":"AUTOMOCION", "AXILA":"AXILAT",
  "96":"AZEOTROPO", "AZUCAR":"AZUCAR", "BAKELI":"BAKELITE", "BANAST":"BANASTAS",
  "BARAN":"BARANDILLAS", "BARQUA":"BARQUAT", "BATERI":"BATERIAS", "BAZAR":"BAZAR",
  "BRIAL":"BD BRIAL", "48":"BEBIDAS", "BENCEN":"BENCENOGT", "BETA":"BETA MSHF",
  "BETUN":"BETUN ALSF.", "BIDONE":"BIDONES", "BIODIE":"BIODIESEL", "BIOETA":"BIOETANOL",
  "OIL":"BIOHEATING OIL", "BIOPOL":"BIOPOL", "46":"BISULFITO SODICO", "BOBIN":"BOBINAS",
  "BOBINA":"BOBINAS HOJALATA", "BOLLER":"BOLLERIA", "43":"BORRASPERSE", "BOTELL":"BOTELLAS",
  "87":"BRADOL", "12669":"BREAS-DISTILL.RESIDUE", "BROQUE":"BROQUETAS", "BRYTEN":"BRYTEN",
  "BUTANO":"BUTANOL", "BUTILD":"BUTILDIGLICOL", "BUTIL":"BUTILGLICOL", "BUTYL":"BUTYLGLYCOL",
  "C810":"C-810L", "CABALL":"CABALLETES", "10":"CABEZA TR.", "CAFE":"CAFE", "CAJAS":"CAJAS",
  "CAJA":"CAJAS", "CAMBIO":"CAMBIO PAPELES", "CAPRI":"CAPRILATO METILO", "CARBOM":"CARBOMAP",
  "BARIO":"CARBONATO BARIO", "CARGA":"CARGA ADICIONAL", "CARDES":"CARGA/DESCARGA",
  "12672":"CARGA/DESCARGA COLA PINATURE", "93":"CARGAS", "101":"CARNE", "CARTON":"CARTON",
  "CATAL":"CATALYST BDMA", "CATALY":"CATLYST", "CAUCHO":"CAUCHO", "CBA":"CBA 1140",
  "CEBOLL":"CEBOLLAS", "CELTIS":"CELTIS 902", "CEMENT":"CEMENTO", "CERVEZ":"CERVEZA",
  "CHAPA":"CHAPA", "CHOCOL":"CHOCOLATE", "CHRYSO":"CHRYSO", "CICLOH":"CICLOHEXANO",
  "CIDOMI":"CIDOMIX", "CIPTON":"CIPTON", "ABO\u00d1O":"CISTERNA EN ABOÑO",
  "12":"CISTERNA EN DEPOSITO", "CALCIC":"CLOR.CALCICO", "CLORAT":"CLORATO", "CLORIT":"CLORITO",
  "CLOALU":"CLORURO DE ALUMINIO", "28":"CLORURO DE METILENO", "CLT":"CLT-105",
  "CMS":"CMS-VINAZA", "1":"COLA", "FENOLI":"COLA FENOLICA", "ROJA":"COLA ROJA",
  "17":"COLA SACO", "COLAFO":"COLA/FORMOL", "COLCHO":"COLCHONES", "COLOR":"COLORANTE",
  "COMEST":"COMESTIBLES", "COMPLE":"COMPLEMENTO", "CG/CAJ":"CONGELAD/CAJAS", "6":"CONGELADO",
  "CG/MAQ":"CONGELADO/MAQUINAS", "CG/REF":"CONGELADO/REFRIGERADO", "15":"CONSERVA",
  "CONTEN":"CONTENEDORES", "CONTRA":"CONTRAPESOS", "CRISTA":"CRISTAL", "12677":"CUTMAX",
  "D40":"D 40", "DABEER":"DABEERSEN", "DABERS":"DABEERSEN", "DEHYDO":"DEHYDOL",
  "DEHYT":"DEHYTON", "DEMULS":"DEMULSENE", "DERMUL":"DERMULSENE", "DESCAR":"DESCARGA",
  "12671":"DESCARGA EN SABADO", "DESPLA":"DESPLAZAMIENTO", "DESVIO":"DESVIO",
  "DETERG":"DETERGENTE", "DEVOLU":"DEVOLUC.COLA", "DEVOL.":"DEVOLUC.MERCANCIA",
  "DEV":"DEVOLUCION", "DIACET":"DIACETONA ALCOHOL", "DIAMIN":"DIAMIN T",
  "DIETAN":"DIETANOLAMINA", "61":"DIETILENGLICOL", "DIMETI":"DIMETILBENC.",
  "DIM":"DIMETILFORM.", "DIPROP":"DIPROPILENGLICOL", "90":"DISOLVENTE", "DIVOST":"DIVOSTAR",
  "58":"DK-FLOC", "DMBA":"DMBA", "DOP":"DOP", "DOTP":"DOTP", "DOWANO":"DOWANOL",
  "DP":"DP 5/50", "DROGUE":"DROGUERIA", "DROVI":"DROVISOL", "EASYCO":"EASYCOL", "63":"ECOLUBE",
  "EKA":"EKA", "1374":"ELECTROCLOR", "ELECTR":"ELECTRODOMEST.", "EMPAT":"EMPATEN",
  "EMULSI":"EMULSIBER", "EMULTE":"EMULTEX", "ENVASA":"ENVASADO", "ENV":"ENVASES",
  "82":"ENVASES BEBIDAS", "DIRECT":"ENVIO DIR.", "12670":"EQ-23-V", "ESPUMA":"ESPUMA",
  "ESTERM":"ESTERMETIL", "59":"ESTIRENO", "ETANOL":"ETANOL", "ETHYL":"ETHYLHEXANOL",
  "EXPOSI":"EXPOSITORES", "EXTENS":"EXTENSOIL", "EXTRAC":"EXTRACTO 60",
  "FECULA":"FECULA PATATA", "FENNOS":"FENNOSIZE", "TRENGH":"FENNOSTRENGHT",
  "FENOL":"FENOL FUNDIDO", "FERRET":"FERRETERIA", "FERRIC":"FERRICALAR",
  "FERTIL":"FERTILIZANTE", "FIBROC":"FIBROCEMENTO", "41":"FIMAPAN", "55":"FIMAPAN/PALETS",
  "FINCAT":"FINCAT", "FINTES":"FINRES TEST", "FLEJE":"FLEJE", "FLOCU":"FLOCUSOL",
  "FLOQUA":"FLOQUAT", "FLOTAD":"FLOTADORES", "70":"FLUBE", "FORLAC":"FORLAC 75",
  "FORMIP":"FORMIPRO", "3":"FORMOL", "FORMET":"FORMOL/METANOL", "FOSFAT":"FOSFATION",
  "80":"FR CROS", "FRUTA":"FRUTA", "FRUTCO":"FRUTA-CONG.", "2":"FUEL", "CALDE":"FUEL CALD.",
  "FUNGI":"FUNGI-GAL", "8":"GALLETAS", "GARDOB":"GARDOBOND", "GARDO":"GARDOCLEAN",
  "GASOLE":"GASOLEO", "35":"GEOTEX HD 40", "GLICER":"GLICERINA", "GLICOL":"GLICOL",
  "GOMAS":"GOMAS", "GRANA":"GRANALLA", "GRANOD":"GRANODINE", "GRASA":"GRASA",
  "GRINCO":"GRINCO M", "GRUPAJ":"GRUPAJE", "18":"HARINA", "60":"HAVOLINE", "HELAD":"HELADOS",
  "99":"HEPTANO", "HEXAMO":"HEXAMOLL", "HEXANO":"HEXANO", "HIDR":"HIDROXIDO POTASICO",
  "65":"HIDROXIDO SODICO", "HIELO":"HIELO", "HIERRO":"HIERRO", "HOJAL":"HOJALATA",
  "HOOPOL":"HOOPOL", "HUEVOS":"HUEVOS", "IBERPA":"IBERPAN", "ILUMIN":"ILUMINACION",
  "IMPRES":"IMPRESS", "INOPON":"INOPON", "IPA":"IPA", "IQOXIN":"IQOXINOL", "ISOB":"ISOBUTANOL",
  "91":"ISOPROPANOL", "16":"JABON", "JAYFLE":"JAYLEX DINP", "JUGUET":"JUGUETES",
  "KEMFLU":"KEMFLUID", "KYMENE":"KYMENE", "LACTEO":"LACTEOS", "LADRIL":"LADRILLO",
  "LASACI":"LASACID", "LATEX":"LATEX", "LAURIL":"LAURIL ETER", "25":"LAVADO",
  "LECHAV":"LECHAVIT", "LECHE":"LECHE", "LEUCOP":"LEUCOPHOR", "FLEX":"LG FLEX",
  "LIAS":"LIAS VINO", "LIBROS":"LIBROS", "38":"LIGNEX NAL", "42":"LIGNEX NAL",
  "LIGNOB":"LIGNOBOND", "KA\u00d1A":"LIGNOKAÑA", "LIGNOK":"LIGNOKAÑA", "34":"LIGNOSULFONATE",
  "LINOSU":"LINOSULFORATO", "ORGAN":"LIQ.ORGAN.CORROSIVO", "62":"LISINA", "LUPRO":"LUPROMIX",
  "MADERA":"MADERA", "MAGNES":"MAGNESITA", "MAMMFO":"MAMMFOR", "MANGAN":"MANGANESO",
  "MANTEC":"MANTECA", "MAQUIN":"MAQUINA", "MAQU":"MAQUINAS", "MARGAR":"MARGARINA",
  "MARMOL":"MARMOL", "MASPHA":"MASPHATE", "MAT":"MAT 330D", "OBRA":"MAT. OBRA",
  "1373":"MATERIAL FERIA", "MEG":"MEG", "MELAZA":"MELAZA", "VARIAS":"MERCANC.VARIAS",
  "METAL":"METAL", "METALT":"METALEST", "5":"METANOL", "METANO":"METANOL DEVUELTO",
  "METHAN":"METHAM-NA", "METHYL":"METHYL GLYCOL", "77":"METIL ESTER", "METIL":"METIL ESTER",
  "ETER":"METIL ETER", "22":"METIL ETIL CETONA", "METILP":"METIL PROXITOL",
  "METMET":"METILMETACRILATO", "97":"METILO", "METOXI":"METOXIPROPANOL",
  "METROX":"METROXIPROPILO", "MEXIFL":"MEXIFLEX", "MONOET":"MONOETHANOLAMINA",
  "MONOE":"MONOETILENGLICOL", "45":"MOWILIT", "MUEBLE":"MUEBLES", "N32":"N-32",
  "NARANJ":"NARANJAS", "NATA":"NATA", "NEMOL":"NEMOL", "AMONIC":"NITR.AMONICO",
  "ETILHE":"NITR.ETILHEXILO", "NITRMA":"NITRAT.MAGNES.", "36":"NOPCOMASTER", "NORLAN":"NORLAN",
  "73":"NORSODYNE", "NOVA":"NOVADEX", "1375":"NTA NA3", "NYFLEX":"NYFLEX", "NYTEX":"NYTEX",
  "29":"NYTRO", "NITRO":"NYTRO TAURUS", "OLCUPO":"OLCUPOL", "OLEINA":"OLEINA", "47":"OROTAN",
  "OXIDMA":"OXIDO DE MANGANESO", "OXILAN":"OXILAN", "OXSILA":"OXSILAN", "PAJA":"PAJA",
  "68":"PALATINOL", "PALETI":"PALETIZADO", "54":"PALETS", "PALLET":"PALLETS", "PAN":"PAN",
  "PANCON":"PAN CONGELADO", "RALLAD":"PAN RALLADO", "PANEL":"PANEL", "PANELE":"PANELES",
  "PAPEL":"PAPEL", "32":"PAPEL HIGIENICO", "PAQUET":"PAQUETERIA", "PARAC":"PARACHLOR-52",
  "4":"PARAFINA", "PARAFL":"PARAFLOU FO2", "39":"PARALIZACION", "PARALI":"PARALIZACION",
  "PASCAL":"PASCAL", "PASTAP":"PASTA DE PAPEL", "PASTA":"PASTA PAPEL", "66":"PATATAS",
  "PAVIME":"PAVIMENTOS", "PAX":"PAX", "PA\u00d1ALE":"PAÑALES", "PEAJES":"PEAJES",
  "PELLET":"PELLETS", "PERCLO":"PERCLORORETILENO", "92":"PESCADO", "12667":"PET 9331",
  "PETRIL":"PETRIL", "PETROS":"PETROSOL", "PIEDRA":"PIEDRA", "PIENSO":"PIENSO",
  "PIGMEN":"PIGMENTANTE", "PINATU":"PINATURE", "PINTUR":"PINTURA", "PIROTE":"PIROTECNIA",
  "PISCIN":"PISCINAS", "PIZARR":"PIZARRA", "PLADUR":"PLADUR", "PLANTA":"PLANTAS",
  "PLAS":"PLASTICOS", "PLASTI":"PLASTIFICANTE", "PLAXTE":"PLAXTER", "PLETIN":"PLETINA",
  "1372":"PO 1372 R", "POLIAM":"POLIAMINAS", "84":"POLICLORURO", "POLIET":"POLIETILENGLICOL",
  "POLIFL":"POLIFLUX", "POLIFO":"POLIFOSFATO", "POLI":"POLIOL", "POLIOL":"POLIOLESINA",
  "POLYFO":"POLYFOAN", "POLYNT":"POLYNT", "POLYOL":"POLYOL", "PHOSPH":"POLYPHOSPHATE",
  "POLYSO":"POLYSOL", "95":"PORCELANA", "POS":"POS COD", "POTASA":"POTASA CAUSTICA",
  "POZZO":"POZZOLITH", "PREFHO":"PREF.HORMIGON", "64":"PRIMAL", "FARMAC":"PROD.FARMAC.",
  "ADR":"PRODUCTO ADR", "NO ADR":"PRODUCTO NO ADR", "PROPAN":"PROPANO",
  "PROPIL":"PROPILENGLICOL", "PURE":"PURE MANZANA", "QUAT":"Q QUAT", "SOL":"Q-SOL",
  "FEED":"QD FEED", "QDPOL":"QDPOL", "QPOL":"QPOL", "QUAKER":"QUAKERCUT", "QUAK":"QUAKEROL",
  "QUATTR":"QUATTRO", "QUESO":"QUESO", "QUINTO":"QUINTOLUBRIC", "RADIAD":"RADIADORES",
  "57":"REBAJAR Y DESCARGAR", "RECICL":"RECICLAJE", "REDEMU":"REDEMUL", "REFRES":"REFRESCOS",
  "REFRIG":"REFRIGERADO", "7":"REPARTOS", "REPEX":"REPEX", "UF":"RES UF-85",
  "RESID":"RES.COD.LER 070504", "RESIDU":"RES.COD.LER 190814", "BIODEG":"RESID.BIODEGRADABLES",
  "12676":"RESIDUO UN 3082", "23":"RESINA", "RESINO":"RESINOLINE", "RETARD":"RETARDAN",
  "RETORN":"RETORNO", "RF-401":"RF-401", "74":"RHODIMET", "86":"RHODIMET", "RHODOP":"RHODOPAS",
  "52":"RM 245", "ROPA":"ROPA", "ROPOL":"ROPOL", "ROQUAT":"ROQUAT", "RP":"RP CIRCULACION",
  "RUEDAS":"RUEDAS", "SAL":"SAL", "SALMO":"SALMO-GAL", "SALMOG":"SALMOGAL",
  "SANITA":"SANITARIOS", "SCRIPT":"SCRIPTANE", "SECO":"SECO", "SEC/CG":"SECO/CONGELADO",
  "SIKACE":"SIKACERAM", "SIKAME":"SIKAMENT", "49":"SILICATO", "30":"SN 300",
  "COSTE":"SOBRECOSTE", "SODAL":"SODAL", "SODIO":"SODIO SILICATO", "SOKALA":"SOKALAN",
  "81":"SOLUC.NITROGENADA", "SOLUCI":"SOLUCION ACUOSA", "SOLVES":"SOLVESSO",
  "SORBIT":"SORBITOL", "51":"SOSA", "SOSALC":"SOSA-ALCOHOL", "SPIRDA":"SPIRDANE",
  "STAND":"STAND FERIA", "STEARI":"STEARINE", "69":"STYROFAN", "SUERO":"SUERO",
  "SULFAM":"SULF.AMONICO", "27":"SULFANONA", "56":"SULFATO ALUMINA",
  "SULFFE":"SULFATO FERRICO", "SULFSO":"SULFATO SODICO", "SUPERM":"SUPERMERCADO",
  "12674":"SUPLEM. DIESEL-FORESA 18.38%", "12675":"SUPLEM.DIESEL-QUIMIDROGA 5.96%",
  "SUPLEM":"SUPLEMENTO", "12673":"SUPLEMENTO DIESEL-HELM 8.02%", "SURFAC":"SURFACTAN",
  "SYNOLA":"SYNOLAC", "TABLER":"TABLERO", "88":"TADAFLOT", "TALL":"TALL OIL",
  "TALUPA":"TALUPAC", "TCPP":"TCPP", "TENSIO":"TENSION", "TEREMB":"TEREBEMTINA",
  "TERRAZ":"TERRAZO", "75":"TEXAPON", "TEXTIL":"TEXTIL", "78":"THERMISOL", "TIERRA":"TIERRA",
  "TINNOL":"TINNOL", "TINTAS":"TINTAS", "85":"TOLUENO", "TOMATE":"TOMATE", "TOTM":"TOTM-S",
  "TRACT":"TRACTORES", "SIDER":"TRANSF.SIDERURG.", "TRANSF":"TRANSFORMADORES",
  "TRIACE":"TRIACETINA", "TRIETA":"TRIETANOLAM.", "TRIETI":"TRIETILENGLICOL",
  "TRONCO":"TRONCOIL", "TUBO":"TUBOS", "TUBOS":"TUBOS PLASTICO", "UAN":"UAN-32", "19":"UF",
  "URALIT":"URALITA", "UREA":"UREA", "ZICLUS":"V-ZICLUS", "VACIO":"VACIO", "VANASO":"VANASOL",
  "9":"VARIOS", "VARNIS":"VARNISH", "VIDRIO":"VIDRIO", "VINAGE":"VINAGRE",
  "VINKA":"VINKA-PLAST", "40":"VINO", "VISCO":"VISCOCRETE", "VISOM":"VISOM", "VM 410":"VM 410",
  "VOLUTA":"VOLUTA H 300", "VORANO":"VORANOL", "12668":"WAC AB", "44":"WHITE SPIRIT",
  "WP70":"WP 70", "94":"XILENO", "71":"YOGUR", "ZINC":"ZINC", "72":"ZUMOS"
};

// ALIAS de material: como lo escriben los DOCUMENTOS y las FICHAS vs el nombre
// Gesruta. Derivados de los documentos reales analizados. Ampliable sin tocar
// logica. Clave = literal normalizado; valor = codigo Gesruta.
var ALIAS_MATERIAL = {
  // Resinas/colas de FORESA: la ficha y el albaran escriben "RES 0201",
  // "FORESA RES 0201", "Res 0541"... todas son COLA en Gesruta.
  'RES': '1', 'FORESA RES': '1', 'RESINA': '1', 'RESINA COLOFONIA': '1', 'COLA': '1',
  // Vinka-Plast (Quimidroga): en los documentos aparece "VINKA PLAST QD 390".
  'VINKA PLAST': 'VINKA', 'VINKAPLAST': 'VINKA', 'VINKA PLAST QD': 'VINKA',
  // La vision lee seguido "VINA PLAST" / "VINA-PLAST" (se come la K).
  'VINA PLAST': 'VINKA', 'VINAPLAST': 'VINKA',
  // Acidos y bases con nombre legal ADR largo.
  'ACIDO ACETICO GLACIAL': 'ACETIC', 'ACIDO ACETICO GLACIAL SOLUCION': 'ACETIC',
  'ACETIC ACID GLACIAL': 'ACETIC',
  // La ficha lo abrevia "A. Acetico".
  'A ACETICO': 'ACETIC', 'ACETICO': 'ACETIC',
  'SOSA CAUSTICA': '51', 'HIDROXIDO DE SODIO': '65', 'HIDROXIDO SODICO': '65',
  // Los documentos portugueses e ingleses la nombran distinto (guias de Bondalti,
  // RNM y los CMR internacionales): todas son SOSA en Gesruta.
  'SODA CAUSTICA': '51', 'CAUSTIC SODA': '51', 'CAUSTIC SODA LIQUOR': '51',
  'LIQUID CAUSTIC SODA': '51', 'SODA': '51',
  'ACIDO SULFURICO': '20', 'ACIDO NITRICO': '89',
  'METANOL': '5', 'ALCOHOL METILICO': '5',
  'FORMOL': '3', 'FORMALDEHIDO': '3',
  'LISINA': '62', 'L LISINA': '62', 'L LISINA LICA': '62',
  'MONOETILENGLICOL': 'MONOE', 'MEG': 'MONOE',
  'DIETILENGLICOL': '61', 'DEG': '61',
  'FENOL': 'FENOL', 'FENOL FUNDIDO': 'FENOL'
};

// --- Catalogo de CHOFER: codigo Gesruta -> nombre canonico ------------------
var CHOFERES = {
  'BREO': 'BREOGAN MARQUEZ', '37': 'CANDIDO JAMARDO', '2': 'CARLOS ABALO QUINTELA',
  '41': 'FRANCISCO ASENSI', 'JAC': 'JACOBO GRANDE MENDEZ', '45': 'JOSE ANTONIO VAZQUEZ HERMO',
  '39': 'JOSE CARLOS ALFONSIN', '19': 'JOSE CARLOS RODRIGUEZ', 'ARIA': 'JOSE ENRIQUE ARIAS',
  '5': 'JOSE JORGE FERREIRA GOLDAR', '34': 'JOSE MANUEL PAZ', '44': 'JOSE RAMON PIÑEIRO',
  '18': 'JOSE RUBEN ABALO RECUNA', '38': 'JUAN LUIS GLEZ LORENZO', '30': 'JUAN MANUEL ABAL',
  '42': 'LUIS M. TRIÑANES', '4': 'MANUEL ABOY GONZALEZ', '22': 'MANUEL FERREIRA GOLDAR',
  '40': 'MANUEL SABARIS', '12': 'MARCOS EIRIN FERNANDEZ', '36': 'NUNO FILIPE',
  '23': 'OSCAR SAYANS EIRIN', '6': 'PABLO CARLES SANTOS', '21': 'PEDRO FRAGA',
  '32': 'RODRIGO PEREZ BAHAMONDE'
};

function norm(s) {
  var t = (s === null || s === undefined) ? '' : String(s);
  return t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Distancia de edicion (Levenshtein) para tolerar un caracter mal leido.
function distanciaTexto(a, b) {
  a = a || ''; b = b || '';
  if (a === b) { return 0; }
  var la = a.length, lb = b.length;
  if (!la) { return lb; }
  if (!lb) { return la; }
  var prev = [], i, j;
  for (j = 0; j <= lb; j++) { prev[j] = j; }
  for (i = 1; i <= la; i++) {
    var cur = [i], ca = a.charAt(i - 1);
    for (j = 1; j <= lb; j++) {
      var cost = (ca === b.charAt(j - 1)) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[lb];
}

// Tokens de ruido en denominaciones de mercancia: concentraciones, envases,
// codigos ONU y palabras de embalaje que no distinguen el material.
var RUIDO_MATERIAL = /\b(UN\s*\d{3,4}|\d+\s*%|BULK|GRANEL|CISTERNA|SOLUCION|SOLUTION|GLACIAL|QD|CD|OD|KG|TN|ADR|CLASE|GRUPO)\b/g;

/**
 * Resuelve un material leido (ficha o documento) al codigo Gesruta.
 * Cascada: alias exacto -> nombre canonico exacto -> alias/canonico contenido
 * de forma UNIVOCA. Multi-candidato o sin match -> codigo null + motivo.
 *
 * @param {string} literal
 * @param {object} [catalogo] {materiales, alias} inyectables
 * @returns {{codigo:string|null, nombre:string|null, metodo:string, literal:string, revisar:boolean, motivo:string}}
 */
function resolverMaterial(literal, catalogo) {
  var mats = (catalogo && catalogo.materiales) || MATERIALES;
  var alias = (catalogo && catalogo.alias) || ALIAS_MATERIAL;
  var lit = (literal === null || literal === undefined) ? '' : String(literal);
  var n = norm(lit);
  if (!n) {
    return { codigo: null, nombre: null, metodo: 'vacio', literal: lit, revisar: true, motivo: 'material vacio o ilegible' };
  }
  // Limpieza de ruido (concentraciones, ONU, envase) para comparar.
  var limpio = norm(n.replace(RUIDO_MATERIAL, ' '));

  var res = function (cod, metodo, revisar, motivo) {
    return { codigo: cod, nombre: mats[cod] || null, metodo: metodo, literal: lit, revisar: !!revisar, motivo: motivo || '' };
  };

  // 1) Alias exacto (con y sin ruido).
  if (Object.prototype.hasOwnProperty.call(alias, n)) { return res(alias[n], 'alias', false); }
  if (limpio && Object.prototype.hasOwnProperty.call(alias, limpio)) { return res(alias[limpio], 'alias', false); }

  // 2) Nombre canonico exacto.
  var k;
  for (k in mats) {
    if (!Object.prototype.hasOwnProperty.call(mats, k)) { continue; }
    if (norm(mats[k]) === n || (limpio && norm(mats[k]) === limpio)) { return res(k, 'canonico', false); }
  }

  // 3) Contencion UNIVOCA: el nombre Gesruta aparece dentro del literal, o un
  // alias aparece dentro del literal. Debe apuntar a UN SOLO codigo.
  // Contencion por LIMITE DE PALABRA, nunca por substring crudo: "RES" no debe
  // matchear dentro de "RESORCINOL" (paso de verdad y habria facturado COLA por
  // un producto distinto). Se compara token completo.
  var hits = {};
  var base = ' ' + (limpio || n) + ' ';
  var contiene = function (frag) { return frag && frag.length >= 3 && base.indexOf(' ' + frag + ' ') >= 0; };
  for (k in mats) {
    if (!Object.prototype.hasOwnProperty.call(mats, k)) { continue; }
    if (contiene(norm(mats[k]))) { hits[k] = true; }
  }
  for (k in alias) {
    if (!Object.prototype.hasOwnProperty.call(alias, k)) { continue; }
    if (contiene(k)) { hits[alias[k]] = true; }
  }
  var ids = Object.keys(hits);
  if (ids.length === 1) {
    return res(ids[0], 'contencion', true, 'material "' + lit + '" -> ' + mats[ids[0]] + ' (' + ids[0] + ') por contencion — verificar');
  }
  if (ids.length > 1) {
    var nombres = ids.map(function (i) { return mats[i]; }).join(', ');
    return { codigo: null, nombre: null, metodo: 'ambiguo', literal: lit, revisar: true, motivo: 'material "' + lit + '" coincide con varios de Gesruta (' + nombres + ') — revisar cual es' };
  }
  return { codigo: null, nombre: null, metodo: 'no_reconocido', literal: lit, revisar: true, motivo: 'material "' + lit + '" no esta en el listado de Gesruta — dar de alta o corregir' };
}

/**
 * Resuelve el chofer de la ficha al codigo Gesruta. La ficha trae el nombre
 * abreviado ("Juan Manuel Abal", "MARCOS", "PEDRO FRAGA") y Gesruta el nombre
 * completo. Match por CONTENCION de todos los tokens del literal en el canonico,
 * exigiendo unicidad (dos "JOSE CARLOS" distintos no se resuelven a ciegas).
 */
function resolverChofer(literal, catalogo) {
  var chs = (catalogo && catalogo.choferes) || CHOFERES;
  var lit = (literal === null || literal === undefined) ? '' : String(literal);
  var n = norm(lit);
  if (!n) { return { codigo: null, nombre: null, metodo: 'vacio', literal: lit, revisar: true, motivo: 'chofer vacio o ilegible' }; }

  var k, exactos = [];
  for (k in chs) {
    if (!Object.prototype.hasOwnProperty.call(chs, k)) { continue; }
    if (norm(chs[k]) === n) { exactos.push(k); }
  }
  if (exactos.length === 1) { return { codigo: exactos[0], nombre: chs[exactos[0]], metodo: 'exacto', literal: lit, revisar: false, motivo: '' }; }

  // Contencion: TODOS los tokens del literal deben estar en el nombre canonico.
  // Se conservan las iniciales (1 caracter): 'M FERREIRA' necesita la M para
  // distinguir MANUEL FERREIRA de JOSE JORGE FERREIRA. Pesan poco (ver puntaje).
  var toks = n.split(' ').filter(function (t) { return t.length >= 1; });
  if (!toks.length) { return { codigo: null, nombre: null, metodo: 'no_reconocido', literal: lit, revisar: true, motivo: 'chofer "' + lit + '" ilegible' }; }
  // PUNTAJE PONDERADO POR CARACTERES (mismo criterio que el padron de flota):
  // cada token del literal que aparece en el nombre canonico suma su longitud,
  // asi un apellido distintivo ("CANDIDO", 7) pesa mas que un nombre comun
  // ("JOSE", 4) y no empatan todos los Jose entre si. Un token cuenta si es
  // prefijo de un token canonico (o al reves) o si difiere en 1 caracter
  // (>=3 letras): la ficha manuscrita se lee "ABELO" por "ABALO", "GLZ" por
  // "GLEZ". Gana el mejor SOLO si le saca ventaja al segundo; si empatan, es
  // ambiguo y no se elige (no se adivina entre homonimos).
  var puntajes = [];
  for (k in chs) {
    if (!Object.prototype.hasOwnProperty.call(chs, k)) { continue; }
    var canon = norm(chs[k]).split(' ');
    var pts = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      for (var j = 0; j < canon.length; j++) {
        var c2 = canon[j];
        // El puntaje es el SOLAPAMIENTO real, no la longitud del token leido: una
        // inicial canonica ('M' de "LUIS M. TRIÑANES") solo puede sumar 1, y no
        // puede empatarle a un nombre completo ("MARCOS" = 6). Sin esto, "MARCOS"
        // empataba con "LUIS M. TRIÑANES" y quedaba ambiguo.
        if (c2.indexOf(t) === 0 || t.indexOf(c2) === 0) { pts += Math.min(t.length, c2.length); break; }
        if (t.length >= 3 && c2.length >= 3 && distanciaTexto(t, c2) <= 1) { pts += t.length; break; }
      }
    }
    if (pts > 0) { puntajes.push({ cod: k, pts: pts }); }
  }
  puntajes.sort(function (a, b) { return b.pts - a.pts; });
  var cands = [];
  if (puntajes.length === 1) { cands = [puntajes[0].cod]; }
  else if (puntajes.length > 1) {
    if (puntajes[0].pts > puntajes[1].pts) { cands = [puntajes[0].cod]; }
    else { cands = puntajes.filter(function (x) { return x.pts === puntajes[0].pts; }).map(function (x) { return x.cod; }); }
  }
  if (cands.length === 1) {
    return { codigo: cands[0], nombre: chs[cands[0]], metodo: 'contencion', literal: lit, revisar: false, motivo: '' };
  }
  if (cands.length > 1) {
    var nn = cands.map(function (c) { return chs[c]; }).join(', ');
    return { codigo: null, nombre: null, metodo: 'ambiguo', literal: lit, revisar: true, motivo: 'chofer "' + lit + '" coincide con varios (' + nn + ') — revisar cual es' };
  }
  return { codigo: null, nombre: null, metodo: 'no_reconocido', literal: lit, revisar: true, motivo: 'chofer "' + lit + '" no esta en el listado de Gesruta — dar de alta o corregir' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MATERIALES: MATERIALES, ALIAS_MATERIAL: ALIAS_MATERIAL, CHOFERES: CHOFERES,
    resolverMaterial: resolverMaterial, resolverChofer: resolverChofer,
    normalizarGesruta: norm,
  };
}

// ===== RESOLVEDOR CANONICO DE PUNTOS (modelo-dominio-lectura.md §9) ==========
//
// Los choferes y los documentos escriben lugares a mano; no coinciden con los
// nombres de las bases. Este modulo resuelve un literal cualquiera al PUNTO
// CANONICO (el id que entiende Gesruta), con una cascada de confianza explicita.
// NUNCA adivina en silencio: todo lo que no sea match exacto marca REVISAR
// (adivinar un punto envenena la tarifa, §2).
//
// Logica PURA (sin n8n), compartida por ingesta, auditor y (futuro) robot Gesruta.
//
// `catalogo`: Array<{ id_punto, nombre_canonico, alias, ... }>. `alias` es un
// string con variantes separadas por "|".

'use strict';

// Escalones de confianza (para poder "bajar un escalon" segun la fuente, §4).
var ESCALON = { alta: 3, media: 2, baja: 1, ninguna: 0 };
function bajarConfianza(c) {
  if (c === 'alta') { return 'media'; }
  if (c === 'media') { return 'baja'; }
  return c; // baja/ninguna no bajan mas
}

// Overrides INTENCIONALES de oficina (confirmados por Julio): un literal que
// coincide con un canonico Gesruta que EN LA PRACTICA no se usa para ese destino.
// Ganan sobre toda la cascada. Clave = literal normalizado; destino = nombre
// canonico al que debe resolver. Reversible: quitar la entrada revierte al
// comportamiento por catalogo. Trazabilidad: la nota viaja en el motivo del
// resultado aunque la confianza sea alta.
var OVERRIDES_LITERAL = {
  // 'Anleo' es una parroquia dentro de Navia (Asturias); la oficina SIEMPRE lo
  // carga como NAVIA. Gana sobre el canonico Gesruta 'ANLEO', que existe pero no
  // se usa en la practica (datos/alias-fichas-reales.md, confirmado por Julio).
  'ANLEO': { destino: 'NAVIA', nota: "'Anleo' es parroquia de Navia; la oficina siempre lo carga como NAVIA. Override intencional sobre el canonico Gesruta ANLEO (existe pero no se usa)." }
};

// Frases de ruido a quitar ANTES que los tokens sueltos (orden: mas larga primero).
var FRASES_RUIDO = [' S L U ', ' S A U ', ' S C A ', ' S L L ', ' S A ', ' S L ', ' S C ', ' C B ',
                    ' PUERTO DE ', ' POLIGONO INDUSTRIAL ', ' POL INDUSTRIAL ', ' POL IND '];
// Tokens de ruido sueltos.
var TOKENS_RUIDO = [' SA ', ' SL ', ' SLU ', ' SAU ', ' PLANTA ', ' FABRICA ', ' PTO ',
                    ' POLIGONO ', ' POL ', ' IND ', ' PUERTO ',
                    // Marcador de PAIS en el catalogo Gesruta: "LEIRIA (PT)",
                    // "ALCANENA(PT)". El documento escribe solo la localidad, asi
                    // que el marcador impide el match. No aporta identidad: el
                    // codigo del punto ya distingue.
                    ' PT ', ' PORTUGAL ', ' ESPANA ', ' SPAIN '];

// Abreviaturas toponimicas portuguesas/gallegas: la ficha y los documentos
// escriben "V.N. Famalicao" o "Vila Nova de Famalicao" y Gesruta "VILANOVA
// FAMALICAO". Es convencion de escritura, no ambiguedad: se unifican antes de
// comparar. Se aplican como frase, tras limpiar la puntuacion.
var ABREVIATURAS = [
  [' V N ', ' VILANOVA '], [' VILA NOVA ', ' VILANOVA '], [' VN ', ' VILANOVA '],
  [' STO ', ' SANTO '], [' STA ', ' SANTA '], [' S ', ' SAN ']
];

/**
 * Normaliza un literal: mayusculas, sin acentos, sin puntuacion, espacios
 * colapsados, y sin ruido (formas societarias, POL. IND., PLANTA, PUERTO DE...).
 */
function normalizar(literal) {
  var s = (literal === null || literal === undefined) ? '' : String(literal);
  s = s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // sin acentos
  s = s.replace(/[^A-Z0-9]+/g, ' ');                                    // puntuacion -> espacio
  s = ' ' + s.replace(/\s+/g, ' ').trim() + ' ';                        // bordes con espacio para matchear tokens
  var i;
  for (i = 0; i < FRASES_RUIDO.length; i++) { while (s.indexOf(FRASES_RUIDO[i]) >= 0) { s = s.replace(FRASES_RUIDO[i], ' '); } }
  for (i = 0; i < TOKENS_RUIDO.length; i++) { while (s.indexOf(TOKENS_RUIDO[i]) >= 0) { s = s.replace(TOKENS_RUIDO[i], ' '); } }
  for (i = 0; i < ABREVIATURAS.length; i++) { while (s.indexOf(ABREVIATURAS[i][0]) >= 0) { s = s.replace(ABREVIATURAS[i][0], ABREVIATURAS[i][1]); } }
  return s.replace(/\s+/g, ' ').trim();
}

// Distancia de edicion (Levenshtein). Reutilizable, sin dependencias.
function distanciaEdicion(a, b) {
  a = a || ''; b = b || '';
  if (a === b) { return 0; }
  var la = a.length, lb = b.length;
  if (la === 0) { return lb; }
  if (lb === 0) { return la; }
  var prev = [], i, j;
  for (j = 0; j <= lb; j++) { prev[j] = j; }
  for (i = 1; i <= la; i++) {
    var cur = [i], ca = a.charAt(i - 1);
    for (j = 1; j <= lb; j++) {
      var cost = (ca === b.charAt(j - 1)) ? 0 : 1;
      var m = prev[j] + 1;
      if (cur[j - 1] + 1 < m) { m = cur[j - 1] + 1; }
      if (prev[j - 1] + cost < m) { m = prev[j - 1] + cost; }
      cur[j] = m;
    }
    prev = cur;
  }
  return prev[lb];
}

function tokens(norm) { return norm ? norm.split(' ') : []; }
function subconjuntoTokens(chico, grande) {
  // true si TODOS los tokens de `chico` estan en `grande` (y chico no vacio).
  var tc = tokens(chico), tg = {}, i;
  if (tc.length === 0) { return false; }
  tokens(grande).forEach(function (t) { tg[t] = true; });
  for (i = 0; i < tc.length; i++) { if (!tg[tc[i]]) { return false; } }
  return true;
}

// Indexa el catalogo: lista de { id_punto, nombre_canonico, norm } por cada
// nombre canonico y por cada alias.
function indexar(catalogo) {
  var entradas = [];
  (catalogo || []).forEach(function (p) {
    if (!p || !p.id_punto) { return; }
    if (p.nombre_canonico) { entradas.push({ id_punto: p.id_punto, nombre_canonico: p.nombre_canonico, norm: normalizar(p.nombre_canonico), es_alias: false }); }
    var al = (p.alias === null || p.alias === undefined) ? '' : String(p.alias);
    al.split('|').forEach(function (a) {
      var t = a.trim();
      if (t) { entradas.push({ id_punto: p.id_punto, nombre_canonico: p.nombre_canonico, norm: normalizar(t), es_alias: true }); }
    });
  });
  return entradas;
}

function resultadoResuelto(ent, confianza, metodo, literal, motivoExtra) {
  var revisar = (confianza !== 'alta');
  var motivo = 'punto "' + literal + '" -> ' + ent.nombre_canonico + ' (' + metodo + ', confianza ' + confianza + ')';
  if (motivoExtra) { motivo += '; ' + motivoExtra; }
  return {
    id_punto: ent.id_punto,
    nombre_canonico: ent.nombre_canonico,
    confianza: confianza,
    metodo: metodo,
    literal_original: literal,
    revisar: revisar,
    motivo: revisar ? motivo : ''
  };
}

function noReconocido(literal, motivoExtra) {
  var lit = (literal === null || literal === undefined) ? '' : String(literal);
  var motivo = 'punto_no_reconocido: no se pudo resolver el literal "' + lit + '"';
  if (motivoExtra) { motivo += ' (' + motivoExtra + ')'; }
  return {
    id_punto: null, nombre_canonico: null, confianza: 'ninguna', metodo: 'punto_no_reconocido',
    literal_original: lit, revisar: true, motivo: motivo
  };
}

/**
 * Resuelve UN literal contra el catalogo. Cascada estricta (§9).
 * @param {string} literal
 * @param {'documento'|'ficha'} [fuente='documento'] la ficha es sospechosa (§4):
 *   si resuelve, se le baja la confianza un escalon.
 * @param {Array} catalogo
 */
function resolverPunto(literal, fuente, catalogo) {
  fuente = fuente || 'documento';
  var norm = normalizar(literal);
  if (!norm) { return noReconocido(literal, 'literal vacio tras normalizar'); }
  var idx = indexar(catalogo);

  // 0) Override intencional de oficina (gana sobre TODA la cascada). Busca el
  // canonico destino en el catalogo y resuelve a el, con la nota en el motivo.
  if (Object.prototype.hasOwnProperty.call(OVERRIDES_LITERAL, norm)) {
    var ov = OVERRIDES_LITERAL[norm];
    var normDest = normalizar(ov.destino);
    for (var k = 0; k < idx.length; k++) {
      if (!idx[k].es_alias && idx[k].norm === normDest) {
        return {
          id_punto: idx[k].id_punto, nombre_canonico: idx[k].nombre_canonico,
          confianza: 'alta', metodo: 'override', literal_original: literal,
          revisar: false, override: true,
          motivo: 'override intencional de oficina: "' + literal + '" -> ' + idx[k].nombre_canonico + '. ' + ov.nota
        };
      }
    }
    return noReconocido(literal, 'override a "' + ov.destino + '" pero ese punto no esta en el catalogo');
  }

  // 1) exacto contra un nombre_canonico. 2) exacto contra un alias.
  var canon = null, alias = null, i;
  var canonIds = {}; // id_punto distintos con match canonico exacto (para duplicados)
  for (i = 0; i < idx.length; i++) {
    if (idx[i].norm === norm) {
      if (!idx[i].es_alias) { if (!canon) { canon = idx[i]; } canonIds[idx[i].id_punto] = idx[i]; }
      if (idx[i].es_alias && !alias) { alias = idx[i]; }
    }
  }
  // Duplicado en catalogo: mismo nombre EXACTO, dos Cod.Pto. distintos (ej. GARNICA
  // GARNI/GARNL). No se puede saber cual se uso desde el nombre -> NO elegir, es
  // decision de Julio (§ dato: 5 duplicados marcados pendientes).
  if (Object.keys(canonIds).length > 1) {
    var cods = Object.keys(canonIds).join(', ');
    return noReconocido(literal, 'duplicado en catalogo: mismo nombre con varios Cod.Pto. (' + cods + ') — decision pendiente de Julio');
  }
  var base = null, metodo = null;
  if (canon) { base = resultadoResuelto(canon, 'alta', 'canonico', literal); metodo = 'canonico'; }
  else if (alias) { base = resultadoResuelto(alias, 'alta', 'alias', literal); metodo = 'alias'; }

  if (!base) {
    // 3) distancia de edicion <=1 contra EXACTAMENTE un canonico.
    var cercanos = {};
    for (i = 0; i < idx.length; i++) {
      if (idx[i].es_alias) { continue; }
      if (distanciaEdicion(norm, idx[i].norm) <= 1) { cercanos[idx[i].id_punto] = idx[i]; }
    }
    var idsCerca = Object.keys(cercanos);
    if (idsCerca.length === 1) {
      base = resultadoResuelto(cercanos[idsCerca[0]], 'media', 'distancia', literal, 'lectura parecida a un canonico (distancia 1) — verificar');
    }
  }
  if (!base) {
    // 4) contencion de tokens UNIVOCA (CALDAS subconjunto de CALDAS DE REIS).
    var contiene = {};
    for (i = 0; i < idx.length; i++) {
      if (subconjuntoTokens(norm, idx[i].norm)) { contiene[idx[i].id_punto] = idx[i]; }
    }
    var idsCont = Object.keys(contiene);
    if (idsCont.length === 1) {
      base = resultadoResuelto(contiene[idsCont[0]], 'media', 'contencion', literal, 'nombre contenido en un unico canonico — verificar');
    } else if (idsCont.length > 1) {
      var nombres = idsCont.map(function (k) { return contiene[k].nombre_canonico; }).join(', ');
      return noReconocido(literal, 'ambiguo: contenido en varios canonicos (' + nombres + ')');
    }
  }
  if (!base) {
    // 5) LOCALIDAD DENTRO DE UNA DIRECCION (encargo Julio 2026-08-25).
    // Los documentos no escriben el pueblo suelto: escriben la direccion entera
    // ("CELLMARK, MUELLE DE LA ENERGIA S/N, 08039 BARCELONA", "Finsa Cella 2,
    // CELLA-TERUEL 44370 España"). Los pasos 1-4 buscan el literal DENTRO del
    // canonico (CALDAS -> CALDAS DE REIS); aca se busca al reves: el nombre
    // canonico como TOKENS COMPLETOS dentro del literal largo. Es lo que permite
    // traducir origen/destino de un CMR o una orden a punto Gesruta sin listas
    // por cliente. Gana el canonico MAS LARGO (mas especifico: "VILA NOVA DE
    // FAMALICAO" sobre "FAMALICAO"); si dos distintos empatan, es ambiguo.
    // Gana el que aparece ANTES en el literal, no el mas largo: las direcciones
    // van de lo ESPECIFICO a lo GENERAL ("Navia Asturias", "Monte Redondo -
    // Leiria", "Teixeiro (Curtis)"). Con "el mas largo" se elegia ASTURIAS (la
    // provincia) sobre NAVIA (el pueblo), que es el punto real de descarga.
    // A igual posicion, desempata el mas largo (mas especifico).
    var dentro = {}, mejorPos = -1, mejorLen = 0;
    var espaciado = ' ' + norm + ' ';
    for (i = 0; i < idx.length; i++) {
      var cand = idx[i].norm;
      if (!cand || cand.length < 4) { continue; }
      var pos = espaciado.indexOf(' ' + cand + ' ');
      if (pos < 0) { continue; }
      if (mejorPos < 0 || pos < mejorPos || (pos === mejorPos && cand.length > mejorLen)) {
        mejorPos = pos; mejorLen = cand.length; dentro = {};
      }
      if (pos === mejorPos && cand.length === mejorLen) { dentro[idx[i].id_punto] = idx[i]; }
    }
    var idsDentro = Object.keys(dentro);
    if (idsDentro.length === 1) {
      base = resultadoResuelto(dentro[idsDentro[0]], 'media', 'localidad_en_direccion', literal,
        'nombre del punto hallado dentro de la direccion del documento — verificar');
    } else if (idsDentro.length > 1) {
      var nomsD = idsDentro.map(function (k) { return dentro[k].nombre_canonico; }).join(', ');
      return noReconocido(literal, 'la direccion menciona varios puntos (' + nomsD + ')');
    }
  }
  if (!base) { return noReconocido(literal); }

  // Precedencia por fuente (§4): la ficha es sospechosa -> baja un escalon.
  if (fuente === 'ficha' && base.confianza !== 'ninguna') {
    var cNueva = bajarConfianza(base.confianza);
    base.confianza = cNueva;
    base.revisar = (cNueva !== 'alta');
    var nota = 'valor de ficha (fuente sospechosa): confianza reducida a ' + cNueva;
    base.motivo = base.motivo ? (base.motivo + '; ' + nota) : ('punto "' + literal + '" -> ' + base.nombre_canonico + '; ' + nota);
  }
  return base;
}

/**
 * Resuelve un punto con precedencia documento > ficha (§4).
 * El documento manda; la ficha solo confirma. Si ambos resuelven y difieren,
 * gana el documento y se deja la correccion anotada en el motivo.
 */
function resolverPuntoDocFicha(literalDoc, literalFicha, catalogo) {
  var rDoc = literalDoc ? resolverPunto(literalDoc, 'documento', catalogo) : null;
  var rFicha = literalFicha ? resolverPunto(literalFicha, 'ficha', catalogo) : null;

  if (rDoc && rDoc.id_punto) {
    if (rFicha && rFicha.id_punto && rFicha.id_punto !== rDoc.id_punto) {
      rDoc.revisar = true;
      var corr = 'la ficha decia "' + literalFicha + '" (=' + rFicha.nombre_canonico + '); manda el documento (§4)';
      rDoc.motivo = rDoc.motivo ? (rDoc.motivo + '; ' + corr) : corr;
    }
    return rDoc;
  }
  if (rFicha && rFicha.id_punto) { return rFicha; } // solo ficha: ya viene con confianza reducida
  // Ninguno resolvio: reportar sobre el literal que exista (documento primero).
  return rDoc || rFicha || noReconocido(literalDoc || literalFicha);
}

/**
 * Aprendizaje automatico de alias (decision de Julio: sin cola de aprobacion).
 * Cuando el operador corrige un punto, el literal original se agrega como alias
 * del canonico elegido. Salvaguarda dura: un literal NO puede ser alias de dos
 * canonicos. Todo alias guarda procedencia (reversible).
 *
 * @returns {{escribir, alias, alias_norm, id_punto, procedencia, conflicto,
 *            id_conflicto, ya_existe, motivo}}
 */
function aprenderAlias(literal, idCanonicoElegido, catalogo, procedencia) {
  var norm = normalizar(literal);
  if (!norm) { return { escribir: false, conflicto: false, ya_existe: false, motivo: 'literal vacio, no se aprende alias' }; }
  var idx = indexar(catalogo);
  var duenoActual = null, i;
  for (i = 0; i < idx.length; i++) {
    if (idx[i].norm === norm) { duenoActual = idx[i].id_punto; break; }
  }
  if (duenoActual !== null) {
    if (duenoActual === idCanonicoElegido) {
      return { escribir: false, conflicto: false, ya_existe: true, id_punto: idCanonicoElegido, alias: literal, alias_norm: norm, motivo: 'el literal ya resuelve a ese canonico; no se duplica' };
    }
    // CONFLICTO: el literal ya es alias/canonico de OTRO punto. No se escribe.
    return {
      escribir: false, conflicto: true, ya_existe: true, id_punto: idCanonicoElegido, id_conflicto: duenoActual,
      alias: literal, alias_norm: norm,
      motivo: 'CONFLICTO: "' + literal + '" ya resuelve a ' + duenoActual + '; no puede ser alias de ' + idCanonicoElegido + ' — a cola-puntos.json'
    };
  }
  return {
    escribir: true, conflicto: false, ya_existe: false,
    id_punto: idCanonicoElegido, alias: literal, alias_norm: norm,
    procedencia: procedencia || null,
    motivo: 'alias nuevo "' + literal + '" -> ' + idCanonicoElegido
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizar: normalizar,
    distanciaEdicion: distanciaEdicion,
    resolverPunto: resolverPunto,
    resolverPuntoDocFicha: resolverPuntoDocFicha,
    aprenderAlias: aprenderAlias,
    indexar: indexar
  };
}

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

// ===== VALIDACIONES DE FORMA (Capa 2) — CAMBIO 2 =====================
//
// Chequeos DETERMINISTAS sobre el valor ya leido, self-contained: no dependen
// del correlacionador ni de ningun estado del pipeline. Marcan la CELDA concreta
// que falla una regla de forma, para que en la vista de Pendientes lleve "!".
//
// Son la Capa 2 del "!". La Capa 1 (duda por campo del modelo de extraccion,
// alias `campos_dudosos` en el correlacionador) NO se implementa en este encargo
// (decision D del addendum): tocaria el nodo critico de lectura y queda como
// encargo futuro. Aca solo hay reglas de forma, que no razonan sobre confianza.
//
// Las tres reglas del encargo:
//   (a) patron de matricula (tractora / remolque)
//   (b) fecha de descarga >= fecha de carga
//   (c) cantidad > 0
//
// Filosofia de nulos: una regla NO marca "!" por dato AUSENTE (eso es otro eje:
// falta de documentacion / lectura a revisar, a nivel fila). Marca por dato
// PRESENTE pero mal formado. Excepcion pedida en el encargo: la cantidad 0 /
// vacia / no numerica SI lleva "!" (regla c explicita).

'use strict';

// --- (a) Matricula ---------------------------------------------------------
// Compacta (mayusculas, sin espacios ni guiones) y matchea contra los formatos
// reales que maneja la flota:
//   - actual (2000+):      NNNN LLL           -> 2498KZL, 1234-ABC
//   - remolque (prefijo R): R NNNN LL[L]      -> R1007BCV
//   - historico provincia: L[L] NNNN..NN L[L] -> M1234AB, PO1234K, GC12345
// Vacio -> valida (ausencia no es error de forma; la marca de "!" por forma es
// para un valor presente que no parece matricula, ej. "AVEIRO" en el campo).
var RE_MATRICULA_ACTUAL = /^\d{4}[A-Z]{3}$/;
var RE_MATRICULA_REMOLQUE = /^R\d{4}[A-Z]{2,3}$/;
var RE_MATRICULA_HISTORICA = /^[A-Z]{1,2}\d{4,6}[A-Z]{0,2}$/;

function compactarMatricula(v) {
  return String(v == null ? '' : v).toUpperCase().replace(/[\s-]/g, '');
}

/** ¿El valor tiene forma de matricula? Vacio -> true (no es error de forma). */
function esMatriculaValida(v) {
  var c = compactarMatricula(v);
  if (!c) { return true; }
  return RE_MATRICULA_ACTUAL.test(c) || RE_MATRICULA_REMOLQUE.test(c) || RE_MATRICULA_HISTORICA.test(c);
}

// --- (b) Fechas ------------------------------------------------------------
// Solo compara si AMBAS son fechas ISO parseables. Si falta una o no parsea,
// no se puede afirmar el desorden -> no marca (indeterminado != invalido).
function parseFechaISO(s) {
  if (!s) { return null; }
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s).trim());
  if (!m) { return null; }
  var t = Date.parse(m[1] + '-' + m[2] + '-' + m[3] + 'T00:00:00Z');
  return isFinite(t) ? t : null;
}

/** ¿fecha_descarga >= fecha_carga? Indeterminado (falta o no parsea) -> true. */
function fechasEnOrden(fechaCarga, fechaDescarga) {
  var c = parseFechaISO(fechaCarga);
  var d = parseFechaISO(fechaDescarga);
  if (c === null || d === null) { return true; }
  return d >= c;
}

// --- (c) Cantidad ----------------------------------------------------------
/** ¿cantidad numerica > 0? Vacia / cero / no numerica -> false (regla c). */
function esCantidadValida(x) {
  if (x === null || x === undefined || x === '') { return false; }
  var n = (typeof x === 'number') ? x : Number(String(x).replace(',', '.'));
  return isFinite(n) && n > 0;
}

// --- Cantidad efectiva + unidad de medida ----------------------------------
// La cantidad que se muestra: el peso del documento si existe, si no el de la
// ficha. La unidad de los pesos cargados es kg (el numero sin U.M. miente).
function cantidadDe(viaje) {
  var v = viaje || {};
  var kgDoc = (typeof v.kg_documento === 'number' && isFinite(v.kg_documento)) ? v.kg_documento : null;
  var kgHoja = (typeof v.kg_hoja === 'number' && isFinite(v.kg_hoja)) ? v.kg_hoja : null;
  var valor = (kgDoc !== null) ? kgDoc : kgHoja;
  return { valor: valor, um: 'kg' };
}

// --- Dieta (se lee del JSON `detalle`, no es columna) ----------------------
// Decision C del addendum: la dieta es dato de LECTURA de la ficha (recuadro
// GASTOS DEL VIAJE), vive dentro del JSON `detalle`/gastos. Se lee con
// tolerancia: si el viaje no la trae, celda vacia (nunca "!").
function dietaDeDetalle(detalleStr) {
  if (!detalleStr) { return null; }
  var d;
  try { d = (typeof detalleStr === 'object') ? detalleStr : JSON.parse(detalleStr); } catch (e) { return null; }
  if (!d || typeof d !== 'object') { return null; }
  var gastos = Array.isArray(d.gastos) ? d.gastos : null;
  if (!gastos) { return null; }
  var total = 0;
  var hubo = false;
  for (var i = 0; i < gastos.length; i++) {
    var g = gastos[i] || {};
    if (String(g.tipo || '').toLowerCase() === 'dieta') {
      var imp = (typeof g.importe === 'number') ? g.importe : Number(String(g.importe || '').replace(',', '.'));
      if (isFinite(imp)) { total += imp; hubo = true; }
    }
  }
  return hubo ? total : null;
}

// --- Marcas de forma por celda ---------------------------------------------
/**
 * Devuelve, por campo, la lista de motivos de forma que le ponen "!" a esa
 * celda. Solo incluye campos que fallan; un viaje limpio devuelve {}.
 * Claves usadas: tractora, semi, fecha, fecha_descarga, cantidad.
 * @param {object} viaje  fila de la tabla Viajes.
 * @returns {Object<string,string[]>}
 */
function marcasForma(viaje) {
  var v = viaje || {};
  var marcas = {};
  var push = function (campo, motivo) {
    if (!marcas[campo]) { marcas[campo] = []; }
    marcas[campo].push(motivo);
  };

  if (!esMatriculaValida(v.tractora)) {
    push('tractora', 'matricula con formato invalido: "' + (v.tractora || '') + '"');
  }
  if (!esMatriculaValida(v.semi)) {
    push('semi', 'matricula con formato invalido: "' + (v.semi || '') + '"');
  }
  if (!fechasEnOrden(v.fecha, v.fecha_descarga)) {
    push('fecha', 'fecha de descarga anterior a la de carga');
    push('fecha_descarga', 'fecha de descarga anterior a la de carga');
  }
  var cant = cantidadDe(v);
  if (!esCantidadValida(cant.valor)) {
    push('cantidad', 'cantidad ausente, cero o no numerica');
  }
  return marcas;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    esMatriculaValida: esMatriculaValida,
    fechasEnOrden: fechasEnOrden,
    esCantidadValida: esCantidadValida,
    cantidadDe: cantidadDe,
    dietaDeDetalle: dietaDeDetalle,
    marcasForma: marcasForma
  };
}

// ===== VISTA DE PENDIENTES — filtro y render =====
//
// Cierre v1 pieza 2 + v1.1 pieza 1 + CAMBIO 2 (tabla de resultado editable).
//
// Lista consultable de todo lo que quedo esperando algo: falta documentacion
// (estado === 'PENDIENTE_DOCUMENTACION') o la lectura fue dudosa
// (estado_lectura === 'REVISAR', incluye el cliente_no_reconocido de cierre-v1).
// Son DOS EJES independientes (un viaje puede estar en uno, el otro, los dos, o
// ninguno) — el filtro es OR, no AND.
//
// CAMBIO 2: cada viaje se muestra como una fila editable con las columnas reales
// de `viajes` (nombres resueltos; los codigos Gesruta son de la Pieza C, no van).
//   - "!" por celda = validaciones de FORMA (validaciones-forma.js): patron de
//     matricula, fecha descarga >= carga, cantidad > 0. Marca la celda concreta.
//   - Resaltado a nivel FILA: estado_lectura=REVISAR muestra el motivo como
//     observacion (no se puede atribuir a una celda sin campos_dudosos, que es
//     encargo futuro — decision D del addendum).
//   - Faltante de documentacion: marcado PROMINENTE (banda ⚠) con que falta y a
//     quien reclamar (dato ya en la base: PENDIENTE_DOCUMENTACION + pendiente_*).
//   - dieta: se lee del JSON `detalle`/gastos (dato de lectura, no columna); si
//     el viaje no la trae, celda vacia.
//   - Edicion de celda: postea a /webhook/viajes-accion. `cliente` va por el
//     verbo `corregir` (revalida regimen/pais); el resto por `corregir_celda`
//     (sin revalidar, el humano es la autoridad). `confirmar` marca la fila
//     lista para Gesruta (estado_carga -> confirmada).
//
// Lee directo de la tabla `Viajes` (lrBxWpTUxMtO8U48) via el nodo dataTable
// "Leer Viajes".

'use strict';

// Modulo de validaciones de forma: inlineado antes que este archivo en el nodo
// (build-nodo.js), o require en tests.
// Resolvedores de codigo Gesruta (conjunto cerrado). En el nodo se inlinean con
// build-nodo.js; en tests se hace require. cod_origen/cod_destino necesitan el
// catalogo de puntos, que llega por parametro (Leer Puntos Pendientes).
var GES = (typeof resolverMaterial === 'function')
  ? { resolverMaterial: resolverMaterial, resolverChofer: resolverChofer }
  : require('../catalogo/gesruta.js');
var PUN = (typeof resolverPunto === 'function')
  ? { resolverPunto: resolverPunto }
  : require('../catalogo/resolver-punto.js');
var CLIG = (typeof codigoCliente === 'function')
  ? { codigoCliente: codigoCliente }
  : require('../catalogo/clientes-gesruta.js');

// Precio/indexacion: mismos modulos que la Planilla. La vista de pendientes
// muestra el formato completo (formato objetivo Excelente_detalle_Code_Tabla).
// El precio contractual sale de la tabla Tarifas; la indexacion, de la tabla
// Indexacion. Para un viaje incompleto (pendiente) muchas veces no resuelven:
// la columna queda vacia, que es lo honesto (no se factura lo que falta).
var TAR = (typeof buscarTarifa === 'function')
  ? { buscarTarifa: buscarTarifa }
  : require('./tarifas.js');
var PERF = (typeof periodoFacturacion === 'function')
  ? { periodoFacturacion: periodoFacturacion }
  : require('./periodo-facturacion.js');
var IDX = (typeof indexacionDeFila === 'function')
  ? { grupoIndexacion: grupoIndexacion, buscarPct: buscarPct }
  : require('./indexacion.js');
var SUP = (typeof todosLosTramos === 'function')
  ? { tramosDe: tramosDe }
  : require('../catalogo/suplemento-gasoleo.js');
function round2p(n) { return Math.round(n * 100) / 100; }

var VF = (typeof marcasForma === 'function')
  ? { marcasForma: marcasForma, cantidadDe: cantidadDe, dietaDeDetalle: dietaDeDetalle }
  : require('./validaciones-forma.js');

// URL del webhook de acciones. DEBE ser ABSOLUTA: la pagina se sirve desde
// studio-julio.duckdns.org/webhook/viajes-pendientes; una ruta relativa
// ("webhook/viajes-accion") resuelve mal en el navegador (DNS_PROBE_FINISHED_
// NXDOMAIN) y ninguna correccion/confirmacion se guarda. Igual que el HTML de
// ingesta, que postea a su webhook por URL absoluta.
var WEBHOOK_ACCION = 'https://studio-julio.duckdns.org/webhook/viajes-accion';

/** Dias transcurridos desde createdAt, redondeados hacia abajo, nunca negativo. */
function diasEsperando(createdAt, ahoraMs) {
  if (!createdAt) { return null; }
  var t = Date.parse(createdAt);
  if (!isFinite(t)) { return null; }
  var ahora = (typeof ahoraMs === 'number') ? ahoraMs : Date.now();
  return Math.max(0, Math.floor((ahora - t) / 86400000));
}

/**
 * ¿El viaje espera algo? Dos ejes independientes (§3 estado de documentacion,
 * estado_lectura de la ficha/cierre-v1): cualquiera de los dos alcanza.
 */
function esPendiente(v) {
  return v.estado === 'PENDIENTE_DOCUMENTACION' || v.estado_lectura === 'REVISAR';
}

// Lectura de historial_correcciones SOLO para mostrar notas (incidencias) en la
// fila. Copia deliberadamente chica de la logica que vive en
// acciones-pendientes.js (que ESCRIBE el historial), para no inflar este nodo.
function notasDeHistorial(historialStr) {
  if (!historialStr) { return []; }
  var lista;
  try { lista = JSON.parse(historialStr); } catch (e) { return []; }
  if (!Array.isArray(lista)) { return []; }
  var out = [];
  for (var i = 0; i < lista.length; i++) {
    var h = lista[i];
    if (h && h.accion === 'incidencia' && h.valor_nuevo) { out.push(h.valor_nuevo); }
  }
  return out;
}

/**
 * Filtra los viajes pendientes, enriquece cada uno con lo que la tabla editable
 * necesita (celdas + marcas de forma + dieta + faltante), calcula dias_esperando
 * y ordena por antiguedad descendente (lo mas viejo primero).
 * @param {Array<object>} viajes  filas crudas de la tabla Viajes.
 * @param {number} [ahoraMs]      instante de referencia (tests deterministas).
 * @returns {Array<object>}
 */
// El campo origen/destino del viaje puede venir ya con formato "CODIGO · NOMBRE"
// (lo arma Preparar Filas Viajes con puntoGesruta). Para la tabla se separa: el
// codigo va a su columna propia y el nombre a la columna origen/destino, sin
// duplicar el codigo pegado al nombre (era el "COGER · COGER" de la captura).
var SEP_PUNTO = ' \u00b7 '; // " · "
function soloNombrePunto(valor) {
  var s = (valor === null || valor === undefined) ? '' : String(valor);
  var i = s.indexOf('\u00b7');
  return (i >= 0) ? s.slice(i + 1).trim() : s.trim();
}
function codigoPunto(valor, puntos) {
  var s = (valor === null || valor === undefined) ? '' : String(valor);
  var i = s.indexOf('\u00b7');
  if (i > 0) { return s.slice(0, i).trim(); }       // ya trae el codigo delante
  var r = PUN.resolverPunto(s, 'documento', puntos); // fila vieja sin codigo: resolver
  return (r && r.id_punto) ? r.id_punto : null;
}

/**
 * Precio contractual, importe, regimen pais (G/GPT) y periodo (quincenal/mensual)
 * de un viaje, para las columnas de facturacion de la tabla. El precio sale de la
 * tabla Tarifas (contractual); si no resuelve, queda vacio (honesto). El importe
 * es cantidad x tarifa (o el fijo). El origen del precio dice de donde salio.
 */
function calcularPrecioFila(v, tarifas) {
  // UN SOLO MOTOR DE TARIFA (bug real ejec 1076). Antes esta vista RECALCULABA la
  // tarifa con buscarTarifa() mientras la ingesta la habia calculado con
  // buscarTarifaContractual(): dos motores distintos, dos resultados distintos con
  // los mismos datos. La ingesta ya guardo el resultado en las columnas
  // tarifa_contractual_tn / _fijo / _motivo; la vista LEE eso. Un solo lugar donde
  // se decide el precio.
  var tn = (typeof v.tarifa_contractual_tn === 'number' && isFinite(v.tarifa_contractual_tn)) ? v.tarifa_contractual_tn : null;
  var fijo = (typeof v.tarifa_contractual_fijo === 'number' && isFinite(v.tarifa_contractual_fijo)) ? v.tarifa_contractual_fijo : null;
  var precio = null, unidad = '', importe = null, origen_precio = '';

  var kg = (typeof v.kg_documento === 'number' && isFinite(v.kg_documento)) ? v.kg_documento
    : (typeof v.kg_hoja === 'number' && isFinite(v.kg_hoja)) ? v.kg_hoja : null;

  if (fijo !== null) {
    precio = fijo; unidad = '\u20ac/viaje'; importe = round2p(fijo);
    origen_precio = 'tarifa contractual';
  } else if (tn !== null) {
    precio = tn; unidad = '\u20ac/tn';
    if (kg !== null) { importe = round2p((kg / 1000) * tn); }
    origen_precio = 'tarifa contractual';
  } else if (typeof v.tarifa_tn_documento === 'number' && isFinite(v.tarifa_tn_documento)) {
    // Cascada 3: el precio impreso en la ORDEN del cliente (Baltransa/Transtambre
    // lo traen). Es un precio pactado por operacion, vale.
    precio = v.tarifa_tn_documento; unidad = '\u20ac/tn';
    if (kg !== null) { importe = round2p((kg / 1000) * precio); }
    origen_precio = 'precio de la orden';
  } else if (typeof v.importe_documento === 'number' && isFinite(v.importe_documento)) {
    precio = v.importe_documento; unidad = '\u20ac/viaje'; importe = round2p(v.importe_documento);
    origen_precio = 'precio de la orden';
  } else {
    // Sin precio: el motivo que dejo la ingesta explica POR QUE (sin cliente, sin
    // tarifa para la ruta, varias candidatas...). Es informacion, no un hueco mudo.
    origen_precio = String(v.tarifa_contractual_motivo || (v.cliente ? 'sin tarifa para la ruta' : 'sin cliente'));
  }

  var per = PERF.periodoFacturacion(v.cliente);
  var pais = String(v.pais_facturacion || '').toUpperCase();

  // INDEXACION: % del tramo vigente (solapa del cliente + fecha del viaje) sobre
  // el IMPORTE del porte. El suplemento esta en el repo (79 tramos, 6 solapas);
  // antes esta vista no lo cruzaba nunca y la columna quedaba siempre vacia.
  // Si la fecha cae en dos tramos con % distinto, buscarPct devuelve ambiguo y NO
  // se elige: elegir seria elegir cuanto se factura.
  var pct = null, importe_idx = null, motivo_idx = '';
  var g = IDX.grupoIndexacion(v.cliente);
  if (!v.cliente) {
    motivo_idx = 'sin cliente';
  } else if (v.regimen_indexacion === 'incluida') {
    pct = 0; importe_idx = 0; motivo_idx = 'incluida en el precio';
  } else if (v.regimen_indexacion === 'sin_indexacion') {
    pct = 0; importe_idx = 0; motivo_idx = 'el cliente no lleva indexacion';
  } else {
    var hit = IDX.buscarPct(g.grupo, v.fecha, SUP.tramosDe(g.grupo));
    if (hit && hit.ambiguo) {
      motivo_idx = 'la fecha cae en dos tramos con % distinto: definir cual rige';
    } else if (hit) {
      pct = hit.pct;
      if (importe !== null) { importe_idx = round2p(importe * hit.pct); }
      else { motivo_idx = 'sin importe: falta el precio para aplicar el %'; }
    } else {
      motivo_idx = 'sin tramo de indexacion vigente para ' + g.grupo + ' en ' + (v.fecha || 'sin fecha');
    }
  }

  return {
    precio: precio, unidad: unidad, importe: importe, origen_precio: origen_precio,
    quincena: per.periodo || '',
    regimen_pais: (pais === 'PT') ? 'GPT' : (pais === 'ES' ? 'G' : ''),
    pct_indexacion: (pct === null) ? null : (round2p(pct * 100) + '%'),
    importe_indexacion: importe_idx,
    motivo_indexacion: motivo_idx
  };
}

function filtrarPendientes(viajes, ahoraMs, puntos, tarifas) {
  var lista = Array.isArray(viajes) ? viajes : [];
  var out = [];
  for (var i = 0; i < lista.length; i++) {
    var v = lista[i] || {};
    // TODOS los viajes del lote (decision de Julio 2026-08-26). Antes se filtraba
    // por esPendiente() y los viajes CORRECTOS no se listaban -> "los viajes 2 y 3
    // no aparecen". La planilla tiene que mostrar el lote completo; el estado de
    // cada fila dice si requiere accion. esPendiente() sigue usandose para eso.
    v = v || {};
    var cant = VF.cantidadDe(v);
    v._precio = calcularPrecioFila(v, tarifas);
    out.push({
      id: v.id,
      numero: (v.orden === null || v.orden === undefined) ? '' : v.orden,
      // --- resumen (compat cierre-v1) ---
      fecha_carga: v.fecha || null,
      chofer: v.conductor || null,
      cliente: v.cliente || null,
      ruta: (v.origen || '?') + ' → ' + (v.destino || '?'),
      que_falta: v.pendiente_falta || null,
      reclamar_a: v.pendiente_reclamar_a || null,
      motivo_revision: v.motivo_revision || null,
      dias_esperando: diasEsperando(v.createdAt, ahoraMs),
      notas: notasDeHistorial(v.historial_correcciones),
      // --- ejes de atencion ---
      falta_doc: v.estado === 'PENDIENTE_DOCUMENTACION',
      revisar: v.estado_lectura === 'REVISAR',
      // --- celdas de la tabla editable (valores crudos) ---
      tractora: v.tractora || '',
      semi: v.semi || '',
      conductor: v.conductor || '',
      origen: soloNombrePunto(v.origen),
      destino: soloNombrePunto(v.destino),
      material: v.material || '',
      referencia: v.referencia || '',
      fecha: v.fecha || '',
      fecha_descarga: v.fecha_descarga || '',
      cantidad_valor: cant.valor,
      cantidad_um: cant.um,
      // que columna real corrige la celda "cantidad" (el doc manda; si no, la hoja)
      cantidad_campo: (typeof v.kg_documento === 'number' && isFinite(v.kg_documento)) ? 'kg_documento' : 'kg_hoja',
      regimen_indexacion: v.regimen_indexacion || '',
      km_cargados: (v.km_cargados === null || v.km_cargados === undefined) ? '' : v.km_cargados,
      km_vacios: (v.km_vacios === null || v.km_vacios === undefined) ? '' : v.km_vacios,
      dieta: VF.dietaDeDetalle(v.detalle),
      estado_carga: v.estado_carga || 'pendiente_revision',
      // Estado legible del eje real: que le falta a esta fila para ser facturable.
      estado_fila: (v.estado === 'PENDIENTE_DOCUMENTACION') ? 'FALTA DOC'
        : (v.estado_lectura === 'REVISAR') ? 'REVISAR'
        : (v.estado_carga === 'confirmada') ? 'confirmada' : 'OK',
      // --- CODIGOS GESRUTA (display, read-only): las columnas amarillas ---
      codigo_cliente: CLIG.codigoCliente(v.cliente).codigo,
      codigo_chofer: GES.resolverChofer(v.conductor).codigo,
      codigo_material: GES.resolverMaterial(v.material).codigo,
      codigo_origen: codigoPunto(v.origen, puntos),
      codigo_destino: codigoPunto(v.destino, puntos),
      // --- PRECIO / IMPORTE / REGIMEN / PERIODO (formato objetivo) ---
      // (se calculan una vez por viaje mas abajo y se copian aca via _precio)
      precio: v._precio.precio,
      unidad: v._precio.unidad,
      importe: v._precio.importe,
      regimen_pais: v._precio.regimen_pais,
      quincena: v._precio.quincena,
      origen_precio: v._precio.origen_precio,
      pct_indexacion: v._precio.pct_indexacion,
      importe_indexacion: v._precio.importe_indexacion,
      motivo_indexacion: v._precio.motivo_indexacion,
      // marcas de forma por celda { campo: [motivos] }
      marcas: VF.marcasForma(v)
    });
  }
  out.sort(function (a, b) {
    var da = (a.dias_esperando === null) ? -1 : a.dias_esperando;
    var db = (b.dias_esperando === null) ? -1 : b.dias_esperando;
    if (db !== da) { return db - da; }
    return (a.id || 0) - (b.id || 0);
  });
  return out;
}

// --- HTML: server-rendered, sin framework, sin JS de cliente ----------------
function escHtml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Motivo(s) de forma de una celda (unido), o '' si esta limpia. */
function marcaDe(p, campo) {
  var m = p.marcas && p.marcas[campo];
  return (m && m.length) ? m.join('; ') : '';
}

/**
 * Celda EDITABLE: valor + form inline [input][✓] que postea al webhook. `cliente`
 * usa el verbo `corregir` (revalida); el resto `corregir_celda` (sin revalidar).
 * El "!" (marca de forma) es una pista visual; corregir el valor lo limpia solo
 * en el proximo render.
 */
function celdaEditable(p, campo, valor, accion, marcaKey) {
  var marca = marcaDe(p, marcaKey || campo); // marcas indexadas por su clave real
  var warn = marca ? ' class="warn"' : '';
  var bang = marca ? '<span class="bang" title="' + escHtml(marca) + '">!</span> ' : '';
  var motivoHidden = marca ? '<input type="hidden" name="motivo" value="' + escHtml(marca) + '">' : '';
  return '<td' + warn + ' data-campo="' + escHtml(campo) + '">' + bang +
    '<form class="cell">' +
    '<input type="hidden" name="id" value="' + escHtml(p.id) + '">' +
    '<input type="hidden" name="accion" value="' + accion + '">' +
    '<input type="hidden" name="campo" value="' + escHtml(campo) + '">' +
    motivoHidden +
    '<input type="text" name="valor" value="' + escHtml(valor) + '" size="9">' +
    '<button type="submit" title="Guardar (se acepta como verdad, sin revalidar)">✓</button>' +
    '</form></td>';
}

/** Celda de cantidad: input editable (columna real) + U.M. al lado. */
function celdaCantidad(p) {
  var marca = marcaDe(p, 'cantidad');
  var warn = marca ? ' class="warn"' : '';
  var bang = marca ? '<span class="bang" title="' + escHtml(marca) + '">!</span> ' : '';
  var motivoHidden = marca ? '<input type="hidden" name="motivo" value="' + escHtml(marca) + '">' : '';
  var valor = (p.cantidad_valor === null || p.cantidad_valor === undefined) ? '' : p.cantidad_valor;
  return '<td' + warn + ' data-campo="' + escHtml(p.cantidad_campo) + '">' + bang +
    '<form class="cell">' +
    '<input type="hidden" name="id" value="' + escHtml(p.id) + '">' +
    '<input type="hidden" name="accion" value="corregir_celda">' +
    '<input type="hidden" name="campo" value="' + escHtml(p.cantidad_campo) + '">' +
    motivoHidden +
    '<input type="text" name="valor" value="' + escHtml(valor) + '" size="7">' +
    '<span class="um"> ' + escHtml(p.cantidad_um) + '</span>' +
    '<button type="submit" title="Guardar (sin revalidar)">✓</button>' +
    '</form></td>';
}

/** Celda de solo lectura (valor derivado o dato de lectura). */
function celdaDisplay(valor) {
  return '<td>' + escHtml((valor === null || valor === undefined || valor === '') ? '-' : valor) + '</td>';
}

/**
 * Acciones de fila: usuario compartido + valor (cliente/nota) + botones. El
 * cliente va por `corregir` (revalida); resolver/incidencia/confirmar completan.
 */
function accionesHTML(p) {
  return '<form class="acc">' +
    '<input type="hidden" name="id" value="' + escHtml(p.id) + '">' +
    '<input type="text" name="usuario" placeholder="Tu nombre" size="9">' +
    '<input type="text" name="valor" placeholder="Cliente correcto / nota" size="14">' +
    '<button type="submit" name="accion" value="corregir" title="Corrige el cliente y re-evalua el regimen (revalida)">Corregir cliente</button>' +
    '<button type="submit" name="accion" value="resolver" title="La documentacion llego por otra via">Marcar resuelto</button>' +
    '<button type="submit" name="accion" value="incidencia" title="Nota libre, no saca el viaje de la lista">Anotar incidencia</button>' +
    '<button type="submit" name="accion" value="confirmar" title="Revisado/ok: lista para Gesruta (estado_carga -> confirmada)">Confirmar viaje</button>' +
    '</form>';
}

// Formato objetivo (Excelente_detalle_Code_Tabla). Se mantienen las columnas de
// trabajo que el formato objetivo no lista pero que la vista editable necesita:
// Remolque (identidad), Estado carga y Acciones (flujo de confirmacion).
var COLS_TABLA = [
  'Viaje', 'Matricula tractora', 'Remolque', 'Chofer', 'Cod. chofer',
  'Cliente', 'Cod. cliente', 'Cod. origen', 'Origen', 'Cod. destino', 'Destino',
  'Carga', 'Cod. material', 'Referencia', 'Fecha de carga', 'Cantidad',
  'Precio', 'Ud.', 'Importe', 'Reg.', 'Quinc.', '% Index.', 'Indexacion', 'Origen del precio',
  'Km cargado', 'Km vacio', 'Estado', 'Acciones'
];

/** Fila principal (celdas) + fila de observaciones (faltante/motivo/notas). */
function filasDeViaje(p) {
  var main = '<tr data-viaje="' + escHtml(p.id) + '">' +
    celdaDisplay(p.numero) +
    celdaEditable(p, 'tractora', p.tractora, 'corregir_celda') +
    celdaEditable(p, 'semi', p.semi, 'corregir_celda') +
    celdaEditable(p, 'conductor', p.conductor, 'corregir_celda') +
    celdaDisplay(p.codigo_chofer) +
    // cliente: no inline por celda; se corrige por la barra de acciones (verbo
    // corregir, que revalida regimen/pais). Aca solo se muestra el valor.
    '<td class="cli">' + escHtml(p.cliente || '-') + '</td>' +
    celdaDisplay(p.codigo_cliente) +
    celdaDisplay(p.codigo_origen) +
    celdaEditable(p, 'origen', p.origen, 'corregir_celda') +
    celdaDisplay(p.codigo_destino) +
    celdaEditable(p, 'destino', p.destino, 'corregir_celda') +
    celdaEditable(p, 'material', p.material, 'corregir_celda') +
    celdaDisplay(p.codigo_material) +
    celdaEditable(p, 'referencia', p.referencia, 'corregir_celda') +
    celdaEditable(p, 'fecha', p.fecha, 'corregir_celda') +
    // cantidad: corrige la columna real (kg_documento o kg_hoja); muestra la
    // U.M. al lado (el numero sin unidad miente). Marca indexada por 'cantidad'.
    celdaCantidad(p) +
    // --- precio / facturacion (formato objetivo, read-only) ---
    celdaDisplay(p.precio) +
    celdaDisplay(p.unidad) +
    celdaDisplay(p.importe) +
    celdaDisplay(p.regimen_pais) +
    celdaDisplay(p.quincena) +
    celdaDisplay(p.pct_indexacion) +
    celdaDisplay(p.importe_indexacion) +
    celdaDisplay(p.origen_precio) +
    celdaEditable(p, 'km_cargados', p.km_cargados, 'corregir_celda') +
    celdaEditable(p, 'km_vacios', p.km_vacios, 'corregir_celda') +
    '<td class="ecarga">' + escHtml(p.estado_fila) + '</td>' +
    '<td>' + accionesHTML(p) + '</td>' +
    '</tr>';

  // Fila de observaciones: faltante de doc PROMINENTE + motivo de revision + notas.
  var obs = [];
  if (p.falta_doc) {
    obs.push('<span class="falta">⚠ FALTA DOC: ' + escHtml(p.que_falta || 'documentacion del viaje') +
      ' — reclamar a: ' + escHtml(p.reclamar_a || '?') + '</span>');
  }
  if (p.revisar && p.motivo_revision) {
    obs.push('<span class="rev">REVISAR: ' + escHtml(p.motivo_revision) + '</span>');
  }
  if (p.notas && p.notas.length) {
    obs.push('<span class="notas">Notas: ' + p.notas.map(escHtml).join(' | ') + '</span>');
  }
  var obsRow = obs.length
    ? '<tr class="obs"><td colspan="' + COLS_TABLA.length + '">' + obs.join(' &nbsp; ') + '</td></tr>'
    : '';
  return main + obsRow;
}

// JS de cliente: envia las acciones por FETCH (no por form nativo), asi la
// pagina NO navega al guardar. El webhook responde JSON {ok, ...} y este script
// actualiza la fila IN-PLACE (quita el "!", refleja estado_carga/cliente). Ante
// error (HTTP !ok, ok:false o red) marca la celda sin navegar ni perder lo
// tipeado. Sin localStorage/sessionStorage/clipboard/createObjectURL: todo el
// estado vive en el DOM durante la sesion.
var SCRIPT_ACCIONES = [
  '(function(){',
  '  var WEBHOOK=' + JSON.stringify(WEBHOOK_ACCION) + ';',
  '  function filaDe(el){while(el&&el.tagName!=="TR"){el=el.parentNode;}return el;}',
  '  function flash(el,cls){if(!el)return;el.classList.add(cls);setTimeout(function(){el.classList.remove(cls);},1600);}',
  '  function limpiarErr(el){if(el){el.classList.remove("err");el.removeAttribute("title");}}',
  '  function aplicar(form,data){',
  '    var tr=filaDe(form), td=form.parentNode;',
  '    if(form.className.indexOf("cell")>=0){',
  '      td.classList.remove("warn");',
  '      var b=td.querySelector(".bang");if(b){b.parentNode.removeChild(b);}',
  '      var mv=form.querySelector(\'[name="motivo"]\');if(mv){mv.parentNode.removeChild(mv);}',
  '      limpiarErr(td);flash(td,"ok");',
  '    }',
  '    if(tr&&data){',
  '      if(data.estado_carga){var ec=tr.querySelector("td.ecarga");if(ec)ec.textContent=data.estado_carga;}',
  '      if(data.accion==="corregir"){var cc=tr.querySelector("td.cli");if(cc)cc.textContent=data.cliente||"-";}',
  '      if(form.className.indexOf("acc")>=0){limpiarErr(td);flash(tr,"ok");}',
  '    }',
  '  }',
  '  function error(form,msg){var td=form.parentNode;td.classList.add("err");td.setAttribute("title",msg||"Error al guardar");}',
  '  document.addEventListener("submit",function(e){',
  '    var form=e.target;',
  '    if(!form||!form.className||(form.className.indexOf("cell")<0&&form.className.indexOf("acc")<0)){return;}',
  '    e.preventDefault();',
  '    var fd=new FormData(form);',
  '    if(e.submitter&&e.submitter.name){fd.append(e.submitter.name,e.submitter.value);}',
  '    var body=new URLSearchParams();fd.forEach(function(v,k){body.append(k,v);});',
  '    if(!body.get("accion")){return;}',
  '    fetch(WEBHOOK,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()})',
  '      .then(function(r){if(!r.ok){throw new Error("HTTP "+r.status);}return r.json().catch(function(){return {ok:true};});})',
  '      .then(function(d){if(d&&d.ok===false){throw new Error(d.error||"accion rechazada");}aplicar(form,d||{});})',
  '      .catch(function(err){error(form,err&&err.message);});',
  '  });',
  '})();'
].join('\n');

/**
 * Pagina HTML autocontenida: tabla editable ordenada por dias_esperando desc.
 * Lista vacia -> mensaje claro. @param {Array<object>} pendientes salida de
 * filtrarPendientes().
 */
function renderHTML(pendientes) {
  var lista = Array.isArray(pendientes) ? pendientes : [];
  var cuerpo;
  if (lista.length === 0) {
    cuerpo = '<tr><td colspan="' + COLS_TABLA.length + '" class="vacio">No hay viajes pendientes ni en revision. Todo al dia.</td></tr>';
  } else {
    cuerpo = lista.map(filasDeViaje).join('');
  }
  var ths = COLS_TABLA.map(function (t) { return '<th>' + escHtml(t) + '</th>'; }).join('');
  return [
    '<!doctype html><html lang="es"><head><meta charset="utf-8">',
    '<title>Pendientes - Transliquidos Estevez</title>',
    '<style>',
    'body{font-family:system-ui,Arial,sans-serif;margin:1.5rem;background:#f7f7f7;color:#222}',
    'h1{font-size:1.3rem;margin-bottom:.2rem}',
    'p.sub{color:#555;margin-top:0}',
    'table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}',
    'th,td{border:1px solid #ddd;padding:.35rem .45rem;text-align:left;font-size:.82rem;vertical-align:top}',
    'th{background:#333;color:#fff;position:sticky;top:0}',
    '.vacio{text-align:center;padding:2rem;color:#666}',
    'td.warn{background:#fff5d6}',
    '.bang{color:#b34700;font-weight:bold}',
    'td.cli{font-weight:bold}',
    'td.ecarga{white-space:nowrap;color:#555}',
    'form.cell{display:flex;gap:2px;margin:0}',
    'form.cell input[type=text]{padding:.1rem;font-size:.78rem;width:6.5rem}',
    'form.cell button{font-size:.75rem;padding:0 .3rem;cursor:pointer}',
    'form.acc{display:flex;flex-wrap:wrap;gap:.2rem;min-width:230px}',
    'form.acc input{padding:.15rem;font-size:.75rem}',
    'form.acc button{font-size:.72rem;padding:.15rem .35rem;cursor:pointer}',
    'tr.obs td{background:#fbfbfb;font-size:.8rem}',
    '.falta{color:#a11;font-weight:bold}',
    '.rev{color:#b34700}',
    '.notas{color:#555}',
    // feedback in-place del fetch (CAMBIO fetch-acciones): guardado / error.
    'td.ok{background:#d7f5dd !important;transition:background .25s}',
    'tr.ok>td{background:#eafaef}',
    'td.err{outline:2px solid #d11;outline-offset:-2px}',
    '</style></head><body>',
    '<h1>Pendientes (' + lista.length + ')</h1>',
    '<p class="sub">Documentacion faltante o lectura a revisar. Celdas con ! fallan una validacion de forma; corregilas y confirma. Ordenado por antiguedad, lo mas viejo primero.</p>',
    '<table><thead><tr>', ths, '</tr></thead><tbody>',
    cuerpo,
    '</tbody></table>',
    '<script>' + SCRIPT_ACCIONES + '</script>',
    '</body></html>'
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    diasEsperando: diasEsperando,
    esPendiente: esPendiente,
    notasDeHistorial: notasDeHistorial,
    filtrarPendientes: filtrarPendientes,
    escHtml: escHtml,
    accionesHTML: accionesHTML,
    renderHTML: renderHTML,
    COLS_TABLA: COLS_TABLA
  };
}

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
