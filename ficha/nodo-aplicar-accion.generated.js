// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.
// Fuente: ficha/cruce.js + ficha/acciones-pendientes.js + ficha/nodo-aplicar-accion.wrapper.js
// Contenido exacto del nodo Code "Aplicar Accion" ([ESTEVEZ] Vista Pendientes (C3eZ1RteNAZDdaCV)).

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
  if (modalidad && modalidad.fuente && modalidad.fuente !== 'ninguna') {
    if (modalidad.modalidad === null) {
      return { regimen: null, motivo: modalidad.motivo };
    }
    return { regimen: modalidad.modalidad, motivo: modalidad.revisar ? modalidad.motivo : null };
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

// Nodo Code "Aplicar Accion" del workflow "[ESTEVEZ] Vista Pendientes".
//
// Entrada: la fila de Viajes que matcheo el id del POST (nodo dataTable
// "Leer Viaje Accion"), mas el body del webhook "Hook Accion"
// ($('Hook Accion').first().json.body: id, accion, usuario, valor, campo, motivo).
// Aplica la accion pedida (logica en acciones-pendientes.js) y emite el SNAPSHOT
// COMPLETO del viaje ya actualizado, para que "Actualizar Viaje" escriba de
// vuelta sin tener que razonar sobre que cambio y que no.
//
// CAMBIO 2/3: dos verbos nuevos sobre el MISMO webhook (no hay canal nuevo):
//   - corregir_celda: corrige una celda SIN revalidar (todo menos `cliente`).
//     Ademas del snapshot, adjunta `_correccion`: la fila para la tabla nueva
//     `correcciones` (opcion 2, preserva el valor original del modelo).
//   - confirmar: transiciona estado_carga pendiente_revision -> confirmada.
// `cliente` sigue yendo por el verbo `corregir` (aplicarCorregir, que revalida).
//
// RUTEO DE `_correccion` EN EL GRAFO (deploy manual, ver instructivo):
//   Aplicar Accion  --main-->  Actualizar Viaje        (escribe columnas de Viajes;
//                                                        ignora `_correccion`)
//   Aplicar Accion  --main-->  IF "¿Hay correccion?"   (condicion: $json._correccion
//                                 --true--> Insertar Correccion (dataTable insert
//                                           en `correcciones`, mapea $json._correccion.*)
// Asi una correccion de celda escribe en Viajes Y en correcciones; el resto de
// las acciones solo tocan Viajes (la rama IF no dispara).

const filas = $input.all();
if (filas.length === 0) {
  throw new Error('Aplicar Accion: no se encontro el viaje (id inexistente o ya no esta en la tabla).');
}
const viaje = filas[0].json || {};
const body = ($('Hook Accion').first().json || {}).body || {};
const accion = (body.accion || '').toString();

let resultado;
if (accion === 'corregir') {
  resultado = aplicarCorregir(viaje, 'cliente', body.valor, body.usuario);
} else if (accion === 'corregir_celda') {
  resultado = aplicarCorregirCelda(viaje, (body.campo || '').toString(), body.valor, body.usuario, body.motivo);
} else if (accion === 'confirmar') {
  resultado = aplicarConfirmar(viaje, body.usuario);
} else if (accion === 'resolver') {
  resultado = aplicarResolver(viaje, body.usuario);
} else if (accion === 'incidencia') {
  resultado = aplicarIncidencia(viaje, body.valor, body.usuario);
} else {
  throw new Error('Aplicar Accion: accion desconocida "' + accion + '" (esperada corregir/corregir_celda/confirmar/resolver/incidencia).');
}
if (!resultado.ok) {
  throw new Error('Aplicar Accion: ' + resultado.motivo);
}

const actualizado = Object.assign({}, viaje, resultado.cambios);
// La fila para `correcciones` viaja adjunta; la rama IF del grafo la enruta a la
// tabla nueva. Las columnas de Viajes no incluyen `_correccion`, asi que
// "Actualizar Viaje" la ignora.
if (resultado.correccion) {
  actualizado._correccion = resultado.correccion;
}
// Status JSON para "Responder Accion" (CAMBIO fetch-acciones): el webhook
// responde ESTO (no HTML ni redirect), y el front actualiza la fila in-place sin
// navegar. Se arma DESPUES de aplicar la accion, asi refleja el estado real que
// se va a persistir. `Responder Accion` responde con {{ $('Aplicar Accion').first().json._status }}.
// Como _status no es columna de Viajes, "Actualizar Viaje" lo ignora (igual que _correccion).
actualizado._status = {
  ok: true,
  viaje_id: (actualizado.id === undefined || actualizado.id === null) ? null : String(actualizado.id),
  accion: accion || null,
  campo: (body.campo === undefined || body.campo === null || body.campo === '') ? null : String(body.campo),
  valor: (body.valor === undefined) ? null : body.valor,
  estado_carga: actualizado.estado_carga || null,
  cliente: (actualizado.cliente === undefined) ? null : actualizado.cliente,
  estado_lectura: actualizado.estado_lectura || null,
  motivo_revision: actualizado.motivo_revision || null
};
return [{ json: actualizado }];
