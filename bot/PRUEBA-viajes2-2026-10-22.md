# Paso a paso — Prueba viajes-2 (Gastos autónomos + grabado de viaje)

Fecha prevista: **2026-10-22**. Objetivo: validar en vivo los fixes de los Puntos **1** (Gastos
graba la cantidad en los 3 albaranes) y **2** (el viaje graba al cerrar el último albarán), y dejar
decidido el Punto **4** (captura del Nº de viaje).

> Es una corrida de **prueba**: el viaje se puede borrar después. No hay datos reales en juego.

---

## 0. Prerequisitos (antes de empezar)

1. **Orden de prueba** = José Carlos Alfonsín (autónomo, 3 albaranes). Copiar
   `ordenes-carga/ordenes/2026-10/jose-carlos-alfonsin/2026-10-02/orden.json`
   como **`bot/orden_actual.json`** (es lo que lee el robot; está en `.gitignore`, no se sube).
2. **Robot** = `bot/robot_viajes_v2.py` (commit `fbcf0c2` o posterior). Flag de grabado por defecto:
   `GRABAR_VIAJE_CON_DISQUETE = False` → graba el viaje con **F2 robusto**.
3. **Gesruta**: empresa correcta, en **Entrada de Viajes**, con un **viaje nuevo vacío** listo
   (como la última vez: "limpié el viaje y dejé una entrada de viajes nueva").
4. **Pantalla**: 1920×1080. Chat de Claude **minimizado** antes de ceder el control.

## 1. Valores esperados (Punto 1 — Gastos)

El robot debe cargar, **en cada albarán**, en la ventana Gastos:

| Albarán | Referencia   | KILOMETROS | KILOMETROS EN VACIO |
|--------:|--------------|-----------:|--------------------:|
| 1       | 2028736      | **1200**   | **127**             |
| 2       | 710701       | **1170**   | **68**              |
| 3       | 0141170178   | **292**    | **42**              |

El bug viejo dejaba el 2º y 3º en `1`. **Lo que hay que ver:** que los tres queden con su valor.

## 2. Cómo corremos

1. Julio minimiza el chat y me da la orden de empezar.
2. Yo tomo el control (`gesruta.exe`, solo), y lanzo el robot (o Julio lo lanza y yo observo).
3. El robot encadena: cabecera → 3 albaranes (cada uno con su Gastos) → grabar viaje.

## 3. Qué observar, punto por punto

- **Punto 1 (Gastos):** al terminar cada albarán, abrir Gastos y confirmar las dos filas con los
  valores de la tabla. Especial atención al **2º y 3º** (eran los que fallaban).
- **Punto 2 (grabar viaje):** al cerrar el **3er** albarán, el viaje debe **grabarse** (los campos
  Cabeza/Chófer quedan en **gris** y aparece el Nº de viaje). 

### Árbol de decisión del grabado (Punto 2)

- **Si F2 graba** → listo, dejamos el flag en F2.
- **Si F2 NO graba** (como pasó en la corrida anterior) → **no le damos más vueltas**: pasamos al
  **disquete**. Para eso, con la ventana Entrada de Viajes abierta y el viaje **editable**:
  1. Confirmo **en vivo** cuál de los dos disquetes de la barra inferior es el de **grabar**
     (hay dos juntos; NO lo invento, lo verifico clicando en la prueba).
  2. Fijo esa coordenada en **`VIAJE_SAVE`** y pongo **`GRABAR_VIAJE_CON_DISQUETE = True`**.
  3. Re-corremos para confirmar que graba por disquete.

## 4. Punto 4 — Nº de viaje (diagnóstico de lectura)

Recordá: el Nº en "Entrada de Viajes" es **owner-drawn** (no lo lee portapapeles ni Win32). Tu idea:
probar la pantalla **Entrada de Albaranes**, que también muestra el Nº de viaje.

Correr **`inspector/test_nro_viaje.bat`** (solo lectura, no toca nada) **dos veces**:

1. Con **Entrada de Viajes** delante (viaje grabado, Nº visible).
2. Con **Entrada de Albaranes** de ese viaje delante.

El log `inspector/test_nro_viaje_log.txt` se **acumula**. Buscamos si en alguna de las dos pantallas
el Nº aparece como **texto legible** (sección "Volcado COMPLETO de controles visibles con texto").

- **Si aparece legible en alguna** → integramos esa lectura al robot (`capturar_nro_viaje`).
- **Si no aparece en ninguna** → decidimos entre OCR de captura o completarlo manual en la extracción.
  Mientras tanto el bot deja `nro_viaje_gesruta=""` (falla ruidoso, no inventa).

## 5. Criterio de éxito

- [ ] Los **3** albaranes con sus KILOMETROS y KM EN VACIO correctos (tabla del §1).
- [ ] El **viaje grabado** al cerrar el 3er albarán (F2 o, si no, disquete).
- [ ] `resultado_actual.json` con los 3 albaranes en estado `grabado` y numerados 01/02/03.
- [ ] Diagnóstico del Punto 4 corrido en ambas pantallas y decisión tomada.
