// Tests del fallback N2 (§5.2) cableado en correlacionar():
//   node --test ficha/tests/correlacionar-n2-fallback.test.js
//
// Verifican DOS cosas:
//   1. GATE OFF (sin pool + catalogo): un documento sin ficha en el envio queda
//      huerfano igual que antes; correlaciones_externas vacio. Comportamiento
//      identico a v3.2 (cambio aditivo puro).
//   2. GATE ON (pool + catalogo cableados): ese mismo documento se correlaciona
//      N2 contra un viaje ya cargado en Gesruta, por ruta+material+peso+fecha,
//      usando el punto canonico del documento (no la matricula, no la ficha).

const test = require('node:test');
const assert = require('node:assert');

const { correlacionar, renderInforme, setLogActivo } = require('../correlacionar.js');
setLogActivo(false);

// Catalogo minimo de puntos canonicos (forma real: id_punto/nombre_canonico/alias).
const CATALOGO = [
  { id_punto: '1', nombre_canonico: 'CALDAS DE REIS', alias: '' },
  { id_punto: '2', nombre_canonico: 'VILLAGARCIA', alias: '' },
];

// Pool de viajes YA cargados en Gesruta (lo que cablearia "Leer Viajes Existentes").
const POOL = [
  { id: 'V-EXIST-1', referencia: 'REF-POOL-A', origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS',
    material: 'METANOL', fecha_carga: '2026-08-10', kg_documento: 24000 },
];

// Ficha del envio: su matricula (AAA1111) NO es la del documento de abajo.
const rA = {
  hojas: [{
    pagina: 1, conductor: 'CHOFER X', tractora: 'AAA1111', remolque: 'R0001', empresa: 'TLE',
    bloques: [{ orden: 1, fecha_carga: '2026-08-10', nombre_carga: 'FORESA',
      lugar_carga: 'VILLAGARCIA', lugar_descarga: 'CALDAS DE REIS', cantidad_kg: 24000, tipo_mercancia: 'METANOL' }],
  }],
};

// Documento de transporte cuya matricula (ZZZ0000) no corresponde a ninguna ficha
// del envio: es el candidato al fallback N2.
function docSuelto() {
  return {
    documentos: [{
      pagina: 5, tipo_doc: 'cmr', matricula_tractor: 'ZZZ0000', referencia: 'REF-DOC-9',
      fecha: '2026-08-10', origen: 'VILLAGARCIA', destino: 'CALDAS DE REIS',
      material: 'METANOL', kg_neto: 24000, emisor: 'FORESA', cliente_probable: 'FORESA',
    }],
  };
}

test('GATE OFF: sin pool ni catalogo, el documento queda huerfano (identico a v3.2)', function () {
  const res = correlacionar(rA, docSuelto());
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.correlaciones_externas, []);
  // El documento suelto es un error de huerfano, como antes.
  const huerfano = res.errores.some(function (e) { return e.indexOf('ZZZ0000') >= 0 || e.indexOf('no corresponde a ninguna ficha') >= 0; });
  assert.ok(huerfano, 'el documento sin ficha debe reportarse como huerfano');
  // Y el informe NO trae la seccion N2.
  assert.ok(renderInforme(res).indexOf('CORRELACION N2') === -1);
});

test('GATE ON: con pool + catalogo, el documento se correlaciona N2 con el viaje existente', function () {
  const res = correlacionar(rA, docSuelto(), { viajesExistentes: POOL, catalogoPuntos: CATALOGO });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.correlaciones_externas.length, 1);
  const c = res.correlaciones_externas[0];
  assert.strictEqual(c.correlacion, 'N2');
  assert.strictEqual(c.revisar, false);
  assert.strictEqual(c.viaje.id, 'V-EXIST-1');
  assert.strictEqual(c.documento.referencia, 'REF-DOC-9');
  // El informe imprime la seccion N2.
  assert.ok(renderInforme(res).indexOf('CORRELACION N2') >= 0);
});

test('N1 gana sobre N2: si la referencia del documento coincide con un viaje del pool', function () {
  const doc = docSuelto();
  doc.documentos[0].referencia = 'REF-POOL-A'; // == POOL[0].referencia
  const res = correlacionar(rA, doc, { viajesExistentes: POOL, catalogoPuntos: CATALOGO });
  assert.strictEqual(res.correlaciones_externas.length, 1);
  assert.strictEqual(res.correlaciones_externas[0].correlacion, 'N1');
});

test('N2 no adivina: documento sin origen/destino resoluble no correlaciona (queda huerfano)', function () {
  const doc = docSuelto();
  doc.documentos[0].origen = 'LUGAR INEXISTENTE QWERTY';
  doc.documentos[0].destino = 'OTRO LUGAR INEXISTENTE';
  const res = correlacionar(rA, doc, { viajesExistentes: POOL, catalogoPuntos: CATALOGO });
  // No hay correlacion (ni candidatos), el documento sigue siendo huerfano.
  assert.deepStrictEqual(res.correlaciones_externas, []);
});
