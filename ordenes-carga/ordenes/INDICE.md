# Índice de órdenes de carga

Estructura: `ordenes-carga/ordenes/<AAAA-MM>/<chofer>/<AAAA-MM-DD>/` con la **ficha del chofer** y la **orden.json** juntas.
La ficha vive SOLO aqui (en `procesados/` quedan unicamente los albaranes renombrados por referencia).
AAAA-MM y fecha = primera fecha de carga del viaje. Seguimiento por albaran: `datos/registro-procesamiento.csv`.

| Mes | Fecha | Chofer | Cabeza | Viajes | Albaranes | Ficha | Carpeta | Estado |
|---|---|---|---|---|---|---|---|---|
| 2026-09 | 2026-09-29 | francisco-asensi | - | - | - | `ficha_20261007140856.pdf` | `2026-09/francisco-asensi/2026-09-29/` | lote inicial (sin orden) |
| 2026-09 | 2026-09-28 | jose-antonio | - | - | - | `ficha_20261009134006.pdf` | `2026-09/jose-antonio/2026-09-28/` | lote inicial (sin orden) |
| 2026-09 | 2026-09-18 | miguel-pires | - | - | - | `ficha_20261009163943.pdf` | `2026-09/miguel-pires/2026-09-18/` | lote inicial (sin orden) |
| 2026-09 | 2026-09-30 | nuno-paiva | 8504 | 1 | 3 | `ficha_20261009185502.pdf` | `2026-09/nuno-paiva/2026-09-30/` | pendiente_carga |
| 2026-09 | 2026-09-25 | pablo-carles | 7963 | 1 | 2 | `ficha_20261009185306.pdf` | `2026-09/pablo-carles/2026-09-25/` | pendiente_carga |
| 2026-10 | 2026-10-05 | francisco-asensi | 2498 | 1 | 3 | `ficha_20261015125839.pdf` | `2026-10/francisco-asensi/2026-10-05/` | pendiente_carga |
| 2026-10 | 2026-10-02 | jose-carlos-alfonsin | 4916 | 1 | 3 | `ficha_20261009185701.pdf` | `2026-10/jose-carlos-alfonsin/2026-10-02/` | pendiente_carga |
| 2026-10 | 2026-10-05 | pedro-fraga-estevez | 5358 | 2 | 6 | `ficha_20261014185727.pdf` | `2026-10/pedro-fraga-estevez/2026-10-05/` | pendiente_carga |
| 2026-10 | 2026-10-02 | manuel-sabaris | 2256 | 1 | 3 | `ficha_20261022113522.pdf` | `2026-10/manuel-sabaris/2026-10-02/` | pendiente_carga (A3 ARACHEM tarifa_pendiente) |
| 2026-10 | 2026-10-13 | manuel-sabaris | 2256 | 1 | 2 | `ficha_20261022113621.pdf` | `2026-10/manuel-sabaris/2026-10-13/` | pendiente_carga (B2 = BALTRANSA 338681, precio fijo) |
| 2026-10 | 2026-10-14 | jose-ramon-pineiro | 8420 | 1 | 2 | `ficha_20261022114103.pdf` | `2026-10/jose-ramon-pineiro/2026-10-14/` | pendiente_carga (metanol normal) |

## Referencias
- Contrato del formato: `ordenes-carga/CONTRATO-orden-json.md`
- Libro maestro (seguimiento por albaran): `datos/registro-procesamiento.csv`
- Documentos por cliente/mes: `procesados/<CLIENTE>/<AAAA-MM>/` (solo albaranes por referencia; sin fichas).
