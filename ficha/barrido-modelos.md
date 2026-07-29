# Barrido de modelos — lectura de ficha sobre imagen 300 DPI

Fase PRUEBA del encargo de rasterizado. Mide qué modelo lee la ficha manuscrita
sobre **imagen rasterizada a 300 DPI** (no sobre PDF-archivo). Barra de corte:
aciertan **kg, km, fecha, matrícula**. Los nombres de destino no cuentan.

PDF de prueba: el real de las **3 fichas** (`20260720181636.pdf`, 3 páginas):

| Página | Conductor | Tractora | Viajes |
|---|---|---|---|
| 1 | Asensi | 2498KZL | 3 |
| 2 | Pablo Carlés | 8420KKT | 3 |
| 3 | Marcos | 3729JIH | 3 |

**Total esperado: 9 viajes.**

---

## BARRIDO v3.5 (B.1: recorte por banda) — §8 del encargo lectura-confiable

Con B.1 la ficha se lee sobre **bandas ampliadas** (matricula + km de cada
viaje via `/rasterizar-regiones`), no sobre la A4 entera. Verificacion sobre las
3 fichas reales (9 viajes), contra la verdad de campo recortada de la propia
ficha. Corridas reales: **570 (mini) y 573 (gpt-4o)**, ambas por el webhook vivo.

| Config | Fichas/Viajes | estado_lectura | OK verificados correctos | OK malos ocultos |
|---|---|---|---|---|
| mini SIN crop (ejec. 557) | 3/9 ✓ | 2 OK / 7 REVISAR | — | 0 (ruidoso) |
| **mini CON crop (570)** | 3/9 ✓ | **3 OK / 6 REVISAR** | **3/3 limpios** ✓ | **0** |
| gpt-4o SIN crop (ejec. 560) | 3/9 ✓ | 9 OK / 0 REVISAR | — | **~4 (ocultos)** ⚠️ |
| **gpt-4o CON crop (573)** | 3/9 ✓ | **5 OK / 4 REVISAR** | **5/5 limpios** ✓ | **0** |

### El hallazgo: el crop desactiva el misread OCULTO de gpt-4o

El peligro del barrido v3.4 eran los misreads internamente consistentes de gpt-4o
que pasaban como OK con dato malo. **El recorte los desarma:** o los lee bien, o
rompe su consistencia y la guarda los caza.

| Viaje | Real | gpt-4o SIN crop (560) | gpt-4o CON crop (573) |
|---|---|---|---|
| Asensi V1 | 838163→**839056**=893 | 839086/923 **OK oculto** ✗ | **839056/893 OK correcto** ✓ |
| Marcos V7 | **1053783**→1053906=123 | 105783 (digito dropeado) **OK oculto** ✗ | 1057823→neg → **REVISAR** ✓ |
| Marcos V9 | 1054286→**1054410**=124 | 1054400/114 **OK oculto** ✗ | 1054400 vs escrito 124 → **REVISAR** ✓ |

gpt-4o CON crop pasa de "9/9 OK con ~4 malos ocultos" (peligroso) a "5 OK todos
correctos / 4 REVISAR" (seguro). **Los 5 OK se verificaron uno por uno contra la
ficha real: cero digitos malos en OK (§8.2 bloqueante: PASA).**

### El limite: con mini, el crop NO alcanza — el techo es el MODELO

mini CON crop mejora poco (arreglo V3: 841063→841067) pero sigue leyendo mal
digitos que en la banda ampliada estan **cristalinos**: leyo `839056` como
`239056` (un 8 clarisimo como 2), matricula `8420`→`8400`, `1053783`→`1057823`.
La banda km a 300 DPI muestra "838.163 / 839.056 / 893" sin ninguna ambiguedad,
y aun asi mini falla. **Eso prueba que el error que queda es de CAPACIDAD del
modelo, no de resolucion.**

### Consecuencia para B.2 (relectura) — reportado, no construido

La relectura focalizada re-recorta mas ceñido y a mayor DPI cuando la guarda no
cierra. Pero si el crop **ya es legible** y el modelo igual lo lee mal (probado
arriba), **volver a recortar mas ceñido con el MISMO modelo no lo va a arreglar**:
no es un problema de tamaño de imagen. §8.3 lo anticipa exactamente ("si la
relectura no recupera nada... reportarlo"). Con la evidencia en mano, la relectura
same-model rinde poco sobre el modo de error real observado.

**Por eso el corte (§9): B.1 entregado y verificado; el siguiente entregable NO es
la relectura sino:**
1. **Promover gpt-4o como MODELO_FICHAS** — el crop lo vuelve seguro (0 malos
   ocultos). Hoy queda en `gpt-4o-mini` por la regla "no cambiar sin OK"; es la
   recomendacion tecnica fuerte, pendiente del OK de Julio.
2. **Consenso mini+gpt-4o (Palanca A)** como red para el residual: donde discrepan
   en un campo que factura → REVISAR. Es la red que ni el crop ni la relectura
   pueden dar sobre un misread coherente.

### Latencia y coste (§8.5) — mejora, no empeora

Corridas de 24s (573) y 33s (570), muy por debajo del limite de 144s del webhook.
5 llamadas/PDF (3 ficha + 1 docs OpenAI + 1 rasterizador). Y el crop **abarata**:
~5.860 prompt_tokens/llamada vs 37K+ de la pagina entera sola (las bandas son
chicas). B.1 lee mejor Y sale mas barato.

### Config actual

`MODELO_FICHAS = gpt-4o-mini` (default, sin cambiar sin OK), pisable por corrida
con `modelo_fichas` en el body. `MODELO_DOCS = gpt-4o`. Bandas en `REGIONES_FICHA`
(payload.js). Columna `intentos_lectura` agregada a `Viajes` (la puebla B.2).

---

## BARRIDO v3.4 (loop por pagina) — mini vs gpt-4o, mismas 3 fichas

Con el loop por pagina, **ambos modelos leen las 3 fichas / 9 viajes, cero
perdida**. Recien ahora los numeros de lectura son comparables (antes, con una
sola llamada, mini perdia 2 fichas y el barrido habria mentido).

| | gpt-4o-mini (ejec. 557) | gpt-4o (ejec. 560) |
|---|---|---|
| Fichas / viajes | 3 / 9 ✓ | 3 / 9 ✓ |
| `estado_lectura` | **2 OK / 7 REVISAR** | **9 OK / 0 REVISAR** |
| Odometros correctos vs ficha real | ~2-3 de 9 | ~4-5 de 9 |
| Matriculas | 1/3 (2498KZL) | 1/3 (2498KZL) |
| kg | ~7/9 | ~6/9 |

### El hallazgo que importa: "9/9 OK" de gpt-4o es MAS peligroso que "7/9 REVISAR" de mini

gpt-4o lee mejor **en promedio** (acerto Asensi V2 y V3, que mini erro), pero sus
errores son **misreads internamente CONSISTENTES** que la guarda no puede cazar.
La guarda de km solo compara `final - inicio` contra `recorridos`: si el modelo
lee mal el odometro **y** el recorrido de forma coherente, pasa como OK.

Casos verificados contra la imagen real (gpt-4o, todos marcados **OK**):

| Viaje | Real (ficha) | gpt-4o leyo | Como paso la guarda |
|---|---|---|---|
| Asensi V1 | 838163 → **839056** = **893** | 838163 → **839086** = **923** | 923 = 839086−838163, consistente |
| Pablo V5 | 941156 → 941275, recorridos escrito **183** | 941156 → 941275 = **119** | leyo recorridos 119 (=calc), **oculto** la discrepancia que mini marco |
| Marcos V7 | **1053783** → **1053906** = 123 | **105783** → **105906** = 123 (¡dropeo un digito!) | 123 = 105906−105783, consistente |
| Marcos V9 | 1054286 → **1054410** = **124** | 1054286 → **1054400** = **114** | 114 = 1054400−1054286, consistente |

**mini erraba distinto:** sus misreads solian romper la consistencia
(final < inicio, recorridos ≠ calc), y la guarda los cazaba → REVISAR. Por eso
mini marco 7/9 (ruidoso pero seguro) y gpt-4o marco 0/9 (limpio pero **~4 km
equivocados entrarian como facturables sin dejar rastro**).

Esto **confirma y generaliza** la intuicion del ±5: la guarda de consistencia km
es estructuralmente insuficiente contra un modelo que malinterpreta de forma
coherente. No es solo "digito del medio vs del final" — es que el modelo puede
leer mal odometro Y recorrido a la vez y quedar consistente.

### Direcciones de fix (encargo aparte, no aca)

1. **Consenso multi-modelo (lo mas fuerte):** correr mini Y gpt-4o; donde
   DISCREPAN, marcar REVISAR. Dos modelos rara vez cometen el MISMO misread
   coherente. Cazaria exactamente Asensi V1 (839056 vs 839086), Marcos V7
   (1053783 vs 105783), etc.
2. **Monotonicidad del odometro a lo largo de la hoja** (no solo dentro del
   viaje): un salto de magnitud (digito dropeado, +30 espurio) rompe la serie
   inicio/final entre viajes consecutivos.
3. Repensar el umbral km (lo que anoto Julio), sabiendo que por si solo no
   alcanza.

### Veredicto del barrido

**Ninguno de los dos es "listo para produccion" tal cual.** gpt-4o lee mejor pero
esconde sus errores; mini los expone pero lee peor y marca de mas. La eleccion no
es "el mejor modelo" sino "modelo + verificacion": la recomendacion tecnica es
**consenso mini+gpt-4o**, que aprovecha que leen distinto. Decision de Julio.

`MODELO_FICHAS` queda en `gpt-4o-mini` (default); no se cambia sin OK.

---

## Resultado (fase PRUEBA inicial, v3.3 — arquitectura que perdia fichas)

### gpt-4o-mini — ejecución real 552 (27/07/2026)

Confirmado por la respuesta de OpenAI: `model: gpt-4o-mini-2024-07-18`,
`prompt_tokens: 111878` (≈ 3 imágenes de página completa a 300 DPI, ~37K tokens
c/u). **El modelo recibió las 3 imágenes** y devolvió **1 sola ficha**.

| Métrica | Baseline ESTADO §1 (PDF-archivo) | **gpt-4o-mini (imagen 300 DPI)** |
|---|---|---|
| | gpt-4o / gpt-5 | |
| **Fichas leídas** | — | **1 de 3** ⚠️ (perdió Pablo Carlés y Marcos) |
| **Viajes detectados** | 6/9 / 9/9 | **3/9** (los 3 de Asensi) |
| **Año** | 2022 inventado / 2026 ✓ | **2026 ✓** (los 3, sin inventar) |
| **Odómetros** | secuencias +2000 inventadas / null | **reales y distintos** ✓ |
| **km** | fabricados / reales desordenados | **reales**; 1 flag correcto, 1 dígito bajo tolerancia |
| **Gastos** | 1/3 / ninguno | gasoleo 400€ (1 línea, correcta) |
| **kg** | null / null | **3/3 correctos** ✓ (23140, 23820, 23380) |
| **Matrículas** | 1/3 / 1/3 | **1/1 leída, correcta** (2498KZL) |

### Detalle de la ficha que sí leyó (Asensi), contra la ficha real

| Viaje | fecha | kg | km inicio→final | recorridos | estado_lectura | ¿correcto? |
|---|---|---|---|---|---|---|
| 1 | 07/07 (ficha: **09**/07) | 23140 ✓ | 838163→839056 ✓ | 893 ✓ | OK | día mal (09→07); resto ✓ |
| 2 | 13/07 ✓ | 23820 ✓ | 839429→840665 | ficha 1176, calc 1236 | **REVISAR** ✓ | la guarda km cazó la inconsistencia |
| 3 | 15/07 ✓ | 23380 ✓ | 840841→**841063** | 226 ✓ | OK | km_final mal leído (ficha: 841.**067**) |

---

## Veredicto: gpt-4o-mini NO pasa la barra

Sobre los campos que **sí** leyó, gpt-4o-mini sobre imagen es un salto enorme
respecto del baseline: **kg por fin se lee** (antes siempre null), el **año no se
inventa**, los **odómetros son reales** (no secuencias fabricadas). Eso **valida
la hipótesis del rasterizado**: la imagen 300 DPI es leíble donde el PDF-archivo
no lo era.

Pero falla en dos ejes que lo descartan como modelo de producción:

1. **Pérdida de fichas (crítico).** De un PDF de 3 fichas devolvió 1. Seis viajes
   desaparecieron **en silencio**: sin error, sin REVISAR, sin fila. Es el peor
   tipo de fallo — dato que falta sin dejar rastro. Es el error #3 del ESTADO
   ("perder bloques"), ahora a nivel ficha entera. El modelo recibió las 3
   imágenes (111878 tokens lo confirman); no registró que cada imagen era una
   ficha distinta.

2. **Un dígito mal leído bajo la tolerancia.** Viaje 3: km_final real 841.067,
   leído 841.063. La diferencia contra los km escritos (226) queda en 4, bajo el
   umbral de la guarda (>5), así que entró como **OK** con `km_cargados=222`
   (correcto: 226). La guarda de ±5 km deja pasar misreads de 1 dígito bajo.

---

## Qué sigue (no en este encargo — requiere tu OK)

- **`MODELO_FICHAS` sigue en `gpt-4o-mini`** (default). NO es un ganador: no
  declaro producción sin tu OK, y además no pasa.
- **Probar `gpt-4o`** sobre la misma imagen (ya cableado; `modelo_fichas=gpt-4o`
  en el body del webhook). El baseline sugiere que detecta 9/9 viajes; falta ver
  si sobre imagen además acierta kg/km y si pierde o no fichas.
- **La causa raíz de la pérdida de fichas es arquitectónica, no de modelo.** El
  prompt está escrito para "este PDF" con "una ficha por página", pero el modelo
  ahora recibe N imágenes sueltas. La forma robusta de garantizar 0 pérdidas es
  **una llamada por página** (rasterizar → loop página→modelo→1 ficha), a costa
  de N× llamadas. Lo recomiendo como encargo aparte; elimina la pérdida por
  diseño en vez de confiar en que el modelo cuente las imágenes.
- **Gemini Flash**: pendiente de credencial (slot documentado en README).

---

## Verificación de la tabla Viajes (punto 6 del encargo)

- Los 3 viajes de Asensi se **persistieron** en `Viajes` con kg/km/fecha/matrícula.
- **Bug encontrado y corregido en esta corrida:** el nodo `Guardar Viajes` mapeaba
  27 columnas fijas y **no incluía `estado_lectura`, `motivo_revision` ni
  `pagina_origen`** — se guardaban como `null`. El blindaje `estado_lectura` no
  estaba llegando a la tabla (defecto de la sesión anterior: agregué las columnas
  y el emisor, pero no el mapeo del nodo). Corregido el mapeo (schema + value) y
  verificado con una fila de prueba: persiste `REVISAR` / motivo / página.
  Publicado (versión activa `a0942f4a-...`).
- El viaje 2 (dígito dudoso) quedó correctamente en `REVISAR`. **Pero** el viaje 3
  (km_final mal leído por 4) entró como `OK`: la guarda de ±5 km no lo alcanza.
