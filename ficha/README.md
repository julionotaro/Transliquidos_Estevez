# Canal ficha — lectura sobre imagen 300 DPI + estado_lectura (v3.3)

Logica de los nodos Code del workflow n8n `[ESTEVEZ] Ingesta Viaje`
(`WD0q9Ic0oDvUoJwp`). Este directorio es la **fuente de verdad**: los nodos se
generan desde aqui con `npm run build`.

| Nodo n8n | Se genera desde |
|---|---|
| `Preparar Rasterizacion` | `nodo-preparar-rasterizacion.wrapper.js` |
| `Preparar Payload` | `payload.js` + `nodo-preparar-payload.wrapper.js` |
| `Formatear Linea Gesruta` | `correlacionar.js` + `nodo-formatear.wrapper.js` |

---

## v3.3 — La ficha se lee sobre imagen, no sobre PDF-archivo

El bug de fondo. El test controlado del 26/07 probo que el manuscrito se lee bien
como **imagen rasterizada a 300 DPI** y mal como PDF-archivo (`type:'file'`).
Hasta v3.2 la pasada de ficha mandaba el PDF como archivo; por eso kg, km, fecha
y matricula salian null o inventados.

### Topologia nueva

```
Hook Viaje ─┬─ Preparar Archivado → ... (rama de archivado, sin cambios)
            └─ Preparar Rasterizacion → Rasterizar Ficha → Preparar Payload → Extraer GPT-4o
```

- **`Preparar Rasterizacion`** abre el item del webhook (que trae N binarios bajo
  `data0`, `data1`...) en un item por PDF, con el binario bajo la clave `data`.
  Hace falta porque el HTTP node manda un multipart por item.
- **`Rasterizar Ficha`** (HTTP node) llama a
  `POST http://rasterizador:8000/rasterizar?dpi=300` con el PDF en el campo
  multipart `file`, y devuelve `{dpi, num_paginas, paginas[].png_base64}`.
- **`Preparar Payload`** concatena las paginas de todas las respuestas y las
  manda como `image_url` con `detail:'high'`.

Una entrada de imagen por pagina: las paginas **no se fusionan**. El prompt ya
resuelve el resto (una entrada en `hojas[]` por ficha, ignorar paginas impresas).

### Por que un HTTP node y no `httpRequest` dentro del Code node

Probado contra el servicio real: dentro de un Code node de n8n **no hay forma de
mandar multipart**. `this.helpers.httpRequest` con `formData` devuelve 422 sin
llegar a la red, `require('form-data')` esta bloqueado (`Module 'form-data' is
disallowed`) y el multipart armado a mano tambien da 422. El HTTP Request node
nativo con `parameterType: 'formBinaryData'` funciona a la primera (verificado:
200, `num_paginas: 1`, PNG valido). Si alguien intenta "simplificar" metiendo la
llamada dentro del Code node, va a chocar con esto.

### De donde sale el base64 de la pasada de documentos

**No** de `Preparar Payload`: lo lee `Preparar Rasterizacion` y viaja en
`archivos`. Es obligatorio que sea asi.

`this.helpers.getBinaryDataBuffer(itemIndex, key)` resuelve contra la entrada
del nodo **actual**. Cuando `Preparar Payload` paso a recibir la respuesta JSON
del rasterizador, dejo de tener binarios en su entrada y esa llamada empezo a
fallar. El problema no es que falle: es el fallback. Leer
`binary[key].data` desde otro nodo devuelve, con el modo de almacenamiento
**filesystem**, la cadena literal `"filesystem-v2"` — no el contenido.
`Buffer.from('filesystem-v2','base64')` da 9 bytes de basura **sin lanzar
error**, asi que la pasada de documentos habria mandado un PDF corrupto a gpt-4o
y nadie se habria enterado.

Verificado en esta instancia (ejec. 550): `b.data === 'filesystem-v2'`,
`largo 13`, decodificado `"~)^+-zo"`, `correcto: false`. Y `helpers.binaryToBuffer`
no existe en el Code node. Por eso el binario se lee **solo** donde esta
realmente disponible: en `Preparar Rasterizacion`, que cuelga directo de
`Hook Viaje`.

### Fallar seguro

- Si el rasterizador no devuelve ninguna pagina, `Preparar Payload` **aborta**.
  No cae de vuelta a `type:'file'`: ese camino es justamente el que no funciona,
  y degradar en silencio daria lecturas malas con cara de buenas.
- Si no llega ningun PDF, `Preparar Rasterizacion` **aborta** con un mensaje
  claro en vez de dejar la rama muerta en silencio (D-11: el escaner solo saca
  PDF). **Ojo:** esto es un cambio de comportamiento — antes un envio con solo
  imagenes igual iba al modelo. Si la oficina sube fotos sueltas, hay que
  revisarlo.

### La pasada de documentos no cambia

Sigue con `MODELO_DOCS = 'gpt-4o'` y el PDF como `type:'file'`. Funciona.

---

## Arnes de barrido de modelos

`MODELO_FICHAS` vive en el wrapper de `Preparar Payload`. Hay dos formas de
cambiarlo:

1. **Por corrida, sin tocar nada**: mandar `modelo_fichas` en el body del
   webhook. Es lo que usa el barrido.
2. **Por defecto**: editar `MODELO_FICHAS` en
   `nodo-preparar-payload.wrapper.js`, `npm run build`, y redesplegar el nodo.

| Modelo | Proveedor | Cableado |
|---|---|---|
| `gpt-4o-mini` | OpenAI | si |
| `gemini-flash` | Google | **no** — falta credencial |
| `gpt-4o` | OpenAI | si |

Un modelo no cableado **falla con mensaje explicito**; nunca arma un payload de
OpenAI con nombre de otro proveedor.

### Activar el slot Gemini

Cuando exista la credencial de Google AI Studio:

1. Cargar la credencial en n8n.
2. Agregar un HTTP node contra
   `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent`.
   Gemini no acepta el esquema de OpenAI: las imagenes van como
   `contents[].parts[].inline_data = {mime_type:'image/png', data:<b64>}`.
3. Escribir `armarPayloadGemini()` en `payload.js` y quitar el `throw` de
   `armarPayloadFichas()`.
4. Marcar `wired: true` en `MODELOS_BARRIDO`.

La forma de los datos ya esta: `concatPaginasRasterizadas()` devuelve los PNG en
base64, que es lo que Gemini necesita.

---

## Que hace

Toma las dos pasadas del modelo sobre el mismo PDF —fichas manuscritas (A) y
documentos impresos (B)—, correlaciona documento contra viaje por matricula +
ventana de fechas + peso, aplica las guardas anti-fabricacion y arma el informe
mas el `datos_json` que consumen los nodos de persistencia.

## v3.2 — estado_lectura por fila

**Nada de la correlacion ni de las guardas.** Lo unico que cambia es que las
guardas ahora marcan **la fila**, no solo el texto global.

### El defecto que corrige

En v3.1 las guardas empujaban su hallazgo a un blob de texto (`errores`/`avisos`)
y `Preparar Filas Viajes` persistia la fila igual, con `estado: 'pendiente'`. Un
viaje al que la guarda del multiplo de 500 le habia **anulado los odometros**
entraba a la tabla `Viajes` indistinguible de uno bien leido. La guarda disparaba
y el dato malo quedaba con cara de dato bueno.

Es el mismo principio que el validador de facturas: **un dato no confiable jamas
puede parecerse a uno verificado.**

### Campos nuevos (aditivos)

| Campo | Que es |
|---|---|
| `estado_lectura` | `OK` \| `REVISAR` |
| `motivo_revision` | por que quedo en REVISAR, motivos concatenados con `; ` |
| `pagina_origen` | pagina del PDF de la que salio el viaje (trazabilidad) |

Los tres se persisten en la tabla `Viajes` (`lrBxWpTUxMtO8U48`).

### Que marca REVISAR

Todas las guardas que ya existian, ahora atribuidas a su fila:

| Guarda | Efecto sobre el dato |
|---|---|
| Ano fuera de rango (+/-1 del actual) | anula `fecha_carga` y `fecha_descarga` |
| km cargados no positivos | anula `km_cargados` |
| GUARDA B: km cargados multiplo exacto de 500 | anula los cuatro campos de km |
| `\|(final - inicio) - km_recorridos\| > 5` | **no corrige el numero**, solo marca |
| GUARDA C: odometros identicos en toda la hoja | anula km de todos sus viajes |
| Sin fecha utilizable | — |
| km vacios negativos | — |
| Peso ficha vs documento > 200 kg | — |

**Deliberadamente NO marcan REVISAR**, porque no son calidad de lectura:

- *Sin documentacion*: eje distinto, ya cubierto por `estado = 'sin_documentacion'`.
- *Documento ambiguo entre varios viajes*: es correlacion, no lectura. Le
  corresponde al encargo 3.

`estado_lectura` habla de **cuanto se puede confiar en lo que se leyo de la
ficha**, y de nada mas.

## Fallar seguro

`num()` devuelve `null` para `0`: el marcador `0` que el modelo copiaba del
esquema nunca entra como dato (ESTADO §4, error 2). Un `kg` que no se leyo queda
`null`, jamas `0` ni inventado.

## Archivos

| Archivo | Que es |
|---|---|
| `payload.js` | Armado de payloads + prompts + registro de modelos del barrido. |
| `correlacionar.js` | Correlacion ficha<->documento y guardas de lectura. |
| `nodo-preparar-rasterizacion.wrapper.js` | Envoltorio: abre el item del webhook en uno por PDF. |
| `nodo-preparar-payload.wrapper.js` | Envoltorio: `MODELO_FICHAS`, lee las paginas rasterizadas. |
| `nodo-formatear.wrapper.js` | Envoltorio: lee `$input.all()`, delega en `procesar()`. |
| `build-nodo.js` | Genera los tres `*.generated.js`. |
| `*.generated.js` | **Generados. No editar a mano.** Contenido exacto de cada nodo. |
| `tests/payload.test.js` | Imagen vs file, multipagina, conmutacion de modelo. |
| `tests/correlacionar.test.js` | Regresion + blindaje de `estado_lectura`. |
| `tests/fixtures/formatear-v3.1-original.js` | Patron de oro de la regresion del correlacionador. |
| `tests/fixtures/preparar-payload-v3.2-original.js` | Patron de oro de los prompts. |

## Uso

```bash
cd ficha
npm test        # node --test tests/*.test.js
npm run build   # regenera nodo-formatear.generated.js
npm run check   # falla si el generado quedo desactualizado
```

Sin dependencias: Node (probado en v22) y su test runner.

## Como se prueba que no se rompio nada

`tests/fixtures/formatear-v3.1-original.js` es el fuente literal del nodo antes
del cambio. El test lo ejecuta con un shim de `$input` y compara, sobre 8
escenarios, que v3.2 produce:

1. el mismo informe caracter a caracter, una vez quitadas las lineas nuevas;
2. los mismos arrays `errores` y `avisos`;
3. los mismos campos de viaje, quitando los tres aditivos.

Si alguien toca la correlacion o una guarda sin querer, esos 24 tests fallan.

## Estado de despliegue

v3.3 aplicado y publicado el 27/07/2026 (version activa
`d6159aad-8eb9-4305-91d1-123adf8b7ac9`). Los tres nodos Code desplegados se
verificaron **byte a byte** contra sus `*.generated.js`.

El fix de la corrupcion silenciosa del binario se verifico replicando la
topologia real en un workflow-sonda (ejec. 551): el PDF llega **intacto** a la
pasada de documentos (`b64_len: 40` para 28 bytes, decodificado identico al
original).

Alcanzabilidad del rasterizador desde n8n verificada con un workflow-sonda
temporal (despues archivado): `GET /health` -> `{"status":"ok"}`, y
`POST /rasterizar?dpi=300` con un PDF real -> `200`, `num_paginas: 1`,
PNG valido de 1250x600. La sonda tambien es la evidencia de que `httpRequest`
dentro del Code node no sirve para multipart.

### Pendiente: fase PRUEBA

Todo lo que sigue necesita el PDF real de las 3 fichas y no se corrio:

1. Subir el PDF por `ingesta-viaje.html`.
2. Correr la pasada por `gpt-4o-mini` y por `gpt-4o` (`modelo_fichas` en el body).
3. Llenar `barrido-modelos.md` con viajes / ano / odometros / km / gastos / kg /
   matriculas por modelo.
4. Verificar que `Viajes` queda con kg/km/fecha/matricula correctos y que ningun
   digito dudoso entra sin `estado_lectura = REVISAR`.

**La eleccion del modelo la hace el operador con esa tabla.** `MODELO_FICHAS`
quedo en `gpt-4o-mini` como punto de partida del barrido (el mas barato), no como
ganador: nadie lo midio todavia.

## Lo que este cambio NO toca

- **El prompt de ficha**: intacto. Un test compara ambos prompts contra el
  fixture del nodo v3.2 y falla si alguien los toca.
- **La pasada de documentos**: intacta (`gpt-4o`, `type:'file'`).
- **Correlacion** ficha<->documento y tablero PENDIENTES: encargos 3 y 5.
- **Ingesta asincrona**: encargo 4. El canal ficha sigue sincrono, y ahora suma
  el tiempo de rasterizado (~0,7 s por PDF chico) al del modelo.
