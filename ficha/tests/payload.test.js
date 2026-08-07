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
  armarItemsFichaPorPagina,
  armarPayloadDocs,
  concatPaginasRasterizadas,
  componerHint,
  setLogActivo,
  REGIONES_FICHA,
  BANDAS_FICHA_ORDEN,
  adjuntosFichaConBandas,
  concatPaginasConRegiones,
  armarItemsFichaPorPaginaConBandas,
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

test('LOOP: paginas[] de 3 -> 3 items, cada uno con UNA sola imagen', () => {
  const pngs = concatPaginasRasterizadas([respuestaRast(3)]);
  assert.strictEqual(pngs.length, 3);

  const items = armarItemsFichaPorPagina('gpt-4o-mini', pngs, '');
  assert.strictEqual(items.length, 3, 'un item (una llamada) por pagina');

  items.forEach(function (it) {
    const imgs = it.payload.messages[1].content.filter(function (c) { return c.type === 'image_url'; });
    assert.strictEqual(imgs.length, 1, 'cada llamada lleva EXACTAMENTE una imagen');
    assert.match(imgs[0].image_url.url, /^data:image\/png;base64,/);
    assert.strictEqual(it.pass, 'fichas');
    assert.strictEqual(it.modelo, 'gpt-4o-mini');
  });
});

test('LOOP: pagina correcta por item (1,2,3), en orden', () => {
  const pngs = concatPaginasRasterizadas([respuestaRast(3)]);
  const items = armarItemsFichaPorPagina('gpt-4o-mini', pngs, '');

  assert.deepStrictEqual(items.map(function (it) { return it.pagina; }), [1, 2, 3]);
});

test('LOOP: ninguna llamada de ficha lleva mas de una imagen', () => {
  const pngs = concatPaginasRasterizadas([respuestaRast(5)]);
  const items = armarItemsFichaPorPagina('gpt-4o', pngs, '');

  assert.strictEqual(items.length, 5);
  items.forEach(function (it) {
    const crudo = JSON.stringify(it.payload);
    const nImgs = (crudo.match(/data:image\/png;base64,/g) || []).length;
    assert.strictEqual(nImgs, 1, 'una imagen por llamada, sin excepcion');
  });
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
// 2b. B.1: recorte por banda ampliada (matricula + km por viaje)
// ============================================================================

function paginaConBandas(vacios) {
  vacios = vacios || {};
  const regiones = REGIONES_FICHA.map(function (r) {
    return { nombre: r.nombre, png_base64: PNG_1PX, parece_vacio: !!vacios[r.nombre] };
  });
  return { png_base64: PNG_1PX, regiones: regiones };
}

function respuestaRegiones(numPaginas, vacios) {
  const paginas = [];
  for (let i = 1; i <= numPaginas; i++) {
    const p = paginaConBandas(vacios);
    p.pagina = i;
    paginas.push(p);
  }
  return { dpi: 300, num_paginas: numPaginas, paginas: paginas };
}

test('REGIONES_FICHA cubre matricula y los 3 km, con coordenadas validas 0-1', () => {
  const nombres = REGIONES_FICHA.map(function (r) { return r.nombre; });
  assert.deepStrictEqual(nombres, ['band_matricula', 'km_v1', 'km_v2', 'km_v3']);
  REGIONES_FICHA.forEach(function (r) {
    assert.ok(r.x0 >= 0 && r.x0 < r.x1 && r.x1 <= 1, r.nombre + ' x fuera de rango');
    assert.ok(r.y0 >= 0 && r.y0 < r.y1 && r.y1 <= 1, r.nombre + ' y fuera de rango');
    assert.strictEqual(r.pagina, undefined, 'sin pagina: la banda aplica a todas las paginas');
  });
});

test('concatPaginasConRegiones conserva imagen completa + regiones por pagina', () => {
  const paginas = concatPaginasConRegiones([respuestaRegiones(3)]);
  assert.strictEqual(paginas.length, 3);
  paginas.forEach(function (p) {
    assert.strictEqual(p.png_base64, PNG_1PX);
    assert.strictEqual(p.regiones.length, 4);
  });
});

test('B.1: cada pagina -> 1 item con la ficha completa PRIMERO y luego las bandas rotuladas', () => {
  const paginas = concatPaginasConRegiones([respuestaRegiones(3)]);
  const items = armarItemsFichaPorPaginaConBandas('gpt-4o-mini', paginas, '');
  assert.strictEqual(items.length, 3, 'un item (una llamada) por pagina: garantia del loop intacta');
  assert.deepStrictEqual(items.map(function (it) { return it.pagina; }), [1, 2, 3]);

  const content = items[0].payload.messages[1].content;
  // content[0] = user text; content[1] = "FICHA COMPLETA:"; content[2] = imagen pagina.
  assert.strictEqual(content[0].type, 'text');
  assert.strictEqual(content[1].text, 'FICHA COMPLETA:');
  assert.strictEqual(content[2].type, 'image_url');

  // Debe haber exactamente 1 pagina completa + 4 bandas = 5 imagenes.
  const imgs = content.filter(function (c) { return c.type === 'image_url'; });
  assert.strictEqual(imgs.length, 5, 'ficha completa + 4 bandas');

  // Los rotulos de banda estan presentes y en orden.
  const textos = content.filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; });
  assert.ok(textos.some(function (t) { return /RECORTE MATRICULA/.test(t); }));
  assert.ok(textos.some(function (t) { return t === 'RECORTE KM VIAJE 1:'; }));
  assert.ok(textos.some(function (t) { return t === 'RECORTE KM VIAJE 2:'; }));
  assert.ok(textos.some(function (t) { return t === 'RECORTE KM VIAJE 3:'; }));
});

test('B.1: una banda parece_vacio se OMITE (fallback a ficha completa), no se manda en blanco', () => {
  const paginas = concatPaginasConRegiones([respuestaRegiones(1, { km_v2: true })]);
  const content = armarItemsFichaPorPaginaConBandas('gpt-4o-mini', paginas, '')[0].payload.messages[1].content;

  const textos = content.filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; });
  assert.ok(!textos.includes('RECORTE KM VIAJE 2:'), 'la banda vacia no se rotula ni se manda');
  assert.ok(textos.includes('RECORTE KM VIAJE 1:') && textos.includes('RECORTE KM VIAJE 3:'));
  // Ficha completa + 3 bandas (se omitio km_v2) = 4 imagenes.
  const imgs = content.filter(function (c) { return c.type === 'image_url'; });
  assert.strictEqual(imgs.length, 4);
});

test('B.1: ninguna ficha se pierde aunque TODAS las bandas vengan vacias (queda la ficha completa)', () => {
  const vacios = { band_matricula: true, km_v1: true, km_v2: true, km_v3: true };
  const paginas = concatPaginasConRegiones([respuestaRegiones(3, vacios)]);
  const items = armarItemsFichaPorPaginaConBandas('gpt-4o-mini', paginas, '');
  assert.strictEqual(items.length, 3, 'sigue habiendo 3 llamadas: la ficha completa nunca falta');
  items.forEach(function (it) {
    const imgs = it.payload.messages[1].content.filter(function (c) { return c.type === 'image_url'; });
    assert.strictEqual(imgs.length, 1, 'solo la ficha completa cuando todas las bandas caen');
  });
});

test('el prompt de ficha explica los recortes ampliados adjuntos', () => {
  assert.match(PROMPT_FICHAS, /RECORTES AMPLIADOS ADJUNTOS/);
  assert.match(PROMPT_FICHAS, /RECORTE KM VIAJE 1\|2\|3/);
  assert.match(PROMPT_FICHAS, /el recorte ampliado no te autoriza a adivinar/);
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

test('los modelos del barrido cableados son gpt-5.6-sol (default), gpt-4o-mini y gpt-4o', () => {
  const wired = MODELOS_BARRIDO.filter(function (m) { return m.wired; }).map(function (m) { return m.id; });

  assert.deepStrictEqual(wired, ['gpt-5.6-sol', 'gpt-4o-mini', 'gpt-4o']);
});

test('swap GPT-5: gpt-5.6-sol arma payload de razonador (max_completion_tokens, sin temperature) y mismo esquema de salida', () => {
  const adj = adjuntosImagenesDesdePng([PNG_1PX]);
  const sol = armarPayloadFichas('gpt-5.6-sol', adj, '');
  const full = armarPayloadFichas('gpt-4o', adj, '');

  assert.strictEqual(sol.model, 'gpt-5.6-sol');
  assert.ok(sol.max_completion_tokens > 0, 'reasoner usa max_completion_tokens');
  assert.strictEqual(sol.max_tokens, undefined, 'reasoner NO manda max_tokens');
  assert.strictEqual(sol.temperature, undefined, 'reasoner NO manda temperature');
  // El esquema de salida y el contenido (prompt+imagen) no cambian con el modelo.
  assert.deepStrictEqual(sol.response_format, full.response_format);
  assert.deepStrictEqual(sol.messages, full.messages);
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

test('el prompt de ficha coincide byte a byte con el fixture esperado (v3.4)', () => {
  // Fixture deliberado: la instruccion es "esta imagen es UNA ficha" (v3.4,
  // loop por pagina). Guarda contra cambios accidentales del prompt.
  const esperado = fs.readFileSync(path.join(__dirname, 'fixtures', 'prompt-fichas-esperado.txt'), 'utf8');
  assert.strictEqual(PROMPT_FICHAS, esperado, 'el prompt de ficha cambio sin actualizar el fixture');
});

test('el prompt de documentos no cambio', () => {
  const esperado = fs.readFileSync(path.join(__dirname, 'fixtures', 'prompt-docs-esperado.txt'), 'utf8');
  assert.strictEqual(PROMPT_DOCS, esperado, 'el prompt de documentos no debe cambiar');
});

test('el prompt de ficha refleja "una ficha por imagen", no "por pagina del PDF"', () => {
  assert.match(PROMPT_FICHAS, /ESTA IMAGEN ES UNA SOLA FICHA/);
  assert.match(PROMPT_FICHAS, /hojas\[\] debe tener EXACTAMENTE UNA entrada/);
  assert.doesNotMatch(PROMPT_FICHAS, /El PDF puede contener VARIAS fichas/);
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
