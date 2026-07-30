# Prueba de idoneidad — Document AI sobre las bandas de la ficha

Encargo `encargos/2026-07-29-prueba-document-ai.md`. **Prueba, no construcción.**
Pregunta única: **¿un OCR especializado en manuscrito lee los odómetros mejor que
los LLM de visión, y reporta confianza que marque sus errores?**

- Verdad de campo: `docs/verdad-de-campo-fichas.md` (congelada antes de correr).
- Procesador: Document OCR, `projects/163988540080/locations/eu/processors/1049209471c32899`.
- Insumo: `ficha_real.pdf` (3 fichas, 9 viajes), mismas bandas de `REGIONES_FICHA`.
- Corridas reales: **583** (modalidad A) y **584** (A+B). Sonda: `pruebas/document-ai/`.
- Todos los números salen de comparar mecánicamente contra la verdad de campo.

## 1. Tabla comparativa — odómetros (los 18 dígitos-campo del criterio §5)

`i` = km_inicio, `f` = km_final. Fuentes: gpt-4o = ejec. 573; Document AI = ejec.
583/584. Gemini flash está medido cualitativamente en `barrido-modelos.md`
(lee en el tramo de gpt-4o, errores independientes); acá se compara contra los
dos que están en juego: gpt-4o (producción) y Document AI (candidato).

| Viaje | campo | Verdad | gpt-4o+crop | DocAI A (banda) | DocAI B (página) |
|---|---|---|---|---|---|
| V1 | i | 838163 | 838163 ✓ | 838163 ✓ | 838163 ✓ |
| V1 | f | 839056 | 839056 ✓ | 839056 ✓ | **739056 ✗** |
| V2 | i | 839489 | **839429 ✗** | 839489 ✓ | 839489 ✓ |
| V2 | f | 840665 | 840665 ✓ | 840665 ✓ | 840665 ✓ |
| V3 | i | 840841 | 840841 ✓ | 840841 ✓ | 840841 ✓ |
| V3 | f | 841067 | 841067 ✓ | **841.06% ✗** | 841067 ✓ |
| V4 | i | 940907 | 940907 ✓ | 940907 ✓ | 940907 ✓ |
| V4 | f | 941030 | 941030 ✓ | **94/030 ✗** | **94/030 ✗** |
| V5 | i | 941156 | 941156 ✓ | 941156 ✓ | 941156 ✓ |
| V5 | f | 941275 | **941375 ✗** | **941279 ✗** | 941275 ✓ |
| V6 | i | 941407 | **941412 ✗** | 941407 ✓ | 941407 ✓ |
| V6 | f | 941533 | **941538 ✗** | **94/533 ✗** | **94/533 ✗** |
| V7 | i | 1053783 | **1057823 ✗** | 1053783 ✓ | 1053783 ✓ |
| V7 | f | 1053906 | 1053906 ✓ | 1053906 ✓ | 1053906 ✓ |
| V8 | i | 1054032 | 1054032 ✓ | 1054032 ✓ | 1054032 ✓ |
| V8 | f | 1054156 | 1054156 ✓ | 1054156 ✓ | 1054156 ✓ |
| V9 | i | 1054286 | 1054286 ✓ | 1054286 ✓ | 1054286 ✓ |
| V9 | f | 1054410 | **1054400 ✗** | **1059410 ✗** | **1059410 ✗** |

## 2. Tasa de acierto sobre odómetros (mecánica, 18 campos)

| Motor | km_inicio | km_final | **Total /18** |
|---|---|---|---|
| gpt-4o + crop (producción) | 6/9 | 6/9 | **12/18** |
| Document AI — modalidad A (banda) | **9/9** | 4/9 | **13/18** |
| Document AI — modalidad B (página) | **9/9** | 5/9 | **14/18** |

Hallazgo estructural: **Document AI lee km_inicio 9/9 perfecto**; el punto débil
es km_final (los choferes lo escriben más apurado). gpt-4o reparte sus errores
entre inicio y final (incluye el `1057823` de V7 que Document AI lee bien). La
modalidad B (página completa) supera a A: le arregla V3-f y V5-f (A los pierde
por recorte al borde y por el `%`), a cambio de perder V1-f. B además entrega las
coordenadas de cada número.

## 3. Confianza vs acierto — el punto que decide (§5)

Sobre km_final (el campo que rompe), modalidad B, contra la verdad:

| Viaje | DocAI B | ¿correcto? | confianza | ¿malformado? | ¿lo caza un guard? |
|---|---|---|---|---|---|
| V1 | 739056 | ✗ | **0.755** | no | sí (conf<0.80) |
| V2 | 840665 | ✓ | 0.944 | no | — (pasa OK) |
| V3 | 841067 | ✓ | 0.826 | no | — (pasa OK) |
| V4 | 94/030 | ✗ | 0.835 | **sí (/)** | sí (malformado) |
| V5 | 941275 | ✓ | 0.656 | no | falso REVISAR |
| V6 | 94/533 | ✗ | 0.889 | **sí (/)** | sí (malformado) |
| V7 | 1053906 | ✓ | 0.952 | no | — (pasa OK) |
| V8 | 1054156 | ✓ | 0.929 | no | — (pasa OK) |
| V9 | 1059410 | ✗ | **0.614** | no | sí (conf<0.80) |

**El resultado central:** con un guard simple `(token con carácter no-dígito) OR
(confianza < 0.80) -> REVISAR`:

- Se cazan **los 4 errores** de km_final (V1, V4, V6, V9).
- Los que pasan como OK (V2, V3, V7, V8) son **100% correctos**: **cero dígitos
  malos en OK.**
- Costo: **1 falso REVISAR** (V5, que era correcto a 0.656).

**Ningún odómetro quedó "limpio, confiado y mal".** Ese era exactamente el defecto
letal de gpt-4o: su V9 leyó `1054400/114` (mal) con formato válido y sin ninguna
señal — invisible. Document AI **no tiene esa trampa en estos datos**: cuando se
equivoca, o escupe basura (`/`, `%`) o baja la confianza. La confianza sola no
separa perfecto (V6 malo a 0.889 > V5 bueno a 0.656), pero **confianza + formato
sí marca el 100% de los errores.**

## 4. Matrícula y cantidad_kg (medición secundaria)

- **Matrícula** (dígitos): `2498`✓ / `8400`✗ (real 8420, conf 0.74) / `3729`✓.
  Las letras son débiles en los tres (KZL conf 0.61, KKT 0.35, JIH→SCH 0.56) —
  igual que los LLM. La confianza baja de las letras las marca.
- **kg** (modalidad B): `23140`✓ `23820`✓ `23880`✓ (¡Document AI acierta el
  23880 que gpt-4o leyó 23380!) `25760`✓ `25080`✓ = 5/9 nítidos; el resto llegan
  garbleados (`252५०`, `2500046`) — pero garbleados, no limpios-y-mal.

## 5. Coste y latencia

| | Llamadas/PDF | Páginas facturadas/PDF | Coste aprox./PDF | Notas |
|---|---|---|---|---|
| Modalidad A | 12 (1 por banda) | 12 | ~$0.018 | 4× más caro |
| Modalidad B | 3 (1 por página) | 3 | ~$0.0045 | + coordenadas reales |

(Document OCR ~$1.5 / 1000 páginas.) Corrida completa (rasterizado + 15 llamadas)
≈ 20 s en la ejec. 584. **B es más barata, más rápida y lee mejor** → es la
modalidad para producción.

## 6. Veredicto (§5, sin ambigüedad)

**Document AI modalidad B = 14/18 → banda "14–16", Y la confianza+formato marcan
TODOS los errores → SIRVE CON GUARDA DE CONFIANZA. El umbral de confianza (con
detección de token malformado) reemplaza al consenso. Corresponde encargo de
integración con guarda.**

Por qué es mejor que seguir con LLM:
1. Lee **mejor** en crudo (14/18 vs 12/18 de gpt-4o) — y km_inicio 9/9.
2. **No tiene el error confiado-invisible.** Sus fallos se auto-declaran. gpt-4o
   metió un km malo como OK sin señal (V9); Document AI, no.
3. Es **barato y rápido** (modalidad B: 3 llamadas/PDF, ~$0.0045).

Matices honestos:
- 14/18 crudo **no es "resuelve solo"**: necesita el guard. Sin guard, mete 4 km
  finales malos. El guard es obligatorio.
- El campo que rompe es **km_final** (5/9). Es un problema de escritura apurada,
  no del motor. **La palanca de mayor impacto no es cambiar de motor otra vez,
  sino rediseñar la ficha con casillas por dígito** (sube el acierto de cualquier
  OCR dramáticamente) o teclear a mano solo los km_final. Document AI + casillas
  probablemente llegue a ≥17/18.
- Muestra chica (9 viajes / 3 fichas). Indicativo, no concluyente a escala. El
  guard y el umbral (0.80) se deben re-calibrar con más fichas antes de producción.

### Recomendación

Abrir **encargo de integración de Document AI (modalidad B) con guarda de
confianza+formato** como lector de odómetros del canal ficha, reemplazando el
consenso mini/gpt-4o para ese campo. En paralelo, evaluar el **rediseño de la
ficha con casillas por dígito** como la mejora estructural que ataca el único
punto flojo (km_final) para cualquier OCR. La vía "otro motor de visión más" queda
cerrada: Document AI ya es el salto y su límite es la escritura, no el modelo.
