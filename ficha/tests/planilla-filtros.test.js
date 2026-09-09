// Tests v1.1 pieza 2 — filtro por columna (logica pura; la version que corre
// en el navegador via el <script> inline de renderHTML se verifica aparte,
// con Playwright sobre el HTML real generado, ver ESTADO-Y-TRASPASO).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { armarFilas, filtrarFilasPorColumna, COLUMNAS_TABLA } = require('../planilla.js');

function viaje(campos) {
  return Object.assign({
    id: 1, empresa: 'TLE', orden: 1, cliente: 'FORESA', origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL',
    material: 'Tobera Res 0541', referencia: '2002854', tractora: '2498KZL', semi: 'R1007BCV',
    conductor: 'Asensi', kg_documento: 23140, fecha: '2026-07-07',
    estado: 'con_documentacion', estado_lectura: 'OK', motivo_revision: '',
    regimen_indexacion: 'linea', pais_facturacion: 'ES'
  }, campos);
}

const TARIFAS = [
  { cliente: 'FORESA', origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL', material: '', tarifa_tn: '56.0', precio_fijo: '', vigente_desde: '2026-01-01', id: 274 },
  { cliente: 'RNM', origen: 'AVEIRO', destino: 'PORRIÑO', material: '', tarifa_tn: '19.0', precio_fijo: '', vigente_desde: '2025-01-01', id: 166 },
];
const INDEXACION = [
  { cliente: 'FORESA-BRESFOR', tipo: 'gasoleo', pct: '0.1064', desde: '2026-07-01', hasta: '2026-07-15', id: 12 },
];

// Datos reales de la corrida de las 3 fichas verdad-de-campo (ejecucion 624,
// tabla Viajes real, 2026-08-03) -- clientes/choferes/fechas tal cual estan.
const VIAJES_REALES = [
  viaje({ id: 1, cliente: 'FORESA', conductor: 'Asensi', fecha: '2026-07-07', origen: 'BRESFOR (AVEIRO)', destino: 'TERUEL' }),
  viaje({ id: 3, cliente: 'RNM', conductor: 'Asensi', fecha: '2026-07-15', origen: 'AVEIRO', destino: 'PORRIÑO' }),
  viaje({ id: 4, cliente: 'FORESA', conductor: 'PABLO CARLES', fecha: '2026-07-13', origen: 'CALDAS', destino: 'ORENSE', regimen_indexacion: 'agregada_quincenal' }),
];

function indiceColumna(clave) {
  return COLUMNAS_TABLA.findIndex(c => c.clave === clave);
}

test('planilla filtro: por cliente muestra solo ese cliente (datos reales de la corrida verdad-de-campo)', () => {
  const filas = armarFilas(VIAJES_REALES, TARIFAS, INDEXACION);
  const filtros = new Array(COLUMNAS_TABLA.length).fill('');
  filtros[indiceColumna('cliente')] = 'RNM';
  const out = filtrarFilasPorColumna(filas, filtros);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].cliente, 'RNM');
});

test('planilla filtro: por chofer muestra solo los viajes de ese chofer', () => {
  const filas = armarFilas(VIAJES_REALES, TARIFAS, INDEXACION);
  const filtros = new Array(COLUMNAS_TABLA.length).fill('');
  filtros[indiceColumna('chofer')] = 'Asensi';
  const out = filtrarFilasPorColumna(filas, filtros);
  assert.strictEqual(out.length, 2);
  assert.ok(out.every(f => f.chofer === 'Asensi'));
});

test('planilla filtro: por fecha de carga funciona (columna extra, no una de las 16 del escritorio)', () => {
  const filas = armarFilas(VIAJES_REALES, TARIFAS, INDEXACION);
  const filtros = new Array(COLUMNAS_TABLA.length).fill('');
  filtros[indiceColumna('fecha_carga')] = '2026-07-13';
  const out = filtrarFilasPorColumna(filas, filtros);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].id, 4);
});

test('planilla filtro: combinar dos columnas es AND, no OR', () => {
  const filas = armarFilas(VIAJES_REALES, TARIFAS, INDEXACION);
  const filtros = new Array(COLUMNAS_TABLA.length).fill('');
  filtros[indiceColumna('cliente')] = 'FORESA';
  filtros[indiceColumna('chofer')] = 'PABLO';
  const out = filtrarFilasPorColumna(filas, filtros);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].id, 4);
});

test('planilla filtro: sin filtros devuelve todas las filas', () => {
  const filas = armarFilas(VIAJES_REALES, TARIFAS, INDEXACION);
  const out = filtrarFilasPorColumna(filas, []);
  assert.strictEqual(out.length, filas.length);
});

test('planilla filtro: es insensible a mayusculas', () => {
  const filas = armarFilas(VIAJES_REALES, TARIFAS, INDEXACION);
  const filtros = new Array(COLUMNAS_TABLA.length).fill('');
  filtros[indiceColumna('cliente')] = 'rnm';
  const out = filtrarFilasPorColumna(filas, filtros);
  assert.strictEqual(out.length, 1);
});
