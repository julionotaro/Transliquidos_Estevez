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
- **NO se tocó la lógica del armador (corrección de Julio 12/11).** Se había intentado hacer que una
  tarifa confirmada le ganara al "fallback por provincia" — **revertido**: la cascada está bien. El
  problema del caso URSA era de LECTURA: el "fallback por provincia" es un match por **token** del
  nombre, y "URSA IBERICA, **S.A.**" matcheaba por el token basura **"S.A."** contra cualquier
  empresa con ese sufijo (Clariant, Termolán…), agarrando Caldas→Termolán 28,89. La solución correcta
  es leer la dirección completa del destino (**URSA, El Pla de Santa María, Tarragona**) y cargar el
  destino en la **provincia que tiene la tarifa**: FORESA Caldas→**TARRAGONA 72,36 DIRECTA** (mismo
  criterio que Enguera→Valencia). Lección: cuando un destino "empresa, S.A." no tiene ruta propia,
  cascadear a su PROVINCIA, no dejar que el token del sufijo elija.

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
2. **FORESA Caldas→URSA Ibérica** (2033377, 2035893) → se carga destino **TARRAGONA** (cod T), la
   provincia donde está URSA (El Pla de Santa María) y donde vive la tarifa: FORESA Caldas→Tarragona
   **72,36 €/TN DIRECTA** (criterio cascada, como Enguera→Valencia). Sin tocar el armador. Totales
   2.339,44 / 2.358,90. (La entrega real es URSA Ibérica, queda en el _nota y observaciones.)
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

## 7. Correcciones de Julio sobre la tanda (ya corregidas por él en Gesruta, 12/11)

Julio pasó las diferencias que corrigió a mano en Gesruta para asentarlas y corregir nuestros registros:

1. **TMG = Braga o Famaliçao (Aboy 713899, Asensi 713900).** Los MEXIFLEX Miranda→TMG descargan en
   **V.N. Famaliçao** (TMG Sao Cosme do Vale), no Braga → destino **VILANOVA FAMALICAO** (cod FAMAL).
   TMG tiene dos plantas (Braga/Ponte GMR y Famaliçao/Sao Cosme do Vale): **verificar en el CMR a cuál
   descarga**. Misma zona → mismo 61,65 (total 1.990,23 por mínimo 23 TN). Confirmada Miranda→Famaliçao
   61,65 agregada.
2. **Nuno Huelva→Caldas: faltaba el material = FENOL (FENOL FUNDIDO).** Al cargar el material correcto,
   la tarifa cambia de la genérica (Caldas↔Huelva "Cualquiera" 74,25) a la **específica por material
   FENOL FUNDIDO = 83,75 €/TN** (la tabla tiene ambas; el material define la tarifa, como FINCAT≠COLA).
   Total 2.526,38 → **2.849,62**. Coincide con lo que Julio cargó en Gesruta.
3. **Vázquez Arteixo→Barcelona Q-QUAT.** El material **Q-Quat SÍ está** en el catálogo (cod **QUAT**,
   descripción "Q QUAT") → ya resuelve. Doble destino Barcelona (Zona Franca + Barna) → lleva reparto
   (REP 90), ya estaba.
4. **Pablo Carles — Terquimsa Tarragona→Caldas: ref = TQ5605134.** Este viaje de entrada también es
   **intermediado por TRANSTAMBRE**; la referencia sale de la "Referencia de pedido" de la OC de
   Transtambre (mismo lugar que TQ5603360 del viaje de Alfonsín), no del Nº 2008xxxx de FORESA. PDF
   archivado renombrado 200859030→TQ5605134.
5. **Pedro Fraga — km vacíos.** Dos tramos (2036041, 2036058) estaban en 124 por reconstrucción; la
   ficha dice **123**. Corregido en el orden.json (secuencia real 123,124,123,123,123,124,124,124,123,144).
