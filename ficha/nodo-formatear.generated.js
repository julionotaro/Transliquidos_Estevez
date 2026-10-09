// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/flota.js + ficha/cruce.js + ficha/modalidad-indexacion.js + ficha/odometro.js + ficha/../catalogo/gesruta.js + ficha/correlacionar.js + ficha/nodo-formatear.wrapper.js
// Contenido exacto del nodo Code "Formatear Linea Gesruta" (WD0q9Ic0oDvUoJwp).

// ===== PADRON DE FLOTA — resolver la matricula contra el conjunto CERRADO =====
//
// POR QUE (encargo de Julio, 2026-08-22): leer 7 caracteres manuscritos/escaneados
// sin ningun error es poco fiable, y exigir lectura perfecta hacia que ~90% de los
// escaneos no correlacionaran. Pero la flota es un CONJUNTO CERRADO de ~30
// matriculas: si el lector acierta 4-5 de los 7 caracteres, el cruce contra el
// padron devuelve la matricula CIERTA. No es adivinar: es elegir dentro de una
// lista conocida, y solo cuando la eleccion es inequivoca.
//
// DATO REAL que sostiene el umbral (export Gesruta, 8.756 viajes, 28 tractoras
// con uso significativo). Similitud posicional entre matriculas de la flota:
//   5 de 7 -> UN solo par (3729JLH / 3729JWP)
//   4 de 7 -> UN solo par (8382JJS / 8267JJS)
//   <=3 de 7 -> los otros 376 pares
// Con esa separacion, 5 aciertos identifican casi siempre una unica matricula, y
// la regla de MARGEN de abajo cubre justamente los dos pares peligrosos.
//
// REGLA: se compara posicion a posicion (formato espanol DDDDLLL). Se elige la
// mejor candidata SOLO si le saca MARGEN_MINIMO de ventaja a la segunda. Si dos
// matriculas de la flota empatan (lectura a mitad de camino entre 3729JLH y
// 3729JWP), NO se resuelve: se devuelven las candidatas para revision humana.
// Nunca se inventa una matricula que no este en el padron.
//
// Logica PURA (sin n8n). El padron se puede inyectar (tabla `flota` a futuro);
// el default es la semilla derivada del export real.

'use strict';

// Padron AUTORITATIVO: exportado del listado de vehiculos de Gesruta
// (Listado_de_vehiculos.csv, entregado por Julio 2026-08-26). 31 cabezas
// tractoras con matricula de formato valido. Reemplaza la semilla vieja derivada
// del historico, que estaba incompleta (le faltaba 7963MDF de Pablo Carles, alta
// 13/07/26, y otras) — justo lo que hizo que la matricula "no estuviera en la
// flota" en la corrida real. FLOTA_DETALLE de abajo agrega remolque y chofer por
// tractora, para usarlos como señales de cruce adicionales.
var FLOTA_TRACTORAS = [
  '0275JLC', '0332LPL', '0557JMS', '1017JZT', '2050MZY', '2256JYX', '2498KZL',
  '2541HPJ', '3729JLH', '3729JWP', '4530MXP', '4916NJG', '5132LMC', '5358KTF',
  '5630GCS', '5713LMN', '5820JDK', '6124HZT', '6516KTH', '6792HZR', '7010JJY',
  '7347LBB', '7394LZP', '7585MCG', '7963MDF', '8066HZR', '8262MNC', '8420KKT',
  '8504KDR', '9039KDR', '9223FPD'
];

// [matricula, remolque, chofer] por tractora. Del mismo listado. El remolque y el
// chofer son señales de cruce independientes de la matricula: si la matricula del
// documento se leyo mal pero el remolque o el chofer coinciden con los de una
// tractora del padron, es la misma. Un remolque puede repetirse entre tractoras
// (es intercambiable), asi que NO identifica solo; desempata.
var FLOTA_DETALLE = [
  ['0275JLC', 'R1943BBL', 'JOSE ENRIQUE ARIAS'],
  ['0332LPL', 'CR03804R', 'JUAN MANUEL ABAL'],
  ['0557JMS', 'PO1956R', 'MIGUEL PIRES'],
  ['1017JZT', 'R3546BBG', 'PEDRO OTERO'],
  ['2050MZY', 'R2006BDT', 'JOSE MANUEL PAZ'],
  ['2256JYX', 'R3546BBG', 'MANUEL SABARIS'],
  ['2498KZL', 'R1007BCV', 'FRANCISCO ASENSI'],
  ['2541HPJ', 'PO2628R', 'PABLO CARLES SANTOS'],
  ['3729JLH', 'R7749BDB', 'MARCOS EIRIN FERNANDEZ'],
  ['3729JWP', 'PO2662R', 'CARLOS ABALO QUINTELA'],
  ['4530MXP', 'R3546BBG', 'PEDRO OTERO'],
  ['4916NJG', 'R1783BBJ', 'JOSE CARLOS ALFONSIN'],
  ['5132LMC', 'R9520BCV', 'JOSE CARLOS RODRIGUEZ'],
  ['5358KTF', 'R8574BBC', 'PEDRO FRAGA'],
  ['5630GCS', 'R0110BBG', 'TRANSBUA, S.L.'],
  ['5713LMN', 'R1639BDD', 'MANUEL ABOY GONZALEZ'],
  ['5820JDK', 'R1639BDD', 'MANUEL ABOY GONZALEZ'],
  ['6124HZT', 'R8839BDR', 'LUIS M. TRINANES'],
  ['6516KTH', 'R1644BDB', 'JOSE RUBEN ABALO RECUNA'],
  ['6792HZR', '', ''],
  ['7010JJY', '', 'URBANO ALONSO LAMAS'],
  ['7347LBB', 'R9990BDD', 'RODRIGO PEREZ BAHAMONDE'],
  ['7394LZP', '', 'JOSE ANTONIO VAZQUEZ HERMO'],
  ['7585MCG', '', 'JACOBO GRANDE MENDEZ'],
  ['7963MDF', 'PO2628R', 'PABLO CARLES SANTOS'],
  ['8066HZR', '', 'BREOGAN MARQUEZ'],
  ['8262MNC', 'R4714BCX', 'CANDIDO JAMARDO'],
  ['8420KKT', 'R3697BDK', 'JOSE RAMON PINEIRO'],
  ['8504KDR', 'R4905BDF', 'NUNO FILIPE'],
  ['9039KDR', 'R7936BCV', 'MANUEL FERREIRA GOLDAR'],
  ['9223FPD', 'R1829BBB', 'MANUEL FERREIRA GOLDAR'],
];

// Aciertos posicionales minimos para considerar candidata a una matricula del
// padron, y ventaja minima sobre la segunda para resolver sin ambiguedad.
var ACIERTOS_MINIMOS = 4;   // 4 de 7 (lo que Julio estimo como piso realista)
var MARGEN_MINIMO = 2;      // debe sacarle 2 aciertos a la segunda candidata
// Excepcion al margen: si solo falla UN caracter (6 de 7), es la señal mas fuerte
// que hay despues del match exacto — un error de un caracter es mucho mas probable
// que dos. Con esto el par peligroso (3729JLH/3729JWP) se sigue resolviendo cuando
// la lectura es casi perfecta, y solo queda ambiguo cuando de verdad esta a mitad
// de camino (3729JXX: 5 y 5). Igual se marca REVISAR.
var ACIERTOS_CASI_EXACTO = 6;

/**
 * Normaliza una matricula: mayusculas, sin separadores, sin prefijo de pais
 * (ES/PT) y reponiendo el cero inicial perdido (3 digitos + 3 letras).
 */
function normalizarMatricula(x) {
  var s = (x === null || x === undefined) ? '' : String(x);
  s = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  var m = s.match(/^(?:ES|PT)(\d{4}[A-Z]{3})$/);
  if (m) { s = m[1]; }
  if (/^\d{3}[A-Z]{3}$/.test(s)) { s = '0' + s; }
  return s;
}

/** Aciertos posicion a posicion entre dos cadenas de igual longitud. */
function aciertosPosicionales(a, b) {
  if (!a || !b || a.length !== b.length) { return -1; }
  var n = 0;
  for (var i = 0; i < a.length; i++) { if (a.charAt(i) === b.charAt(i)) { n++; } }
  return n;
}

/**
 * Resuelve una matricula leida contra el padron de la flota.
 *
 * @param {string} leida  matricula tal como la leyo el extractor
 * @param {Array<string>} [padron]  default FLOTA_TRACTORAS
 * @returns {{matricula:string|null, leida:string, metodo:'exacta'|'flota'|'sin_padron'|'ambigua'|'ilegible',
 *            aciertos:number, candidatas:Array<string>, corregida:boolean, motivo:string}}
 */
function resolverMatricula(leida, padron) {
  var lista = (padron && padron.length) ? padron : FLOTA_TRACTORAS;
  var norm = normalizarMatricula(leida);
  if (!norm) {
    return { matricula: null, leida: '', metodo: 'ilegible', aciertos: 0, candidatas: [], corregida: false, motivo: 'matricula ilegible o ausente' };
  }
  // Match exacto contra el padron: camino feliz, sin marca.
  for (var i = 0; i < lista.length; i++) {
    if (lista[i] === norm) {
      return { matricula: norm, leida: norm, metodo: 'exacta', aciertos: norm.length, candidatas: [norm], corregida: false, motivo: '' };
    }
  }
  // Puntaje posicional contra todo el padron (solo formato comparable).
  var mejor = null, mejorPts = -1, segundoPts = -1, empatadas = [];
  for (var j = 0; j < lista.length; j++) {
    var pts = aciertosPosicionales(norm, lista[j]);
    if (pts < 0) { continue; }
    if (pts > mejorPts) { segundoPts = mejorPts; mejorPts = pts; mejor = lista[j]; empatadas = [lista[j]]; }
    else if (pts === mejorPts) { segundoPts = pts; empatadas.push(lista[j]); }
    else if (pts > segundoPts) { segundoPts = pts; }
  }
  if (mejorPts < ACIERTOS_MINIMOS) {
    // No se parece a ninguna del padron: puede ser un subcontratado o una lectura
    // muy mala. NO se fuerza: se devuelve la leida tal cual (sin bloquear).
    return {
      matricula: norm, leida: norm, metodo: 'sin_padron', aciertos: mejorPts < 0 ? 0 : mejorPts,
      candidatas: [], corregida: false,
      motivo: 'la matricula ' + norm + ' no se parece a ninguna de la flota (puede ser un vehiculo subcontratado)'
    };
  }
  var margenNecesario = (mejorPts >= ACIERTOS_CASI_EXACTO) ? 1 : MARGEN_MINIMO;
  if (empatadas.length > 1 || (mejorPts - segundoPts) < margenNecesario) {
    var cands = empatadas.length > 1 ? empatadas : [mejor];
    return {
      matricula: null, leida: norm, metodo: 'ambigua', aciertos: mejorPts,
      candidatas: cands, corregida: false,
      motivo: 'la lectura ' + norm + ' se parece por igual a varias matriculas de la flota (' + cands.join(', ') + ') — revisar cual es'
    };
  }
  return {
    matricula: mejor, leida: norm, metodo: 'flota', aciertos: mejorPts, candidatas: [mejor], corregida: true,
    motivo: 'matricula leida ' + norm + ' resuelta a ' + mejor + ' por cruce con el padron de flota (' + mejorPts + ' de ' + norm.length + ' caracteres) — verificar que sea el camion correcto'
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FLOTA_TRACTORAS: FLOTA_TRACTORAS,
    FLOTA_DETALLE: FLOTA_DETALLE,
    ACIERTOS_MINIMOS: ACIERTOS_MINIMOS,
    MARGEN_MINIMO: MARGEN_MINIMO,
    normalizarMatricula: normalizarMatricula,
    aciertosPosicionales: aciertosPosicionales,
    resolverMatricula: resolverMatricula,
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

// ===== ODOMETRO POR TRACTORA — km vacios y ultimo km registrado ==============
//
// EL PROBLEMA (encargo de Julio: "el registro de ultimo KM tractora es por
// viaje, no solo en el ultimo viaje de cada ficha")
//
// Los km vacios se calculaban asi (correlacionar.js):
//
//     if (i > 0 && viajes[i - 1].hoja_idx === v.hoja_idx) {
//       v.km_vacios = v.km_inicio - viajes[i - 1].km_final;
//     }
//
// Tres defectos, y los tres se proyectan a futuro:
//
// 1) EL PRIMER VIAJE DE CADA FICHA NUNCA TIENE KM VACIOS. La condicion exige un
//    viaje anterior EN LA MISMA HOJA. Una ficha es una semana con hasta 3
//    bloques, asi que se pierde el vacio de ~1 de cada 3 viajes, siempre el
//    mismo: el primero. No es un caso raro, es un tercio del dato.
//
// 2) NADA PERSISTE EL ODOMETRO ENTRE INGESTAS. El km_final del ultimo viaje de
//    la semana pasada esta en la tabla Viajes, pero nunca se vuelve a leer. Sin
//    eso el primer viaje de una ficha NO PUEDE tener vacios, por diseño: le
//    falta el dato de donde venia el camion. Por eso el defecto 1 no se arregla
//    mirando solo el lote que se esta ingestando.
//
// 3) ENCADENAR POR POSICION EN EL ARRAY ES LA LLAVE EQUIVOCADA. `viajes[i-1]`
//    con `hoja_idx` igual encadena por el orden en que se escanearon los
//    papeles. Lo correcto es encadenar por TRACTORA: el odometro es del camion,
//    no de la hoja ni del chofer. Dos fichas de chóferes distintos sobre el
//    MISMO camion tienen que encadenar (hoy no lo hacen), y dos bloques de
//    camiones distintos no deben encadenar jamas (hoy, si el escaneo los deja
//    contiguos dentro de una hoja mal agrupada, se restan odometros de dos
//    camiones y sale un numero absurdo con pinta de valido).
//
// LA SOLUCION
//
// A) La cadena es POR TRACTORA. Se agrupan los viajes por matricula resuelta
//    (tractoraN, ya cotejada contra el padron de flota) y dentro de cada
//    tractora se ordenan por ODOMETRO, no por posicion ni por fecha: el
//    odometro es monotono creciente por construccion y no depende de que la
//    fecha manuscrita se haya leido bien.
//
// B) La cadena ARRANCA en el ultimo odometro conocido de esa tractora, leido de
//    la tabla Viajes. Asi el primer viaje de la ficha tambien tiene vacios.
//
// C) Se devuelve el ultimo odometro POR TRACTORA para volver a persistirlo. Ese
//    es el "registro de ultimo KM por viaje" del encargo: se actualiza con cada
//    viaje ingestado, no una vez por ficha.
//
// D) GUARDAS. Un salto negativo o desmedido no se escribe en silencio:
//    - negativo  -> falta un viaje intermedio (o el odometro se leyo mal)
//    - > MAX_VACIOS_KM -> hay viajes sin registrar en el medio
//    - la tractora del padron no coincide -> no se encadena, se avisa
//    En los tres casos km_vacios queda null y el viaje va a REVISAR con motivo.
//    Un km vacio inventado se factura; un null se revisa.
//
// Logica PURA (sin n8n): el padron de ultimos odometros se inyecta.

'use strict';

// Salto maximo plausible entre la descarga de un viaje y la carga del siguiente.
// Un retorno largo en vacio (Huelva -> Galicia) ronda los 900 km. Por encima de
// 1.500 lo mas probable es que falten viajes sin registrar en el medio, no que
// el camion haya hecho ese vacio.
var MAX_VACIOS_KM = 1500;

function num(x) {
  if (x === null || x === undefined || x === '') { return null; }
  var n = Number(x);
  return isFinite(n) ? n : null;
}

/**
 * Padron de ultimos odometros a partir de las filas ya existentes en la tabla
 * Viajes. Por tractora se queda con el km_final MAS ALTO: el odometro solo
 * crece, asi que el maximo es el ultimo, sin depender de fechas ni del orden en
 * que la tabla devuelva las filas.
 *
 * @param {Array<object>} filasViajes  filas de la tabla Viajes
 * @returns {object} { matricula: {km_final, fecha, viaje_id} }
 */
function ultimosOdometros(filasViajes) {
  var filas = Array.isArray(filasViajes) ? filasViajes : [];
  var out = {};
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i] || {};
    var mat = String(f.matricula_tractora || f.tractoraN || f.tractora || '').trim().toUpperCase();
    var kmF = num(f.km_final);
    if (!mat || kmF === null) { continue; }
    if (!out[mat] || kmF > out[mat].km_final) {
      out[mat] = {
        km_final: kmF,
        fecha: String(f.fecha_carga || f.fecha || ''),
        viaje_id: f.id || f.viaje_id || null
      };
    }
  }
  return out;
}

/**
 * Calcula km_vacios encadenando por TRACTORA, arrancando en el ultimo odometro
 * conocido de cada una. Muta los viajes (les escribe km_vacios, origen_km_vacios
 * y, si corresponde, el motivo de revision) y devuelve el padron actualizado.
 *
 * @param {Array<object>} viajes  viajes del lote, con {tractoraN, km_inicio, km_final}
 * @param {object} [previos]  el de ultimosOdometros(); ausente = solo el lote
 * @param {function} [marcar]  (viaje, motivo) para mandar a REVISAR
 * @returns {{ultimos:object, avisos:Array<string>, encadenados:number}}
 */
function encadenarPorTractora(viajes, previos, marcar) {
  var lista = Array.isArray(viajes) ? viajes : [];
  var avisos = [];
  var ultimos = {};
  var encadenados = 0;
  var nota = function (v, msg) { avisos.push(msg); if (typeof marcar === 'function') { marcar(v, msg); } };

  // Arrancar del padron previo (copia: no se muta lo que nos pasaron).
  if (previos) {
    for (var k in previos) {
      if (Object.prototype.hasOwnProperty.call(previos, k)) {
        ultimos[k] = { km_final: previos[k].km_final, fecha: previos[k].fecha, viaje_id: previos[k].viaje_id, origen: 'tabla' };
      }
    }
  }

  // Agrupar por tractora resuelta. Sin matricula no hay cadena posible: el
  // odometro no se puede atribuir a ningun camion.
  var porTractora = {};
  var sinMatricula = [];
  for (var i = 0; i < lista.length; i++) {
    var v = lista[i];
    v.km_vacios = null;
    v.origen_km_vacios = null;
    var mat = String(v.tractoraN || '').trim().toUpperCase();
    if (!mat) { sinMatricula.push(v); continue; }
    if (!porTractora[mat]) { porTractora[mat] = []; }
    porTractora[mat].push(v);
  }
  for (var s = 0; s < sinMatricula.length; s++) {
    sinMatricula[s].origen_km_vacios = 'sin_matricula';
  }

  for (var mt in porTractora) {
    if (!Object.prototype.hasOwnProperty.call(porTractora, mt)) { continue; }
    // Orden por ODOMETRO: monotono por construccion, no depende de que la fecha
    // manuscrita se haya leido bien. Los que no traen km_inicio van al final y
    // no participan de la cadena (no se puede saber donde encajan).
    var grupo = porTractora[mt].slice().sort(function (a, b) {
      var ka = num(a.km_inicio), kb = num(b.km_inicio);
      if (ka === null && kb === null) { return 0; }
      if (ka === null) { return 1; }
      if (kb === null) { return -1; }
      return ka - kb;
    });

    var anterior = ultimos[mt] ? ultimos[mt].km_final : null;
    var origenAnterior = ultimos[mt] ? 'tabla' : null;

    for (var j = 0; j < grupo.length; j++) {
      var vv = grupo[j];
      var ini = num(vv.km_inicio);
      var fin = num(vv.km_final);

      if (ini === null) {
        vv.origen_km_vacios = 'sin_km_inicio';
      } else if (anterior === null) {
        // Primer viaje conocido de esta tractora: no hay de donde venia. No es
        // un error, es que falta historia.
        vv.origen_km_vacios = 'sin_odometro_previo';
      } else {
        var vac = ini - anterior;
        if (vac < 0) {
          nota(vv, 'km vacios negativos (' + mt + ': odometro previo ' + anterior +
            ' > km inicio ' + ini + '): falta un viaje intermedio o el odometro se leyo mal');
          vv.origen_km_vacios = 'negativo';
        } else if (vac > MAX_VACIOS_KM) {
          nota(vv, 'km vacios ' + vac + ' para ' + mt + ' supera los ' + MAX_VACIOS_KM +
            ' km plausibles: probablemente hay viajes sin registrar en el medio');
          vv.origen_km_vacios = 'salto_excesivo';
        } else {
          vv.km_vacios = vac;
          vv.origen_km_vacios = (origenAnterior === 'tabla') ? 'cadena_tabla' : 'cadena_lote';
          encadenados++;
        }
      }

      // El odometro avanza aunque el vacio no se haya podido calcular: lo que
      // importa para el siguiente eslabon es donde quedo el camion.
      if (fin !== null && (anterior === null || fin > anterior)) {
        anterior = fin;
        origenAnterior = 'lote';
        ultimos[mt] = { km_final: fin, fecha: String(vv.fecha_carga || ''), viaje_id: vv.id || null, origen: 'lote' };
      }
    }
  }

  return { ultimos: ultimos, avisos: avisos, encadenados: encadenados };
}

/**
 * Padron listo para persistir: una fila por tractora con su ultimo odometro.
 * Es el "registro de ultimo KM por tractora" del encargo — se actualiza con cada
 * viaje ingestado, no una vez por ficha.
 *
 * @param {object} ultimos  el que devuelve encadenarPorTractora()
 * @returns {Array<object>} [{matricula_tractora, km_final, fecha_carga, viaje_id, origen}]
 */
function filasUltimoOdometro(ultimos) {
  var out = [];
  if (!ultimos) { return out; }
  for (var mat in ultimos) {
    if (!Object.prototype.hasOwnProperty.call(ultimos, mat)) { continue; }
    var u = ultimos[mat];
    out.push({
      matricula_tractora: mat,
      km_final: u.km_final,
      fecha_carga: u.fecha || '',
      viaje_id: u.viaje_id || null,
      origen: u.origen || 'lote'
    });
  }
  out.sort(function (a, b) { return a.matricula_tractora.localeCompare(b.matricula_tractora); });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MAX_VACIOS_KM: MAX_VACIOS_KM,
    ultimosOdometros: ultimosOdometros,
    encadenarPorTractora: encadenarPorTractora,
    filasUltimoOdometro: filasUltimoOdometro
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

// ===== CORRELACIONADOR v3.2: dos pasadas + match determinista + guardas + estado_lectura =====
//
// Logica del nodo Code "Formatear Linea Gesruta" del workflow [ESTEVEZ] Ingesta
// Viaje (WD0q9Ic0oDvUoJwp). Extraida aqui para que el repo sea la fuente de verdad
// y no se separe del workflow en silencio (ESTADO-Y-TRASPASO §4).
//
// Cambio v3.1 -> v3.2: NADA de la logica de correlacion ni de las guardas. Lo unico
// que cambia es que las guardas ahora marcan LA FILA, no solo el texto global.
//
//   estado_lectura   'OK' | 'REVISAR'
//   motivo_revision  por que quedo en REVISAR
//   pagina_origen    pagina del PDF de la que salio el viaje (trazabilidad)
//
// El defecto que corrige: en v3.1 las guardas escribian en un blob de texto y la
// fila se persistia igual en la tabla Viajes con estado 'pendiente'. Un viaje con
// el odometro ANULADO por la guarda del multiplo de 500 entraba indistinguible de
// uno bien leido. Mismo principio que el validador: un dato no confiable jamas
// puede parecerse a uno verificado.
//
// El informe de texto y el `datos_json` conservan exactamente el formato de v3.1;
// los campos nuevos son aditivos. El test de regresion compara el informe generado
// por este modulo contra el del fuente original, caracter a caracter.

// --- Estados de lectura ---
var ESTADO_LECTURA = { OK: 'OK', REVISAR: 'REVISAR' };

// Logging estandar del runtime, visible en el log de ejecucion de n8n.
var LOG_ACTIVO = true;
function setLogActivo(v) { LOG_ACTIVO = !!v; }
function logInfo(msg) { if (LOG_ACTIVO) { console.log('[ficha] ' + msg); } }
function logError(msg) { if (LOG_ACTIVO) { console.error('[ficha] ERROR ' + msg); } }

var nz = function (x) { if (x === null || x === undefined) { return null; } if (typeof x === 'string') { const s = x.trim(); return (s === '' || s.toLowerCase() === 'null') ? null : x; } return x; };
// num() devuelve null para 0: el marcador 0 que el modelo copiaba del esquema
// nunca debe entrar como dato (ESTADO §4, error 2).
var num = function (x) { if (typeof x === 'number') { return (isFinite(x) && x !== 0) ? x : null; } if (typeof x === 'string' && x.trim() !== '') { const n = Number(x.replace(/\./g, '').replace(',', '.')); return (isFinite(n) && n !== 0) ? n : null; } return null; };
// Normaliza una matricula. Ademas de quitar separadores, limpia dos suciedades
// REALES de la lectura de documentos (ejec. 967), sin depender del modelo:
//   - PREFIJO DE PAIS: los CMR/cartas de porte escriben "ES 0332LPL" / "PT 12AB34".
//     Se quita el ES/PT inicial cuando lo que sigue ya es una matricula completa.
//   - CERO INICIAL PERDIDO: "332LPL" por "0332LPL". La matricula espanola es
//     4 digitos + 3 letras; si vienen 3 digitos + 3 letras se repone el cero.
// Ambas son reversibles y conservadoras: si el patron no calza, no se toca nada.
var mat = function (x) {
  var s = (x || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
  var m = s.match(/^(?:ES|PT)(\d{4}[A-Z]{3})$/);
  if (m) { s = m[1]; }
  if (/^\d{3}[A-Z]{3}$/.test(s)) { s = '0' + s; }
  return s;
};
var upp = function (x) { return (x || '').toString().toUpperCase(); };
var dias = function (a, b) { if (!a || !b) { return null; } const da = Date.parse(a + 'T00:00:00Z'); const db = Date.parse(b + 'T00:00:00Z'); if (!isFinite(da) || !isFinite(db)) { return null; } return Math.round((db - da) / 86400000); };

// --- Coincidencia laxa de nombres de empresa/lugar ---------------------------
// Se usa SOLO para inferir el ROL de un documento de peso (carga=origen vs
// descarga=destino) via heuristica emisor<->ficha (CAMBIO 2, §4). Normaliza
// (mayusculas, sin acentos, sin formas societarias) y acepta inclusion o un
// token significativo compartido. Objetivo: robustez, no exactitud milimetrica.
function normNombre(x) {
  return upp(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\b(SA|SL|SLU|SAU|SCA|SC|CB|SLL|SLNE|LDA|SARL)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function coincideNombre(a, b) {
  var na = normNombre(a), nb = normNombre(b);
  if (!na || !nb) { return false; }
  if (na === nb || na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0) { return true; }
  var ta = na.split(' ').filter(function (t) { return t.length >= 4; });
  var sb = {}; nb.split(' ').forEach(function (t) { if (t.length >= 4) { sb[t] = true; } });
  for (var i = 0; i < ta.length; i++) { if (sb[ta[i]]) { return true; } }
  return false;
}
// "Difieren" el peso de carga y el de descarga: tolerancia en kg (bascula/merma).
// Configurable sin reescribir la logica.
var PESO_TOL_DIFIEREN_KG = 100;

// --- Reconciliacion de matricula ficha <-> documento (correlacion robusta) ----
// El documento IMPRESO es la fuente CONFIABLE de la matricula; la ficha
// MANUSCRITA es la SOSPECHOSA. La relacion es ASIMETRICA: cuando los documentos
// del envio convergen en UNA matricula y hay UNA sola ficha a distancia <= umbral,
// se corrige la FICHA (nunca al reves). Parametros configurables (endurecer o
// aflojar sin reescribir la logica):
//   MATRICULA_DIST_MAX  distancia de edicion maxima ficha<->documento del fallback.
//   Convergencia (salvaguarda anti "dos camiones"): se evalua POR FICHA. Solo
//   cuentan como candidatas de correccion las matriculas de documento CERCANAS
//   (distancia <= umbral) a esa ficha; las lejanas son otro camion y no bloquean.
// DECIDIDO CON DATOS (ejec. 944): se aflojo la unanimidad global a "mayoria clara".
// El envio real tenia dos camiones (un viaje cubierto por otro camion, 7347LBB) y
// la unanimidad bloqueaba tambien los viajes limpios de 0332LPL, dejandolos SIN
// documento/cliente/tarifa. El par peligroso de lote (0332 vs 0337, cercanos entre
// si) sigue tratandose como ambiguo. Ver reconciliarMatriculaFicha.
var MATRICULA_DIST_MAX = 1;

// Distancia de edicion (Levenshtein). Matriculas cortas, sin optimizacion agresiva.
function distanciaEdicion(a, b) {
  a = a || ''; b = b || '';
  if (a === b) { return 0; }
  var la = a.length, lb = b.length;
  if (la === 0) { return lb; }
  if (lb === 0) { return la; }
  var prev = []; var i, j;
  for (j = 0; j <= lb; j++) { prev[j] = j; }
  for (i = 1; i <= la; i++) {
    var cur = [i];
    var ca = a.charAt(i - 1);
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

/**
 * Reconcilia la matricula de la ficha (manuscrita, sospechosa) contra la de los
 * documentos (impresos, confiables) ANTES del match documento->viaje. Muta los
 * viajes IN PLACE. Asimetrica (el documento manda) y con salvaguarda de
 * convergencia (no adivina si los documentos no coinciden entre si).
 *
 * Cascada:
 *   - Si algun documento no matchea exacto ninguna ficha Y los documentos
 *     convergen en UNA matricula que esta a distancia <= MATRICULA_DIST_MAX de
 *     EXACTAMENTE UNA ficha: se corrige esa ficha (tractora/tractoraN <- matricula
 *     del documento), se guarda la lectura original en tractora_original /
 *     tractoraN_original (auditoria; viaja en `detalle`) y se marca REVISAR. Luego
 *     el match exacto de mas abajo los correlaciona solo.
 *   - Si los documentos NO convergen, o el candidato no es unico, o la distancia
 *     es > umbral: NO se toca nada, pero se agrega un motivo_revision que EXPLICA
 *     por que no se correlaciono (no un PENDIENTE_DOC mudo).
 *
 * @param {Array} viajes   viajes de las fichas (se mutan).
 * @param {Array} docsRaw  documentos del envio (impresos).
 * @param {function} marcar  marcar(v, motivo) para acumular motivos de REVISAR.
 */
function reconciliarMatriculaFicha(viajes, docsRaw, marcar) {
  if (!viajes.length || !docsRaw.length) { return; }

  // Matriculas de tractor legibles de los documentos (sin duplicados de pagina).
  var docMats = [];
  var remolqueDocs = {};
  for (var di = 0; di < docsRaw.length; di++) {
    var d = docsRaw[di];
    if (d.duplicado_de) { continue; }
    var dm = matFlota(d.matricula_tractor);
    if (dm) { docMats.push(dm); }
    var rm = mat(d.matricula_remolque);
    if (rm) { remolqueDocs[rm] = true; }
  }
  if (docMats.length === 0) { return; } // ningun documento con matricula legible

  // Fichas del envio agrupadas por matricula normalizada.
  var fichas = {};
  var sinMatricula = [];
  var hojasSinMat = {};
  for (var vi = 0; vi < viajes.length; vi++) {
    var v = viajes[vi];
    if (!v.tractoraN) { sinMatricula.push(v); hojasSinMat[v.hoja_idx] = true; continue; }
    if (!fichas[v.tractoraN]) { fichas[v.tractoraN] = []; }
    fichas[v.tractoraN].push(v);
  }
  var fichaMats = Object.keys(fichas);

  // ---- Ficha SIN matricula legible: el documento impreso manda (§ asimetria) --
  // La vision no siempre lee la matricula manuscrita: en la ejec. 975 devolvio
  // null (en la 967, de la MISMA ficha, habia leido 0332LPZ). Sin matricula de
  // ficha el envio queda con "0 camiones" y NINGUN documento se puede asociar.
  // Mismo principio asimetrico de toda esta funcion: el documento IMPRESO es la
  // fuente confiable. Si NINGUNA ficha del envio tiene matricula legible, el envio
  // es de UNA sola ficha, y los documentos DOMINAN en una matricula (sin empate),
  // se adopta esa para la ficha, marcando REVISAR. Conservador: con dos fichas sin
  // matricula, o con empate entre matriculas, no se adivina.
  if (sinMatricula.length && fichaMats.length === 0) {
    if (Object.keys(hojasSinMat).length !== 1) { return; }
    var conteoDoc = {};
    for (var q = 0; q < docMats.length; q++) { conteoDoc[docMats[q]] = (conteoDoc[docMats[q]] || 0) + 1; }
    var dominante = null, dmax = 0, empatada = false;
    for (var kd in conteoDoc) {
      if (!Object.prototype.hasOwnProperty.call(conteoDoc, kd)) { continue; }
      if (conteoDoc[kd] > dmax) { dominante = kd; dmax = conteoDoc[kd]; empatada = false; }
      else if (conteoDoc[kd] === dmax) { empatada = true; }
    }
    if (dominante && !empatada) {
      for (var s2 = 0; s2 < sinMatricula.length; s2++) {
        var vs = sinMatricula[s2];
        vs.tractora_original = vs.tractora;
        vs.tractoraN_original = vs.tractoraN;
        vs.tractora = dominante;
        vs.tractoraN = dominante;
        marcar(vs, 'la ficha no traia matricula legible; se adopta ' + dominante + ' de los documentos (' + dmax + ' coincidente(s)) — verificar que sea el camion correcto');
      }
    }
    return;
  }
  if (fichaMats.length === 0) { return; }

  // ¿Algun documento NO matchea exacto ninguna ficha? Solo entonces hay algo que
  // reconciliar; si todos matchean exacto es el camino feliz y no se toca.
  var hayHuerfano = false;
  for (var hi = 0; hi < docMats.length; hi++) { if (fichaMats.indexOf(docMats[hi]) === -1) { hayHuerfano = true; break; } }
  if (!hayHuerfano) { return; }

  var marcarFicha = function (fm, motivo) { var a = fichas[fm]; for (var k = 0; k < a.length; k++) { marcar(a[k], motivo); } };

  // MAYORIA CLARA por ficha (decidido con datos, ejec. 944) — reemplaza la
  // unanimidad global. Un envio real puede tener VARIOS camiones: en 944 el viaje
  // a RNM lo cubrio otro camion ("lo trajo Rodrigo, averio, fui a buscar la
  // cisterna"), asi que en el lote convivian 0332LPL (5 docs) y 7347LBB (2 docs).
  // Exigir unanimidad bloqueaba TAMBIEN los viajes limpios de 0332LPL. Ahora se
  // decide POR FICHA: solo cuentan como candidatas de correccion las matriculas de
  // documento CERCANAS a esa ficha (distancia <= umbral). Las lejanas son otro
  // camion y NO bloquean; sus documentos se ataran a su propio viaje en el match de
  // mas abajo, o quedaran huerfanos para revision. Asi se sigue distinguiendo el
  // par peligroso de lote (0332 vs 0337, ambos cercanos -> ambiguo, no adivinar) del
  // caso de dos camiones distintos (0332LPL vs 7347LBB, lejanos -> corregir la
  // mayoria). MATRICULA_DIST_MAX es la frontera "mismo camion mal leido".
  var distintas = {};
  for (var ci = 0; ci < docMats.length; ci++) { distintas[docMats[ci]] = true; }
  var docDistintas = Object.keys(distintas);

  var contarDocs = function (dmx) { var q, n = 0; for (q = 0; q < docMats.length; q++) { if (docMats[q] === dmx) { n++; } } return n; };

  var corregir = function (arr, dmConv) {
    // Refuerzo por remolque (senal secundaria, NO puerta): si el remolque de la
    // ficha tambien difiere de los documentos, refuerza que se leyo mal. Si coincide
    // exacto pero la tractora no, se corrige igual pero se deja constancia.
    var remolqueFichaN = arr[0].remolque ? mat(arr[0].remolque) : '';
    var remolqueCoincide = remolqueFichaN && remolqueDocs[remolqueFichaN];
    var nota = remolqueCoincide ? ' (el remolque si coincide, verificar con atencion)' : '';
    for (var ai = 0; ai < arr.length; ai++) {
      var vv = arr[ai];
      vv.tractora_original = vv.tractora;
      vv.tractoraN_original = vv.tractoraN;
      vv.tractora = dmConv;
      vv.tractoraN = dmConv;
      marcar(vv, 'matricula ficha ' + (vv.tractora_original || arr[0].tractoraN) + ' corregida a ' + dmConv + ' segun ' + contarDocs(dmConv) + ' documento(s) coincidente(s) — verificar que sea el mismo camion' + nota);
    }
  };

  for (var fi = 0; fi < fichaMats.length; fi++) {
    var fm = fichaMats[fi];
    // Matriculas de documento CERCANAS a ESTA ficha (candidatas de correccion).
    var cercanas = [];
    for (var ck = 0; ck < docDistintas.length; ck++) {
      if (distanciaEdicion(fm, docDistintas[ck]) <= MATRICULA_DIST_MAX) { cercanas.push(docDistintas[ck]); }
    }
    if (cercanas.length === 0) {
      // Ningun documento se parece a esta ficha. Si hay documentos (de otro camion),
      // esta ficha no tiene los suyos: se deja constancia sin corregir (distancia >).
      var lejana = docDistintas.slice().sort(function (a, b) { return distanciaEdicion(fm, a) - distanciaEdicion(fm, b); })[0];
      if (lejana) {
        marcarFicha(fm, 'documentos con matricula ' + lejana + ' no correlacionados: la ficha dice ' + fm + ' (distancia > ' + MATRICULA_DIST_MAX + '), no se puede afirmar que sea el mismo camion');
      }
      continue;
    }
    if (cercanas.length === 1 && cercanas[0] === fm) {
      continue; // la ficha ya matchea exacto un documento y no hay otra cercana: ok
    }
    if (cercanas.length > 1) {
      // DOS o mas matriculas de documento cercanas a la MISMA ficha (par de lote,
      // p.ej. 0332 vs 0337 con ficha 0335/0337): ambiguo -> no adivinar.
      marcarFicha(fm, 'documentos del envio no coinciden entre si en la matricula (' + cercanas.join(' vs ') + ') — posible envio de dos camiones, revisar manualmente');
      continue;
    }
    // Exactamente UNA matricula de documento cercana, distinta de la ficha.
    var dmConv = cercanas[0];
    // ¿Esa matricula esta cerca de OTRA ficha tambien? (ambiguo entre fichas).
    var otras = [];
    for (var oj = 0; oj < fichaMats.length; oj++) {
      if (fichaMats[oj] !== fm && distanciaEdicion(fichaMats[oj], dmConv) <= MATRICULA_DIST_MAX) { otras.push(fichaMats[oj]); }
    }
    if (otras.length > 0) {
      marcarFicha(fm, 'documentos con matricula ' + dmConv + ' no correlacionados: ' + (otras.length + 1) + ' fichas candidatas a distancia ' + MATRICULA_DIST_MAX + ' (' + [fm].concat(otras).join(', ') + ') — revisar cual camion es');
      continue;
    }
    corregir(fichas[fm], dmConv);
  }
}

// --- Reglas del modelo albaran=unidad (Fase 2, ficha/cruce.js) ---------------
// En n8n el build (build-nodo.js) concatena cruce.js ANTES que este archivo, asi
// que sus funciones quedan globales; en node/test se requieren. `typeof X ===
// 'function'` sobre un identificador no declarado devuelve 'undefined' sin lanzar,
// asi que el ternario elige la fuente correcta en cada entorno.
// Padron de flota (ficha/flota.js). Convierte una lectura imperfecta en la
// matricula CIERTA cruzando contra el conjunto cerrado de ~28 tractoras. Es la
// pieza que hace que la cascada (documento -> viaje -> cliente -> tarifa) no
// dependa de leer 7 caracteres perfectos. Ver flota.js para la regla y el dato.
var FLOTA = (typeof resolverMatricula === 'function')
  ? { resolverMatricula: resolverMatricula, FLOTA_TRACTORAS: FLOTA_TRACTORAS }
  : require('./flota.js');

// Resuelve una matricula leida contra el padron. Devuelve la canonica si el
// padron la identifica sin ambiguedad; si no, la leida normalizada (no bloquea).
// `notas` (opcional) recoge los motivos para trazabilidad.
function matFlota(x, notas) {
  var r = FLOTA.resolverMatricula(x);
  if (r.motivo && notas) { notas.push(r.motivo); }
  if (r.matricula) { return r.matricula; }
  return r.leida || '';
}

var CRUCE = (typeof clasificarCantidad === 'function')
  ? { clasificarCantidad: clasificarCantidad, regimenIndexacion: regimenIndexacion, repartirKm: repartirKm, esRutaMultiviaje: esRutaMultiviaje, RUTAS_MULTIVIAJE: RUTAS_MULTIVIAJE, CLIENTES_CONOCIDOS: CLIENTES_CONOCIDOS }
  : require('./cruce.js');

var MODIDX = (typeof modalidadDeViaje === 'function')
  ? { modalidadDeViaje: modalidadDeViaje }
  : require('./modalidad-indexacion.js');

var ODO = (typeof encadenarPorTractora === 'function')
  ? { encadenarPorTractora: encadenarPorTractora, filasUltimoOdometro: filasUltimoOdometro }
  : require('./odometro.js');

// Resolvedor de material (conjunto cerrado Gesruta): se usa como GUARDA para no
// pegar un documento de un producto a un viaje de otro producto. Ver el uso.
// Normalizacion fuerte para comparar LUGARES entre si (mayusculas, sin acentos
// ni puntuacion). Se usa en la guarda "origen != destino".
function norm2(x) {
  return (x === null || x === undefined ? '' : String(x))
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

var MATIDX = (typeof resolverMaterial === 'function')
  ? { resolverMaterial: resolverMaterial }
  : require('../catalogo/gesruta.js');

// Fuente legible de un dato para el audit trail (§4): que papel/pagina lo aporto.
var fuenteDoc = function (d) { return d ? ('documento:' + (nz(d.tipo_doc) || 'doc') + ':pag' + (d.pagina || '?')) : null; };

/**
 * Correlaciona la pasada de fichas (rA) con la de documentos (rB).
 *
 * @param {object|null} rA JSON de la pasada de fichas   ({hojas:[...]}).
 * @param {object|null} rB JSON de la pasada de documentos ({documentos:[...]}).
 * @param {object} [opts] {rutas, clientes, modalidadIndexacion, ultimosOdometros}.
 * @returns {{ok:boolean, hojas:Array, viajes:Array, documentos:Array,
 *            errores:Array, avisos:Array}}
 */
function correlacionar(rA, rB, opts) {
  const rutas = (opts && opts.rutas) ? opts.rutas : CRUCE.RUTAS_MULTIVIAJE;
  const clientes = (opts && opts.clientes) ? opts.clientes : CRUCE.CLIENTES_CONOCIDOS;
  // Mapa cliente -> modalidad de indexacion deducida del historico de Gesruta
  // (ficha/modalidad-indexacion.js). Opcional: sin el, el regimen cae a las
  // reglas de ruta de cruce.js, que es el comportamiento anterior.
  const mapaModalidad = (opts && opts.modalidadIndexacion) ? opts.modalidadIndexacion : null;
  // Ultimo odometro conocido de cada tractora, leido de la tabla Viajes
  // (ficha/odometro.js:ultimosOdometros). Sin el, el primer viaje de cada ficha
  // queda sin km vacios: falta el dato de donde venia el camion.
  const ultimosOdo = (opts && opts.ultimosOdometros) ? opts.ultimosOdometros : null;
  // Se completa al final; se devuelve para que el nodo lo persista.
  let ultimoOdometroPorTractora = [];
  if (!rA) {
    logError('la pasada de FICHAS no devolvio JSON valido');
    return { ok: false, hojas: [], viajes: [], documentos: [], errores: [], avisos: [] };
  }
  const hojasRaw = Array.isArray(rA.hojas) ? rA.hojas : [];
  const docsRaw = (rB && Array.isArray(rB.documentos)) ? rB.documentos : [];

  const errores = []; const avisos = [];
  const ANIO_HOY = new Date().getFullYear();

  // Marca la fila i para revision humana y registra el motivo, ademas de dejar
  // el mensaje en la lista global (que es lo que ya lee la oficina).
  const marcar = function (v, motivo) { v.motivos_revision.push(motivo); };

  // ---- Viajes desde las fichas ----
  // `let` (no const): la expansion multi-viaje (Fase 2) reasigna el array.
  let viajes = [];
  for (let h = 0; h < hojasRaw.length; h++) {
    const H = hojasRaw[h];
    const bloques = Array.isArray(H.bloques) ? H.bloques : [];
    for (let i = 0; i < bloques.length; i++) {
      const b = bloques[i];
      // Modelo albaran=unidad (§1): `cantidad` de la ficha puede ser kg o numero
      // de viajes. Discriminacion determinista (cruce.js), con lo que DECLARA la
      // ficha (nombre y lugares del bloque): ruta registrada -> viajes; valor <100
      // en ruta no registrada -> REVISAR (red de seguridad); si no -> kg.
      const clz = CRUCE.clasificarCantidad(num(b.cantidad_kg), nz(b.nombre_carga), nz(b.lugar_carga), nz(b.lugar_descarga), rutas);
      viajes.push({
        hoja_idx: h, orden: num(b.orden) || (i + 1),
        conductor: nz(H.conductor), tractora: nz(H.tractora), remolque: nz(H.remolque), empresa: nz(H.empresa),
        // La matricula de la ficha pasa por el padron de flota: una lectura con
        // 1-3 caracteres mal se resuelve a la matricula real (y si queda ambigua
        // entre dos de la flota, se deja la leida y se marca aparte).
        tractoraN: matFlota(H.tractora),
        pagina_origen: (typeof H.pagina === 'number' && isFinite(H.pagina)) ? H.pagina : null,
        fecha_carga: nz(b.fecha_carga), fecha_carga_texto: nz(b.fecha_carga_texto), fecha_descarga: nz(b.fecha_descarga),
        nombre_carga: nz(b.nombre_carga), lugar_carga: nz(b.lugar_carga),
        nombre_descarga: nz(b.nombre_descarga), lugar_descarga: nz(b.lugar_descarga),
        tipo_mercancia: nz(b.tipo_mercancia),
        // En modo kg, `cantidad_kg` = lo leido (identico a v3.2). En viajes/REVISAR
        // NO es un peso, asi que queda null: nunca se factura un "6 kg" espurio.
        cantidad_kg: (clz.modo === 'kg') ? clz.kg : null,
        cantidad_declarada: num(b.cantidad_kg),
        modo_cantidad: clz.modo,
        es_multiviaje: (clz.modo === 'viajes'),
        n_viajes_declarado: clz.n_viajes,
        km_inicio: num(b.km_inicio), km_final: num(b.km_final), km_recorridos: num(b.km_recorridos),
        origen_km: 'leido',
        regimen_indexacion: null,
        estado: null, pendiente_falta: null, pendiente_reclamar_a: null,
        origen_campos: {},
        motivos_revision: [],
        docs: [],
        // Documentos que matchean la matricula pero NO se pudieron atar a ESTA
        // pata del dia (mismo camion, varios viajes): quedan aparte, no definen
        // la carga del viaje. Ver el match documento->viaje mas abajo.
        docs_ambiguos: []
      });
      // Red de seguridad §1: valor demasiado chico para ser kg en una ruta que no
      // esta registrada como multiviaje -> a REVISAR, visible en el tablero, en vez
      // de meter "N kg" en silencio. Cuando se confirme la ruta se agrega a la lista.
      if (clz.motivo === 'posible_multiviaje_ruta_no_registrada') {
        const vLast = viajes[viajes.length - 1];
        marcar(vLast, 'posible_multiviaje_ruta_no_registrada: cantidad ' + num(b.cantidad_kg) + ' < 100; ni kg valido ni ruta multiviaje registrada');
        errores.push('Viaje ' + viajes.length + ': cantidad ' + num(b.cantidad_kg) + ' demasiado baja para kg y ruta (' + (nz(b.nombre_carga) || '?') + ' ' + (nz(b.lugar_carga) || '?') + '->' + (nz(b.lugar_descarga) || '?') + ') no registrada en RUTAS_MULTIVIAJE. REVISAR (posible_multiviaje_ruta_no_registrada).');
      }
    }
  }
  if (viajes.length === 0) { errores.push('No se detecto ninguna ficha de chofer con bloques rellenos.'); }

  // ---- GUARDA A: ano fuera de rango (mala lectura del ano en el manuscrito) ----
  // Se aplica ANTES del match porque la fecha se usa para desempatar documentos.
  for (let i = 0; i < viajes.length; i++) {
    const v = viajes[i];
    if (!v.fecha_carga) { continue; }
    const y = Number(String(v.fecha_carga).slice(0, 4));
    if (isFinite(y) && (y < ANIO_HOY - 1 || y > ANIO_HOY + 1)) {
      errores.push('Viaje ' + (i + 1) + ': fecha ' + v.fecha_carga + ' (ano ' + y + ') fuera del rango razonable. Ano mal leido; se anula la fecha. En la ficha dice: "' + (v.fecha_carga_texto || 'ilegible') + '".');
      marcar(v, 'ano ' + y + ' fuera de rango; fecha anulada');
      v.fecha_carga = null;
      v.fecha_descarga = null;
    }
  }

  // ---- Trazabilidad del padron de flota (§ matricula) ----
  // Si la matricula de la ficha NO se leyo tal cual y el padron la resolvio (o la
  // dejo ambigua), el viaje va a REVISAR con el motivo. Cambiar una matricula
  // decide a que viaje se pegan los documentos y, aguas abajo, que se factura:
  // nunca puede pasar en silencio, por mas confiable que sea el cruce.
  for (const vf of viajes) {
    const rf = FLOTA.resolverMatricula(vf.tractora);
    if (rf.metodo === 'exacta' || rf.metodo === 'ilegible') { continue; }
    if (rf.motivo) { marcar(vf, rf.motivo); }
  }

  // ---- Reconciliacion de matricula de ficha mal leida (asimetrica + convergencia) ----
  // Corrige la matricula de la ficha ANTES del match cuando los documentos impresos
  // convergen en una matricula a distancia <= MATRICULA_DIST_MAX de una UNICA ficha
  // (el documento manda sobre la ficha manuscrita). Los casos inseguros (no
  // convergen / candidato no unico / distancia mayor) quedan sin correlacionar, con
  // motivo_revision explicito. Ver reconciliarMatriculaFicha.
  reconciliarMatriculaFicha(viajes, docsRaw, marcar);

  // ---- Match documento -> viaje (N docs : 1 viaje) ----
  //
  // ROBUSTEZ ANTE LECTURA SUCIA DEL DOCUMENTO (ejec. 967). La vision devuelve
  // seguido: matricula null (el campo viene como "Vehiculo tractor: ES 0332LPL" y
  // no la extrae), matricula sin el cero inicial ("332LPL"), y el ANO mal (2020 en
  // vez de 2026, lo que inutiliza el desempate por fecha). El match no puede
  // depender de que esos tres campos vengan perfectos, PERO tampoco puede prestarle
  // la carga de un viaje a otro. Estrategia: ampliar como se ENCUENTRA el camion
  // (tolerancia de matricula; envio de un solo camion) y agregar desempates que no
  // dependen de la fecha (kg, emisor vs nombre_carga, destino vs nombre_descarga).
  const docsHuerfanos = [];
  const matsFicha = {};
  for (const v of viajes) { if (v.tractoraN) { matsFicha[v.tractoraN] = true; } }
  const listaMatsFicha = Object.keys(matsFicha);
  // Comparacion laxa de nombres propios (emisor/destino del documento vs lo que
  // escribio el chofer). Señal SECUNDARIA: solo DESEMPATA entre viajes del mismo
  // camion; nunca ata un documento a un camion que no es el suyo.
  const txtN = function (x) { return upp(nz(x) || '').replace(/[^A-Z0-9]/g, ''); };
  // Comparacion laxa de nombres propios. Se usa para desempatar documentos y para
  // detectar que un "lugar" es en realidad la razon social del emisor.
  const pareceMismo = function (a, b) {
    const A = txtN(a), B = txtN(b);
    if (!A || !B || A.length < 3 || B.length < 3) { return false; }
    return A === B || A.indexOf(B) >= 0 || B.indexOf(A) >= 0;
  };
  for (const d of docsRaw) {
    if (d.duplicado_de) { continue; }
    const dm = matFlota(d.matricula_tractor);
    const df = nz(d.fecha);
    const et = 'pag ' + (d.pagina || '?') + ' ' + (nz(d.referencia) || 'sin ref');
    let cands = [];
    // PRINCIPIO DEL ENVIO (encargo Julio 2026-08-26): cuando el envio tiene UN
    // SOLO camion (una sola matricula de ficha), TODO documento del envio es de
    // ese camion — vino en el mismo sobre escaneado que la ficha. La matricula del
    // documento solo sirve para CORROBORAR, nunca para descartar. Esto rescata el
    // caso real (ejec 1018): GPT leyo la matricula de 8 documentos como "5135LNN"
    // (real 5713LMN), y el codigo los tiraba a todos aunque eran del unico camion
    // del envio, dejando 2 viajes sin documentacion. La matricula sigue usandose
    // abajo para elegir A QUE VIAJE va cada doc; aca solo decide si PERTENECE.
    if (listaMatsFicha.length === 1) {
      cands = viajes.filter(function (v) { return v.tractoraN === listaMatsFicha[0]; });
      // Si el documento trae matricula y NO corrobora al unico camion, se asigna
      // igual pero se avisa (puede ser un doc traspapelado de otro envio; el
      // humano lo verifica). No se descarta: perder la carga es peor.
      if (dm && dm !== listaMatsFicha[0] && distanciaEdicion(dm, listaMatsFicha[0]) > MATRICULA_DIST_MAX) {
        avisos.push('Documento ' + et + ': su matricula (' + (nz(d.matricula_tractor) || dm) + ') no coincide con el unico camion del envio (' + listaMatsFicha[0] + '); se asigna a ese camion igual (mismo sobre) y se marca para verificar.');
        d._mat_no_corrobora = true;
      }
    } else if (dm) {
      cands = viajes.filter(function (v) { return v.tractoraN && v.tractoraN === dm; });
      if (cands.length === 0) {
        // Tolerancia: el documento perdio un caracter al leerse ("332LPL" por
        // "0332LPL"). Solo si queda UNA matricula de ficha a distancia <= umbral.
        const cercanas = listaMatsFicha.filter(function (fm) { return distanciaEdicion(fm, dm) <= MATRICULA_DIST_MAX; });
        if (cercanas.length === 1) {
          cands = viajes.filter(function (v) { return v.tractoraN === cercanas[0]; });
          avisos.push('Documento ' + et + ': matricula leida ' + d.matricula_tractor + ' se asocia a ' + cercanas[0] + ' (distancia ' + MATRICULA_DIST_MAX + ', unica ficha candidata) — verificar que sea el mismo camion.');
        } else {
          docsHuerfanos.push({ d: d, motivo: 'matricula ' + d.matricula_tractor + ' no corresponde a ninguna ficha de este envio (hay ' + listaMatsFicha.length + ' camiones, no se puede asignar sin matricula fiable)' });
          continue;
        }
      }
    } else {
      // Multi-camion Y el doc no tiene matricula legible: no se puede saber de cual
      // es. Queda huerfano para revision (no se le presta a un camion al azar).
      docsHuerfanos.push({ d: d, motivo: 'sin matricula de tractor legible y el envio tiene ' + listaMatsFicha.length + ' camiones' });
      continue;
    }
    // GUARDA DE MATERIAL (bug real ejec 1024): un documento de un producto NO
    // puede pegarse a un viaje de OTRO producto. Los CMR/guia de SOSA se pegaban
    // al viaje de ACIDO SULFURICO porque el desempate por destino matcheaba "RNM"
    // (el cliente, comun a los dos). El material los separa de raiz: SOSA (51) no
    // es ACIDO SULFURICO (20). Solo descarta cuando AMBOS materiales resuelven a
    // codigo Gesruta y DIFIEREN; si alguno no resuelve, no se descarta (nunca se
    // inventa un rechazo). Y si el filtro dejaria cands vacio, se conserva: el doc
    // no es de ningun producto de la ficha y cae a ambiguo/huerfano por su via.
    if (cands.length > 1 && MATIDX.resolverMaterial) {
      const dMat = MATIDX.resolverMaterial(d.material);
      if (dMat && dMat.codigo) {
        const compat = cands.filter(function (v) {
          const vMat = MATIDX.resolverMaterial(v.tipo_mercancia);
          return !(vMat && vMat.codigo) || vMat.codigo === dMat.codigo;
        });
        if (compat.length > 0 && compat.length < cands.length) { cands = compat; }
      }
    }
    if (cands.length > 1 && df) {
      const enVentana = cands.filter(function (v) {
        const ini = v.fecha_carga; const fin = v.fecha_descarga || v.fecha_carga;
        if (!ini && !fin) { return true; }
        const antes = ini ? dias(ini, df) : 1;
        const despues = fin ? dias(df, fin) : 1;
        return antes >= -1 && despues >= -1;
      });
      if (enVentana.length > 0) { cands = enVentana; }
    }
    // DESEMPATE POR FECHA EXACTA (bug real ejec 1024): dos viajes del MISMO
    // producto y camion en dias contiguos caen los dos en la ventana ±1 y no se
    // separan. Pero la fecha del documento suele coincidir EXACTO con la carga o
    // la descarga de UN solo viaje (la guia del 20/08 es del viaje que carga el
    // 20/08). Es señal fuerte, no fragil: se usa solo si deja UN candidato.
    if (cands.length > 1 && df) {
      const exactos = cands.filter(function (v) { return v.fecha_carga === df || v.fecha_descarga === df; });
      if (exactos.length === 1) { cands = exactos; }
    }
    if (cands.length > 1) {
      const dk = num(d.kg_neto);
      if (dk) {
        let best = null; let bd = null;
        for (const v of cands) { if (v.cantidad_kg) { const diff = Math.abs(v.cantidad_kg - dk); if (bd === null || diff < bd) { bd = diff; best = v; } } }
        if (best && bd !== null && bd <= 1500) { cands = [best]; }
      }
    }
    if (cands.length > 1) {
      // Desempate por EMISOR del documento vs NOMBRE DE CARGA de la ficha (lo que
      // escribio el chofer: "Foresa", "Tepsa"). No depende de la fecha ni del kg,
      // que son justo los campos que la vision trae sucios.
      const porEmisor = cands.filter(function (v) {
        return pareceMismo(d.emisor, v.nombre_carga) || pareceMismo(d.cliente_probable, v.nombre_carga);
      });
      if (porEmisor.length === 1) { cands = porEmisor; }
    }
    if (cands.length > 1) {
      // Desempate por DESTINO del documento vs nombre/lugar de descarga de la ficha.
      const porDestino = cands.filter(function (v) {
        return pareceMismo(d.destino, v.nombre_descarga) || pareceMismo(d.destino, v.lugar_descarga);
      });
      if (porDestino.length === 1) { cands = porDestino; }
    }
    if (cands.length > 1) {
      // No se pudo desambiguar (mismo camion, varias patas el mismo dia; ni la
      // fecha ni el kg separan). NO se le presta la carga a ningun viaje: un
      // documento de la pata B no puede definir material/origen/destino de la
      // pata A (fue el bug real -- un CMR de acido sulfurico contaminaba una
      // pata de sosa). Queda adjunto APARTE, para traza y para que un humano lo
      // asigne; el viaje conserva lo que dice su ficha y, si no tiene doc propio,
      // queda PENDIENTE_DOCUMENTACION (honesto), no facturado con datos de otro.
      d.ambiguo = true;
      cands.sort(function (a, b) { return a.docs.length - b.docs.length; });
      cands[0].docs_ambiguos.push(d);
      avisos.push('Documento ' + et + ' matchea ' + cands.length + ' viajes de ' + (nz(d.matricula_tractor) || listaMatsFicha[0] || 'este envio') + ' y no se pudo desambiguar (fecha/kg/emisor/destino). NO se le asigna la carga a ningun viaje; queda adjunto al bloque ' + cands[0].orden + ' para revision humana.');
      continue;
    }
    cands[0].docs.push(d);
  }

  // ---- Consolidacion por viaje ----
  for (let i = 0; i < viajes.length; i++) {
    const v = viajes[i];
    const pick = function (tipos, campo) {
      for (const t of tipos) { for (const d of v.docs) { if ((d.tipo_doc || '') === t && nz(d[campo]) !== null) { return d; } } }
      for (const d of v.docs) { if (nz(d[campo]) !== null) { return d; } }
      return null;
    };
    // ---- CAMBIO 3: cliente facturable = EMISOR de la orden/documento de transporte ----
    // NUNCA el lugar de carga (nombre_carga de la ficha). El `emisor` del documento
    // de transporte (orden primero, luego CMR/albaran) identifica al cliente
    // facturable; cliente_probable (guess del modelo) queda de respaldo. Si no hay
    // emisor ni cliente_probable, `cliente` queda null -> REVISAR (fail-loud), sin
    // inventar cliente desde el lugar de carga.
    // ANALISIS (encargo Julio 2026-08-25): el CMR y la carta de porte declaran al
    // DUEÑO DE LA MERCANCIA ("Remitente", "Mercancia por cuenta de"), que no es
    // necesariamente quien CONTRATA el transporte. De ahi salio CELLMARK (dueño
    // sueco de la carga) como cliente de un viaje que habia encargado RNM por
    // mail. Quien contrata lo dice el documento de ENCARGO: orden de transporte,
    // orden de carga o el mail con el pedido. Esos tipos van PRIMERO; el CMR y el
    // albaran quedan como respaldo cuando no hay documento de encargo.
    const TIPOS_EMISOR_CLIENTE = ['orden_transporte', 'orden_carga', 'mail', 'albaran', 'cmr', 'carta_porte', 'guia'];
    let clienteEmisor = null;
    let clienteTipoDoc = null;
    for (const t of TIPOS_EMISOR_CLIENTE) {
      for (const d of v.docs) {
        if ((d.tipo_doc || '') !== t) { continue; }
        // cliente_probable del documento de encargo gana sobre su emisor: en el
        // mail de pedido el emisor es la persona y cliente_probable la empresa.
        const cand = nz(d.cliente_probable) || nz(d.emisor);
        if (cand) { clienteEmisor = upp(cand); clienteTipoDoc = t; break; }
      }
      if (clienteEmisor) { break; }
    }
    const votos = {};
    for (const d of v.docs) { const c = nz(d.cliente_probable); if (c) { votos[upp(c)] = (votos[upp(c)] || 0) + 1; } }
    let clienteProbable = null; let mx = 0;
    for (const k of Object.keys(votos)) { if (votos[k] > mx) { mx = votos[k]; clienteProbable = k; } }
    const cliente = clienteEmisor || clienteProbable || null;
    v.cliente = cliente;
    const clienteFuente = clienteEmisor ? 'documento:emisor' : (clienteProbable ? 'documento:cliente_probable' : null);
    const esForesa = cliente ? (cliente.indexOf('FORESA') >= 0 || cliente.indexOf('BRESFOR') >= 0) : false;
    const dRef = pick(esForesa ? ['albaran', 'cmr'] : ['orden_transporte', 'orden_carga', 'guia', 'cmr', 'carta_porte', 'albaran'], 'referencia');
    v.referencia = dRef ? nz(dRef.referencia) : null;
    v.tipo_doc = dRef ? nz(dRef.tipo_doc) : null;
    v.fecha_documento = dRef ? nz(dRef.fecha) : null;
    // ---- CAMBIO 2 (§4, D-01): peso facturable — precedencia ORIGEN > DESTINO ----
    // Dos reglas encadenadas:
    //  (a) El kg SIEMPRE sale del DOCUMENTO de peso, NUNCA de la orden (la orden es
    //      planificacion: kg pedido/nominal, no real). Se EXCLUYE la orden.
    //  (b) Refinamiento §4: cuando hay peso de carga (ORIGEN) y de descarga (DESTINO)
    //      y DIFIEREN, manda el de ORIGEN (CMR/albaran de carga). Precedencia:
    //      origen > descarga > (nunca) orden.
    // La FICHA aporta SOLO EL ROL del documento (¿carga o descarga?), NUNCA el kg:
    // el kg sale del documento. El rol se infiere por heuristica emisor<->ficha
    // (el emisor del doc de peso se compara con nombre_carga=cargador y
    // nombre_descarga=receptor de la ficha):
    //      emisor ~ carga   (y no descarga) -> ORIGEN
    //      emisor ~ descarga (y no carga)   -> DESTINO
    //      ambos / ninguno                  -> INCIERTO
    // Salvaguarda dura (P2): NO se factura el peso de un documento de rol incierto
    // cuando eso obligaria a ADIVINAR entre pesos que difieren -> REVISAR. Si hay un
    // solo peso (o todos coinciden) no hay nada que adivinar: se factura (no se
    // pierde el viaje por un rol que no cambia el importe).
    const esOrden = function (d) { return d && (d.tipo_doc === 'orden_transporte' || d.tipo_doc === 'orden_carga'); };
    const pesos = v.docs.filter(function (d) { return !esOrden(d) && num(d.kg_neto) !== null; });
    const rolPeso = function (d) {
      const em = nz(d.emisor);
      const enCarga = !!(em && coincideNombre(em, v.nombre_carga));
      const enDescarga = !!(em && coincideNombre(em, v.nombre_descarga));
      if (enCarga && !enDescarga) { return 'origen'; }
      if (enDescarga && !enCarga) { return 'destino'; }
      return 'incierto';
    };
    const tiposPref = esForesa ? ['albaran', 'cmr', 'bascula'] : ['cmr', 'carta_porte', 'guia', 'bascula', 'albaran'];
    const elegirPorTipo = function (lista) {
      for (const t of tiposPref) { for (const d of lista) { if ((d.tipo_doc || '') === t) { return d; } } }
      return lista.length ? lista[0] : null;
    };
    const porRol = { origen: [], destino: [], incierto: [] };
    for (const d of pesos) { porRol[rolPeso(d)].push(d); }
    let dKg = null;
    if (porRol.origen.length) {
      dKg = elegirPorTipo(porRol.origen); // §4: el peso de carga manda
      const dDest = elegirPorTipo(porRol.destino);
      if (dDest && Math.abs(num(dDest.kg_neto) - num(dKg.kg_neto)) > PESO_TOL_DIFIEREN_KG) {
        avisos.push('Viaje ' + (i + 1) + ': peso origen ' + num(dKg.kg_neto) + ' kg manda sobre descarga ' + num(dDest.kg_neto) + ' kg (difieren) — §4.');
      }
    } else if (porRol.destino.length) {
      dKg = elegirPorTipo(porRol.destino); // sin origen: la descarga es la mejor fuente disponible
    } else if (porRol.incierto.length) {
      const kgs = porRol.incierto.map(function (d) { return num(d.kg_neto); });
      const spread = Math.max.apply(null, kgs) - Math.min.apply(null, kgs);
      if (porRol.incierto.length > 1 && spread > PESO_TOL_DIFIEREN_KG) {
        // Varios pesos de rol indeterminado que difieren: adivinar cual es el de
        // carga seria facturar a ciegas. No se factura -> el humano decide (§4, P2).
        marcar(v, 'pesos de documentos con rol indeterminado que difieren (' + kgs.join('/') + ' kg): no se factura sin saber cual es el de carga (§4)');
      } else {
        dKg = elegirPorTipo(porRol.incierto); // uno solo, o todos coinciden: sin ambiguedad
      }
    }
    v.kg_documento = dKg ? num(dKg.kg_neto) : null;
    v.fuente_peso = dKg ? nz(dKg.tipo_doc) : null;
    // D-01 fail-loud: si el UNICO kg disponible venia de una orden, no se factura;
    // falta documento de peso -> REVISAR (nunca fallback al kg de la orden).
    if (v.kg_documento === null && v.docs.some(function (d) { return esOrden(d) && num(d.kg_neto) !== null; })) {
      marcar(v, 'solo la orden trae kg; falta documento de peso (albaran/bascula) — no se factura el kg de la orden');
    }
    // ---- LUGARES: autoridad por TIPO de documento, campo por campo ----------
    //
    // ANALISIS (encargo Julio 2026-08-25). Cada tipo de documento es autoridad
    // sobre cosas distintas, y el codigo tomaba origen y destino del MISMO
    // documento elegido por `destino`, con el CMR primero. El CMR es justamente
    // el que peor declara el origen: su recuadro 1 es el REMITENTE (domicilio
    // social), y de ahi salio "CELLMARK AB, SE-001 18967, SUECIA" como origen de
    // una carga hecha en Barcelona. Lo mismo con "FORESA IND. QUIMICAS DEL
    // NOROESTE SA" como origen de una carga en Caldas de Reis.
    //
    // Autoridad real, verificada en los documentos de los clientes (los formatos
    // por cliente son estables):
    //   ORDEN de transporte / orden de carga / mail: dicen literalmente "Lugar de
    //     Carga" y "Destino" / "CARGA EN" y "DESCARGA EN". Son la MEJOR fuente.
    //   Carta de porte: trae "Planta cargadora" (buena) y destinatario.
    //   CMR / albaran: destino fiable (consignatario); ORIGEN dudoso (remitente).
    // Si ninguna fuente da un lugar valido, manda la FICHA (el chofer escribe el
    // pueblo real).
    //
    // GUARDA ESTRUCTURAL: un lugar que coincide con la RAZON SOCIAL del propio
    // emisor del documento no es un lugar, es su domicilio -> se descarta y se
    // sigue bajando en la precedencia. Esto ataca la causa, no el sintoma: sirve
    // para cualquier cliente y cualquier documento futuro, sin listas de empresas.
    const esLugarValido = function (d, valor) {
      const val = nz(valor);
      if (!val) { return false; }
      if (pareceMismo(val, d.emisor)) { return false; }        // domicilio del emisor
      if (pareceMismo(val, d.cliente_probable)) { return false; }
      return true;
    };
    // Devuelve {valor, doc} para poder dejar en el audit trail de QUE papel salio.
    const pickLugar = function (tipos, campo) {
      for (const t of tipos) {
        for (const d of v.docs) {
          if ((d.tipo_doc || '') !== t) { continue; }
          if (esLugarValido(d, d[campo])) { return { valor: nz(d[campo]), doc: d }; }
        }
      }
      for (const d of v.docs) { if (esLugarValido(d, d[campo])) { return { valor: nz(d[campo]), doc: d }; } }
      return { valor: null, doc: null };
    };
    const TIPOS_ORIGEN = ['orden_transporte', 'orden_carga', 'mail', 'carta_porte', 'guia', 'albaran', 'cmr'];
    const TIPOS_DESTINO = ['orden_transporte', 'orden_carga', 'mail', 'cmr', 'carta_porte', 'albaran', 'guia'];
    const rOrigen = pickLugar(TIPOS_ORIGEN, 'origen');
    const rDestino = pickLugar(TIPOS_DESTINO, 'destino');
    v.origen = rOrigen.valor || v.lugar_carga;
    v.destino = rDestino.valor || v.lugar_descarga;
    // GUARDA ORIGEN != DESTINO (bug real ejec 1065). GPT leyo el CMR y puso como
    // ORIGEN el lugar de ENTREGA ("CELLA, TERUEL"), asi que origen y destino
    // quedaron IGUALES y el viaje se guardo como "TERUEL -> TERUEL". Ninguna
    // tarifa existe para una ruta a si misma, y el error es invisible en la tabla.
    // Un viaje nunca carga y descarga en el mismo punto: si el documento dice eso,
    // el documento se leyo mal -> manda la FICHA (el chofer escribio la ruta real)
    // y se marca REVISAR. Si la ficha tampoco los distingue, se anulan los dos:
    // vacio es honesto, "TERUEL -> TERUEL" es un dato falso con pinta de bueno.
    if (v.origen && v.destino && norm2(v.origen) === norm2(v.destino)) {
      const oFicha = nz(v.lugar_carga), dFicha = nz(v.lugar_descarga);
      if (oFicha && dFicha && norm2(oFicha) !== norm2(dFicha)) {
        marcar(v, 'el documento daba el MISMO lugar como origen y destino (' + v.origen + '); se usa la ruta de la ficha (' + oFicha + ' -> ' + dFicha + ')');
        v.origen = oFicha; v.destino = dFicha;
        if (v.origen_campos) { v.origen_campos.origen = 'ficha:lugar_carga'; v.origen_campos.destino = 'ficha:lugar_descarga'; }
      } else {
        marcar(v, 'origen y destino son el mismo lugar (' + v.origen + ') y la ficha no los distingue; se anulan por imposibles');
        v.origen = null; v.destino = null;
      }
    }
    const dMt = pick(['cmr', 'carta_porte', 'albaran', 'guia', 'orden_transporte'], 'material');
    v.material = (dMt && nz(dMt.material)) ? nz(dMt.material) : v.tipo_mercancia;
    const dIm = pick(['orden_carga', 'orden_transporte'], 'importe');
    v.importe_documento = dIm ? num(dIm.importe) : null;
    const dTa = pick(['orden_carga', 'orden_transporte'], 'tarifa_tn');
    v.tarifa_tn_documento = dTa ? num(dTa.tarifa_tn) : null;
    // KM: el calculo lo hace SIEMPRE el sistema; km_recorridos, si existe, es verificacion.
    v.km_cargados = (v.km_inicio !== null && v.km_final !== null) ? (v.km_final - v.km_inicio) : null;
    if (v.km_cargados !== null && v.km_cargados <= 0) {
      errores.push('Viaje ' + (i + 1) + ': km cargados no positivos (' + v.km_inicio + ' -> ' + v.km_final + ').');
      marcar(v, 'km cargados no positivos (' + v.km_inicio + ' -> ' + v.km_final + ')');
      v.km_cargados = null;
    }
    // GUARDA B: multiplo exacto de 500. Un odometro real casi nunca lo es.
    // Cubre las hojas de un solo viaje, donde la guarda de uniformidad no puede disparar.
    if (v.km_cargados !== null && v.km_cargados % 500 === 0) {
      errores.push('Viaje ' + (i + 1) + ': km cargados ' + v.km_cargados + ' es multiplo exacto de 500. Los odometros reales casi nunca lo son; probable invencion. Se anulan.');
      marcar(v, 'km cargados ' + v.km_cargados + ' multiplo exacto de 500; odometros anulados por probable invencion');
      v.km_cargados = null; v.km_inicio = null; v.km_final = null; v.km_recorridos = null;
    }
    if (v.km_recorridos !== null && v.km_cargados !== null && Math.abs(v.km_recorridos - v.km_cargados) > 5) {
      errores.push('Viaje ' + (i + 1) + ': la ficha escribe ' + v.km_recorridos + ' km recorridos pero final-inicio da ' + v.km_cargados + '. Odometro mal leido.');
      marcar(v, 'la ficha escribe ' + v.km_recorridos + ' km recorridos pero final-inicio da ' + v.km_cargados + '; odometro mal leido');
    }
    // Los km VACIOS ya no se calculan aca: encadenar por posicion en el array y
    // por hoja dejaba sin vacios al primer viaje de cada ficha (1 de cada 3) y
    // podia restar los odometros de dos camiones distintos. Ahora se encadena
    // por TRACTORA y arrancando en el ultimo odometro conocido de la tabla, en
    // una sola pasada al final (ver ficha/odometro.js).
    if (v.docs.length === 0) { errores.push('Viaje ' + (i + 1) + ' (' + (v.nombre_carga || 'sin cliente') + ', ' + (v.fecha_carga_texto || v.fecha_carga || 'sin fecha') + '): SIN DOCUMENTACION. No facturable.'); }
    if (!v.fecha_carga) {
      avisos.push('Viaje ' + (i + 1) + ': sin fecha utilizable (en la ficha: "' + (v.fecha_carga_texto || 'ilegible') + '").');
      marcar(v, 'sin fecha utilizable (en la ficha: "' + (v.fecha_carga_texto || 'ilegible') + '")');
    }
    if (v.cantidad_kg !== null && v.kg_documento !== null && Math.abs(v.cantidad_kg - v.kg_documento) > 200) {
      avisos.push('Viaje ' + (i + 1) + ': ficha ' + v.cantidad_kg + ' kg vs documento ' + v.kg_documento + ' kg. Prevalece el documento.');
      marcar(v, 'ficha ' + v.cantidad_kg + ' kg vs documento ' + v.kg_documento + ' kg');
    }
    // --- Fase 2: regimen de indexacion, estado de documentacion y audit ---
    // Regimen (D-03/D-06): SOLO se marca; el calculo se cierra en facturacion (F4).
    // Cierre v1 pieza 1: cliente fuera de CLIENTES_CONOCIDOS (o no leido) NO recibe
    // regimen por defecto -- eso fue el bug real (FORBA, misread de FORESA, se
    // llevo 'linea' en silencio en vez de 'agregada_quincenal'). Ahora falla
    // ruidoso: regimen_indexacion queda null y el viaje va a REVISAR con el valor
    // leido en el motivo, visible sin abrir el escaneo. NO es un alias de FORBA.
    // La modalidad (por linea / por periodo / incluida / sin indexacion) sale del
    // HISTORICO cuando esta cargado: es lo que se le facturo realmente a ese
    // cliente. Sin historico, regimenIndexacion cae a sus reglas de ruta.
    const modIdx = MODIDX.modalidadDeViaje(
      { cliente: v.cliente, codigoCliente: v.codigo_cliente, origen: v.origen, destino: v.destino },
      mapaModalidad
    );
    const ridx = CRUCE.regimenIndexacion(v.cliente, v.origen, v.destino, clientes, modIdx);
    v.regimen_indexacion = ridx.regimen;
    // Fail-loud del cliente: si vino de un emisor pero no se resolvio a un cliente
    // conocido, decirlo con el emisor a la vista (CAMBIO 3), asi el operador sabe
    // que es. Si no habia emisor, se conserva el motivo generico (no leido).
    // Guard: un viaje SIN documento no marca cliente_no_reconocido -- su cliente no
    // se puede resolver sin doc, y eso ya lo cubre el eje PENDIENTE_DOCUMENTACION
    // (no es un problema de LECTURA). Solo se exige cliente cuando hay documento.
    if (ridx.motivo && v.docs.length > 0) { marcar(v, clienteEmisor ? ('emisor ' + clienteEmisor + ' no resuelto a cliente conocido') : ridx.motivo); }
    // Estado de documentacion (§3): un unico estado para lo incompleto, con QUE
    // falta y a QUIEN reclamar. Es un eje distinto del de LECTURA (estado_lectura).
    if (v.docs.length === 0) {
      v.estado = 'PENDIENTE_DOCUMENTACION';
      v.pendiente_falta = 'documentos del viaje (albaran/CMR/carta de porte)';
      v.pendiente_reclamar_a = 'chofer / cliente cargador';
    } else {
      v.estado = 'con_documentacion';
    }
    // Audit trail (§4): de que papel/pagina salio cada campo. kg y referencia
    // vienen del documento (D-01); km, de la ficha; el resto, del que gano el pick.
    v.origen_campos = {
      cliente: clienteFuente,
      referencia: v.referencia ? fuenteDoc(dRef) : null,
      kg_documento: (v.kg_documento !== null) ? fuenteDoc(dKg) : null,
      origen: rOrigen.doc ? fuenteDoc(rOrigen.doc) : (v.lugar_carga ? 'ficha:lugar_carga' : null),
      destino: rDestino.doc ? fuenteDoc(rDestino.doc) : (v.lugar_descarga ? 'ficha:lugar_descarga' : null),
      material: (dMt && nz(dMt.material)) ? fuenteDoc(dMt) : (v.tipo_mercancia ? 'ficha:tipo_mercancia' : null),
      km: (v.km_cargados !== null) ? ('ficha:odometro:' + v.origen_km) : null,
      cantidad_ficha: (v.cantidad_kg !== null) ? 'ficha:cantidad' : null
    };
  }

  // ---- GUARDA C: odometros uniformes dentro de una hoja ----
  for (let h = 0; h < hojasRaw.length; h++) {
    const vs = viajes.filter(function (v) { return v.hoja_idx === h; });
    const kms = vs.map(function (v) { return v.km_cargados; }).filter(function (x) { return x !== null; });
    if (kms.length >= 2) {
      let iguales = true;
      for (const k of kms) { if (k !== kms[0]) { iguales = false; } }
      if (iguales) {
        errores.push('Hoja ' + (h + 1) + ': los ' + kms.length + ' viajes dan exactamente ' + kms[0] + ' km. Odometros probablemente inventados; se anulan.');
        for (const v of vs) {
          marcar(v, 'los ' + kms.length + ' viajes de la hoja dan exactamente ' + kms[0] + ' km; odometros anulados por probable invencion');
          v.km_cargados = null; v.km_inicio = null; v.km_final = null; v.km_recorridos = null;
        }
      }
    }
    const pares = vs.filter(function (v) { return v.cantidad_kg !== null && v.kg_documento !== null; });
    if (pares.length >= 2) {
      let todosIguales = true;
      for (const v of pares) { if (v.cantidad_kg !== v.kg_documento) { todosIguales = false; } }
      if (todosIguales) { avisos.push('Hoja ' + (h + 1) + ': el peso de la ficha coincide EXACTAMENTE con el del documento en todos los viajes. Verificar que no sea copia.'); }
    }
  }
  for (const o of docsHuerfanos) { errores.push('Documento pag ' + (o.d.pagina || '?') + ' (' + (nz(o.d.referencia) || 'sin ref') + ', ' + (nz(o.d.matricula_tractor) || 'sin matricula') + '): ' + o.motivo + '.'); }

  // ---- Fase 2: expansion multi-viaje (bloque = N viajes) ----
  // Un bloque de ruta multiviaje declara N viajes (campo cantidad). Cada viaje
  // real trae SU propio albaran (kg propio, D-01). Se generan N filas: las que
  // tienen albaran quedan consolidadas con su kg; las que faltan quedan
  // PENDIENTE_DOCUMENTACION, VISIBLES para reclamar (§3). Los km del bloque (la
  // jornada completa) se reparten entre los N y se marcan `derivado_de_bloque`.
  // Si el odometro del bloque quedo dudoso, los N heredan REVISAR: no se reparte
  // un numero dudoso y salen N confiables.
  // Estructura confirmada contra dato real (v1.1, exportacion sistema de
  // escritorio, expediente 00050461). Falta cerrar el riesgo de LECTURA: ver
  // ficha/cruce.js y docs/fase2-cierre-y-fase3-bloqueantes.md.
  if (viajes.some(function (v) { return v.es_multiviaje; })) {
    const expandidos = [];
    for (let i = 0; i < viajes.length; i++) {
      const v = viajes[i];
      if (!v.es_multiviaje) { expandidos.push(v); continue; }
      const N = v.n_viajes_declarado;
      const albaranes = v.docs.filter(function (d) { return (d.tipo_doc || '') === 'albaran'; });
      const secundarios = v.docs.filter(function (d) { return (d.tipo_doc || '') !== 'albaran'; });
      const M = albaranes.length;
      if (!N) {
        // Multiviaje pero no se leyo cuantos: no se puede desglosar. Una fila, REVISAR.
        marcar(v, 'bloque multiviaje sin numero de viajes legible; no se pudo desglosar');
        errores.push('Bloque multiviaje (' + (v.cliente || '?') + ' ' + (v.origen || '?') + '->' + (v.destino || '?') + '): no se leyo el numero de viajes en la ficha. No se desgloso.');
        expandidos.push(v);
        continue;
      }
      const nSlots = Math.max(N, M);
      if (M > N) { avisos.push('Bloque multiviaje ' + (v.cliente || '') + ' ' + (v.origen || '') + '->' + (v.destino || '') + ': declara ' + N + ' viajes y llegaron ' + M + ' albaranes; se generan ' + nSlots + '.'); }
      const reparto = CRUCE.repartirKm(v.km_cargados, nSlots); // [] si el bloque no trae km
      const bloqueDudoso = v.motivos_revision.length > 0;
      for (let j = 0; j < nSlots; j++) {
        const alb = (j < M) ? albaranes[j] : null;
        const nv = {
          hoja_idx: v.hoja_idx, orden: v.orden, sub_orden: j + 1,
          conductor: v.conductor, tractora: v.tractora, remolque: v.remolque, empresa: v.empresa, tractoraN: v.tractoraN,
          pagina_origen: v.pagina_origen,
          fecha_carga: v.fecha_carga, fecha_carga_texto: v.fecha_carga_texto, fecha_descarga: v.fecha_descarga,
          nombre_carga: v.nombre_carga, lugar_carga: v.lugar_carga, nombre_descarga: v.nombre_descarga, lugar_descarga: v.lugar_descarga,
          tipo_mercancia: v.tipo_mercancia,
          cantidad_kg: null, cantidad_declarada: v.cantidad_declarada, modo_cantidad: 'viajes',
          es_multiviaje: true, n_viajes_declarado: N,
          cliente: v.cliente, origen: v.origen, destino: v.destino, material: v.material,
          referencia: null, tipo_doc: null, fecha_documento: null,
          kg_documento: null, fuente_peso: null,
          importe_documento: null, tarifa_tn_documento: null,
          km_inicio: null, km_final: null, km_recorridos: null,
          km_cargados: reparto.length ? reparto[j] : null, km_vacios: null,
          origen_km: 'derivado_de_bloque',
          regimen_indexacion: v.regimen_indexacion,
          motivos_revision: bloqueDudoso ? v.motivos_revision.slice() : [],
          docs: alb ? [alb] : [],
          docs_ambiguos: []
        };
        if (alb) {
          // Documento de origen del viaje: kg y referencia de SU albaran (D-01).
          nv.kg_documento = num(alb.kg_neto);
          nv.fuente_peso = nz(alb.tipo_doc);
          nv.referencia = nz(alb.referencia);
          nv.tipo_doc = nz(alb.tipo_doc);
          nv.fecha_documento = nz(alb.fecha);
          nv.estado = 'con_documentacion';
          nv.pendiente_falta = null; nv.pendiente_reclamar_a = null;
        } else {
          nv.estado = 'PENDIENTE_DOCUMENTACION';
          nv.pendiente_falta = 'albaran del viaje ' + (j + 1) + ' de ' + N + ' (multiviaje)';
          nv.pendiente_reclamar_a = 'cliente';
          errores.push('Bloque ' + (v.cliente || '') + ' ' + (v.origen || '') + '->' + (v.destino || '') + ': falta el albaran del viaje ' + (j + 1) + ' de ' + N + '. PENDIENTE_DOCUMENTACION (reclamar al cliente).');
        }
        nv.origen_campos = {
          cliente: v.origen_campos ? v.origen_campos.cliente : null,
          referencia: alb ? fuenteDoc(alb) : null,
          kg_documento: alb ? fuenteDoc(alb) : null,
          origen: v.origen_campos ? v.origen_campos.origen : null,
          destino: v.origen_campos ? v.origen_campos.destino : null,
          material: v.origen_campos ? v.origen_campos.material : null,
          km: (nv.km_cargados !== null) ? 'ficha:odometro:derivado_de_bloque' : null,
          cantidad_ficha: null
        };
        expandidos.push(nv);
      }
      // Secundarios (CMR/ticket) del bloque: sin dato real para asignarlos a un
      // viaje puntual, se anotan a nivel de bloque en vez de perderse en silencio.
      if (secundarios.length > 0) {
        avisos.push('Bloque multiviaje ' + (v.cliente || '') + ': ' + secundarios.length + ' documento(s) no-albaran (CMR/ticket) sin viaje puntual asignado; quedan a nivel de bloque. Revisar.');
      }
    }
    viajes = expandidos;
  }

  // ---- KM VACIOS: una sola pasada, encadenando por TRACTORA ----
  // Va DESPUES de la guarda C (que anula odometros inventados) y DESPUES de la
  // expansion multiviaje, para que la cadena se arme sobre los viajes finales y
  // con los odometros ya depurados. Arranca en el ultimo odometro conocido de
  // cada tractora (opts.ultimosOdometros, leido de la tabla Viajes): sin eso el
  // primer viaje de cada ficha no puede tener vacios, por diseño.
  const cadena = ODO.encadenarPorTractora(viajes, ultimosOdo, marcar);
  for (const a of cadena.avisos) { avisos.push(a); }
  ultimoOdometroPorTractora = ODO.filasUltimoOdometro(cadena.ultimos);
  logInfo('km vacios encadenados=' + cadena.encadenados + '/' + viajes.length +
    ' tractoras con odometro=' + ultimoOdometroPorTractora.length);

  // ---- Estado de lectura por fila ----
  // Cubre la calidad de LECTURA de la ficha. Deliberadamente NO incluye
  // "sin documentacion" (eje aparte, ya cubierto por `estado`) ni la ambiguedad
  // de correlacion documento->viaje (encargo 3).
  let nRevisar = 0;
  for (const v of viajes) {
    v.estado_lectura = v.motivos_revision.length ? ESTADO_LECTURA.REVISAR : ESTADO_LECTURA.OK;
    v.motivo_revision = v.motivos_revision.join('; ');
    if (v.estado_lectura === ESTADO_LECTURA.REVISAR) { nRevisar++; }
  }

  logInfo('fichas=' + hojasRaw.length + ' viajes=' + viajes.length + ' documentos=' + docsRaw.length +
    ' lectura_ok=' + (viajes.length - nRevisar) + ' lectura_revisar=' + nRevisar +
    ' errores=' + errores.length + ' avisos=' + avisos.length);
  if (nRevisar > 0) { logInfo(nRevisar + ' viaje(s) marcados REVISAR: la lectura no es confiable, requieren revision humana.'); }

  return { ok: true, hojas: hojasRaw, viajes: viajes, documentos: docsRaw, errores: errores, avisos: avisos,
    ultimo_odometro_tractora: ultimoOdometroPorTractora };
}

/**
 * Informe legible. Mismo formato que v3.1 mas la linea de estado de lectura por
 * viaje y el conteo en la cabecera.
 */
function renderInforme(res) {
  const hojasRaw = res.hojas; const viajes = res.viajes; const docsRaw = res.documentos;
  const errores = res.errores; const avisos = res.avisos;
  const f = function (x) { return (x === null || x === undefined || x === '') ? '(falta)' : String(x); };
  const nRevisar = viajes.filter(function (v) { return v.estado_lectura === ESTADO_LECTURA.REVISAR; }).length;
  const L = [];
  L.push('======== INGESTA v3 ========');
  L.push('Fichas detectadas: ' + hojasRaw.length + '   Viajes: ' + viajes.length + '   Documentos: ' + docsRaw.length);
  L.push('Lectura: ' + (viajes.length - nRevisar) + ' OK / ' + nRevisar + ' REVISAR');
  if (nRevisar > 0) {
    L.push('  >> ATENCION: ' + nRevisar + ' de ' + viajes.length + ' viajes tienen lectura dudosa.');
    L.push('     No son datos buenos. Requieren revision humana antes de facturar.');
  }
  L.push('');
  for (let h = 0; h < hojasRaw.length; h++) {
    const H = hojasRaw[h];
    L.push('---- FICHA ' + (h + 1) + ' (pag ' + f(H.pagina) + ') ----');
    L.push('CONDUCTOR: ' + f(nz(H.conductor)) + '   TRACTORA: ' + f(nz(H.tractora)) + '   REMOLQUE: ' + f(nz(H.remolque)) + '   EMPRESA: ' + f(nz(H.empresa)));
    const vs = viajes.filter(function (v) { return v.hoja_idx === h; });
    for (const v of vs) {
      const n = viajes.indexOf(v) + 1;
      L.push('  VIAJE ' + n + ' | ' + f(v.cliente) + ' | ' + f(v.fecha_carga || v.fecha_carga_texto));
      L.push('    ' + f(v.origen) + ' -> ' + f(v.destino) + '   ' + f(v.material));
      L.push('    Ref: ' + f(v.referencia) + ' [' + f(v.tipo_doc) + ']   Docs asociados: ' + v.docs.length + (v.docs.length ? ' (pag ' + v.docs.map(function (d) { return d.pagina; }).join(', ') + ')' : ''));
      if (v.docs_ambiguos && v.docs_ambiguos.length) { L.push('    Docs ambiguos (NO asignados, revisar): pag ' + v.docs_ambiguos.map(function (d) { return d.pagina; }).join(', ')); }
      L.push('    Peso ficha: ' + f(v.cantidad_kg) + ' kg | documento: ' + f(v.kg_documento) + ' kg [' + f(v.fuente_peso) + ']');
      L.push('    KM: ' + f(v.km_inicio) + ' -> ' + f(v.km_final) + ' = ' + f(v.km_cargados) + (v.km_recorridos !== null ? '  (ficha: ' + v.km_recorridos + ')' : '  (ficha no lo trae)') + '   vacios: ' + f(v.km_vacios));
      if (v.importe_documento !== null) { L.push('    Importe doc: ' + v.importe_documento + ' EUR'); }
      if (v.tarifa_tn_documento !== null) { L.push('    Tarifa doc: ' + v.tarifa_tn_documento + ' EUR/TN'); }
      L.push('    LECTURA: ' + v.estado_lectura + (v.estado_lectura === ESTADO_LECTURA.REVISAR ? ' -> ' + v.motivo_revision : ''));
    }
    const gs = Array.isArray(H.gastos) ? H.gastos : [];
    L.push('  GASTOS: ' + (gs.length ? gs.map(function (g) { return f(g.tipo) + ' ' + f(g.importe) + ' (' + f(g.forma) + ')'; }).join(' | ') : 'ninguno'));
    if (nz(H.observaciones)) { L.push('  OBS: ' + H.observaciones); }
    L.push('');
  }
  L.push('---- ERRORES (' + errores.length + ') ----');
  if (!errores.length) { L.push('Ninguno.'); } else { for (const e of errores) { L.push('  X ' + e); } }
  L.push('');
  L.push('---- AVISOS (' + avisos.length + ') ----');
  if (!avisos.length) { L.push('Ninguno.'); } else { for (const a of avisos) { L.push('  ! ' + a); } }
  L.push('============================');
  return L.join('\n');
}

/** Parsea un item de respuesta de OpenAI a objeto. */
function parseRespuesta(it) {
  if (!it || !it.json) { return null; }
  const c = (it.json.choices && it.json.choices[0] && it.json.choices[0].message) ? it.json.choices[0].message.content : null;
  if (!c) { return null; }
  try { return JSON.parse(c); } catch (e) { return null; }
}

/**
 * Ensambla las respuestas del modelo (v3.4: loop por pagina) y corre la
 * correlacion. Cada respuesta se empareja POR INDICE con su meta de "Preparar
 * Payload" ($('Preparar Payload').all()), que dice si el item era una pasada de
 * ficha (con su numero de pagina) o la de documentos.
 *
 *   - N respuestas pass:'fichas', cada una {hojas:[0..1]}. Se les inyecta la
 *     `pagina` real (el modelo ve una sola imagen y no la conoce). Se juntan en
 *     un unico rA = {hojas:[...todas...]}, en orden de pagina.
 *   - 1 respuesta pass:'documentos' -> rB = {documentos:[...]}.
 *
 * Perdida de fichas imposible en silencio: si una pasada de ficha devuelve JSON
 * invalido, es un ERROR explicito (no un hueco). Si devuelve hojas:[] es que esa
 * pagina no era una ficha (documento impreso) -> no cuenta como perdida.
 *
 * @param {Array} respuestas  salida de "Extraer GPT-4o" ($input.all()).
 * @param {Array} metas       $('Preparar Payload').all().map(i => i.json).
 * @param {object} [opts]     {rutas, clientes, ultimosOdometros} pasa a correlacionar.
 */
function procesar(respuestas, metas, opts) {
  metas = Array.isArray(metas) ? metas : [];
  const erroresPrevios = [];
  const hojasAll = [];
  let rB = null;
  let paginasFicha = 0;

  for (let i = 0; i < respuestas.length; i++) {
    const meta = metas[i] || {};
    const parsed = parseRespuesta(respuestas[i]);
    if (meta.pass === 'documentos') {
      rB = parsed;
      continue;
    }
    // pass 'fichas' (o desconocido: se trata como ficha, es el default del canal).
    paginasFicha++;
    const pagina = (typeof meta.pagina === 'number' && isFinite(meta.pagina)) ? meta.pagina : (i + 1);
    if (!parsed) {
      // JSON invalido: la ficha de esta pagina NO se leyo. Se hace visible.
      erroresPrevios.push('Pagina ' + pagina + ': el modelo de ficha no devolvio JSON valido; esa ficha NO se leyo (no se pierde en silencio).');
      continue;
    }
    const hojas = Array.isArray(parsed.hojas) ? parsed.hojas : [];
    if (hojas.length === 0) {
      // hojas:[] = esa pagina no era una ficha (documento impreso). No es perdida.
      continue;
    }
    for (let h = 0; h < hojas.length; h++) {
      const hoja = hojas[h];
      hoja.pagina = pagina; // el sistema asigna la pagina real; pisa lo que diga el modelo
      hojasAll.push(hoja);
    }
    if (hojas.length > 1) {
      erroresPrevios.push('Pagina ' + pagina + ': el modelo devolvio ' + hojas.length + ' fichas para una sola imagen; se cargan todas con esta pagina. Revisar.');
    }
  }

  const res = correlacionar({ hojas: hojasAll }, rB, opts);
  if (!res.ok) {
    return { ok: false, linea: 'ERROR: ninguna pasada de FICHAS devolvio JSON valido.', datos_json: '', avisos: 1, errores: 1, lectura_revisar: 0 };
  }

  // Los errores de ensamblado (fichas no leidas) van al frente del informe.
  res.errores = erroresPrevios.concat(res.errores);

  logInfo('loop por pagina: ' + paginasFicha + ' llamada(s) de ficha -> ' +
    hojasAll.length + ' ficha(s) leida(s), ' + res.viajes.length + ' viaje(s); ' +
    erroresPrevios.length + ' fallo(s) de lectura de pagina.');

  // ultimo_odometro_tractora viaja en el datos_json para que el nodo de escritura
  // lo persista. Es el "registro de ultimo KM por tractora" del encargo: se
  // actualiza con cada viaje ingestado, no una vez por ficha.
  const salida = { hojas: res.hojas, viajes: res.viajes, documentos: res.documentos, errores: res.errores, avisos: res.avisos,
    ultimo_odometro_tractora: res.ultimo_odometro_tractora || [] };
  const nRevisar = res.viajes.filter(function (v) { return v.estado_lectura === ESTADO_LECTURA.REVISAR; }).length;
  return {
    ok: true,
    linea: renderInforme(res),
    datos_json: JSON.stringify(salida),
    avisos: res.avisos.length,
    errores: res.errores.length,
    lectura_revisar: nRevisar
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ESTADO_LECTURA: ESTADO_LECTURA, correlacionar: correlacionar, renderInforme: renderInforme, parseRespuesta: parseRespuesta, procesar: procesar, setLogActivo: setLogActivo };
}

// Envoltorio especifico de n8n para el nodo Code "Formatear Linea Gesruta" del
// workflow [ESTEVEZ] Ingesta Viaje — WD0q9Ic0oDvUoJwp.
//
// Solo hace de puente: toma las respuestas de OpenAI (v3.4: N pasadas de ficha,
// una por pagina, + 1 pasada de documentos) y las empareja por indice con las
// metas de "Preparar Payload" (que dicen pass y pagina). Toda la logica vive en
// correlacionar.js. `node ficha/build-nodo.js` pega correlacionar.js delante de
// este archivo y produce el script final del nodo.
//
// KM VACIOS (2026-08-26): se le inyecta el ULTIMO ODOMETRO CONOCIDO de cada
// tractora, leido de la tabla Viajes por el nodo "Leer Viajes Existentes". Sin
// eso el primer viaje de cada ficha no puede tener km vacios (falta el dato de
// donde venia el camion) — era 1 de cada 3 viajes. El nodo lector debe tener
// `Execute Once` y `Always Output Data`: con la tabla vacia debe emitir un item,
// no cero, o este nodo se saltea (ver docs/grafo-ingesta-tarifa.md).

const respuestas = $input.all();
const metas = $('Preparar Payload').all().map(function (it) { return it.json || {}; });

let ultimosOdo = null;
try {
  const filasViajes = $('Leer Viajes Existentes').all().map(function (it) { return it.json || {}; });
  ultimosOdo = ultimosOdometros(filasViajes);
} catch (e) {
  // El nodo lector puede no existir todavia en el grafo. Sin padron la ingesta
  // sigue: los km vacios del primer viaje de cada ficha quedan null con motivo
  // `sin_odometro_previo`, que es exactamente lo que pasaba antes.
  ultimosOdo = null;
}

return [{ json: procesar(respuestas, metas, { ultimosOdometros: ultimosOdo }) }];
