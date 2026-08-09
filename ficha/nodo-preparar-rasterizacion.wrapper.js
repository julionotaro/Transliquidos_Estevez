// Nodo Code "Preparar Rasterizacion" del workflow [ESTEVEZ] Ingesta Viaje.
//
// Dos trabajos, los dos porque este nodo esta cableado DIRECTO a Hook Viaje y
// por lo tanto tiene los binarios en su propia entrada:
//
// 1. Abre el item del webhook (que trae N binarios bajo data0, data1...) en un
//    item por PDF, con el binario bajo la clave `data`. Hace falta porque el
//    HTTP node "Rasterizar Ficha" manda un multipart por item.
//
// 2. Lee el base64 de TODOS los adjuntos y lo deja en `archivos` para que la
//    pasada de documentos lo use. Esto tiene que pasar aca: `getBinaryDataBuffer`
//    resuelve contra la entrada del nodo ACTUAL, asi que un nodo mas abajo (con
//    la respuesta del rasterizador como entrada) ya no puede leerlos.
//
//    Y no alcanza con leer `binary[key].data` desde otro nodo: con el modo de
//    almacenamiento filesystem ese campo trae la cadena literal "filesystem-v2",
//    no el contenido. Decodificarla da 9 bytes de basura SIN lanzar error —
//    corrupcion silenciosa. Verificado en esta instancia (ejec. 550).

const item = $input.first();
const bins = item.binary || {};
const keys = Object.keys(bins);
if (keys.length === 0) { throw new Error('No se recibieron archivos'); }

// Base64 de todos los adjuntos, para la pasada de documentos.
const archivos = [];
for (const key of keys) {
  const b = bins[key];
  const buf = await this.helpers.getBinaryDataBuffer(0, key);
  if (!buf || buf.length === 0) { throw new Error('El binario ' + key + ' llego vacio.'); }
  archivos.push({
    nombre: b.fileName || (key + '.pdf'),
    mime: (b.mimeType || '').toLowerCase(),
    b64: buf.toString('base64')
  });
}

// Un item por PDF para el rasterizador.
const out = [];
for (const key of keys) {
  const b = bins[key];
  if ((b.mimeType || '').toLowerCase() !== 'application/pdf') { continue; }
  out.push({
    json: { origen_key: key, nombre: b.fileName || (key + '.pdf'), archivos: archivos },
    binary: { data: b }
  });
}

if (out.length === 0) {
  // Sin PDF no hay nada que rasterizar, y la ficha NO se puede leer de otra
  // forma con calidad (test del 26/07). Se corta explicito en vez de dejar la
  // rama muerta en silencio. D-11: el escaner solo saca PDF.
  throw new Error('No llego ningun PDF. La ficha tiene que entrar como PDF para poder rasterizarse a 300 DPI; sin eso la lectura del manuscrito no es confiable.');
}
return out;
