# facturados/

Scans de viajes **ya facturados**, sacados de `procesados/` para que buscar el
respaldo de una factura sea directo.

## Estructura (Julio 17/11)

```
facturados/<AÑO>/<MM-mes de FACTURACIÓN>/<CLIENTE>/<Nº factura>/
    <ref1>.pdf
    <ref2>.pdf
    FACTURA-<Nº>.pdf        (la factura, si se subió)
```

- **Mes de FACTURACIÓN**, no de emisión: el período que cubre la factura. Una
  factura puede incluir viajes de un mes anterior que quedaron pendientes porque
  el chófer no entregó la documentación antes del corte (facturación quincenal).
- Un scan deja `procesados/` y pasa acá cuando su referencia entra en una factura.

## Cómo se llena (no mover a mano)

1. Julio sube la factura (PDF) a `facturas-entrada/`.
2. Claude (nube) lee las referencias de la factura, las cruza contra el libro
   maestro (`datos/registro-procesamiento.csv`) y mueve cada scan con
   `herramientas/facturar/mover-facturados.js` (actualiza `pdf_doc` del registro
   y anota en `datos/facturacion-log.csv`). Ver `docs/flujo-facturados.md`.
