// ===== Generador de filas del Excel FRIGOS (CLAVO) ===========================
//
// Toma un orden.json (modo km, cliente CLAVO) y emite las FILAS para pegar en el
// Excel de control CONTROL_FACTURACION_FRIGOS (paso 3 del flujo objetivo). Salida
// = TSV (separado por TAB) para pegar directo en Excel: cada campo cae en su
// columna. Columnas A..Q (facturacion); las dietas/palets/gastos (R..AA) las
// completa Julio desde la parte (control interno, no se cargan a Gesruta).
//
// uso: node excel_frigos.js <orden.json>   (imprime cabecera + filas TSV)
'use strict';

var fs = require('fs');
var armador = require('./armar_orden.js'); // fmt (formato ES)

// "1.161,28" -> 1161.28 ; "764,000" -> 764
function numES(s) {
  if (s == null || s === '') { return null; }
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
}

var COLUMNAS = [
  'Emp', 'Tractora', 'Fecha carga', 'Fecha descarga', 'Origen', 'Nº Carg',
  'Destino', 'Nº Rep', 'Kms. carga', 'Kms. Descarga', 'Kms con carga',
  'Salida /Retorno/Unidad', 'Importe a facturar por Km', 'Kms en vacio',
  'CLIENTE', 'CARGA', 'GesR',
];

function filasDeOrden(orden) {
  var filas = [];
  (orden.viajes || []).forEach(function (v) {
    var emp = orden.empresa || '';
    var mat = (v.cabecera && v.cabecera.verificar) ? (v.cabecera.verificar.matricula || '') : '';
    (v.albaranes || []).forEach(function (a) {
      if (a.facturacion !== 'km') { return; } // solo CLAVO / modo km
      var km = a.km || {};
      var porte = (a.lineas && a.lineas.porte) || {};
      var cant = numES(porte.cantidad);
      var prec = numES(porte.precio);
      var importe = (cant != null && prec != null) ? cant * prec : null;
      // Destino (col G del Excel): como lo escribe Julio -> MAYUSCULAS, multi-destino unido con '+'.
      var destinos = (a.destinos && a.destinos.length)
        ? a.destinos.map(function (x) { return String(x).toUpperCase(); }).join('+')
        : ((a.destino && a.destino.esperado) || '').toUpperCase();
      var nRep = (a.destinos && a.destinos.length) ? a.destinos.length : 1;
      filas.push([
        emp,                                                    // A Emp (TLE / THEC)
        mat,                                                    // B Tractora
        a.salida || '',                                         // C Fecha carga
        a.llegada || '',                                        // D Fecha descarga
        (a.origen && a.origen.esperado) || '',                  // E Origen
        1,                                                      // F Nº Carg
        destinos,                                               // G Destino (todos)
        nRep,                                                   // H Nº Rep
        km.inicio != null ? km.inicio : '',                     // I Kms. carga (odometro inicio)
        km.fin != null ? km.fin : '',                           // J Kms. Descarga (odometro fin)
        km.carga != null ? km.carga : '',                       // K Kms con carga
        a.sentido || '',                                        // L S/R/U/C
        (importe != null) ? armador.fmt(importe, 2) : '',       // M Importe a facturar
        km.vacio != null ? km.vacio : '',                       // N Kms en vacio
        'CLAVO',                                                // O CLIENTE
        (a.carga && a.carga.esperado) || '',                    // P CARGA
        '',                                                      // Q GesR (lo marca Julio al cargar)
      ]);
    });
  });
  return filas;
}

module.exports = { filasDeOrden: filasDeOrden, COLUMNAS: COLUMNAS };

// ---------- CLI ----------
if (require.main === module) {
  var entrada = process.argv[2];
  if (!entrada) { console.error('uso: node excel_frigos.js <orden.json>'); process.exit(2); }
  var orden = JSON.parse(fs.readFileSync(entrada, 'utf8'));
  var filas = filasDeOrden(orden);
  console.log(COLUMNAS.join('\t'));
  filas.forEach(function (f) { console.log(f.join('\t')); });
  console.error('\n' + filas.length + ' fila(s) para pegar en el Excel FRIGOS (desde la columna A).');
}
