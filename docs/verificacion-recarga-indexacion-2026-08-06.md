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

## Regla de borde §4.4 — IMPLEMENTADA (aprobada por Julio en el mismo encargo)

La confirmación real destapó dos gaps del consumidor respecto de
`docs/dominio-facturacion.md §4.4`. Julio aprobó resolverlos acá mismo. Ninguno
afectaba viajes vivos (todos julio 2026, cubiertos y sin día ambiguo), pero son
reales y ahora **fallan ruidoso**:

1. **Fecha no cubierta → REVISAR** (antes quedaba `-` mudo). `buscarPct` devuelve
   `estado:'sin_tramo'` e `indexacionDeFila` → `modo:'revisar'`, con la fecha en
   el motivo (`indexacion_sin_tramo: <grupo> @ <fecha> fuera de los tramos
   cargados`). `planilla.js` lo resalta. No aplica 0 ni el tramo vecino.
   Ejemplo real (hueco del Excel 2026-05-15→05-18): FORESA @ 2026-05-16 → REVISAR.

2. **Solape en día de corte con % distinto → REVISAR** (antes elegía el primero
   en silencio). Los tramos comparten el día de corte (`hasta` de uno = `desde`
   del siguiente); donde el % cambia, ese día es ambiguo. `buscarPct` devuelve
   `estado:'ambiguo'` con los candidatos, e `indexacionDeFila` → `modo:'revisar'`
   con **los pct candidatos y la fecha** en el motivo (`indexacion_ambigua:
   <grupo> @ <fecha> cae en tramos con % distinto (18.38% / 17.17%); definir
   convencion de dia de corte`). Días de corte con **mismo %** (ej. 2026-06-07:
   0.1452/0.1452) NO van a REVISAR — no hay ambigüedad. Casos reales verificados:
   FORESA @ 2026-05-01 (18.38% / 17.17%) y @ 2026-06-15 (14.52% / 12.79%).

Corrida real post-fix: los 3 viajes vivos siguen resolviendo igual
(FORESA 0.1064, RNM 0.08, ASTURIANO ZINC 0.08) — sin regresión. Tests nuevos
cubren ambos casos con datos reales del Excel (hueco 05-16, cortes 05-01/06-15).
177/177 verde.

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
