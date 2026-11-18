// ===== MOVER SCANS FACTURADOS ================================================
//
// Cuando una factura (quincenal) sale, sus scans dejan de estar "pendientes" y se
// mueven de procesados/ a facturados/, para que buscar el respaldo de una factura
// sea directo. Estructura (Julio 17/11):
//
//   facturados/<AÑO>/<MM-mes de FACTURACION>/<CLIENTE>/<Nº factura>/<scans + factura.pdf>
//
// El "mes de facturacion" lo pasa quien procesa la factura (NO es la fecha de
// emision): es el periodo que la factura cubre. Puede incluir viajes de un mes
// anterior que quedaron pendientes por falta de documentacion antes del corte.
//
// Esta herramienta NO lee el PDF de la factura: recibe la lista de REFERENCIAS ya
// extraidas y las cruza contra el libro maestro (datos/registro-procesamiento.csv,
// columna referencia). Por cada ref: mueve su pdf_doc al destino, actualiza el
// pdf_doc del registro y deja marca en observaciones, y anota en el log de
// facturacion. Determinista, idempotente y RUIDOSO (ref no encontrada / archivo
// faltante / ya facturado = lo dice, no lo inventa).
//
// uso:
//   node mover-facturados.js --cliente FORESA --factura 2026-123 --mes 2026-10 \
//        --refs 20012345,20012346 [--factura-pdf <ruta>] [--mover]
//   node mover-facturados.js ... --refs-file <archivo con una ref por linea> ...
//
// Sin --mover: DRY-RUN (muestra qué haría, no toca nada). Con --mover: aplica.
'use strict';

var fs = require('fs');
var path = require('path');
var datos = require('../armar_orden/lib/datos.js');

var ROOT = datos.ROOT;
var REGISTRO = path.join(ROOT, 'datos/registro-procesamiento.csv');
var LOG = path.join(ROOT, 'datos/facturacion-log.csv');
var IDX = { codCliente: 7, referencia: 9, estado: 25, pdfDoc: 26, obs: 27 };
var MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function arg(nombre) {
  var i = process.argv.indexOf('--' + nombre);
  return (i >= 0 && i + 1 < process.argv.length) ? process.argv[i + 1] : null;
}
function flag(nombre) { return process.argv.indexOf('--' + nombre) >= 0; }
function sanear(s) { return String(s).replace(/[\/\\:*?"<>|]/g, '-').trim(); }
function limpio(s) { return String(s == null ? '' : s).replace(/;/g, ',').replace(/\s*\r?\n\s*/g, ' ').trim(); }

// mes de facturacion "2026-10" -> {anio:"2026", carpetaMes:"10-octubre"}
function parseMes(mes) {
  var m = /^(\d{4})-(\d{2})$/.exec(String(mes || ''));
  if (!m) { return null; }
  var nn = parseInt(m[2], 10);
  if (nn < 1 || nn > 12) { return null; }
  return { anio: m[1], mm: m[2], carpetaMes: m[2] + '-' + MESES[nn] };
}

function main() {
  var cliente = arg('cliente');
  var factura = arg('factura');
  var mes = arg('mes');
  var facturaPdf = arg('factura-pdf');
  var aplicar = flag('mover');

  var refs = [];
  if (arg('refs')) { refs = arg('refs').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  if (arg('refs-file')) {
    refs = refs.concat(fs.readFileSync(arg('refs-file'), 'utf8').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean));
  }

  if (!cliente || !factura || !mes || !refs.length) {
    console.error('uso: node mover-facturados.js --cliente <C> --factura <N> --mes <AAAA-MM> --refs r1,r2 [--factura-pdf ruta] [--mover]');
    process.exit(2);
  }
  var pm = parseMes(mes);
  if (!pm) { console.error('ERROR: --mes debe ser AAAA-MM (ej 2026-10). Recibido: ' + mes); process.exit(2); }

  var facturaSan = sanear(factura);
  var destRelBase = path.join('facturados', pm.anio, pm.carpetaMes, sanear(cliente).toUpperCase(), facturaSan);

  if (!fs.existsSync(REGISTRO)) { console.error('ERROR: no existe el registro ' + REGISTRO); process.exit(1); }
  var lineas = fs.readFileSync(REGISTRO, 'utf8').split(/\r?\n/);
  var header = lineas[0];
  var cuerpo = lineas.slice(1);

  // index ref -> indices de fila (en cuerpo)
  var porRef = {};
  for (var i = 0; i < cuerpo.length; i++) {
    if (!cuerpo[i].length) { continue; }
    var f = cuerpo[i].split(';');
    var r = (f[IDX.referencia] || '').trim();
    if (r) { (porRef[r] = porRef[r] || []).push(i); }
  }

  var plan = [], errores = [], yaFact = [], logRows = [];
  refs.forEach(function (ref) {
    var idxs = porRef[ref];
    if (!idxs || !idxs.length) { errores.push('ref ' + ref + ' NO está en el registro'); return; }
    idxs.forEach(function (li) {
      var f = cuerpo[li].split(';');
      var pdfDoc = (f[IDX.pdfDoc] || '').trim();
      if (!pdfDoc) { errores.push('ref ' + ref + ': fila sin pdf_doc'); return; }
      if (pdfDoc.indexOf('facturados/') === 0) { yaFact.push('ref ' + ref + ' ya está en facturados/ (' + pdfDoc + ')'); return; }
      var src = path.join(ROOT, pdfDoc);
      if (!fs.existsSync(src)) { errores.push('ref ' + ref + ': no existe el archivo ' + pdfDoc); return; }
      var clienteFila = pdfDoc.split('/')[1] || '';
      var destRel = path.join(destRelBase, path.basename(pdfDoc));
      plan.push({ ref: ref, li: li, f: f, src: src, pdfDoc: pdfDoc, destRel: destRel, clienteFila: clienteFila });
    });
  });

  // chequeo: todos los scans al mismo CLIENTE (la factura es de un cliente)
  var clientesFila = {};
  plan.forEach(function (p) { clientesFila[p.clienteFila] = 1; });
  var clientesDistintos = Object.keys(clientesFila);
  if (clientesDistintos.length > 1) {
    errores.push('las refs apuntan a clientes distintos en procesados/ (' + clientesDistintos.join(', ') + '); una factura es de UN cliente. Revisar.');
  }

  // reporte
  console.log('\n=== MOVER FACTURADOS ' + (aplicar ? '(APLICANDO)' : '(DRY-RUN)') + ' ===');
  console.log('cliente: ' + cliente + ' · factura: ' + factura + ' · mes fact.: ' + mes + ' (' + pm.carpetaMes + ')');
  console.log('destino: ' + destRelBase + '/\n');
  plan.forEach(function (p) { console.log('  MOVER  ' + p.pdfDoc + '  ->  ' + p.destRel); });
  if (facturaPdf) { console.log('  FACTURA ' + facturaPdf + '  ->  ' + path.join(destRelBase, path.basename(facturaPdf))); }
  yaFact.forEach(function (m) { console.log('  (skip) ' + m); });
  if (errores.length) { console.log('\nERRORES (' + errores.length + '):'); errores.forEach(function (e) { console.log('  ✗ ' + e); }); }

  if (errores.length) { console.error('\nHay errores: no se mueve nada. Corregir y reintentar.'); process.exit(1); }
  if (!plan.length && !facturaPdf) { console.log('\nNada para mover.'); process.exit(0); }

  if (!aplicar) { console.log('\n(DRY-RUN) Nada se movió. Repetir con --mover para aplicar.'); process.exit(0); }

  // APLICAR
  fs.mkdirSync(path.join(ROOT, destRelBase), { recursive: true });
  plan.forEach(function (p) {
    fs.renameSync(p.src, path.join(ROOT, p.destRel));
    p.f[IDX.pdfDoc] = p.destRel.split(path.sep).join('/');
    p.f[IDX.obs] = limpio((p.f[IDX.obs] || '') + ' | FACTURADO fra ' + factura + ' (' + mes + ')');
    cuerpo[p.li] = p.f.join(';');
    logRows.push([new Date().toISOString().slice(0, 10), sanear(cliente).toUpperCase(), p.f[IDX.codCliente] || '', factura, mes, p.ref, p.pdfDoc, p.f[IDX.pdfDoc]].join(';'));
  });
  if (facturaPdf && fs.existsSync(facturaPdf)) {
    var fdest = path.join(ROOT, destRelBase, 'FACTURA-' + facturaSan + path.extname(facturaPdf));
    fs.copyFileSync(facturaPdf, fdest);
    console.log('  factura copiada a ' + path.relative(ROOT, fdest));
  }

  fs.writeFileSync(REGISTRO, [header].concat(cuerpo).join('\n'));

  // log de facturacion (crea cabecera si no existe)
  if (!fs.existsSync(LOG)) {
    fs.writeFileSync(LOG, 'fecha_registro;cliente;cod_cliente;factura;mes_facturacion;referencia;pdf_origen;pdf_destino\n');
  }
  fs.appendFileSync(LOG, logRows.join('\n') + (logRows.length ? '\n' : ''));

  console.log('\n✅ movidos ' + plan.length + ' scan(s); registro y log actualizados.');
}

main();
