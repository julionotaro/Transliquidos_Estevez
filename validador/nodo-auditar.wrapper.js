// Envoltorio especifico de n8n para el nodo Code "Auditar" del workflow
// [ESTEVEZ] Auditar Factura (webhook) — IlIod0DlephaLmAV.
//
// Solo hace de puente: lee la salida de OpenAI + las data tables, llama a
// auditar()/renderInforme() de auditar.js y devuelve el item. Toda la logica
// vive en auditar.js. `node validador/build-nodo.js` pega auditar.js delante de
// este archivo y produce el script final del nodo.

const input = $input.first().json;

if (input && input.error) {
  logError('fallo antes de OpenAI: ' + input.error);
  return [{ json: { informe: 'FALLO ANTES DE OPENAI: ' + input.error, resumen: null, detalles: [], listo_para_pago: false } }];
}

const raw = input.choices && input.choices[0] && input.choices[0].message ? input.choices[0].message.content : null;
if (!raw) {
  logError('sin respuesta del modelo');
  return [{ json: { informe: 'ERROR: sin respuesta del modelo.', resumen: null, detalles: [], listo_para_pago: false } }];
}

let f;
try {
  f = JSON.parse(raw);
} catch (e) {
  logError('JSON invalido del modelo: ' + String(e));
  return [{ json: { informe: 'ERROR: JSON invalido.\n' + raw, resumen: null, detalles: [], listo_para_pago: false } }];
}

const res = auditar(f, input.indexacion, input.tarifas);

// Se devuelve el informe de texto (canal que ya consume auditar-factura.html)
// junto con el contrato JSON tri-valuado. El nodo Responder sigue sirviendo
// $json.informe; para pasar a JSON basta cambiar ese nodo.
return [{
  json: {
    informe: renderInforme(res),
    resumen: res.resumen,
    detalles: res.detalles,
    listo_para_pago: res.listo_para_pago,
    meta: res.meta,
  },
}];
