// ===== TARIFARIO HISTORICO — la tarifa REALMENTE aplicada, ruta por ruta =====
//
// EL PROBLEMA (planteado por Julio, 2026-08-25). El tarifario OFICIAL cubre rutas
// origen-destino pactadas. Pero cuando el destino real no esta tarifado y hay uno
// CERCANO que si, la oficina aplica a mano la tarifa del cercano — sin dar de alta
// la ruta nueva en el tarifario. Ejemplo real: RNM Aveiro -> Teixeiro no esta en
// el tarifario; Aveiro -> Coruña si. Se factura Teixeiro con la tarifa de Coruña.
// Resultado: buscar la tarifa oficial por (cliente, origen, destino) devuelve
// VACIO en esos casos, aunque el viaje si tiene precio conocido.
//
// LA SOLUCION (idea de Julio, validada con dato). En Gesruta el viaje queda
// cargado con el DESTINO CORRECTO y la tarifa que se aplico a mano. O sea: el
// historico de viajes YA CONTIENE la respuesta. Se construye un tarifario ANEXO
// (no oficial) a partir de los viajes del año, indexado por la ruta REAL.
//
// VERIFICACION sobre el export real (8.755 lineas, todo el año):
//   - RNM AVEIR->C = 29,09 y RNM AVEIR->TEIXE = 29,09  <-- el caso exacto
//   - Una misma ruta cambia de precio segun MATERIAL (Foresa 1->OR: COLA 13,85
//     vs FINCAT 20,16). Por eso el material entra en la clave.
//   - Y las tarifas SE ACTUALIZAN con el tiempo (Quimidroga MIR->GUIM:
//     29,80 -> 59,85 -> 61,65). Por eso NO se exige precio unico: manda el MAS
//     RECIENTE, y si hubo cambio se avisa para que el humano lo verifique.
//
// PRECEDENCIA (no se negocia): el tarifario OFICIAL manda. El historico es el
// respaldo para lo que el oficial no cubre, y SIEMPRE marca REVISAR: es una
// tarifa observada, no pactada. Si el historico tampoco resuelve sin ambiguedad,
// queda vacio con motivo. Nunca se inventa un precio.
//
// Logica PURA (sin n8n). El historico se inyecta (data table o export cargado).

'use strict';

function normTxt(s) {
  var t = (s === null || s === undefined) ? '' : String(s);
  return t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Construye el indice del tarifario historico a partir de las lineas de viaje
 * exportadas de Gesruta.
 *
 * Solo se toman las lineas de PORTE (concepto P = nacional, PI = internacional).
 * Las de INDEXACION (G, GPT, G1Q, G2Q) no son tarifa de transporte: van aparte.
 *
 * @param {Array<object>} lineas  filas del export: {cliente, desde, hasta, carga,
 *        precio, unimed, codcon, desdef}
 * @returns {object} indice { 'cliente|origen|destino': [ {material, precio, unidad, fecha, concepto} ] }
 */
function construirIndice(lineas) {
  var idx = {};
  var CONCEPTOS_PORTE = { 'P': true, 'PI': true };
  for (var i = 0; i < (lineas || []).length; i++) {
    var L = lineas[i] || {};
    if (!CONCEPTOS_PORTE[String(L.codcon || L.concepto || '').toUpperCase()]) { continue; }
    var cli = String(L.cliente || '').trim();
    var ori = String(L.desde || L.origen || '').trim();
    var des = String(L.hasta || L.destino || '').trim();
    if (!cli || !ori || !des) { continue; }
    var p = Number(String(L.precio).replace(',', '.'));
    if (!isFinite(p) || p <= 0) { continue; }
    var k = cli + '|' + ori + '|' + des;
    if (!idx[k]) { idx[k] = []; }
    idx[k].push({
      material: String(L.carga || L.material || '').trim(),
      precio: p,
      unidad: String(L.unimed || L.unidad || 'TN').toUpperCase(),
      fecha: String(L.desdef || L.fecha || ''),
      concepto: String(L.codcon || L.concepto || '').toUpperCase()
    });
  }
  return idx;
}

/**
 * Busca en el historico la tarifa de un viaje.
 *
 * @param {{cliente,origen,destino,material}} viaje  cliente/origen/destino son
 *        CODIGOS Gesruta (no nombres): asi la busqueda es exacta y no depende de
 *        como este escrito el literal.
 * @param {object} indice  el de construirIndice()
 * @returns {{precio:number|null, unidad:string|null, n:number, revisar:boolean,
 *            metodo:string, motivo:string, candidatas?:Array}}
 */
function buscarTarifaHistorica(viaje, indice) {
  var vacio = function (motivo, metodo) {
    return { precio: null, unidad: null, n: 0, revisar: true, metodo: metodo || 'sin_historico', motivo: motivo };
  };
  if (!viaje || !indice) { return vacio('sin historico cargado'); }
  var cli = String(viaje.cliente || '').trim();
  var ori = String(viaje.origen || '').trim();
  var des = String(viaje.destino || '').trim();
  if (!cli || !ori || !des) { return vacio('faltan cliente/origen/destino para buscar en el historico'); }

  var filas = indice[cli + '|' + ori + '|' + des];
  if (!filas || !filas.length) {
    return vacio('la ruta ' + ori + ' -> ' + des + ' del cliente ' + cli + ' no aparece en el historico de viajes');
  }

  // Preferir las lineas del MISMO material: una misma ruta puede tener precios
  // distintos por producto (dato real: COLA 13,85 vs FINCAT 20,16 en 1->OR).
  var mat = String(viaje.material || '').trim();
  var mismas = mat ? filas.filter(function (f) { return f.material === mat; }) : [];
  var base = mismas.length ? mismas : filas;
  var porMaterial = mismas.length > 0;

  // NO se rechaza cuando la ruta mezcla EUR/TN y EUR por viaje: eso no es
  // ambiguedad, es un CAMBIO DE MODALIDAD en el tiempo. Dato real: RNM AVILE->
  // FAMAL se cobraba 875 EUR/viaje (fechas de enero-marzo) y hoy 39,13 EUR/tn
  // (agosto). La linea MAS RECIENTE dice como se cobra hoy, y su unidad viene
  // con ella. Rechazar por unidades mezcladas descartaba justo las rutas vivas.
  var lista = base;


  // La tarifa vigente es la del viaje MAS RECIENTE de esa ruta: los precios se
  // renegocian (dato real: Quimidroga MIR->GUIM paso de 29,80 a 59,85 y a 61,65).
  // Exigir un precio unico habria descartado justamente las rutas mas usadas.
  var comparable = function (f) {
    // El export trae la fecha como serial de Excel o como texto; ambos ordenan.
    var n = Number(f); return isFinite(n) ? n : 0;
  };
  var ordenadas = lista.slice().sort(function (a, b) { return comparable(b.fecha) - comparable(a.fecha); });
  var vigente = ordenadas[0];
  var mismos = ordenadas.filter(function (f) { return f.precio === vigente.precio; }).length;
  var huboCambio = mismos < ordenadas.length;
  var unidades = {}; ordenadas.forEach(function (f) { unidades[f.unidad] = true; });
  var cambioUnidad = Object.keys(unidades).length > 1;

  return {
    precio: vigente.precio, unidad: vigente.unidad, n: ordenadas.length, revisar: true,
    metodo: porMaterial ? 'historico_material' : 'historico_ruta',
    cambioReciente: huboCambio, cambioUnidad: cambioUnidad,
    motivo: 'tarifa tomada del HISTORICO: ultimo viaje de ' + ori + ' -> ' + des + ' a ' +
      vigente.precio + ' EUR/' + vigente.unidad + ' (' + mismos + ' de ' + ordenadas.length +
      ' viajes a ese precio' + (porMaterial ? ', mismo material' : '') + ')' +
      (huboCambio ? ' — OJO: el precio de esta ruta CAMBIO durante el año, verificar cual rige' : '') +
      (cambioUnidad ? '; esta ruta paso de cobrarse por viaje a por tonelada (o al reves): se toma la modalidad del ultimo viaje' : '') +
      ' — no es tarifa pactada, verificar'
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    construirIndice: construirIndice,
    buscarTarifaHistorica: buscarTarifaHistorica,
    normTxt: normTxt,
  };
}
