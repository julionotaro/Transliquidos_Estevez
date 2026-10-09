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
const P_CSV = [path.join(RAIZ, 'datos', 'puntos-214-parte1.csv'), path.join(RAIZ, 'datos', 'puntos-214-parte2.csv')];
const P_TABLA = path.join(RAIZ, 'datos', 'tabla-traduccion-puntos.md');
const P_GESRUTA = path.join(RAIZ, 'datos', 'resumen-puntos-gesruta.md');
const P_LITERALES = path.join(RAIZ, 'datos', 'resumen-literales.md');
const P_HISTORICO = path.join(RAIZ, 'datos', 'historico-gesruta.csv');
const P_SEMILLAS = path.join(__dirname, 'semillas-puntos.json');
const P_SALIDA_ALTA = path.join(__dirname, 'puntos-alta.json');
const P_SALIDA_COLA = path.join(__dirname, 'cola-puntos.json');
const P_SALIDA_DUP = path.join(__dirname, 'duplicados-pendientes.json');

// Basura confirmada en el catalogo Gesruta (decision de Julio ya tomada): NO son
// puntos validos. MATRIC. PO4034AY es una matricula; FRANCIA es un pais usado como
// punto. Se excluyen por nombre normalizado.
var BASURA = ['MATRIC PO4034AY', 'FRANCIA'];

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
function stripCod(x) { return String(x === null || x === undefined ? '' : x).replace(/[`\s]/g, '').trim(); }

// Parser de tabla markdown SIN columna de indice numerico (primera celda = dato).
function filasMdRaw(texto) {
  const filas = [];
  texto.split('\n').forEach(function (linea) {
    const l = linea.trim();
    if (l.indexOf('|') !== 0) { return; }
    const c = l.split('|').slice(1, -1).map(function (x) { return x.trim(); });
    if (c.length < 2) { return; }
    if (c.every(function (x) { return /^:?-{2,}:?$/.test(x) || x === ''; })) { return; } // separadora
    filas.push(c);
  });
  return filas;
}

// --- Fase A: semilla canonica -----------------------------------------------
// Fuentes, en orden de autoridad:
//   1) tabla-traduccion-puntos.md  -> los puntos USADOS con su Cod.Pto. real (id).
//   2) resumen-puntos-gesruta.md   -> resto del registro (solo nombres nuevos).
//   3) semillas-puntos.json        -> ENRIQUECEN por nombre (pais/tipo/empresa/alias).
function cargarSemillaCanonica() {
  const puntos = {};            // id_punto -> fila
  const porNombre = {};         // nombre_norm -> [id_punto,...]
  const duplicados = {};        // nombre_norm -> { nombre, codigos }
  let nBasura = 0;

  function registrar(nombre, cod, prov, origen) {
    if (!nombre) { return false; }
    const nn = normalizar(nombre);
    if (BASURA.indexOf(nn) >= 0) { nBasura++; return false; } // no es punto valido
    const id = cod || idDesde(nombre);
    if (puntos[id]) { return false; }
    const yaIds = porNombre[nn] || [];
    if (yaIds.length && yaIds.indexOf(id) < 0) {
      // Mismo nombre EXACTO con OTRO Cod.Pto. -> duplicado. NO se elige (dato de
      // Julio: imposible saber cual se uso desde el nombre). Se registran ambos.
      duplicados[nn] = duplicados[nn] || { nombre: nombre, codigos: yaIds.slice() };
      if (duplicados[nn].codigos.indexOf(id) < 0) { duplicados[nn].codigos.push(id); }
      porNombre[nn].push(id);
      puntos[id] = { id_punto: id, nombre_canonico: nombre, alias: '', municipio: '', provincia: prov || '', pais: '', tipo: 'generico', empresa_sede: '', origen_alta: origen, duplicado_pendiente: true };
      return true;
    }
    (porNombre[nn] = porNombre[nn] || []).push(id);
    puntos[id] = { id_punto: id, nombre_canonico: nombre, alias: '', municipio: '', provincia: prov || '', pais: '', tipo: 'generico', empresa_sede: '', origen_alta: origen };
    return true;
  }

  // 1) PRIMARIO: los 214 puntos USADOS con su Cod.Pto. real (CSV, punto;cod_pto;usos).
  //    Es el destino de la traduccion: los nombres que Gesruta ya tiene cargados.
  let nTabla = 0;
  P_CSV.forEach(function (pcsv) {
    if (!fs.existsSync(pcsv)) { return; }
    fs.readFileSync(pcsv, 'utf8').split('\n').forEach(function (linea) {
      const l = linea.trim();
      if (!l) { return; }
      const c = l.split(';');
      if (c.length < 2 || normalizar(c[0]) === 'PUNTO') { return; } // cabecera
      if (registrar(c[0], stripCod(c[1]), '', 'gesruta-usado')) { nTabla++; }
    });
  });
  // Respaldo: si no estan los CSV, cae a la tabla md (top-30).
  if (nTabla === 0 && fs.existsSync(P_TABLA)) {
    filasMdRaw(fs.readFileSync(P_TABLA, 'utf8')).forEach(function (c) {
      if (normalizar(c[0]) === 'PUNTO') { return; }
      if (registrar(c[0], stripCod(c[2]), c[3] || '', 'gesruta-usado')) { nTabla++; }
    });
  }
  // 2) SECUNDARIO: registro Gesruta (# | Punto | Cod.Pto. | Provincia), nombres nuevos.
  let nGesruta = 0;
  if (fs.existsSync(P_GESRUTA)) {
    filasMd(fs.readFileSync(P_GESRUTA, 'utf8')).forEach(function (c) {
      const nombre = c[1] || '';
      if (!nombre || porNombre[normalizar(nombre)]) { return; }
      if (registrar(nombre, stripCod(c[2]), c[3] || '', 'gesruta')) { nGesruta++; }
    });
  }
  // 3) Semillas: ENRIQUECEN por nombre. Crean punto provisional solo si falta.
  let manuales = [];
  try { manuales = JSON.parse(fs.readFileSync(P_SEMILLAS, 'utf8')); } catch (e) { manuales = []; }
  let nEnriq = 0, nNuevos = 0;
  manuales.forEach(function (m) {
    if (!m || !m.nombre_canonico) { return; } // ignora la nota general del archivo
    const nn = normalizar(m.nombre_canonico);
    const ids = porNombre[nn] || [];
    if (ids.length) {
      const p = puntos[ids[0]];
      if (m.pais) { p.pais = m.pais; }
      if (m.tipo) { p.tipo = m.tipo; }
      if (m.empresa_sede) { p.empresa_sede = m.empresa_sede; }
      if (m.alias) { p.alias = p.alias ? (p.alias + '|' + m.alias) : m.alias; }
      nEnriq++;
    } else {
      const id = m.id_punto || idDesde(m.nombre_canonico);
      puntos[id] = { id_punto: id, nombre_canonico: m.nombre_canonico, alias: m.alias || '', municipio: m.municipio || '', provincia: m.provincia || '', pais: m.pais || '', tipo: m.tipo || 'generico', empresa_sede: m.empresa_sede || '', origen_alta: 'manual', id_provisional: true };
      (porNombre[nn] = porNombre[nn] || []).push(id);
      nNuevos++;
    }
  });

  return { puntos: puntos, nTabla: nTabla, nGesruta: nGesruta, nEnriq: nEnriq, nNuevos: nNuevos, nBasura: nBasura, duplicados: duplicados };
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
  console.log('  [Fase A] canonico sembrado: ' + catalogo.length + ' puntos (' + semilla.nTabla + ' usados de la tabla + ' + semilla.nGesruta + ' del registro + ' + semilla.nNuevos + ' semillas nuevas; ' + semilla.nEnriq + ' enriquecidos). Basura excluida: ' + semilla.nBasura + '.');
  const dupList = Object.keys(semilla.duplicados).map(function (k) { return semilla.duplicados[k]; });
  fs.writeFileSync(P_SALIDA_DUP, JSON.stringify(dupList, null, 2));
  console.log('  [duplicados] mismo nombre con varios Cod.Pto. (decision de Julio): ' + dupList.length + ' -> ' + path.relative(RAIZ, P_SALIDA_DUP) + (dupList.length ? '' : ' (ninguno en esta muestra)'));

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
