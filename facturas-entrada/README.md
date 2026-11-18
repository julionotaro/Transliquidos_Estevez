# facturas-entrada/

**Bandeja de entrada de facturas.** Julio sube acá los PDF de las facturas emitidas
(una o varias). Claude (nube) las procesa: lee las referencias, mueve los scans
respaldatorios a `facturados/…` y actualiza el libro maestro.

Igual que `entrada/` con los juegos: **después de procesada, la factura sale de
acá** (queda archivada dentro de su carpeta en `facturados/`). Esta carpeta debe
quedar vacía entre tandas.

Flujo completo: `docs/flujo-facturados.md`.
