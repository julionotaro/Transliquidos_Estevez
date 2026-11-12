# Jornada 2026-11-12 — Aprendizajes del lote grande

> Registro de TODO lo que se procesó y aprendió en la tanda de juegos del 11-12/11/2026
> (pedido explícito de Julio: "dejá registrados todos los aprendizajes de todo lo que se
> procesó y trabajó en todos los juegos de hoy").
>
> **Las reglas canónicas viven en `catalogo/correcciones-julio.json`** (memoria operativa) y las
> tarifas en `catalogo/tarifas-confirmadas-julio.json` / `docs/pendientes-gesruta.md`. Este
> documento es el **diario de la jornada**: qué juegos entraron, qué se aplicó, qué cambió en el
> armador y qué quedó pendiente de confirmar. No duplica reglas: apunta a dónde viven.

---

## 1. Qué se procesó

**~17 juegos (escaneos), ~75 albaranes.** Dos bloques:

### 1.a — Shuttles FORESA Caldas→Orember (prueba de fuego inicial, j1–j4)
Escaneos `20261111131901 / 131929 / 132000 / 132115` (+ arranque de `141051`): ~55 albaranes
FORESA Caldas de Reis → Orember, material **COLA** (RES xxxx, cod 1, 13,85 €/TN) y **FINCAT**
(AVEIRO/ABEIRO 3009, cod FINCAT, 20,16 €/TN). Indexación **ACUMULADA** (grupo FORESA-BRESFOR,
`cargar:false`; el importe se calcula y guarda para control pero no sale como línea por albarán).
Mejora de armador aplicada aquí: **cabeza por-viaje** (ver §3).

### 1.b — 13 juegos nuevos (n1–n13) de `entrada/`
Multi-carga, multi-cliente. Resumen por escaneo:

| Escaneo | Chofer | Cargas (cliente · ruta · ref) |
|---|---|---|
| `141116` | — | FORESA **Tarragona→Caldas** ACETATO DE VINILO 200859030 (Stockmeier/Terquimsa = planta cargadora, se factura a FORESA, 72,36) |
| `141154` | — | RNM **Estarreja→León** SOSA 5113063259 *(tarifa pendiente)* · RNM Avilés→Famalicao ácido 2601021460 · RNM Aveiro→Navia SOSA 0141172721 (40,30) |
| `141326` | — | FORESA Caldas→Teruel 2036542 (56) · QUIMIDROGA **Miranda→Braga** MEXIFLEX 713899 (61,65) · RNM Aveiro→Navia SOSA 0141172720 |
| `141939` (n5) | — | FORESA Caldas→Valencia 2036356 (64,04) · **TRANSTAMBRE Tarragona→Porriño ALCOHOL** TQ5603360 (tarifa cerrada OC, idx 15,53%) |
| `171030` | — | FORESA Orember 2032762 · BRESFOR Aveiro→Teruel 5050141625 (56) · BALTRANSA **Tarragona→Ovar** ALCUPOL 339326 (precio fijo + idx 0) · FORESA **Huelva→Caldas FENOL** 200858712 (74,25) |
| `171140` | — | FORESA Caldas→Tordera 2035387 (72,36) · QUIMIDROGA **Barcelona→Pontevedra** LISINA 713355 (79,71) · FORESA Orember 2036021 |
| `171234` | — | FORESA **Villagarcía→Valladolid** METANOL 2600003498 (38,66) · QUIMIDROGA Miranda→Braga MEXIFLEX 713900 |
| `171337` (jacobo-grande) | Jacobo Grande | FORESA **Caldas→URSA** 2033377 *(REVISAR: URSA sin código/tarifa)* · RNM Tarragona→Azambuja IQOXINOL 229897 (88,45) |
| `171858` (manuel-sabaris) | Manuel Sabarís | BRESFOR Aveiro→Teruel 5050141839 (56) · QUIMIDROGA **Barcelona→Leiria** VINKA-PLAST 713556 (88,25) |
| `171641` (jose-antonio-vazquez) | José A. Vázquez | QUIMIDROGA **Arteixo→Barcelona Q-QUAT 50** 10072585 *(tarifa pendiente: material/tarifa/ref)* · QUIMIDROGA Barcelona→Orense VINKA-PLAST 713772 (79,71) |
| `170911` (jose-candido-jamardo) | J.C. Jamardo | RNM Avilés→Viana do Castelo ácido 0141171881 (36,50) · FORESA **Caldas→URSA** 2035893 *(REVISAR)* · QUIMIDROGA **Barcelona→Zamora** LISINA 713541 (71,05) |
| `142100` (n6, jose-enrique-arias) | J.E. Arias | BRESFOR Aveiro→Teruel 5050141632 (56) · RNM **Tarragona→Serzedelo** IQOXINOL 229837 *(tarifa pendiente)* · **TRANSTAMBRE Teixeiro→Altorricón** bioetanol/aceite de maíz 319574 *(tarifa cerrada OC, 56 €/TN + 15,97%)* · QUIMIDROGA Barcelona→Orense VINKA-PLAST 713769 (79,71) |

(Los choferes/escaneos de las primeras filas se identifican por el raw en `herramientas/armar_orden/raw/`.)

---

## 2. Reglas de negocio nuevas / confirmadas por Julio esta jornada

Todas quedaron grabadas en `catalogo/correcciones-julio.json`. Resumen:

1. **Tarifa cerrada por OC (TRANSTAMBRE y cualquier OC con precio+índice propios).** Cuando la
   orden fija su propio precio y su propio % de indexación (típico de un **broker** como
   Transtambre), se **respetan la tarifa y el índice de la OC** por encima de la tabla y del factor
   del grupo. El % de la OC se carga como factor de la línea de indexación. **Referencia Transtambre:**
   el campo "Referencia de pedido" de la OC; si ese campo trae una *instrucción* en vez de un número
   (ej. "TRANSTAMBRE + MATRÍCULAS + NOM APELL Y DNI"), usar el Nº de albarán/carta de porte de la
   carga. Implementado en el armador con el campo **`idx_pct`** (ver §3). *(Julio, verbatim: "Tarifa
   cerrada, respetar tarifa e index informada en OC. En la OC de Transtambre muestra 'Referencia de
   pedido' para utilizar como referencia.")*
   - **Discreción comercial Transtambre:** la carta de porte puede emitirse con un destino distinto
     (ej. Mengíbar) del real (Altorricón). Para facturar vale el **transporte real** (origen/destino
     de la OC), no la ficción documental.

2. **Cabeza por-viaje.** La cabeza (tractora) es **por viaje**, no por juego: cuando una ficha tiene
   varios viajes (cambio de tractora/remolque), cada viaje lleva su cabeza. El armador la deriva por
   viaje (`cabezaDeViaje`). *(Julio eligió "Cabeza por-viaje en el armador".)*

3. **Tarifa pendiente hasta confirmar.** Reafirma la resiliencia (05/11): una ruta/dato sin resolver
   **no aborta** el albarán; sale `tarifa_pendiente`/`REVISAR` con el resto cargado y el validador lo
   acepta. Aplicado a las 6 pendientes de §6. *(Julio: "Que quede tarifa pendiente hasta confirmar.")*

4. **Enguera = Valencia.** FORESA Caldas→Enguera (Harinas Almela) se carga destino **VALENCIA** (cascada
   de provincia) = **64,04 €/TN**. *(Julio: "Enguera es Valencia, Ok.")* Grabada en `tarifas-confirmadas-julio.json`.

5. **PROVE para THEC sobre cliente químico.** Un chofer de THEC en un viaje de cliente químico se carga
   en el perfil TLE con cabeza `PROVE`, proveedor `5`, km/costos vacíos. *(Julio: "Está bien, dejar PROVE.")*
   Ya vivía como regla THEC/PROVE (03/11); confirmada en j1.

6. **Referencia Bondalti (RNM/guía de remessa).** T1 = guía de remessa (Bondalti) como referencia; T2
   = carta de porte como 2ª opción. Coherente con R-09 (jerarquía de referencia RNM). *(Julio:
   "T1 guia de remessa de Bondalti, y T2 como segunda opcion Carta de porte, estan bien.")*

---

## 3. Cambios en el armador (`herramientas/armar_orden/`)

> Nota de roles: el armador es territorio del dev; estos cambios se hicieron en la jornada para poder
> procesar el lote. Quedan documentados acá y verificados por el golden + validador.

- **`idx_pct` (índice informado en la OC).** Campo opcional por albarán en el `raw`. Si
  `typeof raw.idx_pct === 'number'`, la línea de indexación usa ESE factor (el de la OC) en vez del
  de la tabla del grupo. Respeta `cargar:false` para las idx acumuladas. Agregado a `CLAVES.albaran`
  y `NUMERICAS` en `validar_raw.js`. Retrocompatible (golden 11/11 OK).
- **`cabezaDeViaje(raw, v, fl)`.** Deriva la cabeza por viaje (prioridad: cabeza del viaje → cabeza
  de flota por matrícula, respetando el cero a la izquierda → dígitos iniciales de matrícula →
  cabeza del juego). `cabecera.cabeza = cab.cabeza`. El validador valida la cabeza efectiva
  (`v.cabeza || raw.cabeza`) por viaje.
- **Golden:** caso sintético "dos tractoras" agregado; fixtures CLAVO actualizadas al índice de
  octubre (0,0915 → 0,1450) tras el cambio en `catalogo/tarifas-clavo.json`. Golden 11/11 verde.
- **Precedencia tarifa confirmada > fallback por provincia (fix 12/11).** `resolverTarifa` solo
  corta con la tabla cuando el match es **DIRECTO** (ruta exacta). Un **FALLBACK_PROVINCIA** (la
  tabla no tiene la ruta y devuelve el precio de OTRO destino de la zona) ya NO le gana a una
  **tarifa confirmada por Julio** para la ruta exacta: ahora se consulta `confirmadas` antes del
  fallback. Caso real: FORESA Caldas→URSA caía a Caldas→**TERMOLAN 28,89** por provincia, cuando el
  histórico factura **72,36** (y Julio confirmó el destino URSA). Golden verde; ningún otro albarán
  de la tanda cambió su total.

---

## 4. Tarifas / rutas aplicadas esta jornada (con estado)

**Confirmadas (viven en tarifas-confirmadas-julio.json o en reglas):** FORESA Caldas→Orember COLA
13,85 / FINCAT 20,16 (idx acumulada); FORESA/BRESFOR Aveiro·Caldas→Teruel 56 (destino TE); FORESA
Tarragona→Caldas ACETATO DE VINILO 72,36 (planta cargadora = FORESA); FORESA Caldas→Tordera 72,36;
FORESA Caldas→**Valencia/Enguera 64,04** (confirmada hoy); FORESA Villagarcía→Valladolid METANOL
38,66; RNM Aveiro→Navia 40,30; RNM Avilés→Famalicao 39,13; RNM Tarragona→Azambuja IQOXINOL 88,45;
QUIMIDROGA Miranda→Braga MEXIFLEX 61,65; QUIMIDROGA Barcelona→Pontevedra/Padrón/Porriño 79,71;
BALTRANSA precio fijo UN + idx 0.

**Aplicadas por histórico/cascada — conviene que Julio ratifique** (listadas en `pendientes-gesruta.md`):
FORESA **Huelva→Caldas FENOL 74,25** (Palos de la Frontera = destino HUELVA); RNM **Avilés→Viana do
Castelo 36,50**; QUIMIDROGA **Barcelona→Orense 79,71** (Ourense es provincia interior de Galicia;
se aplicó la misma 79,71 que Pontevedra/Coruña — **confirmar si Ourense difiere**); QUIMIDROGA
**Barcelona→Zamora 71,05**; QUIMIDROGA **Barcelona→Leiria 88,25**.

---

## 5. Mapeos de material usados (todos en `datos/gesruta/materiales.csv`)

RES xxxx → **COLA** (cod 1); AVEIRO/ABEIRO 3009 → **FINCAT**; LISINA → cod 62; VINKA-PLAST → cod
VINKA; MEXIFLEX → cod MEXIFL; ÁCIDO SULFÚRICO → cod 20; ALCUPOL → cod 26; METANOL → cod 5; SOSA →
cod 51; IQOXINOL → cod IQOXIN; ACETATO DE VINILO → cod VINILO; ALCOHOL (Transtambre) → cod 83.
**Sin código (REVISAR):** ACEITE DE MAÍZ (bioetanol Transtambre) y Q-QUAT 50 (QUIMIDROGA).

---

## 6. Resolución de las pendientes (Julio, 12/11) — TODO cerrado

Los 6 albaranes que quedaron en TARIFA_PENDIENTE fueron resueltos por Julio y re-armados (quedan en
PENDIENTE_CARGA, listos para el bot). Todas las tarifas están en `tarifas-confirmadas-julio.json`:

1. **RNM Estarreja→León SOSA** (5113063259) → **34,50 €/TN** ("tenemos tarifa Aveiro-León a 34,50,
   usar esa"). PI/IVA 0. Total 942,07.
2. **FORESA Caldas→URSA Ibérica** (2033377, 2035893) → destino **URSA** (El Pla de Santa María,
   Tarragona; cod Gesruta URSA, ya existía) y tarifa **72,36 €/TN** (histórico; = zona Cataluña). Ojo:
   la tabla general caía a Caldas→Termolán 28,89 por fallback de provincia → se corrigió la
   precedencia del armador (§3). Totales 2.339,44 / 2.358,90.
3. **QUIMIDROGA Arteixo→Barcelona Q-QUAT 50** (10072585) → **79,71 €/TN** + línea REP 90 (doble
   destino). Total 2.691,11. (Material Q-QUAT 50 = cod QUAT en materiales.csv; el armador lo deja con
   aviso "carga sin código" — se completa en Gesruta.)
4. **RNM Tarragona→Serzedelo IQOXINOL** (229837, n6) → **86,00 €/TN** ("Tarragona-Vilanova de
   Famaliçao/Serzedelo/Carreira 86"). PI/IVA 0. Total 2.391,63.
5. **TRANSTAMBRE Teixeiro→Altorricón** (319574, n6) → **56,00 €/TN + 15,97% idx** (tarifa cerrada OC,
   "Sí"). P/IVA 21. Total 1.823,08.

**Rutas por cascada/histórico — todas ratificadas por Julio 12/11** (ya billaban correcto; ahora en
`tarifas-confirmadas-julio.json`): Huelva→Caldas FENOL **74,25**; Barcelona→Orense **79,71** (Ourense
= misma que Pontevedra/Coruña); Barcelona→Zamora **71,05**; Barcelona→Leiria **88,25**; Avilés→Viana
do Castelo **36,50**.

> No quedan pendientes de esta jornada. (Las 3 TARIFA_PENDIENTE que siguen en el registro son de
> juegos de octubre previos —Aveiro→Toro, Avilés→Sines, Aveiro→REVISAR—, ya en `pendientes-gesruta.md` §D.)
