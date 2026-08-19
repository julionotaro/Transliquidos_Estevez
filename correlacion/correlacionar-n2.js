// ===== CORRELACION documento<->viaje NIVEL 2 (modelo-dominio-lectura.md §5.2) =
//
// Cascada de correlacion:
//   Nivel 1  -> por `referencia` (la mas fuerte, la emite el cliente).
//   Nivel 2  -> por origen + destino + material + fecha + peso, cuando no hay
//               referencia o para desambiguar dias multi-pata (caso Baltransa:
//               la OC lleva fecha de EMISION, distinta de la del viaje).
//
// Reglas duras:
//   - El km NO correlaciona (no existe en ningun documento de transporte, §5).
//   - Nunca se asigna por fecha sola, ni cliente solo, ni ruta sola: sin
//     origen+destino+material NO hay N2.
//   - Respeta §7 (cardinalidad N:1): un viaje ya correlacionado NO sale del pool
//     si la ruta esta en RUTAS_MULTIVIAJE (rotaciones Foresa metanol).
//
// Logica PURA. Reusa resolver-punto.js (puntos canonicos) y cruce.js
// (RUTAS_MULTIVIAJE), no los duplica.

'use strict';

var RP = (typeof resolverPunto === 'function')
  ? { resolverPunto: resolverPunto }
  : require('../catalogo/resolver-punto.js');
var N2_CRUCE = (typeof esRutaMultiviaje === 'function')
  ? { esRutaMultiviaje: esRutaMultiviaje }
  : require('../ficha/cruce.js');

var VENTANA_OC_DIAS = 2;     // decision de Julio: la OC se emite hasta 2 dias antes
var TOL_PESO = 0.02;         // ±2% para el desempate por peso

function s(x) { return (x === null || x === undefined) ? '' : String(x); }
function n2num(x) { var n = (typeof x === 'number') ? x : Number(x); return isFinite(n) ? n : null; }
function normTxt(x) { return s(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }

// Compatibilidad de material: inclusion en cualquier sentido, sin acentos. No
// matchea vacios (fail-loud: sin material no hay N2).
function materialCompatible(a, b) {
  var na = normTxt(a), nb = normTxt(b);
  if (!na || !nb) { return false; }
  return na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0;
}

// Dias entre dos fechas ISO (b - a). null si alguna no parsea.
function diffDias(a, b) {
  var da = Date.parse(s(a) + 'T00:00:00Z'), db = Date.parse(s(b) + 'T00:00:00Z');
  if (!isFinite(da) || !isFinite(db)) { return null; }
  return Math.round((db - da) / 86400000);
}

/**
 * Clasificador BINARIO de documento (CAMBIO 1): orden vs documento de transporte.
 * La ventana temporal depende de esto. Usa tipo_doc ya extraido; si no alcanza,
 * busca marcadores en el encabezado. Sin señal -> 'desconocido' (ventana ancha,
 * comportamiento seguro).
 * @returns {'orden'|'transporte'|'desconocido'}
 */
function clasificarDocumento(doc) {
  var tipo = normTxt(doc && doc.tipo_doc);
  if (tipo === 'ORDEN_TRANSPORTE' || tipo === 'ORDEN_CARGA' || tipo === 'ORDEN') { return 'orden'; }
  if (tipo === 'CMR' || tipo === 'ALBARAN' || tipo === 'CARTA_PORTE' || tipo === 'BASCULA') { return 'transporte'; }
  var cab = normTxt((doc && (doc.encabezado || doc.texto || doc.titulo)) || '');
  if (cab.indexOf('ORDEN DE TRANSPORTE') >= 0 || cab.indexOf('ORDEN DE CARGA') >= 0) { return 'orden'; }
  if (cab.indexOf('CMR') >= 0 || cab.indexOf('ALBARAN') >= 0 || cab.indexOf('CARTA DE PORTE') >= 0 || cab.indexOf('TICKET DE BASCULA') >= 0) { return 'transporte'; }
  return 'desconocido';
}

// Ventana temporal segun clase (asimetrica: la orden se emite ANTES del viaje).
function ventana(clase, opts) {
  var vo = (opts && typeof opts.ventanaOcDias === 'number') ? opts.ventanaOcDias : VENTANA_OC_DIAS;
  if (clase === 'orden') { return { antes: 0, despues: vo }; }        // solo hacia adelante
  if (clase === 'transporte') { return { antes: 1, despues: 1 }; }    // contemporaneo
  return { antes: 1, despues: 2 };                                    // desconocido: ancha
}
function dentroVentana(fechaDoc, fechaViaje, clase, opts) {
  var d = diffDias(fechaDoc, fechaViaje);
  if (d === null) { return false; }
  var v = ventana(clase, opts);
  return d >= -v.antes && d <= v.despues;
}

function idCanon(literal, catalogo) {
  var r = RP.resolverPunto(literal, 'documento', catalogo);
  return r.id_punto || null;
}

/**
 * Correlaciona UN documento contra un pool de viajes candidatos.
 * @returns {{correlacion, viaje, confianza, revisar, motivo, candidatos}}
 *   correlacion: 'N1' | 'N2' | 'sin_correlacion'
 */
function correlacionarN2(doc, viajes, catalogo, opts) {
  opts = opts || {};
  var lista = Array.isArray(viajes) ? viajes : [];

  // ---- Nivel 1: referencia ----
  var ref = normTxt(doc && doc.referencia);
  if (ref) {
    for (var i = 0; i < lista.length; i++) {
      if (normTxt(lista[i].referencia) === ref) {
        return { correlacion: 'N1', viaje: lista[i], confianza: 'alta', revisar: false, motivo: '', candidatos: [lista[i]] };
      }
    }
  }

  // ---- Nivel 2: origen + destino + material + fecha + peso ----
  var clase = clasificarDocumento(doc);
  var oDoc = idCanon(doc && doc.origen, catalogo);
  var dDoc = idCanon(doc && doc.destino, catalogo);
  if (!oDoc || !dDoc) {
    return { correlacion: 'sin_correlacion', viaje: null, confianza: 'ninguna', revisar: true,
      motivo: 'N2 imposible: documento sin origen/destino resoluble (origen="' + s(doc && doc.origen) + '", destino="' + s(doc && doc.destino) + '")', candidatos: [] };
  }
  var matDoc = doc && doc.material;

  // Requisitos duros: mismo origen_canonico + destino_canonico + material compatible.
  var compat = lista.filter(function (v) {
    return idCanon(v.origen, catalogo) === oDoc &&
           idCanon(v.destino, catalogo) === dDoc &&
           materialCompatible(matDoc, v.material);
  });
  // Señal de desempate 1: ventana temporal (por tipo de documento).
  var enVentana = compat.filter(function (v) { return dentroVentana(doc && doc.fecha, v.fecha_carga || v.fecha, clase, opts); });

  if (enVentana.length === 0) {
    return { correlacion: 'sin_correlacion', viaje: null, confianza: 'ninguna', revisar: true,
      motivo: '0 viajes compatibles por ruta+material+fecha (' + oDoc + '->' + dDoc + ', ' + clase + ')', candidatos: [] };
  }
  if (enVentana.length === 1) {
    return { correlacion: 'N2', viaje: enVentana[0], confianza: 'media', revisar: false,
      motivo: 'N2 por ruta+material+fecha (' + oDoc + '->' + dDoc + ')', candidatos: enVentana };
  }

  // Señal de desempate 2: peso ±2% (sobre el kg del documento).
  var kgDoc = n2num(doc && doc.kg_neto);
  if (kgDoc) {
    var porPeso = enVentana.filter(function (v) {
      var kv = n2num(v.kg_documento) !== null ? n2num(v.kg_documento) : n2num(v.cantidad_kg);
      return kv !== null && Math.abs(kv - kgDoc) <= kgDoc * TOL_PESO;
    });
    if (porPeso.length === 1) {
      return { correlacion: 'N2', viaje: porPeso[0], confianza: 'media', revisar: false,
        motivo: 'N2 desempatado por peso (±2%)', candidatos: enVentana };
    }
  }

  // >1 y no se pudo desempatar -> REVISAR listando los candidatos (no adivinar).
  var multiv = N2_CRUCE.esRutaMultiviaje(doc && doc.cliente, doc && doc.origen, doc && doc.destino) ? ' [ruta multiviaje §7: pueden ser rotaciones]' : '';
  var lst = enVentana.map(function (v) { return (v.referencia || v.id || '?') + ' (' + s(v.fecha_carga || v.fecha) + ')'; }).join('; ');
  return { correlacion: 'sin_correlacion', viaje: null, confianza: 'ninguna', revisar: true,
    motivo: enVentana.length + ' candidatos compatibles, no se puede desambiguar: ' + lst + multiv, candidatos: enVentana };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VENTANA_OC_DIAS: VENTANA_OC_DIAS,
    clasificarDocumento: clasificarDocumento,
    dentroVentana: dentroVentana,
    materialCompatible: materialCompatible,
    correlacionarN2: correlacionarN2
  };
}
