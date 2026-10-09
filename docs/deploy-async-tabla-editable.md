# Deploy — async 504 + tabla editable + persistencia de correcciones

Instructivo para Julio. Encargo `async-tabla-editable` (rama
`claude/async-tabla-editable`, sale de `claude/swap-modelo-gpt5`). Todo lo de
código va como `.generated.js` (copy-paste + Publish); lo que es config de n8n
(responseMode del webhook, mapeos de dataTable, grafo) va indicado paso a paso.
Suite 205/205 verde, build al día.

Son DOS workflows:

| Workflow | ID |
|---|---|
| [ESTEVEZ] Ingesta Viaje | `WD0q9Ic0oDvUoJwp` |
| [ESTEVEZ] Vista Pendientes | `C3eZ1RteNAZDdaCV` |

Base de los links raw:
`https://raw.githubusercontent.com/julionotaro/transliquidos_estevez/claude/async-tabla-editable/ficha/<archivo>`

---

## Paso 0 — tabla nueva `correcciones` (creala vos, MCP o UI)

Proyecto TLE `grgBpWySVCpXvuii`. Todas las columnas `string` (simple y
consultable; el timestamp va ISO como texto). Con MCP:

```
create_data_table(
  projectId = "grgBpWySVCpXvuii",
  name = "correcciones",
  columns = [
    { name: "viaje_id",        type: "string" },
    { name: "campo",           type: "string" },
    { name: "valor_original",  type: "string" },
    { name: "valor_corregido", type: "string" },
    { name: "motivo_original", type: "string" },
    { name: "editado_por",     type: "string" },
    { name: "editado_en",      type: "string" }
  ]
)
```

Anotá el `dataTableId` que devuelve — lo necesitás en el nodo "Insertar
Correccion" (Paso 3).

> `estado_carga` en `Viajes` ya la agregué yo por MCP y verifiqué por readback
> (columna `estado_carga`, string, id `owGf5kSwz9ATd6DJ`). No hay que crearla.

---

## Workflow A — [ESTEVEZ] Ingesta Viaje (`WD0q9Ic0oDvUoJwp`)

### A.1 · Webhook asíncrono (CAMBIO 1) — config del nodo, no archivo

1. Nodo **`Hook Viaje`**: cambiá **Respond** de "Using 'Respond to Webhook'
   node" a **"Immediately"** (responseMode `onReceived`: responde apenas recibe,
   antes de procesar). Dejá **Allowed Origins** en `*` (mantiene el CORS).
2. Acuse (opcional pero recomendado): en las opciones del webhook seteá
   **Response Data** al JSON:
   `{"ok":true,"recibido":true,"mensaje":"Viaje recibido. Procesando; aparecera en Pendientes en 2-3 minutos."}`
   y **Response Content-Type** `application/json` si el campo está disponible.
   *No es imprescindible:* el HTML tolera el body por defecto de n8n
   (`{"message":"Workflow was started"}`) — al no venir `ok:false`, muestra el
   mensaje de acuse por defecto igual. Lo que NO debe pasar es que el webhook
   siga esperando el árbol (por eso el paso 1 es el importante).
3. Nodo **`Responder`** (respondToWebhook): **eliminalo**. No tiene conexiones
   de salida — nada consume su output (verificado). La línea Gesruta
   (`$json.linea`) NO se pierde: se sigue calculando y persistiendo por el árbol
   normal; solo deja de devolverse por HTTP.

### A.2 · `Preparar Filas Viajes` (CAMBIO 3 — estado_carga)

- Pegá `nodo-preparar-filas-viajes.generated.js` (link raw) en el nodo Code
  **`Preparar Filas Viajes`**. Emite `estado_carga: 'pendiente_revision'` por
  viaje nuevo.

### A.3 · `Guardar Viajes` (dataTable) — regla de oro

- En el nodo dataTable **`Guardar Viajes`**, agregá la columna **`estado_carga`**
  al mapeo (schema + value): value = `{{ $json.estado_carga }}`. Sin esto la
  columna queda `null` en silencio (es el bug histórico de `estado_lectura`).

### A.4 · Publish workflow A.

---

## Workflow B — [ESTEVEZ] Vista Pendientes (`C3eZ1RteNAZDdaCV`)

### B.1 · `Pendientes` (CAMBIO 2 — tabla editable)

- Pegá `nodo-vista-pendientes.generated.js` en el nodo Code **`Pendientes`**.
  Trae la tabla editable (columnas reales + dieta + "!" por forma + faltante
  prominente + botón Confirmar). Inlinea `validaciones-forma.js` + `pendientes.js`.

### B.2 · `Aplicar Accion` (CAMBIO 3 — verbos nuevos + correccion)

- Pegá `nodo-aplicar-accion.generated.js` en el nodo Code **`Aplicar Accion`**.
  Maneja `corregir` (cliente, revalida), `corregir_celda` (resto, sin revalidar),
  `confirmar` (estado_carga→confirmada), `resolver`, `incidencia`. Cuando hay
  corrección de celda, adjunta `_correccion` al item.

### B.3 · `Actualizar Viaje` (dataTable) — mapear columnas nuevas

- En el nodo dataTable **`Actualizar Viaje`** agregá al mapeo, si no están:
  - **`estado_carga`** = `{{ $json.estado_carga }}` (para que Confirmar persista).
  - **`historial_correcciones`** ya debería estar mapeado (acción v1.1). Si no,
    agregalo = `{{ $json.historial_correcciones }}`.
  - El campo `_correccion` NO es columna de Viajes → no lo mapees acá; va a la
    tabla `correcciones` (siguiente paso).

### B.4 · Rama de escritura a `correcciones` (grafo nuevo)

La correccion de celda escribe en DOS tablas: `Viajes` (el valor corregido) y
`correcciones` (preserva el original). Armá esta bifurcación desde `Aplicar
Accion`:

```
Aplicar Accion ──main──▶ Actualizar Viaje            (ya existe)
Aplicar Accion ──main──▶ IF "¿Hay correccion?"       (nodo nuevo)
                            └─ true ──▶ Insertar Correccion  (dataTable insert, nodo nuevo)
```

- **IF "¿Hay correccion?"**: condición verdadera cuando `{{ $json._correccion }}`
  existe / no está vacío (p. ej. *Object* → "is not empty", o
  `{{ !!$json._correccion }}` = true).
- **Insertar Correccion**: dataTable **Insert** sobre la tabla `correcciones`
  (el `dataTableId` del Paso 0). Mapeo:
  | columna | value |
  |---|---|
  | viaje_id | `{{ $json._correccion.viaje_id }}` |
  | campo | `{{ $json._correccion.campo }}` |
  | valor_original | `{{ $json._correccion.valor_original }}` |
  | valor_corregido | `{{ $json._correccion.valor_corregido }}` |
  | motivo_original | `{{ $json._correccion.motivo_original }}` |
  | editado_por | `{{ $json._correccion.editado_por }}` |
  | editado_en | `{{ $json._correccion.editado_en }}` |

  Las demás acciones (corregir cliente, resolver, incidencia, confirmar) NO traen
  `_correccion`, así que la rama IF no dispara y solo se toca `Viajes`.

### B.5 · Publish workflow B.

---

## Archivos a pegar (resumen)

| Workflow | Nodo (canvas) | Archivo `.generated.js` |
|---|---|---|
| Ingesta Viaje | `Preparar Filas Viajes` | `nodo-preparar-filas-viajes.generated.js` |
| Vista Pendientes | `Pendientes` | `nodo-vista-pendientes.generated.js` |
| Vista Pendientes | `Aplicar Accion` | `nodo-aplicar-accion.generated.js` |

(+ config de `Hook Viaje`, borrado de `Responder`, mapeos de `Guardar Viajes` /
`Actualizar Viaje`, tabla `correcciones` y grafo IF→Insertar Correccion.)

---

## Verificación post-deploy (Julio) — "se ve bien" no cuenta sin readback

1. **504 / async**: subí los 3 PDFs juntos (11 páginas). El navegador debe
   responder en **<2s** con "Viaje recibido…", sin 504. El viaje aparece en
   Pendientes 2-3 min después.
2. **Tabla editable**: en Pendientes, una celda con matrícula mal / fecha
   descarga < carga / cantidad 0 lleva **"!"**; un viaje `PENDIENTE_DOCUMENTACION`
   muestra **FALTA DOC** con qué falta y a quién.
3. **Corrección + persistencia** (readback de DOS tablas):
   - Editá un `origen` (ej. `Aveira`→`Aveiro`), confirmá.
   - Readback `Viajes`: `origen` = `Aveiro`.
   - Readback `correcciones`: hay una fila `campo=origen`,
     `valor_original=Aveira`, `valor_corregido=Aveiro`. El original queda
     recuperable.
4. **estado_carga**: tras "Confirmar viaje", readback `Viajes`:
   `estado_carga = confirmada`. Un viaje recién ingresado debe traer
   `estado_carga = pendiente_revision` (readback tras subir uno nuevo).
   `cargada_gesruta` no lo escribe nadie todavía (es la Pieza C).
5. **cliente**: corregir el cliente por la barra (verbo `corregir`) sigue
   revalidando régimen/país (no cambió); la celda cliente NO se edita por
   `corregir_celda`.
