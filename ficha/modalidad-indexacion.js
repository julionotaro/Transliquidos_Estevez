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

// Tolerancia al comparar la base de una linea de indexacion contra el importe
// del porte del mismo albaran: son dos redondeos a 2 decimales de Gesruta.
var TOL_BASE = 0.02;
// Cuantas veces el porte tiene que superar la base para considerarla acumulada.
// 1,5x deja fuera el ruido de redondeo y no confunde un albaran con dos portes.
var FACTOR_ACUMULADA = 1.5;

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

  // 2) Por cliente, contar de que tipo son sus lineas de indexacion.
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

    var basePorte = 0;
    for (var p = 0; p < A.portes.length; p++) { basePorte += (A.portes[p].importe || 0); }

    for (var j = 0; j < A.idx.length; j++) {
      var G = A.idx[j];
      if (!G.importe) { C.enCero++; continue; }         // incluida en precio
      var base = G.cantidad;
      // Gesruta escribe la indexacion de dos formas:
      //   cantidad = base en EUR, precio = pct decimal   (el caso normal)
      //   cantidad = 1, precio = importe                 (importe suelto)
      // En la segunda la base no esta escrita: se deduce del importe / pct, que
      // no tenemos aca. Se juzga por el importe contra el porte.
      if (base !== null && base > 1.5) {
        if (basePorte && Math.abs(base - basePorte) <= TOL_BASE) { C.conLinea++; }
        else if (basePorte && base > basePorte * FACTOR_ACUMULADA) { C.conAgregada++; }
        else { C.conLinea++; }
      } else if (basePorte && G.importe > basePorte) {
        // Importe suelto MAYOR que el porte del albaran: no puede ser la
        // indexacion de esa sola linea, es el acumulado del periodo.
        C.conAgregada++;
      } else {
        C.conLinea++;
      }
    }
  }

  // 3) Decidir la modalidad de cada cliente.
  var out = {};
  for (var cli2 in CONT) {
    if (!Object.prototype.hasOwnProperty.call(CONT, cli2)) { continue; }
    var v = CONT[cli2];
    var conIdx = v.conLinea + v.conAgregada + v.enCero;
    var modalidad;
    if (conIdx === 0) {
      modalidad = 'sin_indexacion';
    } else if (v.enCero === conIdx) {
      modalidad = 'incluida';
    } else if (v.conAgregada > 0 && v.conLinea === 0) {
      modalidad = 'agregada';
    } else if (v.conAgregada > 0) {
      // Foresa real: parte por linea y parte agregada, segun el servicio. No se
      // puede decidir por cliente -> se decide por viaje, y hasta entonces
      // REVISAR. Nunca se elige una de las dos en silencio.
      modalidad = 'mixta';
    } else {
      modalidad = 'linea';
    }
    out[cli2] = {
      modalidad: modalidad, portes: v.portes, conLinea: v.conLinea,
      conAgregada: v.conAgregada, enCero: v.enCero, sinIndexacion: v.sinIndexacion,
      evidencia: v.portes + ' albaranes con porte; ' + v.conLinea + ' indexacion por linea, ' +
        v.conAgregada + ' acumulada, ' + v.enCero + ' a cero, ' + v.sinIndexacion + ' sin linea'
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

    var tramo = null;
    for (var t = 0; t < trs.length; t++) {
      var f = trs[t];
      if (MI_CRUCE.norm(f.cliente) !== gNombre) { continue; }
      if (fecha && (f.desde || '') <= fecha && fecha <= (f.hasta || '')) { tramo = f; break; }
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
