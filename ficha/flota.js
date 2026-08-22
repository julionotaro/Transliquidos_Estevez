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

// Semilla: tractoras con >= 50 viajes en el export de Gesruta (8.756 viajes).
// Las de uso ocasional (subcontratados, <50) quedan fuera a proposito: meterlas
// acercaria candidatas y generaria ambiguedad sin ganar cobertura real.
var FLOTA_TRACTORAS = [
  '8168JSD', '3729JLH', '9039KDR', '6124HZT', '5132LMC', '8382JJS', '5358KTF',
  '8267JJS', '0332LPL', '6516KTH', '0557JMS', '0275JLC', '8262MNC', '2498KZL',
  '8504KDR', '2256JYX', '8420KKT', '3729JWP', '7347LBB', '2050MZY', '2541HPJ',
  '5820JDK', '8066HZR', '7778KWG', '5713LMN', '4916NJG', '7394LZP', '7585MCG'
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
    ACIERTOS_MINIMOS: ACIERTOS_MINIMOS,
    MARGEN_MINIMO: MARGEN_MINIMO,
    normalizarMatricula: normalizarMatricula,
    aciertosPosicionales: aciertosPosicionales,
    resolverMatricula: resolverMatricula,
  };
}
