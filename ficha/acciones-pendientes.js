// ===== ACCIONES DE CORRECCION SOBRE PENDIENTES (v1.1, pieza 1) =============
//
// Tres acciones por viaje, todas EN la vista de pendientes (no por email,
// Telegram ni formulario suelto): la correccion queda conectada a la base y
// es trazable, y eso importa cuando una factura se discute con un cliente.
//
//   corregir   — edita un campo mal leido. Re-evalua regimen_indexacion y
//                estado_lectura si el campo es uno de los que alimentan D-06.
//   resolver   — la documentacion llego por otra via; saca el viaje de
//                PENDIENTE_DOCUMENTACION sin tocar ningun otro campo.
//   incidencia — nota libre. NO saca el viaje de la lista.
//
// Toda accion queda en `historial_correcciones` (columna JSON en Viajes,
// APPEND -- nunca sobrescribe): {accion, usuario, fecha, campo, valor_anterior,
// valor_nuevo}. Sin esto la correccion no es auditable.
//
// CAMPOS_CORREGIBLES arranca solo con 'cliente' (el unico caso pedido y
// probado: FORBA->FORESA). Arquitectura generica para sumar mas despues, pero
// la re-evaluacion de regimen/estado_lectura solo tiene sentido hoy para
// cliente/origen/destino (los que alimenta CRUCE.regimenIndexacion).

'use strict';

var CRUCE_ACC = (typeof clasificarCantidad === 'function')
  ? { regimenIndexacion: regimenIndexacion, CLIENTES_CONOCIDOS: CLIENTES_CONOCIDOS }
  : require('./cruce.js');

var CAMPOS_CORREGIBLES = ['cliente'];
var CAMPOS_REEVALUAN_REGIMEN = ['cliente', 'origen', 'destino'];

/** Parsea historial_correcciones (string JSON) a array; nunca lanza. */
function parseHistorial(historialStr) {
  if (!historialStr) { return []; }
  try {
    var v = JSON.parse(historialStr);
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}

/** Agrega una entrada al historial y devuelve el JSON string completo (append, no overwrite). */
function appendHistorial(historialStr, entrada) {
  var lista = parseHistorial(historialStr);
  lista.push(entrada);
  return JSON.stringify(lista);
}

function entradaBase(accion, usuario, campo, valorAnterior, valorNuevo) {
  return {
    accion: accion,
    usuario: (usuario || '').toString().trim() || '(sin usuario)',
    fecha: new Date().toISOString(),
    campo: campo || null,
    valor_anterior: (valorAnterior === undefined) ? null : valorAnterior,
    valor_nuevo: (valorNuevo === undefined) ? null : valorNuevo
  };
}

/** Split de motivo_revision (string '; '-joined) a array; '' -> []. */
function splitMotivos(motivoStr) {
  if (!motivoStr) { return []; }
  return String(motivoStr).split('; ').filter(function (m) { return m; });
}

/**
 * Corrige un campo y, si corresponde, re-evalua regimen_indexacion y
 * estado_lectura (quita el motivo cliente_no_reconocido si el nuevo valor ya
 * es reconocido; agrega uno nuevo si sigue sin reconocerse).
 *
 * @param {object} viaje  fila actual de Viajes (shape de la tabla real).
 * @param {string} campo  debe estar en CAMPOS_CORREGIBLES.
 * @param {string} valorNuevo
 * @param {string} usuario
 * @param {Array}  [clientes]  lista CLIENTES_CONOCIDOS a usar (tests).
 * @returns {{ok:boolean, motivo?:string, cambios?:object}}
 *   cambios trae SOLO los campos que hay que persistir (incluye historial_correcciones).
 */
function aplicarCorregir(viaje, campo, valorNuevo, usuario, clientes) {
  if (CAMPOS_CORREGIBLES.indexOf(campo) === -1) {
    return { ok: false, motivo: 'campo_no_corregible: ' + campo };
  }
  var nuevo = (valorNuevo || '').toString().trim().toUpperCase();
  if (!nuevo) { return { ok: false, motivo: 'valor_nuevo vacio' }; }
  var anterior = viaje[campo] || null;

  var cambios = {};
  cambios[campo] = nuevo;

  if (CAMPOS_REEVALUAN_REGIMEN.indexOf(campo) >= 0) {
    var cliente = (campo === 'cliente') ? nuevo : (viaje.cliente || null);
    var origen = (campo === 'origen') ? nuevo : (viaje.origen || null);
    var destino = (campo === 'destino') ? nuevo : (viaje.destino || null);
    var ridx = CRUCE_ACC.regimenIndexacion(cliente, origen, destino, clientes || CRUCE_ACC.CLIENTES_CONOCIDOS);
    cambios.regimen_indexacion = ridx.regimen;

    var motivos = splitMotivos(viaje.motivo_revision).filter(function (m) {
      return m.indexOf('cliente_no_reconocido:') !== 0;
    });
    if (ridx.motivo) { motivos.push(ridx.motivo); }
    cambios.estado_lectura = motivos.length ? 'REVISAR' : 'OK';
    cambios.motivo_revision = motivos.join('; ');
  }

  cambios.historial_correcciones = appendHistorial(
    viaje.historial_correcciones,
    entradaBase('corregir', usuario, campo, anterior, nuevo)
  );
  return { ok: true, cambios: cambios };
}

/** Marca resuelto: la documentacion llego por otra via. No toca otros campos. */
function aplicarResolver(viaje, usuario) {
  var anterior = viaje.estado || null;
  var cambios = {
    estado: 'RESUELTO_MANUAL',
    pendiente_falta: null,
    pendiente_reclamar_a: null,
    historial_correcciones: appendHistorial(
      viaje.historial_correcciones,
      entradaBase('resolver', usuario, 'estado', anterior, 'RESUELTO_MANUAL')
    )
  };
  return { ok: true, cambios: cambios };
}

/** Anota una incidencia: texto libre, visible, NO saca el viaje de la lista. */
function aplicarIncidencia(viaje, texto, usuario) {
  var nota = (texto || '').toString().trim();
  if (!nota) { return { ok: false, motivo: 'texto vacio' }; }
  var cambios = {
    historial_correcciones: appendHistorial(
      viaje.historial_correcciones,
      entradaBase('incidencia', usuario, null, null, nota)
    )
  };
  return { ok: true, cambios: cambios };
}

/** Ultimas incidencias (texto libre) de un viaje, para mostrar en la vista. */
function incidenciasDe(historialStr) {
  return parseHistorial(historialStr)
    .filter(function (h) { return h.accion === 'incidencia'; })
    .map(function (h) { return h.valor_nuevo; });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CAMPOS_CORREGIBLES: CAMPOS_CORREGIBLES,
    CAMPOS_REEVALUAN_REGIMEN: CAMPOS_REEVALUAN_REGIMEN,
    parseHistorial: parseHistorial,
    appendHistorial: appendHistorial,
    aplicarCorregir: aplicarCorregir,
    aplicarResolver: aplicarResolver,
    aplicarIncidencia: aplicarIncidencia,
    incidenciasDe: incidenciasDe
  };
}
