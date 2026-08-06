// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/cruce.js + ficha/clientes.js + ficha/tarifas.js + ficha/indexacion.js + ficha/planilla.js + ficha/nodo-planilla.wrapper.js
// Contenido exacto del nodo Code "Planilla" ([ESTEVEZ] Vista Pendientes (C3eZ1RteNAZDdaCV)).

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
function regimenIndexacion(cliente, origen, destino, clientes) {
  if (!esClienteConocido(cliente, clientes)) {
    return { regimen: null, motivo: 'cliente_no_reconocido: ' + (nz_local(cliente) || '(no se leyo)') };
  }
  var cl = norm(cliente);
  if (cl.indexOf('BALTRANSA') >= 0) { return { regimen: 'incluida', motivo: null }; }
  var esForesa = cl.indexOf('FORESA') >= 0 || cl.indexOf('BRESFOR') >= 0;
  if (esForesa) {
    if (coincideTexto(origen, 'VILLAGARCIA') && coincideTexto(destino, 'CALDAS DE REIS')) { return { regimen: 'agregada_mensual', motivo: null }; }
    if (coincideTexto(origen, 'CALDAS') && (coincideTexto(destino, 'OURENSE') || coincideTexto(destino, 'ORENSE'))) { return { regimen: 'agregada_quincenal', motivo: null }; }
    return { regimen: 'linea', motivo: null }; // FORESA a cualquier otro destino: por viaje (D-06).
  }
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
// real `Indexacion` (or1otD9WsjJ3V8Cr). Schema: cliente, tipo, pct, desde,
// hasta (todas string).
//
// RECARGA 2026-08-06 (encargo recarga-indexacion, desde SUPLEMENTO_GASOLEO.xlsx):
// la CATEGORIA vive ahora en `tipo` (FORESA-BRESFOR / HELM / QUIMIDROGA / OTROS,
// nombre de la solapa del Excel) y `cliente` queda VACIO. La identidad
// cliente->categoria se resuelve en codigo (grupoIndexacion), NO en la tabla --
// mismo patron que ficha/clientes.js para tarifas. Antes la categoria vivia en
// `cliente` (mal nombrado) y `tipo` era el literal 'gasoleo'; el match paso a
// ser por `tipo` (ver buscarPct).
//
// Una fila por tramo (~48 filas activas), no una por cliente. La tabla vieja
// llego a tener 37.660 filas por un cross-join accidental contra Tarifas
// (538 x 70); la recarga la deja limpia. deduplicarIndexacion() queda como
// defensa idempotente (el nodo la llama antes de armar la planilla, ver
// nodo-planilla.wrapper.js); sobre datos limpios no cambia nada.
//
// Categorias activas en v1 (docs/dominio-facturacion.md §4.1): FORESA-BRESFOR,
// QUIMIDROGA, HELM, OTROS. Todo cliente que no caiga en una nombrada usa OTROS
// (fallback por defecto). Las solapas AGENCIA/AUTONOMOS del Excel NO se cargan
// (circuito de subcontratacion, fuera de v1). BALTRANSA es caso aparte (0% en
// factura, no depende de esta tabla).
//
// D-03 / nota del encargo: la indexacion AGREGADA (quincenal/mensual) NUNCA
// se calcula aca -- se cierra en facturacion. Este modulo la marca (regimen
// visible) y no toca un numero.

'use strict';

var CRUCE_IDX = (typeof norm === 'function') ? { norm: norm } : require('./cruce.js');

function round2(n) { return Math.round(n * 100) / 100; }

/**
 * Defensa idempotente contra duplicados: agrupa por (cliente, tipo, pct, desde,
 * hasta) y se queda con una fila por combinacion unica. Tras la recarga
 * 2026-08-06 la tabla ya esta limpia, asi que sobre datos buenos no cambia nada;
 * queda por si un cross-join accidental (como el x538 historico) volviera a
 * colarse. NO escribe de vuelta en n8n, solo filtra en memoria para la busqueda.
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

/** Tramo vigente [desde,hasta] (inclusive, string ISO) para un grupo+fecha. null si no hay tramo. */
function buscarPct(grupo, fecha, indexacionRows) {
  var filas = Array.isArray(indexacionRows) ? indexacionRows : [];
  if (!fecha) { return null; }
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    // La categoria vive en `tipo` (recarga 2026-08-06 desde el Excel); `cliente`
    // queda vacio. La identidad cliente->categoria se resuelve en codigo
    // (grupoIndexacion), no en la tabla -- mismo patron que ficha/clientes.js.
    if (CRUCE_IDX.norm(f.tipo) !== grupo) { continue; }
    if ((f.desde || '') <= fecha && fecha <= (f.hasta || '')) {
      var pct = parseFloat(f.pct);
      if (isFinite(pct)) { return { pct: pct, fila: f }; }
    }
  }
  return null;
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
  if (regimen === 'agregada_quincenal' || regimen === 'agregada_mensual') {
    return {
      modo: 'regimen_pendiente', pct: null, importe: null, grupo: null,
      etiqueta: regimen + ' (pendiente cierre en facturacion)', motivo: null
    };
  }
  if (regimen !== 'linea') {
    return { modo: 'sin_regimen', pct: null, importe: null, grupo: null, etiqueta: '-', motivo: 'sin_regimen_indexacion' };
  }

  var g = grupoIndexacion(v.cliente);
  var hit = buscarPct(g.grupo, v.fecha, indexacionRows);
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

// ===== PLANILLA DE CARGA / AUDITORIA (v1.1 pieza 2) =========================
//
// Una sola tabla, dos usos (encargo 2026-08-03): copilot de carga (columnas en
// el orden EXACTO del sistema de escritorio, para transcribir a mano) y
// auditoria de facturacion (mismas filas, resaltando REVISAR /
// PENDIENTE_DOCUMENTACION / SIN_TARIFA / indexacion sin cerrar antes de
// emitir). No son dos vistas: es la MISMA fila con un resaltado superpuesto,
// asi que un solo armarFila() + renderHTML() sirve para ambos usos, igual que
// pendientes.js sirve a la vez de lista y de tablero.
//
// COLUMNAS fija el orden del sistema de escritorio (derivado de la
// exportacion real que aporto Julio, expediente 00050461). Es la UNICA fuente
// de verdad del orden: tanto los headers como cada fila salen de recorrer este
// array, para que "orden de columnas == sistema de escritorio" no pueda
// desincronizarse entre el <thead> y el <tbody>.

'use strict';

var CRUCE_PLAN = (typeof norm === 'function') ? { norm: norm } : require('./cruce.js');
var TARIFAS_PLAN = (typeof buscarTarifa === 'function') ? { buscarTarifa: buscarTarifa } : require('./tarifas.js');
var INDEXACION_PLAN = (typeof indexacionDeFila === 'function')
  ? { indexacionDeFila: indexacionDeFila, deduplicarIndexacion: deduplicarIndexacion }
  : require('./indexacion.js');

var COLUMNAS = [
  { clave: 'empresa', titulo: 'Empresa' },
  { clave: 'numero', titulo: 'Nº' },
  { clave: 'cliente', titulo: 'Cliente' },
  { clave: 'origen', titulo: 'Origen' },
  { clave: 'destino', titulo: 'Destino' },
  { clave: 'material', titulo: 'Carga' },
  { clave: 'referencia', titulo: 'Referencia' },
  { clave: 'cabeza', titulo: 'Cabeza' },
  { clave: 'remolque', titulo: 'Remolque' },
  { clave: 'chofer', titulo: 'Chofer' },
  { clave: 'cantidad_kg', titulo: 'Cantidad (kg)' },
  { clave: 'tarifa', titulo: 'Tarifa' },
  { clave: 'importe', titulo: 'Precio / Importe' },
  { clave: 'pct_indexacion', titulo: '% Indexación' },
  { clave: 'importe_indexacion', titulo: 'Importe indexación' },
  { clave: 'tipo_iva', titulo: 'Tipo IVA' }
];

function round2(n) { return Math.round(n * 100) / 100; }

/** Tipo IVA (encargo: "segun cliente, BALTRANSA y clientes espanoles 21%", D-04). */
function tipoIva(viaje) {
  var cl = CRUCE_PLAN.norm(viaje.cliente);
  if (cl && cl.indexOf('BALTRANSA') >= 0) { return '21%'; }
  if (viaje.pais_facturacion === 'ES') { return '21%'; }
  return viaje.pais_facturacion ? ('0% (' + viaje.pais_facturacion + ')') : null;
}

/**
 * Precio/Importe (D-02): cantidad x tarifa. Tarifa por tonelada usa
 * kg_documento (D-01, NUNCA kg_hoja); tarifa fija por viaje ignora la
 * cantidad. Sin kg_documento y tarifa por tonelada -> null (legitimo: no hay
 * documento cruzado todavia, no es un cero disfrazado).
 */
function calcularImporte(kgDocumento, resultadoTarifa) {
  if (!resultadoTarifa || !resultadoTarifa.tarifa) { return null; }
  if (resultadoTarifa.tarifa.tipo === 'fijo') { return round2(resultadoTarifa.tarifa.valor); }
  if (typeof kgDocumento !== 'number' || !isFinite(kgDocumento)) { return null; }
  return round2((kgDocumento / 1000) * resultadoTarifa.tarifa.valor);
}

function textoTarifa(resultadoTarifa) {
  if (!resultadoTarifa || !resultadoTarifa.tarifa) { return null; }
  var t = resultadoTarifa.tarifa;
  return t.tipo === 'tn' ? (t.valor + ' €/t') : (t.valor + ' €/viaje');
}

/**
 * Arma una fila de la planilla a partir de un viaje real + las tablas Tarifas
 * e Indexacion (Indexacion YA deduplicada -- ver indexacion.js). No muta el
 * viaje de entrada.
 *
 * @returns {object}  claves de COLUMNAS + metadata de auditoria
 *   (fecha_carga, estado, estado_lectura, motivo_revision, resaltar,
 *   motivos_resaltado).
 */
function armarFila(viaje, tarifasRows, indexacionRows) {
  var v = viaje || {};
  var resultadoTarifa = TARIFAS_PLAN.buscarTarifa(v, tarifasRows);
  var importe = calcularImporte(v.kg_documento, resultadoTarifa);
  var idx = INDEXACION_PLAN.indexacionDeFila(v, importe, indexacionRows);

  var motivos = [];
  if (v.estado === 'PENDIENTE_DOCUMENTACION') { motivos.push('PENDIENTE_DOCUMENTACION'); }
  if (v.estado_lectura === 'REVISAR') { motivos.push('REVISAR: ' + (v.motivo_revision || '')); }
  if (resultadoTarifa.estado === 'SIN_TARIFA') { motivos.push('SIN_TARIFA: ' + (resultadoTarifa.motivo || '')); }
  if (idx.modo === 'regimen_pendiente') { motivos.push('indexacion sin cerrar: ' + idx.etiqueta); }

  return {
    id: v.id,
    empresa: v.empresa || null,
    numero: (v.orden === null || v.orden === undefined) ? null : v.orden,
    cliente: v.cliente || null,
    origen: v.origen || null,
    destino: v.destino || null,
    material: v.material || null,
    referencia: (v.referencia === '' || v.referencia === null || v.referencia === undefined) ? null : v.referencia,
    cabeza: v.tractora || null,
    remolque: v.semi || null,
    chofer: v.conductor || null,
    cantidad_kg: (typeof v.kg_documento === 'number') ? v.kg_documento : null,
    tarifa: textoTarifa(resultadoTarifa),
    importe: importe,
    pct_indexacion: idx.etiqueta,
    importe_indexacion: idx.importe,
    tipo_iva: tipoIva(v),
    // metadata de auditoria -- no son columnas del escritorio.
    fecha_carga: v.fecha || null,
    estado: v.estado || null,
    estado_lectura: v.estado_lectura || null,
    tarifa_estado: resultadoTarifa.estado,
    resaltar: motivos.length > 0,
    motivos_resaltado: motivos
  };
}

// Fecha de carga: no es una de las columnas que se transcriben a mano al
// escritorio (el encargo la deja fuera de COLUMNAS a proposito), pero el
// encargo SI pide poder "filtrar por cliente, por chofer, por fecha, para
// cargar por lotes" -- se agrega como columna extra, ANTES de COLUMNAS, sin
// alterar el orden de escritorio que valoresEnOrden()/COLUMNAS ya fijan.
var COLUMNA_FECHA = { clave: 'fecha_carga', titulo: 'Fecha carga' };
var COLUMNAS_TABLA = [COLUMNA_FECHA].concat(COLUMNAS);

/** Proyecta una fila a un array de valores en el orden de COLUMNAS (para render y tests de orden). */
function valoresEnOrden(fila) {
  return COLUMNAS.map(function (c) { return fila[c.clave]; });
}

/** Igual que valoresEnOrden pero incluye la columna Fecha carga (para filtro y render de tabla). */
function valoresTabla(fila) {
  return COLUMNAS_TABLA.map(function (c) { return fila[c.clave]; });
}

/**
 * Filtro por columna sobre filas ya armadas (misma logica que corre en el
 * navegador via el <script> inline de renderHTML -- ver ahi). Sustring,
 * insensible a mayusculas, AND entre columnas con filtro no vacio.
 *
 * @param {Array<object>} filas
 * @param {Array<string>} filtros  un valor por columna de COLUMNAS_TABLA (fecha + las 16), '' = sin filtrar esa columna.
 */
function filtrarFilasPorColumna(filas, filtros) {
  var lista = Array.isArray(filas) ? filas : [];
  var f = Array.isArray(filtros) ? filtros : [];
  return lista.filter(function (fila) {
    var valores = valoresTabla(fila);
    for (var i = 0; i < f.length; i++) {
      var q = (f[i] || '').toString().trim().toLowerCase();
      if (!q) { continue; }
      var texto = (valores[i] === null || valores[i] === undefined) ? '' : String(valores[i]).toLowerCase();
      if (texto.indexOf(q) === -1) { return false; }
    }
    return true;
  });
}

function armarFilas(viajes, tarifasRows, indexacionRowsCrudas) {
  var lista = Array.isArray(viajes) ? viajes : [];
  var indexacionRows = INDEXACION_PLAN.deduplicarIndexacion(indexacionRowsCrudas);
  return lista.map(function (v) { return armarFila(v, tarifasRows, indexacionRows); });
}

// --- HTML minimo: mismo estilo que ficha/pendientes.js (sin framework, sin build) --
function escHtml(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function celda(valor) {
  if (valor === null || valor === undefined || valor === '') { return '<td class="vacio">-</td>'; }
  return '<td>' + escHtml(valor) + '</td>';
}

/**
 * Tabla HTML autocontenida. Doble uso en la MISMA tabla (no hay modo copilot
 * vs modo auditoria por separado): todas las columnas del escritorio siempre
 * visibles para transcribir, y las filas con REVISAR / PENDIENTE_DOCUMENTACION
 * / SIN_TARIFA / indexacion sin cerrar SIEMPRE resaltadas (no se ocultan --
 * el objetivo de la auditoria es justamente verlas). El motivo del resaltado
 * va en el atributo title de la fila, visible al pasar el mouse, sin agregar
 * una columna que no esta en el sistema de escritorio.
 *
 * @param {Array<object>} filas  salida de armarFilas().
 */
function renderHTML(filas) {
  var lista = Array.isArray(filas) ? filas : [];
  var nCols = COLUMNAS_TABLA.length;
  var cuerpo;
  if (lista.length === 0) {
    cuerpo = '<tr><td colspan="' + nCols + '" class="vacio-tabla">No hay viajes para mostrar.</td></tr>';
  } else {
    cuerpo = lista.map(function (f) {
      var claseFila = f.resaltar ? ' class="resaltada"' : '';
      var titulo = f.resaltar ? ' title="' + escHtml(f.motivos_resaltado.join(' | ')) + '"' : '';
      var celdas = valoresTabla(f).map(celda).join('');
      return '<tr' + claseFila + titulo + ' data-id="' + escHtml(f.id) + '">' + celdas + '</tr>';
    }).join('');
  }
  var headers = COLUMNAS_TABLA.map(function (c) { return '<th>' + escHtml(c.titulo) + '</th>'; }).join('');
  var filtros = COLUMNAS_TABLA.map(function (c, i) {
    return '<th><input type="text" class="filtro-col" data-col="' + i + '" placeholder="filtrar ' + escHtml(c.titulo) + '"></th>';
  }).join('');
  return [
    '<!doctype html><html lang="es"><head><meta charset="utf-8">',
    '<title>Planilla carga/auditoria - Transliquidos Estevez</title>',
    '<style>',
    'body{font-family:system-ui,Arial,sans-serif;margin:2rem;background:#f7f7f7;color:#222}',
    'h1{font-size:1.3rem;margin-bottom:.2rem}',
    'p.sub{color:#555;margin-top:0}',
    'table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}',
    'th,td{border:1px solid #ddd;padding:.4rem .5rem;text-align:left;font-size:.85rem;white-space:nowrap}',
    'th{background:#333;color:#fff;position:sticky;top:0}',
    'tr:nth-child(even){background:#fafafa}',
    'tr.resaltada{background:#fff3cd}',
    'tr.resaltada:hover{background:#ffe69c}',
    'td.vacio{color:#999}',
    '.vacio-tabla{text-align:center;padding:2rem;color:#666}',
    '.leyenda{margin:.5rem 0 1rem;font-size:.85rem;color:#555}',
    '.leyenda .muestra{display:inline-block;width:.9rem;height:.9rem;background:#fff3cd;border:1px solid #ddd;vertical-align:middle;margin-right:.3rem}',
    'tr.filtros th{background:#eee;padding:.25rem}',
    'tr.filtros input{width:100%;box-sizing:border-box;padding:.2rem .3rem;font-size:.8rem;font-weight:normal}',
    'tr.oculta-por-filtro{display:none}',
    '#limpiar-filtros{margin:0 0 .5rem;font-size:.8rem;padding:.25rem .6rem;cursor:pointer}',
    '</style></head><body>',
    '<h1>Planilla de carga / auditoria (' + lista.length + ')</h1>',
    '<p class="sub">Copilot de carga (transcribir al sistema de escritorio) + auditoria de facturacion (misma tabla).</p>',
    '<p class="leyenda"><span class="muestra"></span>Resaltado = revisar antes de facturar (REVISAR, PENDIENTE_DOCUMENTACION, SIN_TARIFA o indexacion agregada sin cerrar). Pasar el mouse por la fila para ver el motivo.</p>',
    '<button type="button" id="limpiar-filtros">Limpiar filtros</button>',
    '<table id="planilla"><thead><tr>' + headers + '</tr><tr class="filtros">' + filtros + '</tr></thead><tbody>',
    cuerpo,
    '</tbody></table>',
    // Filtro por columna, 100% inline -- sin CDN, sin archivo aparte (el VPS
    // bloquea CDN, ver encargo). Substring, insensible a mayusculas, AND
    // entre columnas con filtro no vacio -- misma logica que
    // filtrarFilasPorColumna() en planilla.js (duplicada aca a proposito:
    // esto corre en el navegador del usuario, no en el nodo Code de n8n).
    '<script>',
    '(function () {',
    '  var tabla = document.getElementById("planilla");',
    '  if (!tabla) { return; }',
    '  var inputs = Array.prototype.slice.call(tabla.querySelectorAll("tr.filtros input"));',
    '  function aplicar() {',
    '    var filtros = inputs.map(function (i) { return i.value.trim().toLowerCase(); });',
    '    var filas = tabla.querySelectorAll("tbody tr");',
    '    for (var f = 0; f < filas.length; f++) {',
    '      var tr = filas[f];',
    '      var celdas = tr.children;',
    '      if (celdas.length < filtros.length) { continue; }',
    '      var visible = true;',
    '      for (var i = 0; i < filtros.length; i++) {',
    '        if (!filtros[i]) { continue; }',
    '        var texto = (celdas[i].textContent || "").toLowerCase();',
    '        if (texto.indexOf(filtros[i]) === -1) { visible = false; break; }',
    '      }',
    '      tr.classList.toggle("oculta-por-filtro", !visible);',
    '    }',
    '  }',
    '  inputs.forEach(function (i) { i.addEventListener("input", aplicar); });',
    '  var limpiar = document.getElementById("limpiar-filtros");',
    '  if (limpiar) { limpiar.addEventListener("click", function () { inputs.forEach(function (i) { i.value = ""; }); aplicar(); }); }',
    '})();',
    '</script>',
    '</body></html>'
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    COLUMNAS: COLUMNAS,
    COLUMNAS_TABLA: COLUMNAS_TABLA,
    tipoIva: tipoIva,
    calcularImporte: calcularImporte,
    textoTarifa: textoTarifa,
    armarFila: armarFila,
    valoresEnOrden: valoresEnOrden,
    valoresTabla: valoresTabla,
    armarFilas: armarFilas,
    filtrarFilasPorColumna: filtrarFilasPorColumna,
    escHtml: escHtml,
    renderHTML: renderHTML
  };
}

// Nodo Code "Planilla" del workflow "[ESTEVEZ] Vista Pendientes" (mismo
// despliegue que /webhook/viajes-pendientes y /webhook/viajes-accion, mismo
// dominio https://studio-julio.duckdns.org/ -- v1.1 pieza 2 no monta un
// workflow nuevo, cuelga del que ya esta publicado).
//
// Entrada: cadena "Leer Viajes Planilla" -> "Leer Tarifas Planilla"
// (executeOnce) -> "Leer Indexacion Planilla" (executeOnce) -> este nodo.
// Nombres propios (no comparten nodo con Pendientes/Aplicar Accion, que
// corren en OTRO trigger del mismo workflow) para no invocar $('Leer Viajes')
// contra un nodo que no ejecuto en esta rama.
//
// OJO de arquitectura (probado en vivo antes de escribir esto, ver encargo):
// conectar 3 lecturas de tabla en paralelo hacia un mismo nodo Code NO
// ejecuta las 3 de forma confiable en esta instancia de n8n (una rama queda
// sin ejecutar), y encadenar con la tabla mas grande (Indexacion, 37.660
// filas crudas) en el medio de la cadena cuelga la ejecucion. La cadena
// Viajes(chica)->Tarifas(538, ultimo hop antes de Indexacion)->Indexacion
// (37.660, ultimo hop antes del Code) es el orden que corrio bien -- misma
// posicion relativa que el patron ya probado en Pendientes/Aplicar Accion
// (tabla grande como ultimo input directo al Code, nunca como input de un
// tercer nodo intermedio).
//
// Indexacion llega CRUDA (con la duplicacion x538 real de la tabla, ver
// indexacion.js); armarFilas() la deduplica antes de buscar tramos.

const viajes = $('Leer Viajes Planilla').all().map(function (it) { return it.json || {}; });
const tarifas = $('Leer Tarifas Planilla').all().map(function (it) { return it.json || {}; });
const indexacionCruda = $input.all().map(function (it) { return it.json || {}; });

const filas = armarFilas(viajes, tarifas, indexacionCruda);
return [{ json: { html: renderHTML(filas), total: filas.length } }];
