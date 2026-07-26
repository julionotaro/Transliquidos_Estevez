// Tests del informe tri-valuado del validador.
//   node --test validador/tests/
//
// El caso central es la REGRESION DEL FALSO OK: una linea cuya ruta no tiene
// tarifa cargada (TRANSTAMBRE) jamas puede salir como VALIDADO_OK.

const test = require('node:test');
const assert = require('node:assert');

const { auditar, renderInforme, ESTADOS, setLogActivo } = require('../auditar.js');

setLogActivo(false); // silencio en los tests; en n8n el logging queda activo

// --- Datos vivos de prueba -------------------------------------------------

// Un unico tramo de indexacion cubriendo julio 2026 para la solapa OTROS.
const INDEXACION = [
  { cliente: 'OTROS', tipo: 'quincenal', pct: 0.1064, desde: '2026-07-01', hasta: '2026-07-31' },
];

// Tarifario: solo RNM tiene ruta cargada. TRANSTAMBRE NO (caso del falso OK).
const TARIFAS = [
  { cliente: 'RNM', origen: 'VILLAGARCIA', destino: 'AVEIRO', material: '', tarifa_tn: 20.0, precio_fijo: null, vigente_desde: '2026-01-01' },
];

function linea(over) {
  return Object.assign({
    fecha_viaje: '2026-07-10',
    referencia: 'REF-1',
    matricula: '1234ABC',
    origen: 'VILLAGARCIA',
    destino: 'AVEIRO',
    material: 'RESINA',
    cantidad_tn: 25,
    precio: 20.0,
    importe: 500.0,
    conceptos: [{ tipo: 'indexacion', texto: 'INDEXACION GASOLEO', base: 500.0, pct: 0.1064, importe: 53.2 }],
  }, over);
}

function factura(lineas, over) {
  return Object.assign({
    numero: '2026/999',
    fecha: '2026-07-31',
    emisor: 'TRANS. LIQUIDOS ESTEVEZ S.L.',
    cliente: 'RNM',
    lineas: lineas,
    base_imponible: 0,
    iva_pct: 0,
    iva_importe: 0,
    total: 0,
  }, over);
}

function porId(res, id) {
  return res.detalles.find(function (d) { return d.linea_id === id; });
}

// --- 1. Con tarifa, dentro de tolerancia -> VALIDADO_OK --------------------

test('linea con tarifa y dentro de tolerancia -> VALIDADO_OK', () => {
  const res = auditar(factura([linea()]), INDEXACION, TARIFAS);

  assert.strictEqual(res.detalles.length, 1);
  assert.strictEqual(res.detalles[0].estado, ESTADOS.VALIDADO_OK);
  assert.deepStrictEqual(res.resumen, { validadas_ok: 1, discrepancias: 0, sin_tarifa: 0 });
  assert.strictEqual(res.listo_para_pago, true);
});

// --- 2. Con tarifa, fuera de tolerancia -> DISCREPANCIA --------------------

test('linea con tarifa pero precio fuera de tolerancia -> DISCREPANCIA', () => {
  // Tarifario dice 20,00 EUR/tn; la factura cobra 24,00.
  const f = factura([linea({ precio: 24.0, importe: 600.0 })]);
  const res = auditar(f, INDEXACION, TARIFAS);

  assert.strictEqual(res.detalles[0].estado, ESTADOS.DISCREPANCIA);
  assert.match(res.detalles[0].detalle, /precio\/tn: tarifario 20 EUR\/tn/);
  assert.strictEqual(res.resumen.discrepancias, 1);
  assert.strictEqual(res.resumen.validadas_ok, 0);
  assert.strictEqual(res.listo_para_pago, false);
});

test('discrepancias que el validador ya detectaba siguen saliendo como DISCREPANCIA', () => {
  const f = factura([
    linea({ referencia: 'REF-A' }),
    // referencia duplicada + sin matricula + importe que no cuadra
    linea({ referencia: 'REF-A', matricula: null, cantidad_tn: 25, precio: 20.0, importe: 499.0 }),
  ]);
  const res = auditar(f, INDEXACION, TARIFAS);

  const l2 = porId(res, 'L2');
  assert.strictEqual(l2.estado, ESTADOS.DISCREPANCIA);
  assert.match(l2.detalle, /REFERENCIA DUPLICADA/);
  assert.match(l2.detalle, /sin matricula/);
  assert.match(l2.detalle, /importe: 25 x 20 = 500 pero dice 499/);
});

test('IVA mal calculado se reporta como error de factura', () => {
  const f = factura([linea()], { base_imponible: 553.2, iva_pct: 21, iva_importe: 100.0, total: 653.2 });
  const res = auditar(f, INDEXACION, TARIFAS);

  assert.ok(res.errores.some(function (e) { return /^IVA: /.test(e); }), 'esperaba un error de IVA');
  assert.strictEqual(res.listo_para_pago, false);
});

// --- 3. REGRESION DEL FALSO OK --------------------------------------------

test('REGRESION falso OK: ruta sin tarifa cargada -> SIN_TARIFA, nunca VALIDADO_OK', () => {
  // TRANSTAMBRE no tiene ninguna fila en el tarifario. Antes esta linea salia
  // como aviso y la factura entera se reportaba "APTA".
  const f = factura([linea({ origen: 'VILLAGARCIA', destino: 'SANTIAGO' })], { cliente: 'TRANSTAMBRE' });
  const res = auditar(f, INDEXACION, TARIFAS);

  const l1 = res.detalles[0];
  assert.strictEqual(l1.estado, ESTADOS.SIN_TARIFA);
  assert.notStrictEqual(l1.estado, ESTADOS.VALIDADO_OK);
  assert.match(l1.detalle, /sin tarifa cargada/);
  assert.match(l1.detalle, /NO se contrasto/);
  assert.strictEqual(res.resumen.sin_tarifa, 1);
  assert.strictEqual(res.resumen.validadas_ok, 0);
});

test('REGRESION falso OK: la factura entera sin tarifas no se declara APTA', () => {
  const f = factura([linea({ destino: 'SANTIAGO' })], { cliente: 'TRANSTAMBRE' });
  const res = auditar(f, INDEXACION, TARIFAS);
  const informe = renderInforme(res);

  assert.strictEqual(res.listo_para_pago, false);
  assert.doesNotMatch(informe, /factura APTA/);
  assert.match(informe, /NO SE VERIFICARON/);
  assert.match(informe, /LISTO PARA PAGO: NO/);
});

test('sin ninguna tarifa cargada, ninguna linea cae en VALIDADO_OK', () => {
  const f = factura([linea(), linea({ referencia: 'REF-2' })]);
  const res = auditar(f, INDEXACION, []); // tarifario vacio

  assert.strictEqual(res.resumen.validadas_ok, 0);
  assert.strictEqual(res.resumen.sin_tarifa, 2);
  res.detalles.forEach(function (d) { assert.strictEqual(d.estado, ESTADOS.SIN_TARIFA); });
});

test('una linea sin tarifa conserva sus otros hallazgos en el detalle', () => {
  const f = factura([linea({ destino: 'SANTIAGO', matricula: null })], { cliente: 'TRANSTAMBRE' });
  const res = auditar(f, INDEXACION, TARIFAS);

  assert.strictEqual(res.detalles[0].estado, ESTADOS.SIN_TARIFA);
  assert.ok(res.detalles[0].hallazgos.includes('sin matricula'), 'el hallazgo no debe perderse');
  assert.match(res.detalles[0].detalle, /sin matricula/);
});

// --- 4. Resumen de un lote mixto ------------------------------------------

test('lote mixto: los conteos del resumen coinciden con las lineas', () => {
  const f = factura([
    linea({ referencia: 'OK-1' }),                                        // VALIDADO_OK
    linea({ referencia: 'OK-2' }),                                        // VALIDADO_OK
    linea({ referencia: 'DIS-1', precio: 30.0, importe: 750.0 }),         // DISCREPANCIA
    linea({ referencia: 'ST-1', destino: 'LUGO' }),                       // SIN_TARIFA
    linea({ referencia: 'ST-2', destino: 'OVIEDO' }),                     // SIN_TARIFA
  ]);
  const res = auditar(f, INDEXACION, TARIFAS);

  assert.strictEqual(res.detalles.length, 5);
  assert.deepStrictEqual(res.resumen, { validadas_ok: 2, discrepancias: 1, sin_tarifa: 2 });

  const suma = res.resumen.validadas_ok + res.resumen.discrepancias + res.resumen.sin_tarifa;
  assert.strictEqual(suma, res.detalles.length, 'todo estado debe ser uno de los tres');

  assert.strictEqual(porId(res, 'L1').estado, ESTADOS.VALIDADO_OK);
  assert.strictEqual(porId(res, 'L3').estado, ESTADOS.DISCREPANCIA);
  assert.strictEqual(porId(res, 'L4').estado, ESTADOS.SIN_TARIFA);

  const informe = renderInforme(res);
  assert.match(informe, /VALIDADO_OK  : 2/);
  assert.match(informe, /DISCREPANCIA : 1/);
  assert.match(informe, /SIN_TARIFA   : 2/);
});

test('el contrato de salida trae resumen y detalles con los tres campos', () => {
  const res = auditar(factura([linea()]), INDEXACION, TARIFAS);

  assert.deepStrictEqual(Object.keys(res.resumen).sort(), ['discrepancias', 'sin_tarifa', 'validadas_ok']);
  res.detalles.forEach(function (d) {
    assert.strictEqual(typeof d.linea_id, 'string');
    assert.strictEqual(typeof d.detalle, 'string');
    assert.ok([ESTADOS.VALIDADO_OK, ESTADOS.DISCREPANCIA, ESTADOS.SIN_TARIFA].includes(d.estado));
  });
});

// --- 5. No auto-aprobable --------------------------------------------------

test('una linea SIN_TARIFA bloquea listo_para_pago aunque no haya ningun error', () => {
  const f = factura([
    linea({ referencia: 'OK-1' }),
    linea({ referencia: 'ST-1', destino: 'LUGO' }),
  ]);
  const res = auditar(f, INDEXACION, TARIFAS);

  assert.strictEqual(res.errores.length, 0, 'este lote no debe tener errores');
  assert.strictEqual(res.resumen.sin_tarifa, 1);
  assert.strictEqual(res.listo_para_pago, false, 'SIN_TARIFA es bloqueante para pago');

  const informe = renderInforme(res);
  assert.match(informe, /NO apta para pago automatico/);
  assert.match(informe, /LISTO PARA PAGO: NO/);
});

test('todo tarifado y correcto -> validadas_ok = total, sin_tarifa = 0, apta', () => {
  const f = factura([linea({ referencia: 'A' }), linea({ referencia: 'B' }), linea({ referencia: 'C' })]);
  const res = auditar(f, INDEXACION, TARIFAS);

  assert.strictEqual(res.resumen.validadas_ok, 3);
  assert.strictEqual(res.resumen.sin_tarifa, 0);
  assert.strictEqual(res.resumen.discrepancias, 0);
  assert.strictEqual(res.listo_para_pago, true);
  assert.match(renderInforme(res), /LISTO PARA PAGO: SI/);
});

// --- Salud del informe -----------------------------------------------------

test('el informe diferencia visualmente los tres estados', () => {
  const f = factura([
    linea({ referencia: 'OK-1' }),
    linea({ referencia: 'DIS-1', precio: 30.0, importe: 750.0 }),
    linea({ referencia: 'ST-1', destino: 'LUGO' }),
  ]);
  const informe = renderInforme(auditar(f, INDEXACION, TARIFAS));

  assert.match(informe, /OK\s+VALIDADO_OK\s+L1/);
  assert.match(informe, /X\s+DISCREPANCIA\s+L2/);
  assert.match(informe, /\?\s+SIN_TARIFA\s+L3/);
});

test('factura sin lineas no revienta y no se declara apta por vacio', () => {
  const res = auditar(factura([]), INDEXACION, TARIFAS);

  assert.deepStrictEqual(res.resumen, { validadas_ok: 0, discrepancias: 0, sin_tarifa: 0 });
  assert.strictEqual(res.detalles.length, 0);
});
