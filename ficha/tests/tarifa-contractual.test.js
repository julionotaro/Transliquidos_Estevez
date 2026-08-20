// Tests — tarifa contractual en la ingesta (tabla Tarifas -> columna del viaje).
// Cubre los DOS PUENTES: punto canonico (via resolver-punto) y razon social
// (contencion de tokens del cliente corto dentro del largo). Y la regla de oro:
// nunca inventa — sin match unico devuelve tarifa:null + motivo.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  buscarTarifaContractual, clienteCoincide, materialCoincide,
} = require('../tarifa-contractual.js');

// Catalogo minimo de puntos (forma real de la data table `puntos`).
const CATALOGO = [
  { id_punto: '1', nombre_canonico: 'CALDAS DE REIS', alias: 'CALDAS|CALDAS REIS' },
  { id_punto: 'TE', nombre_canonico: 'TERUEL', alias: 'CELLA|FINSA CELLA' },
  { id_punto: '2', nombre_canonico: 'VILAGARCIA', alias: 'VILLGARCIA' },
];

// Tarifas: cliente = razon social larga; origen/destino = nombre canonico.
const TARIFAS = [
  { cliente: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.', origen: 'CALDAS DE REIS', destino: 'TERUEL', material: 'FORMOL', tarifa_tn: '12,50', precio_fijo: '' },
  { cliente: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.', origen: 'CALDAS DE REIS', destino: 'TERUEL', material: 'Cualquiera', tarifa_tn: '10,00', precio_fijo: '' },
  { cliente: 'DIVERSEY S.L.', origen: 'VILAGARCIA', destino: 'CALDAS DE REIS', material: 'Cualquiera', tarifa_tn: '', precio_fijo: '450' },
];

// ============================================================================
// 1. Puente 1 (punto por alias) + Puente 2 (razon social) + material especifico.
// ============================================================================
test('tarifa: cliente corto "Foresa" + origen alias "Caldas" -> matchea razon social y punto canonico, prefiere material especifico', () => {
  const viaje = { cliente: 'Foresa', origen: 'Caldas', destino: 'Cella', material: 'Formol' };
  const r = buscarTarifaContractual(viaje, TARIFAS, CATALOGO);
  assert.ok(r && r.tarifa === undefined, 'devuelve tarifa, no {tarifa:null}');
  assert.strictEqual(r.tarifa_tn, 12.5, 'toma la tarifa del material especifico (FORMOL), no el comodin');
  assert.strictEqual(r.precio_fijo, null);
  assert.strictEqual(r.origen_canon, '1');
  assert.strictEqual(r.destino_canon, 'TE');
  assert.strictEqual(r.revisar, false, 'match exacto de alias es alta confianza -> no revisar');
});

// ============================================================================
// 2. Sin material especifico -> cae al comodin "Cualquiera".
// ============================================================================
test('tarifa: material que no existe especifico -> usa la tarifa comodin "Cualquiera"', () => {
  const viaje = { cliente: 'Foresa', origen: 'Caldas', destino: 'Cella', material: 'Metanol' };
  const r = buscarTarifaContractual(viaje, TARIFAS, CATALOGO);
  assert.strictEqual(r.tarifa_tn, 10, 'sin especifico para Metanol, aplica el comodin');
  assert.strictEqual(r.material_tarifa, 'Cualquiera');
});

// ============================================================================
// 3. precio_fijo en vez de tarifa_tn.
// ============================================================================
test('tarifa: tarifa por precio_fijo (Diversey Vilagarcia->Caldas)', () => {
  const viaje = { cliente: 'Diversey', origen: 'Villgarcia', destino: 'Caldas', material: 'Detergente' };
  const r = buscarTarifaContractual(viaje, TARIFAS, CATALOGO);
  assert.strictEqual(r.precio_fijo, 450);
  assert.strictEqual(r.tarifa_tn, null);
});

// ============================================================================
// 4. Nunca inventa: sin tarifa cargada para la ruta -> tarifa:null + motivo.
// ============================================================================
test('tarifa: ruta sin tarifa cargada -> {tarifa:null, motivo}, no inventa', () => {
  const viaje = { cliente: 'Foresa', origen: 'Vilagarcia', destino: 'Caldas', material: 'Formol' };
  const r = buscarTarifaContractual(viaje, TARIFAS, CATALOGO);
  assert.strictEqual(r.tarifa, null);
  assert.match(r.motivo, /sin tarifa cargada/);
});

// ============================================================================
// 5. Ambiguedad: dos tarifas especificas posibles -> no adivina.
// ============================================================================
test('tarifa: dos tarifas especificas para la misma ruta/cliente -> tarifa:null + candidatas', () => {
  const tarifas = [
    { cliente: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.', origen: 'CALDAS DE REIS', destino: 'TERUEL', material: 'FORMOL', tarifa_tn: '12,50' },
    { cliente: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.', origen: 'CALDAS DE REIS', destino: 'TERUEL', material: 'FORMOL BIS', tarifa_tn: '13,00' },
  ];
  const viaje = { cliente: 'Foresa', origen: 'Caldas', destino: 'Cella', material: 'Formol' };
  const r = buscarTarifaContractual(viaje, tarifas, CATALOGO);
  assert.strictEqual(r.tarifa, null);
  assert.ok(Array.isArray(r.candidatas) && r.candidatas.length === 2);
  assert.match(r.motivo, /revisar cual aplica/);
});

// ============================================================================
// 6. Viaje sin cliente o sin origen/destino -> no busca.
// ============================================================================
test('tarifa: viaje sin cliente -> tarifa:null con motivo', () => {
  const r = buscarTarifaContractual({ cliente: '', origen: 'Caldas', destino: 'Cella' }, TARIFAS, CATALOGO);
  assert.strictEqual(r.tarifa, null);
  assert.match(r.motivo, /sin cliente/);
});

// ============================================================================
// 7. Sin tabla de tarifas -> null (no rompe la ingesta).
// ============================================================================
test('tarifa: sin tabla Tarifas -> null', () => {
  assert.strictEqual(buscarTarifaContractual({ cliente: 'Foresa', origen: 'Caldas', destino: 'Cella' }, [], CATALOGO), null);
  assert.strictEqual(buscarTarifaContractual({ cliente: 'Foresa' }, null, CATALOGO), null);
});

// ============================================================================
// 8. clienteCoincide — contencion de tokens (puente 2).
// ============================================================================
test('clienteCoincide: corto contenido en largo matchea; token ajeno no', () => {
  assert.ok(clienteCoincide('Foresa', 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.'));
  assert.ok(clienteCoincide('foresa', 'Foresa'), 'exacto normalizado');
  assert.ok(clienteCoincide('Clavo Food', 'CLAVO FOOD PACKERS S.L.'));
  assert.ok(!clienteCoincide('Foresa', 'DIVERSEY S.L.'), 'sin token comun');
  assert.ok(!clienteCoincide('', 'FORESA'), 'vacio no matchea');
  assert.ok(!clienteCoincide('Foresa Bresfor', 'FORESA IND.QUIMICAS'), 'token extra (Bresfor) no contenido -> no matchea');
});

// ============================================================================
// 9. materialCoincide — comodin vs inclusion.
// ============================================================================
test('materialCoincide: "Cualquiera"/vacio es comodin; si no, inclusion en cualquier sentido', () => {
  assert.ok(materialCoincide('Formol', 'Cualquiera'));
  assert.ok(materialCoincide('Formol', ''));
  assert.ok(materialCoincide('Formol 40%', 'Formol'), 'tarifa mas corta contenida en el material del viaje');
  assert.ok(materialCoincide('Formol', 'Formol 40%'), 'material del viaje contenido en el de la tarifa');
  assert.ok(!materialCoincide('Metanol', 'Formol'));
  assert.ok(!materialCoincide('', 'Formol'), 'material del viaje vacio con tarifa especifica -> no');
});
