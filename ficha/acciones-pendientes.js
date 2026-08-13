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
  // El cliente es campo critico de extraccion: su correccion tambien va a la
  // tabla `correcciones` (opcion 2, preserva el valor original del modelo para
  // medir calidad). El grafo "¿Hay correccion? -> Insertar Correccion" ya la
  // enruta cuando el item trae `_correccion`; no hay cambio de grafo.
  var correccion = {
    viaje_id: (viaje.id === undefined || viaje.id === null) ? '' : String(viaje.id),
    campo: campo,
    valor_original: (anterior === null || anterior === undefined) ? '' : String(anterior),
    valor_corregido: String(nuevo),
    motivo_original: (viaje.motivo_revision == null) ? '' : String(viaje.motivo_revision),
    editado_por: (usuario || '').toString().trim() || 'web-pendientes',
    editado_en: new Date().toISOString()
  };
  return { ok: true, cambios: cambios, correccion: correccion };
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

// ===== CAMBIO 2/3: correccion de celda SIN revalidar =======================
//
// aplicarCorregirCelda es el verbo nuevo de la tabla editable. A diferencia de
// aplicarCorregir (que revalida regimen/estado_lectura y solo acepta 'cliente'),
// este NO revalida: acepta el valor humano como verdad final, escribe la celda y
// listo. El "!" de esa celda desaparece solo, porque el "!" se recomputa en el
// render (validaciones de forma) contra el nuevo valor.
//
// EXCEPCION CRITICA (decision E): `cliente` NO se corrige por aca. Corregir el
// cliente arrastra recalculos (regimen de indexacion, pais de facturacion); sin
// revalidar quedarian calculados sobre el cliente equivocado -> misbilling
// silencioso. `cliente` sigue yendo por aplicarCorregir (que revalida).
//
// Ademas de `cambios` (lo que se persiste en Viajes), devuelve `correccion`: la
// fila para la tabla `correcciones` (opcion 2), que preserva el valor original
// del modelo para medir calidad de extraccion en el tiempo.

var CAMPOS_CELDA_CORREGIBLES = [
  'tractora', 'semi', 'conductor', 'origen', 'destino', 'material', 'referencia',
  'fecha', 'fecha_descarga', 'km_cargados', 'km_vacios', 'kg_documento', 'kg_hoja'
];
var CAMPOS_CELDA_NUMERICOS = ['km_cargados', 'km_vacios', 'kg_documento', 'kg_hoja'];

function coercerValorCelda(campo, valor) {
  if (CAMPOS_CELDA_NUMERICOS.indexOf(campo) >= 0) {
    var n = (typeof valor === 'number') ? valor : Number(String(valor == null ? '' : valor).replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  return (valor == null) ? '' : String(valor).trim();
}

/**
 * Corrige UNA celda sin revalidar. El humano es la autoridad: el valor se acepta
 * tal cual, sin re-chequear catalogo ni forma.
 * @param {object} viaje          fila actual de Viajes.
 * @param {string} campo          columna real de Viajes; NO 'cliente'.
 * @param {*}      valorNuevo     valor escrito por el humano.
 * @param {string} usuario        identidad del operador (o canal).
 * @param {string} [motivoOriginal]  el/los motivo(s) de "!" que tenia la celda.
 * @returns {{ok:boolean, motivo?:string, cambios?:object, correccion?:object}}
 */
function aplicarCorregirCelda(viaje, campo, valorNuevo, usuario, motivoOriginal) {
  if (campo === 'cliente') {
    return { ok: false, motivo: 'cliente_no_se_corrige_por_celda: usa aplicarCorregir (revalida regimen/pais)' };
  }
  if (CAMPOS_CELDA_CORREGIBLES.indexOf(campo) === -1) {
    return { ok: false, motivo: 'campo_no_corregible_por_celda: ' + campo };
  }
  var nuevo = coercerValorCelda(campo, valorNuevo);
  if (nuevo === null || nuevo === '') {
    return { ok: false, motivo: 'valor_nuevo vacio o no numerico para ' + campo };
  }
  var anterior = (viaje[campo] === undefined) ? null : viaje[campo];

  var cambios = {};
  cambios[campo] = nuevo;
  // NO se tocan estado_lectura ni motivo_revision: no hay revalidacion.
  cambios.historial_correcciones = appendHistorial(
    viaje.historial_correcciones,
    entradaBase('corregir_celda', usuario, campo, anterior, nuevo)
  );

  var correccion = {
    viaje_id: (viaje.id === undefined || viaje.id === null) ? '' : String(viaje.id),
    campo: campo,
    valor_original: (anterior === null || anterior === undefined) ? '' : String(anterior),
    valor_corregido: String(nuevo),
    motivo_original: (motivoOriginal == null) ? '' : String(motivoOriginal),
    editado_por: (usuario || '').toString().trim() || 'web-pendientes',
    editado_en: new Date().toISOString()
  };

  return { ok: true, cambios: cambios, correccion: correccion };
}

/**
 * Confirma la fila: el humano reviso/corrigio y la da por lista para Gesruta.
 * Transiciona estado_carga pendiente_revision -> confirmada. NUNCA escribe
 * cargada_gesruta (eso es la Pieza C, con acuse de Gesruta).
 */
function aplicarConfirmar(viaje, usuario) {
  var anterior = viaje.estado_carga || 'pendiente_revision';
  var cambios = {
    estado_carga: 'confirmada',
    historial_correcciones: appendHistorial(
      viaje.historial_correcciones,
      entradaBase('confirmar', usuario, 'estado_carga', anterior, 'confirmada')
    )
  };
  return { ok: true, cambios: cambios };
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
    incidenciasDe: incidenciasDe,
    CAMPOS_CELDA_CORREGIBLES: CAMPOS_CELDA_CORREGIBLES,
    aplicarCorregirCelda: aplicarCorregirCelda,
    aplicarConfirmar: aplicarConfirmar
  };
}
