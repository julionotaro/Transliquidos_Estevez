// Genera los scripts de los nodos Code del workflow [ESTEVEZ] Ingesta Viaje,
// concatenando la logica versionada con cada envoltorio de n8n.
//
// El nodo Code de n8n no puede importar archivos: necesita un script
// autocontenido. Generarlo desde una sola fuente evita que el repo y el workflow
// se separen en silencio (ESTADO-Y-TRASPASO §4).
//
//   node ficha/build-nodo.js            -> reescribe los *.generated.js
//   node ficha/build-nodo.js --check    -> falla si alguno esta desactualizado

const fs = require('fs');
const path = require('path');

const DIR = __dirname;

// logica: modulos a inlinear delante del wrapper (en orden). [] = wrapper solo.
const TARGETS = [
  {
    nodo: 'Formatear Linea Gesruta',
    logica: ['flota.js', 'cruce.js', 'modalidad-indexacion.js', 'correlacionar.js'],
    wrapper: 'nodo-formatear.wrapper.js',
    salida: 'nodo-formatear.generated.js',
  },
  {
    nodo: 'Preparar Payload',
    logica: ['payload.js'],
    wrapper: 'nodo-preparar-payload.wrapper.js',
    salida: 'nodo-preparar-payload.generated.js',
  },
  {
    nodo: 'Preparar Rasterizacion',
    logica: [],
    wrapper: 'nodo-preparar-rasterizacion.wrapper.js',
    salida: 'nodo-preparar-rasterizacion.generated.js',
  },
  {
    nodo: 'Preparar Filas Viajes',
    // resolver-punto.js + tarifa-contractual.js: buscan la tarifa pactada (tabla
    // Tarifas) resolviendo antes origen/destino a punto canonico. Van ANTES de
    // dedup.js; tarifa-contractual reusa resolverPunto/normalizar ya inlineados.
    logica: ['../catalogo/resolver-punto.js', '../catalogo/gesruta.js', 'tarifa-contractual.js', 'conductores.js', 'dedup.js'],
    wrapper: 'nodo-preparar-filas-viajes.wrapper.js',
    salida: 'nodo-preparar-filas-viajes.generated.js',
  },
  {
    nodo: 'Pendientes',
    logica: ['validaciones-forma.js', 'pendientes.js'],
    wrapper: 'nodo-vista-pendientes.wrapper.js',
    salida: 'nodo-vista-pendientes.generated.js',
    workflowId: '[ESTEVEZ] Vista Pendientes (C3eZ1RteNAZDdaCV)',
  },
  {
    nodo: 'Aplicar Accion',
    logica: ['cruce.js', 'acciones-pendientes.js'],
    wrapper: 'nodo-aplicar-accion.wrapper.js',
    salida: 'nodo-aplicar-accion.generated.js',
    workflowId: '[ESTEVEZ] Vista Pendientes (C3eZ1RteNAZDdaCV)',
  },
  {
    nodo: 'Planilla',
    logica: ['cruce.js', 'clientes.js', 'tarifas.js', 'indexacion.js', 'modalidad-indexacion.js', 'planilla.js'],
    wrapper: 'nodo-planilla.wrapper.js',
    salida: 'nodo-planilla.generated.js',
    workflowId: '[ESTEVEZ] Vista Pendientes (C3eZ1RteNAZDdaCV)',
  },
];

function construir(t) {
  const partes = [
    '// ARCHIVO GENERADO por ficha/build-nodo.js - NO EDITAR A MANO.',
    '// Fuente: ' + t.logica.concat([t.wrapper]).map(function (f) { return 'ficha/' + f; }).join(' + '),
    '// Contenido exacto del nodo Code "' + t.nodo + '" (' + (t.workflowId || 'WD0q9Ic0oDvUoJwp') + ').',
    '',
  ];
  for (const f of t.logica) {
    partes.push(fs.readFileSync(path.join(DIR, f), 'utf8').trimEnd());
    partes.push('');
  }
  partes.push(fs.readFileSync(path.join(DIR, t.wrapper), 'utf8').trimEnd());
  partes.push('');
  return partes.join('\n');
}

const check = process.argv.includes('--check');
let desactualizados = 0;

for (const t of TARGETS) {
  const generado = construir(t);
  const ruta = path.join(DIR, t.salida);
  if (check) {
    const actual = fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : '';
    if (actual !== generado) {
      console.error(t.salida + ' esta desactualizado.');
      desactualizados++;
    } else {
      console.log(t.salida + ' al dia.');
    }
  } else {
    fs.writeFileSync(ruta, generado);
    console.log('Escrito ' + t.salida + ' (' + generado.length + ' bytes)');
  }
}

if (check && desactualizados > 0) {
  console.error('\n' + desactualizados + ' archivo(s) desactualizado(s). Corre: node ficha/build-nodo.js');
  process.exit(1);
}

module.exports = { TARGETS: TARGETS, construir: construir };
