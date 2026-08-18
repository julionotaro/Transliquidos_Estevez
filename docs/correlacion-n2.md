# Correlación N2 — documento ↔ viaje por ruta/material/peso (§5.2)

> Cuando un documento no trae `referencia` (o la trae con fecha de emisión distinta
> de la del viaje, caso Baltransa), se lo empareja con su viaje por
> **origen + destino + material + fecha + peso**. Módulo puro
> `correlacion/correlacionar-n2.js`. 10 tests.

## Cascada

1. **Nivel 1 — `referencia`.** Match exacto de referencia doc↔viaje. Confianza alta.
   Corta antes de N2.
2. **Nivel 2 — ruta + material + peso + fecha.** Requisitos **duros** (si falla uno,
   el candidato se descarta): `origen_canonico` igual, `destino_canonico` igual
   (vía `resolver-punto.js`, Encargo 2), material compatible. Después desempatan:
   - **ventana temporal** (asimétrica según tipo de documento, ver abajo)
   - **peso ±2%**

Resolución: 1 candidato → `correlacion='N2'`; >1 sin poder desempatar → REVISAR
listando los candidatos; 0 → `sin_correlacion` (REVISAR/PENDIENTE según §3).

## Clasificador binario de documento (CAMBIO 1)

`clasificarDocumento` decide **orden** vs **documento de transporte** — de eso
depende la ventana. Por `tipo_doc`, con marcadores de encabezado como respaldo
(`ORDEN DE TRANSPORTE`/`ORDEN DE CARGA` → orden; `CMR`/`ALBARAN`/`CARTA DE PORTE`/
`TICKET DE BASCULA` → transporte). Sin señal → `desconocido` (ventana ancha, seguro).

## Ventana temporal (asimétrica)

| Clase | Ventana (días respecto a `fecha_doc`) | Por qué |
|---|---|---|
| **orden** | `[fecha_doc, fecha_doc + 2]` — **solo hacia adelante** | la OC se emite ANTES del viaje. `VENTANA_OC_DIAS=2` (Julio) |
| **CMR/albarán/báscula** | `±1 día` | contemporáneo al viaje |
| **desconocido** | `[fecha_doc − 1, fecha_doc + 2]` | ancha, comportamiento seguro |

## Reglas duras

- **El km NO correlaciona** (no existe en ningún documento de transporte, §5).
- Nunca por fecha sola, ni cliente solo, ni ruta sola: **sin origen+destino+material
  no hay N2**.
- **§7 (N:1) intacto**: la cardinalidad doc↔viaje puede ser N:1. Las rotaciones
  Foresa metanol (misma ruta/día) se distinguen por peso; no se colapsan a un viaje.
  Reusa `RUTAS_MULTIVIAJE`/`esRutaMultiviaje` de `cruce.js` (no duplica).

## Trazabilidad (CAMBIO 3) — pendiente de cableado

El campo `correlacion` (`N1`/`N2`/`manual`/`sin_correlacion`) debe persistirse en la
tabla `viajes` y mostrarse en la vista pendientes, para **medir si N2 acierta** (sin
medición no sabemos si la ventana de 2 días es la correcta). Falta:
- agregar columna `correlacion` a la tabla `viajes` (MCP) + emitirla en Preparar
  Filas Viajes + mostrarla en `pendientes.js`;
- integrar la cascada en el correlacionador de ingesta.

## Re-correr tests

```
node --test correlacion/correlacionar-n2.test.js
```
