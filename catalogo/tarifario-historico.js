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
// VERIFICACION sobre el export real (765 lineas, viajes del año):
//   - 118 rutas distintas (cliente + origen + destino)
//   - 78 de 82 rutas en EUR/TN tienen UN SOLO precio -> 95% consistente
//   - RNM AVEIR->C = 29,09 y RNM AVEIR->TEIXE = 29,09  <-- el caso exacto
//   Las 4 rutas con varios precios se separan por MATERIAL (misma ruta, producto
//   distinto: COLA 13,85 vs FINCAT 20,16). Por eso el material entra en la clave.
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

  // Separar por unidad: EUR/TN y EUR por viaje (UN) no son comparables.
  var porUnidad = {};
  for (var i = 0; i < base.length; i++) {
    var u = base[i].unidad || 'TN';
    if (!porUnidad[u]) { porUnidad[u] = []; }
    porUnidad[u].push(base[i]);
  }
  var unidades = Object.keys(porUnidad);
  if (unidades.length > 1) {
    return {
      precio: null, unidad: null, n: base.length, revisar: true, metodo: 'ambiguo_unidad',
      motivo: 'el historico de ' + ori + ' -> ' + des + ' mezcla unidades (' + unidades.join(', ') + '): revisar si el viaje se cobra por tonelada o por viaje',
      candidatas: base
    };
  }
  var lista = porUnidad[unidades[0]];
  var precios = {};
  for (var j = 0; j < lista.length; j++) { precios[lista[j].precio] = (precios[lista[j].precio] || 0) + 1; }
  var distintos = Object.keys(precios);

  if (distintos.length === 1) {
    return {
      precio: lista[0].precio, unidad: lista[0].unidad, n: lista.length, revisar: true,
      metodo: porMaterial ? 'historico_material' : 'historico_ruta',
      motivo: 'tarifa tomada del HISTORICO de viajes (' + lista.length + ' viaje(s) de ' + ori + ' -> ' + des +
        ' a ' + lista[0].precio + ' EUR/' + lista[0].unidad + ')' + (porMaterial ? ' con el mismo material' : '') +
        ' — no es tarifa pactada, verificar'
    };
  }

  // Varios precios para la misma ruta+material+unidad: no se elige.
  var lst = distintos.map(function (p) { return p + ' (x' + precios[p] + ')'; }).join(', ');
  return {
    precio: null, unidad: null, n: lista.length, revisar: true, metodo: 'ambiguo_precio',
    motivo: 'el historico de ' + ori + ' -> ' + des + ' tiene precios distintos (' + lst + '): revisar cual aplica',
    candidatas: lista
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    construirIndice: construirIndice,
    buscarTarifaHistorica: buscarTarifaHistorica,
    normTxt: normTxt,
  };
}
