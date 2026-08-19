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

function digitos(x) { return String(x === null || x === undefined ? '' : x).replace(/\D/g, ''); }

// Cliente de la factura -> grupo de indexacion (solapa) + clave del tarifario.
// CAMBIO 1 (Encargo 4): si se pasa el catalogo `clientes`, se resuelve desde ahi,
// con el CIF como LLAVE DURA (prioridad sobre el nombre). Cliente no reconocido en
// el catalogo -> bloqueante (§3), ya no un aviso. Sin catalogo, cae al legacy
// hardcodeado (compatibilidad / regresion).
function resolverCliente(f, clientes) {
  var cli = up(f.cliente);
  var avisos = [];
  var cat = Array.isArray(clientes) ? clientes : [];

  if (cat.length) {
    var cif = digitos(f.cif_cliente);
    var row = null, viaCif = false, i, j;
    if (cif) {
      for (i = 0; i < cat.length; i++) { if (digitos(cat[i].cif) && digitos(cat[i].cif) === cif) { row = cat[i]; viaCif = true; break; } }
    }
    if (!row) {
      for (i = 0; i < cat.length; i++) {
        var nombres = [cat[i].nombre_canonico].concat(String(cat[i].alias || '').split('|'));
        for (j = 0; j < nombres.length; j++) { var nn = up(nombres[j]).trim(); if (nn && cli.indexOf(nn) >= 0) { row = cat[i]; break; } }
        if (row) break;
      }
    }
    if (row) {
      if (cif && digitos(row.cif) && digitos(row.cif) !== cif) {
        avisos.push('CIF de la factura (' + f.cif_cliente + ') no coincide con el del catalogo para ' + (row.nombre_canonico || '') + '; se resolvio por nombre');
      }
      return { grupo: row.grupo_indexacion || 'OTROS', clienteBase: row.nombre_canonico || f.cliente,
        pais: row.pais || null, regimen_iva: row.regimen_iva || null, ciclo: row.ciclo_facturacion || null,
        reconocido: true, via: viaCif ? 'cif' : 'nombre', avisos: avisos };
    }
    // Catalogo presente y el cliente NO esta -> NO se valida contra una solapa
    // ajena (fail-silent viejo). Bloqueante, con el emisor visible (§3).
    return { grupo: 'NO_RECONOCIDO', clienteBase: f.cliente || 'DESCONOCIDO', pais: null,
      regimen_iva: null, ciclo: null, reconocido: false, via: null, avisos: avisos };
  }

  // ---- Fallback LEGACY (sin catalogo de clientes) ----
  var grupo = null;
  var clienteBase = null;

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
  return { grupo: grupo, clienteBase: clienteBase, pais: null, regimen_iva: null, ciclo: null, reconocido: true, via: 'legacy', avisos: avisos };
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
  // CAMBIO 4 (Encargo 4): el origen vacio DEJA DE SER COMODIN. Antes, una linea con
  // origen ilegible matcheaba cualquier tarifa de ese destino (fail-silent). Sin
  // origen no hay match -> SIN_TARIFA, nunca un match por descarte.
  if (!oN) return null;
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
function auditar(factura, indexacion, tarifas, opts) {
  var f = factura || {};
  var IDX = Array.isArray(indexacion) ? indexacion : [];
  var TAR = Array.isArray(tarifas) ? tarifas : [];
  opts = opts || {};
  var CLIENTES = Array.isArray(opts.clientes) ? opts.clientes : [];
  var VIAJES = Array.isArray(opts.viajes) ? opts.viajes : [];
  // CAMBIO 3: rutas multiviaje (Foresa metanol). Se REUSA la lista de cruce.js; en
  // el nodo la pasa el wrapper por opts (el Code node no puede require). Sin lista
  // -> se intenta cruce.js (entorno de test) -> [] (no rompe nada).
  var RUTAS_MV = Array.isArray(opts.rutasMultiviaje) ? opts.rutasMultiviaje : null;
  if (!RUTAS_MV) {
    try { RUTAS_MV = require('../ficha/cruce.js').RUTAS_MULTIVIAJE || []; } catch (e) { RUTAS_MV = []; }
  }

  var rc = resolverCliente(f, CLIENTES);
  var grupo = rc.grupo;
  var clienteBase = rc.clienteBase;

  var errores = [];          // hallazgos a nivel factura + espejo de los de linea
  var avisos = [].concat(rc.avisos);
  var detalles = [];         // contrato tri-valuado, una entrada por linea

  // CAMBIO 1 (§3): cliente no reconocido en el catalogo -> bloqueante, con el
  // emisor leido visible. Deja de validarse contra una solapa que no corresponde.
  if (!rc.reconocido) {
    errores.push('cliente_no_reconocido: emisor "' + (f.cliente || '') + '" no esta en el catalogo de clientes; no se valida tarifa ni indexacion contra una solapa ajena (§3)');
  }

  // Matcher local de ruta multiviaje (mismo criterio de inclusion que cruce.js:
  // sin acentos, mayusculas, inclusion en ambos sentidos). No matchea vacios.
  var incl = function (a, b) { var x = norm(a), y = norm(b); return !!(x && y && (x.indexOf(y) >= 0 || y.indexOf(x) >= 0)); };
  var esRutaMV = function (cli, ori, des) {
    for (var i = 0; i < RUTAS_MV.length; i++) { var r = RUTAS_MV[i]; if (incl(cli, r.cliente) && incl(ori, r.origen) && incl(des, r.destino)) { return true; } }
    return false;
  };

  var porSolapa = indexarTramos(IDX);
  var solapa = (grupo === 'BALTRANSA' || grupo === 'SIN_IDX' || grupo === 'NO_RECONOCIDO') ? null : grupo;
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
  var validarPct = (grupo !== 'SIN_IDX' && grupo !== 'BALTRANSA' && grupo !== 'NO_RECONOCIDO');

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
      // CAMBIO 5 (§8): la referencia FORESA empieza por 20. Si empieza por 5030 es
      // el nº interno del albaran, no la referencia facturable -> DISCREPANCIA.
      if (clienteBase === 'FORESA' && ln.referencia) {
        var refD = String(ln.referencia).replace(/\D/g, '');
        if (refD.indexOf('5030') === 0) { errLinea.push('referencia FORESA "' + ln.referencia + '" empieza por 5030 (nº interno del albaran, no la referencia; §8)'); }
        else if (refD && refD.indexOf('20') !== 0) { avLinea.push('referencia FORESA "' + ln.referencia + '" no empieza por 20 (formato esperado, §8)'); }
      }
      var rg = ln.fecha_viaje ? rangoDe(ln.fecha_viaje) : null;
      if (rg) { baseRango[rg] = r2((baseRango[rg] || 0) + imp); }
      // CAMBIO 3 (§7): en rutas multiviaje (Foresa metanol Villagarcia->Caldas) la
      // `cantidad` puede ser numero de rotaciones, no toneladas; leer "6 viajes"
      // como "6 t" disparaba un aviso de minimo FALSO garantizado. No se aplica el
      // minimo de 23 t en esas rutas.
      var esMV = esRutaMV(f.cliente || clienteBase, ln.origen, ln.destino);
      if (!cerrada && !esMV && cant > 0 && cant < 23) { avLinea.push('cantidad ' + cant + ' t bajo el minimo de 23 t'); }

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
    // CAMBIO 5 (§8, regla dura): BALTRANSA DEBE llevar la linea de indexacion a 0.
    // Antes era aviso; ahora es error (la indexacion incluida en precio se
    // materializa como linea a 0,000 en factura; su ausencia es un defecto).
    if (esViaje && grupo === 'BALTRANSA' && !tieneIdx) { errLinea.push('BALTRANSA: falta la linea de indexacion a 0 (obligatoria, §8)'); }

    // --- CAMBIO 2: contraste de la linea contra la tabla `viajes` (realidad operativa) ---
    // Solo corre si hay viajes cargados del periodo; si no, se declara en el informe
    // (meta.contraste_viajes) y no se contrasta en silencio.
    if (VIAJES.length && esViaje) {
      var refn = ln.referencia ? String(ln.referencia).trim() : '';
      var vMatch = null;
      if (refn) { for (var vi = 0; vi < VIAJES.length; vi++) { if (String(VIAJES[vi].referencia || '').trim() === refn) { vMatch = VIAJES[vi]; break; } } }
      if (!vMatch) {
        errLinea.push('linea facturada sin viaje registrado (ref ' + (refn || 's/ref') + '); no hay respaldo operativo');
      } else {
        // Referencia ya facturada en OTRA factura: puede ser refacturacion/duplicado
        // O una rectificativa legitima -> no se marca error a ciegas, va a REVISAR.
        var fid = String(vMatch.factura_id || '').trim();
        if (fid && f.numero && fid !== String(f.numero).trim()) {
          avLinea.push('referencia ' + refn + ' ya facturada en ' + fid + '; verificar si es rectificativa legitima o duplicado (REVISAR)');
        }
        // Peso divergente: peso del viaje (documento de origen, §4/D-01) vs cantidad
        // facturada (tn->kg). No aplica a lineas cerradas (cantidad=1 = precio cerrado).
        var kgViaje = Number(vMatch.kg_documento) || 0;
        var kgFactura = (cant && cant > 1) ? cant * 1000 : 0;
        if (kgViaje && kgFactura && Math.abs(kgViaje - kgFactura) > kgFactura * 0.02) {
          errLinea.push('peso divergente: viaje ' + kgViaje + ' kg vs factura ' + r2(kgFactura) + ' kg (>2%, §4/D-01)');
        }
      }
    }

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

  // --- CAMBIO 2: viajes reales NO facturados (SOLO reporta, no bloquea pago) ---
  // Es el error que mas plata cuesta y que ningun check contra la propia factura
  // puede encontrar. Se lista; la decision de facturarlos es humana.
  var viajesNoFacturados = [];
  var contrasteViajes = 'no ejecutado (no hay viajes del periodo cargados)';
  if (VIAJES.length) {
    contrasteViajes = 'ejecutado contra ' + VIAJES.length + ' viaje(s)';
    for (var vv = 0; vv < VIAJES.length; vv++) {
      var vr = String(VIAJES[vv].referencia || '').trim();
      var yaFacturado = !!String(VIAJES[vv].factura_id || '').trim();
      if (vr && refs[vr] === undefined && !yaFacturado && incl(VIAJES[vv].cliente, clienteBase)) {
        viajesNoFacturados.push({ referencia: vr, origen: VIAJES[vv].origen || null, destino: VIAJES[vv].destino || null, kg: Number(VIAJES[vv].kg_documento) || null, fecha: VIAJES[vv].fecha || VIAJES[vv].fecha_carga || null });
      }
    }
    if (viajesNoFacturados.length) {
      avisos.push('CONTRASTE viajes: ' + viajesNoFacturados.length + ' viaje(s) de ' + clienteBase + ' SIN facturar en esta factura (informativo, no bloquea; ver seccion).');
    }
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
  // CAMBIO 5 (§8): IVA por pais/cliente desde el catalogo de clientes (no hardcodeado).
  // RNM (PT) sin IVA; Quimidroga Portugal (PT); etc. Sale de clientes.regimen_iva.
  if (rc.regimen_iva) {
    if (String(rc.regimen_iva).toLowerCase() === 'sin_iva' && ivaPct > 0) {
      errores.push(rc.clienteBase + ' (' + (rc.pais || '?') + ') factura SIN IVA pero lleva ' + ivaPct + '%');
    } else if (/^\d+(\.\d+)?$/.test(String(rc.regimen_iva)) && ivaPct && Math.abs(ivaPct - Number(rc.regimen_iva)) > 0.01) {
      errores.push('IVA esperado ' + rc.regimen_iva + '% para ' + rc.clienteBase + ' (' + (rc.pais || '?') + ') pero factura ' + ivaPct + '%');
    }
  }
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
      cliente_reconocido: rc.reconocido,
      cliente_via: rc.via,
      pais: rc.pais,
      regimen_iva: rc.regimen_iva,
      ciclo_facturacion: rc.ciclo,
      contraste_viajes: contrasteViajes,
      viajes_no_facturados: viajesNoFacturados,
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
  if (m.cliente_reconocido === false) { L.push('  >> CLIENTE NO RECONOCIDO en el catalogo — factura NO validada contra tarifa/indexacion.'); }
  L.push('Contraste contra viajes: ' + (m.contraste_viajes || 'n/d') + '.');
  if (m.viajes_no_facturados && m.viajes_no_facturados.length) {
    L.push('');
    L.push('---- VIAJES REALES SIN FACTURAR (' + m.viajes_no_facturados.length + ') — informativo, no bloquea ----');
    for (var vnf = 0; vnf < m.viajes_no_facturados.length; vnf++) {
      var vf = m.viajes_no_facturados[vnf];
      L.push('  - ref ' + vf.referencia + '  ' + (vf.origen || '?') + ' -> ' + (vf.destino || '?') + '  ' + (vf.kg || '?') + ' kg  ' + (vf.fecha || ''));
    }
  }
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
