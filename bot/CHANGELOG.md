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

### Fix 2026-10-21 — secuencia correcta de Gastos (aprendida en vivo)

Carga en vivo del primer albarán autónomo (Alfonsín, viaje de prueba) para aprender la secuencia
exacta donde el robot se descoordinaba. La secuencia correcta de Gastos es:

1. **Primer clic en Gastos** → 2 avisos: "¿grabar el albarán para continuar?" (**Sí**) y
   "¿convertir el pedido en albarán?" (**Sí**). El albarán se graba **pero Gastos NO abre**.
2. **Segundo clic en Gastos** → ahora **sí abre** (el albarán ya está grabado, sin avisos).
3. Cargar conceptos: concepto → hoja blanca → clic Cantidad → teclear → Enter.
4. **Guardar con el DISQUETE** (clic, abajo-izquierda de la ventana Gastos), **NO con F2**: graba,
   cierra la ventana y vuelve al albarán (que queda numerado). El robot usaba F2, que se perdía
   por foco → "salía por la flecha" y seguía descoordinado.
5. Disquete del **albarán** (`ALB_SAVE`) → graba el albarán y vuelve a "Entrada de Viajes".

Cambios en `do_gastos_autonomo`: se agrega el **segundo clic en Gastos** tras despejar los avisos
(`despejar_avisos_si`, patrón de `open_km_form`), y se reemplaza `F2` por el clic en el **disquete**
(`GASTOS_SAVE=(22,1007)`). Se quitó la detección por `has_window("GASTOS")`, no fiable (la ventana
Gastos persiste de fondo como hija MDI). El resto de la carga (cabecera, albarán, líneas) quedó
verificado paso a paso en la misma corrida.

### 2026-10-21 — corrida integrada OK + captura de Nº para resultado.json

- **Corrida integrada autónoma OK** (Alfonsín, 3 albaranes): cabecera→albaranes→Gastos→grabar
  viaje, todo grabado (1/1). La secuencia de Gastos (2 avisos + 2º clic + disquete) funcionó en
  los 3 albaranes. El `resultado_actual.json` salió con la estructura del contrato y `estado`
  correctos; faltaban los números.
- **Captura de Nº implementada** para `resultado.json`:
  - `nro_albaran_gesruta` = **índice dentro del viaje** (`01`,`02`,`03`…): Gesruta numera así los
    albaranes y el bot los crea en orden → `capturar_nro_albaran(ai)` = `"%02d"%(ai+1)`.
  - `nro_viaje_gesruta` = por **Win32 GetWindowText**: los campos de Nº son de SOLO LECTURA (el
    portapapeles no los lee, verificado en vivo), pero el texto del control sí se puede leer por
    Win32. `capturar_nro_viaje()` busca el control con patrón `0\d{7}`; fail-loud (0 o >1
    candidatos → `""`, no inventa). Pendiente de confirmar que ese control expone texto por Win32
    (si fuera owner-drawn, hay que otra vía) — se verifica con `test_nro_viaje.py`.

### Fix 2026-10-21 (tarde) — revisión de la corrida integrada (4 puntos de Julio)

Tras la primera corrida integrada, Julio reportó 4 problemas. Diagnóstico y arreglo:

1. **Gastos del 2º/3er albarán no grababan la cantidad (quedaba en `1`).** Causa: la grilla de
   Gastos es **por albarán** (cada albarán abre su Gastos vacío), no acumulativa a nivel viaje; el
   robot clicaba la celda Cantidad en la fila índice `ai`, que en el 2º/3er albarán era una fila
   vacía. **Fix:** la fila nueva de cada concepto está **siempre en la fila 0** (`_add_gasto_row(…, 0, …)`).
2. **No grababa el viaje al cerrar el 3er albarán.** Primer intento: F2 con `keyDown`/`keyUp`
   sostenido + reintento. **En la prueba del 2026-10-22 F2 SIGUIÓ SIN GRABAR** (corrió 2 veces, 16 s,
   y el viaje quedó sin grabar). Conclusión: F2 por `pyautogui` no es fiable acá, por más vueltas que
   se le den. **Fix definitivo (como pidió Julio): DISQUETE.** Se activó
   `GRABAR_VIAJE_CON_DISQUETE=True` y `VIAJE_SAVE=(351,1002)` = disquete **plano** de grabar de
   Entrada de Viajes (**VERIFICADO EN VIVO**: al clicarlo el viaje quedó grabado, campos en gris). El
   otro disquete contiguo (con una hoja) es grabar-e-imprimir, no se usa.
3. **Nº de albarán:** confirmado = **índice dentro del viaje** (`01`,`02`,`03`). Ya implementado.
4. **Nº de viaje NO es legible por software (confirmado en las DOS pantallas).** El campo (p. ej.
   `00050962`) es **owner-drawn** (lo pinta Gesruta): no lo lee el portapapeles (Ctrl+C siempre copia
   la fila de la grilla) **ni** Win32 `GetWindowText`. El diagnóstico `test_nro_viaje.py` se corrió
   el 2026-10-22 en **Entrada de Viajes Y Entrada de Albaranes** (idea de Julio): **0 candidatos en
   ambas**; el Nº no aparece como texto en ningún control de ninguna de las dos. Win32 queda
   descartado. El robot **falla ruidoso**: deja `nro_viaje_gesruta=""`, no inventa. Próximo paso:
   OCR de captura o completarlo manual en la extracción (decisión de Julio).

### Resultado de la prueba — 2026-10-22

- **Punto 1 (Gastos): RESUELTO y confirmado.** Corrida de Alfonsín: los 3 albaranes cargaron sus
  KILOMETROS / KM EN VACIO correctos (1200/127, 1170/68, 292/42), cada uno en su fila 0. Julio lo
  verificó en pantalla.
- **Punto 2 (grabar viaje): RESUELTO vía disquete.** F2 volvió a fallar; se pasó al disquete plano
  (`VIAJE_SAVE=(351,1002)`, `GRABAR_VIAJE_CON_DISQUETE=True`), verificado en vivo.
- **Punto 4: Win32 descartado en ambas pantallas** (ver arriba). Pendiente de decisión OCR vs manual.
- **OJO nº de albarán:** en la prueba el viaje **no estaba vacío** (tenía un albarán `01` previo,
  ref 2029398), así que los 3 del bot quedaron como `02/03/04` en Gesruta mientras el
  `resultado_actual.json` los numeró `01/02/03`. En producción el viaje debe arrancar **vacío** para
  que la numeración índice (01/02/03) coincida con la de Gesruta.

### 2026-10-22 — Nº de viaje por CAPTURA (Punto 4 resuelto sin paso manual)

El Nº de viaje es owner-drawn y Win32 quedó descartado en las dos pantallas. En vez de OCR (que
pediría instalar algo) o paso manual, el bot **captura la zona del Nº a un PNG** y la **extracción
(vista) lee los dígitos**. Validado en vivo 2026-10-22: el recorte GDI sale nítido y legible.

- `capturar_nro_viaje(vpos)` ahora: 1) intenta Win32 (fast path, por si acaso); 2) si no, captura
  `NRO_VIAJE_CROP_RECT=(8,82,250,32)` (reales) con `_capturar_png` — **GDI por ctypes + encoder PNG
  con `zlib` de la stdlib, sin Pillow** — y guarda `nro_viaje_v<N>.png` junto al `resultado.json`.
  Devuelve `(nro_texto, crop_filename)`. Fail-loud: si captura falla, ambos `""` (no inventa).
- `resultado.json`: cada viaje lleva ahora `nro_viaje_crop` (nombre del PNG) además de
  `nro_viaje_gesruta`. Cuando `nro_viaje_gesruta=""` y hay `nro_viaje_crop`, **la extracción lee ese
  PNG** y completa el número. (Requiere añadir el campo al `CONTRATO-resultado-json.md` del lado de
  la extracción — propuesto a Julio, no lo toco yo.)
- Herramienta de validación: `inspector/test_captura_nro.py` (+ `.bat`).

### Fix 2026-10-22 (tarde) — Gastos: QUITAR el 2º clic (lo descoordinaba)

Síntoma (Julio, en vivo): en Gastos el bot empezaba cargando la fila de **km vacío**, guardaba y
salía, en vez de km carga → km vacío. Mismo código de Gastos que la corrida buena (verificado por
git), así que no era regresión: era **timing**.

Causa raíz (la encontró Julio mirando la pantalla): tras clicar Gastos y responder **Sí** a los 2
avisos, la ventana Gastos **abre sola** (con demora). El bot hacía un **2º clic en Gastos** — parche
de la sesión original, cuando creímos que no abría. A la mañana ese 2º clic caía *antes* de que
abriera (y la terminaba de abrir); ahora Gesruta abre más rápido, el 2º clic cae con la ventana **ya
abierta** y la descoordina (selecciona el concepto equivocado → carga km vacío, guarda, sale).

Fix: se **elimina el 2º clic**. Tras despejar los avisos, el bot solo **espera** a que la ventana
abra (sin re-clicar) y recién ahí carga los conceptos. Es lo que pidió Julio: "solo hay que esperar
que abra la ventana de gastos".

**Segunda capa (mismo día, observado en vivo):** ya sin el 2º clic, igual fallaba el **primer**
concepto (KILOMETROS=carga no entraba; el 2do, KM EN VACIO, sí). Causa: la ventana Gastos recién
abierta se "come" el **primer clic** (solo la enfoca) y recién el 2do registra — por eso el 1er
concepto no quedaba seleccionado y el 2do sí. Verificado tomando control: con la ventana ya enfocada,
un clic selecciona bien; el mecanismo (concepto → hoja blanca → cantidad → Enter) es correcto.
Fix: en `_add_gasto_row` el concepto se clica **dos veces** (dos clics simples separados ~0.35s, no
doble-click): el 1º enfoca, el 2º selecciona. Robusto para ambos conceptos.

### Pendiente en v2

- Añadir `nro_viaje_crop` al `CONTRATO-resultado-json.md` (lado extracción) y que la extracción lea
  el PNG cuando el número venga vacío. **Decisión/aplicación de Julio.**
- Confirmar en una corrida limpia (viaje vacío) que la numeración 01/02/03 del `resultado.json`
  coincide con Gesruta, y que el recorte del Nº sale bien dentro del flujo completo del bot.

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
