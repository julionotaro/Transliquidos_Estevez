// ===== RUTAS CONOCIDAS DEL CLIENTE — el conjunto cerrado que faltaba ==========
//
// EL CAMBIO DE PREGUNTA. Hasta ahora el sistema resolvia asi:
//
//     "dado este literal de direccion, ¿cual de los 790 puntos es?"
//
// Conjunto ABIERTO, 790 opciones, matcheo de texto contra direcciones postales
// que a veces vienen mal impresas. Es el problema dificil, y es de donde salieron
// los errores caros: la guia de RNM trae "Asturiana de Zinc ... 46002 Teruel"
// cuando la planta esta en Aviles, y el sistema resolvia TERUEL tan contento.
//
// La pregunta correcta es la que hace la oficina sin pensarlo:
//
//     "dado que el cliente es RNM, ¿cual de SUS rutas conocidas es?"
//
// Conjunto CERRADO de 5 a 20 opciones, con frecuencias reales. RNM nunca viajo a
// Teruel: la respuesta mala ni siquiera esta sobre la mesa.
//
// El conjunto sale de catalogo/rutas-por-cliente.json, construido desde los
// 7.578 portes que la empresa facturo de verdad en el año (no de lo que alguien
// supone que se transporta). Medido: 287 de los 790 puntos se usan alguna vez, y
// los 40 mas usados cubren el 91,6 % de los usos. El conjunto util es chico.
//
// TRES REGLAS
//
//   1. NO se rechaza una ruta nueva. Un cliente puede estrenar destino cualquier
//      dia, y un sistema que dice "eso no existe" ante algo real es inservible.
//      Lo que se hace es MARCARLA: resuelve, pero con aviso de que ese cliente
//      nunca fue ahi. Esa es la guarda que caza el TERUEL de RNM.
//
//   2. Dentro del conjunto cerrado se puede matchear mas flojo, porque hay 6
//      candidatos y no 790. "VILANOVA FAMALICAO" no resuelve contra el catalogo
//      entero, pero contra los 6 destinos de RNM es inequivoco. Fuera del
//      conjunto ese mismo criterio seria temerario.
//
//   3. Empate = no se elige. Si el literal casa con dos destinos conocidos del
//      cliente, se devuelven los dos y decide un humano. La frecuencia sirve para
//      ORDENAR lo que se le muestra, nunca para desempatar sola: "el cliente
//      suele ir a X" no es prueba de que ESTE viaje fue a X.
//
// Logica PURA. El JSON de rutas se inyecta; este modulo no lee archivos.

'use strict';

var RC_RP = (typeof resolverPunto === 'function')
  ? { resolverPunto: resolverPunto, normalizar: normalizar }
  : require('../catalogo/resolver-punto.js');

var RC_TC = (typeof clienteCoincide === 'function')
  ? { clienteCoincide: clienteCoincide }
  : require('./tarifa-contractual.js');

function nrm(s) { return RC_RP.normalizar(s); }

/**
 * Los puntos que ESTE cliente uso de verdad, en el rol pedido.
 *
 * @param {object} rutas  contenido de catalogo/rutas-por-cliente.json
 * @param {string} cliente  nombre corto leido del documento ("FORESA")
 * @param {'destino'|'origen'} rol
 * @param {string} [origen]  si se da, limita a las rutas que salen de ahi
 * @returns {Array<{nombre, n_viajes, materiales:Array<string>}>} ordenado por frecuencia
 */
function puntosConocidos(rutas, cliente, rol, origen) {
  var clientes = (rutas && rutas.clientes) ? rutas.clientes : {};
  var campo = (rol === 'origen') ? 'nombre_origen' : 'nombre_destino';
  var acc = {};
  var oFiltro = origen ? nrm(origen) : null;

  for (var cid in clientes) {
    if (!Object.prototype.hasOwnProperty.call(clientes, cid)) { continue; }
    var c = clientes[cid];
    // El JSON guarda la razon social larga; el viaje trae el nombre corto.
    if (!RC_TC.clienteCoincide(cliente, c.nombre)) { continue; }
    for (var i = 0; i < (c.rutas || []).length; i++) {
      var R = c.rutas[i];
      if (oFiltro && rol === 'destino' && nrm(R.nombre_origen) !== oFiltro) { continue; }
      var nom = R[campo];
      if (!nom) { continue; }
      var k = nrm(nom);
      if (!acc[k]) { acc[k] = { nombre: nom, n_viajes: 0, materiales: [] }; }
      acc[k].n_viajes += R.n_viajes || 0;
      if (R.nombre_material && acc[k].materiales.indexOf(R.nombre_material) < 0) {
        acc[k].materiales.push(R.nombre_material);
      }
    }
  }
  var out = [];
  for (var k2 in acc) { if (Object.prototype.hasOwnProperty.call(acc, k2)) { out.push(acc[k2]); } }
  out.sort(function (a, b) { return b.n_viajes - a.n_viajes; });
  return out;
}

// Regla 2: dentro del conjunto cerrado se matchea por contencion de tokens en
// cualquier sentido ("FAMALICAO" casa con "VILANOVA FAMALICAO" y al reves).
function casaEnConjunto(literal, nombre) {
  var a = nrm(literal), b = nrm(nombre);
  if (!a || !b) { return false; }
  if (a === b) { return true; }
  return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
}

/**
 * Resuelve un punto usando primero lo que ESTE cliente hizo de verdad.
 *
 * @param {string} literal  lo que dice el documento
 * @param {{cliente, rol, origen}} ctx
 * @param {Array} catalogo  filas de la tabla puntos
 * @param {object} rutas    catalogo/rutas-por-cliente.json
 * @returns el resultado de resolverPunto, enriquecido con:
 *          ruta_conocida  true|false|null (null = no se pudo evaluar)
 *          aviso_ruta     texto cuando el cliente nunca fue ahi
 *          candidatos     cuando hay empate dentro del conjunto cerrado
 */
function resolverPuntoDeCliente(literal, ctx, catalogo, rutas) {
  ctx = ctx || {};
  var base = RC_RP.resolverPunto(literal, 'documento', catalogo);
  var conocidos = puntosConocidos(rutas, ctx.cliente, ctx.rol || 'destino', ctx.origen);

  // Sin cliente resuelto o sin historia, no hay conjunto cerrado que aplicar.
  if (!ctx.cliente || !conocidos.length) {
    base.ruta_conocida = null;
    return base;
  }

  // --- Caso A: el resolvedor global encontro un punto ---------------------
  if (base.id_punto) {
    var enConjunto = null;
    for (var i = 0; i < conocidos.length; i++) {
      if (nrm(conocidos[i].nombre) === nrm(base.nombre_canonico)) { enConjunto = conocidos[i]; break; }
    }
    if (enConjunto) {
      base.ruta_conocida = true;
      base.n_viajes_historicos = enConjunto.n_viajes;
      base.motivo += '; ruta conocida de ' + ctx.cliente + ' (' + enConjunto.n_viajes + ' viajes)';

      // CORROBORACION — el uso mas valioso del conjunto cerrado, y el que no
      // era evidente hasta ver correr el resolvedor global.
      //
      // resolverPunto ya resuelve "FAMALICAO" -> VILANOVA FAMALICAO por
      // CONTENCION, pero marca revisar: contra 790 puntos, un nombre contenido
      // en otro es una apuesta razonable y nada mas. Si ademas resulta que ese
      // punto es una ruta que ESTE cliente hizo 120 veces, la apuesta deja de
      // serlo: dos evidencias independientes (el texto y la historia) apuntan al
      // mismo sitio. Ahi se puede bajar la bandera.
      //
      // Solo se corrobora lo DEBIL (contencion / edicion). Un 'canonico' exacto
      // ya venia sin revisar, y lo que trae revisar por otro motivo —un
      // duplicado del catalogo, un conflicto doc/ficha— NO se toca: la historia
      // del cliente no dice nada sobre esos.
      var debil = (base.metodo === 'contencion' || base.metodo === 'edicion');
      if (debil && base.revisar) {
        base.revisar = false;
        base.confianza = 'alta';
        base.corroborado_por_historico = true;
        base.motivo += '; lectura debil CORROBORADA por el historico: se mantiene sin revisar';
      }
      return base;
    }
    // Regla 1: NO se rechaza. Se marca. Aca es donde se caza el TERUEL de RNM.
    base.ruta_conocida = false;
    base.revisar = true;
    base.aviso_ruta = ctx.cliente + ' nunca ' +
      (ctx.rol === 'origen' ? 'cargo en ' : 'viajo a ') + base.nombre_canonico +
      ' en el historico; sus ' + (ctx.rol === 'origen' ? 'origenes' : 'destinos') +
      ' habituales son ' + conocidos.slice(0, 3).map(function (p) { return p.nombre; }).join(', ');
    base.motivo += '; ' + base.aviso_ruta;
    return base;
  }

  // --- Caso B: el catalogo global no lo resolvio; se prueba el cerrado ----
  var casan = [];
  for (var j = 0; j < conocidos.length; j++) {
    if (casaEnConjunto(literal, conocidos[j].nombre)) { casan.push(conocidos[j]); }
  }
  if (casan.length === 1) {
    var elegido = casan[0];
    var idx = RC_RP.resolverPunto(elegido.nombre, 'documento', catalogo);
    if (idx.id_punto) {
      idx.ruta_conocida = true;
      idx.n_viajes_historicos = elegido.n_viajes;
      idx.confianza = 'media';   // se resolvio por el conjunto cerrado, no por el catalogo
      idx.revisar = false;
      idx.literal_original = literal;
      idx.metodo = 'ruta_conocida_cliente';
      idx.motivo = 'el catalogo no reconocia "' + literal + '", pero es el unico ' +
        (ctx.rol === 'origen' ? 'origen' : 'destino') + ' de ' + ctx.cliente +
        ' que encaja (' + elegido.nombre + ', ' + elegido.n_viajes + ' viajes)';
      return idx;
    }
  }
  if (casan.length > 1) {
    // Regla 3: empate no se rompe con la frecuencia; solo se ordena por ella.
    base.ruta_conocida = null;
    base.candidatos = casan.map(function (p) { return { nombre: p.nombre, n_viajes: p.n_viajes }; });
    base.motivo += '; encaja con ' + casan.length + ' rutas conocidas de ' + ctx.cliente +
      ' (' + casan.map(function (p) { return p.nombre; }).join(' / ') + '): decide un humano';
    return base;
  }

  base.ruta_conocida = false;
  return base;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    puntosConocidos: puntosConocidos,
    resolverPuntoDeCliente: resolverPuntoDeCliente,
    casaEnConjunto: casaEnConjunto,
  };
}
