# Validador de Factura
Workflow `[ESTEVEZ] Validar Factura` (HvMzL9tlL8OBpGcM). Publicado.
URL: https://studio-julio.duckdns.org/form/validar-factura

## Que hace
Recibe el PDF de una factura ya emitida y la audita ANTES de enviarla al cliente.
Flujo: Form -> extraccion gpt-4o de lineas y conceptos -> auditoria (Code) -> informe.

## Chequeos
1. Importe de cada linea = cantidad x precio.
2. Minimo facturable 23 t (aviso).
3. Matricula presente en cada linea de viaje (error si falta).
4. Indexacion: el % corresponde al rango de fechas del viaje (grupo FORESA-BRESFOR); base = importe de transporte; importe = base x pct.
5. Falta de linea de indexacion en viajes que la requieren (error).
6. Cuadre: suma de lineas vs base imponible; IVA = base x %; total = base + IVA.

## Rangos de indexacion (embebidos, migrar a data table `indexacion` cuando exista)
grupo FORESA-BRESFOR:
- 2026-06-01 a 2026-06-15 = 0.1452
- 2026-06-16 a 2026-06-30 = 0.1279
- 2026-07-01 a 2026-07-15 = 0.1064
- 2026-07-16 a 2026-07-31 = 0.1064

## Pendiente
- Migrar rangos a la data table `indexacion` (grupo, desde, hasta, pct) cuando este creada.
- Anadir grupos QUIMIDROGA, HELM, OTROS.
- Criterio base REPARTOS (D-08).
- Regimenes agregados quincenal/mensual (Caldas-Ourense, Villagarcia-Caldas): hoy el validador asume indexacion por linea; para esos destinos habra que validar el agregado, no la linea.
