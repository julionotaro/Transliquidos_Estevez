# Alias reales — lo que escribe el chófer vs. el punto de Gesruta

Cruce de 30 fichas escaneadas (jul-ago 2026) contra `Cruce_con_fichas_chofer_des_Julio.xls`
(901 viajes, jun-ago 2026, con Chofer/Cabeza/Remolque). Llave de cruce: **chófer + fecha +
matrícula** — no nombre. Es la primera vez que se dispone de la escritura real del chófer
enfrentada al dato ya cargado en Gesruta.

**Confianza:** alta = único viaje posible para ese chófer/fecha. media = varios candidatos
el mismo día, se eligió por material/cliente coherente.

---

## Patrón A — Plantas propias: coincide casi directo

| Ficha escribe (carga) | Punto Gesruta | Cliente | Confianza |
|---|---|---|---|
| FORESA / CALDAS, CALDAS DE REIS, CALDASDEREIS | CALDAS DE REIS | FORESA | alta (~90% de las fichas) |
| FORESA / VILLAGARCIA, VILAGARCIA, VILLAGARCIA D.A. | VILLAGARCIA | FORESA | alta |
| BRESFOR / AVEIRO | AVEIRO | BRESFOR | alta |

## Patrón B — Empresa como destino: el chófer ya escribe el nombre de Gesruta

| Ficha escribe | Punto Gesruta | Confianza |
|---|---|---|
| TERMOLAN | TERMOLAN, S.A. | alta |
| ALCOVER QUIMICA | ALCOVER QUIMINA, S.L. | alta |
| URSA (lugar: Tarragona) | destino registrado como TARRAGONA, no URSA | media — Gesruta guarda la ciudad, no el nombre de empresa, en este caso |

## Patrón C — La confirmación importante: nombre de carga NO es el cliente

El chófer escribe el nombre de la instalación donde se carga físicamente. Esa instalación
no es el cliente — el cliente es quien emite la orden de transporte. Confirmado con datos
reales, no es solo regla teórica:

| Ficha escribe (nombre_carga) | Lugar ficha | Cliente real en Gesruta | Punto real |
|---|---|---|---|
| RELISA | Barcelona | QUIMIDROGA, S.A. | BARCELONA |
| TEPSA | Barcelona | QUIMIDROGA, S.A. | BARCELONA |
| BONDALTI | Estarreja (PT) | RNM TRANSPORTES QUIMICOS | ESTARREJA |
| DIVERSEY | Valdemoro | probable BALTRANSA (a confirmar) | VALDEMORO |
| MOEVE | Huelva | viaje de vuelta hacia FORESA/Caldas | HUELVA |
| ASTURIANA DE ZINC | Avilés | sin confirmar | AVILES |

**Consecuencia para el resolvedor:** cuando `nombre_carga` de la ficha coincida con uno de
estos nombres, NO debe interpretarse como cliente. Debe tratarse como alias del punto
únicamente, y el cliente sale de otra fuente (la OC o el histórico).

## Patrón D — OREMBER: alerta de variabilidad extrema

El segundo punto más usado del sistema (1.008 viajes) aparece escrito de al menos siete
formas distintas por distintos chóferes en solo 30 fichas:

`OROMBOR` · `OROMBER` · `ORENBER` · `OREMBEL` · `ORENTBER` · `OREMBEA` · y en un caso
`FINSO` (posible variante extrema, a confirmar con más muestra)

Ninguna de estas pasa el filtro de distancia de edición ≤1 letra que usa el resolvedor
automático. Este punto necesita una lista de alias explícita y generosa, no solo el
algoritmo genérico. Es el caso que más vale la pena sembrar a mano.

## Discrepancia sin resolver — no se adivina, se marca

Ficha de José A. Vázquez, 6/8/2026: escribe descarga "Avilés". El viaje real de Gesruta
de esa fecha/matrícula registra destino NAVIA. Son dos localidades cercanas de Asturias
pero distintas. No hay dato suficiente para saber si es imprecisión del chófer o un error.
Pendiente de confirmación de Julio — no aliasear sin más.

## Confirmado también: abreviación por caída de prefijo

`FAMALICAO` (ficha) → `VILANOVA FAMALICAO` (Gesruta). El chófer omite la primera palabra.
Patrón a tener en cuenta para otros puntos con nombre compuesto.

## Nota sobre representatividad

30 fichas de una muestra más amplia, concentradas en jul-ago 2026 y dominadas por FORESA
(patrón fácil). Los patrones B, C y D son los que aportan valor real porque no se podían
deducir del histórico de Gesruta — solo aparecen comparando la ficha contra el dato ya
cargado. Antes de dar esta tabla por cerrada convendría una segunda tanda con más variedad
de clientes (Baltransa, Helm, Clavo Food) y, si es posible, la ficha junto al documento de
transporte del mismo viaje.
