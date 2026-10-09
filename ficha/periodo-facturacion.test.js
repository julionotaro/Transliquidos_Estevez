// Tests — periodo de facturacion, grupo del suplemento y servicios de Foresa.
// Los numeros salen de la tabla de Julio (2026-08-26) y del export real
// PRUEBA_2608_LINEA_FACTURACION.CSV.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  periodoFacturacion, grupoSuplemento, servicioForesa, pctDeOrden
} = require('./periodo-facturacion.js');
const {
  SUPLEMENTO_GASOLEO, verificarTramos, tramosDe, todosLosTramos, GRUPOS
} = require('../catalogo/suplemento-gasoleo.js');
const { buscarPct } = require('./indexacion.js');

// ============================================================================
// PERIODO DE FACTURACION (tabla de Julio)
// ============================================================================
test('la mayoria de los clientes factura QUINCENAL', () => {
  ['BRESFOR', 'QUIMIDROGA, S.A.', 'HELM IBERICA', 'RNM GROUP', 'BALTRANSA',
   'TRANSPORTES SANTOS', 'TRANSTAMBRE SL', 'ROTANK IBERICA', 'COMATRA'].forEach(function (c) {
    assert.strictEqual(periodoFacturacion(c).periodo, 'quincenal', c);
  });
});

test('FORESA y CLAVO FOOD admiten las dos formas -> REVISAR, no se asume', () => {
  const f = periodoFacturacion('FORESA IND.QUIMICAS DEL NOROESTE');
  assert.strictEqual(f.periodo, 'mensual_opcional');
  assert.strictEqual(f.revisar, true);
  assert.strictEqual(periodoFacturacion('CLAVO FOOD FACTORY').periodo, 'mensual_opcional');
});

test('cliente fuera de la tabla -> null + REVISAR, nunca un periodo inventado', () => {
  const r = periodoFacturacion('EMPRESA NUEVA SL');
  assert.strictEqual(r.periodo, null);
  assert.strictEqual(r.revisar, true);
  assert.strictEqual(periodoFacturacion(null).periodo, null);
});

// ============================================================================
// GRUPO DEL SUPLEMENTO — verificado contra los % que aparecen en el CSV
// ============================================================================
test('cada cliente cae en la solapa cuyos % realmente se le aplicaron', () => {
  assert.strictEqual(grupoSuplemento('FORESA IND.QUIMICAS').grupo, 'FORESA-BRESFOR');
  assert.strictEqual(grupoSuplemento('BRESFOR IND. DO FORMOL').grupo, 'FORESA-BRESFOR');
  assert.strictEqual(grupoSuplemento('QUIMIDROGA, S.A.').grupo, 'QUIMIDROGA');
  assert.strictEqual(grupoSuplemento('QUIMIDROGA PORTUGAL, LDA').grupo, 'QUIMIDROGA');
  assert.strictEqual(grupoSuplemento('HELM IBERICA, S.A.').grupo, 'HELM');
});

test('el resto va a OTROS, que es la regla explicita de Julio', () => {
  ['RNM TRANSPORTES QUIMICOS', 'QUIMICAS DEL JARAMA', 'FORESTAL DEL ATLANTICO',
   'CLAVO FOOD FACTORY'].forEach(function (c) {
    const g = grupoSuplemento(c);
    assert.strictEqual(g.grupo, 'OTROS', c);
    assert.strictEqual(g.porDefecto, true);
  });
});

test('los % de OTROS son los que el CSV muestra en RNM y JARAMA', () => {
  // RNM aplico 0,1848 / 0,15 / 0,08 / 0,0766 — todos de la solapa OTROS.
  const otros = tramosDe('OTROS').map(function (t) { return parseFloat(t.pct); });
  [0.1848, 0.15, 0.08, 0.0766].forEach(function (p) {
    assert.ok(otros.indexOf(p) >= 0, p + ' deberia estar en OTROS');
  });
});

// ============================================================================
// FORESA: que servicios van agregados (regla de Julio + cobertura real)
// ============================================================================
test('Metanol Villagarcia->Caldas va AGREGADO mensual', () => {
  const r = servicioForesa('VILLAGARCIA', 'CALDAS DE REIS');
  assert.strictEqual(r.modalidad, 'agregada');
  assert.strictEqual(r.periodo, 'mensual');
});

test('Destino Orember va AGREGADO quincenal, venga de donde venga', () => {
  assert.strictEqual(servicioForesa('CALDAS DE REIS', 'OREMBER').modalidad, 'agregada');
  assert.strictEqual(servicioForesa('CALDAS DE REIS', 'OREMBER').periodo, 'quincenal');
});

test('el resto de Foresa se indexa POR VIAJE (Julio: "Foresa otros, Villagarcia otros y Retornos")', () => {
  [['CALDAS DE REIS', 'TERUEL'], ['CALDAS DE REIS', 'BARCELONA'],
   ['VILLAGARCIA', 'VALLADOLID'], ['CALDAS DE REIS', 'TERMOLAN']].forEach(function (r) {
    assert.strictEqual(servicioForesa(r[0], r[1]).modalidad, 'linea', r.join('->'));
  });
});

test('un RETORNO con destino Caldas NO es el metanol: lo distingue el ORIGEN', () => {
  // El metanol sale de Villagarcia (agregado mensual). Un retorno vuelve desde
  // donde se hizo la entrega y se indexa por viaje, aunque tambien llegue a Caldas.
  assert.strictEqual(servicioForesa('HUELVA', 'CALDAS DE REIS').modalidad, 'linea');
  assert.strictEqual(servicioForesa('VILLAGARCIA', 'CALDAS DE REIS').modalidad, 'agregada');
});

// ============================================================================
// EL % DE LA ORDEN MANDA sobre la tabla
// ============================================================================
test('si la orden trae el %, ese manda (Julio: "en la OC figura el porcentaje")', () => {
  // Real: TRANSTAMBRE aplico 0,0532 y 0,0877; A.G.E. GODOY 0,0748. Ninguno esta
  // en ninguna solapa: son pactados por operacion.
  const r = pctDeOrden(0.0532);
  assert.strictEqual(r.pct, 0.0532);
  assert.strictEqual(r.fuente, 'orden');
});

test('la orden escrita "en cien" (5,32) se entiende igual', () => {
  assert.strictEqual(pctDeOrden(5.32).pct, 0.0532);
});

test('un % absurdo de la orden se descarta, no se aplica', () => {
  assert.strictEqual(pctDeOrden(80).pct, null);
  assert.strictEqual(pctDeOrden(-1).pct, null);
  assert.strictEqual(pctDeOrden(null).pct, null);
});

// ============================================================================
// EL SUPLEMENTO Y SUS DEFECTOS
// ============================================================================
test('las seis solapas estan cargadas', () => {
  assert.deepStrictEqual(GRUPOS, ['FORESA-BRESFOR', 'HELM', 'QUIMIDROGA', 'OTROS', 'AGENCIA', 'AUTONOMOS']);
  assert.strictEqual(todosLosTramos().length, 79);
  // AGENCIA y AUTONOMOS figuraban como "pendientes": ya tienen valores.
  assert.ok(tramosDe('AGENCIA').length > 0);
  assert.ok(tramosDe('AUTONOMOS').length > 0);
});

test('LOS TRAMOS SON SEMANALES: una quincena puede llevar DOS % distintos', () => {
  // Es la advertencia literal de Julio, y esta en el archivo:
  //   HELM 2026-06-01 -> 06-07 = 0,1256   (1a quincena de junio)
  //   HELM 2026-06-07 -> 06-15 = 0,1141   (misma quincena, otro valor)
  const helm = SUPLEMENTO_GASOLEO['HELM'];
  const a = helm.find(function (t) { return t[0] === '2026-06-01'; });
  const b = helm.find(function (t) { return t[0] === '2026-06-07'; });
  assert.strictEqual(a[2], 0.1256);
  assert.strictEqual(b[2], 0.1141);
  assert.notStrictEqual(a[2], b[2], 'dos valores dentro de la misma quincena');
});

test('los defectos del archivo se DENUNCIAN, no se corrigen en silencio', () => {
  const p = verificarTramos();
  const tipos = {};
  p.forEach(function (x) { tipos[x.tipo] = (tipos[x.tipo] || 0) + 1; });
  // 1) la fecha corrupta de FORESA-BRESFOR
  assert.strictEqual(tipos['fecha_corrupta'], 1);
  assert.ok(p.some(function (x) { return x.tipo === 'fecha_corrupta' && /1900-01-16/.test(x.detalle); }));
  // 2) el hueco del 16-17 de mayo, en LAS SEIS solapas
  assert.strictEqual(tipos['hueco'], 6);
  assert.ok(p.every(function (x) { return x.tipo !== 'hueco' || /2026-05-15 y 2026-05-18/.test(x.detalle); }));
  // 3) abril sin valor en cuatro solapas
  assert.strictEqual(tipos['sin_pct'], 8);
});

test('SOLAPE: una fecha en dos tramos con % distinto NO se resuelve sola', () => {
  // HELM el 2026-06-07 cae en el tramo al 0,1256 y en el que empieza ese mismo
  // dia al 0,1141. Elegir uno es elegir cuanto se factura.
  const r = buscarPct('HELM', '2026-06-07', tramosDe('HELM'));
  assert.strictEqual(r.ambiguo, true);
  assert.strictEqual(r.pct, null);
  assert.strictEqual(r.candidatas.length, 2);
  assert.match(r.motivo, /porcentajes distintos/);
});

test('SOLAPE con el MISMO %: no hay ambiguedad, se resuelve', () => {
  // QUIMIDROGA el 2026-06-07 cae en dos tramos, los dos al 0,1517.
  const r = buscarPct('QUIMIDROGA', '2026-06-07', tramosDe('QUIMIDROGA'));
  assert.strictEqual(r.ambiguo, false);
  assert.strictEqual(r.pct, 0.1517);
});

test('los dias del hueco de mayo quedan SIN tramo -> REVISAR', () => {
  assert.strictEqual(buscarPct('OTROS', '2026-05-16', tramosDe('OTROS')), null);
  assert.strictEqual(buscarPct('OTROS', '2026-05-17', tramosDe('OTROS')), null);
  assert.ok(buscarPct('OTROS', '2026-05-18', tramosDe('OTROS')).pct === 0.1848);
});

test('LA FECHA CORRUPTA NO DEJA UN HUECO: deja un tramo que se traga 5 meses', () => {
  // Es peor de lo que parecia. El tramo va de '1900-01-16' a '2026-06-21', asi
  // que cubre TODAS las fechas anteriores al 21 de junio y se superpone con los
  // ocho tramos correctos de ese rango. Medido: de los 153 dias de abril a
  // agosto, 55 quedan AMBIGUOS — todo abril, mayo y la primera mitad de junio.
  // Un viaje del 20 de abril cae a la vez en el 0,1838 (correcto) y en el 0,1279.
  const T = tramosDe('FORESA-BRESFOR');
  const abril = buscarPct('FORESA-BRESFOR', '2026-04-20', T);
  assert.strictEqual(abril.ambiguo, true);
  const pcts = abril.candidatas.map(function (c) { return c.pct; }).sort();
  assert.deepStrictEqual(pcts, [0.1279, 0.1838]);

  // Con "el primero que matchea" habria devuelto 0,1838 por casualidad (el orden
  // del array), tapando el problema. La guarda de ambiguedad lo saca a la luz.
  let ambiguos = 0;
  for (let m = 4; m <= 8; m++) {
    for (let d = 1; d <= 28; d++) {
      const f = '2026-0' + m + '-' + String(d).padStart(2, '0');
      const r = buscarPct('FORESA-BRESFOR', f, T);
      if (r && r.ambiguo) { ambiguos++; }
    }
  }
  assert.ok(ambiguos > 40, 'la fecha corrupta contamina un rango grande, no un dia');

  // Las otras solapas, sin fecha corrupta, resuelven limpio el mismo dia.
  assert.strictEqual(buscarPct('QUIMIDROGA', '2026-06-18', tramosDe('QUIMIDROGA')).pct, 0.1517);
});
