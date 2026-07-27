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

## Resultado

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
