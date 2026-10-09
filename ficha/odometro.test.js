// Tests — odometro por tractora (km vacios y ultimo km registrado).
//
// Cada test fija uno de los tres defectos que el modulo corrige. Si alguien
// vuelve a encadenar por hoja o por posicion en el array, aca se ve cual de los
// tres vuelve a aparecer.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  ultimosOdometros, encadenarPorTractora, filasUltimoOdometro, MAX_VACIOS_KM
} = require('./odometro.js');

function viaje(tractoraN, km_inicio, km_final, extra) {
  return Object.assign({ tractoraN, km_inicio, km_final, hoja_idx: 0 }, extra || {});
}

// ============================================================================
// DEFECTO 1 — el primer viaje de cada ficha se quedaba sin km vacios
// ============================================================================
test('el PRIMER viaje de la ficha tiene km vacios si hay odometro previo', () => {
  // Antes: `if (i > 0 && misma hoja)` -> el primero nunca entraba. Se perdia el
  // vacio de 1 de cada 3 viajes, siempre el mismo.
  const vs = [viaje('2498KZL', 840000, 840500)];
  const r = encadenarPorTractora(vs, { '2498KZL': { km_final: 839800, fecha: '2026-06-01' } });
  assert.strictEqual(vs[0].km_vacios, 200);
  assert.strictEqual(vs[0].origen_km_vacios, 'cadena_tabla');
  assert.strictEqual(r.encadenados, 1);
});

test('sin odometro previo el primer viaje queda null, pero no es error', () => {
  const vs = [viaje('2498KZL', 840000, 840500)];
  encadenarPorTractora(vs, {});
  assert.strictEqual(vs[0].km_vacios, null);
  assert.strictEqual(vs[0].origen_km_vacios, 'sin_odometro_previo');
});

// ============================================================================
// DEFECTO 2 — nada persistia el odometro entre ingestas
// ============================================================================
test('ultimosOdometros: por tractora se queda con el km_final MAS ALTO', () => {
  // El odometro solo crece: el maximo es el ultimo, sin depender del orden en
  // que la tabla devuelva las filas ni de que la fecha se haya leido bien.
  const p = ultimosOdometros([
    { matricula_tractora: '2498KZL', km_final: 840000, fecha_carga: '2026-06-01' },
    { matricula_tractora: '2498KZL', km_final: 841200, fecha_carga: '2026-06-08' },
    { matricula_tractora: '2498KZL', km_final: 840600, fecha_carga: '2026-06-05' },
    { matricula_tractora: '8168JSD', km_final: 500000, fecha_carga: '2026-06-02' },
  ]);
  assert.strictEqual(p['2498KZL'].km_final, 841200);
  assert.strictEqual(p['8168JSD'].km_final, 500000);
});

test('ultimosOdometros ignora filas sin matricula o sin km_final', () => {
  const p = ultimosOdometros([
    { matricula_tractora: '', km_final: 1000 },
    { matricula_tractora: '2498KZL', km_final: null },
    { matricula_tractora: '2498KZL', km_final: 840000 },
  ]);
  assert.deepStrictEqual(Object.keys(p), ['2498KZL']);
});

test('el padron se devuelve actualizado para volver a persistirlo', () => {
  // Es el encargo literal: el ultimo km se registra POR VIAJE, no una vez por
  // ficha. Tras ingestar, el padron ya refleja el ultimo viaje del lote.
  const vs = [viaje('2498KZL', 840000, 840500), viaje('2498KZL', 840600, 841000)];
  const r = encadenarPorTractora(vs, { '2498KZL': { km_final: 839800 } });
  assert.strictEqual(r.ultimos['2498KZL'].km_final, 841000);

  const filas = filasUltimoOdometro(r.ultimos);
  assert.strictEqual(filas.length, 1);
  assert.strictEqual(filas[0].matricula_tractora, '2498KZL');
  assert.strictEqual(filas[0].km_final, 841000);
});

// ============================================================================
// DEFECTO 3 — encadenar por posicion/hoja en vez de por tractora
// ============================================================================
test('DOS FICHAS del MISMO camion encadenan (antes no lo hacian)', () => {
  // Dos chóferes distintos sobre la misma tractora, o dos semanas. El odometro
  // es del camion, no de la hoja.
  const vs = [
    viaje('2498KZL', 840000, 840500, { hoja_idx: 0 }),
    viaje('2498KZL', 840700, 841000, { hoja_idx: 1 }),
  ];
  encadenarPorTractora(vs, {});
  assert.strictEqual(vs[1].km_vacios, 200, 'encadena aunque sean hojas distintas');
  assert.strictEqual(vs[1].origen_km_vacios, 'cadena_lote');
});

test('SALVAGUARDA: dos camiones distintos NUNCA se encadenan entre si', () => {
  // El bug latente: contiguos en el array y en la misma hoja -> se restaban los
  // odometros de dos camiones y salia un numero absurdo con pinta de valido.
  const vs = [
    viaje('2498KZL', 840000, 840500, { hoja_idx: 0 }),
    viaje('8168JSD', 500000, 500400, { hoja_idx: 0 }),
  ];
  encadenarPorTractora(vs, {});
  assert.strictEqual(vs[1].km_vacios, null);
  assert.strictEqual(vs[1].origen_km_vacios, 'sin_odometro_previo');
});

test('la cadena se ordena por ODOMETRO, no por el orden del escaneo', () => {
  // Los papeles se escanean en cualquier orden; el odometro es monotono.
  const vs = [
    viaje('2498KZL', 840700, 841000),
    viaje('2498KZL', 840000, 840500),
  ];
  encadenarPorTractora(vs, {});
  assert.strictEqual(vs[1].km_vacios, null, 'el de odometro menor es el primero de la cadena');
  assert.strictEqual(vs[0].km_vacios, 200, 'el de odometro mayor encadena con el anterior');
});

// ============================================================================
// GUARDAS — un km vacio inventado se factura; un null se revisa
// ============================================================================
test('salto NEGATIVO: no se escribe, se marca REVISAR con motivo', () => {
  const marcados = [];
  const vs = [viaje('2498KZL', 839000, 839500)];
  const r = encadenarPorTractora(vs, { '2498KZL': { km_final: 840000 } },
    (v, m) => marcados.push(m));
  assert.strictEqual(vs[0].km_vacios, null);
  assert.strictEqual(vs[0].origen_km_vacios, 'negativo');
  assert.strictEqual(marcados.length, 1);
  assert.match(r.avisos[0], /negativos/);
});

test('salto EXCESIVO: probablemente faltan viajes sin registrar', () => {
  const vs = [viaje('2498KZL', 850000, 850500)];
  const r = encadenarPorTractora(vs, { '2498KZL': { km_final: 840000 } });
  assert.strictEqual(vs[0].km_vacios, null);
  assert.strictEqual(vs[0].origen_km_vacios, 'salto_excesivo');
  assert.match(r.avisos[0], /viajes sin registrar/);
});

test('un vacio largo pero plausible SI se acepta (retorno en vacio)', () => {
  const vs = [viaje('2498KZL', 840900, 841400)];
  encadenarPorTractora(vs, { '2498KZL': { km_final: 840000 } });
  assert.strictEqual(vs[0].km_vacios, 900, 'Huelva -> Galicia en vacio es real');
  assert.ok(900 < MAX_VACIOS_KM);
});

test('el odometro avanza aunque el vacio no se haya podido calcular', () => {
  // Un salto excesivo no rompe la cadena para el viaje siguiente: lo que importa
  // del eslabon roto es donde quedo el camion.
  const vs = [
    viaje('2498KZL', 850000, 850500),   // salto excesivo desde 840000
    viaje('2498KZL', 850600, 851000),   // este SI debe encadenar
  ];
  encadenarPorTractora(vs, { '2498KZL': { km_final: 840000 } });
  assert.strictEqual(vs[0].km_vacios, null);
  assert.strictEqual(vs[1].km_vacios, 100);
});

test('viaje sin matricula resuelta: no se encadena, queda con motivo', () => {
  const vs = [viaje(null, 840000, 840500)];
  encadenarPorTractora(vs, {});
  assert.strictEqual(vs[0].km_vacios, null);
  assert.strictEqual(vs[0].origen_km_vacios, 'sin_matricula');
});

test('viaje sin km_inicio: no participa de la cadena', () => {
  const vs = [viaje('2498KZL', null, 840500)];
  encadenarPorTractora(vs, { '2498KZL': { km_final: 840000 } });
  assert.strictEqual(vs[0].km_vacios, null);
  assert.strictEqual(vs[0].origen_km_vacios, 'sin_km_inicio');
});

test('el padron previo no se muta', () => {
  const previos = { '2498KZL': { km_final: 840000 } };
  encadenarPorTractora([viaje('2498KZL', 840100, 841000)], previos);
  assert.strictEqual(previos['2498KZL'].km_final, 840000);
});

test('entradas vacias o basura no rompen', () => {
  assert.deepStrictEqual(ultimosOdometros(null), {});
  assert.deepStrictEqual(filasUltimoOdometro(null), []);
  const r = encadenarPorTractora(null, null);
  assert.deepStrictEqual(r.ultimos, {});
  assert.strictEqual(r.encadenados, 0);
});
