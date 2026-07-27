// Tests del armado de payload de la pasada de ficha (v3.3).
//   node --test ficha/tests/*.test.js
//
// El caso central: la ficha va al modelo como IMAGEN rasterizada a 300 DPI,
// nunca como type:file. Ese era el bug de fondo.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  MODELOS_BARRIDO,
  PROMPT_FICHAS,
  PROMPT_DOCS,
  adjuntosImagenesDesdePng,
  adjuntosDocsDesdeArchivos,
  armarPayloadFichas,
  armarPayloadDocs,
  concatPaginasRasterizadas,
  componerHint,
  setLogActivo,
} = require('../payload.js');

setLogActivo(false);

// PNG 1x1 real, sirve de png_base64 de ejemplo.
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function respuestaRast(numPaginas) {
  const paginas = [];
  for (let i = 1; i <= numPaginas; i++) {
    paginas.push({ pagina: i, ancho: 2480, alto: 3508, png_base64: PNG_1PX });
  }
  return { dpi: 300, num_paginas: numPaginas, paginas: paginas };
}

// ============================================================================
// 1. La ficha va como imagen, NUNCA como type:file
// ============================================================================

test('la pasada de ficha arma image_url y nunca type:file', () => {
  const adj = adjuntosImagenesDesdePng([PNG_1PX]);
  const p = armarPayloadFichas('gpt-4o-mini', adj, '');
  const content = p.messages[1].content;

  const tipos = content.map(function (c) { return c.type; });
  assert.ok(tipos.includes('image_url'), 'debe haber al menos un image_url');
  assert.ok(!tipos.includes('file'), 'NUNCA type:file en la pasada de ficha');

  const img = content.find(function (c) { return c.type === 'image_url'; });
  assert.strictEqual(img.image_url.url, 'data:image/png;base64,' + PNG_1PX);
  assert.strictEqual(img.image_url.detail, 'high', 'detalle alto es lo validado a 300 DPI');
});

test('serializado completo del payload de ficha no contiene application/pdf', () => {
  const adj = adjuntosImagenesDesdePng([PNG_1PX, PNG_1PX]);
  const crudo = JSON.stringify(armarPayloadFichas('gpt-4o', adj, ''));

  assert.ok(!crudo.includes('application/pdf'), 'ningun PDF debe viajar en la pasada de ficha');
  assert.ok(!crudo.includes('"file_data"'), 'ningun file_data en la pasada de ficha');
  assert.ok(crudo.includes('data:image/png;base64,'));
});

test('el texto del usuario va primero y las imagenes despues', () => {
  const p = armarPayloadFichas('gpt-4o-mini', adjuntosImagenesDesdePng([PNG_1PX]), '');
  const content = p.messages[1].content;

  assert.strictEqual(content[0].type, 'text');
  assert.strictEqual(content[1].type, 'image_url');
});

// ============================================================================
// 2. Multipagina: 3 paginas -> 3 imagenes separadas, en orden
// ============================================================================

test('multipagina: num_paginas=3 produce 3 imagenes separadas, sin fusionar', () => {
  const pngs = concatPaginasRasterizadas([respuestaRast(3)]);
  assert.strictEqual(pngs.length, 3);

  const p = armarPayloadFichas('gpt-4o-mini', adjuntosImagenesDesdePng(pngs), '');
  const imgs = p.messages[1].content.filter(function (c) { return c.type === 'image_url'; });

  assert.strictEqual(imgs.length, 3, 'una entrada de imagen por pagina');
  imgs.forEach(function (i) { assert.match(i.image_url.url, /^data:image\/png;base64,/); });
});

test('multipagina: varios PDF se concatenan en orden de llegada', () => {
  const pngs = concatPaginasRasterizadas([respuestaRast(2), respuestaRast(3)]);

  assert.strictEqual(pngs.length, 5, '2 + 3 paginas');
});

test('paginas sin png_base64 se descartan en vez de mandar basura', () => {
  const r = { num_paginas: 2, paginas: [{ pagina: 1, png_base64: PNG_1PX }, { pagina: 2, png_base64: null }] };

  assert.strictEqual(concatPaginasRasterizadas([r]).length, 1);
});

test('sin respuestas del rasterizador no se arma ninguna imagen', () => {
  assert.deepStrictEqual(concatPaginasRasterizadas([]), []);
  assert.deepStrictEqual(concatPaginasRasterizadas([{}]), []);
});

// ============================================================================
// 3. MODELO_FICHAS conmuta sin tocar el resto
// ============================================================================

test('MODELO_FICHAS conmuta entre gpt-4o-mini y gpt-4o dejando igual el resto', () => {
  const adj = adjuntosImagenesDesdePng([PNG_1PX]);
  const mini = armarPayloadFichas('gpt-4o-mini', adj, '');
  const full = armarPayloadFichas('gpt-4o', adj, '');

  assert.strictEqual(mini.model, 'gpt-4o-mini');
  assert.strictEqual(full.model, 'gpt-4o');

  // Todo lo demas identico: mismo prompt, mismo contenido, mismos parametros.
  assert.deepStrictEqual(mini.messages, full.messages);
  assert.deepStrictEqual(mini.response_format, full.response_format);
  assert.strictEqual(mini.temperature, full.temperature);
  assert.strictEqual(mini.max_tokens, full.max_tokens);
});

test('los modelos del barrido cableados son gpt-4o-mini y gpt-4o', () => {
  const wired = MODELOS_BARRIDO.filter(function (m) { return m.wired; }).map(function (m) { return m.id; });

  assert.deepStrictEqual(wired, ['gpt-4o-mini', 'gpt-4o']);
});

test('el slot Gemini esta declarado pero NO cableado, y falla con mensaje claro', () => {
  const gem = MODELOS_BARRIDO.find(function (m) { return m.id === 'gemini-flash'; });
  assert.ok(gem, 'el slot debe estar declarado para el barrido');
  assert.strictEqual(gem.wired, false);

  assert.throws(
    function () { armarPayloadFichas('gemini-flash', adjuntosImagenesDesdePng([PNG_1PX]), ''); },
    /no esta cableado todavia/,
    'debe fallar explicito, no armar un payload OpenAI con nombre de Gemini');
});

test('un modelo desconocido falla en vez de armar un payload invalido', () => {
  assert.throws(
    function () { armarPayloadFichas('llama-3', adjuntosImagenesDesdePng([PNG_1PX]), ''); },
    /proveedor desconocido/);
});

test('la familia gpt-5 usa max_completion_tokens y no temperature', () => {
  const p = armarPayloadFichas('gpt-5', adjuntosImagenesDesdePng([PNG_1PX]), '');

  assert.strictEqual(p.max_completion_tokens, 16000);
  assert.strictEqual(p.max_tokens, undefined);
  assert.strictEqual(p.temperature, undefined);
});

// ============================================================================
// 4. La pasada de documentos NO cambia
// ============================================================================

test('la pasada de documentos sigue mandando el PDF como type:file', () => {
  const adj = adjuntosDocsDesdeArchivos([{ nombre: 'envio.pdf', mime: 'application/pdf', b64: 'QUJD' }]);
  const p = armarPayloadDocs('gpt-4o', adj, '');
  const content = p.messages[1].content;

  const file = content.find(function (c) { return c.type === 'file'; });
  assert.ok(file, 'documentos sigue con type:file');
  assert.strictEqual(file.file.file_data, 'data:application/pdf;base64,QUJD');
  assert.strictEqual(file.file.filename, 'envio.pdf');
  assert.strictEqual(p.model, 'gpt-4o');
});

test('una imagen suelta en documentos va como image_url', () => {
  const adj = adjuntosDocsDesdeArchivos([{ nombre: 'foto.jpg', mime: 'image/jpeg', b64: 'QUJD' }]);

  assert.strictEqual(adj.length, 1);
  assert.strictEqual(adj[0].type, 'image_url');
  assert.strictEqual(adj[0].image_url.detail, 'high');
});

// ============================================================================
// 5. Prompts intactos (el encargo prohibe tocarlos)
// ============================================================================

test('los prompts son copia literal del nodo v3.2', () => {
  const src = fs.readFileSync(path.join(__dirname, 'fixtures', 'preparar-payload-v3.2-original.js'), 'utf8');
  const reconstruir = function (letra) {
    const arr = [];
    const re = new RegExp('^' + letra + '\\.push\\((.*)\\);$');
    for (const line of src.split('\n')) {
      const m = line.match(re);
      if (m) { arr.push(eval(m[1])); }
    }
    return arr.join('\n');
  };

  assert.strictEqual(PROMPT_FICHAS, reconstruir('A'), 'el prompt de ficha no debe cambiar');
  assert.strictEqual(PROMPT_DOCS, reconstruir('B'), 'el prompt de documentos no debe cambiar');
});

test('el prompt de ficha conserva la regla del marcador 0', () => {
  assert.match(PROMPT_FICHAS, /los null del ejemplo indican el TIPO del campo, no un valor por defecto/);
  assert.match(PROMPT_FICHAS, /NUNCA 0 en un campo numerico que no pudiste leer/);
});

// ============================================================================
// 6. Hint del operador
// ============================================================================

test('el hint del operador se adjunta al texto del usuario', () => {
  const hint = componerHint('TLE', 'urgente');
  const p = armarPayloadFichas('gpt-4o-mini', adjuntosImagenesDesdePng([PNG_1PX]), hint);

  assert.match(p.messages[1].content[0].text, /Empresa indicada por el operador: TLE\./);
  assert.match(p.messages[1].content[0].text, /Notas del operador: urgente/);
});

test('"No estoy seguro" no se propaga como hint de empresa', () => {
  assert.strictEqual(componerHint('No estoy seguro', ''), '');
});

// ============================================================================
// 7. Regresion: corrupcion silenciosa del binario (bug encontrado el 27/07)
// ============================================================================

test('REGRESION: el marcador "filesystem-v2" nunca puede pasar por base64 de PDF', () => {
  // n8n en modo filesystem pone la cadena literal 'filesystem-v2' en
  // binary[key].data. Decodificarla como base64 da 9 bytes de basura SIN
  // lanzar error: la pasada de documentos recibiria un PDF corrupto y nadie
  // se enteraria. Por eso el base64 se lee en Preparar Rasterizacion, que si
  // tiene el binario en su entrada, y viaja en `archivos`.
  const basura = Buffer.from('filesystem-v2', 'base64');

  assert.ok(basura.length < 20, 'el marcador decodifica a un puñado de bytes');
  assert.notStrictEqual(basura.toString('utf8'), '%PDF-1.1 contenido de prueba');

  // adjuntosDocsDesdeArchivos consume base64 YA resuelto: si le llega el
  // marcador, lo propaga tal cual. Por eso la guarda vive aguas arriba.
  const adj = adjuntosDocsDesdeArchivos([{ nombre: 'x.pdf', mime: 'application/pdf', b64: 'filesystem-v2' }]);
  assert.strictEqual(adj[0].file.file_data, 'data:application/pdf;base64,filesystem-v2',
    'el modulo no puede detectarlo: la unica defensa es leer el binario donde SI esta');
});

test('la pasada de documentos consume `archivos` con base64 ya resuelto', () => {
  const real = Buffer.from('%PDF-1.1 real', 'utf8').toString('base64');
  const adj = adjuntosDocsDesdeArchivos([{ nombre: 'r.pdf', mime: 'application/pdf', b64: real }]);
  const p = armarPayloadDocs('gpt-4o', adj, '');

  const file = p.messages[1].content.find(function (c) { return c.type === 'file'; });
  const vuelta = Buffer.from(file.file.file_data.split(',')[1], 'base64').toString('utf8');
  assert.strictEqual(vuelta, '%PDF-1.1 real', 'el PDF debe llegar intacto al modelo');
});
