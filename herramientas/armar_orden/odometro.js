// ===== REGISTRO DE ODOMETRO POR TRACTORA (km vacio del 1er tramo) ============
//
// Problema (Julio 19/11): el 1er tramo de cada juego CLAVO salia con km_vacio=0,
// pero el camion llego vacio desde donde termino el juego anterior. Para calcularlo
// hace falta un REGISTRO PROPIO del odometro de cada tractora (con fecha).
//
// Este helper mantiene datos/odometros-tractora.json (una entrada por juego y
// tractora: {juego, fecha, km_inicio, km_fin}) y calcula los km_vacio del raw:
//   - 1er tramo: km_inicio - km_fin del juego ANTERIOR de esa tractora (del registro).
//   - tramos siguientes: km_inicio - km_fin del tramo anterior (dentro del juego).
// Si no hay juego anterior, o el hueco es mayor que UMBRAL (faltan juegos en el
// registro), deja el 1er tramo en 0 y AVISA (falla ruidoso, no inventa).
//
// uso:
//   node odometro.js <raw.json>                 calcula vacios, reescribe el raw y actualiza el registro
//   node odometro.js <raw.json> --dry           solo muestra (no escribe)
//   node odometro.js <raw.json> --solo-registrar  solo agrega el juego al registro (no toca el raw)
'use strict';
var fs = require('fs');
var path = require('path');
var datos = require('./lib/datos.js');

var LOG = path.join(datos.ROOT, 'datos/odometros-tractora.json');
var UMBRAL = 700; // km: hueco mayor => probablemente faltan juegos, no es vacio real

function cargar() { try { return JSON.parse(fs.readFileSync(LOG, 'utf8')); } catch (e) { return {}; } }
function guardar(l) { fs.writeFileSync(LOG, JSON.stringify(l, null, 2) + '\n'); }

// km_fin del juego anterior de esa tractora (el mayor km_fin <= km_inicio, sin contar este juego).
function kmFinPrevio(log, mat, kmInicio, juego) {
  var ents = (log[mat] || []).filter(function (e) {
    return e.juego !== juego && typeof e.km_fin === 'number' && e.km_fin <= kmInicio;
  });
  if (!ents.length) { return null; }
  return Math.max.apply(null, ents.map(function (e) { return e.km_fin; }));
}

function upsert(log, mat, entry) {
  // clave = (juego, km_inicio): un juego puede traer >1 viaje (odometros distintos).
  log[mat] = (log[mat] || []).filter(function (e) { return !(e.juego === entry.juego && e.km_inicio === entry.km_inicio); });
  log[mat].push(entry);
  log[mat].sort(function (a, b) { return a.km_inicio - b.km_inicio; });
}

// Procesa un raw: calcula km_vacio (si registrar) y/o registra el juego en el log.
function procesar(rawPath, opts) {
  opts = opts || {};
  var raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  var log = cargar();
  var avisos = [];
  var juego = raw.escaneo || path.basename(rawPath);
  (raw.viajes || []).forEach(function (v) {
    var mat = v.matricula;
    var albs = v.albaranes || [];
    var esClavo = albs.some(function (a) { return /CLAVO/i.test(a.cliente_lit || ''); });
    if (!esClavo) { return; }
    var conKm = albs.filter(function (a) { return typeof a.km_inicio === 'number' && typeof a.km_fin === 'number'; });
    if (!conKm.length) { return; }
    if (!opts.soloRegistrar) {
      // 1er tramo: desde el registro de la tractora
      var first = conKm[0];
      var prev = kmFinPrevio(log, mat, first.km_inicio, juego);
      if (prev == null) {
        first.km_vacio = 0;
        avisos.push('[' + mat + ' ' + first.salida + '] sin juego anterior en el registro -> vacio 1er tramo = 0 (revisar)');
      } else {
        var hueco = first.km_inicio - prev;
        if (hueco < 0 || hueco > UMBRAL) {
          first.km_vacio = 0;
          avisos.push('[' + mat + ' ' + first.salida + '] hueco odometro ' + hueco + ' km (prev ' + prev + ' -> ' + first.km_inicio + ') fuera de rango -> vacio 1er tramo = 0 (faltan juegos? revisar)');
        } else {
          first.km_vacio = hueco;
        }
      }
      // tramos siguientes: hueco con el km_fin del tramo anterior del juego
      for (var i = 1; i < conKm.length; i++) {
        conKm[i].km_vacio = conKm[i].km_inicio - conKm[i - 1].km_fin;
      }
    }
    upsert(log, mat, { juego: juego, fecha: conKm[0].salida, km_inicio: conKm[0].km_inicio, km_fin: conKm[conKm.length - 1].km_fin });
  });
  if (!opts.dry) {
    if (!opts.soloRegistrar) { fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2) + '\n'); }
    guardar(log);
  }
  return { raw: raw, avisos: avisos };
}

if (require.main === module) {
  var args = process.argv.slice(2);
  var rawPath = args.filter(function (a) { return a.charAt(0) !== '-'; })[0];
  if (!rawPath) { console.error('uso: node odometro.js <raw.json> [--dry|--solo-registrar]'); process.exit(2); }
  var opts = { dry: args.indexOf('--dry') >= 0, soloRegistrar: args.indexOf('--solo-registrar') >= 0 };
  var r = procesar(rawPath, opts);
  (r.raw.viajes || []).forEach(function (v) {
    (v.albaranes || []).forEach(function (a) {
      if (typeof a.km_vacio === 'number' && typeof a.km_inicio === 'number') {
        console.log(a.salida, v.matricula, 'km', a.km_inicio + '->' + a.km_fin, 'vacio', a.km_vacio);
      }
    });
  });
  r.avisos.forEach(function (a) { console.error('  AVISO ' + a); });
  console.log(opts.dry ? '(dry-run)' : (opts.soloRegistrar ? 'ok: registrado en el log' : 'ok: raw y log actualizados'));
}

module.exports = { procesar: procesar, kmFinPrevio: kmFinPrevio, LOG: LOG, UMBRAL: UMBRAL };
