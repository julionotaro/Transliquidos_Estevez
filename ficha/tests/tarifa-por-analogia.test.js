// Tests — cascada de precio con tarifa por analogia (2º escalon).
//
// Cada test fija una de las dos reglas duras. Si alguna se relaja, el sistema
// empieza a poner precios que nadie pacto, con formato valido y sin aviso: el
// modo de fallo caro.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { resolverPrecio, analogiasConfirmadas } = require('../tarifa-contractual.js');

// Caso real confirmado por Julio el 27/08/2026: FORESA VILLAGARCIA -> CURIA
// SPAIN, SAU (73 viajes) se cobra a la tarifa de VILLAGARCIA -> VALLADOLID.
const TARIFAS = [
  { cliente: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.', origen: 'VILLAGARCIA',
    destino: 'VALLADOLID', material: 'Cualquiera', tarifa_tn: 38.66, precio_fijo: 0 },
  { cliente: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.', origen: 'CALDAS DE REIS',
    destino: 'BARCELONA', material: 'Cualquiera', tarifa_tn: 72.36, precio_fijo: 0 },
];

function analogia(extra) {
  return Object.assign({
    cliente: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.',
    origen: 'VILLAGARCIA',
    destino_real: 'CURIA SPAIN, SAU',
    destino_tarifado: 'VALLADOLID',
    precio: 38.66, n_viajes: 73,
    confirmado: true, estado: 'confirmado',
    revisado_por: 'Julio', fecha_revision: '2026-08-27',
  }, extra || {});
}
const CON = { candidatos: [analogia()] };

function viaje(extra) {
  return Object.assign({
    cliente: 'FORESA', origen: 'VILLAGARCIA',
    destino: 'CURIA SPAIN, SAU', material: 'METANOL',
  }, extra || {});
}

// ============================================================================
// La cascada, escalon por escalon
// ============================================================================
test('1º escalon: si hay tarifa contractual, manda esa', () => {
  const r = resolverPrecio(viaje({ destino: 'VALLADOLID' }), TARIFAS, CON, []);
  assert.strictEqual(r.tarifa_tn, 38.66);
  assert.strictEqual(r.origen_del_precio, 'contractual');
  assert.ok(!r.revisar, 'una tarifa pactada no obliga a revisar');
});

test('2º escalon: sin tarifa propia, aplica la analogia confirmada', () => {
  const r = resolverPrecio(viaje(), TARIFAS, CON, []);
  assert.strictEqual(r.tarifa_tn, 38.66);
  assert.strictEqual(r.origen_del_precio, 'analogia');
  assert.strictEqual(r.analogia.destino_tarifado, 'VALLADOLID');
  assert.strictEqual(r.analogia.confirmado_por, 'Julio');
});

test('3º escalon: sin tarifa ni analogia, manda el precio de la orden', () => {
  const r = resolverPrecio(viaje({ destino: 'SITIO NUEVO', precio_orden: 950 }),
                           TARIFAS, CON, []);
  assert.strictEqual(r.precio_fijo, 950);
  assert.strictEqual(r.origen_del_precio, 'orden');
  assert.strictEqual(r.revisar, true);
});

test('sin nada: precio vacio CON motivo, nunca un numero inventado', () => {
  const r = resolverPrecio(viaje({ destino: 'SITIO NUEVO' }), TARIFAS, CON, []);
  assert.strictEqual(r.tarifa, null);
  assert.strictEqual(r.origen_del_precio, null);
  assert.ok(r.motivo && r.motivo.length > 0, 'un hueco sin motivo es un hueco mudo');
});

// ============================================================================
// REGLA 1 — solo entra lo confirmado
// ============================================================================
test('una analogia SIN confirmar no se aplica', () => {
  const sinConfirmar = { candidatos: [analogia({ confirmado: false, estado: null })] };
  const r = resolverPrecio(viaje(), TARIFAS, sinConfirmar, []);
  assert.strictEqual(r.origen_del_precio, null);
  assert.deepStrictEqual(analogiasConfirmadas(sinConfirmar), []);
});

test('"negociable" NO es tarifa: no se aplica aunque el precio coincidiera', () => {
  // Julio, 27/08: HELM y DROVIGO pactan precio viaje a viaje. Que dos viajes
  // hayan coincidido no dice nada del tercero.
  const neg = { candidatos: [analogia({ estado: 'negociable', confirmado: false })] };
  const r = resolverPrecio(viaje(), TARIFAS, neg, []);
  assert.strictEqual(r.origen_del_precio, null);
});

test('"descartado" y "alias_punto" tampoco entran por la puerta de la analogia', () => {
  for (const estado of ['descartado', 'alias_punto']) {
    const a = { candidatos: [analogia({ estado, confirmado: false })] };
    assert.strictEqual(resolverPrecio(viaje(), TARIFAS, a, []).origen_del_precio, null,
      'estado ' + estado + ' no debe producir precio');
  }
});

test('confirmado:true con estado que no es "confirmado" tampoco pasa', () => {
  // Las dos condiciones se exigen juntas a proposito: un JSON editado a mano a
  // medias no debe poder colar un precio.
  const a = { candidatos: [analogia({ estado: 'negociable', confirmado: true })] };
  assert.strictEqual(resolverPrecio(viaje(), TARIFAS, a, []).origen_del_precio, null);
});

// ============================================================================
// REGLA 2 — la analogia siempre se ve
// ============================================================================
test('la analogia SIEMPRE marca revisar y explica de donde sale el precio', () => {
  const r = resolverPrecio(viaje(), TARIFAS, CON, []);
  assert.strictEqual(r.revisar, true, 'observada, no pactada');
  assert.match(r.motivo, /CURIA SPAIN, SAU/);
  assert.match(r.motivo, /VALLADOLID/);
  assert.match(r.motivo, /Julio/);
});

// ============================================================================
// El precio se relee de la tabla, no se copia del JSON
// ============================================================================
test('si la tarifa modelo cambia, la analogia sigue el valor NUEVO', () => {
  const subida = TARIFAS.map(t => Object.assign({}, t,
    t.destino === 'VALLADOLID' ? { tarifa_tn: 41.20 } : {}));
  const r = resolverPrecio(viaje(), subida, CON, []);
  assert.strictEqual(r.tarifa_tn, 41.20,
    'el JSON guarda 38,66; debe mandar la tabla, no el numero congelado');
});

test('analogia hacia una ruta que tampoco tiene tarifa: vacio con motivo', () => {
  const rota = { candidatos: [analogia({ destino_tarifado: 'SITIO SIN TARIFA' })] };
  const r = resolverPrecio(viaje(), TARIFAS, rota, []);
  assert.strictEqual(r.origen_del_precio, null);
  assert.match(r.motivo, /tampoco tiene tarifa/);
});

// ============================================================================
// Ambito: una analogia es de UN cliente y UN origen
// ============================================================================
test('la analogia no se aplica a otro cliente', () => {
  const r = resolverPrecio(viaje({ cliente: 'QUIMIDROGA' }), TARIFAS, CON, []);
  assert.strictEqual(r.origen_del_precio, null);
});

test('la analogia no se aplica desde otro origen', () => {
  const r = resolverPrecio(viaje({ origen: 'CALDAS DE REIS' }), TARIFAS, CON, []);
  assert.strictEqual(r.origen_del_precio, null);
});

test('sin analogias cargadas la cascada no rompe', () => {
  for (const vacio of [null, undefined, {}, [], { candidatos: [] }]) {
    const r = resolverPrecio(viaje(), TARIFAS, vacio, []);
    assert.strictEqual(r.origen_del_precio, null);
  }
});
