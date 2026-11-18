// ===== COMPARACION DE NOMBRES DE CHOFER (cabecera) ==========================
//
// Logica unica, compartida por validar_raw.js (cruce de cabecera) y armar_orden.js
// (resolucion de cabecera). Evita que las dos deriven. Dos preguntas distintas:
//
//   mismoApellido(a, b)  -> "¿PODRIAN ser el mismo chofer?" (comparten un APELLIDO,
//        tolerando 1 letra mal leida: GONZALES ~ GONZALEZ). Para VERIFICAR la lectura
//        contra el habitual de la tractora.
//   mismaPersona(a, b)   -> "¿es SEGURO el mismo chofer?" (todos los tokens del nombre
//        mas corto estan en el otro, exacto o edit<=1). Exige el nombre de pila:
//        MANUEL EIRIN != MARCOS EIRIN FERNANDEZ (comparten apellido, no son la misma
//        persona). Para saber si un nombre leido es un chofer CONOCIDO del padron.
'use strict';

function norm(s) {
  return String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function tokens(s) { return norm(s).split(' ').filter(function (t) { return t.length >= 3; }); }
// Apellidos = tokens significativos salvo el primero (nombre de pila). Uno solo -> ese.
function apellidos(s) { var t = tokens(s); return t.length > 1 ? t.slice(1) : t; }

function dist(a, b) { // Levenshtein
  var m = [], i, j;
  for (i = 0; i <= b.length; i++) { m[i] = [i]; }
  for (j = 0; j <= a.length; j++) { m[0][j] = j; }
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1));
    }
  }
  return m[b.length][a.length];
}
function cerca(x, y) { return x === y || (x.length >= 4 && y.length >= 4 && dist(x, y) <= 1); }

// Comparten un apellido (exacto o 1 letra mal leida). No alcanza compartir el nombre
// de pila: "JUAN L GONZALEZ" vs "JUAN L GIZ" -> apellidos GONZALEZ vs GIZ -> NO.
function mismoApellido(a, b) {
  var aa = apellidos(a), bb = apellidos(b), i, j;
  if (!aa.length || !bb.length) { return false; }
  for (i = 0; i < aa.length; i++) { for (j = 0; j < bb.length; j++) { if (cerca(aa[i], bb[j])) { return true; } } }
  return false;
}

// La MISMA persona: todos los tokens del nombre mas corto aparecen en el mas largo.
function mismaPersona(a, b) {
  var ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) { return false; }
  var corto = ta.length <= tb.length ? ta : tb, largo = ta.length <= tb.length ? tb : ta, i, j, hay;
  for (i = 0; i < corto.length; i++) {
    hay = false;
    for (j = 0; j < largo.length; j++) { if (cerca(corto[i], largo[j])) { hay = true; break; } }
    if (!hay) { return false; }
  }
  return true;
}

// ¿El nombre leido es un chofer CONOCIDO del padron? Devuelve las matriculas cuyo
// chofer ES esa misma persona (vacio si no es conocido).
function matriculasDeChofer(nombre, padron) {
  var out = [], m;
  for (m in padron) {
    if (Object.prototype.hasOwnProperty.call(padron, m) && padron[m].chofer && mismaPersona(nombre, padron[m].chofer)) { out.push(m); }
  }
  return out;
}
function esChoferConocido(nombre, padron) { return matriculasDeChofer(nombre, padron).length > 0; }

module.exports = {
  norm: norm, tokens: tokens, apellidos: apellidos, dist: dist,
  mismoApellido: mismoApellido, mismaPersona: mismaPersona,
  matriculasDeChofer: matriculasDeChofer, esChoferConocido: esChoferConocido,
};
