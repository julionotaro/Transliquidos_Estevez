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

const { correlacionar, renderInforme, procesar, parseRespuesta, ESTADO_LECTURA, setLogActivo } = require('../correlacionar.js');

setLogActivo(false);

// Reproduce el ENSAMBLADO pre-v3.4 (respuestas[0]=fichas, [1]=documentos) y
// llama al core correlacionar()+renderInforme(). La regresion compara ESTO contra
// el fuente v3.1: prueba que el core (guardas + correlacion) no cambio. El
// ensamblado nuevo (loop por pagina) es procesar(respuestas, metas), que tiene su
// propia seccion de tests. Este helper ES el procesar de v3.2, literal.
function nucleoV32(respuestas) {
  const rA = parseRespuesta(respuestas[0]);
  const rB = parseRespuesta(respuestas[1]);
  const res = correlacionar(rA, rB);
  if (!res.ok) {
    return { ok: false, linea: 'ERROR: la pasada de FICHAS no devolvio JSON valido.', datos_json: '', avisos: 1, errores: 1, lectura_revisar: 0 };
  }
  const salida = { hojas: res.hojas, viajes: res.viajes, documentos: res.documentos, errores: res.errores, avisos: res.avisos };
  const nRevisar = res.viajes.filter(function (v) { return v.estado_lectura === ESTADO_LECTURA.REVISAR; }).length;
  return { ok: true, linea: renderInforme(res), datos_json: JSON.stringify(salida), avisos: res.avisos.length, errores: res.errores.length, lectura_revisar: nRevisar };
}

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

// CAMBIO 3 (2026-08-11): el cliente pasa a salir SIEMPRE del documento (emisor /
// cliente_probable), NUNCA de la ficha. En los fixtures sin documento
// correlacionado el cliente cambia de "RNM" (tomado del nombre_carga de la ficha,
// modelo viejo) a null (modelo nuevo: sin documento no hay cliente ni regimen,
// D-01). Esa divergencia respecto de v3.1 es INTENCIONAL -- NO es un ajuste para
// que pase el test: es la decision de dominio de que la ficha manuscrita no es
// fuente de cliente. Por eso estos casos SALEN de la regresion "identico a v3.1"
// y tienen tests propios que afirman el comportamiento nuevo (ver "CAMBIO 3" abajo).
const REGRESION_EXCLUIDOS = ['odometros_uniformes', 'sin_docs'];

for (const nombre of Object.keys(CASOS)) {
  if (REGRESION_EXCLUIDOS.indexOf(nombre) >= 0) { continue; }
  test('regresion ' + nombre + ': informe identico al fuente original v3.1', () => {
    const original = correrOriginal(CASOS[nombre]);
    const nuevo = nucleoV32(CASOS[nombre]);

    assert.strictEqual(nuevo.ok, original.ok);
    assert.strictEqual(sinLineasNuevas(nuevo.linea), original.linea,
      'el informe debe ser identico al de v3.1 una vez quitadas las lineas nuevas');
  });

  test('regresion ' + nombre + ': errores y avisos identicos al original', () => {
    const original = JSON.parse(correrOriginal(CASOS[nombre]).datos_json);
    const nuevo = JSON.parse(nucleoV32(CASOS[nombre]).datos_json);

    assert.deepStrictEqual(nuevo.errores, original.errores);
    assert.deepStrictEqual(nuevo.avisos, original.avisos);
    assert.strictEqual(nuevo.viajes.length, original.viajes.length);
  });

  test('regresion ' + nombre + ': los campos de viaje preexistentes no cambian', () => {
    const original = JSON.parse(correrOriginal(CASOS[nombre]).datos_json);
    const nuevo = JSON.parse(nucleoV32(CASOS[nombre]).datos_json);
    // Campos ADITIVOS: se excluyen de la comparacion, pero todo el RESTO
    // (cantidad_kg, km_*, kg_documento, referencia, cliente...) se compara byte a
    // byte contra el original -> prueba que el camino normal no regresiona.
    const NUEVOS = ['estado_lectura', 'motivo_revision', 'motivos_revision', 'pagina_origen',
      // Fase 2 (modelo albaran=unidad):
      'cantidad_declarada', 'modo_cantidad', 'es_multiviaje', 'n_viajes_declarado',
      'origen_km', 'regimen_indexacion', 'estado', 'pendiente_falta', 'pendiente_reclamar_a', 'origen_campos',
      // Fix contaminacion entre patas del mismo camion (2026-08-04):
      'docs_ambiguos',
      // Reconciliacion de matricula ficha<->documento (2026-08-10): lectura original.
      'tractora_original', 'tractoraN_original',
      // KM vacios encadenados por tractora (2026-08-26): de donde salio el vacio
      // (cadena_tabla / cadena_lote) o por que no se pudo calcular. Los valores
      // de km_vacios NO cambian en estos casos -- se comparan byte a byte.
      'origen_km_vacios'];

    for (let i = 0; i < original.viajes.length; i++) {
      const vo = original.viajes[i];
      const vn = Object.assign({}, nuevo.viajes[i]);
      for (const k of NUEVOS) { delete vn[k]; }
      assert.deepStrictEqual(vn, vo, 'viaje ' + (i + 1) + ' de ' + nombre + ' cambio');
    }
  });
}

// ============================================================================
// CAMBIO 3 (2026-08-11) — cliente SIEMPRE del documento, NUNCA de la ficha.
// Estos tests reemplazan la regresion de los fixtures sin documento: documentan
// que el cambio de cliente ("RNM" de la ficha -> null) es INTENCIONAL. El modelo
// viejo usaba nombre_carga de la ficha como cliente de respaldo; el nuevo NO
// (D-01: sin documento no hay cliente ni regimen). La ficha ya fallo dos veces
// (matricula y cliente=lugar de carga): no se la reintroduce como fuente de cliente.
// ============================================================================
test('CAMBIO 3: sin_docs -> viaje SIN cliente ni regimen, PENDIENTE_DOCUMENTACION (antes tomaba "RNM" de la ficha)', () => {
  const nuevo = JSON.parse(nucleoV32(CASOS.sin_docs).datos_json);
  const v = nuevo.viajes[0];
  assert.strictEqual(v.cliente, null, 'la ficha (nombre_carga) NO es fuente de cliente');
  assert.strictEqual(v.regimen_indexacion, null, 'sin cliente no hay regimen');
  assert.strictEqual(v.estado, 'PENDIENTE_DOCUMENTACION', 'falta el documento');
  // guard: un viaje SIN documento NO es cliente_no_reconocido (eje distinto).
  assert.ok(!/cliente_no_reconocido/.test(v.motivo_revision || ''),
    'sin documento es PENDIENTE_DOCUMENTACION, no cliente_no_reconocido');
});

test('CAMBIO 3: odometros_uniformes -> el viaje que quedo sin documento no hereda el cliente de la ficha', () => {
  const nuevo = JSON.parse(nucleoV32(CASOS.odometros_uniformes).datos_json);
  const sinDoc = nuevo.viajes.find(function (v) { return v.docs.length === 0; });
  assert.ok(sinDoc, 'este fixture deja un viaje sin documento (docs ambiguos no se prestan)');
  assert.strictEqual(sinDoc.cliente, null, 'sin documento propio -> sin cliente (antes "RNM" de la ficha)');
  assert.strictEqual(sinDoc.estado, 'PENDIENTE_DOCUMENTACION');
});

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

test('contaminacion: doc de una pata NO presta material/destino a la otra pata del mismo camion (bug real 2026-08-04)', () => {
  // Escenario real del probe: un camion (2498KZL) hace dos viajes el mismo dia.
  // Viaje 1: RNM AVEIRO->BEGEGA, SOSA. Viaje 2: ASTURIANA ZINC, ACIDO SULFURICO.
  // Un CMR de acido sulfurico matchea la matricula, cae en la ventana de fecha
  // de AMBOS y no trae kg parseable -> no se puede desambiguar. NO debe prestarle
  // su carga (acido sulfurico / destino de la pata 2) al viaje 1 (sosa).
  const cmrAcidoAmbiguo = doc({
    pagina: 5, tipo_doc: 'cmr', referencia: '2601014469',
    matricula_tractor: '2498KZL', fecha: '2026-07-30',
    origen: 'SAN JUAN DE NIEVA', destino: 'VIANA DO CASTELO', material: 'ACIDO SULFURICO',
    kg_neto: null, cliente_probable: 'ASTURIANA ZINC',
  });
  const caso = entrada(
    [hoja([
      bloque({ orden: 1, fecha_carga: '2026-07-29', fecha_descarga: '2026-07-30', nombre_carga: 'RNM', lugar_carga: 'AVEIRO', lugar_descarga: 'BEGEGA', tipo_mercancia: 'SOSA', cantidad_kg: 17900, km_inicio: 845752, km_final: 846406, km_recorridos: null }),
      bloque({ orden: 2, fecha_carga: '2026-07-30', fecha_descarga: '2026-07-31', nombre_carga: 'ASTURIANA ZINC', lugar_carga: 'SAN JUAN DE NIEVA', lugar_descarga: 'VIANA DO CASTELO', tipo_mercancia: 'ACIDO SULFURICO', cantidad_kg: 24160, km_inicio: 846531, km_final: 847037, km_recorridos: null }),
    ])],
    [cmrAcidoAmbiguo]);
  const res = correlacionar(
    JSON.parse(caso[0].json.choices[0].message.content),
    JSON.parse(caso[1].json.choices[0].message.content));
  const v1 = res.viajes[0];

  // El viaje 1 (sosa) NO hereda la carga del CMR de acido de la otra pata.
  // (Proteccion original del bug 2026-08-04: sigue intacta.)
  assert.notStrictEqual(v1.material, 'ACIDO SULFURICO', 'viaje 1 no debe heredar el material del CMR de la otra pata');
  assert.strictEqual(v1.material, 'SOSA', 'viaje 1 conserva su material de ficha');
  assert.notStrictEqual(v1.destino, 'VIANA DO CASTELO', 'viaje 1 no debe heredar el destino del CMR de la otra pata');
  assert.strictEqual(v1.destino, 'BEGEGA', 'viaje 1 conserva su lugar de descarga de ficha');
  assert.strictEqual(v1.docs.length, 0, 'el CMR de la pata 2 no cuenta como doc del viaje 1');
  assert.strictEqual(v1.estado, 'PENDIENTE_DOCUMENTACION', 'sin doc propio -> PENDIENTE, no facturado con datos de otro');

  // MEJORA (ejec. 967): antes este CMR quedaba AMBIGUO (fecha en ventana de ambas
  // patas, sin kg). Ahora el desempate por emisor/destino lo manda a SU viaje: el
  // emisor ASTURIANA ZINC y el destino VIANA DO CASTELO son los de la pata 2. Es
  // mas util que dejarlo sin asignar, y no relaja la proteccion de arriba.
  const v2 = res.viajes[1];
  assert.strictEqual(v2.docs.length, 1, 'el CMR se asigna a la pata que realmente le corresponde');
  assert.strictEqual(v2.material, 'ACIDO SULFURICO');
  assert.strictEqual(v2.estado, 'con_documentacion');
});

test('contaminacion: MISMO material y sin emisor/destino/kg -> el doc queda AMBIGUO (no se adivina)', () => {
  // Dos viajes del MISMO producto (SOSA) el mismo camion, en fechas contiguas, y
  // un CMR sin emisor/destino/kg y con FECHA que cae en los dos. Ni el material
  // (igual en ambos), ni la fecha exacta (no coincide con una sola), ni el resto
  // desempatan -> debe quedar ambiguo, sin prestarle carga a nadie.
  const cmrSinSeñal = doc({
    pagina: 5, tipo_doc: 'cmr', referencia: '2601014469',
    matricula_tractor: '2498KZL', fecha: '2026-07-30',
    origen: null, destino: null, material: 'SOSA',
    kg_neto: null, cliente_probable: null, emisor: null,
  });
  const caso = entrada(
    [hoja([
      bloque({ orden: 1, fecha_carga: '2026-07-30', fecha_descarga: '2026-07-31', nombre_carga: 'RNM', lugar_carga: 'AVEIRO', lugar_descarga: 'BEGEGA', tipo_mercancia: 'SOSA', cantidad_kg: 17900, km_inicio: 845752, km_final: 846406, km_recorridos: null }),
      bloque({ orden: 2, fecha_carga: '2026-07-30', fecha_descarga: '2026-07-31', nombre_carga: 'RNM', lugar_carga: 'AVEIRO', lugar_descarga: 'BEGEGA', tipo_mercancia: 'SOSA', cantidad_kg: 24160, km_inicio: 846531, km_final: 847037, km_recorridos: null }),
    ])],
    [cmrSinSeñal]);
  const res = correlacionar(
    JSON.parse(caso[0].json.choices[0].message.content),
    JSON.parse(caso[1].json.choices[0].message.content));
  assert.ok(res.viajes.every(function (v) { return v.docs.length === 0; }), 'ningun viaje recibe el doc sin señal');
  assert.ok(res.viajes.some(function (v) { return (v.docs_ambiguos || []).length === 1; }), 'queda adjunto aparte');
  assert.ok(res.avisos.some(function (a) { return /no se pudo desambiguar/.test(a); }), 'la ambiguedad se surfacea');
});

test('GUARDA MATERIAL: un doc de un producto va al viaje de ESE producto, no al otro (bug ejec 1024)', () => {
  // Bug real: los CMR/guia de SOSA se pegaban al viaje de ACIDO SULFURICO porque
  // el desempate por destino matcheaba el cliente (RNM), comun a los dos. El
  // material los separa: SOSA (51) nunca se pega a un viaje de ACIDO (20).
  const cmrAcido = doc({
    pagina: 5, tipo_doc: 'cmr', referencia: '600612599',
    matricula_tractor: '2498KZL', fecha: '2026-07-30',
    origen: 'Asturiana Zinc', destino: 'RNM Portugal', material: 'UN 1830, ACIDO SULFURICO, 8, II',
    kg_neto: 23500, cliente_probable: 'RNM', emisor: null,
  });
  const caso = entrada(
    [hoja([
      bloque({ orden: 1, fecha_carga: '2026-07-29', fecha_descarga: '2026-07-30', nombre_carga: 'RNM', lugar_carga: 'AVEIRO', lugar_descarga: 'NAVIA', tipo_mercancia: 'SOSA', cantidad_kg: null, km_inicio: 845752, km_final: 846406, km_recorridos: null }),
      bloque({ orden: 2, fecha_carga: '2026-07-30', fecha_descarga: '2026-07-31', nombre_carga: 'RNM', lugar_carga: 'AVILES', lugar_descarga: 'FAMALICAO', tipo_mercancia: 'ACIDO SULFURICO', cantidad_kg: null, km_inicio: 846531, km_final: 847037, km_recorridos: null }),
    ])],
    [cmrAcido]);
  const res = correlacionar(
    JSON.parse(caso[0].json.choices[0].message.content),
    JSON.parse(caso[1].json.choices[0].message.content));
  const vSosa = res.viajes.find(function (v) { return v.tipo_mercancia === 'SOSA'; });
  const vAcido = res.viajes.find(function (v) { return v.tipo_mercancia === 'ACIDO SULFURICO'; });
  assert.strictEqual(vSosa.docs.length, 0, 'el doc de acido NO contamina el viaje de sosa');
  assert.strictEqual(vAcido.docs.length, 1, 'el doc de acido va al viaje de acido');
  assert.strictEqual(vAcido.referencia, '600612599');
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

// ============================================================================
// 3. AGREGACION v3.4 — loop por pagina: procesar(respuestas, metas)
// ============================================================================
//
// Cada pagina es una respuesta pass:'fichas' con UNA hoja; la de documentos va
// aparte. procesar las reagrupa por indice contra las metas de Preparar Payload.

// Respuesta de una pagina de ficha (una sola hoja).
function respFicha(h) { return respuesta({ hojas: [h] }); }
function respDocs(docs) { return respuesta({ documentos: docs || [] }); }
function metaFicha(pagina) { return { pass: 'fichas', pagina: pagina }; }
const META_DOCS = { pass: 'documentos' };

// PDF de las 3 fichas: Asensi / Pablo Carles / Marcos, una hoja por pagina.
function tresFichas() {
  const respuestas = [
    respFicha(hoja([bloque()], { pagina: 1, conductor: 'ASENSI', tractora: '2498KZL' })),
    respFicha(hoja([bloque({ referencia: 'B2' })], { pagina: 1, conductor: 'PABLO CARLES', tractora: '8420KKT' })),
    respFicha(hoja([bloque({ referencia: 'B3' })], { pagina: 1, conductor: 'MARCOS', tractora: '3729JLH' })),
    respDocs([]),
  ];
  const metas = [metaFicha(1), metaFicha(2), metaFicha(3), META_DOCS];
  return { respuestas: respuestas, metas: metas };
}

test('AGREGACION: 3 paginas de ficha -> 3 hojas, todos los viajes, cero perdida', () => {
  const { respuestas, metas } = tresFichas();
  const out = procesar(respuestas, metas);
  const S = JSON.parse(out.datos_json);

  assert.strictEqual(out.ok, true);
  assert.strictEqual(S.hojas.length, 3, 'una hoja por ficha, ninguna perdida');
  assert.strictEqual(S.viajes.length, 3, 'los 3 viajes (1 por ficha en este fixture)');
  assert.deepStrictEqual(
    S.hojas.map(function (h) { return h.conductor; }),
    ['ASENSI', 'PABLO CARLES', 'MARCOS'], 'las 3 fichas, en orden de pagina');
});

test('AGREGACION: pagina_origen se inyecta con la pagina real, no la del modelo', () => {
  // El modelo ve una sola imagen y siempre dice pagina:1; el sistema pisa con la real.
  const { respuestas, metas } = tresFichas();
  const S = JSON.parse(procesar(respuestas, metas).datos_json);

  assert.deepStrictEqual(S.viajes.map(function (v) { return v.pagina_origen; }), [1, 2, 3]);
});

test('AGREGACION: una pagina con JSON invalido es ERROR visible, no perdida silenciosa', () => {
  const respuestas = [
    respFicha(hoja([bloque()], { conductor: 'ASENSI', tractora: '2498KZL' })),
    { json: { choices: [{ message: { content: 'esto no es JSON' } }] } }, // pagina 2 rota
    respFicha(hoja([bloque({ referencia: 'B3' })], { conductor: 'MARCOS', tractora: '3729JLH' })),
    respDocs([]),
  ];
  const metas = [metaFicha(1), metaFicha(2), metaFicha(3), META_DOCS];
  const out = procesar(respuestas, metas);
  const S = JSON.parse(out.datos_json);

  assert.strictEqual(S.hojas.length, 2, 'se leyeron 2 fichas');
  assert.ok(S.errores.some(function (e) { return /Pagina 2:.*no devolvio JSON valido/.test(e); }),
    'la ficha no leida aparece como ERROR, con su numero de pagina');
});

test('AGREGACION: hojas:[] (pagina de documento) NO cuenta como ficha perdida', () => {
  // Una pagina impresa entre fichas: el modelo devuelve {hojas:[]}. Es legitimo.
  const respuestas = [
    respFicha(hoja([bloque()], { conductor: 'ASENSI', tractora: '2498KZL' })),
    respuesta({ hojas: [] }), // pagina 2 = documento impreso
    respDocs([]),
  ];
  const metas = [metaFicha(1), metaFicha(2), META_DOCS];
  const out = procesar(respuestas, metas);
  const S = JSON.parse(out.datos_json);

  assert.strictEqual(S.hojas.length, 1);
  assert.ok(!S.errores.some(function (e) { return /Pagina 2/.test(e); }),
    'una pagina de documento no genera error de ficha perdida');
});

test('AGREGACION: los documentos enganchan por matricula a la ficha de su pagina', () => {
  // Documento con matricula de Marcos -> debe asociarse al viaje de Marcos.
  const respuestas = [
    respFicha(hoja([bloque()], { conductor: 'ASENSI', tractora: '2498KZL' })),
    respFicha(hoja([bloque({ referencia: 'B3' })], { conductor: 'MARCOS', tractora: '3729JLH' })),
    respDocs([doc({ matricula_tractor: '3729JLH', referencia: 'CMR-MARCOS' })]),
  ];
  const metas = [metaFicha(1), metaFicha(2), META_DOCS];
  const S = JSON.parse(procesar(respuestas, metas).datos_json);

  const marcos = S.viajes.find(function (v) { return v.tractora === '3729JLH'; });
  assert.strictEqual(marcos.docs.length, 1, 'el CMR engancho a la ficha de Marcos');
  assert.strictEqual(marcos.referencia, 'CMR-MARCOS');
});

test('la salida del nodo expone el conteo de filas a revisar', () => {
  const respuestas = [
    respFicha(hoja([bloque()], { conductor: 'ASENSI', tractora: '2498KZL' })),
    respFicha(hoja([bloque({ km_recorridos: 900 })], { conductor: 'MARCOS', tractora: '3729JLH' })),
    respDocs([]),
  ];
  const metas = [metaFicha(1), metaFicha(2), META_DOCS];
  const out = procesar(respuestas, metas);

  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.lectura_revisar, 1, 'el viaje con km descuadrado cuenta como REVISAR');
});

test('todas las paginas de ficha con JSON invalido -> ok:true pero con errores, sin reventar', () => {
  // Ninguna ficha leible: no revienta; correlacionar reporta "ninguna ficha" +
  // procesar reporta cada pagina fallida. No es un ok:false catastrofico.
  const respuestas = [
    { json: { choices: [{ message: { content: 'roto' } }] } },
    respDocs([]),
  ];
  const out = procesar(respuestas, [metaFicha(1), META_DOCS]);

  assert.strictEqual(out.ok, true);
  assert.ok(out.errores >= 1);
  assert.match(out.linea, /Pagina 1:.*no devolvio JSON valido/);
});
