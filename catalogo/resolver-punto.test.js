// Tests — resolvedor canonico de puntos (Encargo 2, modelo-dominio-lectura.md §9).

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { resolverPunto, resolverPuntoDocFicha, aprenderAlias, normalizar } = require('./resolver-punto.js');

// Catalogo minimo de prueba.
// - CALDAS-REIS: para exacto y contencion ("CALDAS" ⊂ "CALDAS DE REIS").
// - BRESFOR: alias BREDFOR (seed manual: mal escrito en catalogo-maestro.md).
// - RELISA: planta cargadora (para precedencia y conflicto).
// - SAN-JUAN + SAN-PEDRO: dos canonicos que comparten el token "SAN" (ambiguo).
const CAT = [
  { id_punto: 'CALDAS-REIS', nombre_canonico: 'CALDAS DE REIS', alias: '' },
  { id_punto: 'BRESFOR', nombre_canonico: 'BRESFOR', alias: 'BREDFOR' },
  { id_punto: 'RELISA', nombre_canonico: 'RELISA', alias: '' },
  { id_punto: 'SAN-JUAN', nombre_canonico: 'SAN JUAN DE NIEVA', alias: '' },
  { id_punto: 'SAN-PEDRO', nombre_canonico: 'SAN PEDRO', alias: '' },
];

test('exacto: "CALDAS DE REIS" -> resuelve con confianza alta, sin revisar', () => {
  const r = resolverPunto('CALDAS DE REIS', 'documento', CAT);
  assert.strictEqual(r.id_punto, 'CALDAS-REIS');
  assert.strictEqual(r.confianza, 'alta');
  assert.strictEqual(r.metodo, 'canonico');
  assert.strictEqual(r.revisar, false);
});

test('alias: "BREDFOR" -> BRESFOR (confianza alta)', () => {
  const r = resolverPunto('BREDFOR', 'documento', CAT);
  assert.strictEqual(r.id_punto, 'BRESFOR');
  assert.strictEqual(r.metodo, 'alias');
  assert.strictEqual(r.confianza, 'alta');
});

test('distancia 1: "CALDAS DE REIZ" -> resuelve con confianza MEDIA y revisar=true', () => {
  const r = resolverPunto('CALDAS DE REIZ', 'documento', CAT);
  assert.strictEqual(r.id_punto, 'CALDAS-REIS');
  assert.strictEqual(r.metodo, 'distancia');
  assert.strictEqual(r.confianza, 'media');
  assert.strictEqual(r.revisar, true);
});

test('contencion univoca: "CALDAS" -> CALDAS DE REIS, media, revisar=true', () => {
  const r = resolverPunto('CALDAS', 'documento', CAT);
  assert.strictEqual(r.id_punto, 'CALDAS-REIS');
  assert.strictEqual(r.metodo, 'contencion');
  assert.strictEqual(r.revisar, true);
});

test('contencion AMBIGUA: "SAN" matchea dos canonicos -> punto_no_reconocido, revisar', () => {
  const r = resolverPunto('SAN', 'documento', CAT);
  assert.strictEqual(r.id_punto, null);
  assert.strictEqual(r.metodo, 'punto_no_reconocido');
  assert.strictEqual(r.revisar, true);
});

test('sin match: "XXXXX" -> punto_no_reconocido y el motivo trae el literal TEXTUAL', () => {
  const r = resolverPunto('XXXXX', 'documento', CAT);
  assert.strictEqual(r.id_punto, null);
  assert.strictEqual(r.metodo, 'punto_no_reconocido');
  assert.match(r.motivo, /XXXXX/, 'el literal leido queda visible en el motivo');
});

test('ruido: "RELISA S.A. - POL. IND." -> RELISA (se descarta el ruido societario/poligono)', () => {
  assert.strictEqual(normalizar('RELISA S.A. - POL. IND.'), 'RELISA');
  const r = resolverPunto('RELISA S.A. - POL. IND.', 'documento', CAT);
  assert.strictEqual(r.id_punto, 'RELISA');
});

test('ruido: "Puerto de Aveiro" normaliza a "AVEIRO"', () => {
  assert.strictEqual(normalizar('Puerto de Aveiro'), 'AVEIRO');
});

test('precedencia doc>ficha: documento dice CALDAS, ficha dice RELISA -> gana el documento, motivo registra la correccion', () => {
  const r = resolverPuntoDocFicha('CALDAS DE REIS', 'RELISA', CAT);
  assert.strictEqual(r.id_punto, 'CALDAS-REIS', 'manda el documento');
  assert.strictEqual(r.revisar, true, 'discrepancia -> revisar');
  assert.match(r.motivo, /RELISA/, 'el motivo deja registrada la lectura de la ficha corregida');
});

test('precedencia: solo ficha -> resuelve pero con confianza reducida un escalon', () => {
  const r = resolverPuntoDocFicha(null, 'CALDAS DE REIS', CAT);
  assert.strictEqual(r.id_punto, 'CALDAS-REIS');
  assert.strictEqual(r.confianza, 'media', 'alta bajada un escalon por venir de ficha');
  assert.strictEqual(r.revisar, true);
});

test('conflicto de alias: "BREDFOR" ya es alias de BRESFOR -> NO se escribe como alias de RELISA, marca conflicto', () => {
  const r = aprenderAlias('BREDFOR', 'RELISA', CAT, { viaje_id: 99, fecha: '2026-08-14' });
  assert.strictEqual(r.escribir, false);
  assert.strictEqual(r.conflicto, true);
  assert.strictEqual(r.id_conflicto, 'BRESFOR');
});

test('duplicado en catalogo: mismo nombre con dos Cod.Pto. -> NO elige, punto_no_reconocido pendiente de Julio', () => {
  // Caso real (dato de Julio): GUADALAJARA existe como GU y GUADA, ambos en uso.
  // Desde el nombre no se puede saber cual -> no se resuelve solo.
  const catDup = [
    { id_punto: 'GU', nombre_canonico: 'GUADALAJARA', alias: '' },
    { id_punto: 'GUADA', nombre_canonico: 'GUADALAJARA', alias: '' },
  ];
  const r = resolverPunto('GUADALAJARA', 'documento', catDup);
  assert.strictEqual(r.id_punto, null, 'no elige uno de los dos codigos');
  assert.strictEqual(r.metodo, 'punto_no_reconocido');
  assert.match(r.motivo, /duplicado|GU|GUADA/);
});

test('aprender alias nuevo: literal no visto -> se escribe con procedencia', () => {
  const proc = { viaje_id: 7, campo: 'origen', fecha: '2026-08-14' };
  const r = aprenderAlias('CASA VERDE', 'RELISA', CAT, proc);
  assert.strictEqual(r.escribir, true);
  assert.strictEqual(r.conflicto, false);
  assert.strictEqual(r.id_punto, 'RELISA');
  assert.deepStrictEqual(r.procedencia, proc, 'guarda de que correccion salio (reversible)');
});

test('override oficina: "Anleo" -> NAVIA aunque exista el canonico ANLEO', () => {
  const cat = [
    { id_punto: 'ANLEO', nombre_canonico: 'ANLEO', alias: '' },
    { id_punto: 'NAVIA', nombre_canonico: 'NAVIA', alias: '' },
  ];
  const r = resolverPunto('Anleo', 'ficha', cat);
  assert.strictEqual(r.id_punto, 'NAVIA', 'gana el override, no el canonico ANLEO');
  assert.strictEqual(r.metodo, 'override');
  assert.strictEqual(r.confianza, 'alta');
  assert.strictEqual(r.revisar, false);
  assert.strictEqual(r.override, true);
  assert.match(r.motivo, /NAVIA/);
});

test('override sin destino en catalogo -> no reconocido (no inventa)', () => {
  const cat = [{ id_punto: 'ANLEO', nombre_canonico: 'ANLEO', alias: '' }];
  const r = resolverPunto('Anleo', 'documento', cat);
  assert.strictEqual(r.id_punto, null);
  assert.match(r.motivo, /override|NAVIA/);
});

test('CELLA -> TE (provincial), distinto de UTISA TERUEL (UTI)', () => {
  const cat = [
    { id_punto: 'TE', nombre_canonico: 'CELLA', alias: 'FINSA CELLA|CELLA TERUEL' },
    { id_punto: 'UTI', nombre_canonico: 'UTISA TERUEL', alias: '' },
  ];
  assert.strictEqual(resolverPunto('FINSA CELLA', 'ficha', cat).id_punto, 'TE');
  assert.strictEqual(resolverPunto('CELLA', 'documento', cat).id_punto, 'TE');
  assert.strictEqual(resolverPunto('UTISA TERUEL', 'documento', cat).id_punto, 'UTI');
});
