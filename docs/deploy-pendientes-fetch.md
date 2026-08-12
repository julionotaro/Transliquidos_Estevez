# Deploy — Pendientes: acciones por fetch (sin navegar)

Encargo `pendientes-fetch-acciones`. Dos capas del bug de la tabla A+B:
1. URL relativa → `DNS_PROBE_FINISHED_NXDOMAIN` (ya resuelto, encargo anterior).
2. `<form>` nativo + `Responder Accion` con **redirect** → el navegador abandona
   la página al guardar. **Este encargo.**

Workflow: **[ESTEVEZ] Vista Pendientes** (`C3eZ1RteNAZDdaCV`).

## CAMBIO 1 — `Responder Accion` responde JSON de status (no redirect)

Config del nodo `Responder Accion` (respondToWebhook). **Ya la dejé aplicada en
el DRAFT por MCP** — queda documentada acá para el registro:

- **Respond With:** `JSON` (antes: `Redirect` a `/webhook/viajes-pendientes`).
- **Response Body:** `={{ $('Aplicar Accion').first().json._status }}`
- **Options → Response Headers:** `Access-Control-Allow-Origin: *`
  (el content-type `application/json` lo pone `respondWith: json`).

El objeto `_status` lo arma el nodo Code `Aplicar Accion` (versionado en
`ficha/nodo-aplicar-accion.wrapper.js`) DESPUÉS de aplicar la acción, así refleja
el estado real que se persiste:
```
{ ok, viaje_id, accion, campo, valor, estado_carga, cliente, estado_lectura, motivo_revision }
```
`_status` no es columna de `Viajes`, así que `Actualizar Viaje` lo ignora (igual
que `_correccion`). La rama de escritura a `correcciones` y `estado_carga` no se
tocan.

## CAMBIO 2 — el nodo `Pendientes` envía por fetch (no navega)

Pegar el nodo Code `Pendientes` regenerado (rama `claude/pendientes-fetch-acciones`):
```
https://raw.githubusercontent.com/julionotaro/transliquidos_estevez/claude/pendientes-fetch-acciones/ficha/nodo-vista-pendientes.generated.js
```
Los `<form>` ya no tienen `action=`; un `<script>` intercepta el submit con
`preventDefault()`, postea por `fetch` (mismo body `application/x-www-form-urlencoded`
que esperaba el webhook), y al recibir `{ok:true,...}` actualiza la fila in-place
(quita el "!", refleja `estado_carga`/`cliente`, flash "guardado"). Ante error
(HTTP !ok / `ok:false` / red) marca la celda en rojo con el mensaje, sin navegar
ni perder lo tipeado. Sin localStorage/sessionStorage/clipboard/createObjectURL.

## Pasos de deploy (Julio)
1. `Aplicar Accion` (nodo Code) — pegar regenerado (trae `_status`):
   ```
   https://raw.githubusercontent.com/julionotaro/transliquidos_estevez/claude/pendientes-fetch-acciones/ficha/nodo-aplicar-accion.generated.js
   ```
2. `Pendientes` (nodo Code) — pegar regenerado (link de arriba).
3. `Responder Accion` — ya staged por MCP; confirmá en el nodo que dice
   Respond With **JSON** + el Response Body de arriba (si abriste el editor antes
   de mi cambio, refrescá).
4. **Publish** Vista Pendientes.

## Verificación (readback, no "se ve bien")
- Recarga dura (Ctrl+Shift+R) sobre `/webhook/viajes-pendientes`.
- Editar una celda (ej. corregir cliente de Baltransa a `BALTRANSA`), tilde:
  la página **NO** navega; la celda queda guardada in-place; readback de `viajes`
  con el valor; readback de `correcciones` con el original.
- Confirmar viaje (Foresa): no navega; `estado_carga = confirmada` (readback),
  reflejado en la fila.
- Provocar un error (valor inválido / desconexión): muestra error sin navegar ni
  perder lo tipeado.
