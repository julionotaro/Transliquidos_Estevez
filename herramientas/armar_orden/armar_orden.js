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
  var c = cruce.norm(razonSocial);
  if (c.indexOf('BRESFOR') >= 0) { return { concepto: 'PI', iva: '0', idx: 'GPT' }; }
  if (c.indexOf('RNM') >= 0) { return { concepto: 'PI', iva: '0', idx: 'GPT' }; }
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
  if (codCli.motivo) { avisos.push('[' + ctx + '] cod cliente: ' + codCli.motivo); }
  if (!po.ok) { avisos.push('[' + ctx + '] origen: ' + po.aviso); }
  if (!pd.ok) { avisos.push('[' + ctx + '] destino: ' + pd.aviso); }
  if (!codCarga) { avisos.push('[' + ctx + '] carga sin codigo: "' + raw.carga_lit + '"'); }
  if (tarifaPendiente) { avisos.push('[' + ctx + '] TARIFA PENDIENTE: ' + tar.motivo); }

  var km = {
    inicio: String(raw.km_inicio),
    fin: String(raw.km_fin),
    carga: String(raw.km_fin - raw.km_inicio),
  };
  // Autonomo: el vacio va explicito (sus km se cargan en Gastos). Lo leo de la ficha.
  if (typeof raw.km_vacio === 'number') { km.vacio = String(raw.km_vacio); }
  // Duotrailer 2a cisterna: el bot saltea el formulario de km (ya se cuenta en el lider).
  if (duoSec) { km.cargar = false; }

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

  if (!tarifaPendiente) {
    var porteImporte;
    if (precioFijo !== null) {
      porteImporte = precioFijo;
      alb.lineas.porte = { um: 'UN', cantidad: '1', precio: fmt(precioFijo, 2), concepto_esperado: reg.concepto, iva_esperado: reg.iva };
    } else {
      porteImporte = tons * tar.precio;
      alb.lineas.porte = { um: 'TN', cantidad: fmt(tons, 3), precio: fmt(tar.precio, 2), concepto_esperado: reg.concepto, iva_esperado: reg.iva };
    }
    // BALTRANSA: linea de indexacion fija en cero (cantidad 1, factor 0) — regla R-04.
    if (esBaltransa) {
      alb.lineas.indexacion = { concepto: reg.idx, cantidad: '1', factor: '0' };
    } else {
      // indexacion por linea (acumulada -> cargar:false, para control de totales)
      var grupo = idxMod.grupoIndexacion(razon).grupo;
      var hit = idxMod.buscarPct(grupo, fIso, deps.indexacion);
      if (hit && !hit.ambiguo && hit.pct != null) {
        alb.lineas.indexacion = { concepto: reg.idx, cantidad: fmt(porteImporte, 2), factor: fmt(hit.pct, 4) };
        if (esIdxAcumulada(razon, po.esperado, pd.esperado)) { alb.lineas.indexacion.cargar = false; }
      } else {
        avisos.push('[' + ctx + '] indexacion sin tramo vigente: ' + grupo + ' @ ' + fIso + (hit && hit.ambiguo ? ' (ambiguo)' : ''));
      }
    }
  }
  return alb;
}

// ---------- armado de la orden completa ----------
function armarOrden(raw, deps) {
  deps = deps || cargarDeps();
  var avisos = [];
  var nacionalidad = tipoChofer(raw.chofer);
  var viajes = (raw.viajes || []).map(function (v) {
    var cabecera = {
      cabeza: raw.cabeza,
      verificar: { matricula: v.matricula, remolque: v.remolque, chofer: raw.chofer },
      tipo: nacionalidad,
    };
    if (v.duo_secundario) { cabecera.duo_secundario = true; }
    return {
      cabecera: cabecera,
      albaranes: (v.albaranes || []).map(function (a) { return armarAlbaran(a, nacionalidad, deps, avisos, !!v.duo_secundario); }),
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
    rnm: datos.cargarTarifarioRNM(),
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
