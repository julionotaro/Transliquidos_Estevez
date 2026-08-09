// ===== VALIDACIONES DE FORMA (Capa 2) — CAMBIO 2 =====================
//
// Chequeos DETERMINISTAS sobre el valor ya leido, self-contained: no dependen
// del correlacionador ni de ningun estado del pipeline. Marcan la CELDA concreta
// que falla una regla de forma, para que en la vista de Pendientes lleve "!".
//
// Son la Capa 2 del "!". La Capa 1 (duda por campo del modelo de extraccion,
// alias `campos_dudosos` en el correlacionador) NO se implementa en este encargo
// (decision D del addendum): tocaria el nodo critico de lectura y queda como
// encargo futuro. Aca solo hay reglas de forma, que no razonan sobre confianza.
//
// Las tres reglas del encargo:
//   (a) patron de matricula (tractora / remolque)
//   (b) fecha de descarga >= fecha de carga
//   (c) cantidad > 0
//
// Filosofia de nulos: una regla NO marca "!" por dato AUSENTE (eso es otro eje:
// falta de documentacion / lectura a revisar, a nivel fila). Marca por dato
// PRESENTE pero mal formado. Excepcion pedida en el encargo: la cantidad 0 /
// vacia / no numerica SI lleva "!" (regla c explicita).

'use strict';

// --- (a) Matricula ---------------------------------------------------------
// Compacta (mayusculas, sin espacios ni guiones) y matchea contra los formatos
// reales que maneja la flota:
//   - actual (2000+):      NNNN LLL           -> 2498KZL, 1234-ABC
//   - remolque (prefijo R): R NNNN LL[L]      -> R1007BCV
//   - historico provincia: L[L] NNNN..NN L[L] -> M1234AB, PO1234K, GC12345
// Vacio -> valida (ausencia no es error de forma; la marca de "!" por forma es
// para un valor presente que no parece matricula, ej. "AVEIRO" en el campo).
var RE_MATRICULA_ACTUAL = /^\d{4}[A-Z]{3}$/;
var RE_MATRICULA_REMOLQUE = /^R\d{4}[A-Z]{2,3}$/;
var RE_MATRICULA_HISTORICA = /^[A-Z]{1,2}\d{4,6}[A-Z]{0,2}$/;

function compactarMatricula(v) {
  return String(v == null ? '' : v).toUpperCase().replace(/[\s-]/g, '');
}

/** ¿El valor tiene forma de matricula? Vacio -> true (no es error de forma). */
function esMatriculaValida(v) {
  var c = compactarMatricula(v);
  if (!c) { return true; }
  return RE_MATRICULA_ACTUAL.test(c) || RE_MATRICULA_REMOLQUE.test(c) || RE_MATRICULA_HISTORICA.test(c);
}

// --- (b) Fechas ------------------------------------------------------------
// Solo compara si AMBAS son fechas ISO parseables. Si falta una o no parsea,
// no se puede afirmar el desorden -> no marca (indeterminado != invalido).
function parseFechaISO(s) {
  if (!s) { return null; }
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s).trim());
  if (!m) { return null; }
  var t = Date.parse(m[1] + '-' + m[2] + '-' + m[3] + 'T00:00:00Z');
  return isFinite(t) ? t : null;
}

/** ¿fecha_descarga >= fecha_carga? Indeterminado (falta o no parsea) -> true. */
function fechasEnOrden(fechaCarga, fechaDescarga) {
  var c = parseFechaISO(fechaCarga);
  var d = parseFechaISO(fechaDescarga);
  if (c === null || d === null) { return true; }
  return d >= c;
}

// --- (c) Cantidad ----------------------------------------------------------
/** ¿cantidad numerica > 0? Vacia / cero / no numerica -> false (regla c). */
function esCantidadValida(x) {
  if (x === null || x === undefined || x === '') { return false; }
  var n = (typeof x === 'number') ? x : Number(String(x).replace(',', '.'));
  return isFinite(n) && n > 0;
}

// --- Cantidad efectiva + unidad de medida ----------------------------------
// La cantidad que se muestra: el peso del documento si existe, si no el de la
// ficha. La unidad de los pesos cargados es kg (el numero sin U.M. miente).
function cantidadDe(viaje) {
  var v = viaje || {};
  var kgDoc = (typeof v.kg_documento === 'number' && isFinite(v.kg_documento)) ? v.kg_documento : null;
  var kgHoja = (typeof v.kg_hoja === 'number' && isFinite(v.kg_hoja)) ? v.kg_hoja : null;
  var valor = (kgDoc !== null) ? kgDoc : kgHoja;
  return { valor: valor, um: 'kg' };
}

// --- Dieta (se lee del JSON `detalle`, no es columna) ----------------------
// Decision C del addendum: la dieta es dato de LECTURA de la ficha (recuadro
// GASTOS DEL VIAJE), vive dentro del JSON `detalle`/gastos. Se lee con
// tolerancia: si el viaje no la trae, celda vacia (nunca "!").
function dietaDeDetalle(detalleStr) {
  if (!detalleStr) { return null; }
  var d;
  try { d = (typeof detalleStr === 'object') ? detalleStr : JSON.parse(detalleStr); } catch (e) { return null; }
  if (!d || typeof d !== 'object') { return null; }
  var gastos = Array.isArray(d.gastos) ? d.gastos : null;
  if (!gastos) { return null; }
  var total = 0;
  var hubo = false;
  for (var i = 0; i < gastos.length; i++) {
    var g = gastos[i] || {};
    if (String(g.tipo || '').toLowerCase() === 'dieta') {
      var imp = (typeof g.importe === 'number') ? g.importe : Number(String(g.importe || '').replace(',', '.'));
      if (isFinite(imp)) { total += imp; hubo = true; }
    }
  }
  return hubo ? total : null;
}

// --- Marcas de forma por celda ---------------------------------------------
/**
 * Devuelve, por campo, la lista de motivos de forma que le ponen "!" a esa
 * celda. Solo incluye campos que fallan; un viaje limpio devuelve {}.
 * Claves usadas: tractora, semi, fecha, fecha_descarga, cantidad.
 * @param {object} viaje  fila de la tabla Viajes.
 * @returns {Object<string,string[]>}
 */
function marcasForma(viaje) {
  var v = viaje || {};
  var marcas = {};
  var push = function (campo, motivo) {
    if (!marcas[campo]) { marcas[campo] = []; }
    marcas[campo].push(motivo);
  };

  if (!esMatriculaValida(v.tractora)) {
    push('tractora', 'matricula con formato invalido: "' + (v.tractora || '') + '"');
  }
  if (!esMatriculaValida(v.semi)) {
    push('semi', 'matricula con formato invalido: "' + (v.semi || '') + '"');
  }
  if (!fechasEnOrden(v.fecha, v.fecha_descarga)) {
    push('fecha', 'fecha de descarga anterior a la de carga');
    push('fecha_descarga', 'fecha de descarga anterior a la de carga');
  }
  var cant = cantidadDe(v);
  if (!esCantidadValida(cant.valor)) {
    push('cantidad', 'cantidad ausente, cero o no numerica');
  }
  return marcas;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    esMatriculaValida: esMatriculaValida,
    fechasEnOrden: fechasEnOrden,
    esCantidadValida: esCantidadValida,
    cantidadDe: cantidadDe,
    dietaDeDetalle: dietaDeDetalle,
    marcasForma: marcasForma
  };
}
