# Tabla de traducción — punto usado → código Gesruta

Cruce de `Listado_de_viajes.csv` (214 puntos usados en 3.267 viajes) contra
`Tabla_puntos_geograficos.csv` (807 puntos del catálogo). Ambos leídos en **cp850**.

**Los 214 emparejan al 100% por nombre exacto.** Ningún punto usado falta del catálogo,
así que no hay cola de emparejamiento pendiente.

`Cód.Pto.` es la clave que entiende Gesruta: es lo que el robot tendrá que teclear.
Usarlo como `id_punto`.

**Aviso sobre el catálogo original:** de sus 18 columnas, solo `Punto`, `Cód.Pto.` y
`Provincia` (73 de 807) tienen datos. `País`, `Cliente`, `Ruta` y `Cód.Postal` están vacías.
No usarlas como fuente.

**Cinco duplicados sin resolver** — mismo nombre exacto, dos códigos, ambos en uso:
`GARNICA PLYWOOD` (GARNI/GARNL) · `GUADALAJARA` (GU/GUADA) · `GUARDA (PT)` (GUAR/GUARD) ·
`RENTERIA` (RENT/RENTE) · `SEGOVIA` (SG/SEGOV). El criterio "el más frecuente" **no se puede
aplicar**: el listado de viajes trae el nombre, no el código. Pendiente de decisión de Julio.

**Excluidos por decisión de Julio** (errores de carga, no son puntos válidos):
`FRANCIA` (5 usos, es un país) y `MATRIC. PO4034AY` (es una matrícula).

---

| Punto | Usos | Cód.Pto. | Provincia |
|---|---|---|---|
| CALDAS DE REIS | 2010 | `1` | PONTEVEDRA |
| OREMBER | 1008 | `OR` | ORENSE |
| VILLAGARCIA | 421 | `2` | PONTEVEDRA |
| AVEIRO | 359 | `AVEIR` |  |
| UTISA TERUEL | 358 | `UTI` | TERUEL |
| TORDESILLAS | 330 | `TORD` |  |
| BARCELONA | 314 | `B` | BARCELONA |
| TARRAGONA | 132 | `T` | TARRAGONA |
| IP DECOR SPAIN, SAU | 91 | `IPDEC` |  |
| MIRANDA DE EBRO | 60 | `MIRAN` |  |
| ORENSE | 56 | `OU` | ORENSE |
| TERMOLAN, S.A. | 49 | `TERMO` |  |
| VALDEMORO | 48 | `VALDE` |  |
| LEIRIA (PT) | 44 | `LEIRI` |  |
| CURIA SPAIN, SAU | 40 | `CURIA` |  |
| URSA IBERICA, S.A. | 40 | `URSA` |  |
| BRAGA (PT) | 38 | `BRAGA` |  |
| HUELVA | 33 | `H` | HUELVA |
| NEFAB PONTEV. SL | 27 | `NEFAB` |  |
| VIGO | 26 | `VIGO` | PONTEVEDRA |
| SANTAREM | 22 | `SANTA` |  |
| COGERSA | 20 | `COGER` |  |
| REINOSA | 19 | `REINO` |  |
| CURTIS | 18 | `CURTI` |  |
| SEVILLA | 17 | `SE` | SEVILLA |
| KRONOSPAN, S.L. | 14 | `KRONO` |  |
| DROGAS VIGO, S.L. | 13 | `DROVI` |  |
| VILANOVA FAMALICAO | 13 | `FAMAL` |  |
| SETUBAL | 12 | `SETUB` |  |
| ESTARREJA | 12 | `ESTAR` |  |

*(se listan los 30 más usados; la tabla completa de los 214 está en el chat de diseño
y se puede regenerar del CSV con el script del bootstrap)*
