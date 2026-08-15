// ===== BOOTSTRAP del catalogo de puntos (Encargo 2, CAMBIO 3) ===============
//
// Script de UNA sola corrida, ejecutable local:  node catalogo/bootstrap-puntos.js
//
// Cosecha el universo de puntos y produce:
//   - catalogo/puntos-alta.json  : filas listas para cargar en la data table `puntos`
//   - catalogo/cola-puntos.json  : literales sin resolver, ORDENADOS por frecuencia
//                                  (revisar los primeros ~30 deja el sistema operativo)
//
// NOTA DE FUENTES (divergencia con el brief, reportada):
//   El brief pedia sembrar el canonico desde la data table `tarifas`. No hay tool
//   MCP para leer filas de una data table, y en datos/ estan los RESUMENES de las
//   exportaciones Gesruta (no los CSV crudos). Se usa lo real disponible, que ademas
//   es mejor para el id canonico:
//     - Semilla canonica: datos/resumen-puntos-gesruta.md  (Punto + Cod.Pto. = el id
//       "que entiende Gesruta", que es exactamente lo que pide la columna id_punto).
//     - Semillas manuales: catalogo/semillas-puntos.json    (origen_alta='manual').
//     - Cosecha con frecuencia: datos/resumen-literales.md   (literal + apariciones).
//     - datos/historico-gesruta.csv: OPCIONAL; si no existe, se sigue y se reporta.
//
// El canonico no se inventa: se cosecha. El universo relevante son decenas de
// puntos, no miles.

'use strict';

const fs = require('fs');
const path = require('path');
const { resolverPunto, normalizar } = require('./resolver-punto.js');

const RAIZ = path.resolve(__dirname, '..');
const P_GESRUTA = path.join(RAIZ, 'datos', 'resumen-puntos-gesruta.md');
const P_LITERALES = path.join(RAIZ, 'datos', 'resumen-literales.md');
const P_HISTORICO = path.join(RAIZ, 'datos', 'historico-gesruta.csv');
const P_SEMILLAS = path.join(__dirname, 'semillas-puntos.json');
const P_SALIDA_ALTA = path.join(__dirname, 'puntos-alta.json');
const P_SALIDA_COLA = path.join(__dirname, 'cola-puntos.json');

// --- helpers de parseo de tablas markdown -----------------------------------
// Lee filas de una tabla markdown: devuelve arrays de celdas (sin separadoras).
function filasMd(texto) {
  const filas = [];
  texto.split('\n').forEach(function (linea) {
    const l = linea.trim();
    if (l.indexOf('|') !== 0) { return; }
    const celdas = l.split('|').slice(1, -1).map(function (c) { return c.trim(); });
    if (celdas.length < 2) { return; }
    // descartar cabecera y separadora (--- o encabezados no numericos)
    if (/^-+$/.test(celdas[0]) || celdas[0] === '#' || celdas[0] === '') { return; }
    if (!/^\d+$/.test(celdas[0])) { return; }
    filas.push(celdas);
  });
  return filas;
}

function idDesde(nombre) {
  // id legible y estable a partir del nombre (fallback cuando no hay Cod.Pto.).
  return normalizar(nombre).replace(/\s+/g, '-') || 'SIN-NOMBRE';
}

// --- Fase A: semilla canonica -----------------------------------------------
function cargarSemillaCanonica() {
  const puntos = {}; // id_punto -> fila
  // 1) Semillas manuales (mandan; origen_alta='manual').
  let manuales = [];
  try { manuales = JSON.parse(fs.readFileSync(P_SEMILLAS, 'utf8')); } catch (e) { manuales = []; }
  manuales.forEach(function (m) {
    puntos[m.id_punto] = {
      id_punto: m.id_punto, nombre_canonico: m.nombre_canonico, alias: m.alias || '',
      municipio: m.municipio || '', provincia: m.provincia || '', pais: m.pais || '',
      tipo: m.tipo || 'generico', empresa_sede: m.empresa_sede || '', origen_alta: 'manual'
    };
  });
  // 2) Registro Gesruta (Cod.Pto. = id canonico que entiende Gesruta).
  let nG = 0;
  if (fs.existsSync(P_GESRUTA)) {
    filasMd(fs.readFileSync(P_GESRUTA, 'utf8')).forEach(function (c) {
      // columnas: # | Punto | Cod.Pto. | Provincia
      const nombre = c[1] || '';
      const cod = (c[2] || '').trim();
      const prov = c[3] || '';
      if (!nombre) { return; }
      const id = cod ? ('GES-' + cod) : idDesde(nombre);
      if (puntos[id]) { return; } // ya sembrado (manual)
      // si una semilla manual ya cubre este nombre canonico, no duplicar
      const yaPorNombre = Object.keys(puntos).some(function (k) { return normalizar(puntos[k].nombre_canonico) === normalizar(nombre); });
      if (yaPorNombre) { return; }
      puntos[id] = {
        id_punto: id, nombre_canonico: nombre, alias: '',
        municipio: '', provincia: prov, pais: '', tipo: 'generico', empresa_sede: '', origen_alta: 'gesruta'
      };
      nG++;
    });
  }
  return { puntos: puntos, nGesruta: nG, nManual: manuales.length };
}

// --- Fase B: cosecha de literales con frecuencia ----------------------------
function cosecharLiterales() {
  const freq = {}; // literal -> apariciones
  const fuentes = [];
  // resumen-literales.md (# | Literal | Apariciones)
  if (fs.existsSync(P_LITERALES)) {
    filasMd(fs.readFileSync(P_LITERALES, 'utf8')).forEach(function (c) {
      const lit = c[1] || '';
      const ap = parseInt((c[2] || '0').replace(/\D/g, ''), 10) || 1;
      if (lit) { freq[lit] = (freq[lit] || 0) + ap; }
    });
    fuentes.push('resumen-literales.md');
  }
  // historico-gesruta.csv (OPCIONAL)
  if (fs.existsSync(P_HISTORICO)) {
    fuentes.push('historico-gesruta.csv');
    // (parseo real cuando exista el archivo; hoy no esta)
  } else {
    console.log('  [Fase B] datos/historico-gesruta.csv no existe -> se continua sin el (opcional).');
  }
  return { freq: freq, fuentes: fuentes };
}

// --- Fase C + D: asignar y encolar ------------------------------------------
function main() {
  console.log('== Bootstrap catalogo de puntos ==');
  const semilla = cargarSemillaCanonica();
  const catalogo = Object.keys(semilla.puntos).map(function (k) { return semilla.puntos[k]; });
  console.log('  [Fase A] canonico sembrado: ' + catalogo.length + ' puntos (' + semilla.nManual + ' manuales + ' + semilla.nGesruta + ' de Gesruta).');

  const cosecha = cosecharLiterales();
  const literales = Object.keys(cosecha.freq);
  console.log('  [Fase B] literales cosechados: ' + literales.length + ' (fuentes: ' + cosecha.fuentes.join(', ') + ').');

  let volTotal = 0, volAuto = 0, nAuto = 0;
  const cola = [];
  literales.forEach(function (lit) {
    const f = cosecha.freq[lit];
    volTotal += f;
    const r = resolverPunto(lit, 'documento', catalogo);
    if (r.id_punto && r.confianza === 'alta') {
      nAuto++; volAuto += f; // ya reconocido, no necesita revision
    } else {
      cola.push({
        literal: lit,
        frecuencia: f,
        candidatos: r.id_punto ? [{ id_punto: r.id_punto, nombre_canonico: r.nombre_canonico, metodo: r.metodo, confianza: r.confianza }] : [],
        sugerido: r.id_punto || null,
        motivo: r.motivo
      });
    }
  });
  cola.sort(function (a, b) { return b.frecuencia - a.frecuencia; });

  // Salidas
  fs.writeFileSync(P_SALIDA_ALTA, JSON.stringify(catalogo, null, 2));
  fs.writeFileSync(P_SALIDA_COLA, JSON.stringify(cola, null, 2));

  const pctVol = volTotal ? Math.round((volAuto / volTotal) * 1000) / 10 : 0;
  console.log('  [Fase C] resueltos automatico (confianza alta): ' + nAuto + ' literales.');
  console.log('  [Fase D] a cola (revision humana): ' + cola.length + ' literales -> ' + path.relative(RAIZ, P_SALIDA_COLA));
  console.log('  Cobertura automatica por VOLUMEN: ' + pctVol + '% (' + volAuto + '/' + volTotal + ' apariciones).');
  console.log('  Canonico -> ' + path.relative(RAIZ, P_SALIDA_ALTA) + ' (' + catalogo.length + ' filas).');
  console.log('  Revisar cola-puntos.json de arriba hacia abajo; los primeros ~30 son el grueso del volumen.');
}

if (require.main === module) { main(); }
module.exports = { filasMd: filasMd, cargarSemillaCanonica: cargarSemillaCanonica, cosecharLiterales: cosecharLiterales };
