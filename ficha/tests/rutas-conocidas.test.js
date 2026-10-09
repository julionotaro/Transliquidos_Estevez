// Tests — resolucion de punto restringida a las rutas conocidas del cliente.
//
// El caso que motiva el modulo es real (ejec. 1076): la guia de RNM trae impreso
// "Asturiana de Zinc S.A., Avda. de Galicia, 46002 Teruel" — direccion postal
// equivocada, la planta esta en Aviles. El catalogo global resolvia TERUEL sin
// pestañear. RNM nunca viajo a Teruel, y eso es lo que tiene que saltar.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { puntosConocidos, resolverPuntoDeCliente, casaEnConjunto } = require('../rutas-conocidas.js');

// Catalogo de puntos como lo entrega n8n.
const CATALOGO = [
  { id_punto: 'AVILE', nombre_canonico: 'AVILES' },
  { id_punto: 'FAMAL', nombre_canonico: 'VILANOVA FAMALICAO' },
  { id_punto: 'NAVIA', nombre_canonico: 'NAVIA' },
  { id_punto: 'TE', nombre_canonico: 'TERUEL' },
  { id_punto: '1', nombre_canonico: 'CALDAS DE REIS' },
  { id_punto: 'OR', nombre_canonico: 'OREMBER' },
];

const RUTAS = {
  clientes: {
    '661': {
      nombre: 'RNM PRODUTOS QUIMICOS, LDA', nif: 'PT500',
      rutas: [
        { nombre_origen: 'AVILES', nombre_destino: 'VILANOVA FAMALICAO',
          nombre_material: 'SOSA', n_viajes: 120 },
        { nombre_origen: 'AVILES', nombre_destino: 'NAVIA',
          nombre_material: 'SOSA', n_viajes: 40 },
      ],
    },
    '1': {
      nombre: 'FORESA IND.QUIMICAS DEL NOROESTE, S.A.', nif: 'A28141224',
      rutas: [
        { nombre_origen: 'CALDAS DE REIS', nombre_destino: 'OREMBER',
          nombre_material: 'COLA', n_viajes: 586 },
        { nombre_origen: 'CALDAS DE REIS', nombre_destino: 'TERUEL',
          nombre_material: 'COLA', n_viajes: 42 },
      ],
    },
  },
};

// ============================================================================
// El conjunto cerrado
// ============================================================================
test('los destinos conocidos salen por cliente y ordenados por frecuencia', () => {
  const d = puntosConocidos(RUTAS, 'RNM', 'destino');
  assert.deepStrictEqual(d.map(x => x.nombre), ['VILANOVA FAMALICAO', 'NAVIA']);
  assert.strictEqual(d[0].n_viajes, 120);
});

test('el nombre corto del documento encuentra la razon social larga', () => {
  // El JSON guarda "RNM PRODUTOS QUIMICOS, LDA"; el documento dice "RNM".
  assert.strictEqual(puntosConocidos(RUTAS, 'RNM', 'destino').length, 2);
  assert.strictEqual(puntosConocidos(RUTAS, 'FORESA', 'destino').length, 2);
});

test('se puede limitar a las rutas que salen de un origen dado', () => {
  const d = puntosConocidos(RUTAS, 'FORESA', 'destino', 'CALDAS DE REIS');
  assert.strictEqual(d.length, 2);
  assert.strictEqual(puntosConocidos(RUTAS, 'FORESA', 'destino', 'VILLAGARCIA').length, 0);
});

test('un cliente sin historia devuelve conjunto vacio, no explota', () => {
  assert.deepStrictEqual(puntosConocidos(RUTAS, 'CLIENTE NUEVO SL', 'destino'), []);
  assert.deepStrictEqual(puntosConocidos(null, 'RNM', 'destino'), []);
});

// ============================================================================
// EL CASO QUE MOTIVA EL MODULO — la guarda TERUEL
// ============================================================================
test('RNM hacia TERUEL: resuelve pero AVISA que ese cliente nunca fue', () => {
  const r = resolverPuntoDeCliente('TERUEL', { cliente: 'RNM', rol: 'destino' },
                                   CATALOGO, RUTAS);
  assert.strictEqual(r.id_punto, 'TE', 'no se rechaza: se marca (regla 1)');
  assert.strictEqual(r.ruta_conocida, false);
  assert.strictEqual(r.revisar, true);
  assert.match(r.aviso_ruta, /RNM nunca viajo a TERUEL/);
  assert.match(r.aviso_ruta, /VILANOVA FAMALICAO/, 'dice cuales son los habituales');
});

test('FORESA hacia TERUEL: la MISMA ruta no avisa, porque FORESA si va', () => {
  const r = resolverPuntoDeCliente('TERUEL', { cliente: 'FORESA', rol: 'destino' },
                                   CATALOGO, RUTAS);
  assert.strictEqual(r.ruta_conocida, true);
  assert.strictEqual(r.n_viajes_historicos, 42);
  assert.ok(!r.aviso_ruta);
});

test('una ruta conocida deja constancia de cuantos viajes la respaldan', () => {
  const r = resolverPuntoDeCliente('VILANOVA FAMALICAO', { cliente: 'RNM', rol: 'destino' },
                                   CATALOGO, RUTAS);
  assert.strictEqual(r.ruta_conocida, true);
  assert.match(r.motivo, /120 viajes/);
});

// ============================================================================
// REGLA 2 — dentro del conjunto cerrado se puede matchear mas flojo
// ============================================================================
test('CORROBORACION: una lectura debil que coincide con la historia deja de ser dudosa', () => {
  // resolverPunto resuelve "FAMALICAO" -> VILANOVA FAMALICAO por CONTENCION, y
  // contra 790 puntos eso es una apuesta: marca revisar. Pero RNM hizo esa ruta
  // 120 veces, asi que hay dos evidencias independientes apuntando al mismo
  // sitio: el texto y la historia.
  const sinCliente = resolverPuntoDeCliente('FAMALICAO', { rol: 'destino' }, CATALOGO, RUTAS);
  assert.strictEqual(sinCliente.metodo, 'contencion');
  assert.strictEqual(sinCliente.revisar, true, 'sin historia, es una apuesta');

  const conCliente = resolverPuntoDeCliente('FAMALICAO', { cliente: 'RNM', rol: 'destino' },
                                            CATALOGO, RUTAS);
  assert.strictEqual(conCliente.id_punto, 'FAMAL');
  assert.strictEqual(conCliente.revisar, false, 'corroborada por 120 viajes');
  assert.strictEqual(conCliente.corroborado_por_historico, true);
  assert.match(conCliente.motivo, /CORROBORADA/);
});

test('la corroboracion NO se aplica a un cliente que no hace esa ruta', () => {
  const r = resolverPuntoDeCliente('FAMALICAO', { cliente: 'FORESA', rol: 'destino' },
                                   CATALOGO, RUTAS);
  assert.strictEqual(r.revisar, true, 'FORESA no va a Famalicao: la duda se mantiene');
  assert.ok(!r.corroborado_por_historico);
});

test('solo se corrobora lo DEBIL: un revisar por otro motivo no se toca', () => {
  // Duplicado en catalogo: dos Cod.Pto. con el mismo nombre. resolverPunto se
  // niega a elegir, y la historia del cliente no dice nada sobre eso.
  const dup = CATALOGO.concat([{ id_punto: 'NAVI2', nombre_canonico: 'NAVIA' }]);
  const r = resolverPuntoDeCliente('NAVIA', { cliente: 'RNM', rol: 'destino' }, dup, RUTAS);
  assert.strictEqual(r.id_punto, null, 'un duplicado del catalogo lo decide Julio, no el historico');
  assert.ok(!r.corroborado_por_historico);
});

test('sin cliente no hay conjunto cerrado que aplicar', () => {
  const r = resolverPuntoDeCliente('FAMALICAO', { rol: 'destino' }, CATALOGO, RUTAS);
  assert.strictEqual(r.ruta_conocida, null);
});

test('casaEnConjunto matchea por contencion en los dos sentidos', () => {
  assert.ok(casaEnConjunto('FAMALICAO', 'VILANOVA FAMALICAO'));
  assert.ok(casaEnConjunto('VILANOVA FAMALICAO DE VERDAD', 'VILANOVA FAMALICAO'));
  assert.ok(!casaEnConjunto('NAVIA', 'VILANOVA FAMALICAO'));
  assert.ok(!casaEnConjunto('', 'NAVIA'));
});

// ============================================================================
// REGLA 3 — empate no se rompe con la frecuencia
// ============================================================================
test('si el literal encaja con DOS rutas conocidas, no se elige ninguna', () => {
  const rutas = {
    clientes: {
      '9': {
        nombre: 'CLIENTE AMBIGUO SL',
        rutas: [
          { nombre_origen: 'A', nombre_destino: 'SAN MARTIN NORTE', n_viajes: 900 },
          { nombre_origen: 'A', nombre_destino: 'SAN MARTIN', n_viajes: 3 },
        ],
      },
    },
  };
  const cat = [{ id_punto: 'SMN', nombre_canonico: 'SAN MARTIN NORTE' },
               { id_punto: 'SM', nombre_canonico: 'SAN MARTIN' }];
  const r = resolverPuntoDeCliente('SAN MARTIN', { cliente: 'CLIENTE AMBIGUO SL', rol: 'destino' },
                                   cat, rutas);
  // El literal es exactamente un canonico, asi que el catalogo lo resuelve; lo
  // que importa es que la frecuencia (900 vs 3) NO arrastre la decision.
  assert.notStrictEqual(r.id_punto, 'SMN', 'la frecuencia no puede ganarle al literal exacto');
});

test('empate real dentro del cerrado: devuelve los candidatos y no decide', () => {
  const rutas = {
    clientes: {
      '9': {
        nombre: 'CLIENTE AMBIGUO SL',
        rutas: [
          { nombre_origen: 'A', nombre_destino: 'MIRANDA DE EBRO', n_viajes: 900 },
          { nombre_origen: 'A', nombre_destino: 'MIRANDA DE AZAN', n_viajes: 3 },
        ],
      },
    },
  };
  const cat = [{ id_punto: 'MEB', nombre_canonico: 'MIRANDA DE EBRO' },
               { id_punto: 'MAZ', nombre_canonico: 'MIRANDA DE AZAN' }];
  const r = resolverPuntoDeCliente('MIRANDA', { cliente: 'CLIENTE AMBIGUO SL', rol: 'destino' },
                                   cat, rutas);
  assert.strictEqual(r.id_punto, null, 'no se elige con 900 vs 3: decide un humano');
  assert.strictEqual(r.candidatos.length, 2);
  assert.match(r.motivo, /decide un humano/);
});

// ============================================================================
// Robustez
// ============================================================================
test('sin rutas cargadas se comporta como el resolvedor de siempre', () => {
  const r = resolverPuntoDeCliente('AVILES', { cliente: 'RNM', rol: 'destino' }, CATALOGO, null);
  assert.strictEqual(r.id_punto, 'AVILE');
  assert.strictEqual(r.ruta_conocida, null);
});

test('el rol origen usa los origenes, no los destinos', () => {
  const o = puntosConocidos(RUTAS, 'RNM', 'origen');
  assert.deepStrictEqual(o.map(x => x.nombre), ['AVILES']);
  const r = resolverPuntoDeCliente('NAVIA', { cliente: 'RNM', rol: 'origen' }, CATALOGO, RUTAS);
  assert.strictEqual(r.ruta_conocida, false, 'RNM nunca CARGO en Navia, aunque entregue ahi');
  assert.match(r.aviso_ruta, /nunca cargo en/);
});
