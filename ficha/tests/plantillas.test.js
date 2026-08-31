// Tests — plantillas por cliente puestas a trabajar.
//
// El caso que ordena todo: FORESA y BRESFOR emiten documentos casi identicos y
// su regla de referencia es la OPUESTA (Foresa el 2o numero de 7 digitos;
// Bresfor el 1o de 10). Si el codigo resolviera por "tipo de documento" en vez
// de por EMISOR, los confundiria siempre. Aca se fija que no pase.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const P = require('../plantillas.js');
const PLANTILLAS = require('../../catalogo/plantillas-cliente.json');

// ============================================================================
// Encontrar la plantilla: el documento dice el nombre corto
// ============================================================================
test('el nombre corto del documento encuentra la plantilla', () => {
  assert.strictEqual(P.plantillaDe('FORESA', PLANTILLAS).cliente, 'FORESA');
  assert.strictEqual(P.plantillaDe('BRESFOR', PLANTILLAS).cliente, 'BRESFOR');
  assert.strictEqual(P.plantillaDe('QUIMIDROGA', PLANTILLAS).cliente, 'QUIMIDROGA');
  assert.strictEqual(P.plantillaDe('RNM', PLANTILLAS).cliente, 'RNM');
});

test('la razon social larga tambien encuentra la plantilla', () => {
  const p = P.plantillaDe('FORESA IND.QUIMICAS DEL NOROESTE, S.A.', PLANTILLAS);
  assert.strictEqual(p.cliente, 'FORESA');
});

test('un cliente desconocido no devuelve una plantilla cualquiera', () => {
  assert.strictEqual(P.plantillaDe('CLIENTE QUE NO EXISTE SL', PLANTILLAS), null);
  assert.strictEqual(P.plantillaDe('', PLANTILLAS), null);
  assert.strictEqual(P.plantillaDe(null, PLANTILLAS), null);
});

// ============================================================================
// El prompt: decir DONDE mirar, y sobre todo que IGNORAR
// ============================================================================
test('el prompt de FORESA dice el ancla de la referencia y el numero trampa', () => {
  const s = P.promptDeCliente('FORESA', PLANTILLAS);
  assert.match(s, /CMR\/ALBARAN/);
  assert.match(s, /SEGUNDO numero/);
  assert.match(s, /2016400/, 'lleva ejemplos reales');
  assert.match(s, /NO CONFUNDIR/);
  assert.match(s, /Porteador/, 'avisa que el porteador somos nosotros');
});

test('el prompt de BRESFOR dice lo CONTRARIO que el de Foresa', () => {
  const s = P.promptDeCliente('BRESFOR', PLANTILLAS);
  assert.match(s, /PRIMER numero/);
  assert.match(s, /10 digitos/);
  assert.match(s, /5050139934/);
});

test('el prompt de RNM manda a la Guia Remessa, no al mail', () => {
  const s = P.promptDeCliente('RNM', PLANTILLAS);
  assert.match(s, /GUIA REMESSA/);
  assert.match(s, /0141163512/);
  assert.match(s, /asunto/i, 'avisa de la trampa del asunto del mail');
});

test('el prompt de QUIMIDROGA usa el ancla que declara el propio documento', () => {
  const s = P.promptDeCliente('QUIMIDROGA', PLANTILLAS);
  assert.match(s, /Referencia en factura/);
  assert.match(s, /Ref\. cliente|Su Referencia/, 'avisa del numero del comprador');
});

test('sin plantilla, el prompt es vacio y no inventa reglas', () => {
  assert.strictEqual(P.promptDeCliente('CLIENTE NUEVO SL', PLANTILLAS), '');
});

// ============================================================================
// LA GUARDA — lo que sostiene el resultado sin depender del modelo
// ============================================================================
test('FORESA: 7 digitos pasa, 10 digitos se rechaza', () => {
  assert.strictEqual(P.verificarReferencia('2016400', 'FORESA', PLANTILLAS).ok, true);

  const mal = P.verificarReferencia('5030294310', 'FORESA', PLANTILLAS);
  assert.strictEqual(mal.ok, false);
  assert.strictEqual(mal.revisar, true);
  assert.match(mal.motivo, /7 digitos/);
});

test('BRESFOR: la regla es la opuesta y la guarda lo respeta', () => {
  assert.strictEqual(P.verificarReferencia('5050139934', 'BRESFOR', PLANTILLAS).ok, true);

  const mal = P.verificarReferencia('2017609', 'BRESFOR', PLANTILLAS);
  assert.strictEqual(mal.ok, false);
  assert.match(mal.motivo, /10 digitos/);
});

test('el MISMO numero es valido para un emisor e invalido para el otro', () => {
  // Es la prueba de que la regla va por EMISOR y no por tipo de documento.
  assert.strictEqual(P.verificarReferencia('2017065', 'FORESA', PLANTILLAS).ok, true);
  assert.strictEqual(P.verificarReferencia('2017065', 'BRESFOR', PLANTILLAS).ok, false);
});

test('RNM: 10 digitos de la guia', () => {
  assert.strictEqual(P.verificarReferencia('0141163512', 'RNM', PLANTILLAS).ok, true);
  // El pedido de compra 31000xxxxx tiene 10 digitos tambien: el formato solo no
  // alcanza, por eso existe la comprobacion contra los otros numeros del doc.
  assert.strictEqual(P.verificarReferencia('3100082364', 'RNM', PLANTILLAS).ok, true);
});

test('EL CASO CARO: la referencia coincide con otro numero del documento', () => {
  // Un numero de pedido tiene formato de numero y pasa cualquier validacion de
  // forma. Solo se lo caza comparandolo con el resto de numeros leidos.
  const r = P.verificarReferencia('3100082364', 'RNM', PLANTILLAS,
    { pedido_compra: '3100082364', n_albaran: '0141163512' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.revisar, true);
  assert.match(r.motivo, /pedido_compra/);
  assert.match(r.motivo, /numero equivocado/);
});

test('si no choca con nada, la comprobacion cruzada no molesta', () => {
  const r = P.verificarReferencia('0141163512', 'RNM', PLANTILLAS,
    { pedido_compra: '3100082364', cantidad: '23880' });
  assert.strictEqual(r.ok, true);
});

test('referencia vacia se marca, no se deja pasar en silencio', () => {
  const r = P.verificarReferencia('', 'FORESA', PLANTILLAS);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.revisar, true);
});

test('sin plantilla no se inventa un veredicto: pasa, pero lo dice', () => {
  const r = P.verificarReferencia('123', 'CLIENTE NUEVO SL', PLANTILLAS);
  assert.strictEqual(r.ok, true);
  assert.match(r.motivo, /sin plantilla/);
});

test('la puntuacion no rompe la comprobacion de formato', () => {
  assert.strictEqual(P.verificarReferencia('2.016.400', 'FORESA', PLANTILLAS).ok, true);
});

// ============================================================================
// De donde sale cada campo: no buscar en el papel lo que manda la ficha
// ============================================================================
test('la FECHA DE CARGA manda la ficha en los cuatro clientes', () => {
  // R-01, reconfirmada por Julio el 31/08 para todos sin excepcion. Esta
  // impresa en todos los documentos y aun asi manda la ficha.
  for (const c of ['FORESA', 'BRESFOR', 'RNM', 'QUIMIDROGA']) {
    const f = P.fuenteDelCampo('fecha_carga', c, PLANTILLAS);
    assert.ok(f, 'falta el mapa de ' + c);
    assert.strictEqual(f.origen, 'ficha', c + ': la fecha de carga debe salir de la ficha');
  }
});

test('los codigos salen de Gesruta y los importes de un calculo', () => {
  assert.strictEqual(P.fuenteDelCampo('cod_cliente', 'FORESA', PLANTILLAS).origen, 'tabla_gesruta');
  assert.strictEqual(P.fuenteDelCampo('precio', 'FORESA', PLANTILLAS).origen, 'tabla_gesruta');
  assert.strictEqual(P.fuenteDelCampo('importe', 'FORESA', PLANTILLAS).origen, 'calculo');
  assert.strictEqual(P.fuenteDelCampo('indexacion', 'FORESA', PLANTILLAS).origen, 'calculo');
});

test('los km y los gastos salen de la ficha, no del documento', () => {
  assert.strictEqual(P.fuenteDelCampo('km_cargado', 'FORESA', PLANTILLAS).origen, 'ficha');
  assert.strictEqual(P.fuenteDelCampo('gastos', 'FORESA', PLANTILLAS).origen, 'ficha');
});

test('"reparto" sigue sin definir y el codigo lo dice', () => {
  const f = P.fuenteDelCampo('reparto', 'FORESA', PLANTILLAS);
  assert.strictEqual(f.origen, 'pendiente');
});

// ============================================================================
// Estado del catalogo: los cuatro clientes cerrados
// ============================================================================
test('los cuatro clientes principales estan CONFIRMADOS por Julio', () => {
  for (const c of ['FORESA', 'BRESFOR', 'RNM', 'QUIMIDROGA']) {
    const p = P.plantillaDe(c, PLANTILLAS);
    assert.strictEqual(p.estado, 'confirmado', c + ' deberia estar confirmado');
    assert.ok(p._confirmado_por, c + ' deberia decir quien lo confirmo');
  }
});

test('todo campo de toda plantilla tiene ancla: ninguno queda mudo', () => {
  for (const p of PLANTILLAS.plantillas) {
    for (const doc of p.documentos) {
      for (const [campo, v] of Object.entries(doc.campos)) {
        assert.ok(v && v.donde && v.donde.length > 10,
          p.cliente + '.' + campo + ' no tiene ancla');
      }
    }
  }
});
