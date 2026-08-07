# Verificación — recarga de la tabla Indexacion (encargo 2026-08-06)

Corrida real: reemplazo ejecutado en la tabla viva `Indexacion`
(`or1otD9WsjJ3V8Cr`, project `grgBpWySVCpXvuii`) desde `SUPLEMENTO_GASOLEO.xlsx`,
y lookup con el módulo committeado `ficha/indexacion.js` contra los datos vivos.
No es "se ve bien".

## Conteo antes / después

- **Antes:** 70 filas (categoría en `cliente`, `tipo`='gasoleo'; incluía AGENCIA
  y AUTONOMOS). El cross-join x538 (37.660) que sospechaba el encargo **ya no
  estaba** — la tabla se había recargado limpia el 2026-07-24.
- **Después:** **53 filas** (ejecución 655), esquema nuevo: categoría en `tipo`,
  `cliente`="". Reparto: **FORESA-BRESFOR 14 · HELM 16 · QUIMIDROGA 11 · OTROS 12**.
  (El encargo estimaba ~48; el real es 53 — HELM trae 16 tramos, más que lo
  estimado. No es un error de filtrado, es el conteo real del Excel.)

### Filtrado aplicado (según encargo + §4.1)
- Solapas cargadas: FORESA-BRESFOR, HELM, QUIMIDROGA, OTROS.
- **Excluidas**: AGENCIA, AUTONOMOS, Hoja1 (0 filas de esas en la tabla).
- Headers (fila 1 de cada solapa) fuera.
- **Filas con pct vacío NO cargadas**: 2 en QUIMIDROGA + 2 en OTROS (abril 2026,
  huecos históricos). Confirmado: no aparecen en la tabla.
- `pct` con la precisión del Excel, sin redondeo (`0.1838`, `0.0665`, `0.15`, `0.039`).
- `desde`/`hasta` ISO `YYYY-MM-DD` (coherente con la tabla).

## Golden set (contra la tabla recargada) — PASA

| cliente | fecha | grupo | pct | esperado |
|---|---|---|---|---|
| FORESA | 2026-07-07 (1ª q. julio) | FORESA-BRESFOR | **0.1064** | 0.1064 ✓ |
| FORESA | 2026-07-20 (2ª q. julio) | FORESA-BRESFOR | **0.0665** | 0.0665 ✓ |
| QUIMIDROGA | 2026-07-15 (julio) | QUIMIDROGA | **0.1171** | 0.1171 ✓ |

## Lookup contra viajes vivos (3 clientes distintos)

| cliente (viaje) | fecha | grupo resuelto | pct |
|---|---|---|---|
| FORESA | 2026-07-07 | FORESA-BRESFOR | 0.1064 (10.64%) |
| RNM | 2026-07-15 | OTROS (regla confirmada, sin aviso) | 0.08 (8%) |
| ASTURIANO ZINC (no nombrado) | 2026-07-30 | OTROS (fallback D-5, con aviso visible) | 0.08 (8%) |

La resolución cliente→categoría vive en código (`grupoIndexacion`) y el match
contra la tabla es por `tipo`. Un cliente no nombrado cae en OTROS con aviso
(no en silencio).

## Fecha fuera de rango — no da 0 ni el tramo vecino

- FORESA @ 2025-06-01 y @ 2026-12-01 → `buscarPct` devuelve `null` →
  `indexacionDeFila` modo `sin_regimen`, pct `null`, motivo `sin_tramo_vigente`.
  **No inventa 0, no toma el tramo vecino.** ✓

## Hallazgos §4.4 (regla de borde) — NO resueltos en este encargo

El encargo pedía *confirmar* el comportamiento de borde. La confirmación real
destapa dos gaps del consumidor respecto de `docs/dominio-facturacion.md §4.4`
("cualquier hueco, tramo vacío o fecha no cubierta → REVISAR; solape en día de
corte con % distinto → REVISAR"). **Ninguno afecta a los viajes vivos de hoy**
(todos julio 2026, cubiertos y sin caer en día ambiguo), pero son reales:

1. **Fecha no cubierta → hoy NO marca REVISAR.** `indexacionDeFila` devuelve
   modo `sin_regimen` con etiqueta `-`, y `planilla.js` sólo resalta
   `regimen_pendiente`. O sea: no da 0 ni vecino (bien), pero el viaje **no se
   marca REVISAR** — queda con `-` sin resaltar. §4.4 pide REVISAR explícito.
   (Ejemplo real de hueco en el Excel: 2026-05-16/17, sin tramo en ninguna
   categoría.)

2. **Solape en día de corte con % distinto → hoy elige el primero en silencio.**
   Los tramos del Excel comparten el día de corte (`hasta` de uno = `desde` del
   siguiente). Donde el % cambia, ese día pertenece a dos tramos:
   - FORESA-BRESFOR: 2026-05-01 (0.1838 vs 0.1717) y 2026-06-15 (0.1452 vs 0.1279).
   - HELM: 2026-05-01 (0.0802 vs 0.1385), 2026-06-07 (0.1256 vs 0.1141), 2026-06-15 (0.1141 vs 0.1036).
   `buscarPct` devuelve el **primero** (ej. FORESA @ 05-01 → 0.1838) en silencio.
   §4.4 pide REVISAR hasta que la oficina defina convención.

**Ambos son cambios de comportamiento del consumidor, fuera del alcance aprobado
(match por `tipo`).** Se dejan documentados para que Julio decida si van como
ajuste chico en un encargo siguiente. La recomendación es implementarlos (es la
disciplina "fallar ruidoso" del proyecto), pero no se tocó sin OK.

## Deploy pendiente (acoplamiento código ↔ tabla)

La tabla viva ya tiene el esquema nuevo (`tipo`=categoría). El nodo **Planilla**
vivo todavía matchea por `cliente` (el fix `buscarPct`→`tipo` está en git, commit
`9c2a2be`, sin desplegar). Hasta desplegar el nodo Planilla regenerado, la columna
de indexación de la planilla viva no resolverá contra la tabla recargada. Es el
mismo deploy pendiente del nodo Planilla que ya arrastran los fixes de identidad
de cliente (tarifas) — deben desplegarse juntos.

## Limpieza

Workflows scratch de lectura y de **borrado** creados para el reemplazo quedaron
**archivados** (`SCRATCH Leer/Borrar/Dump Indexacion`). El borrado fue one-shot y
nunca cableado a un nodo de conteo (lección del incidente de la recarga de Tarifas).
