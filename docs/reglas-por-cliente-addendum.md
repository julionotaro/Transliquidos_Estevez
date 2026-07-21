# Reglas por cliente — addendum
Correcciones posteriores a `reglas-por-cliente.md` v1. Prevalecen sobre lo alli escrito.

## A-01 — HELM: el precio es el del documento
Queda **resuelto el conflicto abierto** de la v1.
Para HELM **manda la tarifa que figura en la Orden de Transporte** (campo `Coste de transporte`,
ej. 1.960,00 EUR). **No se usa el tarifario** para este cliente.
La indexacion (solapa HELM, por viaje) se aplica sobre ese importe.
Si la OC no trae importe legible → `revision_humana`.

Efecto en el flujo: el nodo Formatear ya no contrasta HELM contra tarifario; toma
`importe_documento` como precio base directo.
