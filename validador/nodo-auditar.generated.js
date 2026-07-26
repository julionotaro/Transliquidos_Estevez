// ARCHIVO GENERADO por validador/build-nodo.js — NO EDITAR A MANO.
// Fuente: validador/auditar.js + validador/nodo-auditar.wrapper.js
// Este es el contenido exacto del nodo Code "Auditar" (workflow IlIod0DlephaLmAV).

// ===== VALIDADOR v3: informe tri-valuado =====
//
// Logica de auditoria del validador de facturas. Es la MISMA logica de contraste
// del validador v2 (duplicados, indexacion, IVA, minimo 23t, matriculas, cuadre,
// contraste contra tarifario): aqui solo cambia la CAPA DE SALIDA.
//
// Cambio v2 -> v3: cada linea cae en uno de tres estados explicitos y el informe
// se encabeza con el conteo por estado.
//
//   VALIDADO_OK  hay tarifa para la ruta y el importe esta dentro de tolerancia.
//   DISCREPANCIA hay tarifa pero algo no cuadra (importe, indexacion, matricula,
//                referencia duplicada...).
//   SIN_TARIFA   NO hay tarifa cargada para esa ruta. Estado NO VERIFICADO.
//
// Regla critica: la ausencia de tarifa produce SIN_TARIFA, nunca VALIDADO_OK.
// "No verificado" jamas puede parecerse a "validado OK". SIN_TARIFA es bloqueante
// para `listo_para_pago`: nunca se aprueba en automatico, queda para revision humana.
//
// Este archivo es la unica fuente de verdad de la logica. El script del nodo Code
// de n8n se genera desde aqui con `node validador/build-nodo.js` (no editar el
// generado a mano: se sobreescribe).

var ESTADOS = {
  VALIDADO_OK: 'VALIDADO_OK',
  DISCREPANCIA: 'DISCREPANCIA',
  SIN_TARIFA: 'SIN_TARIFA',
};

// Logging estandar del runtime (console). Sin infraestructura de observabilidad:
// para este volumen (batch, bajo) ELK es sobre-ingenieria. Silenciable en tests.
var LOG_ACTIVO = true;
function setLogActivo(v) { LOG_ACTIVO = !!v; }
function logInfo(msg) { if (LOG_ACTIVO) { console.log('[validador] ' + msg); } }
function logError(msg) { if (LOG_ACTIVO) { console.error('[validador] ERROR ' + msg); } }

var up = function (x) { return (x || '').toString().toUpperCase().trim(); };
var norm = function (x) { return up(x).replace(/[\(\)\[\]\.,]/g, ' ').replace(/\s+/g, ' ').trim(); };
var r2 = function (x) { return Math.round(x * 100) / 100; };

var SIN_IDX = ['TANK SOLUTIONS', 'TRANSPORTES SANTOS', 'HISPALENSE'];

// Cliente de la factura -> grupo de indexacion (solapa) + clave del tarifario.
function resolverCliente(f) {
  var cli = up(f.cliente);
  var grupo = null;
  var clienteBase = null;
  var avisos = [];

  if (cli.indexOf('BRESFOR') >= 0) { grupo = 'FORESA-BRESFOR'; clienteBase = 'FORESA'; }
  else if (cli.indexOf('FORESA') >= 0) { grupo = 'FORESA-BRESFOR'; clienteBase = 'FORESA'; }
  else if (cli.indexOf('QUIMIDROGA') >= 0) { grupo = 'QUIMIDROGA'; clienteBase = 'QUIMIDROGA'; }
  else if (cli.indexOf('HELM') >= 0) { grupo = 'HELM'; clienteBase = 'HELM'; }
  else if (cli.indexOf('BALTRANSA') >= 0) { grupo = 'BALTRANSA'; clienteBase = 'BALTRANSA'; }
  else if (cli.indexOf('RNM') >= 0) { grupo = 'OTROS'; clienteBase = 'RNM'; }
  else if (cli.indexOf('JARAMA') >= 0) { grupo = 'OTROS'; clienteBase = 'QUIMICAS DEL JARAMA'; }
  else if (cli.indexOf('TRANSTAMBRE') >= 0) { grupo = 'OTROS'; clienteBase = 'TRANSTAMBRE'; }
  else if (cli.indexOf('FORESTAL') >= 0) { grupo = 'OTROS'; clienteBase = 'FORESTAL DEL ATLANTICO'; }
  else {
    for (var i = 0; i < SIN_IDX.length; i++) {
      if (cli.indexOf(SIN_IDX[i]) >= 0) { grupo = 'SIN_IDX'; clienteBase = SIN_IDX[i]; break; }
    }
  }

  if (!grupo) {
    grupo = 'OTROS';
    clienteBase = f.cliente || 'DESCONOCIDO';
    avisos.push('Cliente sin regla explicita ("' + (f.cliente || '') + '"). Se aplica solapa OTROS por defecto. Verificar que el cliente sea el destinatario y no Trans. Liquidos Estevez.');
  }
  if (grupo === 'SIN_IDX') {
    avisos.push(clienteBase + ' no usa indexacion: se omite validacion de porcentajes y no se exige la linea.');
  }
  return { grupo: grupo, clienteBase: clienteBase, avisos: avisos };
}

// Indice de tramos de indexacion por solapa.
function indexarTramos(IDX) {
  var porSolapa = {};
  for (var i = 0; i < IDX.length; i++) {
    var rw = IDX[i];
    var s = String(rw.cliente || '');
    if (!porSolapa[s]) porSolapa[s] = [];
    porSolapa[s].push({ d: String(rw.desde || ''), h: String(rw.hasta || ''), p: Number(rw.pct) });
  }
  return porSolapa;
}

// Indice del tarifario por cliente.
function indexarTarifas(TAR) {
  var porCliente = {};
  for (var i = 0; i < TAR.length; i++) {
    var rw = TAR[i];
    var c = String(rw.cliente || '');
    if (!porCliente[c]) porCliente[c] = [];
    porCliente[c].push({
      oN: norm(rw.origen),
      dN: norm(rw.destino),
      tn: Number(rw.tarifa_tn) || null,
      fijo: Number(rw.precio_fijo) || null,
      vd: String(rw.vigente_desde || '2000-01-01'),
    });
  }
  return porCliente;
}

// Busca la tarifa vigente para una ruta. Devuelve null si NO hay tarifa cargada:
// ese null es el que produce SIN_TARIFA. No inventa un fallback.
function buscarTarifa(porCliente, ck, origen, destino, fecha) {
  var arr = porCliente[ck] || [];
  if (!arr.length) return null;
  var oN = norm(origen);
  var dN = norm(destino);
  var cand = arr.filter(function (t) { return t.vd <= (fecha || '9999-12-31'); });
  if (!cand.length) cand = arr;
  var lista = cand.filter(function (t) {
    return t.dN === dN && (t.oN === oN || !t.oN || !oN || t.oN.indexOf(oN) >= 0 || oN.indexOf(t.oN) >= 0);
  });
  if (!lista.length) lista = cand.filter(function (t) { return t.dN === dN; });
  if (!lista.length && dN) lista = cand.filter(function (t) { return t.dN.indexOf(dN) >= 0 || dN.indexOf(t.dN) >= 0; });
  if (!lista.length) return null;
  lista.sort(function (a, b) { return b.vd.localeCompare(a.vd); });
  return lista[0];
}

/**
 * Audita una factura ya extraida contra los datos vivos de indexacion y tarifas.
 *
 * @param {object} factura   JSON extraido de la factura (esquema del extractor gpt-4o).
 * @param {Array}  indexacion Filas de la data table `indexacion`.
 * @param {Array}  tarifas    Filas de la data table `tarifas`.
 * @returns {{resumen:object, detalles:Array, errores:Array, avisos:Array,
 *            listo_para_pago:boolean, meta:object}}
 */
function auditar(factura, indexacion, tarifas) {
  var f = factura || {};
  var IDX = Array.isArray(indexacion) ? indexacion : [];
  var TAR = Array.isArray(tarifas) ? tarifas : [];

  var rc = resolverCliente(f);
  var grupo = rc.grupo;
  var clienteBase = rc.clienteBase;

  var errores = [];          // hallazgos a nivel factura + espejo de los de linea
  var avisos = [].concat(rc.avisos);
  var detalles = [];         // contrato tri-valuado, una entrada por linea

  var porSolapa = indexarTramos(IDX);
  var solapa = (grupo === 'BALTRANSA' || grupo === 'SIN_IDX') ? null : grupo;
  var TRAMOS = solapa ? (porSolapa[solapa] || []) : [];
  var pctDe = function (fc) {
    for (var i = 0; i < TRAMOS.length; i++) { if (fc >= TRAMOS[i].d && fc <= TRAMOS[i].h) return TRAMOS[i].p; }
    return null;
  };
  var rangoDe = function (fc) {
    for (var i = 0; i < TRAMOS.length; i++) { if (fc >= TRAMOS[i].d && fc <= TRAMOS[i].h) return TRAMOS[i].d + '..' + TRAMOS[i].h; }
    return null;
  };

  var porCliente = indexarTarifas(TAR);
  var lineas = Array.isArray(f.lineas) ? f.lineas : [];

  // Regimen agregado FORESA (Orember / Metanol Villagarcia).
  var nOr = 0, nMet = 0, nV = 0;
  for (var k = 0; k < lineas.length; k++) {
    var l0 = lineas[k];
    var c0 = Number(l0.cantidad_tn) || 0;
    var p0 = Number(l0.precio) || 0;
    if (c0 && p0) {
      nV++;
      var d0 = up(l0.destino), o0 = up(l0.origen), m0 = up(l0.material);
      if (d0.indexOf('OREMBER') >= 0 || d0.indexOf('OUREN') >= 0 || d0.indexOf('ORENS') >= 0) nOr++;
      if (m0.indexOf('METANOL') >= 0 && (o0.indexOf('VILLAGARC') >= 0 || o0.indexOf('VILAGARC') >= 0)) nMet++;
    }
  }
  var esAgregada = (grupo === 'FORESA-BRESFOR') && nV > 0 && (nOr >= nV * 0.6 || nMet >= nV * 0.6);
  var validarPct = (grupo !== 'SIN_IDX' && grupo !== 'BALTRANSA');

  var suma = 0;
  var baseRango = {};
  var idxDecl = [];
  var refs = {};

  for (var i = 0; i < lineas.length; i++) {
    var ln = lineas[i];
    var et = '[' + (ln.referencia || 'sin ref') + ' ' + (ln.destino || '') + ']';
    var cant = Number(ln.cantidad_tn) || 0;
    var precio = Number(ln.precio) || 0;
    var imp = Number(ln.importe) || 0;
    var esViaje = !!(cant && precio);
    var cerrada = (cant === 1);

    // Hallazgos de ESTA linea. Alimentan su estado tri-valuado.
    var errLinea = [];
    var avLinea = [];
    var tarifaHallada = null;
    var motivoSinTarifa = null;

    if (esViaje && ln.referencia) {
      var kref = String(ln.referencia).trim();
      if (kref) {
        if (refs[kref] !== undefined) { errLinea.push('REFERENCIA DUPLICADA en esta factura (ya usada en linea ' + (refs[kref] + 1) + ')'); }
        else { refs[kref] = i; }
      }
    }

    if (esViaje) {
      var calc = r2(cant * precio);
      if (Math.abs(calc - imp) > 0.02) { errLinea.push('importe: ' + cant + ' x ' + precio + ' = ' + calc + ' pero dice ' + imp); }
      suma += imp;
      if (!ln.matricula) { errLinea.push('sin matricula'); }
      var rg = ln.fecha_viaje ? rangoDe(ln.fecha_viaje) : null;
      if (rg) { baseRango[rg] = r2((baseRango[rg] || 0) + imp); }
      if (!cerrada && cant > 0 && cant < 23) { avLinea.push('cantidad ' + cant + ' t bajo el minimo de 23 t'); }

      tarifaHallada = buscarTarifa(porCliente, clienteBase, ln.origen, ln.destino, ln.fecha_viaje);
      if (!tarifaHallada) {
        motivoSinTarifa = 'sin tarifa cargada para ' + (ln.origen || '?') + ' -> ' + (ln.destino || '?') + ' (cliente ' + clienteBase + '); el importe NO se contrasto';
      } else if (cerrada && tarifaHallada.fijo) {
        if (Math.abs(tarifaHallada.fijo - precio) > 0.50) { errLinea.push('precio cerrado: tarifario ' + tarifaHallada.fijo + ' EUR (vigor ' + tarifaHallada.vd + ') pero factura ' + precio); }
      } else if (!cerrada && tarifaHallada.tn) {
        if (Math.abs(tarifaHallada.tn - precio) > 0.10) { errLinea.push('precio/tn: tarifario ' + tarifaHallada.tn + ' EUR/tn (vigor ' + tarifaHallada.vd + ') pero factura ' + precio); }
      } else if (cerrada && tarifaHallada.tn) {
        avLinea.push('factura cerrada pero el tarifario solo trae ' + tarifaHallada.tn + ' EUR/tn; revisar');
      } else if (!cerrada && tarifaHallada.fijo) {
        avLinea.push('factura por tn pero el tarifario solo trae precio cerrado ' + tarifaHallada.fijo + '; revisar');
      }
    } else {
      // Linea sin cantidad/precio: no es contrastable contra el tarifario.
      // Tampoco es un OK. Se declara NO VERIFICADA.
      motivoSinTarifa = 'linea sin cantidad/precio de viaje; no es contrastable contra el tarifario';
    }

    var conceptos = Array.isArray(ln.conceptos) ? ln.conceptos : [];
    var tieneIdx = false;
    for (var j = 0; j < conceptos.length; j++) {
      var cn = conceptos[j];
      var tp = (cn.tipo || '').toLowerCase();
      suma += (Number(cn.importe) || 0);
      if (tp === 'indexacion') {
        tieneIdx = true;
        var bC = Number(cn.base) || 0, pC = Number(cn.pct) || 0, iC = Number(cn.importe) || 0;
        if (grupo === 'BALTRANSA') {
          if (iC !== 0 || pC !== 0) { errLinea.push('BALTRANSA: la indexacion va incluida en precio, la linea debe ser 0; dice base=' + bC + ' pct=' + pC + ' importe=' + iC); }
          continue;
        }
        if (grupo === 'SIN_IDX') { avLinea.push(clienteBase + ' no deberia llevar indexacion; linea presente'); continue; }
        var calcC = r2(bC * pC);
        if (Math.abs(calcC - iC) > 0.02) { errLinea.push('importe indexacion: ' + bC + ' x ' + pC + ' = ' + calcC + ' pero dice ' + iC); }
        if (esAgregada) { idxDecl.push({ base: bC, pct: pC, importe: iC }); }
        else if (validarPct) {
          var fv = ln.fecha_viaje;
          var esp = fv ? pctDe(fv) : null;
          if (esp !== null && Math.abs(pC - esp) > 0.0001) { errLinea.push('indexacion ' + pC + ' no corresponde a ' + fv + ' (solapa ' + solapa + '); esperado ' + esp); }
          if (esp === null && fv) { avLinea.push('sin % en solapa ' + solapa + ' para ' + fv); }
          if (imp && Math.abs(bC - imp) > 0.02) { avLinea.push('base indexacion ' + bC + ' != importe viaje ' + imp); }
        }
      } else if (tp === 'repartos') {
        var iR = Number(cn.importe) || 0;
        if (iR !== 90) { avLinea.push('REPARTOS con importe ' + iR + ' (habitual 90 EUR por doble destino)'); }
      }
    }
    if (esViaje && validarPct && !esAgregada) {
      var dest = up(ln.destino);
      if (!tieneIdx && dest.indexOf('REPARTO') < 0) { errLinea.push('FALTA linea de indexacion gasoleo'); }
    }
    if (esViaje && grupo === 'BALTRANSA' && !tieneIdx) { avLinea.push('BALTRANSA sin linea de indexacion a 0 (las facturas suelen traerla)'); }

    // --- Estado tri-valuado de la linea ---
    // Precedencia: SIN_TARIFA gana sobre DISCREPANCIA. Si no hubo tarifa contra la
    // cual contrastar, el hecho estructural es que la linea NO se verifico; los
    // demas hallazgos se conservan en `hallazgos` y en el detalle, no se pierden.
    var estado;
    if (motivoSinTarifa) { estado = ESTADOS.SIN_TARIFA; }
    else if (errLinea.length) { estado = ESTADOS.DISCREPANCIA; }
    else { estado = ESTADOS.VALIDADO_OK; }

    var partesDetalle = [];
    if (motivoSinTarifa) { partesDetalle.push(motivoSinTarifa); }
    for (var e1 = 0; e1 < errLinea.length; e1++) { partesDetalle.push(errLinea[e1]); }
    for (var a1 = 0; a1 < avLinea.length; a1++) { partesDetalle.push('aviso: ' + avLinea[a1]); }
    if (!partesDetalle.length) {
      partesDetalle.push('importe contrastado contra tarifario' + (tarifaHallada ? ' (vigor ' + tarifaHallada.vd + ')' : '') + '; dentro de tolerancia');
    }

    detalles.push({
      linea_id: 'L' + (i + 1),
      estado: estado,
      detalle: partesDetalle.join('; '),
      referencia: ln.referencia || null,
      origen: ln.origen || null,
      destino: ln.destino || null,
      importe: imp,
      hallazgos: errLinea.slice(),
      avisos: avLinea.slice(),
    });

    // Espejo en las listas globales, para no perder el informe que la oficina ya lee.
    for (var e2 = 0; e2 < errLinea.length; e2++) { errores.push(et + ' ' + errLinea[e2]); }
    for (var a2 = 0; a2 < avLinea.length; a2++) { avisos.push(et + ' ' + avLinea[a2]); }
    if (motivoSinTarifa) { avisos.push(et + ' NO VERIFICADA: ' + motivoSinTarifa); }
  }

  // --- Indexacion agregada (FORESA Orember / Metanol) ---
  if (esAgregada && idxDecl.length > 0) {
    var rangos = Object.keys(baseRango);
    for (var m = 0; m < idxDecl.length; m++) {
      var d = idxDecl[m];
      var match = null;
      for (var q = 0; q < rangos.length; q++) { if (Math.abs(baseRango[rangos[q]] - d.base) <= 0.10) { match = rangos[q]; break; } }
      if (!match) {
        var rgP = null;
        for (var t2 = 0; t2 < TRAMOS.length; t2++) { if (Math.abs(TRAMOS[t2].p - d.pct) < 0.0001) { rgP = TRAMOS[t2].d + '..' + TRAMOS[t2].h; } }
        var real = (rgP && baseRango[rgP] !== undefined) ? baseRango[rgP] : null;
        errores.push('Base indexacion declarada ' + d.base + ' (pct ' + d.pct + ') NO coincide con la suma de transporte del rango' + (real !== null ? ' ' + rgP + ' = ' + real + ' (dif ' + r2(d.base - real) + ')' : ''));
        if (real !== null) { errores.push('  -> indexacion correcta seria ' + r2(real * d.pct) + ' en vez de ' + d.importe); }
      }
    }
  }

  // --- Cuadre de la factura ---
  var base = Number(f.base_imponible) || 0;
  if (base && Math.abs(r2(suma) - base) > 0.05) { avisos.push('suma lineas (' + r2(suma) + ') != base imponible (' + base + ')'); }
  var ivaPct = Number(f.iva_pct) || 0;
  var ivaImp = Number(f.iva_importe) || 0;
  if (base && ivaPct) {
    var ci = r2(base * ivaPct / 100);
    if (Math.abs(ci - ivaImp) > 0.05) { errores.push('IVA: ' + base + ' x ' + ivaPct + '% = ' + ci + ' pero dice ' + ivaImp); }
  }
  if (grupo === 'BALTRANSA' && ivaPct && Math.abs(ivaPct - 21) > 0.01) { errores.push('BALTRANSA factura siempre al 21% (porte P) aunque el destino sea PT/FR; dice ' + ivaPct + '%'); }
  var total = Number(f.total) || 0;
  if (base && Math.abs(r2(base + ivaImp) - total) > 0.05) { errores.push('Total: ' + r2(base + ivaImp) + ' pero dice ' + total); }

  // --- Resumen tri-valuado ---
  var resumen = { validadas_ok: 0, discrepancias: 0, sin_tarifa: 0 };
  for (var n = 0; n < detalles.length; n++) {
    if (detalles[n].estado === ESTADOS.VALIDADO_OK) resumen.validadas_ok++;
    else if (detalles[n].estado === ESTADOS.DISCREPANCIA) resumen.discrepancias++;
    else if (detalles[n].estado === ESTADOS.SIN_TARIFA) resumen.sin_tarifa++;
  }

  // Bloqueo: una linea no verificada nunca se aprueba en automatico.
  var listoParaPago = (errores.length === 0) && (resumen.sin_tarifa === 0);

  logInfo('factura ' + (f.numero || 's/n') + ' cliente=' + clienteBase +
    ' lineas=' + detalles.length +
    ' ok=' + resumen.validadas_ok +
    ' discrepancias=' + resumen.discrepancias +
    ' sin_tarifa=' + resumen.sin_tarifa +
    ' listo_para_pago=' + listoParaPago);
  if (resumen.sin_tarifa > 0) {
    logInfo(resumen.sin_tarifa + ' linea(s) NO VERIFICADA(S) por falta de tarifa: requieren revision humana.');
  }

  return {
    resumen: resumen,
    detalles: detalles,
    errores: errores,
    avisos: avisos,
    listo_para_pago: listoParaPago,
    meta: {
      numero: f.numero || null,
      fecha: f.fecha || null,
      cliente: f.cliente || null,
      cliente_base: clienteBase,
      grupo: grupo,
      solapa: solapa,
      regimen: esAgregada ? 'AGREGADA por rango' : 'POR LINEA',
      base_imponible: base,
      iva_importe: ivaImp,
      total: total,
      tramos_indexacion: IDX.length,
      filas_tarifas: TAR.length,
      bases_por_rango: baseRango,
    },
  };
}

var MARCA = {};
MARCA[ESTADOS.VALIDADO_OK] = 'OK ';
MARCA[ESTADOS.DISCREPANCIA] = ' X ';
MARCA[ESTADOS.SIN_TARIFA] = ' ? ';

/**
 * Informe legible. Mismo canal de texto plano que ya consume auditar-factura.html.
 * Los tres estados se ven diferenciados y el resumen resalta las no verificadas.
 */
function renderInforme(res) {
  var m = res.meta;
  var r = res.resumen;
  var L = [];
  L.push('======== AUDITORIA FACTURA v3 ========');
  L.push('Numero: ' + (m.numero || '(falta)') + '   Fecha: ' + (m.fecha || '(falta)') + '   Cliente: ' + (m.cliente || '(falta)'));
  L.push('Cliente base: ' + m.cliente_base + '   Solapa: ' + (m.solapa || (m.grupo === 'BALTRANSA' ? 'BALTRANSA (linea a 0)' : 'SIN INDEXACION')) + '   Regimen: ' + m.regimen);
  L.push('Base: ' + m.base_imponible + '   IVA: ' + m.iva_importe + '   Total: ' + m.total);
  L.push('Datos vivos: ' + m.tramos_indexacion + ' tramos indexacion / ' + m.filas_tarifas + ' filas tarifas.');
  L.push('');
  L.push('---- RESUMEN (' + res.detalles.length + ' lineas) ----');
  L.push('  OK  VALIDADO_OK  : ' + r.validadas_ok + '   (tarifa hallada, importe dentro de tolerancia)');
  L.push('   X  DISCREPANCIA : ' + r.discrepancias + '   (tarifa hallada, algo no cuadra)');
  L.push('   ?  SIN_TARIFA   : ' + r.sin_tarifa + '   (NO VERIFICADAS: no hay tarifa contra la cual contrastar)');
  if (r.sin_tarifa > 0) {
    L.push('');
    L.push('  >> ATENCION: ' + r.sin_tarifa + ' de ' + res.detalles.length + ' lineas NO SE VERIFICARON.');
    L.push('     No son un OK. Requieren revision humana antes de dar la factura por buena.');
  }
  if (m.regimen === 'AGREGADA por rango' && Object.keys(m.bases_por_rango).length) {
    L.push('');
    L.push('Bases de transporte por rango:');
    var rgs = Object.keys(m.bases_por_rango);
    for (var g = 0; g < rgs.length; g++) { L.push('  ' + rgs[g] + ' = ' + m.bases_por_rango[rgs[g]]); }
  }
  L.push('');
  L.push('---- DETALLE POR LINEA ----');
  for (var i = 0; i < res.detalles.length; i++) {
    var d = res.detalles[i];
    var cab = d.linea_id + (d.referencia ? ' ' + d.referencia : '') + (d.destino ? ' -> ' + d.destino : '');
    L.push(MARCA[d.estado] + ' ' + d.estado + '  ' + cab);
    L.push('       ' + d.detalle);
  }
  L.push('');
  L.push('---- ERRORES DE FACTURA (' + res.errores.length + ') ----');
  if (!res.errores.length) { L.push('Ninguno.'); }
  else { for (var e = 0; e < res.errores.length; e++) { L.push('  X ' + res.errores[e]); } }
  L.push('');
  L.push('---- AVISOS (' + res.avisos.length + ') ----');
  if (!res.avisos.length) { L.push('Ninguno.'); }
  else { for (var a = 0; a < res.avisos.length; a++) { L.push('  ! ' + res.avisos[a]); } }
  L.push('');
  if (res.listo_para_pago) {
    L.push('RESULTADO: factura APTA. Todas las lineas verificadas contra tarifario.');
  } else if (res.errores.length > 0) {
    L.push('RESULTADO: NO enviar. Corregir errores.');
  } else {
    L.push('RESULTADO: sin errores, pero NO apta para pago automatico:');
    L.push('           ' + r.sin_tarifa + ' linea(s) sin tarifa cargada quedaron SIN VERIFICAR.');
  }
  L.push('LISTO PARA PAGO: ' + (res.listo_para_pago ? 'SI' : 'NO'));
  L.push('======================================');
  return L.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ESTADOS: ESTADOS, auditar: auditar, renderInforme: renderInforme, resolverCliente: resolverCliente, buscarTarifa: buscarTarifa, indexarTarifas: indexarTarifas, setLogActivo: setLogActivo };
}

// Envoltorio especifico de n8n para el nodo Code "Auditar" del workflow
// [ESTEVEZ] Auditar Factura (webhook) — IlIod0DlephaLmAV.
//
// Solo hace de puente: lee la salida de OpenAI + las data tables, llama a
// auditar()/renderInforme() de auditar.js y devuelve el item. Toda la logica
// vive en auditar.js. `node validador/build-nodo.js` pega auditar.js delante de
// este archivo y produce el script final del nodo.

const input = $input.first().json;

if (input && input.error) {
  logError('fallo antes de OpenAI: ' + input.error);
  return [{ json: { informe: 'FALLO ANTES DE OPENAI: ' + input.error, resumen: null, detalles: [], listo_para_pago: false } }];
}

const raw = input.choices && input.choices[0] && input.choices[0].message ? input.choices[0].message.content : null;
if (!raw) {
  logError('sin respuesta del modelo');
  return [{ json: { informe: 'ERROR: sin respuesta del modelo.', resumen: null, detalles: [], listo_para_pago: false } }];
}

let f;
try {
  f = JSON.parse(raw);
} catch (e) {
  logError('JSON invalido del modelo: ' + String(e));
  return [{ json: { informe: 'ERROR: JSON invalido.\n' + raw, resumen: null, detalles: [], listo_para_pago: false } }];
}

const res = auditar(f, input.indexacion, input.tarifas);

// Se devuelve el informe de texto (canal que ya consume auditar-factura.html)
// junto con el contrato JSON tri-valuado. El nodo Responder sigue sirviendo
// $json.informe; para pasar a JSON basta cambiar ese nodo.
return [{
  json: {
    informe: renderInforme(res),
    resumen: res.resumen,
    detalles: res.detalles,
    listo_para_pago: res.listo_para_pago,
    meta: res.meta,
  },
}];
