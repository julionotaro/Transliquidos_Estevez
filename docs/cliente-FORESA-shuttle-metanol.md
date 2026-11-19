# Cliente FORESA — SHUTTLE metanol Villagarcía → Caldas de Reis

> Regla de dominio confirmada por Julio el **18/11/2026**. Memoria operativa espejo:
> `catalogo/correcciones-julio.json` (entrada 2026-11-18, cliente FORESA, campo facturación).
> Herramienta: `herramientas/armar_orden/excel_metanol.py`.

## Qué es

Entrada de **metanol importado** a la planta de FORESA: se carga en **VILLAGARCÍA**
(muelle do Ferrazo) y se descarga en **CALDAS DE REIS** (la propia FORESA). El mismo
camión/cisterna hace **varios viaxes el mismo día** (ida y vuelta corta, ~38 km/viaxe).
Cada viaxe trae su **albarán FORESA tipo II.EE. / ARC** (`ALB 2600xxxxx`, "Albarán de
entrega y Circulación / Carta de porte"), con su **NETO en kilos** (~26.300–26.700 por
viaxe).

Es el flujo que antes figuraba como *"único metanol no implementado"* (correcciones
2026-10-22). **Ya está implementado** con la regla de abajo.

## Regla de facturación (NO negociable)

**NO se factura un albarán por viaxe.** Se **SUMAN las cantidades cargadas por DÍA**
(todos los albaranes del mismo día, de la misma tractora) y se carga **UNA sola línea
de albarán**:

- **cantidad** = total de TN sumadas del día (Σ netos / 1000), um = **TN**.
- **precio** = tarifa de la ruta = **3,68 €/TN** (confirmado).
- **referencia** = **VACÍA** (el shuttle agregado va sin número de referencia).
- **concepto P, IVA 21** (FORESA es cliente español → nacional).
- **indexación G 0,1553 ACUMULADA** (`cargar: false` en la orden; el importe se calcula
  y se guarda en el libro maestro solo para control de totales — grupo FORESA-BRESFOR).

Una línea de Gesruta por **día** (no por viaxe). Si el período abarca varios días, una
línea por cada día cargado.

## Archivo Excel para pegar (como FRIGOS)

Además de la orden, se genera un archivo **para copiar/pegar en el Excel de control**
de Julio (igual que en CLAVO/FRIGOS):

```
python3 -I herramientas/armar_orden/excel_metanol.py <raw.json> [<salida.xlsx>]
```

Emite, por **tractora**, una **fila por día** con columnas: cada cantidad del día
(`Alb1..AlbN`) + **TOTAL kg** + **TOTAL TN**. Julio pega esa fila en la hoja de la
tractora del mes.

## Aplica a TLE propio **y** a THEC/PROVE

El shuttle lo puede hacer un chofer **TLE propio** (ej. Marcos Eirín, 3729JLH) o un
chofer **THEC** con químico FORESA, que se carga con el **modelo PROVE** (empresa TLE,
`proveedor 5`, `cabeza="PROVE"`, km/costos vacíos — ej. José J. Ferreira Goldar,
8382JJS). **La regla de suma diaria es idéntica** en ambos casos; lo único que cambia
es la cabecera del viaje (matrícula propia vs PROVE). La agrupación es por
**tractora + día**.

## Cómo se arma el raw

Un albarán por día en `herramientas/armar_orden/raw/<chofer>-<fecha>.json`:

```json
{ "cliente_lit": "FORESA IND.QUIMICAS DEL NOROESTE, S.A.",
  "origen_lit": "VILLAGARCIA", "destino_lit": "CALDAS DE REIS", "carga_lit": "METANOL",
  "referencia": "", "archivo": "metanol-<chofer>-<YYYY-MM-DD>",
  "salida": "DD/MM/2026", "llegada": "DD/MM/2026",
  "peso_kg": <suma netos del dia>, "km_pendiente": true,
  "shuttle_cantidades": [<neto1>, <neto2>, ...] }
```

- `shuttle_cantidades` dispara el Excel y documenta los viaxes del día. `peso_kg` debe
  ser su suma.
- `referencia: ""` + `archivo` fijan el nombre del PDF (`metanol-<chofer>-<fecha>.pdf`);
  `validar_raw.js` acepta `archivo` y `shuttle_cantidades` en la whitelist.
- **Archivo**: los albaranes del día se **concatenan en un solo PDF**
  `procesados/FORESA/<YYYY-MM>/Villagarcia-Caldas (Metanol)/metanol-<chofer>-<YYYY-MM-DD>.pdf`
  (orden de carpetas FORESA, Julio 19/11: **mes ANTES que ruta**).

## Caso parcial / AVERÍA (fallar ruidoso)

Si la **ficha dice N viaxes** pero en el escaneo solo hay **M albaranes** (típico por
avería: *"AVERÍA ROTURA MANGUITO…"* — un viaxe se abortó), se factura la **suma de los
M albaranes que EXISTEN** y se **marca REVISAR** para que Julio confirme si falta sumar
el viaxe no documentado. **Nunca** inventar la cantidad faltante. (Ej. Jorge Ferreira
121814, 05/11: ficha "2 viaxes", 1 albarán 26320 → se factura 1, se reporta.)

## NO confundir con metanol a CLIENTE

Metanol con **destino un cliente** (ej. Villagarcía→**Valladolid**/Curia, Villagarcía→
**Gijón**/COGERSA) **NO es el shuttle**: se factura **normal**, por su **referencia y
peso propios** (ref = **OC `26xxxxx`** si la hay; si no, el **ALB `2600xxx`**), línea
€/TN + idx por línea. Solo Villagarcía→**Caldas** (entrada a FORESA) va por suma diaria.

## Casos procesados (trazabilidad)

| Juego | Chofer | Modelo | Día(s) | Viaxes → kg |
|---|---|---|---|---|
| 121641 | J. Ferreira (THEC) | PROVE | 02/11; 03/11 | 5→131500 ; 5→131460 |
| 121814 | J. Ferreira (THEC) | PROVE | 05/11 | 1→26320 (ficha 2, AVERÍA 2º) |
| 121918 | J. Ferreira (THEC) | PROVE | 06/11 | 5→131580 |
| 121113 | Marcos Eirín (TLE) | propio | 10/11 | 6→160100 |

---

## LECCIÓN 19/11 — Lectura de NETO: bandas de ≤3 páginas

Error detectado por Julio: en el juego 131031 (Ferreira) el 10/11 se había leído
`157.880` cuando era `157.860` (el ALB 2600003549 es 26.300, no 26.320).

**Causa raíz:** al rasterizar los albaranes FORESA en "bandas" (recorte girado 90°, varios
albaranes apilados en una imagen), con **≥6 albaranes por banda** los dígitos del NETO se
comprimen y se confunde 26.300 con 26.320.

**Regla firme:** rasterizar **≤3 albaranes por banda** (helper `cs_metanol.py`) y **cruzar
siempre `NETO = Bruto − Tara`** en cada albarán. Re-verificado así todo el metanol de la
tirada (131031, 161950, 162300): el único error era el 10/11 de 131031.
