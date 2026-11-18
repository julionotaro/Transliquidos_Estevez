// Tests — CRUCE DE CABECERA (chofer + matricula contra el padron flota+externos).
//
// Regresion de dos errores reales (Julio 18/11): una matricula mal leida que trababa
// la carga (Rodrigo 4342 por 7347LBB) y un nombre de chofer mal leido (Juan L. "Giz"
// por "Gonzalez"). validar_raw.js cruza la cabecera contra el padron y:
//   - ERROR (bloquea): matricula fuera del padron cuando el chofer es conocido con otra
//     tractora; o chofer que no coincide con el habitual de la tractora y NO es conocido.
//   - AVISO (no bloquea): chofer conocido en una tractora distinta de la suya (suplente/
//     pool); o cabecera no reconocida (posible externo nuevo).
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { validarRaw } = require('../../herramientas/armar_orden/validar_raw.js');

// Padron de prueba (subset real): TLE + externo THEC.
const PADRON = {
  '8168JSD': { remolque: null, chofer: 'JUAN L. GONZALEZ', tipo: 'propio' },      // externo THEC
  '7347LBB': { remolque: 'R9990BDD', chofer: 'RODRIGO PEREZ BAHAMONDE', tipo: 'propio' },
  '2541HPJ': { remolque: 'R1943BBL', chofer: 'PABLO CARLES SANTOS', tipo: 'propio' },
  '9039KDR': { remolque: 'R7936BCV', chofer: 'MANUEL FERREIRA GOLDAR', tipo: 'propio' },
  '3729JLH': { remolque: 'R7749BDB', chofer: 'MARCOS EIRIN FERNANDEZ', tipo: 'propio' },
};
const OPC = { registro: false, hoy: new Date(Date.UTC(2026, 10, 18)) };

function raw(chofer, cabeza, matricula) {
  return {
    escaneo: 't.pdf', empresa: 'TLE', proveedor: '5', fecha_inicio: '2026-11-06', chofer, cabeza,
    viajes: [{ matricula, remolque: 'PO01372R', albaranes: [{
      cliente_lit: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.', origen_lit: 'CALDAS DE REIS',
      destino_lit: 'OREMBER', carga_lit: 'FINCAT', referencia: '2038084',
      salida: '06/11/2026', llegada: '06/11/2026', peso_kg: 25800, km_pendiente: true }] }],
  };
}
const cabeceraErrores = (r) => validarRaw(r, { flota: PADRON }, OPC).errores.filter(
  (e) => /chofer leido|no esta en el padron, pero el chofer/.test(e));
const cabeceraAvisos = (r) => validarRaw(r, { flota: PADRON }, OPC).avisos.filter(
  (a) => /es habitual de|cabecera NO reconocida/.test(a));

test('chofer mal leido en tractora conocida -> ERROR (Giz por Gonzalez)', () => {
  const e = cabeceraErrores(raw('JUAN L. GIZ', '8168', '8168JSD'));
  assert.equal(e.length, 1);
  assert.match(e[0], /JUAN L\. GONZALEZ/);
});

test('chofer correcto en su tractora -> sin error de cabecera', () => {
  assert.equal(cabeceraErrores(raw('JUAN L. GONZALEZ', '8168', '8168JSD')).length, 0);
  assert.equal(cabeceraAvisos(raw('JUAN L. GONZALEZ', '8168', '8168JSD')).length, 0);
});

test('tolera mala lectura de una letra del apellido (Gonzales ~ Gonzalez)', () => {
  assert.equal(cabeceraErrores(raw('JUAN L. GONZALES', '8168', '8168JSD')).length, 0);
});

test('matricula fuera del padron con chofer conocido -> ERROR (Rodrigo 4342)', () => {
  const e = cabeceraErrores(raw('RODRIGO PEREZ BAHAMONDE', '4342', '4342LBB'));
  assert.equal(e.length, 1);
  assert.match(e[0], /7347LBB/);           // sugiere la tractora real
  assert.doesNotMatch(e[0], /2541HPJ|3729JLH/); // no asocia otros choferes
});

test('chofer conocido en tractora de otro (suplente/pool) -> AVISO, no ERROR', () => {
  // Manuel Ferreira (conocido en 9039KDR) en 2541HPJ (habitual de Carles).
  assert.equal(cabeceraErrores(raw('MANUEL FERREIRA GOLDAR', '2541', '2541HPJ')).length, 0);
  assert.equal(cabeceraAvisos(raw('MANUEL FERREIRA GOLDAR', '2541', '2541HPJ')).length, 1);
});

test('mismo apellido NO es la misma persona (Manuel Eirin != Marcos Eirin) -> no asocia su tractora', () => {
  // Chofer externo nuevo "MANUEL EIRIN" en 9400LLC: no debe mapearse a 3729JLH (Marcos).
  const r = validarRaw(raw('MANUEL EIRIN', '9400', '9400LLC'), { flota: PADRON }, OPC);
  assert.equal(r.errores.filter((e) => /no esta en el padron, pero el chofer/.test(e)).length, 0);
  assert.equal(r.avisos.filter((a) => /cabecera NO reconocida/.test(a)).length, 1); // externo nuevo
});
