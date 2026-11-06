// ===== ARMADOR DE orden.json (Corrida 2) =====================================
//
// Toma HECHOS CRUDOS (lo que un humano lee con la vista de la ficha+docs) y
// hace la parte DETERMINISTICA: resuelve codigos (cliente/punto/material),
// busca tarifa (tabla + cascada por analogia CONFIRMADA), grupo+factor de
// indexacion, aplica minimo 23 TN, calcula el porte y formatea los numeros
// al estilo ES. Emite los `viajes` del orden.json segun el CONTRATO.
//
// REUSA los modulos ya testeados (ficha/*.js, catalogo/*.js). No reimplementa
// reglas: las lee. NUNCA inventa una tarifa: si no hay fila ni analogia
// confirmada, marca tarifa_pendiente con motivo (falla ruidoso).
//
// ALCANCE Corrida 2 (deliberado): resuelve la mitad deterministica. Lo que NO
// hace todavia y queda para corridas siguientes: leer la ficha (vision), elegir
// que NOMBRE de punto usar cuando el documento trae una direccion larga o un
// destino sin tarifa propia (ese criterio sigue siendo humano por ahora), y las
// reglas capa-3 procedurales (duotrailer, autonomo en Gastos, FORESTAL fijo,
// BALTRANSA idx-0, DIVERSEY->BALTRANSA). El `raw` que recibe ya trae el NOMBRE
// del punto que porta la tarifa (ej. VALLADOLID, COGERSA), no la direccion cruda.
'use strict';

var path = require('path');
var fs = require('fs');

var clientes = require('../../ficha/clientes.js');            // resolverCliente
var clientesGesruta = require('../../catalogo/clientes-gesruta.js'); // codigoCliente
var resolverPuntoMod = require('../../catalogo/resolver-punto.js');  // resolverPunto
var tarifasMod = require('../../ficha/tarifas.js');           // buscarTarifa
var idxMod = require('../../ficha/indexacion.js');            // grupoIndexacion, buscarPct
var conductoresMod = require('../../ficha/conductores.js');   // tipoConductor
var periodoMod = require('../../ficha/periodo-facturacion.js'); // SERVICIOS_AGREGADOS_FORESA
var cruce = require('../../ficha/cruce.js');                  // norm
var datos = require('./lib/datos.js');

// ---------- formato ES (miles '.', decimal ',') ----------
function fmt(n, dec) {
  var s = Number(n).toFixed(dec);
  var partes = s.split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return partes.length > 1 ? partes[0] + ',' + partes[1] : partes[0];
}
function fechaISO(ddmmaaaa) {
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(ddmmaaaa || '').trim());
  return m ? (m[3] + '-' + m[2] + '-' + m[1]) : null;
}

var MINIMO_TN = 23; // R-02

// ---------- reglas capa-3 minimas que este alcance necesita ----------
// Concepto/IVA e indexacion (nacional vs internacional) por cliente.
// Capa 2 cubre FORESA/QUIMIDROGA nacional (P/21/G). BRESFOR y RNM internacional.
// HELM y QUIMIDROGA-Portugal (nacional pese a destino PT) quedan para corrida 3.
function reglaConcepto(razonSocial) {
  // REGLA (Julio): el concepto/IVA depende de la NACIONALIDAD DEL CLIENTE, NO del
  // origen/destino del viaje. Cliente PORTUGUES -> PI / IVA 0 / GPT; ESPANOL -> P / 21 / G.
  // Ej: RNM y BRESFOR (portuguesas) siempre PI/0 aunque el viaje sea dentro de Espana;
  // Baltransa, Quimidroga, Helm (espanolas) siempre P/21 aunque descarguen en Portugal.
  var c = cruce.norm(razonSocial);
  var esPortugues = (
    c.indexOf('BRESFOR') >= 0 || c.indexOf('RNM') >= 0 ||
    c.indexOf('QUIMIDROGA PORTUGAL') >= 0 || c.indexOf('LIQUIADUBOS') >= 0 ||
    c.indexOf(' LDA') >= 0 || /\bLDA$/.test(c)   // sufijo societario portugues "Lda"
  );
  if (esPortugues) { return { concepto: 'PI', iva: '0', idx: 'GPT' }; }
  return { concepto: 'P', iva: '21', idx: 'G' };
}

function tipoChofer(chofer) {
  var t = conductoresMod.tipoConductor(chofer);
  var s = (typeof t === 'object' && t) ? (t.tipo || t.resultado || t.valor || '') : t;
  return String(s || '').toLowerCase().indexOf('auton') >= 0 ? 'autonomo' : 'propio';
}

// Usa un punto resuelto SOLO si la confianza es 'alta' (match exacto canonico/alias).
// Si no (p.ej. una direccion que menciona una provincia), deja codigo null + el
// literal: "null antes que invencion plausible". Marca revisar.
function puntoResuelto(res, literal) {
  if (res && res.id_punto && res.confianza === 'alta') {
    return { codigo: res.id_punto, esperado: res.nombre_canonico, ok: true, aviso: null };
  }
  return { codigo: null, esperado: literal, ok: false, aviso: res && res.motivo ? res.motivo : 'punto no resuelto con confianza alta' };
}

// RNM factura por EUR/TN de su tarifario propio (regla: usar EUR/TN sobre EUR/viaje).
function tarifaRNM(origenCanon, destinoCanon, deps) {
  for (var i = 0; i < deps.rnm.length; i++) {
    var r = deps.rnm[i];
    if (cruce.coincideTexto(origenCanon, r.origen) && cruce.coincideTexto(destinoCanon, r.destino)) {
      var tn = parseFloat(String(r.eur_tn).replace(',', '.'));
      if (isFinite(tn)) { return tn; }
    }
  }
  return null;
}

// Filtra la tabla a filas cuyo material coincide con la carga o es generico
// ('Cualquiera'/vacio). Desambigua rutas con varias tarifas por material (ej.
// Caldas->Orember COLA 13,85 vs FINCAT 20,16). Nunca bloquea: si el filtro deja
// 0 filas se usa la tabla completa (lo decide el que llama con un fallback).
function filtrarPorMaterial(tarifas, materialNombre) {
  var m = cruce.norm(materialNombre || '');
  if (!m) { return tarifas; }
  var f = tarifas.filter(function (r) {
    var rm = cruce.norm(r.material || '');
    return rm === m || rm === 'CUALQUIERA' || rm === '';
  });
  return f.length ? f : tarifas;
}

// ---------- resolucion de tarifa: RNM-tarifario / tabla(material) / analogia ----------
function resolverTarifa(razonSocial, origenCanon, destinoCanon, materialNombre, fIso, deps) {
  // RNM: tarifario propio, EUR/TN.
  if (cruce.norm(razonSocial).indexOf('RNM') >= 0) {
    var tn = tarifaRNM(origenCanon, destinoCanon, deps);
    if (tn !== null) { return { precio: tn, tipo: 'tn', via: 'RNM-tarifario', motivo: null }; }
    // sin ruta en el tarifario RNM -> sigue a tabla/analogia (y si nada, pending).
  }
  var consulta = { cliente: razonSocial, origen: origenCanon, destino: destinoCanon, fecha: fIso };
  // 1) tabla filtrada por material (desambigua), 2) tabla completa (no bloquear por material).
  var filt = filtrarPorMaterial(deps.tarifas, materialNombre);
  var r = tarifasMod.buscarTarifa(consulta, filt);
  if (r.estado === 'SIN_TARIFA' && filt !== deps.tarifas) {
    r = tarifasMod.buscarTarifa(consulta, deps.tarifas);
  }
  if (r.estado !== 'SIN_TARIFA' && r.tarifa) {
    return { precio: r.tarifa.valor, tipo: r.tarifa.tipo, via: r.estado, motivo: null };
  }
  // 2b) TARIFA CONFIRMADA por Julio (overlay fuera del export). Match cliente+origen+destino (+material).
  var cf = deps.confirmadas.find(function (t) {
    return cruce.norm(t.cliente) === cruce.norm(razonSocial)
      && cruce.coincideTexto(origenCanon, t.origen)
      && cruce.coincideTexto(destinoCanon, t.destino)
      && (!t.material || cruce.norm(t.material) === cruce.norm(materialNombre));
  });
  if (cf) { return { precio: cf.precio, tipo: 'tn', via: 'confirmada-julio', motivo: null }; }
  // 3) Cascada por ANALOGIA CONFIRMADA (destino real sin fila -> precio de otra ruta).
  var a = deps.analogias.find(function (c) {
    return cruce.norm(c.cliente) === cruce.norm(razonSocial)
      && cruce.norm(c.origen) === cruce.norm(origenCanon)
      && cruce.norm(c.destino_real) === cruce.norm(destinoCanon);
  });
  if (a) { return { precio: a.precio, tipo: 'tn', via: 'ANALOGIA->' + a.destino_tarifado, motivo: null }; }
  return { precio: null, tipo: null, via: 'SIN_TARIFA', motivo: r.motivo || 'sin tarifa ni analogia confirmada' };
}

// Servicio FORESA con indexacion ACUMULADA (no linea por albaran): destino OREMBER
// (cualquier origen) o Villagarcia->Caldas metanol. Reusa SERVICIOS_AGREGADOS_FORESA.
function esIdxAcumulada(razonSocial, origenCanon, destinoCanon) {
  var c = cruce.norm(razonSocial);
  if (c.indexOf('FORESA') < 0 && c.indexOf('BRESFOR') < 0) { return false; }
  return periodoMod.SERVICIOS_AGREGADOS_FORESA.some(function (s) {
    var okOri = (s.origen === null) || cruce.coincideTexto(origenCanon, s.origen);
    return okOri && cruce.coincideTexto(destinoCanon, s.destino);
  });
}

// ---------- CLAVO FOOD FACTORY (FRIGOS): facturacion POR KM ----------
// Modelo distinto a los clientes quimicos (ver docs/cliente-CLAVO-frigos.md):
// importe = km con carga x EUR/km (sentido S=salida / R=retorno) o importe FIJO
// (U=Tordesillas-Reinosa, C=cercanias). Concepto P / IVA 21 (CLAVO es espanol).
// Indexacion AGREGADA como FORESA (cargar:false, se cierra en facturacion),
// concepto G, factor = % mensual de CLAVO. La tarifa la RESUELVE el armador por
// sentido + mes (tarifas-clavo.json); NO se teclea del talon.
function mesDeFecha(fechaDDMMYYYY) {
  var iso = fechaISO(fechaDDMMYYYY); // YYYY-MM-DD
  return iso ? iso.slice(0, 7) : null; // YYYY-MM
}

// Campo2 de Gesruta: todos los destinos de un multi-reparto, abreviados, <=19
// caracteres para que entren en la factura (regla Julio 06/11).
function abreviarPuntos(destinos, maxLen) {
  if (!destinos || !destinos.length) { return null; }
  var abv = destinos.map(function (d) {
    var s = cruce.norm(d).replace(/[^A-Z0-9 ]/g, '').trim();
    return s.length > 5 ? s.slice(0, 5) : s;
  });
  var out = abv.join('/');
  return (out.length > maxLen) ? out.slice(0, maxLen) : out;
}

// Deriva el SENTIDO (S/R/U/C) de origen+destino+km, replicando la formula de la
// columna L del Excel FRIGOS (Julio 06/11). Bases: Caldas de Reis y Tordesillas.
//   km<110 -> C (cercanias) ; Tordesillas<->Reinosa -> U ; destino Caldas -> R ;
//   origen Caldas/Tordesillas -> S ; destino Tordesillas -> R ; si no -> null.
function derivarSentido(origenEsperado, destinoEsperado, km) {
  if (km === 0) { return null; }
  if (km != null && km < 110) { return 'C'; }
  var o = cruce.norm(origenEsperado || '');
  var d = cruce.norm(destinoEsperado || '');
  function has(s, t) { return s.indexOf(t) >= 0; }
  if ((has(o, 'TORDESILLAS') && has(d, 'REINOSA')) || (has(o, 'REINOSA') && has(d, 'TORDESILLAS'))) { return 'U'; }
  if (has(d, 'CALDAS')) { return 'R'; }
  if (has(o, 'CALDAS') || has(o, 'TORDESILLAS')) { return 'S'; }
  if (has(d, 'TORDESILLAS')) { return 'R'; }
  return null;
}

function armarAlbaranKm(raw, ctx, codCli, esperadoCli, po, pd, codCarga, cargaNom, deps, avisos, duoSec) {
  var clavo = deps.clavo;
  var mes = mesDeFecha(raw.salida);

  // km con carga: preferir km_facturable; si no, odometro fin - inicio.
  var km = null;
  if (typeof raw.km_facturable === 'number') { km = raw.km_facturable; }
  else if (typeof raw.km_inicio === 'number' && typeof raw.km_fin === 'number') { km = raw.km_fin - raw.km_inicio; }

  // SENTIDO: lo trae el raw, o se DERIVA de origen/destino/km (formula columna L).
  var sentido = raw.sentido ? String(raw.sentido).toUpperCase() : derivarSentido(po.esperado, pd.esperado, km);
  if (!sentido) { avisos.push('[' + ctx + '] CLAVO: no se pudo derivar el sentido (origen/destino/km) -> revisar'); }
  var tarMes = (clavo.tarifas_km && clavo.tarifas_km[mes]) || null;

  // porte + importe segun sentido
  var importe = null;
  var porte;
  if (sentido === 'S' || sentido === 'R') {
    var precioKm = tarMes ? tarMes[sentido] : null;
    if (precioKm == null) { avisos.push('[' + ctx + '] TARIFA PENDIENTE: CLAVO sin EUR/km para sentido ' + sentido + ' en ' + mes); }
    if (km != null && precioKm != null) { importe = km * precioKm; }
    porte = {
      um: 'TN', // Gesruta muestra TN aunque el numero sea KM (cosmetico)
      cantidad: (km != null) ? fmt(km, 3) : null,
      precio: (precioKm != null) ? fmt(precioKm, 4) : null,
      concepto_esperado: clavo.concepto,
      iva_esperado: clavo.iva,
    };
  } else if (sentido === 'U' || sentido === 'C') {
    var fijo = tarMes ? (sentido === 'U' ? tarMes.reinosa : tarMes.cercanias) : null;
    if (fijo == null) { avisos.push('[' + ctx + '] TARIFA PENDIENTE: CLAVO sin importe fijo (' + sentido + ') en ' + mes); }
    importe = fijo;
    // Importe fijo (U=Reinosa, C=cercanias): se entra como um UN, cantidad 1, precio=fijo
    // (confirmado con la pantalla de Gesruta de Julio, 06/11: Reinosa 315,00).
    porte = {
      um: 'UN', cantidad: '1',
      precio: (fijo != null) ? fmt(fijo, 2) : null,
      concepto_esperado: clavo.concepto,
      iva_esperado: clavo.iva,
    };
  } else {
    avisos.push('[' + ctx + '] CLAVO sin sentido S/R/U/C -> no se resuelve la tarifa (revisar)');
    porte = { um: 'TN', cantidad: (km != null) ? fmt(km, 3) : null, precio: null, concepto_esperado: clavo.concepto, iva_esperado: clavo.iva };
  }
  var tarifaPendiente = (porte.precio === null);

  // INDEXACION AGREGADA (como FORESA): linea con cargar:false, concepto G, base = importe del porte,
  // factor = % mensual de CLAVO (si falta el mes -> factor null, se cierra en facturacion).
  var idxPct = (clavo.indexacion_pct && clavo.indexacion_pct[mes] != null) ? clavo.indexacion_pct[mes] : null;
  var indexacion = {
    concepto: clavo.idx_concepto,
    cantidad: (importe != null) ? fmt(importe, 2) : null,
    factor: (idxPct != null) ? fmt(idxPct, 4) : null,
    cargar: false,
  };
  if (idxPct == null) { avisos.push('[' + ctx + '] CLAVO indexacion: falta el % del mes ' + mes + ' (agregada, se cierra en facturacion) -> factor vacio'); }

  // KM (form Kilometros): 1 apunte por viaje, km carga = km total con carga, km vacio.
  var kmBlock;
  if (raw.km_pendiente || km == null) {
    kmBlock = { pendiente: true };
    avisos.push('[' + ctx + '] km PENDIENTE (no leido en la ficha/parte)');
  } else {
    kmBlock = { carga: String(km) };
    if (typeof raw.km_inicio === 'number') { kmBlock.inicio = String(raw.km_inicio); }
    if (typeof raw.km_fin === 'number') { kmBlock.fin = String(raw.km_fin); }
    if (typeof raw.km_vacio === 'number') { kmBlock.vacio = String(raw.km_vacio); }
    if (duoSec) { kmBlock.cargar = false; }
  }

  // Orden de campos = el ORDEN DE CARGA en la pantalla Entrada de Albaranes: cabecera del albaran
  // (cliente/origen/destino/carga/ref/fechas) -> Campo1/Campo2 -> lineas (porte/indexacion) -> km.
  var alb = {
    cliente: { codigo: codCli.codigo, esperado: esperadoCli },
    origen: { codigo: po.codigo, esperado: po.esperado },
    destino: { codigo: pd.codigo, esperado: pd.esperado },
    carga: { codigo: codCarga, esperado: cargaNom },
    referencia: String(raw.referencia != null ? raw.referencia : ''),
    salida: raw.salida,
    llegada: raw.llegada,
    facturacion: 'km',
    sentido: sentido || null,
  };
  // MULTI-PUNTO (Julio 06/11): campos SEPARADOS de Gesruta (se escriben DESPUES de las fechas y
  // ANTES de la linea de porte, igual que en la pantalla):
  //  - Campo1 = TODOS los puntos de la CARGA (origenes); Origen = 1er punto de la carga.
  //  - Campo2 = TODOS los puntos del REPARTO (destinos); Destino = ultimo punto del reparto.
  // Cada lista abreviada (<=19 car. para que entre en la factura). Las listas completas
  // (origenes/destinos) se guardan para la columna Origen/Destino del Excel (nombres con '+').
  if (raw.origenes && raw.origenes.length > 1) {
    alb.origenes = raw.origenes;
    alb.campo1 = abreviarPuntos(raw.origenes, 19);
  }
  if (raw.destinos && raw.destinos.length > 1) {
    alb.destinos = raw.destinos;
    alb.campo2 = abreviarPuntos(raw.destinos, 19);
  }
  alb.lineas = { porte: porte, indexacion: indexacion };
  alb.km = kmBlock;
  alb.tarifa_pendiente = tarifaPendiente;
  return alb;
}

// ---------- armado de un albaran ----------
function armarAlbaran(raw, choferNacionalidad, deps, avisos, duoSec) {
  var ctx = (raw.referencia || '?');

  // cliente: razon social para tarifa (clientes.js) + codigo/nombre Gesruta (clientes-gesruta.js)
  var ident = clientes.resolverCliente(raw.cliente_lit);
  var razon = ident.razonSocial || raw.cliente_lit;
  var codCli = clientesGesruta.codigoCliente(ident.razonSocial || raw.cliente_lit);
  var esperadoCli = codCli.nombre || ident.razonSocial || raw.cliente_lit;

  // puntos: solo si confianza alta; si no, null + literal (revisar).
  var po = puntoResuelto(resolverPuntoMod.resolverPunto(raw.origen_lit, 'documento', deps.puntos), raw.origen_lit);
  var pd = puntoResuelto(resolverPuntoMod.resolverPunto(raw.destino_lit, 'documento', deps.puntos), raw.destino_lit);

  // material
  var cargaNom = String(raw.carga_lit || '').trim().toUpperCase();
  var codCarga = deps.materiales[cargaNom] || null;

  // CLAVO FOOD FACTORY (FRIGOS) -> facturacion POR KM (modelo aparte). Disparador: cliente
  // resuelve a codigo 4, o el raw declara facturacion:'km'. Ver armarAlbaranKm.
  var esClavo = (codCli.codigo === '4') || (raw.facturacion === 'km');
  if (esClavo) {
    if (codCli.motivo) { avisos.push('[' + ctx + '] cod cliente: ' + codCli.motivo); }
    if (!po.ok) { avisos.push('[' + ctx + '] origen: ' + po.aviso); }
    if (!pd.ok) { avisos.push('[' + ctx + '] destino: ' + pd.aviso); }
    if (!codCarga) { avisos.push('[' + ctx + '] carga sin codigo: "' + raw.carga_lit + '"'); }
    return armarAlbaranKm(raw, ctx, codCli, esperadoCli, po, pd, codCarga, cargaNom, deps, avisos, duoSec);
  }

  // PRECIO FIJO del documento (HELM/BALTRANSA/FORESTAL): um=UN, cantidad 1. Lo leo yo
  // de la OC y lo paso en el raw; no sale de tarifario.
  var precioFijo = (typeof raw.precio_fijo === 'number') ? raw.precio_fijo : null;
  var esBaltransa = (codCli.codigo === '10') || (cruce.norm(esperadoCli).indexOf('BALTRANSA') >= 0);

  var reg = reglaConcepto(razon);
  var fIso = fechaISO(raw.salida);
  var tar = (precioFijo === null)
    ? resolverTarifa(razon, po.esperado, pd.esperado, cargaNom, fIso, deps)
    : { precio: precioFijo, tipo: 'fijo', via: 'precio_fijo_OC', motivo: null };

  // cantidad: minimo 23 TN (R-02); no aplica a precio fijo (um=UN, cantidad 1)
  var tonsReal = (typeof raw.peso_kg === 'number') ? raw.peso_kg / 1000 : null;
  var tons = (tonsReal !== null) ? Math.max(tonsReal, MINIMO_TN) : null;

  var tarifaPendiente = (tar.precio === null);

  // PESO (D-01 / R-08): para facturar por TN el peso sale del ALBARAN/CMR de carga, NUNCA de la OC
  // (la OC trae el "previsto redondo"). Si falta el documento de peso (solo OC), el raw marca
  // "peso_pendiente": true y aqui se deja el porte PENDIENTE (REVISAR) en vez de facturar un peso
  // que no manda. Solo aplica cuando la TARIFA ya esta resuelta; si la tarifa tambien esta
  // pendiente el albaran ya queda pendiente y no hace falta marcarlo por peso.
  var pesoPendiente = (precioFijo === null) && !tarifaPendiente && (raw.peso_pendiente === true || tonsReal === null);
  // Guarda barata: un peso exactamente redondo (multiplo de 1000) en modo TN huele a previsto de
  // la OC. Se avisa para verificar contra el albaran/CMR antes de facturar.
  if (precioFijo === null && !tarifaPendiente && typeof raw.peso_kg === 'number' && raw.peso_kg % 1000 === 0 && raw.peso_ok_redondo !== true) {
    avisos.push('[' + ctx + '] peso ' + raw.peso_kg + ' exactamente redondo: posible PREVISTO de la OC (D-01: el peso factura del albaran/CMR, nunca de la OC). Verificar; si es real marcar peso_ok_redondo, si falta el documento marcar peso_pendiente.');
  }
  if (codCli.motivo) { avisos.push('[' + ctx + '] cod cliente: ' + codCli.motivo); }
  if (!po.ok) { avisos.push('[' + ctx + '] origen: ' + po.aviso); }
  if (!pd.ok) { avisos.push('[' + ctx + '] destino: ' + pd.aviso); }
  if (!codCarga) { avisos.push('[' + ctx + '] carga sin codigo: "' + raw.carga_lit + '"'); }
  if (tarifaPendiente) { avisos.push('[' + ctx + '] TARIFA PENDIENTE: ' + tar.motivo); }

  // KM: si faltan (no leidos en la ficha) o se marcan pendientes, se deja el bloque
  // en pendiente en vez de inventar un km. El bot/humano lo completa luego.
  var km;
  if (raw.km_pendiente || typeof raw.km_inicio !== 'number' || typeof raw.km_fin !== 'number') {
    km = { pendiente: true };
    avisos.push('[' + ctx + '] km PENDIENTE (no leido en la ficha)');
  } else {
    km = {
      inicio: String(raw.km_inicio),
      fin: String(raw.km_fin),
      carga: String(raw.km_fin - raw.km_inicio),
    };
    // Autonomo: el vacio va explicito (sus km se cargan en Gastos). Lo leo de la ficha.
    if (typeof raw.km_vacio === 'number') { km.vacio = String(raw.km_vacio); }
    // Duotrailer 2a cisterna: el bot saltea el formulario de km (ya se cuenta en el lider).
    if (duoSec) { km.cargar = false; }
  }

  var alb = {
    cliente: { codigo: codCli.codigo, esperado: esperadoCli },
    origen: { codigo: po.codigo, esperado: po.esperado },
    destino: { codigo: pd.codigo, esperado: pd.esperado },
    carga: { codigo: codCarga, esperado: cargaNom },
    referencia: String(raw.referencia),
    salida: raw.salida,
    llegada: raw.llegada,
    lineas: { porte: null, indexacion: null },
    km: km,
    tarifa_pendiente: tarifaPendiente,
  };
  if (pesoPendiente) {
    alb.peso_pendiente = true;
    avisos.push('[' + ctx + '] PESO PENDIENTE: falta documento de peso (albaran/CMR); no se factura el peso de la OC (D-01) -> REVISAR, completar con el peso real.');
  }

  // LINEAS — RESILIENCIA (Julio 05/11): se completan TODAS las lineas posibles y se deja en null SOLO
  // el dato que falta (la TARIFA -> precio null; el PESO/TN -> cantidad null). El bot carga lo lleno y
  // deja vacio ese campo; NO deja el albaran sin lineas ni aborta por un dato puntual. (El aborto es
  // solo si faltan los datos BASICOS del viaje: cabecera/matricula.) Los flags tarifa_pendiente /
  // peso_pendiente indican cual es el dato que falta.
  var porteImporte = null;
  if (precioFijo !== null) {
    porteImporte = precioFijo;
    alb.lineas.porte = { um: 'UN', cantidad: '1', precio: fmt(precioFijo, 2), concepto_esperado: reg.concepto, iva_esperado: reg.iva };
  } else {
    if (tons !== null && tar.precio !== null) { porteImporte = tons * tar.precio; }
    alb.lineas.porte = {
      um: 'TN',
      cantidad: (tons !== null) ? fmt(tons, 3) : null,      // null si falta el PESO (peso_pendiente)
      precio: (tar.precio !== null) ? fmt(tar.precio, 2) : null, // null si falta la TARIFA (tarifa_pendiente)
      concepto_esperado: reg.concepto,
      iva_esperado: reg.iva,
    };
  }
  // INDEXACION
  if (esBaltransa) {
    // BALTRANSA: linea de indexacion fija en cero (cantidad 1, factor 0) — regla R-04.
    alb.lineas.indexacion = { concepto: reg.idx, cantidad: '1', factor: '0' };
  } else if (raw.idx_incluida === true) {
    // Precio fijo con INDEXACION INCLUIDA en el precio (FORESTAL, COMATRA): no hay linea de idx.
    alb.lineas.indexacion = null;
  } else {
    // indexacion por linea (acumulada -> cargar:false, para control de totales)
    var grupo = idxMod.grupoIndexacion(razon).grupo;
    var hit = idxMod.buscarPct(grupo, fIso, deps.indexacion);
    if (hit && !hit.ambiguo && hit.pct != null) {
      alb.lineas.indexacion = { concepto: reg.idx, cantidad: (porteImporte !== null) ? fmt(porteImporte, 2) : null, factor: fmt(hit.pct, 4) };
      if (esIdxAcumulada(razon, po.esperado, pd.esperado)) { alb.lineas.indexacion.cargar = false; }
    } else {
      avisos.push('[' + ctx + '] indexacion sin tramo vigente: ' + grupo + ' @ ' + fIso + (hit && hit.ambiguo ? ' (ambiguo)' : ''));
    }
  }
  // REPARTO (D-08): doble destino -> linea con codigo REP (cantidad 1, precio 90 por defecto), FUERA
  // de la base de indexacion. Se declara en el raw con "reparto": <importe>.
  if (typeof raw.reparto === 'number') {
    alb.lineas.reparto = { concepto: 'REP', cantidad: '1', precio: fmt(raw.reparto, 2) };
  }
  return alb;
}

// ¿comparten algun token significativo (>=3) los dos nombres? (para no marcar falso
// positivo entre "MARCOS" y "MARCOS EIRIN FERNANDEZ").
function nombresCompatibles(a, b) {
  var ta = cruce.norm(a).split(' ').filter(function (t) { return t.length >= 3; });
  var tb = cruce.norm(b).split(' ').filter(function (t) { return t.length >= 3; });
  for (var i = 0; i < ta.length; i++) { if (tb.indexOf(ta[i]) >= 0) { return true; } }
  return false;
}

// La CABECERA se resuelve por la MATRICULA contra el padron de flota (la verdad:
// chofer + tipo propio/autonomo + remolque habitual). La lectura de la ficha solo
// VERIFICA; si no coincide, se avisa ruidoso. Asi un error de lectura del nombre o
// una matricula mal leida (3/8, 4716/4916) no corrompe la orden: o manda flota, o
// se marca para revisar.
function resolverCabecera(raw, v, avisos) {
  var ctx = 'cabecera ' + (v.matricula || '?');
  var fl = raw._deps_flota[v.matricula];
  if (!fl) {
    avisos.push('[' + ctx + '] matricula NO esta en el padron de flota -> uso la lectura, VERIFICAR (posible mala lectura de la matricula)');
    return { chofer: raw.chofer || null, remolque: v.remolque || null, tipo: tipoChofer(raw.chofer) };
  }
  if (raw.chofer && !nombresCompatibles(raw.chofer, fl.chofer)) {
    avisos.push('[' + ctx + '] chofer leido "' + raw.chofer + '" != flota "' + fl.chofer + '" -> manda flota');
  }
  var remolque = v.remolque || fl.remolque;
  if (v.remolque && cruce.norm(v.remolque) !== cruce.norm(fl.remolque)) {
    avisos.push('[' + ctx + '] remolque leido "' + v.remolque + '" != habitual flota "' + fl.remolque + '" -> uso el leido (cambio de remolque)');
  }
  return { chofer: fl.chofer, remolque: remolque, tipo: fl.tipo };
}

// ---------- armado de la orden completa ----------
function armarOrden(raw, deps) {
  deps = deps || cargarDeps();
  var avisos = [];
  raw._deps_flota = deps.flota;
  var viajes = (raw.viajes || []).map(function (v) {
    var cab = resolverCabecera(raw, v, avisos);
    var cabecera = {
      cabeza: raw.cabeza,
      verificar: { matricula: v.matricula, remolque: cab.remolque, chofer: cab.chofer },
      tipo: cab.tipo,
    };
    if (v.duo_secundario) { cabecera.duo_secundario = true; }
    // PROVEEDOR (ej THEC): el viaje se carga en el perfil de TLE (empresa SIGUE siendo TLE), pero en
    // la pantalla de Entrada de Viajes la CABEZA lleva la palabra 'PROVE' (no el codigo de tractora),
    // la matricula se digita completa, y se agrega el campo proveedor (THEC = '5'). Disparador: que el
    // raw traiga 'proveedor'. KM: por defecto se dejan VACIOS (km_proveedor_vacio !== false).
    if (raw.proveedor) {
      cabecera.cabeza = 'PROVE';
      cabecera.proveedor = String(raw.proveedor);
    }
    var albaranes = (v.albaranes || []).map(function (a) { return armarAlbaran(a, cab.tipo, deps, avisos, !!v.duo_secundario); });
    if (raw.proveedor && raw.km_proveedor_vacio !== false) { albaranes.forEach(function (al) { al.km = { cargar: false }; }); }
    return {
      cabecera: cabecera,
      albaranes: albaranes,
    };
  });
  return { orden: { empresa: raw.empresa, viajes: viajes }, avisos: avisos };
}

function cargarDeps() {
  return {
    tarifas: datos.cargarTarifas(),
    indexacion: datos.cargarIndexacion(),
    puntos: datos.cargarPuntos(),
    materiales: datos.cargarMateriales(),
    analogias: datos.cargarAnalogiasConfirmadas(),
    confirmadas: datos.cargarTarifasConfirmadas(),
    rnm: datos.cargarTarifarioRNM(),
    flota: datos.cargarFlota(),
    clavo: datos.cargarClavo(),
  };
}

module.exports = { armarOrden: armarOrden, cargarDeps: cargarDeps, fmt: fmt, fechaISO: fechaISO };

// ---------- CLI: node armar_orden.js <raw.json> [salida.json] ----------
if (require.main === module) {
  var entrada = process.argv[2];
  if (!entrada) { console.error('uso: node armar_orden.js <raw.json> [salida.json]'); process.exit(2); }
  var raw = JSON.parse(fs.readFileSync(entrada, 'utf8'));
  var res = armarOrden(raw);
  var txt = JSON.stringify(res.orden, null, 2);
  if (process.argv[3]) { fs.writeFileSync(process.argv[3], txt + '\n'); console.error('escrito ' + process.argv[3]); }
  else { console.log(txt); }
  if (res.avisos.length) { console.error('\nAVISOS (' + res.avisos.length + '):'); res.avisos.forEach(function (a) { console.error('  - ' + a); }); }
}
