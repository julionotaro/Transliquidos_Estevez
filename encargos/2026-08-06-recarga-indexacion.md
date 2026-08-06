# Encargo 2026-08-06 — Reemplazo de la tabla Indexacion desde Excel

## Contexto

Cerramos el modelo de indexación de gasoil con Julio. Todo el conocimiento de dominio está en
`docs/dominio-facturacion.md` (reccién subido en `main`, commit `39021c3`) — **leelo antes de todo
lo demás**, define reglas de negocio que este encargo aplica.

Este encargo reemplaza la tabla `Indexacion` del Studio con los datos del Excel vigente
`SUPLEMENTO_GASOLEO.xlsx`. Es análogo a la recarga de `Tarifas` que hiciste antes, con
particularidades propias que se detallan abajo.

## Regla de arranque — inspeccioná primero

1. **Leé `docs/dominio-facturacion.md`** en `main`. Especialmente §4 (indexación completa) y §7
   (reglas no inferibles). El encargo no repite lo que ya está allí; asume que se leyó.
2. **Tabla destino**: `Indexacion`, id `or1otD9WsjJ3V8Cr`, project `grgBpWySVCpXvuii`. Columnas
   actuales (5): `cliente, tipo, pct, desde, hasta`. Confirmá conteo real por readback antes de
   tocar (se cree ≈37.660 filas por cross-join residual, ver abajo).
3. **Origen**: `SUPLEMENTO_GASOLEO.xlsx` (Julio lo sube directo a tu sesión). Tiene 7 solapas:
   `FORESA-BRESFOR`, `HELM`, `QUIMIDROGA`, `OTROS`, `AGENCIA`, `AUTONOMOS`, `Hoja1`. Estructura de
   cada solapa: 3 columnas `[FECHA (desde), (hasta), PORCENTAJE]`.
4. **Revisá cómo consume hoy `ficha/*.js` la tabla `Indexacion`** antes de decidir el mapeo de
   columnas — hay una decisión de diseño abajo que depende de esto. No inventes: mirá el código
   real y adaptate.

## Decisión ya tomada por Julio (no re-discutir)

- Fuente autoritativa: el Excel. **Reemplaza**, no complementa. Estado final: la tabla
  `Indexacion` contiene exclusivamente lo del Excel.
- Categorías activas en v1: **`FORESA-BRESFOR`, `HELM`, `QUIMIDROGA`, `OTROS`**. Las solapas
  `AGENCIA` y `AUTONOMOS` **NO se cargan** — probable circuito de subcontratación, fuera de v1.
  `Hoja1` es una vista duplicada, tampoco.
- BALTRANSA es caso aparte (0% en factura, no depende de esta tabla). No agregarlo.

## Decisión de diseño a resolver en este encargo

El bug de cross-join en la tabla actual (37.660 = 538 × 70) sugiere que se cargó "una fila por
cliente × tramo". Eso es incorrecto: el Excel no tiene granularidad por cliente. Lo correcto es
**una fila por tramo, con `tipo` = categoría**, y la asignación cliente→categoría se resuelve en
código (mismo patrón que ya usás en `ficha/clientes.js` para tarifas).

Objetivo de carga: ~14 tramos × 4 categorías activas = **~55 filas totales**, no miles.

- `tipo` = nombre de la solapa (`FORESA-BRESFOR`, `HELM`, `QUIMIDROGA`, `OTROS`).
- `desde`, `hasta`, `pct` = del Excel, uno por fila del tramo.
- **`cliente`**: dejarlo **vacío**. La asignación cliente→categoría vive en código, no en la
  tabla. Si al revisar el código (paso 4 de arranque) ves que el consumidor actual espera algo
  distinto (p.ej. lee `cliente` para el match), reportalo antes de escribir — puede requerir
  ajuste en `ficha/` como parte del mismo encargo o como uno siguiente. Julio decide.

## Mapeo Excel → tabla

Por cada solapa activa, por cada tramo (fila) del Excel:

- `tipo` = nombre de la solapa (string).
- `desde` = fecha desde del tramo (formato ISO `YYYY-MM-DD` en string, para consistencia con las
  otras columnas string; confirmar formato con los existentes al hacer readback).
- `hasta` = fecha hasta del tramo.
- `pct` = porcentaje (número decimal, ej. `0.1171`; string en la tabla — mantener precisión de 4
  decimales del Excel, no redondear).
- `cliente` = "" (vacío).

**Filas a excluir del Excel**:
- Solapas `AGENCIA`, `AUTONOMOS`, `Hoja1`.
- Filas de header (primera de cada solapa).
- Filas con `pct` vacío/nulo (existen 2 al inicio en QUIMIDROGA y OTROS — son huecos históricos
  que no se cargan; el consumo devuelve REVISAR cuando corresponda, no la tabla).

## Ejecución del reemplazo

Vaciá la tabla `Indexacion` y cargá las filas nuevas. Si vaciar-y-recargar es riesgoso en la
infra, hacelo transaccional o cargá a tabla nueva y renombrá. Estado final: `Indexacion` =
tramos de las 4 categorías activas, ~55 filas.

**Importante — lección del reemplazo de Tarifas**: cuando termines la carga, asegurate de dejar
desconectado / archivado cualquier workflow scratch de borrado. El disparo accidental de un
borrador causó el incidente anterior (se resolvió sin pérdida, pero no queremos repetirlo).

## Tests

- **Mapeo por categoría**: una fila de cada solapa activa aterriza en la tabla con `tipo`
  correcto, formato de fecha coherente con la tabla, `pct` con precisión completa.
- **Filas del Excel con pct vacío NO se cargan** (verificado en QUIMIDROGA y OTROS abril 2026).
- **AGENCIA y AUTONOMOS NO se cargan.** Ninguna fila de esas solapas debe aparecer.
- **Coherencia con facturas reales** (casos verificados contra facturas de Julio, sirven como
  golden set):
  - FORESA, viaje del 1ª quincena de julio 2026 → `pct` = 0.1064
  - FORESA, viaje del 2ª quincena de julio 2026 → `pct` = 0.0665
  - QUIMIDROGA, viaje de julio 2026 → `pct` = 0.1171
- Conteo antes/después reportado.
- Suite existente sigue verde.

## Verificación — corrida real

- Contá filas finales en `Indexacion` y reportá antes/después.
- Ejecutá el lookup de indexación (código que consume esta tabla) contra al menos 3 viajes vivos
  reales de clientes distintos (uno FORESA, uno QUIMIDROGA/RNM, uno de un cliente no nombrado que
  debería caer en OTROS). Reportá qué `pct` devuelve para cada uno y con qué fecha.
- Si hay viajes vivos con fecha fuera del rango cubierto por el Excel (anteriores a abril 2026 o
  posteriores al último tramo), confirmá que el consumidor devuelve REVISAR — no 0, no el tramo
  vecino.

## Commit / entrega

- Rama propia (no `claude/planilla-carga-auditoria` ni `claude/recarga-tarifas-excel`), commits
  chicos (parseo+filtrado / carga / verificación).
- No abrir PR salvo que se pida; reportá el resultado y esperá.
- Si el paso 4 del arranque revela que el código actual espera la tabla con granularidad por
  cliente y no puedes hacer el cambio limpio de una vez, **parate ahí y reportá** antes de
  seguir — puede ser un encargo dividido.
