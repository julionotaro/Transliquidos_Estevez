# Correlacionador de ficha — estado_lectura por fila (v3.2)

Logica del nodo Code `Formatear Linea Gesruta` del workflow n8n
`[ESTEVEZ] Ingesta Viaje` (`WD0q9Ic0oDvUoJwp`). Este directorio es la **fuente de
verdad**: el nodo se genera desde aqui.

## Que hace

Toma las dos pasadas del modelo sobre el mismo PDF —fichas manuscritas (A) y
documentos impresos (B)—, correlaciona documento contra viaje por matricula +
ventana de fechas + peso, aplica las guardas anti-fabricacion y arma el informe
mas el `datos_json` que consumen los nodos de persistencia.

## Que cambia en v3.2

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
| `correlacionar.js` | La logica. Unica fuente de verdad. |
| `nodo-formatear.wrapper.js` | Envoltorio de n8n (lee `$input.all()`, delega en `procesar()`). |
| `build-nodo.js` | Concatena los dos anteriores en el script del nodo Code. |
| `nodo-formatear.generated.js` | **Generado. No editar a mano.** Contenido exacto del nodo. |
| `tests/correlacionar.test.js` | Regresion + blindaje. |
| `tests/fixtures/formatear-v3.1-original.js` | Fuente del nodo ANTES del cambio. Es el patron de oro de la regresion. |

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

Aplicado y publicado el 26/07/2026 (version activa
`5453af47-5b68-4654-a4fc-97e1e31959a4`). El `jsCode` del nodo desplegado se
verifico **byte a byte** contra `nodo-formatear.generated.js` (mismo md5).
Se toco tambien `Preparar Filas Viajes` para persistir los tres campos nuevos.

**Pendiente de verificacion:** una corrida end-to-end con un PDF de ficha real.
No se pudo hacer desde aqui: los nodos Code se ejecutan siempre (el `pinData` no
los cubre), asi que `Preparar Payload` aborta sin binario, y forzar la corrida
completa habria escrito filas de prueba en las tablas de produccion. Hay que
subir un PDF real por `ingesta-viaje.html` y confirmar que las filas de `Viajes`
traen `estado_lectura`.

## Lo que este cambio NO toca

- **Rasterizacion.** `Preparar Payload` sigue mandando el PDF como `type:'file'`.
  Ese es el hueco real del encargo 2 y depende de que el servicio rasterizador
  (`estudio-ia/activos/rasterizador/`) este desplegado en el VPS.
- **Correlacion** ficha<->documento: encargo 3.
- **`MODELO_FICHAS`**: sigue en `gpt-5`, definido en `Preparar Payload`. El
  barrido de modelos no se corrio.
