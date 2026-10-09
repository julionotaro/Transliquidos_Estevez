// Tests — modalidad de indexacion (por LINEA o por PERIODO).
//
// Los casos vienen del export real de Gesruta (8.755 lineas) y de las facturas
// confirmadas en docs/reglas-facturacion.md. Cada test fija una regla del
// documento: si alguien afloja una, el test dice cual y por que existia.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  modalidadPorHistorico, modalidadDeViaje, acumularPorPeriodo, MODALIDAD_CONFIRMADA
} = require('./modalidad-indexacion.js');
const { grupoIndexacion } = require('./indexacion.js');

// Helpers para armar lineas del export con la forma real.
function porte(cliente, viaje, albaran, importe) {
  return { cliente, viaje, albaran, codcon: 'P', cantid: 1, precio: importe, import: importe };
}
function idxLinea(cliente, viaje, albaran, base, pct) {
  // Forma normal de Gesruta: cantidad = base en EUR, precio = pct decimal.
  return { cliente, viaje, albaran, codcon: 'G', cantid: base, precio: pct, import: base * pct };
}
// Genera n albaranes de un cliente, de los cuales `conLinea` llevan su propia
// linea de indexacion. Es la forma en que se mide la modalidad sobre el dato
// real: por COBERTURA, no por comparar la base contra el porte.
function lote(cliente, n, conLinea) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(porte(cliente, String(i), '01', 1000));
    if (i < conLinea) { out.push(idxLinea(cliente, String(i), '01', 1000, 0.15)); }
  }
  return out;
}

// ============================================================================
// MODALIDAD DEDUCIDA DEL HISTORICO
// ============================================================================
test('POR LINEA: la base de la indexacion es el importe del propio porte', () => {
  // Caso real (albaran 50458): G2Q con cantidad 1498,56 = el importe del porte
  // de esa misma linea. Eso es indexacion por viaje.
  const h = modalidadPorHistorico([
    porte('TRANSTAMBRE', '1', '01', 1498.56),
    idxLinea('TRANSTAMBRE', '1', '01', 1498.56, 0.1584),
  ]);
  assert.strictEqual(h['TRANSTAMBRE'].modalidad, 'linea');
  assert.strictEqual(h['TRANSTAMBRE'].conLinea, 1);
});

test('POR PERIODO: casi ningun albaran lleva linea propia de indexacion', () => {
  // Cifras reales del CSV, ruta CALDAS -> OREMBER (COLA): 586 albaranes y solo
  // 12 con linea propia (2,0%). La indexacion de esos viajes no esta en el
  // albaran: se acumula y se factura aparte.
  const h = modalidadPorHistorico(lote('FORESA-OREMBER', 586, 12));
  assert.strictEqual(h['FORESA-OREMBER'].modalidad, 'agregada');
  assert.strictEqual(h['FORESA-OREMBER'].cobertura, 0.02);
});

test('POR LINEA: la mayoria de los albaranes lleva linea propia', () => {
  // Cifras reales, CALDAS -> TERUEL (COLA): 42 albaranes, 35 con linea (83,3%).
  const h = modalidadPorHistorico(lote('FORESA-TERUEL', 42, 35));
  assert.strictEqual(h['FORESA-TERUEL'].modalidad, 'linea');
});

test('el umbral cae en un HUECO del dato, no es una eleccion nuestra', () => {
  // Coberturas observadas por ruta: 2,0 / 3,0 / 6,9 % (agregadas) y luego
  // 46,2 / 56,2 / 60,0 / 69,6 / 78,0 / 83,3 % (por viaje). Entre 7 y 46 % no
  // hay NINGUNA ruta. Los umbrales 20/40 caen dentro de ese hueco vacio.
  assert.strictEqual(modalidadPorHistorico(lote('A', 116, 8))['A'].modalidad, 'agregada');  // 6,9%
  assert.strictEqual(modalidadPorHistorico(lote('B', 26, 12))['B'].modalidad, 'linea');     // 46,2%
});

test('INCLUIDA: todas las lineas de indexacion a cero (Baltransa)', () => {
  const h = modalidadPorHistorico([
    porte('BALTRANSA', '1', '01', 2050),
    { cliente: 'BALTRANSA', viaje: '1', albaran: '01', codcon: 'G', cantid: 1, precio: 0, import: 0 },
  ]);
  assert.strictEqual(h['BALTRANSA'].modalidad, 'incluida');
});

test('SIN INDEXACION: el cliente tiene portes y NINGUNA linea de indexacion', () => {
  // Caso real: TRANSPORTES SANTOS, 11 albaranes y cero lineas de indexacion.
  // Antes el default `linea` le inventaba un cobro que su factura no lleva.
  const h = modalidadPorHistorico(lote('TRANSPORTES SANTOS', 11, 0));
  assert.strictEqual(h['TRANSPORTES SANTOS'].modalidad, 'sin_indexacion');
  assert.strictEqual(h['TRANSPORTES SANTOS'].sinIndexacion, 11);
});

test('EVIDENCIA MINIMA: "sin indexacion" con 2 albaranes NO es evidencia', () => {
  // TANK SOLUTIONS tiene 2 albaranes en la muestra y ninguna indexacion. Eso no
  // prueba que no se indexe: puede ser que en esos dos no hubo. Afirmarlo deja
  // de facturar un cobro real, que es el error simetrico al de inventarlo.
  const h = modalidadPorHistorico(lote('TANK SOLUTIONS', 2, 0));
  assert.strictEqual(h['TANK SOLUTIONS'].modalidad, 'mixta');
  assert.strictEqual(h['TANK SOLUTIONS'].evidenciaFloja, true);
  assert.match(h['TANK SOLUTIONS'].evidencia, /MUESTRA INSUFICIENTE/);
});

test('MIXTA: un cliente con las dos formas no se resuelve por cliente', () => {
  // Foresa real: parte de sus servicios por linea y parte agregados. Elegir una
  // de las dos "por mayoria" seria elegir mal la mitad de las veces.
  // Cifras reales de FORESA en conjunto: 1.266 albaranes, 239 con linea (18,9%).
  // Ese 18,9% es el promedio de mezclar rutas al 2% con rutas al 83%.
  const h = modalidadPorHistorico(lote('FORESA', 100, 30));
  assert.strictEqual(h['FORESA'].modalidad, 'mixta');

  const r = modalidadDeViaje({ codigoCliente: 'FORESA', cliente: 'FORESA' }, h);
  assert.strictEqual(r.modalidad, null, 'no elige una de las dos');
  assert.strictEqual(r.revisar, true);
  assert.match(r.motivo, /DOS formas/);
});

// ============================================================================
// LA CASCADA: historico -> regla confirmada -> nada (nunca un default)
// ============================================================================
test('el historico manda sobre la regla confirmada', () => {
  const h = modalidadPorHistorico(lote('TRANSTAMBRE', 12, 0));
  const r = modalidadDeViaje({ codigoCliente: 'TRANSTAMBRE', cliente: 'TRANSTAMBRE' }, h);
  assert.strictEqual(r.modalidad, 'sin_indexacion');
  assert.strictEqual(r.fuente, 'historico');
});

test('cliente sin historico: cae en la regla confirmada por facturas', () => {
  const r = modalidadDeViaje({ cliente: 'BALTRANSA, S.A.' }, {});
  assert.strictEqual(r.modalidad, 'incluida');
  assert.strictEqual(r.fuente, 'regla_confirmada');
  assert.strictEqual(MODALIDAD_CONFIRMADA['TANK SOLUTIONS'], 'sin_indexacion');
});

test('SALVAGUARDA: sin evidencia NUNCA se asume "linea"', () => {
  // El defecto original: todo cliente conocido caia en `linea` en silencio.
  // Inventar un cobro es peor que dejarlo vacio.
  const r = modalidadDeViaje({ cliente: 'CLIENTE NUEVO SL' }, {});
  assert.strictEqual(r.modalidad, null);
  assert.strictEqual(r.revisar, true);
  assert.match(r.motivo, /NO se asume por linea/);

  const sinCliente = modalidadDeViaje({}, {});
  assert.strictEqual(sinCliente.modalidad, null);
  assert.strictEqual(sinCliente.revisar, true);
});

test('la modalidad agregada siempre marca REVISAR: no se cierra por viaje', () => {
  const h = modalidadPorHistorico(lote('QUIMIDROGA', 50, 2));
  const r = modalidadDeViaje({ codigoCliente: 'QUIMIDROGA', cliente: 'QUIMIDROGA' }, h);
  assert.strictEqual(r.modalidad, 'agregada');
  assert.strictEqual(r.revisar, true);
});

// ============================================================================
// ACUMULACION POR PERIODO — se agrupa por TRAMO, no por calendario
// ============================================================================
const TRAMOS = [
  { cliente: 'FORESA-BRESFOR', pct: '0.1717', desde: '2026-06-01', hasta: '2026-06-15' },
  { cliente: 'FORESA-BRESFOR', pct: '0.1584', desde: '2026-06-16', hasta: '2026-06-30' },
  { cliente: 'OTROS', pct: '0.15', desde: '2026-06-01', hasta: '2026-06-30' },
];

test('un mes con DOS tramos produce DOS lineas agregadas', () => {
  // Es el caso real del metanol mensual de Foresa: "lineas agregadas por tramo
  // de pct dentro del mes". Agrupar por mes daria una sola linea, con el pct
  // equivocado para la mitad de los viajes.
  const filas = acumularPorPeriodo([
    { cliente: 'FORESA', codigoCliente: 'FORESA', fecha: '2026-06-05', importe_porte: 1000 },
    { cliente: 'FORESA', codigoCliente: 'FORESA', fecha: '2026-06-10', importe_porte: 500 },
    { cliente: 'FORESA', codigoCliente: 'FORESA', fecha: '2026-06-20', importe_porte: 800 },
  ], TRAMOS, grupoIndexacion);

  assert.strictEqual(filas.length, 2, 'una linea por tramo, no una por mes');
  assert.strictEqual(filas[0].base, 1500);
  assert.strictEqual(filas[0].pct, 0.1717);
  assert.strictEqual(filas[0].importe, 257.55);   // 1500 x 0,1717
  assert.strictEqual(filas[0].viajes, 2);
  assert.strictEqual(filas[1].base, 800);
  assert.strictEqual(filas[1].importe, 126.72);   // 800 x 0,1584
});

test('un mes con UN solo tramo produce UNA linea (mensual)', () => {
  const filas = acumularPorPeriodo([
    { cliente: 'RNM', codigoCliente: 'RNM', fecha: '2026-06-05', importe_porte: 1000 },
    { cliente: 'RNM', codigoCliente: 'RNM', fecha: '2026-06-25', importe_porte: 1000 },
  ], TRAMOS, grupoIndexacion);
  assert.strictEqual(filas.length, 1);
  assert.strictEqual(filas[0].base, 2000);
  assert.strictEqual(filas[0].importe, 300);
});

test('la quincena NO se asume: el corte lo dan las fechas del tramo', () => {
  // Dos viajes en la misma quincena natural pero en tramos distintos, si el
  // gasoleo se actualizo a mitad. El corte es el del tramo.
  const tramosRaros = [
    { cliente: 'OTROS', pct: '0.20', desde: '2026-06-01', hasta: '2026-06-09' },
    { cliente: 'OTROS', pct: '0.10', desde: '2026-06-10', hasta: '2026-06-30' },
  ];
  const filas = acumularPorPeriodo([
    { cliente: 'RNM', codigoCliente: 'RNM', fecha: '2026-06-08', importe_porte: 100 },
    { cliente: 'RNM', codigoCliente: 'RNM', fecha: '2026-06-12', importe_porte: 100 },
  ], tramosRaros, grupoIndexacion);
  assert.strictEqual(filas.length, 2);
  assert.strictEqual(filas[0].importe, 20);
  assert.strictEqual(filas[1].importe, 10);
});

test('viaje sin tramo vigente: queda listado con motivo, no se descarta', () => {
  const filas = acumularPorPeriodo([
    { cliente: 'RNM', codigoCliente: 'RNM', fecha: '2027-01-01', importe_porte: 500 },
  ], TRAMOS, grupoIndexacion);
  assert.strictEqual(filas.length, 1);
  assert.strictEqual(filas[0].importe, null);
  assert.strictEqual(filas[0].revisar, true);
  assert.match(filas[0].motivo, /no hay tramo/);
});

test('clientes distintos no se mezclan en el mismo acumulado', () => {
  const filas = acumularPorPeriodo([
    { cliente: 'FORESA', codigoCliente: 'FORESA', fecha: '2026-06-05', importe_porte: 1000 },
    { cliente: 'RNM', codigoCliente: 'RNM', fecha: '2026-06-05', importe_porte: 1000 },
  ], TRAMOS, grupoIndexacion);
  assert.strictEqual(filas.length, 2);
  assert.notStrictEqual(filas[0].codigoCliente, filas[1].codigoCliente);
});

test('la base excluye lo que no es porte (D-08): solo entra importe_porte', () => {
  // Los repartos (90 eur de traslado) y la paralizacion NO suman a la base.
  // El contrato del modulo es que solo lee importe_porte; quien arma la fila es
  // responsable de no meter ahi otros conceptos. Un importe nulo no rompe.
  const filas = acumularPorPeriodo([
    { cliente: 'RNM', codigoCliente: 'RNM', fecha: '2026-06-05', importe_porte: 1000 },
    { cliente: 'RNM', codigoCliente: 'RNM', fecha: '2026-06-06', importe_porte: null },
    { cliente: 'RNM', codigoCliente: 'RNM', fecha: '2026-06-07', importe_porte: 0 },
  ], TRAMOS, grupoIndexacion);
  assert.strictEqual(filas.length, 1);
  assert.strictEqual(filas[0].base, 1000);
  assert.strictEqual(filas[0].viajes, 1);
});

test('entradas vacias o basura no rompen', () => {
  assert.deepStrictEqual(acumularPorPeriodo(null, null, grupoIndexacion), []);
  assert.deepStrictEqual(acumularPorPeriodo([], TRAMOS, grupoIndexacion), []);
  assert.deepStrictEqual(modalidadPorHistorico(null), {});
  assert.deepStrictEqual(modalidadPorHistorico([{}]), {});
});

// ============================================================================
// CABLEADO: la evidencia gana sobre las reglas de ruta (cruce.js)
// ============================================================================
const { regimenIndexacion, CLIENTES_CONOCIDOS } = require('./cruce.js');

test('sin modalidad inyectada: cruce.js mantiene sus reglas de ruta (compat)', () => {
  assert.strictEqual(regimenIndexacion('BALTRANSA', 'A', 'B', CLIENTES_CONOCIDOS).regimen, 'incluida');
  assert.strictEqual(
    regimenIndexacion('FORESA', 'VILLAGARCIA', 'CALDAS DE REIS', CLIENTES_CONOCIDOS).regimen,
    'agregada_mensual'
  );
});

test('con historico: para un cliente NO-Foresa, la modalidad deducida manda', () => {
  // Foresa es la excepcion (se resuelve por ruta, ver test aparte). Para el
  // resto, el historico dice como se le facturo de verdad y eso manda sobre
  // cualquier default de ruta.
  const mod = { modalidad: 'sin_indexacion', fuente: 'historico', revisar: false, motivo: '' };
  const r = regimenIndexacion('QUIMIDROGA', 'A', 'B', CLIENTES_CONOCIDOS, mod);
  assert.strictEqual(r.regimen, 'sin_indexacion');
});

test('FORESA es la excepcion: la RUTA manda aunque el historico diga otra cosa', () => {
  // Villagarcia->Caldas es el metanol agregado mensual. El historico de Foresa
  // en conjunto da 'mixta' (mezcla rutas al 2% con rutas al 83%), asi que una
  // modalidad por cliente seria una media sin sentido: la del SERVICIO manda.
  const mod = { modalidad: null, fuente: 'historico', revisar: true, motivo: 'mixta' };
  const metanol = regimenIndexacion('FORESA', 'VILLAGARCIA', 'CALDAS DE REIS', CLIENTES_CONOCIDOS, mod);
  assert.strictEqual(metanol.regimen, 'agregada_mensual');
  const orember = regimenIndexacion('FORESA', 'CALDAS DE REIS', 'OREMBER', CLIENTES_CONOCIDOS, mod);
  assert.strictEqual(orember.regimen, 'agregada_quincenal');
  const otros = regimenIndexacion('FORESA', 'CALDAS DE REIS', 'TERUEL', CLIENTES_CONOCIDOS, mod);
  assert.strictEqual(otros.regimen, 'linea');
});

test('SALVAGUARDA: "sin_indexacion" llega hasta el regimen, no se pierde', () => {
  // Este es el defecto 2 corregido de punta a punta: antes el default `linea`
  // se comia esta respuesta y le inventaba un cobro al cliente.
  const mod = { modalidad: 'sin_indexacion', fuente: 'historico', revisar: false, motivo: '' };
  const r = regimenIndexacion('TANK SOLUTIONS', 'A', 'B', ['TANK SOLUTIONS'], mod);
  assert.strictEqual(r.regimen, 'sin_indexacion');

  const { indexacionDeFila } = require('./indexacion.js');
  const fila = indexacionDeFila({ cliente: 'TANK SOLUTIONS', fecha: '2026-06-05', regimen_indexacion: 'sin_indexacion' }, 900, TRAMOS);
  assert.strictEqual(fila.importe, 0, 'cero es la respuesta correcta, no un hueco');
  assert.strictEqual(fila.motivo, null, 'no debe ir a REVISAR por esto');
});

test('modalidad ambigua en cliente NO-Foresa: no cae al default, va a REVISAR', () => {
  // Para un cliente que no es Foresa, si el historico no pudo decidir, el viaje
  // va a REVISAR en vez de caer a 'linea' por defecto.
  const mod = { modalidad: null, fuente: 'historico', revisar: true, motivo: 'factura de las DOS formas' };
  const r = regimenIndexacion('HELM', 'A', 'B', CLIENTES_CONOCIDOS, mod);
  assert.strictEqual(r.regimen, null);
  assert.match(r.motivo, /DOS formas/);
});

test('el viaje agregado expone la base que aporta al periodo', () => {
  // Antes devolvia importe null y nada mas: el periodo quedaba ciego hasta la
  // factura. Ahora se ve cuanto aporta y con que pct.
  const { indexacionDeFila } = require('./indexacion.js');
  const r = indexacionDeFila(
    { cliente: 'FORESA', fecha: '2026-06-05', regimen_indexacion: 'agregada_mensual' }, 1000, TRAMOS
  );
  assert.strictEqual(r.importe, null, 'sigue sin cerrarse por viaje (D-03)');
  assert.strictEqual(r.base_periodo, 1000);
  assert.strictEqual(r.pct, 0.1717);
  assert.strictEqual(r.aporta_al_periodo, true);
});

test('la base expuesta por viaje es la que acumula el periodo (cierra el circuito)', () => {
  const { indexacionDeFila } = require('./indexacion.js');
  const viajes = [
    { cliente: 'FORESA', codigoCliente: 'FORESA', fecha: '2026-06-05', regimen_indexacion: 'agregada_mensual', imp: 1000 },
    { cliente: 'FORESA', codigoCliente: 'FORESA', fecha: '2026-06-10', regimen_indexacion: 'agregada_mensual', imp: 500 },
  ];
  const conBase = viajes.map(function (v) {
    return Object.assign({}, v, { importe_porte: indexacionDeFila(v, v.imp, TRAMOS).base_periodo });
  });
  const agregadas = acumularPorPeriodo(conBase, TRAMOS, grupoIndexacion);
  assert.strictEqual(agregadas.length, 1);
  assert.strictEqual(agregadas[0].base, 1500);
  assert.strictEqual(agregadas[0].importe, 257.55);
});
