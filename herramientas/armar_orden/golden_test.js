// ===== GOLDEN TEST del armador (Corrida 2) ===================================
//
// Corre el armador sobre los HECHOS CRUDOS de un juego y compara los `viajes`
// que emite contra el orden.json hecho A MANO (el que ya cargamos). Debe dar
// IDENTICO en los campos del CONTRATO. Ignora claves de anotacion (las que
// empiezan con "_": _meta, _nota) porque son prosa humana, no contrato.
//
// uso: node golden_test.js
// exit 0 = empata; exit 1 = hay diferencias (las imprime).
'use strict';

var fs = require('fs');
var path = require('path');
var armador = require('./armar_orden.js');
var ROOT = require('./lib/datos.js').ROOT;

function raw(f) { return path.join(__dirname, 'raw', f); }
function blanco(rel) { return path.join(ROOT, 'ordenes-carga/ordenes', rel, 'orden.json'); }

// Casos: raw de entrada -> orden.json hecho a mano (blanco).
var CASOS = [
  {
    nombre: 'jose-ramon-pineiro 2026-10-14 (FORESA nacional; cascada analogia + minimo 23)',
    raw: raw('jose-ramon-pineiro-2026-10-14.json'),
    blanco: blanco('2026-10/jose-ramon-pineiro/2026-10-14'),
  },
  {
    nombre: 'francisco-asensi 2026-10-05 (BRESFOR PI/Teruel + QUIMIDROGA analogia Begonte + FORESA Teruel)',
    raw: raw('francisco-asensi-2026-10-05.json'),
    blanco: blanco('2026-10/francisco-asensi/2026-10-05'),
  },
  {
    nombre: 'manuel-sabaris 2026-10-02 (QUIMIDROGA + BRESFOR + ARACHEM tarifa_pendiente)',
    raw: raw('manuel-sabaris-2026-10-02.json'),
    blanco: blanco('2026-10/manuel-sabaris/2026-10-02'),
  },
  {
    nombre: 'nuno-felipe-silva-paiva 2026-09-30 (RNM EUR/TN + FORESA idx acumulada + ruta pendiente)',
    raw: raw('nuno-felipe-silva-paiva-2026-09-30.json'),
    blanco: blanco('2026-09/nuno-felipe-silva-paiva/2026-09-30'),
  },
  {
    nombre: 'pedro-fraga 2026-10-05 (AUTONOMO: km.vacio + idx acumulada Orember cargar:false)',
    raw: raw('pedro-fraga-2026-10-05.json'),
    blanco: blanco('2026-10/pedro-fraga/2026-10-05'),
  },
  {
    nombre: 'manuel-sabaris 2026-10-13 (BRESFOR + BALTRANSA precio fijo UN + idx-0 + DIVERSEY)',
    raw: raw('manuel-sabaris-2026-10-13.json'),
    blanco: blanco('2026-10/manuel-sabaris/2026-10-13'),
  },
  {
    nombre: 'jose-manuel-paz 2026-10-16 (DUOTRAILER: duo_secundario + km.cargar:false)',
    raw: raw('jose-manuel-paz-2026-10-16.json'),
    blanco: blanco('2026-10/jose-manuel-paz/2026-10-16'),
    // Gaps de DATOS que Julio esta confirmando (no fallos del armador):
    //  - idx FORESA-BRESFOR 2a quincena de octubre (carga 16/10) sin tramo cargado
    //  - QUIMIDROGA Miranda->Braga 61,65 (viaje 3) no esta en tabla/analogia
    gaps: ['viajes[0].albaranes[0].lineas.indexacion',
           'viajes[1].albaranes[0].lineas.indexacion',
           'viajes[2]'],
  },
];

// Quita recursivamente las claves que empiezan con "_" (anotaciones).
function limpiar(x) {
  if (Array.isArray(x)) { return x.map(limpiar); }
  if (x && typeof x === 'object') {
    var o = {};
    Object.keys(x).forEach(function (k) { if (k[0] !== '_') { o[k] = limpiar(x[k]); } });
    return o;
  }
  return x;
}

// Diff recursivo: devuelve lista de rutas donde difieren.
function diff(a, b, ruta, out) {
  ruta = ruta || '';
  out = out || [];
  var ta = Array.isArray(a) ? 'array' : (a === null ? 'null' : typeof a);
  var tb = Array.isArray(b) ? 'array' : (b === null ? 'null' : typeof b);
  if (ta !== tb) { out.push(ruta + ': tipo ' + ta + ' != ' + tb + '  (' + JSON.stringify(a) + ' vs ' + JSON.stringify(b) + ')'); return out; }
  if (ta === 'array') {
    if (a.length !== b.length) { out.push(ruta + ': longitud ' + a.length + ' != ' + b.length); }
    for (var i = 0; i < Math.max(a.length, b.length); i++) { diff(a[i], b[i], ruta + '[' + i + ']', out); }
    return out;
  }
  if (ta === 'object') {
    var claves = {};
    Object.keys(a).forEach(function (k) { claves[k] = 1; });
    Object.keys(b).forEach(function (k) { claves[k] = 1; });
    Object.keys(claves).forEach(function (k) { diff(a[k], b[k], ruta ? ruta + '.' + k : k, out); });
    return out;
  }
  if (a !== b) { out.push(ruta + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }
  return out;
}

var deps = armador.cargarDeps();
var fallos = 0;
CASOS.forEach(function (caso) {
  var raw = JSON.parse(fs.readFileSync(caso.raw, 'utf8'));
  var blanco = JSON.parse(fs.readFileSync(caso.blanco, 'utf8'));
  var res = armador.armarOrden(raw, deps);

  var generado = limpiar({ empresa: res.orden.empresa, viajes: res.orden.viajes });
  var esperado = limpiar({ empresa: blanco.empresa, viajes: blanco.viajes });
  var todas = diff(generado, esperado, '', []);
  // Separa gaps de DATOS conocidos (declarados en el caso) de fallos reales del armador.
  var gaps = caso.gaps || [];
  function esGap(ruta) { return gaps.some(function (g) { return ruta === g || ruta.indexOf(g + '.') === 0 || ruta.indexOf(g + '[') === 0; }); }
  var difs = todas.filter(function (d) { return !esGap(d.split(':')[0]); });
  var difsGap = todas.filter(function (d) { return esGap(d.split(':')[0]); });

  console.log('\n=== ' + caso.nombre + ' ===');
  if (res.avisos.length) { console.log('  avisos del armador: ' + res.avisos.length); res.avisos.forEach(function (a) { console.log('    · ' + a); }); }
  if (difsGap.length) {
    console.log('  ⏳ ' + difsGap.length + ' diferencia(s) por GAP DE DATOS conocido (no es fallo del armador):');
    difsGap.forEach(function (d) { console.log('    · ' + d); });
  }
  if (difs.length === 0) {
    console.log('  ✅ EMPATA' + (difsGap.length ? ' (salvo gaps de datos declarados)' : '') + ' — el armador reprodujo el orden.json a mano.');
  } else {
    fallos++;
    console.log('  ❌ ' + difs.length + ' diferencia(s) REAL(es):');
    difs.forEach(function (d) { console.log('    · ' + d); });
  }
});

console.log('\n' + (fallos === 0 ? 'GOLDEN OK' : 'GOLDEN FALLIDO — ' + fallos + ' caso(s) con diferencias'));
process.exit(fallos === 0 ? 0 : 1);
