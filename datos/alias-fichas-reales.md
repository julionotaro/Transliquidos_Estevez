# Alias reales — lo que escribe el chófer vs. el punto de Gesruta

Cruce de 30 fichas escaneadas (jul-ago 2026) contra `Cruce_con_fichas_chofer_des_Julio.xls`
(901 viajes, jun-ago 2026, con Chofer/Cabeza/Remolque). Llave de cruce: **chófer + fecha +
matrícula** — no nombre.

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

## Patrón D — OREMBER: alerta de variabilidad extrema + identidad de la empresa

El segundo punto más usado del sistema (1.008 viajes) aparece escrito de al menos siete
formas distintas por distintos chóferes en solo 30 fichas:

`OROMBOR` · `OROMBER` · `ORENBER` · `OREMBEL` · `ORENTBER` · `OREMBEA`

Ninguna de estas pasa el filtro de distancia de edición ≤1 letra que usa el resolvedor
automático. Este punto necesita una lista de alias explícita y generosa, no solo el
algoritmo genérico.

**Identidad confirmada por Julio:** OREMBER es una planta del grupo **FINSA**, ubicada en
Ourense. El mismo grupo FINSA tiene **otra planta en Cella (Teruel)**, que aparece en varias
fichas como destino separado ("FINSA CELLA", "Cella - Teruel"). **Son dos puntos distintos,
no alias entre sí** — mismo grupo empresarial, dos plantas físicas. No fusionar OREMBER con
CELLA/TERUEL aunque ambos sean "FINSA" en la ficha; hay que desambiguar por la localidad que
acompaña al nombre (Ourense/Orense → OREMBER; Teruel/Cella → punto CELLA).

## Caso Avilés/Navia — RESUELTO, no es discrepancia

Corregido por Julio: en la ficha de José A. Vázquez (6/8/2026) el chófer no escribió
"Avilés" como se leyó al principio — escribió **"Anleo"**, una localidad dentro del
ayuntamiento de Navia (Asturias). Coincide exactamente con el destino real de Gesruta
(NAVIA). **No hay discrepancia**; era un error de lectura de la letra manuscrita, no un
error del chófer ni del sistema. Anotado como alias: `ANLEO` → `NAVIA`.

## Confirmado también: abreviación por caída de prefijo

`FAMALICAO` (ficha) → `VILANOVA FAMALICAO` (Gesruta). El chófer omite la primera palabra.

## Nota sobre representatividad

30 fichas concentradas en jul-ago 2026 y dominadas por FORESA. Los patrones B, C y D son los
que aportan valor real. Próxima tanda: priorizar Baltransa, Helm y Clavo Food.
