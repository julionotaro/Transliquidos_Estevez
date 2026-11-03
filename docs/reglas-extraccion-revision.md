# Revisión exhaustiva de reglas de extracción (02/11/2026)

> Consolidación de **todas las reglas aprendidas y necesarias** tras las jornadas de trabajo de
> fin de octubre / principio de noviembre. Es el **checklist que previene los errores vistos**.
> La **fuente operativa** sigue siendo `catalogo/correcciones-julio.json` (la lee el skill
> `procesar-juego`); este documento es el **mapa/repaso** y cita qué regla de allí lo respalda.
>
> Dividido en: **(A)** reglas que DEBÍAN estar claras y fallaron (errores recurrentes de estas
> jornadas), **(B)** reglas nuevas / reforzadas, **(C)** checklist operativo paso a paso.

---

## A. Reglas que debían estar claras y no lo estaban (errores de estas jornadas)

### A1. IVA / concepto por la **NACIONALIDAD del cliente** (no por el viaje)
El IVA depende de a quién se factura, **nunca** del origen/destino del viaje:
- **Clientes PORTUGUESES → PI / IVA 0 / GPT**: RNM, BRESFOR (y cualquier "Lda"). Aunque el viaje
  sea dentro de España.
- **Clientes ESPAÑOLES → P / IVA 21 / G**: Quimidroga, Helm, Baltransa, Comatra, Foresa, Forestal.
  Aunque descarguen en Portugal (Quimidroga→Leiria/Mindelo, Helm→PT, Baltransa→Mindelo = P/21).
- **Error visto:** pregunté el IVA de Baltransa→Portugal cuando la regla ya estaba definida.
- Respaldo: `reglaConcepto()` en el armador + `reglas-por-cliente.md`. → **nuevo** en correcciones.

### A2. La **MATRÍCULA manda sobre la letra** (cruce obligatorio con flota)
Resolver chofer + remolque habitual + **tipo propio/autónomo** por la **matrícula de la tractora**
en `catalogo/flota.json`, nunca por la letra manuscrita de la ficha.
- **ABAL ≠ ABALO ≠ ABELO** (token exacto, no substring): Juan Manuel **ABAL** es autónomo;
  Carlos **ABALO** Quintela es **PROPIO**. Confundirlos cambia la facturación (km en Gastos vs viáticos).
- **Errores vistos (cazados por el guard):** 8729→3729, 7342→7347, 4716→4916, "Alcoy"→**Aboy**,
  "Carlos Abal autónomo"→Carlos **Abalo** propio.
- Respaldo: regla `lectura/cruce` (02/11) + el armador deriva la cabecera por matrícula.

### A3. Leer **TODOS** los documentos; **la OC manda** en cliente y destino
`ficha + OC + albaranes`, nunca un subconjunto. La **OC es la verdad** de cliente y destino; la
ficha confirma km/fechas; el albarán da referencia/peso.
- **TEPSA, SEVITRADE, DIVERSEY, CELLMARK = PUNTOS DE CARGA, no el cliente.** El cliente de
  facturación lo dice la OC: Quimidroga (carga en TEPSA), Comatra (carga en Sevitrade/El Copero),
  Baltransa (carga en Diversey).
- **Errores vistos:** destino "Mindelo" cuando la OC decía Cabopol/**Leiria**; cliente "Servitrade"
  cuando la OC decía **Comatra**.
- Respaldo: regla `lectura/cruce` (02/11).

### A4. El **MATERIAL** define la tarifa (misma ruta, dos precios)
- FORESA **"Aveiro / Abeiro 3009" = carga FINCAT** (Orember **20,16**), **NO COLA** (13,85). Las
  resinas **"RES xxxx" sí son COLA**. Un mismo cliente+ruta tiene dos filas de tarifa por material.
- **Error visto:** clasifiqué los 6 albaranes de Marcos como COLA; 3 eran FINCAT (tarifa distinta).
- Respaldo: regla `FORESA carga/tarifa` (02/11).

### A5. **Referencia por cliente** (cada uno distinto)
- **FORESA:** Nº corto que empieza en **20** (albarán definitivo). Si el albarán es **MANUAL**,
  usar ref **provisoria** hasta que llegue el definitivo.
- **BRESFOR:** "Doc int" que empieza en **5050** (CMR / guía de remessa). Si la CMR es manuscrita y
  no trae el 5050, ref **provisoria** (pedido / báscula).
- **QUIMIDROGA:** la **"Referencia en factura"** de la OC.
- **COMATRA:** la **"Ref. proveedor"** de la OC.
- **BALTRANSA:** el Nº de **Orden de Transporte**.
- **OJO formato de sistema (03/11):** cuando por un **problema de sistema** las OC/albaranes salen
  con un **formato distinto y de apariencia "provisoria"**, esos números **son definitivos igual** —
  no son placeholder, no re-pedir el "definitivo". Lote 26/10: **Abalo 260032**, **Aboy 4500002523**
  quedan como están. No cambia la regla general de ref por cliente; aplica cuando el propio sistema
  emitió el doc con formato anómalo.
- Respaldo: reglas RNM/FORESA/BRESFOR + DIVERSEY/BALTRANSA.

### A6. **Destino = el punto que PORTA la tarifa** (no el literal del doc)
El criterio de qué nombre de punto usar es del humano; se elige el que tiene tarifa:
- **Teruel (TE)**, no UTISA Teruel (ambos existen; la tarifa vive bajo TERUEL).
- **Igualada = Barcelona** (lo dice la OC; tarifa Caldas→Barcelona).
- **Cabopol = Leiria**; **Bio-Oils (Palos) = Huelva**; **Orember** (Finsa Orember, San Ciprián, Ourense).
- **Si el pueblo NO es punto Gesruta → cascada a la provincia/región** (ej **Sanchidrián → Ávila
  (AV)**, vía alias en `puntos-alta.json`). El destino **SIEMPRE** lleva un código: el punto exacto
  si existe, si no su provincia/región. **`codigo:null` solo para un dato ilegible** — si no, el bot
  aborta la carga entera.
- Respaldo: regla `destino` (09/10) + `FORESA/BRESFOR destino/tarifa` (15/10) + `COMATRA` (03/11).

### A7. **Indexación por la FECHA DE CARGA** (quincena correcta)
El factor sale de la quincena de la **fecha de carga** del albarán, no de "el mes".
- FORESA-BRESFOR oct: **1-15 = 0,1664**, **16-31 = 0,1597**. Un viaje del **16/10 lleva 0,1597**.
- **Error visto:** el duotrailer del 16/10 se cargó con 0,1664 (tramo vencido); corregido a 0,1597.
- Respaldo: `datos/gesruta/indexacion-gasoleo.json` (regenerado del suplemento 02/11).

### A8. Operativos recurrentes
- **NUNCA un `;` en observaciones** del registro (rompe el alineamiento de 28 columnas).
- **Agrupación de viajes por VIÁTICOS por hoja:** una hoja con viáticos = un viaje; una hoja **sin**
  viáticos se une a otra para formar un solo viaje. Las **OC de FORESA suelen venir sin ficha**.
- Respaldo: reglas `estructura viaje (viaticos)` (02/11) + `estructura viaje (matriculas)` (14/10).

---

## B. Reglas nuevas / reforzadas

### B1. **Mínimo facturable 23.000 TN — en viajes facturados POR PESO (€/TN)**
- Si el peso real < 23 TN y el viaje se factura **€/TN** → facturar **23,000** (coma: `23,000`).
- **NO aplica** a viajes de **precio fijo por viaje** (um=UN, cantidad 1): Baltransa 2.300,
  Forestal 2.025, etc. — ahí se factura 1 unidad, no hay línea de tonelaje que pisar.
- Refina **R-02** del índice ("23 t SIEMPRE"): el "siempre" es *sin excepción por cliente*, pero el
  mínimo vive en la **línea facturada por peso**; una línea um=UN no tiene tonelaje que redondear.
- El armador ya lo hace: aplica el mínimo solo en el modo €/TN. → **explícito** en correcciones.

### B2. **Modalidades de precio del porte** (elegir la correcta según la OC)
Solo hay **dos** formas de facturar el porte al cliente:
1. **€/TN** (um=TN, cantidad = toneladas): con **mínimo 23** (B1). La mayoría de los viajes.
2. **€/viaje fijo** (um=UN, cantidad 1): Baltransa, Forestal, Helm cuando la OC trae precio
   cerrado. **Sin mínimo** (no hay línea de tonelaje que redondear).

> **Aclaración de Julio (02/11):** cuando dijo "mínimo 23.000 en viajes facturables **por peso y
> tarifa por €/TN**" se refería a **esta** modalidad €/TN — escribir "km" fue un lapsus. **No existe
> una "tarifa por km"** de facturación al cliente. Los **km del autónomo** son otra cosa: van como
> **GASTO** (conceptos KILOMETROS / KILOMETROS EN VACIO, la forma en que TLE le paga al autónomo),
> no como porte ni como tarifa al cliente — ver regla `chofer_tipo/kilometros` (16/10) en
> `correcciones-julio.json`.

### B3. **Indexación: línea vs acumulada vs cero**
- **Línea normal:** concepto **G** (nacional) / **GPT** (internacional), factor de la quincena sobre el porte.
- **ACUMULADA (`cargar:false`):** FORESA destino **Orember** y **Villagarcía→Caldas metanol** — el
  importe se calcula y guarda para control de totales, pero **no** se carga línea por albarán.
- **BALTRANSA:** línea de indexación en **cero** (cantidad 1, factor 0).
- **INCLUIDA en precio fijo (sin línea):** FORESTAL y COMATRA facturan **€/viaje** con la
  indexación ya incluida → **no** se agrega línea de idx (en la orden `indexacion: null`; en el raw
  del armador se declara `idx_incluida: true`).

### B4. Recordatorios de flujo
- **Duotrailer:** una tractora, 2 cisternas, mismo viaje físico → 2 viajes en Gesruta; el 2º lleva
  `cabecera.duo_secundario` + `km.cargar:false` (km, dietas y gastos una sola vez).
- **Autónomo:** sin viáticos; km en Gastos (`km.vacio` explícito en la orden). Hoy: Fraga, Alfonsín, Abal.

---

## C. Checklist operativo (antes de armar cada juego)

1. **Leer TODO**: ficha + OC + albaranes. No minimizar la lectura para ahorrar tokens.
2. **Cabecera por matrícula** → chofer / remolque / **tipo** desde `flota.json` (no la letra). Si la
   matrícula no está en flota, es mala lectura → re-leer.
3. **Cliente** por la OC (TEPSA/Diversey/Sevitrade ≠ cliente). **IVA por nacionalidad** (A1).
4. **Destino** = el punto con tarifa (A6). **Referencia** según el cliente (A5).
5. **Material** → código correcto; ojo FINCAT vs COLA (A4).
6. **Tarifa**: tabla (desambiguada por material) → confirmada-Julio → analogía. Modalidad de precio (B2).
7. **Cantidad**: si €/TN y peso < 23 → **23,000** (B1).
8. **Indexación**: factor por **fecha de carga** (A7); acumulada/cero según corresponda (B3).
9. **Agrupar viajes por viáticos** por hoja (A8).
10. **Registro**: sin `;` en observaciones. Correr `validar_carga.py` antes de commitear.

> El **armador** (`herramientas/armar_orden`) ya hace todo el **cálculo determinístico** de los
> pasos 2-8 y avisa de las discrepancias; la **lectura y el criterio** (1, 3-partes, 4-destino) siguen
> siendo del humano. El armador **no reemplaza la lectura ni justifica leer menos**.
