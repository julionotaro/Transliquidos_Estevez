// Tests del correlacionador de ficha.
//   node --test ficha/tests/*.test.js
//
// Dos bloques:
//   1. REGRESION: el modulo extraido produce exactamente el mismo informe y los
//      mismos datos que el fuente original del nodo (fixture v3.1). Nada de la
//      logica de correlacion ni de las guardas cambio.
//   2. BLINDAJE: las guardas ahora marcan la FILA (estado_lectura / motivo_revision).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { correlacionar, renderInforme, procesar, ESTADO_LECTURA, setLogActivo } = require('../correlacionar.js');

setLogActivo(false);

// --- Arnes: ejecuta el fuente ORIGINAL del nodo con un shim de $input ---------

const FUENTE_ORIGINAL = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'formatear-v3.1-original.js'), 'utf8');

function correrOriginal(respuestas) {
  const shim = { all: function () { return respuestas; } };
  const fn = new Function('$input', FUENTE_ORIGINAL);
  return fn(shim)[0].json;
}

// Quita del informe nuevo las lineas que agrega v3.2, para poder compararlo
// caracter a caracter contra el de v3.1.
function sinLineasNuevas(informe) {
  const fuera = [];
  const lineas = informe.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (/^Lectura: \d+ OK \/ \d+ REVISAR$/.test(l)) { continue; }
    if (/^ {2}>> ATENCION: \d+ de \d+ viajes tienen lectura dudosa\.$/.test(l)) { continue; }
    if (/^ {5}No son datos buenos\./.test(l)) { continue; }
    if (/^ {4}LECTURA: /.test(l)) { continue; }
    fuera.push(l);
  }
  return fuera.join('\n');
}

// --- Fixtures ---------------------------------------------------------------

function respuesta(obj) {
  return { json: { choices: [{ message: { content: JSON.stringify(obj) } }] } };
}

function bloque(over) {
  return Object.assign({
    orden: 1,
    fecha_carga: '2026-06-20',
    fecha_carga_texto: '20/06/26',
    fecha_descarga: null,
    nombre_carga: 'RNM',
    lugar_carga: 'VILLAGARCIA',
    nombre_descarga: null,
    lugar_descarga: 'AVEIRO',
    tipo_mercancia: 'RESINA',
    cantidad_kg: 23140,
    km_inicio: 838163,
    km_final: 838700,
    km_recorridos: 537,
  }, over);
}

function hoja(bloques, over) {
  return Object.assign({
    pagina: 1,
    empresa: 'TLE',
    conductor: 'ASENSI',
    tractora: '2498KZL',
    remolque: 'R1234BC',
    bloques: bloques,
    gastos: [{ tipo: 'dieta', importe: 30, forma: 'efectivo' }],
    observaciones: null,
  }, over);
}

function doc(over) {
  return Object.assign({
    pagina: 4,
    tipo_doc: 'cmr',
    emisor: null,
    duplicado_de: null,
    matricula_tractor: '2498KZL',
    matricula_remolque: null,
    referencia: 'ALB-1',
    fecha: '2026-06-20',
    origen: 'VILLAGARCIA',
    destino: 'AVEIRO',
    material: 'RESINA',
    kg_neto: 23140,
    importe: null,
    tarifa_tn: null,
    cliente_probable: 'RNM',
  }, over);
}

function entrada(hojas, documentos) {
  return [respuesta({ hojas: hojas }), respuesta({ documentos: documentos || [] })];
}

// Casos que se usan tanto para la regresion como para el blindaje.
const CASOS = {
  limpio: entrada([hoja([bloque()])], [doc()]),
  km_descuadrado: entrada([hoja([bloque({ km_recorridos: 600 })])], [doc()]),
  anio_malo: entrada([hoja([bloque({ fecha_carga: '2022-06-20', fecha_carga_texto: '20/06/22' })])], [doc()]),
  multiplo_500: entrada([hoja([bloque({ km_inicio: 838000, km_final: 838500, km_recorridos: null })])], [doc()]),
  odometros_uniformes: entrada(
    [hoja([
      bloque({ orden: 1, km_inicio: 100000, km_final: 100600, km_recorridos: null }),
      bloque({ orden: 2, km_inicio: 200000, km_final: 200600, km_recorridos: null, referencia: 'ALB-2' }),
    ])],
    [doc(), doc({ pagina: 5, referencia: 'ALB-2' })]),
  kg_null: entrada([hoja([bloque({ cantidad_kg: null })])], [doc({ kg_neto: null })]),
  sin_docs: entrada([hoja([bloque()])], []),
  varias_fichas: entrada(
    [
      hoja([bloque()]),
      hoja([bloque({ km_recorridos: 900 })], { pagina: 2, conductor: 'MARCOS', tractora: '3729JLH' }),
    ],
    [doc(), doc({ pagina: 6, matricula_tractor: '3729JLH', referencia: 'ALB-9' })]),
};

// ============================================================================
// 1. REGRESION contra el fuente original
// ============================================================================

for (const nombre of Object.keys(CASOS)) {
  test('regresion ' + nombre + ': informe identico al fuente original v3.1', () => {
    const original = correrOriginal(CASOS[nombre]);
    const nuevo = procesar(CASOS[nombre]);

    assert.strictEqual(nuevo.ok, original.ok);
    assert.strictEqual(sinLineasNuevas(nuevo.linea), original.linea,
      'el informe debe ser identico al de v3.1 una vez quitadas las lineas nuevas');
  });

  test('regresion ' + nombre + ': errores y avisos identicos al original', () => {
    const original = JSON.parse(correrOriginal(CASOS[nombre]).datos_json);
    const nuevo = JSON.parse(procesar(CASOS[nombre]).datos_json);

    assert.deepStrictEqual(nuevo.errores, original.errores);
    assert.deepStrictEqual(nuevo.avisos, original.avisos);
    assert.strictEqual(nuevo.viajes.length, original.viajes.length);
  });

  test('regresion ' + nombre + ': los campos de viaje preexistentes no cambian', () => {
    const original = JSON.parse(correrOriginal(CASOS[nombre]).datos_json);
    const nuevo = JSON.parse(procesar(CASOS[nombre]).datos_json);
    const NUEVOS = ['estado_lectura', 'motivo_revision', 'motivos_revision', 'pagina_origen'];

    for (let i = 0; i < original.viajes.length; i++) {
      const vo = original.viajes[i];
      const vn = Object.assign({}, nuevo.viajes[i]);
      for (const k of NUEVOS) { delete vn[k]; }
      assert.deepStrictEqual(vn, vo, 'viaje ' + (i + 1) + ' de ' + nombre + ' cambio');
    }
  });
}

// ============================================================================
// 2. BLINDAJE: estado_lectura por fila
// ============================================================================

function viajesDe(caso) {
  return correlacionar(
    JSON.parse(caso[0].json.choices[0].message.content),
    JSON.parse(caso[1].json.choices[0].message.content)
  ).viajes;
}

test('lectura limpia -> estado_lectura OK y sin motivo', () => {
  const v = viajesDe(CASOS.limpio)[0];

  assert.strictEqual(v.estado_lectura, ESTADO_LECTURA.OK);
  assert.strictEqual(v.motivo_revision, '');
});

test('GUARDA km: |(final-inicio) - recorridos| > 5 -> REVISAR con motivo', () => {
  const v = viajesDe(CASOS.km_descuadrado)[0];

  assert.strictEqual(v.estado_lectura, ESTADO_LECTURA.REVISAR);
  assert.match(v.motivo_revision, /600 km recorridos pero final-inicio da 537/);
  assert.match(v.motivo_revision, /odometro mal leido/);
  // La guarda marca, NO corrige el numero a mano.
  assert.strictEqual(v.km_recorridos, 600);
  assert.strictEqual(v.km_cargados, 537);
});

test('GUARDA km: una diferencia de 5 o menos NO marca REVISAR', () => {
  const caso = entrada([hoja([bloque({ km_recorridos: 540 })])], [doc()]); // 540 vs 537 = 3
  const v = viajesDe(caso)[0];

  assert.strictEqual(v.estado_lectura, ESTADO_LECTURA.OK);
});

test('anti-fabricacion: ano fuera de rango -> fecha anulada y REVISAR', () => {
  const v = viajesDe(CASOS.anio_malo)[0];

  assert.strictEqual(v.fecha_carga, null, 'la fecha con ano malo no se persiste como valida');
  assert.strictEqual(v.estado_lectura, ESTADO_LECTURA.REVISAR);
  assert.match(v.motivo_revision, /ano 2022 fuera de rango/);
});

test('anti-fabricacion: km multiplo exacto de 500 -> odometros anulados y REVISAR', () => {
  const v = viajesDe(CASOS.multiplo_500)[0];

  assert.strictEqual(v.km_cargados, null);
  assert.strictEqual(v.km_inicio, null);
  assert.strictEqual(v.km_final, null);
  assert.strictEqual(v.estado_lectura, ESTADO_LECTURA.REVISAR);
  assert.match(v.motivo_revision, /multiplo exacto de 500/);
});

test('anti-fabricacion: odometros uniformes en la hoja -> TODOS los viajes REVISAR', () => {
  const vs = viajesDe(CASOS.odometros_uniformes);

  assert.strictEqual(vs.length, 2);
  for (const v of vs) {
    assert.strictEqual(v.km_cargados, null, 'los km inventados se anulan');
    assert.strictEqual(v.estado_lectura, ESTADO_LECTURA.REVISAR);
    assert.match(v.motivo_revision, /dan exactamente 600 km/);
  }
});

test('fallar seguro: kg no leido queda null, nunca 0 ni inventado', () => {
  const v = viajesDe(CASOS.kg_null)[0];

  assert.strictEqual(v.cantidad_kg, null);
  assert.notStrictEqual(v.cantidad_kg, 0);
  assert.strictEqual(v.kg_documento, null);
});

test('fallar seguro: un 0 que devuelve el modelo se trata como no leido', () => {
  const caso = entrada([hoja([bloque({ cantidad_kg: 0, km_recorridos: 0 })])], [doc()]);
  const v = viajesDe(caso)[0];

  assert.strictEqual(v.cantidad_kg, null, 'el marcador 0 del esquema nunca entra como dato');
  assert.strictEqual(v.km_recorridos, null);
});

test('"sin documentacion" NO marca REVISAR: es otro eje, no calidad de lectura', () => {
  const v = viajesDe(CASOS.sin_docs)[0];

  assert.strictEqual(v.estado_lectura, ESTADO_LECTURA.OK);
  const res = correlacionar(
    JSON.parse(CASOS.sin_docs[0].json.choices[0].message.content),
    JSON.parse(CASOS.sin_docs[1].json.choices[0].message.content));
  assert.ok(res.errores.some(function (e) { return /SIN DOCUMENTACION/.test(e); }),
    'el error de documentacion se sigue reportando aparte');
});

test('lote mixto: cada viaje lleva su propio estado_lectura', () => {
  const vs = viajesDe(CASOS.varias_fichas);

  assert.strictEqual(vs.length, 2);
  assert.strictEqual(vs[0].estado_lectura, ESTADO_LECTURA.OK);
  assert.strictEqual(vs[1].estado_lectura, ESTADO_LECTURA.REVISAR);
  assert.strictEqual(vs[0].motivo_revision, '');
  assert.notStrictEqual(vs[1].motivo_revision, '');
});

test('trazabilidad: cada viaje guarda la pagina del PDF de la que salio', () => {
  const vs = viajesDe(CASOS.varias_fichas);

  assert.strictEqual(vs[0].pagina_origen, 1);
  assert.strictEqual(vs[1].pagina_origen, 2);
});

test('el informe muestra el conteo de lectura y el estado por viaje', () => {
  const res = correlacionar(
    JSON.parse(CASOS.varias_fichas[0].json.choices[0].message.content),
    JSON.parse(CASOS.varias_fichas[1].json.choices[0].message.content));
  const informe = renderInforme(res);

  assert.match(informe, /Lectura: 1 OK \/ 1 REVISAR/);
  assert.match(informe, /ATENCION: 1 de 2 viajes tienen lectura dudosa/);
  assert.match(informe, /LECTURA: OK/);
  assert.match(informe, /LECTURA: REVISAR -> /);
});

test('la salida del nodo expone el conteo de filas a revisar', () => {
  const out = procesar(CASOS.varias_fichas);

  assert.strictEqual(out.lectura_revisar, 1);
  assert.strictEqual(out.ok, true);
});

test('pasada de fichas invalida -> ok:false, sin reventar', () => {
  const out = procesar([{ json: {} }, { json: {} }]);

  assert.strictEqual(out.ok, false);
  assert.match(out.linea, /no devolvio JSON valido/);
});
