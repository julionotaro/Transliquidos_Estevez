// Tests — memoria de decisiones humanas.
//
// Cada test fija una de las tres reglas que hacen que esta tabla sea segura. Si
// alguna se relaja, aca se ve cual: una memoria que acepta conjeturas o que
// generaliza sola convierte un error puntual en un error permanente e invisible.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const M = require('../memoria-decisiones.js');

const HOY = '2026-08-27';
function mem() { return M.memoriaVacia(); }
function decision(extra) {
  return Object.assign({
    tipo: 'punto',
    literal: 'ASTURIANA DE ZINC S.A., AVDA. DE GALICIA, 46002 TERUEL',
    valor: 'AVILE',
    quien: 'Julio',
    fecha: HOY,
  }, extra || {});
}

// ============================================================================
// Lo que el modulo existe para hacer: no repetir la pregunta
// ============================================================================
test('una duda resuelta NO se vuelve a preguntar', () => {
  const m = mem();
  assert.strictEqual(M.consultar(m, 'punto', decision().literal, 'RNM'), null);

  const r = M.recordar(m, decision({ ambito: 'RNM' }));
  assert.strictEqual(r.ok, true);

  const hit = M.consultar(m, 'punto', decision().literal, 'RNM');
  assert.strictEqual(hit.valor, 'AVILE');
  assert.strictEqual(hit.origen, 'memoria');
  assert.match(hit.motivo, /Julio/);
});

test('el literal se normaliza: acentos, mayusculas y puntuacion no rompen el match', () => {
  const m = mem();
  M.recordar(m, decision({ ambito: 'RNM' }));
  // El mismo dato leido con otra puntuacion en otra corrida.
  const hit = M.consultar(m, 'punto',
    'asturiana de zinc sa - avda de galicia 46002 teruel', 'RNM');
  assert.ok(hit, 'la misma direccion escrita distinto tiene que resolver igual');
  assert.strictEqual(hit.valor, 'AVILE');
});

// ============================================================================
// REGLA 1 — solo entra lo que decidio un humano
// ============================================================================
test('una decision SIN autor se rechaza (seria una conjetura permanente)', () => {
  const m = mem();
  const r = M.recordar(m, decision({ ambito: 'RNM', quien: null }));
  assert.strictEqual(r.ok, false);
  assert.match(r.motivo, /QUIEN/);
  assert.strictEqual(M.consultar(m, 'punto', decision().literal, 'RNM'), null);
});

test('un "no se" no se recuerda: se vuelve a preguntar', () => {
  const m = mem();
  assert.strictEqual(M.recordar(m, decision({ ambito: 'RNM', valor: null })).ok, false);
  assert.strictEqual(M.recordar(m, decision({ ambito: 'RNM', valor: '' })).ok, false);
});

test('un literal demasiado corto se rechaza: matchearia cualquier cosa', () => {
  const m = mem();
  const r = M.recordar(m, decision({ literal: 'PT', ambito: 'RNM' }));
  assert.strictEqual(r.ok, false);
  assert.match(r.motivo, /corto/);
});

test('un literal que es SOLO forma societaria no deja nada que recordar', () => {
  const m = mem();
  // "S.A." se cae entero al normalizar: no identifica a nadie.
  const r = M.recordar(m, decision({ literal: 'S.A.', ambito: 'RNM' }));
  assert.strictEqual(r.ok, false);
  assert.match(r.motivo, /vacio/);
});

// ============================================================================
// REGLA 2 — el ambito manda sobre lo global
// ============================================================================
test('lo decidido para un cliente NO se aplica a otro', () => {
  const m = mem();
  M.recordar(m, decision({ literal: 'TERUEL', valor: 'UTI', ambito: 'BRESFOR' }));
  assert.ok(M.consultar(m, 'punto', 'TERUEL', 'BRESFOR'));
  assert.strictEqual(M.consultar(m, 'punto', 'TERUEL', 'RNM'), null,
    'TERUEL no significa lo mismo para todos los clientes');
});

test('una decision GLOBAL aplica a cualquier cliente, y la especifica le gana', () => {
  const m = mem();
  M.recordar(m, decision({ literal: 'CALDAS', valor: '1', global: true }));
  const generico = M.consultar(m, 'punto', 'CALDAS', 'QUIMIDROGA');
  assert.strictEqual(generico.valor, '1');
  assert.strictEqual(generico.ambito_usado, 'global');

  M.recordar(m, decision({ literal: 'CALDAS', valor: 'OTRO', ambito: 'QUIMIDROGA' }));
  const especifico = M.consultar(m, 'punto', 'CALDAS', 'QUIMIDROGA');
  assert.strictEqual(especifico.valor, 'OTRO');
  assert.strictEqual(especifico.ambito_usado, 'especifico');
  // y el resto sigue viendo la global
  assert.strictEqual(M.consultar(m, 'punto', 'CALDAS', 'FORESA').valor, '1');
});

test('tipos distintos no se pisan aunque el literal sea el mismo', () => {
  const m = mem();
  M.recordar(m, decision({ tipo: 'punto',    literal: 'AVELLANEDA', valor: 'AVE' }));
  M.recordar(m, decision({ tipo: 'material', literal: 'AVELLANEDA', valor: 'COLA' }));
  assert.strictEqual(M.consultar(m, 'punto', 'AVELLANEDA').valor, 'AVE');
  assert.strictEqual(M.consultar(m, 'material', 'AVELLANEDA').valor, 'COLA');
});

// ============================================================================
// REGLA 3 — trazabilidad y revocacion
// ============================================================================
test('una decision se puede revocar y vuelve a preguntarse', () => {
  const m = mem();
  M.recordar(m, decision({ ambito: 'RNM' }));
  assert.strictEqual(M.olvidar(m, 'punto', decision().literal, 'RNM'), true);
  assert.strictEqual(M.consultar(m, 'punto', decision().literal, 'RNM'), null);
});

test('regrabar conserva el uso acumulado y devuelve la entrada anterior', () => {
  const m = mem();
  M.recordar(m, decision({ ambito: 'RNM' }));
  M.consultar(m, 'punto', decision().literal, 'RNM');
  M.consultar(m, 'punto', decision().literal, 'RNM');
  const r = M.recordar(m, decision({ ambito: 'RNM', valor: 'OTRO', quien: 'Ana' }));
  assert.strictEqual(r.reemplazo.valor, 'AVILE', 'hay que poder ver que se cambio');
  assert.strictEqual(M.consultar(m, 'punto', decision().literal, 'RNM').valor, 'OTRO');
});

// ============================================================================
// EL NUMERO — el que dice si el sistema aprende
// ============================================================================
test('tasaRevisar separa OK, REVISAR y FALTA DOC', () => {
  const t = M.tasaRevisar([
    { estado_fila: 'OK' }, { estado_fila: 'OK' },
    { estado_fila: 'REVISAR' }, { estado_fila: 'REVISAR: tarifa' },
    { estado_fila: 'FALTA DOC' },
  ]);
  assert.strictEqual(t.total, 5);
  assert.strictEqual(t.revisar, 2);
  assert.strictEqual(t.falta_doc, 1);
  assert.strictEqual(t.ok, 2);
  assert.strictEqual(t.pct_revisar, 40);
});

test('un lote vacio no divide por cero', () => {
  assert.strictEqual(M.tasaRevisar([]).pct_revisar, 0);
  assert.strictEqual(M.tasaRevisar(null).total, 0);
});

// ============================================================================
// La lista de trabajo: por que el esfuerzo baja mas rapido que las filas
// ============================================================================
test('el mismo literal en seis filas es UNA decision, no seis', () => {
  const filas = [];
  for (let i = 0; i < 6; i++) {
    filas.push({ estado_fila: 'REVISAR',
      dudas: [{ tipo: 'punto', literal: 'ASTURIANA DE ZINC TERUEL', ambito: 'RNM' }] });
  }
  const pend = M.pendientesDeAprender(filas, mem());
  assert.strictEqual(pend.length, 1);
  assert.strictEqual(pend[0].filas, 6);
});

test('lo ya resuelto desaparece de la lista de trabajo', () => {
  const m = mem();
  const filas = [{ estado_fila: 'REVISAR',
    dudas: [{ tipo: 'punto', literal: 'ASTURIANA DE ZINC TERUEL', ambito: 'RNM' },
            { tipo: 'punto', literal: 'CARREIRA PRODUTOS', ambito: 'RNM' }] }];
  assert.strictEqual(M.pendientesDeAprender(filas, m).length, 2);

  M.recordar(m, decision({ literal: 'ASTURIANA DE ZINC TERUEL', ambito: 'RNM' }));
  const pend = M.pendientesDeAprender(filas, m);
  assert.strictEqual(pend.length, 1);
  assert.strictEqual(pend[0].literal, 'CARREIRA PRODUTOS');
});

test('la lista se ordena por cuanto rinde resolver cada duda', () => {
  const filas = [
    { dudas: [{ tipo: 'punto', literal: 'POCO FRECUENTE SL' }] },
    { dudas: [{ tipo: 'punto', literal: 'MUY FRECUENTE SL' }] },
    { dudas: [{ tipo: 'punto', literal: 'MUY FRECUENTE SL' }] },
    { dudas: [{ tipo: 'punto', literal: 'MUY FRECUENTE SL' }] },
  ];
  const pend = M.pendientesDeAprender(filas, mem());
  assert.strictEqual(pend[0].literal, 'MUY FRECUENTE SL');
  assert.strictEqual(pend[0].filas, 3);
});
