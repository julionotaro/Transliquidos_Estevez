// Genera el script del nodo Code "Auditar" concatenando la logica (auditar.js)
// con el envoltorio de n8n (nodo-auditar.wrapper.js).
//
// El nodo Code de n8n no puede importar archivos: necesita un script autocontenido.
// Generarlo desde una unica fuente evita que el repo y el workflow se separen
// silenciosamente (el error clasico: creer que un cambio esta aplicado y no lo esta).
//
//   node validador/build-nodo.js            -> escribe nodo-auditar.generated.js
//   node validador/build-nodo.js --check    -> falla si el generado esta desactualizado

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SALIDA = path.join(DIR, 'nodo-auditar.generated.js');

function construir() {
  const logica = fs.readFileSync(path.join(DIR, 'auditar.js'), 'utf8');
  const wrapper = fs.readFileSync(path.join(DIR, 'nodo-auditar.wrapper.js'), 'utf8');
  return [
    '// ARCHIVO GENERADO por validador/build-nodo.js — NO EDITAR A MANO.',
    '// Fuente: validador/auditar.js + validador/nodo-auditar.wrapper.js',
    '// Este es el contenido exacto del nodo Code "Auditar" (workflow IlIod0DlephaLmAV).',
    '',
    logica.trimEnd(),
    '',
    wrapper.trimEnd(),
    '',
  ].join('\n');
}

const generado = construir();

if (process.argv.includes('--check')) {
  const actual = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA, 'utf8') : '';
  if (actual !== generado) {
    console.error('nodo-auditar.generated.js esta desactualizado. Corre: node validador/build-nodo.js');
    process.exit(1);
  }
  console.log('nodo-auditar.generated.js al dia.');
} else {
  fs.writeFileSync(SALIDA, generado);
  console.log('Escrito ' + SALIDA + ' (' + generado.length + ' bytes)');
}

module.exports = { construir };
