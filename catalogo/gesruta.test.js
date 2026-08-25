// Tests — catalogos Gesruta (material y chofer) como conjuntos CERRADOS.
// Semillas del export real (765 lineas): 42 materiales, 25 choferes.
// Lo que NO se negocia: nunca inventar un codigo. Sin match unico -> null + motivo.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { resolverMaterial, resolverChofer, MATERIALES, CHOFERES } = require('./gesruta.js');

// ============================================================================
// MATERIAL
// ============================================================================
test('material: nombres Gesruta exactos', () => {
  assert.strictEqual(resolverMaterial('Metanol').codigo, '5');
  assert.strictEqual(resolverMaterial('COLA').codigo, '1');
  assert.strictEqual(resolverMaterial('Vinka-Plast.').codigo, 'VINKA');
});

test('material: como lo escribe la FICHA y el ALBARAN de Foresa -> COLA', () => {
  ['FORESA RES 0201', 'Res 0541', 'Res 0201', 'Resina colofonia'].forEach(function (lit) {
    assert.strictEqual(resolverMaterial(lit).codigo, '1', lit + ' deberia ser COLA');
  });
});

test('material: ruido de concentracion/envase/ADR no impide el match', () => {
  assert.strictEqual(resolverMaterial('Acido Acetico Glacial Solution 100%').codigo, 'ACETIC');
  assert.strictEqual(resolverMaterial('L-Lisina Lica 50%').codigo, '62');
  assert.strictEqual(resolverMaterial('VINKA PLAST QD 390 BULK').codigo, 'VINKA');
});

test('material: la vision se come letras ("VINA" por "VINKA") -> igual resuelve', () => {
  assert.strictEqual(resolverMaterial('VINA PLAST OD 390 BULK').codigo, 'VINKA');
});

test('material: abreviatura de ficha "A. Acetico"', () => {
  assert.strictEqual(resolverMaterial('A. Acetico').codigo, 'ACETIC');
});

test('SALVAGUARDA material: "Resorcinol" NO puede resolver a COLA por contener "RES"', () => {
  // Bug real detectado en pruebas: el alias RES matcheaba dentro de RESORCINOL y
  // habria facturado COLA por un producto distinto. La contencion es por limite
  // de palabra, nunca por substring crudo.
  const r = resolverMaterial('Resorcinol');
  assert.strictEqual(r.codigo, null, 'no debe resolver a COLA');
  assert.strictEqual(r.revisar, true);
  assert.match(r.motivo, /no esta en el listado|coincide con varios/);
});

test('material desconocido o vacio -> null + motivo, nunca un codigo inventado', () => {
  assert.strictEqual(resolverMaterial('PRODUCTO INEXISTENTE XYZ').codigo, null);
  assert.strictEqual(resolverMaterial('').codigo, null);
  assert.strictEqual(resolverMaterial(null).codigo, null);
});

test('material: el catalogo se puede inyectar', () => {
  const r = resolverMaterial('AGUA', { materiales: { 'H2O': 'AGUA' }, alias: {} });
  assert.strictEqual(r.codigo, 'H2O');
});

// ============================================================================
// CHOFER
// ============================================================================
test('chofer: nombres reales de ficha -> codigo Gesruta', () => {
  const casos = {
    'Juan Manuel Abal': '30', 'MARCOS': '12', 'PEDRO FRAGA': '21',
    'JOSE CARLOS ALFONSIN': '39', 'BREOGAN': 'BREO', 'ASENSI': '41',
    'OSCAR SAYANS': '23', 'JACOBO': 'JAC', 'JOSE ARIAS': 'ARIA',
    'RODRIGO PEREZ': '32', 'JOSE MANUEL PAZ': '34', 'PABLO CARLES': '6',
  };
  Object.keys(casos).forEach(function (lit) {
    assert.strictEqual(resolverChofer(lit).codigo, casos[lit], lit);
  });
});

test('chofer: apellido mal leido en el manuscrito -> tolerancia de 1 caracter', () => {
  assert.strictEqual(resolverChofer('RUBEN ABELO').codigo, '18', 'ABELO por ABALO');
  assert.strictEqual(resolverChofer('MANUEL ABEY').codigo, '4', 'ABEY por ABOY');
  assert.strictEqual(resolverChofer('JUAN L GLZ').codigo, '38', 'GLZ por GLEZ');
});

test('chofer: la ficha abrevia o agrega nombres respecto de Gesruta', () => {
  assert.strictEqual(resolverChofer('J JORGE FERREIRA').codigo, '5');
  assert.strictEqual(resolverChofer('JOSE CANDIDO').codigo, '37', 'CANDIDO pesa mas que JOSE');
  assert.strictEqual(resolverChofer('JOSE A VAZQUEZ').codigo, '45');
  assert.strictEqual(resolverChofer('NUNO PAIVA').codigo, '36');
});

test('chofer: la INICIAL desempata entre homonimos (M FERREIRA)', () => {
  // Hay dos Ferreira Goldar: MANUEL (22) y JOSE JORGE (5). La M decide.
  assert.strictEqual(resolverChofer('M FERREIRA').codigo, '22');
  assert.strictEqual(resolverChofer('J JORGE FERREIRA').codigo, '5');
});

test('SALVAGUARDA chofer: una inicial canonica no puede empatarle a un nombre completo', () => {
  // Bug real: "MARCOS" empataba con "LUIS M. TRIÑANES" porque la M canonica
  // matcheaba cualquier palabra con esa inicial. El puntaje es el solapamiento.
  assert.strictEqual(resolverChofer('MARCOS').codigo, '12');
  assert.strictEqual(resolverChofer('LUIS TRIÑANES').codigo, '42');
});

test('chofer desconocido o vacio -> null + motivo', () => {
  const r = resolverChofer('PERSONA INEXISTENTE');
  assert.strictEqual(r.codigo, null);
  assert.strictEqual(r.revisar, true);
  assert.strictEqual(resolverChofer('').codigo, null);
  assert.strictEqual(resolverChofer(null).codigo, null);
});

test('los catalogos tienen el contenido del export real', () => {
  assert.strictEqual(Object.keys(MATERIALES).length, 42);
  assert.strictEqual(Object.keys(CHOFERES).length, 25);
  assert.strictEqual(MATERIALES['1'], 'COLA');
  assert.strictEqual(CHOFERES['30'], 'JUAN MANUEL ABAL');
});
