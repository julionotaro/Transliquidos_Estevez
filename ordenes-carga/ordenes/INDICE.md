# Índice de órdenes de carga

Cada orden es un archivo propio (un juego/ficha). No se acumulan en un solo JSON.
El seguimiento detallado por albarán está en el libro maestro `datos/registro-procesamiento.csv`.

| Fecha inicio | Chofer | Cabeza | Remolque(s) | Viajes | Albaranes | Archivo | Estado |
|---|---|---|---|---|---|---|---|
| 2026-09-25 | PABLO CARLES | 7963 | PO0628R | 1 | 2 | `orden_2026-09-25_pablo-carles_7963.json` | pendiente_carga |
| 2026-09-30 | NUNO PAIVA | 8504 | R4905BDF | 1 | 3 | `orden_2026-09-30_nuno-paiva_8504.json` | pendiente_carga |
| 2026-10-02 | JOSE CARLOS ALFONSIN | 4916 | R1783BBJ | 1 | 3 | `orden_2026-10-02_jose-carlos-alfonsin_4916.json` | pendiente_carga |
| 2026-10-05 | FRANCISCO ASENSI | 2498 | R1007BCV | 1 | 3 | `orden_2026-10-05_francisco-asensi_2498.json` | pendiente_carga |
| 2026-10-05 | PEDRO FRAGA ESTEVEZ | 5358 | R3487BCD/R8574BBC | 2 | 6 | `orden_2026-10-05_pedro-fraga-estevez_5358.json` | pendiente_carga |

## Referencias
- **Contrato del formato** (qué espera el bot): `ordenes-carga/CONTRATO-orden-json.md`
- **Libro maestro** (seguimiento por albarán): `datos/registro-procesamiento.csv`
- Documentos archivados por cliente/mes en `procesados/<CLIENTE>/<YYYY-MM>/`, cada albarán renombrado por su referencia.
