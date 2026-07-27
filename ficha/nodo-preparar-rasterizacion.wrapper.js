// Nodo Code "Preparar Rasterizacion" del workflow [ESTEVEZ] Ingesta Viaje.
//
// El webhook llega con N binarios en UN item (data0, data1, ...). El HTTP node
// "Rasterizar Ficha" manda un multipart por item, asi que hay que abrir el item
// en uno por PDF, con el binario siempre bajo la clave `data` (que es lo que
// apunta inputDataFieldName).
//
// Solo PDFs: una imagen suelta ya sirve como entrada al modelo y no necesita
// rasterizarse. Si no hay ningun PDF se devuelve [] y toda la rama de
// rasterizado se saltea; el wrapper de Preparar Payload aborta con un mensaje
// claro en vez de degradar a type:file en silencio.

const item = $input.first();
const bins = item.binary || {};
const keys = Object.keys(bins);
if (keys.length === 0) { throw new Error('No se recibieron archivos'); }

const out = [];
for (const key of keys) {
  const b = bins[key];
  const mime = (b.mimeType || '').toLowerCase();
  if (mime !== 'application/pdf') { continue; }
  out.push({
    json: { origen_key: key, nombre: b.fileName || (key + '.pdf') },
    binary: { data: b }
  });
}
return out;
