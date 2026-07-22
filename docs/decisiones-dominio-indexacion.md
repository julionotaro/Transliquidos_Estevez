# Decisiones de dominio — addendum indexacion y facturacion
Correcciones y precisiones posteriores. Prevalecen sobre `decisiones-dominio.md` v0.

## D-06 — Regimen de indexacion es POR TIPO DE SERVICIO, no por factura
Corrige el criterio previo. Dentro de una misma factura Foresa conviven regimenes distintos segun destino:
- **Caldas de Reis -> Ourense (Orember)**: agregada **quincenal**. Puede abarcar parte de dos quincenas en una factura.
- **Villagarcia -> Caldas (metanol)**: agregada **mensual**. Puede abarcar parte de dos meses.
- **Foresa a cualquier OTRO destino** (Barcelona, Teruel, Tarragona, La Rioja, Alava, Nefab, Termolan, tableros, etc.): indexacion **POR VIAJE**, linea a linea.

Consecuencia: una factura Foresa puede legitimamente abarcar mas de un mes. NO es error mezclar fechas.

## D-07 — El porcentaje de indexacion se fija por RANGO de fechas, no por dia
El % sale de la planilla suplemento gasoleo segun grupo + rango de fechas (habitualmente quincena).
Dentro de un mismo rango, todos los viajes llevan el MISMO %.
Dos viajes del mismo cliente en la misma quincena con % distinto = ERROR.

Rangos confirmados grupo FORESA-BRESFOR (de la factura 2026/315):
| desde | hasta | pct |
|---|---|---|
| 2026-06-01 | 2026-06-15 | 0.1452 |
| 2026-06-16 | 2026-06-30 | 0.1279 |
| 2026-07-01 | 2026-07-15 | 0.1064 |

## D-08 — Base de la indexacion
La indexacion se calcula sobre el **importe de transporte de la linea** (cantidad x precio).
PENDIENTE de confirmar (Julio): en viajes con linea REPARTOS (descarga multiple, 90 EUR/reparto),
si la base incluye o no el importe de repartos. Hasta confirmar: el validador marca 'verificar', no penaliza.

## D-09 — Termolan
Los viajes a Termolan (tarifa 28,89 EUR/t) SI llevan indexacion. Su ausencia es un error a marcar.

## Errores detectados en factura 2026/315 (devuelta por el cliente)
1. ref 2003578 (Teruel-Burriana): OK, tiene indexacion. Pendiente criterio base REPARTOS (D-08).
2. ref 2009582 y 2009884 (Termolan): FALTA linea de indexacion (D-09).
3. ref 2008011 (29/06): indexacion 0.1064 (tarifa julio) aplicada a viaje de junio. Correcto: 0.1279.
4. ref 2005525 (19/06): indexacion 0.1517, valor huerfano. Correcto: 0.1279.
5. ref 2008832 (03/07 Tarragona): sin matricula. Revision.
