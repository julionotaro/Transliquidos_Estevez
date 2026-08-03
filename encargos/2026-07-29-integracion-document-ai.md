# Encargo a Claude Code — Integración Document AI (modalidad B) como lector de odómetros

> Esto SÍ se cablea a producción. Reemplaza a gpt-4o **solo** para `km_inicio` y `km_final` en el canal ficha real (`WD0q9Ic0oDvUoJwp`). El resto de los campos (matrícula, kg, fechas, gastos, observaciones) sigue leyendo con gpt-4o como hoy — ahí ya funciona bien y no se toca.

---

## 0. REGLA DE ARRANQUE

Inspeccionar antes de tocar nada:

1. **El workflow `PROBE Document AI A` que quedó en n8n** de la sesión de prueba — tiene la credencial `Document AI` ya asignada y el nodo de código de modalidad B funcionando. Es la base directa: no reconstruir desde cero, adaptar ese código al canal ficha real.
2. **`docs/prueba-document-ai.md`** (main, `transliquidos_Estevez`) — ahí están los números exactos de la prueba: 14/18 aciertos en modalidad B, el patrón de error (formato roto o confianza < 0.80), y el coste/latencia medidos.
3. **`docs/verdad-de-campo-fichas.md`** (main) — la tabla de verdad congelada. Usarla para la verificación de este encargo también, no reconstruir otra.
4. **Topología real del canal ficha** (`WD0q9Ic0oDvUoJwp`): dónde vive hoy `Rasterizar Ficha` → `Preparar Payload` → `Extraer GPT-4o` → `Formatear Linea Gesruta` (la guarda de consistencia). Confirmar el punto exacto donde hay que insertar la llamada a Document AI y dónde se funde su resultado con el de gpt-4o antes de la guarda.

Si algo contradice este encargo, parar y reportar.

## 1. Qué cambia en el flujo

**Antes:**
```
Rasterizar Ficha → Preparar Payload → Extraer GPT-4o (todos los campos) → Formatear (guarda) → Viajes
```

**Después:**
```
Rasterizar Ficha → Preparar Payload → Extraer GPT-4o (todos los campos)
                                    ↘
                                     Document AI modalidad B (página completa + bbox)
                                     → filtra tokens de km_inicio/km_final
                                    ↙
                     Fusionar: km_inicio/km_final vienen de Document AI;
                     el resto de los campos viene de gpt-4o
                                    ↓
                        Formatear (guarda de consistencia + guarda de confianza)
                                    ↓
                                 Viajes
```

Las dos llamadas (gpt-4o y Document AI) corren **en paralelo**, no en cadena — no hay que esperar una para lanzar la otra, ambas parten del mismo raster de página completa.

## 2. La guarda de confianza — nueva, específica de Document AI

Un valor de odómetro leído por Document AI se acepta como bueno si **ambas** condiciones se cumplen:

- El token no viene malformado (sin `/`, `%`, u otro carácter no numérico mezclado en el resultado).
- La confianza reportada por Document AI es **≥ 0.80**.

Si cualquiera de las dos falla → ese campo va a `REVISAR`, motivo `baja_confianza_docai` o `formato_invalido_docai` según cuál disparo.

**El umbral 0.80 es preliminar.** Viene de una muestra de 9 viajes. Dejarlo como constante nombrada y fácil de ajustar (`UMBRAL_CONFIANZA_DOCAI = 0.80`), no hardcodeado en el medio de la lógica. Anotarlo en el código con un comentario que diga de dónde sale y que se recalibrará con más datos.

## 3. Señal adicional — km_recorridos escrito, NUNCA como corrector

Julio pidió explícitamente usar el km_recorridos que el chofer anota a mano como ayuda. Implementarlo así, y solo así:

- **Se usa exclusivamente para reforzar o debilitar la confianza en la decisión de REVISAR, nunca para modificar el valor leído.** El sistema no adivina ni promedia ni corrige un odómetro combinando fuentes. Un humano corrige, el sistema solo decide si hace falta que lo haga.
- Regla: si `km_inicio (Document AI) + km_recorridos (gpt-4o, texto manuscrito) ≈ km_final (Document AI)` dentro de ±5, es una señal de refuerzo — no cambia un REVISAR a OK por sí sola, pero puede sumarse como dato en el motivo/log para que el humano que revisa tenga más contexto ("Document AI marcó baja confianza en km_final, pero el km_recorridos escrito es consistente con el valor leído").
- Si el km_recorridos escrito **no es consistente** con los odómetros de Document AI, es una señal adicional de alerta — pero la guarda de consistencia existente (final − inicio = recorridos, ±5) ya cubre este caso desde antes. No duplicar lógica: verificar si ya está cubierto antes de agregar código nuevo.
- **No confiar en el km_recorridos escrito como ancla de verdad.** Ya se documentó un caso (barrido Gemini, V6) donde el chofer restó mal y el km_recorridos escrito no coincidía con los odómetros reales, que sí eran correctos. Es una pista, no una fuente de verdad.

## 4. Guardas — capas finales, ninguna reemplaza a otra

| Capa | Qué caza |
|---|---|
| Guarda de consistencia (existente) | `final − inicio ≠ recorridos_escrito` (±5) |
| Guarda de confianza/formato Document AI (nueva) | Lecturas de odómetro dudosas o malformadas de Document AI |
| Señal km_recorridos como contexto (nueva, no bloqueante) | Enriquece el motivo de REVISAR para el humano, no decide sola |

## 5. Tests

- Document AI con confianza ≥ 0.80 y formato limpio → valor aceptado, sin REVISAR por ese campo.
- Document AI con confianza < 0.80 → REVISAR, motivo `baja_confianza_docai`, con el valor de km_recorridos escrito incluido en el motivo como contexto.
- Token malformado (`94/030` o similar) → REVISAR, motivo `formato_invalido_docai`, sin intentar parsear el número roto.
- Caso real reproducido de la prueba: V1 (839056 con confianza .755) y V9 (1054410 con confianza .614) → ambos REVISAR. V4 y V6 (formato malformado) → REVISAR.
- Caso real de acierto confiado: V7 inicio 1053783 (el que gpt-4o falló) → Document AI lo lee bien con confianza .74 (nota: .74 está bajo el umbral 0.80 — revisar si este caso puntual debe caer en REVISAR según la regla, y reportarlo si genera un falso REVISAR sobre un dato que en realidad era correcto; es exactamente el trade-off que ya sabíamos que existía).
- No regresión: matrícula, kg, fechas, gastos siguen viniendo de gpt-4o sin cambios.
- `estado_lectura` persiste con el motivo correcto y no null.
- `node --test` / runner del repo verde. `npm run check` al día.

## 6. Commit

```
feat(ficha): Document AI como lector de odometros con guarda de confianza

km_inicio y km_final se leen con Document AI (modalidad pagina completa +
bbox) en paralelo a gpt-4o, que sigue leyendo el resto de los campos.
Guarda nueva: confianza < 0.80 o token malformado -> REVISAR. km_recorridos
manuscrito se usa solo como señal de contexto en el motivo de REVISAR,
nunca para corregir el valor leido. Reemplaza el plan de consenso
multi-motor (mini/gpt-4o/Gemini), descartado por evidencia.
```

## 7. Verificación manual

Con las 3 fichas reales, contra `docs/verdad-de-campo-fichas.md`:

1. Contar odómetros OK vs REVISAR con la guarda nueva. Criterio de éxito: cero odómetros con dato malo en estado OK (igual que en la prueba: 14/18 correctos, el resto cazado por formato o confianza).
2. Confirmar que el resto de los campos (matrícula, kg, fechas) no cambió respecto de la versión gpt-4o-solo actual.
3. Medir coste y latencia reales de la corrida con las dos llamadas en paralelo — confirmar que sigue por debajo del límite de 144s del webhook.
4. Reportar explícitamente el caso V7 (confianza .74, justo bajo el umbral) — si el umbral 0.80 genera revisión innecesaria sobre datos que son correctos, decirlo como dato para la recalibración futura, no ajustar el umbral a ciegas dentro de este encargo.

> Purgar antes de correr: las filas de prueba de las corridas 583/584 siguen en `viajes` (por UI, no hay tool de borrado).

## 8. Fuera de alcance

- Recalibrar el umbral 0.80 con más muestra — encargo aparte cuando haya más fichas reales.
- Construir el consenso multi-motor — descartado.
- Rediseño de la ficha con casillas por dígito — decisión de negocio, no de este repo.
- Tocar la lectura de matrícula/kg/fechas.
