// Genera el script del nodo Code "Formatear Linea Gesruta" concatenando la
// logica (correlacionar.js) con el envoltorio de n8n.
//
//   node ficha/build-nodo.js            -> escribe nodo-formatear.generated.js
//   node ficha/build-nodo.js --check    -> falla si el generado esta desactualizado

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SALIDA = path.join(DIR, 'nodo-formatear.generated.js');

function construir() {
  const logica = fs.readFileSync(path.join(DIR, 'correlacionar.js'), 'utf8');
  const wrapper = fs.readFileSync(path.join(DIR, 'nodo-formatear.wrapper.js'), 'utf8');
  return [
    '// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.',
    '// Fuente: ficha/correlacionar.js + ficha/nodo-formatear.wrapper.js',
    '// Contenido exacto del nodo Code "Formatear Linea Gesruta" (WD0q9Ic0oDvUoJwp).',
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
    console.error('nodo-formatear.generated.js esta desactualizado. Corre: node ficha/build-nodo.js');
    process.exit(1);
  }
  console.log('nodo-formatear.generated.js al dia.');
} else {
  fs.writeFileSync(SALIDA, generado);
  console.log('Escrito ' + SALIDA + ' (' + generado.length + ' bytes)');
}

module.exports = { construir };
