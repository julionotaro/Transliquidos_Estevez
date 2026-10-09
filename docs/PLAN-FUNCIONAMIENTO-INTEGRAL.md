# Plan de funcionamiento integral — todas las falencias y su cierre

> **Objetivo:** que en TODOS los casos cada campo se complete correctamente según
> los criterios ya definidos. Este documento es el inventario completo de lo que
> falla, la causa raíz verificada de cada falla, y el orden de cierre.
>
> Base del análisis: las **3 hojas / 8 viajes** ejecutados el 26/08/2026
> (ejecuciones **1065, 1068, 1076**) contrastados contra el reporte de Julio.

---

## Hallazgo que reencuadra todo

**La ingesta produce datos correctos con más frecuencia de la que se ve en la
tabla.** En la ejec. 1076 los tres viajes se generaron bien:

```
V2: RNM · ref 2601015888 · 23.500 kg · AVILES→VILANOVA FAMALICAO · tarifa 875 ✓
V3: RNM · ref 105336 · 23.360 kg · AVILES→NAVIA ✓
```

Julio veía "no aparecen" y "todo vacío". El problema estaba **aguas abajo**, entre
la ingesta y la vista — la parte determinista, no la de visión. Eso es lo que hace
que este plan sea acotable.

---

## Inventario de falencias

| # | Falencia | Causa raíz (verificada) | Capa | Estado |
|---|---|---|---|---|
| **F1** | **Tarifa vacía en TODOS los viajes** | **Dos motores de tarifa distintos.** La ingesta usaba `buscarTarifaContractual`; la vista **recalculaba** con `buscarTarifa`. Mismos datos, resultados opuestos | código | ✅ **cerrada** |
| **F2** | La tarifa nunca matcheaba, ni con la tabla cargada | `buscarTarifaContractual` traducía el **viaje** a punto canónico pero comparaba contra la tabla **en crudo** (`VILANOVA FAMALICAO` vs `FAMALICAO`) | código | ✅ **cerrada** |
| **F3** | **Origen = Destino** (`TE · TERUEL → TE · TERUEL`) | GPT puso como origen el lugar de **entrega**; ambos resolvieron al mismo punto. Además mataba la tarifa (no hay ruta a sí misma) | código | ✅ **cerrada** |
| **F4** | "Los viajes 2 y 3 no aparecen" | La vista **filtraba solo pendientes**; los viajes correctos no se listaban | vista | ✅ **cerrada** |
| **F5** | Indexación vacía siempre | La vista **nunca la calcula**: no cruza el % del suplemento contra el importe | código | ✅ **cerrada** |
| **F6** | Peso tomado de la OC (23.000 en vez de 23.380) | La guarda existe (excluye órdenes) pero **el documento girado no se asoció**, así que la orden era el único peso | correlación | ⬜ pendiente |
| **F7** | Referencia equivocada (`2009926` en vez de `2017843`) | Se toma la del primer doc que la traiga; **la regla por cliente sólo vive en el prompt**, no como guarda de código | código | ⬜ pendiente |
| **F8** | Cliente vacío ⇒ 6 columnas vacías | Sin doc no hay cliente; sin cliente no hay tarifa, régimen ni quincena. **Un dato tumba media fila** | diseño | ⬜ pendiente |
| **F9** | Origen/destino mal (TERUEL, ENCE, CARREIRA) | El documento trae la **razón social** del cargador + dirección postal, y a veces la dirección está **mal impresa** (guía RNM: "Asturiana de Zinc … 46002 Teruel", la planta está en Avilés) | catálogo | ✅ **cerrada** (alias empresa) |
| **F10** | Rutas sin tarifa aunque el viaje sea real | El **tarifario histórico** (fuente robusta) nunca se cargó como tabla en n8n | datos | ⬜ pendiente |
| **F11** | Fecha del documento mal (18/08 en un viaje del 10/08) | Lectura de visión; hoy no hay guarda que contraste la fecha del doc contra la de la ficha | código | ⬜ pendiente |

---

## Fase 1 — CERRADA (F1 · F2 · F3 · F4)

Es la que desbloquea más columnas de golpe, y es **100 % determinista**.

### F1 — Un solo motor de tarifa
La vista ya no recalcula: **lee** `tarifa_contractual_tn` / `_fijo` que la ingesta
guardó. Cascada de precio:

1. tarifa **contractual** (tabla Tarifas)
2. precio impreso en la **orden** del cliente
3. si no hay: el **motivo** de la ingesta explica por qué (no un hueco mudo)

### F2 — Ambos lados al punto canónico
La tabla Tarifas la carga un humano con el nombre corriente (`FAMALICAO`); el
viaje viene del documento. Sólo son comparables si **los dos** pasan por el mismo
resolvedor. Verificado: `AVILES → FAMALICAO` ahora devuelve **875 €**.

### F3 — Guarda origen ≠ destino
Un viaje nunca carga y descarga en el mismo punto. Si el documento dice eso:
manda la **ficha** y la fila va a REVISAR. Si la ficha tampoco los distingue, se
**anulan los dos** — vacío es honesto, `TERUEL → TERUEL` es un dato falso con
pinta de bueno. Compara el **punto canónico**, no el literal, porque el colapso
ocurre justo al traducir.

### F4 — La vista lista TODO el lote
Con columna **Estado**: `FALTA DOC` · `REVISAR` · `OK`. El filtro clasifica, ya no
excluye.

---

## Fase 2 — Completar la fila facturable (F5 · F10 · F6)

| Paso | Qué | Por qué en este orden |
|---|---|---|
| **2.1** ✅ | **Indexación en la vista** — HECHA. Verificado: RNM 19/08 → 7,66 % → 67,03 € | Usa el suplemento del repo (79 tramos, 6 solapas) |
| **2.2** | **Cargar el tarifario histórico** como tabla + 2º escalón de la cascada | Cubre las rutas que el contractual no tiene; marca REVISAR (es observada, no pactada) |
| **2.3** | **Peso**: cuando el único kg viene de una orden → REVISAR explícito, nunca se usa | La guarda existe; falta que el caso sea **visible** en vez de silencioso |

## Fase 2bis — F9 cerrada: alias EMPRESA → punto

`catalogo/alias-empresa-punto.json` + filas en la tabla `puntos` de n8n. El
documento trae la razón social del cargador/destinatario, no el nombre del
pueblo, y a veces la dirección postal está mal:

```
guía RNM (sosa):  origen "Asturiana de Zinc S.A., Avda. de Galicia 46002 Teruel"
                  → sin alias resolvía a TERUEL (¡la planta está en AVILÉS!)
                  → con alias "ASTURIANA DE ZINC"→AVILES resuelve a AVILES ✓
```

La empresa gana sobre la localidad porque aparece **al principio** del literal
(earliest-position). Cargados: Asturiana de Zinc/Ferquimer→AVILÉS, ENCE→NAVIA,
Carreira/RNM→FAMALICÃO, Disiclin→SILLEDA. Se cargan más a medida que aparezcan.

---

## ⚠ Techo real: la lectura de GPT VARÍA entre corridas

Comparando **tres corridas del mismo juego** (Manuel Aboy — ejec 1076/1087/1093):

| Campo | Corrida A | Corrida B |
|---|---|---|
| Peso V1 | 23.000 | 23.360 |
| Origen V1 | "CELLA DE ESTACION" | "Asturiana Zinc Teruel" |
| Matrícula del doc | 5737JXH | 5135LNN / 5715LNN |

**El mismo PDF da lecturas distintas cada vez.** El código es determinista; su
*input* (lo que lee GPT) no lo es. Por eso "siguen apareciendo errores" aunque
arreglemos código: las guardas (origen≠destino, material, principio del envío,
peso desde carga) **mitigan** —convierten el error en REVISAR en vez de en un
dato falso— pero no pueden hacer determinista algo cuyo input cambia. La única
forma de subir el piso de lectura es el prompt + la revisión humana de las filas
en REVISAR. Esto no es un bug a cerrar: es la propiedad del componente de visión.

---

## Fase 3 — Precisión de extracción (F7 · F11)

| Paso | Qué |
|---|---|
| **3.1** | **Referencia por cliente como guarda de código**: cada emisor tiene su regla (Foresa nº corto 20/26; Bresfor 10 dígitos; Quimidroga "Referencia en factura"…). Hoy sólo está en el prompt |
| **3.2** | **Cargar los alias de puntos descubiertos** (empresa→punto: COGERSA, DISICLIN, INLEIT…) para que la dirección cruda resuelva |
| **3.3** | **Guarda de fecha**: la fecha del documento debe caer cerca de la de carga/descarga de la ficha; si no, no se usa para desempatar |

## Fase 4 — El caso asíncrono (F8)

Julio adelantó que a veces subirá **primero los documentos y después las fichas**.
Hoy el sistema asume que llegan juntos. Solución: retener los documentos sin ficha
y cruzarlos **entre ingestas** por matrícula + fecha, en vez de descartarlos.

---

## Criterio de cierre

El sistema está integral cuando, sobre las 3 hojas de referencia:

- ninguna columna de las 23 del formato objetivo queda vacía **sin un motivo
  escrito** al lado;
- ningún dato aparece **lleno pero equivocado** (el modo de fallo caro);
- cada fila dice, en su columna Estado, si es facturable o qué le falta.

**Regla que no se negocia:** vacío con motivo es aceptable; lleno y falso, no.
