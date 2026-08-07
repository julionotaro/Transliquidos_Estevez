# Deploy consolidado — 2026-08-07

Instructivo exacto para Julio. Reúne en **un solo pase** los cambios ya
implementados, testeados y pusheados que todavía NO están en producción. Cada
nodo Code se despliega **copy-paste del `.generated.js` → pegar en el nodo →
publish** (igual que el deploy de contaminación/OCR del 2026-08-04). El throttle
ya está aplicado en el draft y solo requiere publish.

Cubre 3 encargos: `swap-modelo-lectura-gpt5`, `throttle-ingesta`,
`deploy-consolidado-planilla`.

> **Regla de oro:** copiar el archivo `.generated.js` **entero** (es "ARCHIVO
> GENERADO — NO EDITAR A MANO"), reemplazar TODO el contenido del nodo Code, y
> recién ahí publicar. No editar a mano dentro de n8n.

---

## Son DOS workflows distintos

Los fixes tocan dos workflows separados. Cada uno se publica por su cuenta:

| Workflow | ID | Nodos a tocar |
|---|---|---|
| **[ESTEVEZ] Ingesta Viaje** | `WD0q9Ic0oDvUoJwp` | Formatear Linea Gesruta, Preparar Payload, Extraer GPT-4o (throttle) |
| **[ESTEVEZ] Vista Pendientes** | `C3eZ1RteNAZDdaCV` | Planilla |

Los nombres de nodo abajo son **exactamente** como se ven en el canvas de n8n
(ya verificado contra el workflow vivo — no hay traducción: el canvas muestra
estos nombres en español tal cual).

---

## Workflow A — [ESTEVEZ] Ingesta Viaje (`WD0q9Ic0oDvUoJwp`)

Los dos nodos Code de este workflow salen de **la misma rama**
`claude/swap-modelo-gpt5` (commit `c2aeb2e`), que ya contiene el fix de
contaminación/OCR *además* del swap de modelo — por eso un solo origen, cero
riesgo de mezclar versiones. Build al día, 174/174 tests verdes.

### A.1 — Nodo `Formatear Linea Gesruta`  (fix de contaminación viaje↔viaje + OCR)

- Qué trae: un documento ambiguo (multi-candidato sin resolver) ya NO presta
  material/origen/destino a otro viaje (`docs_ambiguos`), y el prompt de OCR
  separa origen=lugar de carga / destino=lugar de entrega.
- Archivo a pegar (raw):
  ```
  https://raw.githubusercontent.com/julionotaro/transliquidos_estevez/claude/swap-modelo-gpt5/ficha/nodo-formatear.generated.js
  ```

### A.2 — Nodo `Preparar Payload`  (swap de modelo de lectura a GPT-5 visión)

- Qué trae: el lector de FICHAS manuscritas pasa de `gpt-4o` a `gpt-5.6-sol`
  (visión). Los DOCS impresos siguen en `gpt-4o`. Se puede pisar por corrida con
  `modelo_fichas` en el body del webhook.
- Archivo a pegar (raw):
  ```
  https://raw.githubusercontent.com/julionotaro/transliquidos_estevez/claude/swap-modelo-gpt5/ficha/nodo-preparar-payload.generated.js
  ```

### A.3 — Nodo `Extraer GPT-4o`  (throttle / rate limit — YA en el draft)

- **No hay nada que pegar.** El throttle ya quedó aplicado en el DRAFT de este
  workflow: `batching` batchSize=3 / batchInterval=45000ms, y retry
  (retryOnFail, maxTries=5, waitBetweenTries=5000ms). Ver
  `docs/throttle-ingesta.md`.
- Solo confirmá en el nodo (pestaña Settings → Batching) que ves batchSize=3 /
  batchInterval=45000 antes de publicar. Si el tier de OpenAI ya subió, este es
  el momento de aflojarlo (subir batchSize / bajar batchInterval).

### A.4 — Publicar workflow A

Con A.1 y A.2 pegados y A.3 confirmado → **Publish** de `[ESTEVEZ] Ingesta
Viaje`. Recién al publicar, el swap + contaminación/OCR + throttle entran juntos
en producción.

---

## Workflow B — [ESTEVEZ] Vista Pendientes (`C3eZ1RteNAZDdaCV`)

### B.1 — Nodo `Planilla`  (identidad de tarifas + indexación por tipo + REVISAR §4.4)

Sale de la rama **`claude/recarga-indexacion`** (commit `439d321`), que arrastra
también el fix de identidad (salió de `claude/planilla-carga-auditoria`). Build
al día, 177/177 tests.

- Qué trae:
  1. **Identidad de tarifas** por razón social exacta (mapa código→razón social,
     match exacto, sin alias → REVISAR ruidoso).
  2. **Indexación por `tipo`** = categoría (tras la recarga de la tabla
     Indexacion; el consumidor ya no matchea por `cliente`).
  3. **REVISAR de bordes §4.4**: fecha no cubierta o solape con % distinto →
     REVISAR con motivo accionable (trae los pct candidatos y la fecha).
- Archivo a pegar (raw):
  ```
  https://raw.githubusercontent.com/julionotaro/transliquidos_estevez/claude/recarga-indexacion/ficha/nodo-planilla.generated.js
  ```

### B.2 — Publicar workflow B

Con `Planilla` pegado → **Publish** de `[ESTEVEZ] Vista Pendientes`.

> **Nota tabla Indexacion:** el fix de indexación por `tipo` asume que la tabla
> `Indexacion` ya está recargada con el esquema nuevo (`tipo`=categoría,
> `cliente`=""). Esa recarga ya se hizo (encargo `recarga-indexacion`,
> `docs/dominio-facturacion.md` §4). Si por lo que sea la tabla volviera al
> esquema viejo, la planilla nueva daría todo REVISAR de indexación — el orden
> correcto es tabla-recargada primero, código-nuevo después (ya cumplido).

---

## Orden recomendado (menos toques = menos riesgo)

1. **Workflow A** (Ingesta Viaje): pegar A.1 + A.2, confirmar A.3, **Publish**.
2. **Workflow B** (Vista Pendientes): pegar B.1, **Publish**.

Son independientes; el orden entre A y B no importa. Lo que importa es publicar
cada workflow una sola vez con todos sus nodos ya pegados.

---

## Verificación post-deploy (Julio + Code)

1. **Un viaje real por la ingesta** (workflow A vivo):
   - la planilla resuelve **tarifa** e **indexación** (no quedan en blanco ni
     todo REVISAR por el bug viejo de match por cliente);
   - un viaje con **fecha en borde** de indexación cae en **REVISAR con motivo**,
     no en silencio.
2. **Lectura GPT-5** (workflow A): comparar las 3 fichas de prueba contra el
   golden set (origen/destino manuscritos que gpt-4o fallaba) + registrar
   costo/latencia de la corrida.
3. **Throttle** (workflow A): subir los **3 PDFs juntos (11 páginas)** en una
   sola subida y confirmar que completa **sin error de rate limit** y guarda los
   2 viajes; reportar tiempo total (esperado throttle ~135 s + tiempo de
   llamadas).

Estas 3 corridas necesitan el webhook vivo (`studio-julio.duckdns.org`), que
está bloqueado desde el sandbox — por eso las ejecuta Julio tras publicar.

---

## Resumen de qué pega dónde

| Workflow | Nodo (canvas) | Archivo `.generated.js` | Rama (commit) |
|---|---|---|---|
| Ingesta Viaje | `Formatear Linea Gesruta` | `ficha/nodo-formatear.generated.js` | `claude/swap-modelo-gpt5` (`c2aeb2e`) |
| Ingesta Viaje | `Preparar Payload` | `ficha/nodo-preparar-payload.generated.js` | `claude/swap-modelo-gpt5` (`c2aeb2e`) |
| Ingesta Viaje | `Extraer GPT-4o` | — (throttle ya en draft) | — |
| Vista Pendientes | `Planilla` | `ficha/nodo-planilla.generated.js` | `claude/recarga-indexacion` (`439d321`) |
