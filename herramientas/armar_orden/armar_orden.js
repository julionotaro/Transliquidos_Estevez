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

// ---------- resolucion de tarifa: tabla -> analogia confirmada ----------
function resolverTarifa(razonSocial, origenCanon, destinoCanon, fIso, deps) {
  var r = tarifasMod.buscarTarifa(
    { cliente: razonSocial, origen: origenCanon, destino: destinoCanon, fecha: fIso },
    deps.tarifas
  );
  if (r.estado !== 'SIN_TARIFA' && r.tarifa) {
    return { precio: r.tarifa.valor, tipo: r.tarifa.tipo, via: r.estado, motivo: null };
  }
  // Cascada por ANALOGIA CONFIRMADA (destino real sin fila -> precio de otra ruta).
  var a = deps.analogias.find(function (c) {
    return cruce.norm(c.cliente) === cruce.norm(razonSocial)
      && cruce.norm(c.origen) === cruce.norm(origenCanon)
      && cruce.norm(c.destino_real) === cruce.norm(destinoCanon);
  });
  if (a) { return { precio: a.precio, tipo: 'tn', via: 'ANALOGIA->' + a.destino_tarifado, motivo: null }; }
  return { precio: null, tipo: null, via: 'SIN_TARIFA', motivo: r.motivo || 'sin tarifa ni analogia confirmada' };
}

// ---------- armado de un albaran ----------
function armarAlbaran(raw, choferNacionalidad, deps, avisos) {
  var ctx = (raw.referencia || '?');

  // cliente
  var ident = clientes.resolverCliente(raw.cliente_lit);
  var razon = ident.razonSocial || raw.cliente_lit;
  var codCli = clientesGesruta.codigoCliente(razon);

  // puntos (el raw trae el NOMBRE del punto que porta la tarifa)
  var ro = resolverPuntoMod.resolverPunto(raw.origen_lit, 'documento', deps.puntos);
  var rd = resolverPuntoMod.resolverPunto(raw.destino_lit, 'documento', deps.puntos);

  // material
  var codCarga = deps.materiales[String(raw.carga_lit || '').trim().toUpperCase()] || null;

  // tarifa
  var reg = reglaConcepto(razon);
  var fIso = fechaISO(raw.salida);
  var tar = resolverTarifa(razon, ro.nombre_canonico, rd.nombre_canonico, fIso, deps);

  // cantidad: minimo 23 TN (R-02)
  var tonsReal = (typeof raw.peso_kg === 'number') ? raw.peso_kg / 1000 : null;
  var tons = (tonsReal !== null) ? Math.max(tonsReal, MINIMO_TN) : null;

  var tarifaPendiente = (tar.precio === null);
  if (ident.motivo) { avisos.push('[' + ctx + '] cliente: ' + ident.motivo); }
  if (codCli.motivo) { avisos.push('[' + ctx + '] cod cliente: ' + codCli.motivo); }
  if (ro.revisar) { avisos.push('[' + ctx + '] origen: ' + ro.motivo); }
  if (rd.revisar) { avisos.push('[' + ctx + '] destino: ' + rd.motivo); }
  if (!codCarga) { avisos.push('[' + ctx + '] carga sin codigo: "' + raw.carga_lit + '"'); }
  if (tarifaPendiente) { avisos.push('[' + ctx + '] TARIFA PENDIENTE: ' + tar.motivo); }

  var alb = {
    cliente: { codigo: codCli.codigo, esperado: razon },
    origen: { codigo: ro.id_punto, esperado: ro.nombre_canonico },
    destino: { codigo: rd.id_punto, esperado: rd.nombre_canonico },
    carga: { codigo: codCarga, esperado: String(raw.carga_lit || '').trim().toUpperCase() },
    referencia: String(raw.referencia),
    salida: raw.salida,
    llegada: raw.llegada,
    lineas: {},
    km: {
      inicio: String(raw.km_inicio),
      fin: String(raw.km_fin),
      carga: String(raw.km_fin - raw.km_inicio),
    },
    tarifa_pendiente: tarifaPendiente,
  };

  if (!tarifaPendiente) {
    var porteImporte = tons * tar.precio;
    alb.lineas.porte = {
      um: 'TN',
      cantidad: fmt(tons, 3),
      precio: fmt(tar.precio, 2),
      concepto_esperado: reg.concepto,
      iva_esperado: reg.iva,
    };
    // indexacion por linea
    var grupo = idxMod.grupoIndexacion(razon).grupo;
    var hit = idxMod.buscarPct(grupo, fIso, deps.indexacion);
    if (hit && !hit.ambiguo && hit.pct != null) {
      alb.lineas.indexacion = {
        concepto: reg.idx,
        cantidad: fmt(porteImporte, 2),
        factor: fmt(hit.pct, 4),
      };
    } else {
      alb.lineas.indexacion = null;
      avisos.push('[' + ctx + '] indexacion sin tramo vigente: ' + grupo + ' @ ' + fIso + (hit && hit.ambiguo ? ' (ambiguo)' : ''));
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
      albaranes: (v.albaranes || []).map(function (a) { return armarAlbaran(a, nacionalidad, deps, avisos); }),
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
