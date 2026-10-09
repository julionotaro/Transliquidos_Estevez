// ===== TARIFA CONTRACTUAL para la ingesta (tabla Tarifas -> columna del viaje) ==
//
// Busca, para un viaje ya armado (cliente + origen + destino + material), su
// tarifa contractual en la tabla `Tarifas`. Es la pieza que cierra el circulo
// ingesta -> facturacion: hoy el viaje solo copia la tarifa que venga IMPRESA en
// la OC (casi nunca hay OC); esto la trae de la tabla de tarifas pactadas.
//
// DOS PUENTES (sin ellos no matchea, §):
//   Puente 1 — PUNTOS CANONICOS. Tarifas usa el NOMBRE del punto ("CALDAS DE
//     REIS"); el viaje trae el literal del documento ("CALDAS"). Se resuelve el
//     literal con resolver-punto.js y se matchea por el nombre canonico.
//   Puente 2 — RAZON SOCIAL. Tarifas usa la razon social completa ("FORESA
//     IND.QUIMICAS DEL NOROESTE, S.A."); el viaje trae el nombre corto ("FORESA").
//     Se matchea por CONTENCION de tokens normalizados (el corto dentro del largo),
//     sin necesidad de una columna nueva.
//
// NUNCA inventa: si no hay match unico devuelve tarifa:null + motivo (para REVISAR).
// Logica PURA. En el nodo, build-nodo.js inlinea resolver-punto.js antes.

'use strict';

var RP = (typeof resolverPunto === 'function')
  ? { resolverPunto: resolverPunto, normalizar: normalizar }
  : require('../catalogo/resolver-punto.js');

function norm(s) { return RP.normalizar(s); }
function num(x) {
  if (x === null || x === undefined || x === '') { return null; }
  if (typeof x === 'number') { return isFinite(x) ? x : null; }
  var n = Number(String(x).replace(',', '.'));
  return isFinite(n) ? n : null;
}

// Puente 2: el cliente corto del viaje matchea la razon social larga de Tarifas
// si TODOS sus tokens estan contenidos en la razon social (o coincidencia exacta).
function clienteCoincide(clienteViaje, clienteTarifa) {
  var a = norm(clienteViaje), b = norm(clienteTarifa);
  if (!a || !b) { return false; }
  if (a === b) { return true; }
  var tb = {}; b.split(' ').forEach(function (t) { if (t) { tb[t] = true; } });
  var ta = a.split(' ').filter(function (t) { return t.length >= 2; });
  if (!ta.length) { return false; }
  for (var i = 0; i < ta.length; i++) { if (!tb[ta[i]]) { return false; } }
  return true;
}

// Material: "Cualquiera"/vacio = comodin; si no, inclusion en cualquier sentido.
function materialCoincide(matViaje, matTarifa) {
  var mt = norm(matTarifa);
  if (!mt || mt === 'CUALQUIERA') { return true; }
  var mv = norm(matViaje);
  if (!mv) { return false; }
  return mv.indexOf(mt) >= 0 || mt.indexOf(mv) >= 0;
}

// Puente 1: literal de lugar -> nombre canonico del punto (para matchear Tarifas).
function canonPunto(literal, catalogo) {
  if (catalogo && catalogo.length) {
    var r = RP.resolverPunto(literal, 'documento', catalogo);
    if (r.id_punto) { return { n: norm(r.nombre_canonico), resuelto: true, revisar: !!r.revisar, id: r.id_punto }; }
  }
  return { n: norm(literal), resuelto: false, revisar: false, id: null };
}

/**
 * Busca la tarifa contractual del viaje.
 * @param {{cliente,origen,destino,material}} viaje
 * @param {Array} tarifas  filas de la tabla Tarifas {cliente,origen,destino,material,tarifa_tn,precio_fijo}
 * @param {Array} [catalogo]  filas de la tabla puntos (para resolver origen/destino)
 * @returns {null | {tarifa_tn, precio_fijo, material_tarifa, origen_canon, destino_canon, revisar} | {tarifa:null, motivo, candidatas?}}
 */
function buscarTarifaContractual(viaje, tarifas, catalogo) {
  if (!viaje || !Array.isArray(tarifas) || !tarifas.length) { return null; }
  var oc = canonPunto(viaje.origen, catalogo);
  var dc = canonPunto(viaje.destino, catalogo);
  if (!oc.n || !dc.n) { return { tarifa: null, motivo: 'origen/destino del viaje vacios; no se busca tarifa' }; }
  if (!norm(viaje.cliente)) { return { tarifa: null, motivo: 'viaje sin cliente resuelto; no se busca tarifa' }; }

  var cand = [];
  for (var i = 0; i < tarifas.length; i++) {
    var t = tarifas[i];
    if (!clienteCoincide(viaje.cliente, t.cliente)) { continue; }
    // AMBOS LADOS AL CANONICO (bug real ejec 1076): el viaje se traducia a punto
    // canonico ("FAMALICAO" -> "VILANOVA FAMALICAO") pero la fila de la tabla
    // Tarifas se comparaba EN CRUDO, donde dice literalmente "FAMALICAO". Nunca
    // matcheaba -> ninguna tarifa se encontraba nunca. La tabla la cargo un
    // humano con el nombre corriente; el viaje viene del documento. Solo son
    // comparables si los DOS pasan por el mismo resolvedor de puntos.
    var to = canonPunto(t.origen, catalogo);
    var td = canonPunto(t.destino, catalogo);
    if (to.n !== oc.n || td.n !== dc.n) { continue; }
    if (!materialCoincide(viaje.material, t.material)) { continue; }
    cand.push(t);
  }
  if (cand.length === 0) {
    return { tarifa: null, motivo: 'sin tarifa cargada para ' + oc.n + ' -> ' + dc.n + ' (cliente ' + (norm(viaje.cliente)) + ')' };
  }
  // Preferir material ESPECIFICO sobre el comodin "Cualquiera".
  var esp = cand.filter(function (t) { var m = norm(t.material); return m && m !== 'CUALQUIERA'; });
  var elegidas = esp.length ? esp : cand;
  if (elegidas.length > 1) {
    return { tarifa: null, motivo: elegidas.length + ' tarifas posibles para ' + oc.n + ' -> ' + dc.n + ' — revisar cual aplica', candidatas: elegidas };
  }
  var g = elegidas[0];
  return {
    tarifa_tn: num(g.tarifa_tn),
    precio_fijo: num(g.precio_fijo),
    material_tarifa: g.material || null,
    origen_canon: oc.id, destino_canon: dc.id,
    revisar: oc.revisar || dc.revisar
  };
}

// ===== SEGUNDO ESCALON: TARIFA POR ANALOGIA ==================================
//
// Medido sobre el año entero (7.578 portes): 532 combinaciones cliente x ruta x
// material — 1.973 viajes, el 26 % — no tienen tarifa oficial. No es un problema
// de nombres: el tarifario y los viajes usan el mismo catalogo de 790 puntos
// (294/294 y 293/295). El tarifario esta INCOMPLETO respecto de lo que se
// transporta (ver docs/INDICE.md R-05).
//
// Cuando el destino real no esta tarifado, la oficina aplica a mano la tarifa de
// otra ruta del mismo cliente y origen. Este escalon reproduce ese gesto, y solo
// con las analogias que Julio CONFIRMO una por una (2026-08-27: 12 confirmadas,
// 3 "negociables" —precio que se pacta viaje a viaje, no es tarifa—, 5
// descartadas y 1 que resulto ser sinonimo de punto, no analogia).
//
// DOS REGLAS DURAS
//
//   1. Solo entra estado === 'confirmado'. Una analogia sin confirmar aplicada
//      sola es un precio inventado con pinta de bueno: el fallo mas caro que
//      puede tener este archivo. 'negociable' NO entra: que dos viajes hayan
//      coincidido de precio no significa que el tercero valga lo mismo.
//
//   2. La analogia SIEMPRE marca revisar. Es una tarifa observada, no pactada.
//      La fila se factura, pero se ve que se factura por analogia.

/**
 * Las analogias que se pueden usar. Filtra aca, no en el punto de uso: asi no
 * hay forma de saltarse la regla 1 por olvido.
 *
 * Se exigen las DOS condiciones (estado y confirmado) a proposito: un JSON
 * editado a mano a medias no debe poder colar un precio.
 */
function analogiasConfirmadas(analogias) {
  var lista = (analogias && analogias.candidatos) ? analogias.candidatos
            : (Array.isArray(analogias) ? analogias : []);
  var out = [];
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].estado === 'confirmado' && lista[i].confirmado === true) { out.push(lista[i]); }
  }
  return out;
}

/**
 * Busca la analogia que aplica a este viaje.
 *
 * El cliente NO se compara por igualdad: el JSON guarda la razon social larga
 * ("FORESA IND.QUIMICAS DEL NOROESTE, S.A.") porque sale del export de Gesruta,
 * y el viaje trae el nombre corto que se leyo del documento ("FORESA"). Es el
 * mismo puente que ya usa la busqueda de tarifa (§ Puente 2); compararlos por
 * igualdad hacia que ninguna analogia matcheara nunca.
 */
function buscarAnalogia(viaje, analogias) {
  var lista = analogiasConfirmadas(analogias);
  var o = norm(viaje.origen), d = norm(viaje.destino);
  for (var i = 0; i < lista.length; i++) {
    var a = lista[i];
    if (!clienteCoincide(viaje.cliente, a.cliente)) { continue; }
    if (norm(a.origen) !== o) { continue; }
    if (norm(a.destino_real) !== d) { continue; }
    return a;
  }
  return null;
}

/**
 * Precio del viaje, con la cascada completa y diciendo SIEMPRE de donde sale.
 *
 * 1. tarifa CONTRACTUAL (tabla Tarifas)          -> origen_del_precio 'contractual'
 * 2. tarifa POR ANALOGIA confirmada              -> 'analogia'   (+ revisar)
 * 3. precio impreso en la ORDEN del cliente      -> 'orden'      (+ revisar)
 * 4. nada, con el motivo escrito                 -> null
 *
 * El campo origen_del_precio no es decorativo: es lo que permite ver en la
 * planilla que una fila se esta cobrando por analogia y no por tarifa pactada.
 *
 * @param {{cliente,origen,destino,material,precio_orden?}} viaje
 * @param {Array} tarifas    filas de la tabla Tarifas
 * @param {object} analogias contenido de catalogo/tarifa-por-analogia.json
 * @param {Array} [catalogo] filas de la tabla puntos
 */
function resolverPrecio(viaje, tarifas, analogias, catalogo) {
  var motivos = [];

  var contractual = buscarTarifaContractual(viaje, tarifas, catalogo);
  if (contractual && contractual.tarifa !== null && contractual.tarifa_tn !== undefined) {
    contractual.origen_del_precio = 'contractual';
    return contractual;
  }
  if (contractual && contractual.motivo) { motivos.push(contractual.motivo); }

  // --- Escalon 2 ---------------------------------------------------------
  var a = buscarAnalogia(viaje, analogias);
  if (a) {
    // Se rehace la busqueda contractual sustituyendo SOLO el destino. No se
    // copia el precio guardado en la analogia: si la tarifa de la ruta modelo
    // cambio, el viaje tiene que seguir esa tarifa, no un numero congelado.
    var comoSi = {
      cliente: viaje.cliente, origen: viaje.origen,
      destino: a.destino_tarifado, material: viaje.material,
    };
    var t = buscarTarifaContractual(comoSi, tarifas, catalogo);
    if (t && t.tarifa_tn !== undefined) {
      t.origen_del_precio = 'analogia';
      t.revisar = true;              // regla 2: observada, no pactada
      t.analogia = {
        destino_real: a.destino_real,
        destino_tarifado: a.destino_tarifado,
        confirmado_por: a.revisado_por || null,
        fecha: a.fecha_revision || null,
      };
      t.motivo = 'sin tarifa propia para ' + a.destino_real + ': se aplica la de ' +
                 a.destino_tarifado + ', analogia confirmada por ' +
                 (a.revisado_por || 'la oficina');
      return t;
    }
    motivos.push('hay analogia confirmada hacia ' + a.destino_tarifado +
                 ' pero esa ruta tampoco tiene tarifa');
  }

  // --- Escalon 3 ---------------------------------------------------------
  var po = num(viaje.precio_orden);
  if (po !== null) {
    return {
      tarifa_tn: null, precio_fijo: po, material_tarifa: null,
      origen_del_precio: 'orden', revisar: true,
      motivo: 'sin tarifa cargada: se usa el precio impreso en la orden del cliente',
    };
  }

  return {
    tarifa: null, origen_del_precio: null, revisar: true,
    motivo: motivos.length ? motivos.join('; ') : 'sin precio: no hay tarifa ni orden',
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buscarTarifaContractual: buscarTarifaContractual,
    resolverPrecio: resolverPrecio,
    analogiasConfirmadas: analogiasConfirmadas,
    buscarAnalogia: buscarAnalogia,
    clienteCoincide: clienteCoincide,
    materialCoincide: materialCoincide,
  };
}
