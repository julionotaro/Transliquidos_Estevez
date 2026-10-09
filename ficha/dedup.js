// ===== DEDUPLICACION DE VIAJES (modelo-dominio-lectura.md §5.1) =============
//
// Logica PURA (testeable) del control de idempotencia al ingestar viajes. El
// wrapper del nodo Code "Preparar Filas Viajes" lee los viajes ya existentes de
// la tabla (nodo "Leer Viajes Existentes") y llama a `dedupViajes` antes de
// insertar. NO vive en correlacionar.js: correlacionar solo ve la subida actual;
// la dedup necesita la tabla `viajes` completa.
//
// Llave de identidad (§5.1): `matricula_tractora + km_inicio`. El odometro es
// estrictamente creciente; dos viajes distintos del mismo camion no comparten
// km_inicio. Distingue N viajes del mismo cliente/ruta/dia (rotaciones §7: cada
// rotacion tiene km_inicio distinto -> NO se deduplican entre si).
//
// Comportamiento:
//   - Llave nueva                -> INSERTAR.
//   - Llave ya existe, datos =   -> OMITIR (reingreso identico, duplicado puro).
//   - Llave ya existe, datos !=  -> OMITIR insercion + ACTUALIZAR (aditivo) el
//                                   motivo_revision de la fila existente, sin
//                                   pisar ningun otro dato (el humano pudo haber
//                                   corregido algo ahi). Lo ve en Pendientes.
//   - Misma ruta (matricula+fecha+cliente+origen+destino+material), km_inicio por
//     POCO distinto -> posible mismo viaje con km mal leido: INSERTAR pero marcar
//     REVISAR (no un duplicado encubierto; el humano resuelve).
//
// `UMBRAL_KM_INICIO` (constante nombrada): "por poco". Configurable.

'use strict';

// km de tolerancia para sospechar km_inicio mal leido. PARAMETRO AJUSTABLE: 50
// es el valor de arranque. Ojo con rutas CORTAS y dos vueltas seguidas: dos
// viajes reales del mismo camion/ruta/dia podrian quedar a <50 km entre si y
// caer en la salvaguarda (igual se insertan, solo se marcan REVISAR — no se
// pierde ninguno). Si con dato real eso genera ruido, bajar el umbral aca.
var UMBRAL_KM_INICIO = 50;

// Campos que definen si un reingreso "difiere" del viaje ya guardado.
var CAMPOS_COMPARA = ['fecha', 'cliente', 'origen', 'destino', 'material', 'referencia', 'kg_documento'];
// Firma de "misma ruta" para la salvaguarda de km por poco (§5.1).
var CAMPOS_RUTA = ['fecha', 'cliente', 'origen', 'destino', 'material'];

function matDedup(x) { return (x === null || x === undefined ? '' : String(x)).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function dstr(x) { return (x === null || x === undefined) ? '' : String(x); }
function kmNum(x) { var n = (typeof x === 'number') ? x : Number(x); return isFinite(n) ? n : null; }

function difierenEn(a, b, campos) {
  for (var i = 0; i < campos.length; i++) { if (dstr(a[campos[i]]) !== dstr(b[campos[i]])) { return true; } }
  return false;
}

/**
 * @param {Array<object>} candidatos  viajes de la subida actual (a insertar).
 * @param {Array<object>} existentes  filas ya en la tabla `viajes`.
 * @param {object} [opts] {umbralKm}
 * @returns {{insertar:Array, actualizarMotivo:Array<{id,motivo_revision,estado_lectura}>, omitidos:Array}}
 *   `insertar`: filas a insertar (algunas con _motivo_dedup mergeado por el wrapper).
 *   `actualizarMotivo`: updates ADITIVOS de motivo sobre filas existentes (reingreso con diff).
 *   `omitidos`: reingresos identicos (duplicado puro), no se insertan.
 */
function dedupViajes(candidatos, existentes, opts) {
  var umbral = (opts && typeof opts.umbralKm === 'number') ? opts.umbralKm : UMBRAL_KM_INICIO;
  var cand = Array.isArray(candidatos) ? candidatos : [];
  var exist = Array.isArray(existentes) ? existentes : [];

  // Indexar existentes por matricula normalizada.
  var porTractora = {};
  for (var e = 0; e < exist.length; e++) {
    var t = matDedup(exist[e].tractora);
    if (!t) { continue; }
    if (!porTractora[t]) { porTractora[t] = []; }
    porTractora[t].push(exist[e]);
  }

  var insertar = [], actualizarMotivo = [], omitidos = [];
  var llavesInsertadas = {}; // dedup intra-lote (misma subida trae la misma llave)

  for (var c = 0; c < cand.length; c++) {
    var r = cand[c];
    var t2 = matDedup(r.tractora);
    var km = kmNum(r.km_inicio);

    // Sin llave utilizable (sin matricula o sin km_inicio): no se puede deduplicar
    // -> se inserta (mejor una fila de mas visible que perder un viaje en silencio).
    if (!t2 || km === null) { insertar.push(r); continue; }

    var llave = t2 + '|' + km;
    if (llavesInsertadas[llave]) { omitidos.push(r); continue; } // duplicado dentro del mismo lote

    var mismos = porTractora[t2] || [];

    // 1) Match EXACTO de llave (mismo camion, mismo km_inicio) = reingreso.
    var exacto = null;
    for (var m = 0; m < mismos.length; m++) { if (kmNum(mismos[m].km_inicio) === km) { exacto = mismos[m]; break; } }
    if (exacto) {
      if (difierenEn(r, exacto, CAMPOS_COMPARA)) {
        var motivoBase = dstr(exacto.motivo_revision);
        var motivoReingreso = 'reingreso de viaje ya existente (matricula ' + dstr(r.tractora) + ' km ' + km + '): datos nuevos difieren, verificar';
        actualizarMotivo.push({
          id: exacto.id,
          // ADITIVO: se conserva el motivo previo (y cualquier correccion del humano
          // que lo haya tocado); solo se suma el aviso de reingreso.
          motivo_revision: motivoBase ? (motivoBase + '; ' + motivoReingreso) : motivoReingreso,
          estado_lectura: 'REVISAR'
        });
      } else {
        omitidos.push(r); // reingreso identico: duplicado puro, se omite
      }
      continue;
    }

    // 2) Salvaguarda km mal leido: misma RUTA, km_inicio por poco distinto.
    var cerca = null;
    for (var n = 0; n < mismos.length; n++) {
      var ke = kmNum(mismos[n].km_inicio);
      if (ke === null) { continue; }
      var dist = Math.abs(ke - km);
      if (dist > 0 && dist <= umbral && !difierenEn(r, mismos[n], CAMPOS_RUTA)) { cerca = mismos[n]; break; }
    }
    if (cerca) {
      r._motivo_dedup = 'posible mismo viaje con km_inicio discrepante: ' + km + ' vs ' + kmNum(cerca.km_inicio) + ' — verificar (no duplicar)';
    }
    // Viaje distinto (o sospecha marcada): se inserta.
    llavesInsertadas[llave] = true;
    insertar.push(r);
  }

  return { insertar: insertar, actualizarMotivo: actualizarMotivo, omitidos: omitidos };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UMBRAL_KM_INICIO: UMBRAL_KM_INICIO,
    CAMPOS_COMPARA: CAMPOS_COMPARA,
    dedupViajes: dedupViajes
  };
}
