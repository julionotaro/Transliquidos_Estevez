# Roles, campos de acción y handoff — TLE

> **Quién hace qué, qué lee cada uno, y quién escribe en cada archivo.** Leer esto cuando haya
> dudas de reparto de trabajo entre las sesiones de Claude (y con Julio). Es el acuerdo de handoff.
> Última actualización: 03/11/2026.

---

## Participantes y campo de acción

| Participante | Qué hace | Qué NO hace |
|---|---|---|
| **Julio** (dueño del dominio) | Decide y confirma reglas, tarifas, puntos, flujos, empresas. Es la única fuente de verdad del dominio. | — |
| **Operador de datos** (skill `procesar-juego`) | Lee los juegos nuevos de `entrada/`, aplica las reglas, resuelve códigos Gesruta, genera `orden.json` + fila(s) de registro + archivo en `procesados/`, commit+push. | **No cambia el código del armador.** No inventa dominio: si la realidad contradice, PARA y pregunta a Julio. |
| **Desarrollo** (armador/código) | Mantiene `herramientas/armar_orden/` (capacidades y fixes), el validador, el build de nodos. Implementa capacidades nuevas que pide el operador. | No decide dominio. No carga en Gesruta. |
| **Bot** (Claude Escritorio, skill `cargar-viajes-gesruta`) | Lee `orden.json` y carga el viaje en Gesruta por control de pantalla. Devuelve `resultado.json`. | No extrae datos ni factura; solo carga lo que la orden dice. |

> En la práctica una misma sesión puede cubrir varios roles, pero **las fronteras de escritura de
> abajo se respetan siempre**.

---

## Quién ESCRIBE en cada archivo (frontera de escritura)

| Archivo | Qué es | Lo escribe |
|---|---|---|
| `catalogo/correcciones-julio.json` | **Memoria de decisiones humanas** (reglas + decisiones de Julio). | **Quien esté en la sesión cuando Julio confirma** (operador o dev), como **registro fiel** de lo que Julio dijo — nunca una generalización inventada. Lo exige `CLAUDE.md` PASO 2. |
| `catalogo/tarifas-confirmadas-julio.json` · `catalogo/tarifa-por-analogia.json` · `catalogo/puntos-alta.json` | **Datos confirmados por Julio** (tarifas, analogías, puntos de alta). | El **operador** cuando Julio confirma. Son decisiones de Julio, no tooling. |
| `herramientas/armar_orden/**` | **Código del armador** (lógica determinista). | El **dev**. El operador NO lo toca; si falta una capacidad, la deja marcada RUIDOSO y la pide. |
| `herramientas/armar_orden/raw/*.json` | Hechos crudos de un juego (insumo del armador). | El **operador**. |
| `ordenes-carga/ordenes/**/orden.json` · `datos/registro-procesamiento.csv` · `procesados/**` | Salida de un juego procesado. | El **operador** (vía armador + scripts). |
| `herramientas/armar_orden/*.generated.js` / nodos n8n | Código generado. | El **dev** (con `build-nodo.js`; no a mano). |

---

## Respuesta a las 3 preguntas de handoff (operador ↔ dev ↔ Julio)

1. **Datos confirmados por Julio (tarifa / analogía / punto):** los **graba el operador** en los
   archivos de datos (`tarifas-confirmadas-julio.json`, `tarifa-por-analogia.json`,
   `puntos-alta.json`). Son **decisiones de Julio, no tooling**. Se marca **RUIDOSO** solo lo que
   **todavía NO está confirmado** (ahí no se factura: `tarifa_pendiente`).

2. **Reglas (`correcciones-julio.json`):** el operador **SÍ** registra una regla **que Julio
   confirmó**, como registro fiel de esa decisión (es memoria de decisiones humanas y `CLAUDE.md`
   PASO 2 obliga a anotarla). Lo que el operador **no** hace es **inventar** reglas ni cambiar el
   **código** del armador — eso es del dev. Regla de oro: *si no lo confirmó Julio, no es una regla.*

3. **Señal de cambios:** la señal primaria es **`git log` / `git diff`** (mensajes de commit
   disciplinados). Antes de cada tanda, el operador mira el diff de los commits nuevos en especial de
   `correcciones-julio.json`, `herramientas/armar_orden/` y los catálogos de datos, y **corre
   `golden_test.js`** para confirmar que el armador está sano. (Si algún día hace falta, el dev lleva
   un `docs/CAMBIOS.md`; hoy alcanza con git + golden.)

**Default acordado:** datos confirmados por Julio → los graba el operador; reglas confirmadas →
las registra quien esté; código del armador → el dev; **cualquier duda de dominio → PARAR y preguntar.**

---

## Rutina obligatoria del OPERADOR (antes de cada juego)

1. **Sincronizar:** `git fetch origin main && git reset --hard origin/main` (arrancar siempre desde lo último).
2. **Leer contexto:** `CLAUDE.md` → `docs/INDICE.md` → **`catalogo/correcciones-julio.json`** (reglas = verdad).
3. **Ver qué cambió** desde la última corrida: `git log --oneline` / `git diff` de los commits nuevos
   (correcciones, `herramientas/armar_orden/`, catálogos de datos).
4. **Correr `node herramientas/armar_orden/golden_test.js`** (armador sano antes de usarlo).
5. **Procesar** (skill `procesar-juego`): leer TODAS las páginas del escaneo, cruzar con las tablas
   (matrícula→flota, cliente/destino por la OC, peso del CMR/albarán NUNCA de la OC), armar el raw,
   correr el armador, generar `orden.json` + registro + archivo.
6. **Cerrar:** `python3 -I herramientas/validar_carga.py`, commit+push a `main`, **reportar** a Julio
   con tabla y marcar RUIDOSO lo no resuelto.

---

## Mapa: qué leer según la tarea

| Tarea | Leer |
|---|---|
| Procesar un juego | `CLAUDE.md` → `INDICE.md` → `correcciones-julio.json` → skill `procesar-juego` → (`CONTRATO-orden-json.md`, `flujos-carga.md`, `nomenclatura-archivos.md`, `reglas-extraccion-revision.md` según haga falta) |
| Tocar el armador | `resolvedor-orden-cobertura.md` + el código de `herramientas/armar_orden/` + `correcciones-julio.json` (para no romper reglas) |
| Cargar en Gesruta (bot) | `pedido-bot-carga-resiliente.md` + `flujo-carga-y-registro.md` + skill `cargar-viajes-gesruta` + `CONTRATO-orden-json.md` |
| Repaso rápido de reglas / errores a no repetir | `reglas-extraccion-revision.md` |
| Entender el reparto de trabajo | **este documento** |

---

## Principio que manda sobre todo
`CLAUDE.md`: **si la realidad contradice el encargo, PARAR y REPORTAR. Fallar ruidoso antes que en
silencio. Null antes que invención plausible. Un dato equivocado en silencio envenena una factura.**
