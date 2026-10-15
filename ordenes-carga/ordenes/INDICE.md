# Índice de órdenes de carga

Estructura: `ordenes-carga/ordenes/<AAAA-MM>/<chofer>/<AAAA-MM-DD>/` con la **ficha del chofer** y la **orden.json** juntas.
El AAAA-MM y la fecha salen de la **primera fecha de carga** del viaje.
Seguimiento por albarán: libro maestro `datos/registro-procesamiento.csv`.

| Mes | Fecha inicio | Chofer | Cabeza | Viajes | Albaranes | Carpeta |
|---|---|---|---|---|---|---|
| 2026-09 | 2026-09-25 | PABLO CARLES | 7963 | 1 | 2 | `2026-09/pablo-carles/2026-09-25/` |
| 2026-09 | 2026-09-30 | NUNO PAIVA | 8504 | 1 | 3 | `2026-09/nuno-paiva/2026-09-30/` |
| 2026-10 | 2026-10-02 | JOSE CARLOS ALFONSIN | 4916 | 1 | 3 | `2026-10/jose-carlos-alfonsin/2026-10-02/` |
| 2026-10 | 2026-10-05 | FRANCISCO ASENSI | 2498 | 1 | 3 | `2026-10/francisco-asensi/2026-10-05/` |
| 2026-10 | 2026-10-05 | PEDRO FRAGA ESTEVEZ | 5358 | 2 | 6 | `2026-10/pedro-fraga-estevez/2026-10-05/` |

## Referencias
- Contrato del formato: `ordenes-carga/CONTRATO-orden-json.md`
- Libro maestro: `datos/registro-procesamiento.csv`
- Documentos por cliente/mes: `procesados/<CLIENTE>/<AAAA-MM>/` (albaranes por referencia).
