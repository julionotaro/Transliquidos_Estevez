# Verdad de campo — 3 fichas reales (9 viajes)

> **Fuente única de verdad para toda prueba de lectura.** Leída dígito por dígito
> de los recortes de `ficha_real.pdf` rasterizado a 300/400 DPI (las mismas
> bandas de `REGIONES_FICHA`). Todo motor se compara **mecánicamente** contra
> esta tabla, nunca por inspección visual ad-hoc.
>
> Origen del rigor: en la sesión del 29/07 se reportó "5/5 OK limpios" para
> gpt-4o y era falso — el V9 tenía un dato malo (leyó `1054400/114`; real
> `1054410/124`) que se descubrió recién al releer la ejecución. Esa clase de
> error invalida una prueba entera. Por eso esta tabla va primero y se congela.

## Cabecera por página

| Página | Conductor | Tractora (matrícula) | Remolque |
|---|---|---|---|
| 1 | Asensi | `2498KZL` | R1007BCV |
| 2 | Pablo Carlés | `8420KKT` | (vacío) |
| 3 | Marcos | `3729JIH` | R-7749-BDD |

> Matrícula pág. 3: los dígitos `3729` son nítidos; el grupo de letras (`JIH`) es
> ambiguo a ojo humano (la del medio podría leerse I/C). Se fija `3729JIH`.

## Viajes (campos que facturan)

| Viaje | Pág | kg | km_inicio | km_final | km_recorridos (escrito) | final−inicio | ¿consistente? |
|---|---|---|---|---|---|---|---|
| V1 | 1 | 23140 | 838163 | 839056 | 893 | 893 | ✓ |
| V2 | 1 | 23820 | 839489 | 840665 | 1176 | 1176 | ✓ |
| V3 | 1 | 23880 | 840841 | 841067 | 226 | 226 | ✓ |
| V4 | 2 | 25100 | 940907 | 941030 | 123 | 123 | ✓ |
| V5 | 2 | 25240 | 941156 | 941275 | 183 | 119 | ✗ (ver nota) |
| V6 | 2 | 25760 | 941407 | 941533 | 126 | 126 | ✓ |
| V7 | 3 | 25080 | 1053783 | 1053906 | 123 | 123 | ✓ |
| V8 | 3 | 25000 | 1054032 | 1054156 | 124 | 124 | ✓ |
| V9 | 3 | 24920 | 1054286 | 1054410 | 124 | 124 | ✓ |

**Total de dígitos-campo de odómetro a evaluar: 18** (km_inicio + km_final × 9).
Ese es el universo del criterio decisorio del §5 del encargo.

## Notas que cambian el análisis previo

- **V2 es LIMPIO, no una inconsistencia de ficha.** El `km_inicio` real es
  `839489` (no `839429`). `840665 − 839489 = 1176 = recorridos escrito`. En la
  corrida de gpt-4o (573) el modelo leyó `839429` y por eso dio 1236 → REVISAR:
  fue un **misread del modelo**, no un defecto de la ficha.
- **V5 es la ÚNICA inconsistencia intrínseca de la ficha.** Odómetros
  `941156 → 941275` (delta 119), pero el chofer escribió `183` en KM RECORRIDOS.
  Ningún OCR puede "arreglar" esto: la ficha se contradice a sí misma. Un lector
  perfecto la manda a REVISAR igual. No cuenta como error de lectura de odómetro.
- Por lo tanto, un lector **perfecto** de odómetros produce **8 consistentes + 1
  REVISAR intrínseco (V5)** — no 9 OK. Cualquier motor que reporte los 9 como OK
  está, por definición, leyendo mal V5 o inventando su consistencia.
- kg con lecturas que antes se dieron por buenas y son falsas: **V3 = 23880**
  (gpt-4o leyó 23380), **V7 = 25080**, **V9 = 24920** (gpt-4o leyó 29920).
