// Toma el JSON crudo de scripts/parsear-excel.py, corre procesarTarifasExcel()
// (logica testeada en carga-tarifas.js) y escribe:
//   - filas-finales.json   -- filas listas para insertar en la tabla Tarifas
//   - reporte.json         -- conteos, conflictos y avisos para revisar
//
// No toca n8n: eso lo hace el agente por fuera, con las filas de salida de
// este script (delete de la tabla vieja + add_data_table_rows).
//
// Uso: node cargar.js <filas-crudas.json> <dir_salida>

'use strict';

const fs = require('fs');
const path = require('path');
const { procesarTarifasExcel } = require('../carga-tarifas.js');

const [, , rutaCrudas, dirSalida] = process.argv;
if (!rutaCrudas || !dirSalida) {
  console.error('uso: node cargar.js <filas-crudas.json> <dir_salida>');
  process.exit(1);
}

const crudas = JSON.parse(fs.readFileSync(rutaCrudas, 'utf8'));
const resultado = procesarTarifasExcel(crudas);

fs.mkdirSync(dirSalida, { recursive: true });
fs.writeFileSync(path.join(dirSalida, 'filas-finales.json'), JSON.stringify(resultado.filas, null, 2));
fs.writeFileSync(path.join(dirSalida, 'reporte.json'), JSON.stringify({
  filas_crudas: crudas.length,
  filas_mapeadas: crudas.length - resultado.excluidas,
  filas_excluidas: resultado.excluidas,
  filas_finales_tras_dedup: resultado.filas.length,
  conflictos: resultado.conflictos,
  avisos: resultado.avisos
}, null, 2));

console.log('filas crudas:', crudas.length);
console.log('excluidas (U.M. desconocida):', resultado.excluidas);
console.log('finales tras dedup:', resultado.filas.length);
console.log('conflictos de precio/columna:', resultado.conflictos.length);
console.log('avisos (KILOMETROS/LITROS + excluidas):', resultado.avisos.length);
