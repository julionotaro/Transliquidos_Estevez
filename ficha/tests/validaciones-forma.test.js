// Tests CAMBIO 2 — validaciones de forma (Capa 2, deterministas).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const VF = require('../validaciones-forma.js');

// (a) Matricula --------------------------------------------------------------
test('forma (a): matricula actual valida (con y sin separador)', () => {
  assert.strictEqual(VF.esMatriculaValida('1234-ABC'), true);
  assert.strictEqual(VF.esMatriculaValida('2498KZL'), true);
  assert.strictEqual(VF.esMatriculaValida('2498 KZL'), true);
});

test('forma (a): matricula de remolque con prefijo R valida (R1007BCV)', () => {
  assert.strictEqual(VF.esMatriculaValida('R1007BCV'), true);
});

test('forma (a): matricula historica de provincia valida', () => {
  assert.strictEqual(VF.esMatriculaValida('M1234AB'), true);
  assert.strictEqual(VF.esMatriculaValida('PO-1234-K'), true);
  assert.strictEqual(VF.esMatriculaValida('GC 12345'), true);
});

test('forma (a): texto que no es matricula -> invalido (AVEIRO en el campo matricula)', () => {
  assert.strictEqual(VF.esMatriculaValida('AVEIRO'), false);
  assert.strictEqual(VF.esMatriculaValida('BEGEGA'), false);
});

test('forma (a): vacio no es error de forma (la ausencia es otro eje)', () => {
  assert.strictEqual(VF.esMatriculaValida(''), true);
  assert.strictEqual(VF.esMatriculaValida(null), true);
});

// (b) Fechas -----------------------------------------------------------------
test('forma (b): descarga posterior o igual a carga -> en orden', () => {
  assert.strictEqual(VF.fechasEnOrden('2026-07-07', '2026-07-08'), true);
  assert.strictEqual(VF.fechasEnOrden('2026-07-07', '2026-07-07'), true);
});

test('forma (b): descarga anterior a carga -> fuera de orden', () => {
  assert.strictEqual(VF.fechasEnOrden('2026-07-07', '2026-07-05'), false);
});

test('forma (b): si falta una fecha o no parsea -> indeterminado (no marca)', () => {
  assert.strictEqual(VF.fechasEnOrden('2026-07-07', ''), true);
  assert.strictEqual(VF.fechasEnOrden('', '2026-07-05'), true);
  assert.strictEqual(VF.fechasEnOrden('ilegible', '2026-07-05'), true);
});

// (c) Cantidad ---------------------------------------------------------------
test('forma (c): cantidad > 0 valida; 0 / vacia / no numerica invalida', () => {
  assert.strictEqual(VF.esCantidadValida(23140), true);
  assert.strictEqual(VF.esCantidadValida('23140'), true);
  assert.strictEqual(VF.esCantidadValida(0), false);
  assert.strictEqual(VF.esCantidadValida(''), false);
  assert.strictEqual(VF.esCantidadValida(null), false);
  assert.strictEqual(VF.esCantidadValida('abc'), false);
});

test('cantidadDe: prefiere kg_documento, cae a kg_hoja, U.M. = kg', () => {
  assert.deepStrictEqual(VF.cantidadDe({ kg_documento: 23140, kg_hoja: 23000 }), { valor: 23140, um: 'kg' });
  assert.deepStrictEqual(VF.cantidadDe({ kg_documento: null, kg_hoja: 23000 }), { valor: 23000, um: 'kg' });
  assert.deepStrictEqual(VF.cantidadDe({ kg_documento: null, kg_hoja: null }), { valor: null, um: 'kg' });
});

// dieta ----------------------------------------------------------------------
test('dieta: se lee del JSON detalle (gastos tipo dieta); ausente -> null (celda vacia)', () => {
  const detalle = JSON.stringify({ gastos: [{ tipo: 'dieta', importe: 30, forma: 'efectivo' }, { tipo: 'peaje', importe: 12 }] });
  assert.strictEqual(VF.dietaDeDetalle(detalle), 30);
  assert.strictEqual(VF.dietaDeDetalle(JSON.stringify({ gastos: [{ tipo: 'peaje', importe: 12 }] })), null);
  assert.strictEqual(VF.dietaDeDetalle(JSON.stringify({})), null);
  assert.strictEqual(VF.dietaDeDetalle(''), null);
  assert.strictEqual(VF.dietaDeDetalle('no-json'), null);
});

// marcasForma ----------------------------------------------------------------
test('marcasForma: viaje limpio no tiene marcas', () => {
  const v = { tractora: '2498KZL', semi: 'R1007BCV', fecha: '2026-07-07', fecha_descarga: '2026-07-08', kg_documento: 23140 };
  assert.deepStrictEqual(VF.marcasForma(v), {});
});

test('marcasForma (a): matricula tractora invalida marca solo esa celda', () => {
  const v = { tractora: 'AVEIRO', semi: 'R1007BCV', fecha: '2026-07-07', fecha_descarga: '2026-07-08', kg_documento: 23140 };
  const m = VF.marcasForma(v);
  assert.ok(m.tractora && m.tractora.length === 1);
  assert.strictEqual(m.semi, undefined);
  assert.strictEqual(m.cantidad, undefined);
});

test('marcasForma (b): descarga < carga marca AMBAS celdas de fecha', () => {
  const v = { tractora: '2498KZL', semi: 'R1007BCV', fecha: '2026-07-07', fecha_descarga: '2026-07-05', kg_documento: 23140 };
  const m = VF.marcasForma(v);
  assert.ok(m.fecha && m.fecha.length);
  assert.ok(m.fecha_descarga && m.fecha_descarga.length);
});

test('marcasForma (c): cantidad 0/vacia marca la celda cantidad', () => {
  assert.ok(VF.marcasForma({ tractora: '2498KZL', semi: 'R1007BCV', kg_documento: 0, kg_hoja: null }).cantidad);
  assert.ok(VF.marcasForma({ tractora: '2498KZL', semi: 'R1007BCV', kg_documento: null, kg_hoja: null }).cantidad);
});

test('marcasForma: una celda con varias fallas une motivos (matricula + cantidad juntas en el viaje)', () => {
  const v = { tractora: 'AVEIRO', semi: 'R1007BCV', fecha: '2026-07-07', fecha_descarga: '2026-07-05', kg_documento: 0 };
  const m = VF.marcasForma(v);
  assert.ok(m.tractora, 'matricula');
  assert.ok(m.fecha && m.fecha_descarga, 'fechas');
  assert.ok(m.cantidad, 'cantidad');
});
