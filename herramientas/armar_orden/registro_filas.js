// ===== GENERADOR DE FILAS DEL REGISTRO (libro maestro) ========================
//
// Las filas de datos/registro-procesamiento.csv se escribian A MANO (28 columnas,
// el ';' en observaciones era un bug recurrente). Esta herramienta las GENERA a
// partir del raw + la orden que arma el armador: mismas cuentas, mismo formato,
// sin tipear nada. Una fila por albaran.
//
// uso:
//   node registro_filas.js <raw.json>                 muestra las filas (no escribe)
//   node registro_filas.js <raw.json> --agregar       las agrega al registro
//   node registro_filas.js --verificar                compara lo que generaria contra
//                                                     las filas historicas del registro
// opciones: --escaneo 20261103134233.pdf   (si el raw no trae "escaneo")
//           --fecha AAAA-MM-DD             (fecha_proceso; por defecto hoy)
//
// Convenciones del registro (las mismas de las filas existentes):
//   precio / base / total con PUNTO decimal; cantidad y factor con COMA.
//   base = porte + indexacion (aunque sea acumulada, para control) + reparto.
//   cantidad = lo facturado (con el minimo 23 TN aplicado); peso_real_kg = el real.
//   estado: PENDIENTE_CARGA | TARIFA_PENDIENTE | PESO_PENDIENTE | INDICE_PENDIENTE (falta el % del tramo).
//   CLAVO (por km): um "KM", cantidad = km con carga.
'use strict';

var fs = require('fs');
var path = require('path');
var armador = require('./armar_orden.js');
var datos = require('./lib/datos.js');

var REGISTRO = path.join(datos.ROOT, 'datos/registro-procesamiento.csv');
var COLUMNAS = 28;

function numES(s) { // "1.161,28" -> 1161.28
  if (s === null || s === undefined || s === '') { return null; }
  var n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : null;
}
function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
function p2(x) { return (x === null || x === undefined) ? '' : r2(x).toFixed(2); }
function limpio(s) { return String(s === null || s === undefined ? '' : s).replace(/;/g, ',').replace(/\s*\r?\n\s*/g, ' ').trim(); }
function hoyISO() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function mesDe(ddmmaaaa) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(ddmmaaaa || '')); return m ? m[3] + '-' + m[2] : null; }
function isoDe(ddmmaaaa) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(ddmmaaaa || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; }

function leerRegistro() {
  if (!fs.existsSync(REGISTRO)) { return []; }
  return fs.readFileSync(REGISTRO, 'utf8').split(/\r?\n/).slice(1).filter(function (l) { return l.length; }).map(function (l) { return l.split(';'); });
}

// Carpeta de procesados/ del cliente: la que ya usa ese codigo de cliente en el registro;
// si el cliente es nuevo, la primera palabra de su razon social (y se avisa).
function carpetaCliente(codigo, nombre, filas, avisos) {
  for (var i = 0; i < filas.length; i++) {
    if (filas[i][7] === String(codigo) && filas[i][26]) { return filas[i][26].split('/')[1]; }
  }
  if (String(codigo) === '4') { return 'CLAVO'; }
  var c = String(nombre || 'SIN_CLIENTE').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim().split(/\s+/)[0] || 'SIN_CLIENTE';
  avisos.push('cliente ' + codigo + ' sin carpeta previa en procesados/: uso "' + c + '" (verificar)');
  return c;
}

function importes(alb) {
  var L = alb.lineas || {};
  var p = L.porte || {};
  var cant = numES(p.cantidad), prec = numES(p.precio);
  if (cant === null || prec === null) { return { porte: null, idx: null, reparto: 0, base: null }; }
  var porte = r2(cant * prec);
  var factor = (L.indexacion && L.indexacion.factor !== null && L.indexacion.factor !== undefined) ? numES(L.indexacion.factor) : null;
  var idx = (L.indexacion && factor !== null) ? r2(porte * factor) : 0;
  var rep = L.reparto ? r2((numES(L.reparto.cantidad) || 1) * (numES(L.reparto.precio) || 0)) : 0;
  return { porte: porte, idx: idx, reparto: rep, base: r2(porte + idx + rep) };
}

function observacion(orden, viaje, alb, rawAlb, imp) {
  var cab = viaje.cabecera || {}, ver = cab.verificar || {}, L = alb.lineas || {}, p = L.porte || {};
  var t = [];
  t.push((ver.chofer || '?') + ' (' + (ver.matricula || '?') + '/' + (ver.remolque || '-') + ', ' + (cab.tipo || '?') + ')' + (cab.cabeza === 'PROVE' ? ' cargado como PROVE proveedor ' + cab.proveedor : '') + (orden.empresa === 'THEC' ? ' perfil THEC' : ''));
  t.push((alb.origen.esperado || '?') + '->' + (alb.destino.esperado || '?') + ' ' + (alb.carga.esperado || ''));
  if (alb.facturacion === 'km') { t.push('CLAVO por km, sentido ' + (alb.sentido || '?')); }
  if (p.precio) { t.push(p.precio + ' EUR/' + (alb.facturacion === 'km' && p.um === 'TN' ? 'KM' : p.um) + ' ' + p.concepto_esperado + ' IVA ' + p.iva_esperado); }
  if (L.indexacion) { t.push('Idx ' + L.indexacion.concepto + ' ' + (L.indexacion.factor === null ? 'PENDIENTE' : L.indexacion.factor) + (L.indexacion.cargar === false ? ' ACUMULADA (en base solo para control)' : '')); }
  else { t.push('Sin linea de indexacion'); }
  if (rawAlb && typeof rawAlb.peso_kg === 'number') {
    var fact = numES(p.cantidad);
    t.push('Peso real ' + rawAlb.peso_kg + ' kg' + (p.um === 'TN' && alb.facturacion !== 'km' && fact !== null && fact * 1000 > rawAlb.peso_kg ? ' (facturado minimo 23 TN)' : ''));
  }
  if (imp.base !== null) { t.push('Base = porte ' + p2(imp.porte) + (imp.idx ? ' + idx ' + p2(imp.idx) : '') + (imp.reparto ? ' + reparto ' + p2(imp.reparto) : '')); }
  if (alb.tarifa_pendiente) { t.push('TARIFA PENDIENTE'); }
  if (alb.peso_pendiente) { t.push('PESO PENDIENTE (falta documento de peso)'); }
  if (alb.campo1) { t.push('Campo1 ' + alb.campo1); }
  if (alb.campo2) { t.push('Campo2 ' + alb.campo2); }
  if (rawAlb && rawAlb._obs) { t.push(rawAlb._obs); }
  return limpio(t.join('. ') + '.');
}

// Devuelve { filas: [[28 celdas]...], avisos: [] } para un raw.
function filasDeRaw(raw, opciones) {
  opciones = opciones || {};
  var avisos = [];
  var existentes = opciones.existentes || leerRegistro();
  var res = armador.armarOrden(JSON.parse(JSON.stringify(raw)), opciones.deps);
  var orden = res.orden;
  var escaneo = opciones.escaneo || raw.escaneo || '';
  if (!escaneo) { avisos.push('falta el nombre del escaneo (clave "escaneo" en el raw o --escaneo): la columna juego_ficha_pdf queda vacia'); }
  var filas = [];
  orden.viajes.forEach(function (v, vi) {
    v.albaranes.forEach(function (a, ai) {
      var ra = ((raw.viajes[vi] || {}).albaranes || [])[ai] || {};
      var L = a.lineas || {}, p = L.porte || {}, km = a.km || {};
      var imp = importes(a);
      var esKm = a.facturacion === 'km';
      var iva = numES(p.iva_esperado);
      var um = (esKm && p.um === 'TN') ? 'KM' : (p.um || '');
      var cantidad = (p.cantidad === null || p.cantidad === undefined) ? '' : ((esKm && p.um === 'TN') ? String(numES(p.cantidad)) : p.cantidad);
      var factor = L.indexacion ? (L.indexacion.factor === null || L.indexacion.factor === undefined ? '' : L.indexacion.factor) : '0';
      var idxPend = !!(L.indexacion && L.indexacion.cargar !== false && (L.indexacion.factor === null || L.indexacion.factor === undefined));
      var estado = a.tarifa_pendiente ? 'TARIFA_PENDIENTE' : (a.peso_pendiente ? 'PESO_PENDIENTE' : (idxPend ? 'INDICE_PENDIENTE' : 'PENDIENTE_CARGA'));
      var carpeta = carpetaCliente(a.cliente.codigo, a.cliente.esperado, existentes, avisos);
      var ref = String(a.referencia || '');
      var mes = mesDe(a.salida) || 'SIN-FECHA';
      // Nombre del PDF archivado: quimicos = Nro de referencia; CLAVO (por km, sin ref) =
      // <chofer>-<fecha_inicio> (UN archivo por viaje: talon + docs que acompanan; Julio 12/11).
      var slugCh = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); };
      var nombrePdf = ref ? ref
        : (esKm ? (ra.archivo ? String(ra.archivo).replace(/[^A-Za-z0-9._-]/g, '-') : slugCh(raw.chofer || ((v.cabecera || {}).verificar || {}).chofer || 'chofer') + '-' + (raw.fecha_inicio || isoDe(a.salida) || 'sin-fecha'))
                : (isoDe(a.salida) || 'sin-fecha') + '-' + slugCh(a.destino.esperado || 'destino'));
      var fila = [
        opciones.fecha || hoyISO(),                                   // 1 fecha_proceso
        escaneo,                                                      // 2 juego_ficha_pdf
        orden.empresa || '',                                          // 3 empresa
        '', '',                                                       // 4-5 nro viaje / albaran (los captura el bot)
        a.salida || '', a.llegada || '',                              // 6-7 fechas
        a.cliente.codigo || '', a.cliente.esperado || '',             // 8-9 cliente
        ref,                                                          // 10 referencia
        a.origen.codigo || 'REVISAR', a.destino.codigo || 'REVISAR',  // 11-12 puntos (sin codigo -> REVISAR)
        (a.carga.esperado || '') + (a.carga.codigo ? ' (cod ' + a.carga.codigo + ')' : ''), // 13 carga
        p.concepto_esperado || '',                                    // 14 concepto
        (numES(p.precio) === null) ? '' : p2(numES(p.precio)),        // 15 precio
        um,                                                           // 16 um
        cantidad,                                                     // 17 cantidad
        factor,                                                       // 18 indexacion_factor
        p2(imp.base),                                                 // 19 base_sin_iva
        (iva === null) ? '' : String(iva),                            // 20 iva_pct
        (imp.base === null || iva === null) ? '' : p2(imp.base * (1 + iva / 100)), // 21 total_con_iva
        km.inicio || '', km.fin || '', km.carga || '',                // 22-24 odometro / km
        (typeof ra.peso_kg === 'number') ? String(ra.peso_kg) : '',   // 25 peso_real_kg
        estado,                                                       // 26 estado_carga
        'procesados/' + carpeta + '/' + mes + '/' + nombrePdf + '.pdf', // 27 pdf_doc
        observacion(orden, v, a, ra, imp),                            // 28 observaciones
      ].map(limpio);
      if (fila.length !== COLUMNAS) { throw new Error('fila con ' + fila.length + ' columnas (deben ser ' + COLUMNAS + ')'); }
      filas.push(fila);
    });
  });
  return { filas: filas, avisos: avisos.concat(res.avisos.map(function (x) { return 'armador: ' + x; })) };
}

module.exports = { filasDeRaw: filasDeRaw, importes: importes };

// ---------- verificacion contra el registro historico ----------
function verificar() {
  var existentes = leerRegistro();
  var porRef = {};
  existentes.forEach(function (f) { if (f[9]) { porRef[f[9]] = f; } });
  var dir = path.join(__dirname, 'raw');
  // columnas deterministicas a comparar (indice 0-based) y si son numericas
  var COMPARAR = [[5, 'fecha_carga'], [6, 'fecha_descarga'], [7, 'cod_cliente'], [9, 'referencia'], [10, 'cod_origen'], [11, 'cod_destino'],
    [13, 'concepto'], [14, 'precio', 0.011], [15, 'um'], [16, 'cantidad', 0.0005], [17, 'indexacion_factor', 0.00005], [18, 'base_sin_iva', 0.011], [19, 'iva_pct', 0.0005],
    [20, 'total_con_iva', 0.011], [21, 'odometro_inicio'], [22, 'odometro_final'], [23, 'km_carga'], [24, 'peso_real_kg'], [26, 'pdf_doc']];
  function num(s) { if (s === '') { return null; } var t = String(s); return parseFloat(t.indexOf(',') >= 0 ? t.replace(/\./g, '').replace(',', '.') : t); }
  var total = 0, iguales = 0, sinFila = 0, difs = [];
  var deps = armador.cargarDeps();
  fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }).forEach(function (f) {
    var raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    var r = filasDeRaw(raw, { existentes: existentes, deps: deps, escaneo: 'x' });
    r.filas.forEach(function (g) {
      if (!g[9]) { return; } // CLAVO de prueba, sin referencia: no esta en el registro
      var h = porRef[g[9]];
      if (!h) { sinFila++; return; }
      total++;
      var d = [];
      COMPARAR.forEach(function (c) {
        var a = g[c[0]], b = h[c[0]];
        var ok = c[2] ? ((num(a) === null && num(b) === null) || (num(a) !== null && num(b) !== null && Math.abs(num(a) - num(b)) <= c[2])) : (a === b);
        if (!ok) { d.push(c[1] + ': genero "' + a + '" / registro "' + b + '"'); }
      });
      if (d.length) { difs.push({ archivo: f, ref: g[9], d: d }); } else { iguales++; }
    });
  });
  console.log('Filas comparadas: ' + total + '  ·  identicas: ' + iguales + '  ·  con diferencias: ' + difs.length + (sinFila ? '  ·  sin fila en el registro: ' + sinFila : ''));
  difs.forEach(function (x) { console.log('\n[' + x.ref + '] ' + x.archivo); x.d.forEach(function (l) { console.log('   · ' + l); }); });
  return difs.length;
}

// ---------- CLI ----------
if (require.main === module) {
  var args = process.argv.slice(2);
  function opt(n) { var i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; }
  if (args.indexOf('--verificar') >= 0) { verificar(); process.exit(0); }
  var entrada = args.filter(function (a, i) { return a.slice(0, 2) !== '--' && ['--escaneo', '--fecha'].indexOf(args[i - 1]) < 0; })[0];
  if (!entrada) { console.error('uso: node registro_filas.js <raw.json> [--escaneo X.pdf] [--fecha AAAA-MM-DD] [--agregar] | --verificar'); process.exit(2); }
  var raw = JSON.parse(fs.readFileSync(entrada, 'utf8'));
  var existentes = leerRegistro();
  var out = filasDeRaw(raw, { escaneo: opt('--escaneo'), fecha: opt('--fecha'), existentes: existentes });
  var lineas = out.filas.map(function (f) { return f.join(';'); });
  lineas.forEach(function (l) { console.log(l); });
  if (out.avisos.length) { console.error('\nAVISOS (' + out.avisos.length + '):'); out.avisos.forEach(function (a) { console.error('  - ' + a); }); }
  if (args.indexOf('--agregar') >= 0) {
    var ya = {};
    existentes.forEach(function (f) { if (f[9]) { ya[f[9]] = 1; } });
    var repetidas = out.filas.filter(function (f) { return f[9] && ya[f[9]]; }).map(function (f) { return f[9]; });
    if (repetidas.length && args.indexOf('--forzar') < 0) {
      console.error('\nNO se agrego nada: estas referencias YA estan en el registro: ' + repetidas.join(', ') + ' (¿juego repetido? usar --forzar solo si es intencional)');
      process.exit(1);
    }
    var actual = fs.readFileSync(REGISTRO, 'utf8');
    fs.writeFileSync(REGISTRO, actual + (actual.slice(-1) === '\n' ? '' : '\n') + lineas.join('\n') + '\n');
    console.error('\n' + lineas.length + ' fila(s) agregadas a datos/registro-procesamiento.csv');
  } else {
    console.error('\n(' + lineas.length + ' fila(s) generadas; no se escribio nada. Usar --agregar para sumarlas al registro.)');
  }
}
