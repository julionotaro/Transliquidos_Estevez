# ORDEN DE CARGA ACTUAL — Gesruta

> Archivo fijo: siempre contiene el juego pendiente de cargar. Claude (nube) lo actualiza por juego.
> Procedimiento de pantalla: skill `cargar-viajes-gesruta`. Facturación real: **no inventar, fallar ruidoso**.

## Juego: ficha José Antonio Vázquez Hermo (20261009134006.pdf) — **EMPRESA: TLE**

**EMPRESA = TLE** → "Selección de Empresas" → **0006 TRANS. LIQUIDOS ESTÉVEZ S.L.**

**1 viaje, 3 albaranes.** Cabeza (tractora) = **7394** (7394LZP → trae solos remolque **R1832BBC** y chofer **JOSE ANTONIO VAZQUEZ HERMO**).

---

### Albarán 1 — FORESA (nacional)
- Cliente (cód): **1** — FORESA IND. QUIMICAS DEL NOROESTE, S.A.
- Origen → Destino (cód): **1** (Caldas de Reis) → **9731** (Tordera / IP Decor)
- Carga (cód): **1** — COLA  *(el producto es RES 0540; por regla de Julio resina/cola = COLA cod 1)*
- Referencia: **2027538**  *(FORESA = nº corto que empieza en 20, arriba a la derecha; NO el largo 5030296937)*
- Fecha salida (carga): **28/09/2026** · Fecha llegada (descarga): **30/09/2026**
- Línea porte: concepto **P** (PORTES NACIONALES), **U.M. = TN**, cantidad **23,280**, precio **72,36** €/TN (porte 1.684,54)
- Indexación: 2ª línea concepto **G**, cantidad = 1.684,54 (porte), factor **0,1386** → **233,48**
- IVA: **21%**  → Base s/IVA 1.918,02 · Total c/IVA **2.320,80**
- Km: odómetro inicio **436.483** → fin **437.690** = **1.207** km carga

### Albarán 2 — HELM IBÉRICA (nacional, destino Portugal)
- Cliente (cód): **323** — HELM IBERICA, S.A.
- Origen → Destino (cód): **B** (Barcelona, carga en Miladerto) → **PORT** (Portalegre; la entrega es en Ribeira de Nisa, pero esa no tiene tarifa propia → se usa la zona con tarifa, Portalegre)
- Carga: **MONOETILENGLICOL** (si no toma código, doble clic y buscar por nombre)
- Referencia: **6100316242**  *(el doc HELM dice: "incluya este número en su factura para el pago")*
- Fecha salida (carga): **30/09/2026** (fecha real de la ficha) · Fecha llegada: **02/10/2026**
- Línea porte: concepto **P** (PORTES NACIONALES), **U.M. = UN**, cantidad **1**, precio **1.800,00** (fijo, según orden HELM)
- Indexación: 2ª línea concepto **G** (HELM lo factura como nacional), cantidad = 1.800,00, factor **0,1176** (septiembre) → **211,68**
- IVA: **21%**  → Base s/IVA 2.011,68 · Total c/IVA **2.434,13**
- Peso (control): 25.000 kg · Km: inicio **437.820** → fin **439.049** = **1.229** km carga

### Albarán 3 — RNM (internacional, Portugal→España)
- Cliente (cód): **661** — RNM TRANSPORTES QUIMICOS, LDA
- Origen → Destino (cód): **AVEIR** (Aveiro / carga Gafanha da Nazaré) → **NAVIA** (ENCE / Celulosas de Asturias)
- Carga: **SOSA** (sosa cáustica líq. 50%)
- Referencia: **0141169903**  *(RNM = guia de remessa, 10 díg. empieza en 0; NUNCA el pedido 4100100800)*
- Fecha salida (carga): **02/10/2026** · Fecha llegada (descarga): **05/10/2026**
- Línea porte: concepto **PI** (PORTES INTERNACIONALES), **U.M. = UN**, cantidad **1**, precio **900,00** (fijo, tarifario vigente Aveiro→Navia)
- Indexación: concepto **GPT** (INDEXACION GASOLEO PORTUGAL), cantidad = 900,00, factor **0,1450** (grupo "Otros") → **130,50**. IVA 0.
- IVA: **0%** (internacional, cliente portugués) → Base s/IVA **1.030,50** · Total **1.030,50**
- Peso (control): 23.120 kg · Km: inicio **439.341** → fin **439.949** = **608** km carga

> Km vacíos entre albaranes (reposicionamiento): alb1→alb2 437.690→437.820 = **130**; alb2→alb3 439.049→439.341 = **292**. (En Gesruta el form de Km es a nivel viaje; Km vacío y Nueva lectura los confirma Julio.)

---

## PASO FINAL POR ALBARÁN — capturar el número (siempre, sin que nadie lo pida)
Al grabar, Gesruta muestra el **Nº de viaje** (cabecera) y el **Nº de albarán** (línea).
Leerlos de la pantalla (nunca inventarlos ni pre-asignarlos), emparejar cada uno con su albarán
por origen→destino, y reportarlos al cerrar el viaje completo, indicando a qué albarán
corresponde cada uno. No escribir el repositorio: del registro se encarga Claude (nube).
