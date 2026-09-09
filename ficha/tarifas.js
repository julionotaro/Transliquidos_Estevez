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
