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

1. **Julio sube** el/los PDF de factura a `facturas-entrada/` (puede ser un único PDF
   con **todas** las facturas del período, decenas de páginas).
2. **Correr el orquestador** (primero en seco, después aplicar):
   ```
   python3 -I herramientas/facturar/procesar-facturas.py facturas-entrada/<archivo>.pdf
   # revisar el DRY-RUN (cuántos scans por factura, a qué carpeta); si está bien:
   python3 -I herramientas/facturar/procesar-facturas.py facturas-entrada/<archivo>.pdf --mover
   ```
   Lee el PDF (capa de texto), separa **cada factura** (cliente, Nº, **Fecha** de
   facturación, referencias), parte sus páginas en un `FACTURA-<Nº>.pdf`, cruza las
   referencias contra el libro maestro y, por cada factura con scans nuestros, llama a
   `mover-facturados.js`. **Mes de facturación = mes del campo "Fecha" de la factura**
   (NO "Emisión"). Reporta aparte: facturas con refs que no son nuestras, facturas
   **sin referencia** (CLAVO por km, o clientes que facturan sin nº de ref) y anomalías.
3. `mover-facturados.js` (lo llama el orquestador, o se corre suelto para una factura),
   por cada referencia: la busca en `datos/registro-procesamiento.csv` (columna
   `referencia`), **mueve** su `pdf_doc` al destino, **actualiza** el `pdf_doc` del
   registro, deja marca en `observaciones` (`FACTURADO fra <Nº> (<mes>)`) y anota en
   `datos/facturacion-log.csv`. Idempotente (si ya está en `facturados/`, lo saltea) y
   ruidoso (ref que no está o archivo faltante → **no mueve nada** y avisa).
   ```
   node herramientas/facturar/mover-facturados.js --cliente <C> --factura <Nº> \
     --mes <AAAA-MM> --refs r1,r2 [--factura-pdf <ruta>] [--mover]
   ```
4. **Validar** (`python3 -I herramientas/validar_carga.py`) y **commitear**: el validador
   sigue en verde porque `pdf_doc` apunta al nuevo lugar (el archivo existe). Vaciar
   `facturas-entrada/`.

> ⚠️ **NO borrar scans a mano de `procesados/` al facturar.** Borrarlos deja el registro
> apuntando a archivos inexistentes (validador en rojo) y pierde el respaldo. Siempre
> **mover** con la herramienta (el 18/11 pasó: 49 scans borrados a mano se restauraron de
> git y se archivaron con el flujo).

## Notas
- Una factura es de **un** cliente: si las referencias apuntan a clientes distintos
  en `procesados/`, la herramienta para y avisa (posible error de refs).
- **Rectificativas:** las facturas rectificativas corrigen una factura previa, no traen
  referencias de viaje (0 scans) y referencian el Nº de la factura original → hoy el
  parser las agrupa con esa factura. No afecta scans ni registro (mejora futura: detectar
  su propio Nº).
- **CLAVO (FRIGOS)** se factura distinto (Excel por km, sin `referencia` en el
  registro): si hace falta archivar sus talones facturados, se mueven por nombre de
  archivo, no por referencia (pendiente de definir con Julio cuando surja).
- `datos/facturacion-log.csv` queda como índice de qué referencia entró en qué
  factura (cliente, mes, origen/destino del scan).
