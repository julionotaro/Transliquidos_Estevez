# Addendum ONBOARDING — cierres y tablas creadas
Complementa ONBOARDING.md. Ultima sesion.

## Criterios cerrados
- **D-08 REPARTOS**: los 90 EUR de traslados NO entran en la base de indexacion. La indexacion se calcula solo sobre el precio del viaje. (El validador ya lo hacia asi.)
- **Quimidroga Barcelona -> Leiria (PT)**: 88,25 EUR/tonelada. Hueco cerrado (coincide con ref 702704 de la factura 2026/317).

## Data tables creadas (IDs reales)
Project: grgBpWySVCpXvuii
| Tabla | ID |
|---|---|
| tarifas | Siwhv2AUWTSeFlrJ |
| indexacion | or1otD9WsjJ3V8Cr |
| viajes | lrBxWpTUxMtO8U48 |
| ultimo_km_tractora | QzSfS4rYbsr5rjps |
| facturacion_reglas | PENDIENTE (fase de envio, no urgente) |

## Nota tecnica importante
SI se pueden crear data tables por MCP: tool `create_data_table`. Tambien add_data_table_rows,
add/rename/delete_data_table_column. (Contradice la asuncion previa de que solo se creaban por UI.)
Pendiente: verificar en chat nuevo las columnas exactas de las 4 tablas antes de conectar persistencia,
porque el codigo debe coincidir con los nombres de columna reales.

## Unico pendiente de dominio
- Baltransa: pasar una factura o documentos reales para inferir porte, referencia y tarifa (como se hizo con Foresa/Quimidroga/RNM).

## Primeras acciones del chat nuevo
1. Leer columnas reales de tarifas/indexacion/viajes/ultimo_km_tractora.
2. Migrar las 6 tablas de indexacion embebidas en el validador (IlIod0DlephaLmAV) a la data table indexacion.
3. Cargar tarifas reales en la tabla tarifas.
4. Conectar persistencia de la ingesta (WD0q9Ic0oDvUoJwp): guardar viajes + actualizar ultimo_km_tractora.
