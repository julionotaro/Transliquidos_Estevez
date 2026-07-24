# Reglas de facturacion — derivadas del contraste FACTURACION JUNIO 2026
Fuente: 32 facturas finales + soportes (23-24/07/2026) + correcciones de Julio en sesion.

## Estructura factura Gesruta
- Dos formatos: (a) tabla de viajes FECHA/REF/MATRICULA/ORIGEN/DESTINO/MERCANCIA/CANTIDAD/PRECIO/IMPORTE; (b) factura de conceptos (PARALIZACION, alquileres, servicios) con CONCEPTO/CANTIDAD/PRECIO/DTO.
- Linea de indexacion: CANTIDAD = base, PRECIO = pct decimal, IMPORTE = base x pct. Etiquetas: INDEXACION GASOLEO / ...1a-2a QUINCENA / ...PORTUGAL. La etiqueta es texto de Gesruta, NO indica solapa.
- Una factura puede mezclar viajes de meses distintos: el pct se determina por FECHA DEL VIAJE (tramo vigente), no por mes de factura.
- El pct sale de la solapa del grupo + tramo de fechas. Los tramos dependen de como se actualizo ese mes: puede ser quincenal, una vez al mes, o mas. NO asumir quincenas fijas.

## Grupos de indexacion (confirmado)
- FORESA y BRESFOR -> solapa FORESA-BRESFOR.
- QUIMIDROGA -> solapa QUIMIDROGA. HELM -> solapa HELM.
- RNM -> solapa OTROS (el 0,15 de junio es el valor de OTROS; RNM no tiene solapa propia).
- Regimenes agregados (Orember quincenal segun tramos vigentes; metanol Villagarcia->Caldas mensual, con lineas agregadas por tramo de pct dentro del mes).
- Baltransa: la factura SI lleva linea INDEXACION GASOLEO a 0,000 (incluida en precio = linea a cero).

## Baltransa (confirmado en facturas 274/281/282/287/288)
- Documento del cliente: se titula ORDEN DE CARGA Nº (no Orden de Transporte).
- PRECIO cerrado (ej 2.050,00 EU) -> cantidad 1,000 en factura, importe = precio.
- PRECIO por tonelada (sufijo /TN, ej 60,00 EU/TN) -> cantidad = tn reales, importe = tn x tarifa (fra 274: 25,140 x 60,00).
- P 21% SIEMPRE, incluso destinos PT/FR. Pendiente: confirmar si aplica minimo 23t al caso por tonelada.

## Conceptos
- PARALIZACION: se determina COMERCIALMENTE, no hay regla ni documento fuente. Se factura como concepto aparte con referencia de albaran (Baltransa 400 eur/ud; Bresfor 40 eur/ud con OK PARALIZACION del cliente). El validador no puede calcularla: solo listarla.
- REPARTOS: cuando un camion tiene DOS DESTINOS para una misma carga -> 90 eur de traslado en el albaran. Linea aparte, FUERA de la base de indexacion (D-08 confirmado en fra 298).
- Rectificativas: fra 273 fue ANULADA por FACT 26-000013; fra 277 refactura los mismos albaranes. Referencias repetidas entre facturas pueden ser rectificacion legitima -> el detector de duplicados debe considerar anulaciones.
- Duplicado real detectado: fra 295 repite la linea ref 2609289 dentro de la misma factura, y la ref aparece tambien en fra 312. Revisar.

## Foresa
- Facturacion separada por servicio: Orember / Metanol Caldas / Metanol Otros / Retornos (por origen) / Caldas Otros / Paralizaciones.
- Metanol Villagarcia->Caldas: varias cargas por dia por tractora, lineas diarias por tonelaje real (26-159 tn/dia), sin minimo 23t, sin referencia, precio 3,68 (jun-2026). Indexacion agregada mensual con lineas por tramo de pct.
- Minimo 23t visible en facturas: lineas con cantidad exacta 23,000 = minimo aplicado.
- Tarifario oficial cargado en tabla `tarifas` (vigor 2025-01-01, DESACTUALIZADO: junio 2026 factura ~+2% en general Espana; retorno Huelva fenol 83,75 vs 80,18). Pendiente: tarifa Foresa 2026 oficial.
- Clientes especiales con recargo por descarga (+6h 160 eur; Nalco multi-descarga): condicion anotada en campo destino de la tabla.

## Otros clientes observados (junio 2026)
- TRANSTAMBRE: por tn (45,00 aceite) o cerrado; indexacion por linea (valores de OTROS); P 21%; sin referencia.
- TANK SOLUTIONS: cerrado, SIN indexacion; con referencia corta.
- TRANSPORTES SANTOS: cerrado, SIN indexacion; referencia larga (2026xxxxxx).
- FORESTAL DEL ATLANTICO: cerrado + indexacion por linea; P 21% aunque destino Francia.
- QUIMICAS DEL JARAMA: por tn + indexacion (OTROS); referencia formato T-33/562/26.
- HISPALENSE DE LIQUIDOS: por tn, SIN indexacion; referencia C00xxxxx.
- CB SYSTEM OIL: alquiler de cisternas (conceptos: alquiler 15 dias 1.000, recogida, traslado, lavado 200). No son viajes.
- CLAVO FOOD FACTORY: factura por KILOMETROS (1,52 y 1,31 eur/km, congelado/pan, multi-destino). Criterio 1,52 vs 1,31 desconocido; se resolvera cuando toque un caso.

## Tarifas y datos cargados (24/07/2026)
- Tabla `tarifas` (Siwhv2AUWTSeFlrJ): FORESA 89 filas (PDF vigor 2025-01-01), HELM 69 filas (Excel TARIFAS 2026 v.3, precio cerrado por viaje, vigencias por fila — OJO: el archivo venia nombrado QUIMIDROGA pero su contenido es HELM, verificado contra fra 300), RNM 53 filas (Excel 2026, eur/tn + eur/viaje).
- Tabla `indexacion` (or1otD9WsjJ3V8Cr): 46 tramos migrados del validador (FORESA-BRESFOR, HELM, QUIMIDROGA, OTROS). AGENCIA y AUTONOMOS pendientes (no estaban en el codigo).
- Falta: tarifa QUIMIDROGA real (eur/tn), tarifa FORESA 2026, solapas AGENCIA y AUTONOMOS.
