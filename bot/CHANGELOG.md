# CHANGELOG — Bot de carga Gesruta (TLE)

Historial de versiones del bot. La versión viva está en `VERSION` dentro de cada script.

---

## v2 — `viajes-2` (2026-10-20) — GASTOS para choferes autónomos

`robot_viajes_v2.py` (copia de v1 + integración de Gastos). **v1 (`robot_viajes.py`) queda
intacta y estable.**

- **Disparador:** `cabecera.tipo === "autonomo"` → el bot **salta el formulario Kilómetros** y
  carga los km en **Gastos**.
- Por albarán, dentro de la ventana Gastos: una fila **KILOMETROS** = `km.carga` y una fila
  **KILOMETROS EN VACIO** = `km.vacio`, **tomados directo del `orden.json`** (no se recalcula
  `fin−inicio`: para autónomos el valor bueno es el de la ficha). Cierra con **F2**.
- Mecanismo de fila: seleccionar concepto → **hoja blanca** ("Añadir registro nuevo", no F3) →
  clic en la celda **Cantidad** → teclear → Enter. La fila nueva se inserta abajo (índice = nº de
  albarán). Coordenadas 1920×1080 validadas en vivo.
- Fail-loud: si falta `km.carga` o `km.vacio` en un albarán autónomo, **aborta** (no inventa).
- El flujo de chofer **propio** no cambia respecto de v1.

### Validación del mecanismo de Gastos — 2026-10-20 (en vivo)

Corrida de `gastos_test.py` + verificación por control de escritorio en un albarán de prueba
(00050948, estado "Borrado"): se cargaron KILOMETROS 1.200/1.170 y KM EN VACIO 120/130, cada uno
en su concepto, con autocompletado correcto (matrícula/chófer/precio 0,95/fecha). **F2 grabó y
persistió** (confirmado reabriendo Gastos). Fix clave: abrir la fila con la **hoja blanca** en vez
de F3 (la tecla F3 se perdía sin foco exacto en la ventana).

### Fix 2026-10-21 — avisos al abrir Gastos

En la corrida integrada, al clicar **Gastos** (igual que Kilómetros) Gesruta lanza dos avisos
—"¿grabar el albarán para continuar?" y "¿convertir el pedido en albarán?"— que hay que
confirmar con **Sí** antes de que abra la pantalla Gastos. v2 no los despejaba y seguía de largo.
Arreglado con `despejar_avisos_si()` (mismo patrón que `open_km_form`). Además se quitó la
detección por `has_window("GASTOS")`, no fiable: la ventana Gastos persiste de fondo como hija
MDI (visto en el árbol del inspector), así que daba falso positivo.

### Pendiente en v2

- `resultado.json` (contrato de salida) — ver `ordenes-carga/CONTRATO-resultado-json.md`.
- Probar `viajes-2` con un viaje autónomo real (hasta ahora probado el mecanismo de Gastos
  aislado; falta la corrida integrada cabecera→albaranes→gastos→grabar).

---

## v1 — `viajes-1` (2026-10-15) — PRIMERA VERSIÓN ESTABLE

Primer bot funcional de carga **multi-viaje en continuo**. Congelado como respaldo
(`robot_v1_FUNCIONAL` en la PC; ahora versionado aquí).

Capacidades probadas en vivo:

- **Cabecera:** el usuario escribe el código de `cabeza`; Gesruta autocompleta
  tractora/remolque/chófer y el bot **verifica** contra `verificar`.
  - **BUSCAR remolque** si no coincide: doble clic en el campo código → dígitos de la
    matrícula → **lupa** → doble clic en la fila del resultado. *(verificado en vivo)*
- **Albaranes:** referencia, fechas, cliente, **origen** (se reescribe sobre la selección
  del Tab), destino, carga, y **líneas** (porte + indexación, con quita-puntos de miles).
- **Kilómetros (chofer propio):** lee el tacógrafo en pantalla y calcula `carga` y `vacío`;
  las coordenadas del formulario km se **anclan al rectángulo de la ventana** (robusto
  aunque la ventana abra corrida).
- Graba cada albarán, **graba el viaje** (foco + F2) y **encadena** al siguiente.

Reglas de oro: no inventar / fallar ruidoso; el bot **no teclea ni almacena** la clave de
Gesruta; no se generan albaranes ficticios en producción.

Variante `robot_viaje.py` (`viaje-1`): un solo viaje, multi-albarán, con las matrículas de
cabecera cargadas a mano.

### Corrida de validación — 2026-10-15 (17:30)

- **Viaje 1** (Pedro Fraga, remolque `R8574BBC`, 2 albaranes): **grabado completo** ✓.
- **Viaje 2** (`R3487BCD`): abortó en cabecera porque se corrió una versión **previa** al fix
  del buscador (faltaba ejecutar la lupa). No fue un fallo del mecanismo.
- **Fixes aplicados tras la corrida** (ya incluidos en esta v1):
  - buscar-remolque con la secuencia correcta (lupa + doble clic en la fila), verificada en vivo;
  - **km anclado al rectángulo de la ventana** — cura de raíz del bug de posición/fecha en los
    camiones donde la ventana de km abría desplazada.

---

## WIP — `gastos-test-1` — Gastos para choferes autónomos (en desarrollo)

Los autónomos (Fraga, Alfonsín, Abal) usan **tractora propia** → sus km se cargan en la ventana
**Gastos** (conceptos `KILOMETROS` y `KILOMETROS EN VACIO`), **no** en el formulario Kilómetros.

- **2026-10-16 — mecanismo de Gastos validado en vivo** (control de escritorio):
  - Seleccionar el concepto en la lista izquierda → añadir fila → la fila sale **autocompletada**
    (matrícula/chófer/precio/fecha/concepto); **solo se teclea la Cantidad**.
  - **Cantidad:** clic en la celda → teclear → **Enter** (reemplaza el `1` por defecto y calcula
    el Importe). El **Tab NO** llega a Cantidad.
  - La fila nueva se inserta **abajo**; la rejilla está **filtrada por concepto**.
- **Fix tras la primera corrida del script:** abrir la fila con la **hoja blanca** ("Añadir un
  registro nuevo") en vez de **F3** — la tecla F3 se perdía cuando el foco de teclado no quedaba
  exacto en la ventana Gastos. Al finalizar: **F2**.
- **Pendiente de integración al bot principal:**
  - `cabecera.tipo = "autonomo"` → saltar el formulario Kilómetros y usar Gastos;
  - leer `km.vacio` (informado por albarán, ya que el vacío del autónomo no se calcula).

---

## Pendiente (próximas versiones)

- Leer la orden **directamente** desde
  `ordenes-carga/ordenes/<AAAA-MM>/<chofer>/<AAAA-MM-DD>/orden.json`
  (hoy: copia local `orden_actual.json` junto al script).
- Escribir **`resultado.json`** en la carpeta de la orden con los **Nº de viaje/albarán**
  capturados de la pantalla al grabar (formato definido por la etapa 1 / Claude de la nube).
- Integrar la carga de **Gastos** (autónomos) al bot principal.
