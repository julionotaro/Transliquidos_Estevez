# Resolvedor de `orden.json` — Mapa de cobertura (Corrida 1)

> **Análisis, no código.** Mide qué parte del armado de una orden ya existe en los
> módulos del repo (reusable), qué datos están al día, y qué reglas habría que
> encodear. Insumo para decidir si construir el *armador* (resolvedor de etapa 1)
> paga, y en qué orden. Fecha: 29/10/2026. No toca el pipeline.

## Veredicto en tres líneas

1. **El motor (la mecánica) existe y está testeado** — reusable desde Node sin reescribir.
2. **Los datos están MÁS al día de lo estimado** — la tabla de 699 tarifas trae las
   rutas actuales (Teruel 56, Villagarcía→Valladolid 38,66, →Asturias 33,10) y la
   indexación por grupo. Los faltantes son **pocos y nombrables** (3).
3. **El motor NO trae las reglas nuevas** — viven en `correcciones-julio.json` + INDICE
   (R-01…R-09) + `reglas-por-cliente`. Hay que encodearlas, pero **ya están escritas**.

> **Corrección honesta a la estimación previa:** en el chat se dijo que los datos eran
> "versión agosto, desactualizados". **Verificado: falso en general.** Están mayormente
> vigentes (ver Capa 2). El resolvedor es más barato de lo que se advirtió; el cuello real
> no es "refrescar todo", son 3 gaps puntuales.

---

## Capa 1 — El motor (✅ existe, testeado, reusable)

Módulos puros CommonJS (`module.exports`), con batería de tests en `ficha/tests/`. Se
reusan **los módulos limpios**, no los `*.generated.js` (esos son la versión embutida en n8n).

| Módulo | Función | Qué resuelve | Estado |
|---|---|---|---|
| `ficha/clientes.js` | `resolverCliente` | literal del doc → razón social (FORESA ≠ FORESA-largo; QUIMIDROGA ≠ QUIMIDROGA-PT) | ✅ |
| `ficha/flota.js` | `resolverMatricula` | tractora / remolque / chofer contra padrón | ✅ |
| `catalogo/resolver-punto.js` | — | literal → punto canónico, cascada de confianza, nunca adivina | ✅ |
| `ficha/tarifas.js` | `buscarTarifa` | tarifa vigente por cliente+origen+destino, por fecha, con cascada por fragmento (provincia) | ✅ |
| `ficha/tarifa-contractual.js` | — | puentes punto-canónico + razón social contra la tabla Tarifas | ✅ |
| `ficha/indexacion.js` | `grupoIndexacion`, `indexacionDeFila`, `buscarPct` | % de indexación por grupo y quincena | ✅ |
| `ficha/periodo-facturacion.js` | `SERVICIOS_AGREGADOS_FORESA` | modalidad línea vs **acumulada** (Orember, Villagarcía→Caldas metanol) | ✅ |
| `ficha/conductores.js` | `tipoConductor` | autónomo / propio (FRAGA, ALFONSIN, ABAL) | ✅ |

**Clave de reuso:** todos reciben el DATO por parámetro (ej. `buscarTarifa(viaje, tarifasRows)`).
El armador les pasa los CSV/JSON del repo ya parseados. No dependen de n8n.

---

## Capa 2 — Los datos (estado real, verificado)

### Presente y vigente (confirmado en esta corrida)

- **Tarifas:** `datos/n8n-export/tarifas.csv` — 699 filas (schema: cliente;origen;destino;
  material;tarifa_tn;precio_fijo;vigente_desde;id). Contiene, entre otras:
  - BRESFOR AVEIRO→TERUEL COLA = **56** (id 44) · FORESA CALDAS→TERUEL = **56** (id 223)
  - FORESA CALDAS→VALLADOLID = **38,66** · FORESA VILLAGARCIA→VALLADOLID METANOL = **38,66** (id 271)
  - FORESA VILLAGARCIA→ASTURIAS METANOL = **33,10** (id 266) *(= COGERSA/Gijón, factura 50754)*
- **Indexación:** `datos/gesruta/indexacion-gasoleo.json` — 6 grupos (FORESA-BRESFOR, HELM,
  QUIMIDROGA, OTROS, AGENCIA, AUTONOMOS) con tramos por fecha. FORESA-BRESFOR vigente a
  15/10 = **0,1664**; QUIMIDROGA/OTROS/HELM/AUTONOMOS cargados hasta 30–31/10.
- **Puntos:** `datos/gesruta/puntos-geograficos-2026-08-27.csv` mapea nombre→código Gesruta
  (TERUEL→**TE**, AVEIRO→**AVEIR**, UTISA TERUEL→**UTI**). El código que necesita la orden es derivable.

### Gaps concretos (estos SÍ causan round-trips)

| # | Gap | Qué pasa | Dónde vive hoy mi mano |
|---|---|---|---|
| 1 | **QUIMIDROGA Miranda de Ebro→Braga AUSENTE** de la tabla | El armador daría `SIN_TARIFA` | 61,65 del histórico de facturación (coherente con R-05: 143 puntos sin tarifa, y con el pendiente INDICE "Quimidroga rutas PT") |
| 2 | **Indexación FORESA-BRESFOR sin tramo 16→31/10** | El último cargado es 01→15/10 (0,1664) | El duotrailer Jose Manuel Paz (carga 16/10) usó 0,1664, que es el tramo **recién vencido** → confirmar con Julio el factor de 2ª quincena de octubre |
| 3 | **Encoding cp850** del CSV de puntos | Leerlo como UTF-8 corrompe Ñ/acentos (PORRIÑO) | — (hay que leerlo como cp850, ya avisado en CLAUDE.md) |

---

## Capa 3 — Reglas que el motor NO trae (encodear desde texto)

Fuentes: `catalogo/correcciones-julio.json` + INDICE "Conflictos resueltos" (R-01…R-09) +
`reglas-por-cliente(-addendum).md`. **Están escritas**; el armador las *lee y aplica*.

| Regla | Fuente | Tipo | Complejidad |
|---|---|---|---|
| Concepto/IVA por cliente (BRESFOR PI/0; HELM y QUIMIDROGA Portugal = nacional P/21; RNM PI/0) | correcciones + reglas-por-cliente | lookup | baja |
| Referencia por cliente (FORESA 7díg/2º; BRESFOR 10díg `5050`/1º; FORESTAL pedido `26P`; HELM orden flete; RNM guía remessa) | R-07, R-09, correcciones | lookup + ancla visual | media |
| Mínimo facturable 23 TN | R-02 | cálculo | baja |
| Descuento DUO / **duotrailer** (duo_secundario, km+dietas compartidos, km.cargar:false) | correcciones 27/10 | procedural | **alta** |
| Punto con tarifa (TERUEL=TE, no UTISA) | correcciones 15/10 | elección | media |
| Varios productos en una OC = 1 viaje (suma TN) | correcciones 07/10 | simple | baja |
| Viaje nuevo si cambia tractora o remolque | correcciones 14/10 | estructural | media |
| BALTRANSA: línea de indexación cantidad 1, importe 0 | R-04 | caso | baja |
| DIVERSEY = punto de carga, se factura a BALTRANSA | correcciones 22/10 | caso | media |
| FORESTAL: precio fijo/viaje con indexación incluida (no sumar línea G) | correcciones 07/10 | caso | media |
| Cascada de tarifa por zona (destino sin fila → provincia) | correcciones 07/10 + R-05 + `tarifa-por-analogia.json` | parcial en motor (match TOKEN) | media |

---

## Plan de corridas revisado (**3–5 sesiones**, cada una con golden-test)

El motor + datos están mejor de lo estimado → baja de 4–6 a **3–5**. La mayor parte del
trabajo no es escribir: es **probar que el armador da idéntico a la mano** sobre viajes reales.

1. **(esta) Inventario** ✅ — este documento.
2. **Armador en Node:** cablear el motor + emitir `orden.json`. Golden-test contra **1 juego
   ya hecho simple** (un FORESA o un autónomo Fraga) hasta que dé idéntico.
3. **Reglas de lookup (Capa 3 baja/media):** concepto/IVA, mín. 23, referencia, varios-productos,
   punto-con-tarifa. Golden-test contra 3–5 juegos variados ya hechos.
4. **Reglas procedurales:** duotrailer, split por matrícula, DIVERSEY→BALTRANSA, FORESTAL fijo.
   Golden-test contra el duotrailer Jose Manuel Paz.
5. **Sombra:** correr el armador en paralelo a la mano unos días, comparar, ajustar divergencias.
   Recién ahí se usa en vivo.

**Regla dura:** cada fase cierra con golden-test (armador == mano). Si no empata, no avanza.
Es facturación real.

---

## Corrida 2 — resultado (29/10/2026) ✅

Construido el armador en `herramientas/armar_orden/` (Node), reusando los módulos sin
reescribirlos. **Golden-test VERDE** contra `jose-ramon-pineiro/2026-10-14`: desde los
hechos crudos reprodujo el `orden.json` hecho a mano **idéntico** en los 2 albaranes —
incluyendo la **cascada por analogía confirmada** (COGERSA→ASTURIAS 33,10), el **mínimo
23 TN**, el factor de indexación 0,1664 y el formato ES. Correr: `node
herramientas/armar_orden/golden_test.js`.

Verificó además que la reutilización es real: `resolverCliente`, `codigoCliente`,
`resolverPunto`, `buscarTarifa`, `grupoIndexacion`/`buscarPct` y `tipoConductor` entran
como piezas y componen. El armador **no inventa**: sin fila ni analogía confirmada marca
`tarifa_pendiente` con motivo.

**Sigue (corrida 3):** golden-test contra 3-5 juegos variados y encodear las reglas
capa-3 de lookup (concepto/IVA por cliente ya parcial, referencia por cliente,
varios-productos=1-viaje, punto-con-tarifa). Lo procedural (duotrailer, autónomo en
Gastos, FORESTAL fijo, BALTRANSA idx-0, DIVERSEY→BALTRANSA) va en corrida 4.

---

## Corrida 3 — resultado (29/10/2026) ✅

**Golden-test verde contra 4 juegos** (`node herramientas/armar_orden/golden_test.js`):
pineiro + **asensi**, **manuel-sabaris/02** y **nuno** — todos reproducen el `orden.json`
a mano idéntico. Reglas nuevas encodeadas y verificadas:

- **Tarifa desambiguada por material:** FORESA Caldas→Orember COLA 13,85 (no FINCAT 20,16).
- **Tarifario propio de RNM (€/TN):** RNM Aveiro→Pontevedra 19,26 €/TN (no el €/viaje de la tabla).
- **Indexación acumulada (`cargar:false`):** FORESA Orember / Villagarcía→Caldas metanol.
- **Analogía confirmada:** QUIMIDROGA Barcelona→Begonte → LUGO 74,73.
- **Concepto/IVA internacional:** BRESFOR y RNM → PI/0/GPT; nacional → P/21/G.
- **Puntos solo con confianza alta:** Montehermoso (dirección que menciona Cáceres) NO se
  resuelve a ciegas → `codigo:null` + literal, `tarifa_pendiente`. Igual que a mano.
- **Albarán sin tarifa** (ARACHEM, Montehermoso) → `tarifa_pendiente` con `porte/indexacion:null`.

**Dato agregado al catálogo:** `TERUEL`→`TE` faltaba en `catalogo/puntos-alta.json` (estaba
en el CSV de puntos pero no en el curado); agregado (confirmado Julio: Teruel porta la tarifa).

**Hallazgos para corrida 4 (procedural):** duotrailer, autónomo en Gastos (km.vacío),
FORESTAL precio fijo con idx incluida, BALTRANSA idx-0, DIVERSEY→BALTRANSA. Y pendiente de
visión real de ficha: la resolución de puntos desde direcciones crudas (hoy el `raw` trae el
nombre del punto ya elegido por el humano).

---

## Acción inmediata (no depende del armador)

Los gaps 1 y 2 de Capa 2 hay que cerrarlos **igual, con o sin armador**:

- **Gap 1:** confirmar con Julio la tarifa QUIMIDROGA Miranda de Ebro→Braga (hoy 61,65 del
  histórico) para cargarla a la tabla o a `tarifa-por-analogia.json` (con `confirmado: true`).
- **Gap 2:** confirmar el factor de indexación FORESA-BRESFOR de la 2ª quincena de octubre
  (y revisar si el duotrailer del 16/10 debía llevar ese, no el 0,1664 de la 1ª quincena).

**Decisión de Julio:** ¿pasamos a la corrida 2 (construir el armador) o primero cerramos estos
gaps de datos? Son independientes; se puede hacer en cualquier orden.
