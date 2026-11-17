# Flujo de facturados — mover scans de `procesados/` a `facturados/`

**Problema (Julio 17/11):** la facturación es **quincenal** para casi todos los
clientes. Cuando sale una factura, sus scans siguen mezclados en
`procesados/<CLIENTE>/<mes>/` con los que **todavía no se facturaron** (pueden
quedar pendientes los viajes cuyo chófer no entregó la documentación antes del
corte). Buscar el respaldo de una factura se vuelve difícil.

**Solución:** una carpeta `facturados/` donde se mueven los scans de las
referencias ya facturadas, organizada **por factura**:

```
facturados/<AÑO>/<MM-mes de FACTURACIÓN>/<CLIENTE>/<Nº factura>/
```

> **Mes de FACTURACIÓN, no de emisión.** Es el período que la factura cubre. Si una
> factura de noviembre incluye un viaje de octubre que quedó pendiente, ese scan va
> igual bajo el **mes que la factura factura** (lo indica Julio / lo trae la factura),
> no bajo la fecha en que se emitió el documento.

## Procedimiento (Claude nube)

1. **Julio sube** el/los PDF de factura a `facturas-entrada/`.
2. **Leer la factura** y extraer: cliente, **Nº de factura**, **mes de facturación**
   y la **lista de referencias** facturadas. (En la primera factura de cada formato,
   mirar bien dónde está la columna de referencia; no inventar. Si el mes de
   facturación no es obvio, **preguntar a Julio** — no asumir por la fecha de emisión.)
3. **Mover** (primero en seco, después aplicar):
   ```
   node herramientas/facturar/mover-facturados.js \
     --cliente <CLIENTE> --factura <Nº> --mes <AAAA-MM> \
     --refs <ref1,ref2,...> [--factura-pdf facturas-entrada/<archivo>.pdf]
   # revisar el DRY-RUN; si está bien, repetir con --mover
   ```
   La herramienta, por cada referencia: la busca en el libro maestro
   (`datos/registro-procesamiento.csv`, columna `referencia`), **mueve** su `pdf_doc`
   al destino, **actualiza** el `pdf_doc` del registro, deja marca en `observaciones`
   (`FACTURADO fra <Nº> (<mes>)`) y anota una fila en `datos/facturacion-log.csv`.
   Es **idempotente** (si ya está en `facturados/`, lo saltea) y **ruidoso** (si una
   referencia no está en el registro o falta el archivo, **no mueve nada** y lo avisa).
4. La factura PDF se copia dentro de la carpeta de la factura (`FACTURA-<Nº>.pdf`) y
   sale de `facturas-entrada/`.
5. **Validar** (`python3 -I herramientas/validar_carga.py`) y **commitear**: el
   validador sigue en verde porque `pdf_doc` apunta al nuevo lugar (el archivo existe).

## Notas
- Una factura es de **un** cliente: si las referencias apuntan a clientes distintos
  en `procesados/`, la herramienta para y avisa (posible error de refs).
- **CLAVO (FRIGOS)** se factura distinto (Excel por km, sin `referencia` en el
  registro): si hace falta archivar sus talones facturados, se mueven por nombre de
  archivo, no por referencia (pendiente de definir con Julio cuando surja).
- `datos/facturacion-log.csv` queda como índice de qué referencia entró en qué
  factura (cliente, mes, origen/destino del scan).
