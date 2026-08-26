# Extracción de fichas y documentos → carga en Gesruta

> **Documento maestro.** Todo lo aprendido sobre de dónde sale cada dato, qué
> documento manda sobre cada campo, cómo se traduce a los códigos de Gesruta y
> qué salvaguardas existen y por qué. Escrito para que el conocimiento no viva en
> una sesión de chat: si alguien (persona o modelo) tiene que retomar esto, acá
> está el porqué de cada decisión.
>
> Fuentes del análisis (2026-08-24/25):
> - 9 juegos reales de **ficha de chófer + su documentación** (~70 páginas leídas
>   página por página). Notas por juego en `docs/analisis/A..H.md`.
> - Export histórico de Gesruta **nomenclado, 8.755 líneas** (todo el año).
> - Listado oficial de **materiales** (558 códigos) y formato objetivo de la
>   planilla (29 columnas, `Excelente_detalle_Code_Tabla`).

---

## 1. El modelo: tres cosas distintas

| | Qué es | Qué aporta |
|---|---|---|
| **Ficha de chófer** | Una hoja manuscrita = **una semana de un chófer**, con hasta 3 bloques de viaje | Chófer, tractora, remolque, fechas, lugares "de andar por casa", **los KM** |
| **Documentación** | CMR, albarán, carta de porte, orden de transporte, mail de encargo | Cliente, referencia, lugares legales, material, **peso real** |
| **Viaje** | La unidad que se carga en Gesruta y se factura | El cruce de ambos |

**Principio rector (asimetría):** el documento **impreso** es la fuente
confiable; la ficha **manuscrita** es la sospechosa. Cuando difieren en identidad
(matrícula, cliente, referencia, peso), **manda el documento**. La excepción son
los **KM**, que sólo existen en la ficha, y los **lugares** (ver §4).

---

## 2. Cruce ficha ↔ documento: la matrícula

### El problema
Leer 7 caracteres manuscritos sin error es poco fiable. Exigir lectura perfecta
hacía que ~90 % de los escaneos no correlacionaran.

### La solución: padrón de flota (conjunto cerrado)
`ficha/flota.js`. La flota son **28 tractoras**. No se adivina: se **elige dentro
de una lista conocida**, y sólo cuando la elección es inequívoca.

**Dato que sostiene el umbral** (similitud posicional entre matrículas de la flota):

| Coinciden | Pares |
|---|---|
| 5 de 7 | **1 solo** (`3729JLH` / `3729JWP`) |
| 4 de 7 | 1 par |
| ≤3 de 7 | los otros 376 |

Con 4-5 caracteres bien leídos la matrícula queda unívoca.

**Regla:** puntaje por aciertos posicionales; gana la mejor **con margen** sobre
la segunda (margen 1 si hay 6/7 = un solo carácter mal; margen 2 si no). Empate
o margen insuficiente → **no resuelve**, devuelve candidatas.
Fuera del padrón (subcontratado) → **pasa tal cual, no bloquea**.

### Normalización previa (en código, no depende del modelo)
- **Prefijo de país**: los CMR escriben `Vehículo tractor: ES 0332LPL` → se quita `ES`/`PT`.
- **Cero inicial perdido**: `332LPL` → `0332LPL` (la matrícula española es 4 dígitos + 3 letras).

### Cuando la ficha no trae matrícula
La visión a veces devuelve `null` (pasó: en una corrida leyó `0332LPZ`, en la
siguiente nada). Si **ninguna** ficha del envío tiene matrícula legible, el envío
es de **una sola ficha**, y los documentos **dominan** en una matrícula sin
empate → se **adopta** esa, marcando REVISAR.

### Cuando el envío tiene dos camiones
Un envío real puede tener varios camiones (un viaje cubierto por otro camión).
La salvaguarda se evalúa **por ficha**: sólo cuentan como candidatas las
matrículas de documento **cercanas** a esa ficha. Las lejanas son otro camión y
**no bloquean** los viajes limpios.

> **Bug real corregido:** exigir unanimidad en todo el lote bloqueaba también los
> viajes limpios y los dejaba sin documento, sin cliente y sin tarifa.

### Trazabilidad
**Todo cambio de matrícula marca REVISAR con motivo.** Cambiar una matrícula
decide a qué viaje se pegan los documentos y, aguas abajo, qué se factura: nunca
puede pasar en silencio.

---

## 3. Cliente: quién es el cliente de TLE

### La regla
El cliente es **quien emite el encargo**: el documento donde TLE figura como
*proveedor*, *transportista contratado* o *transportista efectivo*.

**Jerarquía:**
1. `Orden de carga` / `Orden de transporte` / `Pedido de compras` — si trae
   **"FACTURAR A"** (Foresa) es definitivo.
2. `Mail` de encargo — el dominio del remitente (`@grupornm.pt` → RNM).
3. Guía/albarán del vendedor cuando él contrata (Bresfor, Químicas del Jarama).
4. CMR / carta de porte — **último recurso**.

### Lo que NO es el cliente
- El **"Cliente/Customer" impreso en el albarán del proveedor**: ése es el cliente
  *de ellos*. En el albarán de RNM figura "Cliente: BIOETANOL GALICIA" — pero el
  cliente de TLE es **RNM**, que encargó el transporte.
- El **remitente del CMR** (recuadro 1). De ahí salió el error real: se facturó a
  `CELLMARK` (dueño sueco de la carga) un viaje que había encargado **RNM**.
- El **"Mercancía por cuenta de"** de la carta de porte: es el dueño de la carga.

### Un viaje puede tener 5 empresas distintas
Ácido sulfúrico Avilés→Famalicão:

| Rol | Empresa |
|---|---|
| Cargador | ASTURIANA DE ZINC |
| Expedidor | FERQUIMER |
| Agencia | FERQUIASTUR |
| Destinatario y **quien encarga** | **RNM** ← el cliente |
| Transportista efectivo | TLE |

### Guarda estructural
Un valor que coincide con la **razón social del propio emisor** del documento no
es un lugar, es su domicilio → se descarta y se sigue bajando en la precedencia.
Sirve para cualquier cliente futuro, sin listas de empresas.

---

## 4. Origen y Destino

### De dónde salen
Del campo **etiquetado**: `Lugar de Carga` / `CARGA EN` / `Local Carga` /
recuadro 4 del CMR; y `Destino` / `DESCARGA EN` / recuadro 3.
**Nunca** el domicilio social del remitente (recuadro 1 del CMR).

> **Bug real corregido:** origen y destino salían del **mismo** documento elegido
> por `destino`, con el CMR primero — y el recuadro 1 del CMR es el remitente. De
> ahí salió "CELLMARK AB, SE-001 18967, SUECIA" como origen de una carga hecha en
> Barcelona. Ahora se resuelven **por separado**, cada uno con su precedencia.

### El hallazgo grande: el mismo lugar, dos nombres
El documento usa el nombre **legal/portuario**; la ficha y Gesruta el **comercial**.
Sin estos alias, **14 de 21** orígenes no traducían:

| Documento | Ficha / Gesruta |
|---|---|
| GAFANHA DA NAZARÉ | **AVEIRO** (8 viajes) |
| SAN JUAN DE NIEVA | **AVILÉS** (3) |
| MUELLE DO FERRAZO | **VILLAGARCÍA** |
| CARREIRA (Portugal) | V.N. FAMALICÃO |

**Por eso el sistema prueba el literal del documento Y el de la ficha**, y se
queda con el que resuelva a punto Gesruta.

### Segundo hallazgo: muchos "puntos" de Gesruta son EMPRESAS
No son localidades. El destino del documento suele traer el nombre de la empresa,
así que hay que buscarla **también** como punto:

`COGERSA` (Serín) · `CURIA SPAIN` (Boecillo) · `INLEIT` (Curtis) ·
`RACENTRO` (Monte Redondo) · `DROGAS VIGO` (Porriño) · `GAMEROIL` (Mérida)

> Cuando faltó "Serín", la respuesta correcta no era Gijón ni Asturias: era
> **COGERSA**, con 34 viajes en el histórico.

### Reglas del resolvedor de puntos (`catalogo/resolver-punto.js`)
1. Exacto contra nombre canónico → alta
2. Exacto contra alias → alta
3. Distancia ≤1 contra **un solo** canónico → media + REVISAR
4. Contención de tokens unívoca (`CALDAS` ⊂ `CALDAS DE REIS`) → media + REVISAR
5. **Localidad dentro de una dirección** — el canónico como tokens completos
   dentro del literal largo. Los documentos escriben la dirección entera
   (`CELLMARK, MUELLE DE LA ENERGIA S/N, 08039 BARCELONA`).
6. Multi-candidato o sin match → `punto_no_reconocido` + REVISAR

**Gana el que aparece ANTES, no el más largo.** Las direcciones van de lo
específico a lo general.
> **Bug real corregido:** `Navia Asturias` resolvía a **ASTURIAS** (la provincia)
> en vez de **NAVIA** (el pueblo de descarga).

**Normalizaciones:** se ignora el marcador de país del catálogo (`LEIRIA (PT)`) y
se unifican abreviaturas toponímicas (`V.N. Famalicão` ↔ `VILANOVA FAMALICAO`).

### Landim NO es alias de Famalicão
Existe como punto propio `LANDI · LANDIN (PT)` con su tarifa (45,00 → 46,35 €/tn).

---

## 5. Referencia — cada cliente la nombra distinto

| Cliente | Dónde está |
|---|---|
| **QUIMIDROGA** | `Referencia en factura` |
| **FORESA** | `ORDEN DE CARGA` — el número **corto**, puede empezar por **20 o 26** |
| **BRESFOR** | el número **largo de 10 dígitos** que está al lado (`5050139934`) |
| **RNM** | nº de `Guia de Remessa` / `Guia InterComp` |
| **BALTRANSA** | nº de `Orden de Transporte` |
| **QUÍMICAS DEL JARAMA** | nº de `Albarán` |
| **TRANSTAMBRE** | nº de `Carta de Porte` |

---

## 6. Cantidad (peso)

Del **documento de peso en ORIGEN**: albarán del cargador, guía de remessa o
ticket de báscula de carga.

- El peso de **destino** casi siempre difiere (23.940 origen vs 23.960 destino).
  **Manda el de origen** (§4 del modelo de dominio).
- El **nominal de la orden NO sirve**: Quimidroga pide 24.000 y el albarán real
  dice 23.460.
- Si el viaje es **cotizado por unidad**, la Cantidad va **1**.

---

## 7. Material → código Gesruta

`catalogo/gesruta.js`. Catálogo oficial: **558 códigos**.

Cascada: alias exacto → nombre canónico exacto → contención **por límite de
palabra** unívoca. Se limpia el ruido (concentraciones, `UN 1824`, `BULK`,
`GRANEL`, `SOLUCION`).

Los documentos lo escriben en tres idiomas — `SOSA CÁUSTICA`, `SODA CÁUSTICA`,
`CAUSTIC SODA LIQUOR`, `Liquid Caustic Soda` — y todas son **SOSA (51)**.

> **Bug peligroso corregido:** el alias `RES` matcheaba dentro de "**RES**ORCINOL"
> por substring crudo y habría facturado **COLA** por un producto distinto. La
> contención es ahora por **límite de palabra**.

---

## 8. Chófer → código Gesruta

Mismo método que la matrícula (idea de Julio): conjunto cerrado de **25 chóferes**,
puntaje **ponderado por caracteres** con tolerancia de 1 carácter en tokens ≥3.

- El puntaje es el **solapamiento real**, no la longitud del token leído.
  > **Bug corregido:** una inicial canónica (`M` de "LUIS M. TRIÑANES") matcheaba
  > cualquier palabra con esa letra, y "MARCOS" quedaba empatado.
- Se conservan las **iniciales**: `M FERREIRA` necesita la M para distinguir
  MANUEL FERREIRA de JOSE JORGE FERREIRA.
- Tolerancia real: `RUBEN ABELO`→ABALO, `MANUEL ABEY`→ABOY, `JUAN L GLZ`→GLEZ.

> **El documento corrige a la ficha también aquí:** leí "Luis S. Cazouso" en un
> manuscrito; la guía de RNM decía **JOSE ANTONIO VAZQUEZ HERMO**.

---

## 9. Precio / Tarifa

### Jerarquía
1. **Precio impreso en la orden del cliente** — es el pactado para ese viaje.
   Transtambre `1200 €/VIAJE + 4,59 % INDEX GASOIL`; Baltransa `PRECIO: 1.100,00 EU`.
   Cuando el viaje es cotizado, **Cantidad = 1**.
2. **Tarifario oficial** por cliente + ruta + material.
3. **Tarifario histórico** (`catalogo/tarifario-historico.js`) — siempre REVISAR.
4. Nada → vacío **con motivo**. Nunca se inventa un precio.

Foresa remite a contrato: `"Precio según tabla tarifas Foresa fecha 01.01.2026"`.

### El problema del tarifario oficial
Cuando el destino real **no está tarifado** y hay uno **cercano** que sí, la
oficina aplica a mano la tarifa del cercano **sin dar de alta la ruta nueva**.
Buscar por (cliente, origen, destino) devuelve vacío aunque el viaje sí tenga
precio conocido.

### La solución (idea de Julio, validada con dato)
En Gesruta el viaje queda cargado con el **destino correcto** y la tarifa aplicada
a mano. **El histórico ya contiene la respuesta.** Se construye un tarifario
**anexo, no oficial**, indexado por la ruta real.

Prueba en el dato:
```
RNM  AVEIR → C      = 29,09 €/tn      (Coruña, tarifado)
RNM  AVEIR → TEIXE  = 29,09 €/tn      (Teixeiro, NO tarifado)
```

**Clave = cliente + origen + destino + MATERIAL** (por códigos Gesruta). El
material entra porque una misma ruta cambia de precio por producto:
`Foresa 1→OR` es **13,85 para COLA** y **20,16 para FINCAT**.

### Las tarifas se renegocian → manda la MÁS RECIENTE
```
Quimidroga MIR → GUIM:   29,80  →  59,85  →  61,65 €/tn
Jarama MEJOR → LANDI:    45,00  →  46,35
Foresa 2 → COGER:        32,45  →  33,10
```
Exigir "precio único" descartaba justo las rutas más usadas. Se toma el viaje más
reciente y **se avisa si el precio cambió** durante el año.

### Cambio de modalidad de facturación (hallazgo)
Hay rutas que mezclan €/tn y € por viaje. **No es ambigüedad: es un cambio en el
tiempo.** RNM Avilés→Famalicão se cobraba **875 € por viaje** (enero-marzo) y hoy
**39,13 €/tn** (agosto). La línea más reciente trae la modalidad vigente.

---

## 10. Régimen de indexación — por PAÍS DEL CLIENTE

**No depende del destino del viaje.** `catalogo/regimen.js`.

| Código | Significado |
|---|---|
| `G` | portes nacionales (cliente español) |
| `GPT` | portes internacionales (cliente portugués) |
| `G1Q` / `G2Q` | indexación de gasóleo por **quincena** (1ª / 2ª) |

Verificado sobre las 8.755 líneas — el reparto es limpio:

| Cliente | Régimen |
|---|---|
| BRESFOR IND. DO FORMOL | GPT 165/165 |
| RNM TRANSPORTES QUIMICOS, LDA | GPT 66/66 |
| QUIMIDROGA PORTUGAL, LDA | GPT 2/2 |
| QUIMIDROGA, S.A. | G 110/110 |
| FORESA, S.A. | G 165 · G1Q 35 · G2Q 33 |

**Un viaje de RNM a Navia (España) sigue siendo GPT:** manda el cliente, no la ruta.

- **Fuente primaria:** el propio histórico (qué régimen se le aplicó a ese cliente).
- **Fallback** para cliente nuevo: forma societaria (`LDA`/`UNIPESSOAL` → PT;
  `S.A.`/`S.L.` → ES), marcado REVISAR.
- **FORESA** es el único con quincenas: factura parte de sus viajes por período.

---

## 10 bis. Modalidad de indexación — por LÍNEA o por PERÍODO

El §10 resuelve **de qué país** es la indexación (`G` vs `GPT`). Esto resuelve
**cómo se cobra**: viaje por viaje, o acumulada. Son dos ejes independientes.
`ficha/modalidad-indexacion.js`.

### Las cuatro modalidades

| Modalidad | Qué significa | Importe de la línea |
|---|---|---|
| `linea` | se indexa **cada viaje** sobre su propio importe | se calcula |
| `agregada` | se indexa el **acumulado del período** | null en la línea, se acumula aparte |
| `incluida` | la tarifa ya la contiene (**Baltransa**: línea a 0,000) | **0** |
| `sin_indexacion` | ese cliente **no lleva** indexación | **0** |

### Cómo se distinguen en el histórico

Gesruta escribe la línea de indexación como `CANTIDAD = base · PRECIO = pct
decimal · IMPORTE = base × pct`. La **base** delata la modalidad:

| Caso real (albarán) | Porte | Base de la indexación | Lectura |
|---|---|---|---|
| 50458 | 1.498,56 | **1.498,56** | igual al porte → **por línea** |
| 50448 | 482,01 | **11.944,32** | 25× el porte → **acumulada** |

Y un cliente con portes y **cero** líneas de indexación es `sin_indexacion`
— no un cliente al que se nos olvidó indexar.

### La regla que evita el error más caro: **NUNCA `linea` por defecto**

Confirmado contra facturas en `reglas-facturacion.md`: **TANK SOLUTIONS**,
**TRANSPORTES SANTOS** e **HISPALENSE** facturan *sin* indexación. Un default
`linea` les inventaba un cobro que su factura no lleva — y eso se descubre en la
reclamación del cliente, no en la revisión. Sin evidencia → `null` + REVISAR.

### FORESA es MIXTA — y por eso no se decide por cliente

Foresa factura **de las dos formas** según el servicio (metanol mensual,
Orember quincenal, el resto por línea). Elegir una por mayoría acertaría la mitad
de las veces. Se marca `mixta` → `null` + REVISAR, y se decide por viaje.

### El período se agrupa por TRAMO DE PCT, no por calendario

Es el punto más importante y está confirmado por escrito en
`reglas-facturacion.md`:

> *"Los tramos dependen de cómo se actualizó ese mes: puede ser quincenal, una
> vez al mes, o más. **NO asumir quincenas fijas.**"*

y describe el metanol mensual *"con líneas agregadas por tramo de pct dentro del
mes"*. O sea: **la unidad real de agregación es el tramo**; quincenal y mensual
son dos casos particulares de lo mismo.

- Un mes con **dos** actualizaciones de gasóleo → **dos** líneas agregadas.
- Un mes con **una** → **una**.
- Las etiquetas `G1Q` / `G2Q` son **texto de Gesruta**: no definen el corte.

Agrupando por tramo salen bien los dos casos conocidos y también el *"o más"*
que todavía no vimos.

### La base es sólo PORTE (D-08)

Los **repartos** (90 € de traslado), la **paralización** y los **lavados** quedan
**fuera** de la base de indexación. Confirmado en factura 298.

### Qué se calcula y qué no

La indexación agregada **sigue sin cerrarse por viaje** (D-03): el importe de la
línea es `null` y se cierra en facturación. Lo que sí se hace ahora es exponer
`base_periodo` y el tramo vigente, y sumarlos por tramo. **Exponer la base no es
calcular el cobro: es poder auditarlo** antes de que llegue la factura — que es
justo cuando ya no se puede verificar.


---

## 10 ter. Los tres ejes de la indexación (datos de Julio, 26/08/2026)

Lo que antes era **un** concepto son en realidad **tres, independientes**:

| Eje | Qué decide | Dónde vive |
|---|---|---|
| **Grupo** | de qué solapa del Suplemento sale el % | `catalogo/suplemento-gasoleo.js` |
| **Modalidad** | si se itemiza por albarán o se acumula | `ficha/modalidad-indexacion.js` |
| **Período** | cada cuánto se emite la factura | `ficha/periodo-facturacion.js` |

### La modalidad NO cambia el importe

Verificado sobre `PRUEBA_2608_LINEA_FACTURACION.CSV`: en los clientes "por
línea" el **ratio indexación/porte de cada albarán es exactamente el % del tramo
de esa fecha** — Bresfor 0,1838 y 0,1452; Helm 0,1385; RNM 0,1848.

El cálculo es **siempre** `base × % del tramo`. Lo único que cambia es si esa
cuenta aparece línea por línea o sumada. Por eso la factura de Bresfor muestra
*"una línea por valor de indexación según período de fecha"* aunque el detalle
interno de Gesruta tenga una línea por albarán: **al facturar se agrupan por %**.

### Cómo se detecta la modalidad: por COBERTURA

La señal es qué **fracción de los albaranes** lleva su propia línea de
indexación. (La heurística anterior —comparar la base contra el porte— resultó
inaplicable: el 94 % de las líneas se escriben como `cantidad=1, precio=importe`,
sin base explícita.)

Coberturas reales por ruta de Foresa:

| Ruta | Albaranes | Con línea propia | |
|---|---|---|---|
| CALDAS → OREMBER (COLA) | 586 | **2,0 %** | agregada |
| VILLAGARCÍA → CALDAS (METANOL) | 236 | **3,0 %** | agregada |
| CALDAS → OREMBER (FINCAT) | 116 | **6,9 %** | agregada |
| CALDAS → TARRAGONA | 26 | **46,2 %** | por línea |
| VILLAGARCÍA → VALLADOLID | 23 | **69,6 %** | por línea |
| CALDAS → TERMOLAN | 50 | **78,0 %** | por línea |
| CALDAS → TERUEL | 42 | **83,3 %** | por línea |

**Entre el 7 % y el 46 % no hay ninguna ruta.** Los umbrales (20 % / 40 %) caen
en un hueco que está en el dato, no en una elección nuestra.

Esto confirma exactamente la regla de Julio: *"para Foresa la indexación por
viaje sólo se realiza en Foresa otros, Villagarcía otros y Retornos"*. Los dos
servicios agregados son **Metanol Villagarcía→Caldas** (mensual) y **destino
Orember** (quincenal).

> Un **retorno** también llega a Caldas. Lo que lo distingue del metanol es el
> **origen**: el metanol sale de Villagarcía; el retorno vuelve desde donde se
> hizo la entrega.

### Período de facturación (23 clientes)

Casi todos **quincenal**. Dos admiten las dos formas y por eso van a REVISAR en
vez de asumirse: **FORESA** (el metanol Villagarcía→Caldas es mensual de mes
completo; los retornos, opcional) y **CLAVO FOOD**.

Un cliente fuera de la tabla → `null` + REVISAR, nunca un período inventado.

### El % de la ORDEN manda sobre la tabla

*"Los clientes que cotizan por viaje, en la OC figura el porcentaje."* Confirmado:
**TRANSTAMBRE** aplicó 0,0532 y 0,0877; **A.G.E. GODOY** 0,0748 — valores que no
están en **ninguna** solapa. Son pactados por operación. Aplicarles la tabla
facturaría un % que el cliente no aceptó.

### Baltransa

`incluida`: línea de indexación a **0 en cada viaje, siempre**. Confirmado en el
CSV (40 líneas, todas a cero).

---

## 10 quater. Suplemento Gasóleo: los % y los defectos del archivo

`catalogo/suplemento-gasoleo.js` — transcripción literal de las **6 solapas**.
AGENCIA y AUTONOMOS figuraban como *"pendientes"*: **ya tienen valores**.

### Los tramos son SEMANALES, no quincenales

Por eso una quincena contiene dos o más tramos, y por eso **una factura quincenal
puede llevar dos líneas de indexación con % distintos**. Está en el archivo:

```
HELM  2026-06-01 → 06-07 = 0,1256
HELM  2026-06-07 → 06-15 = 0,1141    ← misma quincena, otro valor
```

Es la advertencia literal de Julio y la razón de que la agregación vaya **por
tramo** y nunca por quincena natural.

### Cuatro defectos del archivo — se denuncian, no se corrigen

`verificarTramos()` los reporta. **No se arreglan por nuestra cuenta: inventar un
tramo es inventar un cobro.**

| # | Defecto | Alcance |
|---|---|---|
| 1 | **Fecha corrupta** `1900-01-16` en FORESA-BRESFOR | ver abajo |
| 2 | **Hueco del 16–17 de mayo** | las **6** solapas |
| 3 | **Abril sin %** | QUIMIDROGA · OTROS · AGENCIA · AUTONOMOS |
| 4 | **Solapes en el día de corte** | varias |

### El defecto 1 es el grave, y no es lo que parecía

No deja un hueco: deja un tramo que **se traga cinco meses**. Va de `1900-01-16`
a `2026-06-21`, así que cubre *todas* las fechas anteriores al 21 de junio y se
superpone con los ocho tramos correctos de ese rango.

**Medido: de los 153 días de abril a agosto, 55 quedan ambiguos** — todo abril,
todo mayo y la primera mitad de junio. Un viaje del 20 de abril cae a la vez en
el 0,1838 (correcto) y en el 0,1279.

Con *"el primero que matchea"* habría devuelto el correcto **por casualidad** —
por el orden del array — tapando el problema. La guarda de ambigüedad lo saca a
la luz.

> **Pendiente para Julio:** corregir `1900-01-16` en el Excel. Por el patrón de
> las otras cinco solapas debería ser `2026-06-15`, pero es un cambio de **dato**,
> no de código, y no se asume.

### Solapes: cuándo importan y cuándo no

`buscarPct` ya no se queda con el primero que matchea:
- todos los tramos que matchean con el **mismo** % → se resuelve
- % **distintos** → `ambiguo`, con los candidatos a la vista. Elegir uno es
  elegir cuánto se factura.

---

## 11. KM

**Sólo están en la ficha**; ningún documento los trae. `ficha/odometro.js`.

- **Km cargado** = km final − km inicio. Lo calcula **siempre** el sistema; el
  `km recorridos` que escribe el chófer es **verificación**, no fuente.
- **Km vacío** = km inicio de este viaje − km final del **viaje anterior de la
  misma TRACTORA**.

### La cadena es por TRACTORA, no por ficha

El odómetro es **del camión**, no de la hoja ni del chófer. De ahí salen las tres
consecuencias que definen el diseño:

| | Consecuencia |
|---|---|
| Dos fichas del **mismo** camión (dos chóferes, dos semanas) | **encadenan** |
| Dos bloques de camiones **distintos** | **nunca** encadenan |
| Orden dentro de la cadena | por **odómetro**, no por posición ni por fecha |

Se ordena por odómetro porque es monótono creciente por construcción, y así no
depende de que la fecha manuscrita se haya leído bien.

### El padrón de últimos odómetros

El km final del último viaje de cada tractora **se persiste y se relee** en la
ingesta siguiente. Sin eso el **primer viaje de cada ficha** no puede tener km
vacío — le falta el dato de dónde venía el camión — y eso es **1 de cada 3
viajes** (una ficha son 3 bloques), siempre el mismo.

> Éste es el encargo literal: *"el registro de último KM tractora es por viaje,
> no sólo en el último viaje de cada ficha"*.

Por tractora se toma el `km_final` **más alto**, no el de fecha más reciente: el
odómetro sólo crece, así que el máximo es el último sin depender del orden en que
la tabla devuelva las filas.

### Guardas — un km vacío inventado se factura; un null se revisa

| Situación | `origen_km_vacios` | km vacío |
|---|---|---|
| encadenado con la tabla | `cadena_tabla` | se calcula |
| encadenado dentro del lote | `cadena_lote` | se calcula |
| primer viaje conocido de esa tractora | `sin_odometro_previo` | null |
| salto **negativo** → falta un viaje intermedio | `negativo` | null + REVISAR |
| salto **> 1.500 km** → hay viajes sin registrar | `salto_excesivo` | null + REVISAR |
| sin matrícula resuelta / sin km inicio | `sin_matricula` · `sin_km_inicio` | null |

El umbral de 1.500 km sale de que un retorno largo en vacío (Huelva → Galicia)
ronda los 900. Por encima, lo probable es que falten viajes, no que el camión
haya hecho ese vacío.

**El odómetro avanza aunque el vacío no se haya podido calcular:** un eslabón
roto no rompe la cadena para el viaje siguiente — lo que importa de él es dónde
quedó el camión.

### Guardas anti-invención del odómetro (ya existían)

- `km cargados <= 0` → se anula.
- **múltiplo exacto de 500** → los odómetros reales casi nunca lo son; se anulan.
- **todos los viajes de la hoja dan el mismo km** → se anulan todos.
- `|km recorridos − (final − inicio)| > 5` → REVISAR.

---

## 12. Los catálogos: todo es conjunto cerrado

| Catálogo | Tamaño | Archivo |
|---|---|---|
| Flota (tractoras) | 28 | `ficha/flota.js` |
| Chóferes | 25 | `catalogo/gesruta.js` |
| Materiales | **558** | `catalogo/gesruta.js` |
| Puntos | ~305 | data table `puntos` + `catalogo/resolver-punto.js` |
| Clientes | 59 | data table `clientes` + `ficha/clientes.js` |

**Principio común:** no se traduce con criterio libre, se **elige dentro de una
lista conocida**, y sólo cuando la elección es inequívoca. Lo que no resuelve
queda **vacío con motivo**, para revisión humana. **Nunca se inventa un código.**

---

## 13. Cosas que el sistema NO debe hacer

1. **No inventar** matrícula, cliente, punto, material, chófer ni precio.
2. **No prestar la carga de un viaje a otro**: un documento que no se puede
   atribuir queda adjunto aparte, no define material/origen/destino de otra pata.
   > Bug real: un CMR de ácido sulfúrico contaminaba una pata de sosa.
3. **No forzar documentos a los 3 bloques de la ficha**: los juegos traen
   documentación de viajes posteriores que no están en esa ficha.
4. **No cambiar una matrícula en silencio** — siempre REVISAR con motivo.
5. **No facturar el kg de la orden** — es planificación, no peso real.
6. **No usar el peso de destino** cuando hay peso de origen.

---

## 14. Formato objetivo: las 29 columnas

`Excelente_detalle_Code_Tabla`. Notas de las que tienen truco:

| Columna | Nota |
|---|---|
| **Cabeza / Proveedor** | Si la ficha es de *Transporte Hnos. Estévez Casal*: Cabeza = `PROVE`, Proveedor = `5` |
| **Cantidad** | Si el viaje es cotizado por unidad, va **1** |
| **Precio** | Tarifa por cliente+origen+destino+material, o por viaje unitario |
| **Importe** | Peso × tarifa, o valor del viaje cotizado, **+ IVA si corresponde** |
| **Reparto** | Cuando una carga en un origen tiene **más de una descarga** |
| **Gastos** | Sólo si está con OK y autorizado por Ángeles |
| **Km Vacío** | Ver §11 |

---

## 15. Estado y pendientes

**Resultado sobre los 21 viajes leídos de documentación real:**
21/21 en matrícula, chófer, cliente, origen, destino, material y régimen;
**20/21 con precio** (18 del histórico, 2 del precio impreso en la orden).

**Lo único sin precio:** Quimidroga `Barcelona → Racentro (Leiria)` — ruta nueva
del año, no hay dato del que deducirla. Es alta de tarifa.

**Pendientes de implementación:**
- Indexación por línea o por período (quincena/mes según cliente) — el % y el valor.
- Registro de KM por viaje (habilita el Km Vacío).
- Botón "volver al menú" en Ingesta y Pendientes.
- Registro real de documentos (el nodo `Preparar Registro Documento` es un stub).
- Cargar los alias descubiertos en la data table `puntos`.

---

## 16. Dónde vive cada cosa en el repo

| Pieza | Archivo | Qué hace |
|---|---|---|
| **Este documento** | `docs/EXTRACCION-Y-CARGA-GESRUTA.md` | El porqué de todo |
| Notas del análisis documental | `docs/analisis/A..H.md` | Qué dice cada papel, juego por juego |
| Padrón de flota | `ficha/flota.js` | Matrícula contra conjunto cerrado |
| Material + chófer Gesruta | `catalogo/gesruta.js` | 558 materiales, 25 chóferes |
| Puntos | `catalogo/resolver-punto.js` | Cascada de 6 pasos + alias |
| Identidad de cliente | `ficha/clientes.js` | Nombre corto → razón social |
| Tarifa contractual | `ficha/tarifa-contractual.js` | Tabla Tarifas oficial |
| **Tarifario histórico** | `catalogo/tarifario-historico.js` | La tarifa realmente aplicada |
| **Régimen de indexación** | `catalogo/regimen.js` | Por país del cliente (G/GPT) |
| **Modalidad de indexación** | `ficha/modalidad-indexacion.js` | Por línea o por período |
| **Suplemento Gasóleo** | `catalogo/suplemento-gasoleo.js` | Los % oficiales + QA del archivo |
| **Período de facturación** | `ficha/periodo-facturacion.js` | Quincenal/mensual por cliente |
| Correlación ficha↔documento | `ficha/correlacionar.js` | El cruce y las salvaguardas |
| **Odómetro por tractora** | `ficha/odometro.js` | Km vacíos y último km registrado |
| **Los prompts** | `ficha/payload.js` | `PROMPT_FICHAS` y `PROMPT_DOCS` |
| Grafo del workflow | `docs/grafo-ingesta-tarifa.md` | Nodos, conexiones, deploy |

Los nodos de n8n se generan con `node ficha/build-nodo.js` (los `.generated.js`
se pegan a mano en el editor). `node ficha/build-nodo.js --check` verifica que
repo y workflow no se hayan separado.

---

## 17. Bugs reales encontrados y su causa raíz

Se dejan registrados porque cada uno costó una corrida y ninguno era obvio.

| Síntoma | Causa raíz | Fix |
|---|---|---|
| 3 viajes sin documentos, sin cliente ni tarifa | La salvaguarda de convergencia exigía **unanimidad** en todo el lote; un viaje cubierto por otro camión bloqueaba los limpios | Convergencia **por ficha**, no global |
| Cliente = CELLMARK en vez de RNM | El CMR declara al **dueño de la mercancía**, no a quien contrata | Autoridad del **documento de encargo** |
| Origen = "SUECIA" | Origen y destino salían del **mismo** documento elegido por `destino`, con el CMR primero | Resolver **cada campo por separado** + guarda anti-domicilio |
| Origen/destino nunca traducían | El resolvedor buscaba el literal **dentro** del canónico; los documentos traen la dirección entera | Paso 5: canónico **dentro** del literal |
| `Navia Asturias` → ASTURIAS | Ganaba el canónico **más largo** | Gana el que aparece **antes** (más específico) |
| `Resorcinol` → COLA | El alias `RES` matcheaba por **substring crudo** | Contención por **límite de palabra** |
| `MARCOS` sin resolver | Una **inicial** canónica (`M`) matcheaba cualquier palabra con esa letra | Puntaje por **solapamiento real** |
| Tabla `Viajes` vacía | Con `Execute Once`, una tabla vacía emite 0 ítems y n8n **saltea** el nodo siguiente | `Always Output Data` en los lectores |
| Ingesta colgada 5-8 min | Los lectores en serie multiplicaban ítems: `Leer Viajes Existentes` corría **390 veces** | `Execute Once` en los tres lectores |
| Visión 97 s y ~1 € por página | GPT-5 **razonando** una tarea de transcripción | Intento con `reasoning_effort:minimal` **falló** (el endpoint lo cuelga); se revirtió y se bajaron los reintentos de 5 a 2 |
| Rutas activas sin tarifa | El histórico exigía **precio único**; las tarifas se renegocian | Manda el viaje **más reciente** |
| Rutas descartadas por "unidades mezcladas" | No era ambigüedad: era **cambio de modalidad** (por viaje → por tonelada) | Se toma la modalidad del último viaje |

---

## 18. Cómo re-verificar todo esto

```bash
cd /workspace/transliquidos_estevez
node --test ficha/tests/*.test.js catalogo/*.test.js   # 286 tests
node ficha/build-nodo.js --check                        # repo == workflow
```

Los tests fijan como contrato cada una de las reglas de este documento: si
alguien afloja una salvaguarda, un test se pone rojo y explica por qué existía.
