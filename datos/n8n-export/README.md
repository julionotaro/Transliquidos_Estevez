# Export de las tablas de n8n → git

Copia/respaldo de las Data Tables de n8n (Studio-julio), volcadas a CSV para que los
datos **existan fuera del servidor** y éste pueda darse de baja. Decisión de Julio 08/10/2026
(ver `docs/flujo-carga-y-registro.md`).

- Delimitador `;`, UTF-8. Las celdas que eran objetos/listas quedan como JSON entre comillas.
- Fecha de este export: 2026-10-08. Conteos en `_meta-export.json`.
- Tablas vacías en el momento del export: `facturacion_reglas`, `aprobaciones_pendientes`.

Varias de referencia también tienen su fuente original en `datos/gesruta/`
(puntos, tarifas, indexación) y en `catalogo/`. Esto es el espejo de la versión curada en n8n.

Reproducir el export: crear un workflow con Manual Trigger → un nodo **Data Table**
(`operation: get`, `returnAll: true`) por tabla, ejecutarlo (test), y volcar
`data.resultData.runData[<tabla>][0].data.main[0]` a CSV.
