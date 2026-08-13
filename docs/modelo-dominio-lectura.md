# Modelo de dominio — Lectura, correlación y facturación

> **Fuente de verdad del dominio de TLE.** Todo encargo que toque extracción, correlación, deduplicación, tarifa o indexación arranca citando este documento. Si el código contradice esto, es el código el que está mal (o este documento quedó desactualizado — en ese caso, actualizarlo es parte del encargo).
>
> Documento hermano: `modelo-estrategico.md` (el porqué; objetivos, fases, empresas).
> Última consolidación: agosto 2026, a partir de la operación real y del instructivo de documentación por cliente.

---

## 1. Dos clases de documento

Todo lo que entra al pipeline es una de dos cosas, con roles distintos:

**Ficha de chófer** (manuscrita, la lee el modelo de visión sobre imagen). Fuente de los datos **operativos**:
- Nombre del chófer
- Matrículas de tractora y remolque
- Fechas y lugares de carga/descarga
- Kilómetros (inicio/fin por viaje) — dato **exclusivo de la ficha**, no aparece en ningún documento de transporte
- Dietas

La ficha es la fuente **sospechosa**: manuscrita, sujeta a error de lectura. Cuando un dato de la ficha contradice un documento de transporte, **manda el documento** (ver §4).

**Documentación de transporte** (impresa, se lee mejor). Fuente de los datos **facturables**:
- Orden de Carga / Orden de Transporte (OC) — emitida por el cliente
- CMR / Carta de porte
- Albaranes
- Documentación adicional de calidad/análisis del material

Excepción importante: **FORESA y BRESFOR** no emiten OC en la mayoría de orígenes-destinos; solicitan el viaje con el **albarán**. Para ellos, el cliente se identifica por el albarán, no por una OC.

---

## 2. Los 6 datos críticos de facturación y su fuente

Estos seis determinan la factura. Cada uno tiene una fuente autoritativa:

| Dato | Fuente autoritativa | Nota |
|---|---|---|
| **Cliente** | Emisor de la OC (o del albarán en Foresa/Bresfor) | NUNCA el lugar de carga. Ver §3. |
| **Fecha de carga** | Ficha y/o CMR/albarán | |
| **Origen** | CMR/albarán | Lugar físico de carga |
| **Destino** | CMR/albarán | |
| **Tipo de carga (material)** | CMR/albarán/OC | Del documento, NO de la ficha (ver §4, caso RNM) |
| **Peso** | Documento de peso: báscula/albarán, **origen antes que destino** | NUNCA de la OC (ver §4, D-01) |

**Dos valores se derivan de estos seis:**
- **Tarifa** = f(cliente, origen, destino, tipo de carga, peso)
- **% Indexación** = f(cliente, fecha de carga)

**Consecuencia crítica:** el **cliente** entra en las dos derivaciones. Si el cliente está mal, la tarifa Y la indexación están mal las dos. El cliente es el dato que más envenena aguas abajo — por eso su resolución (§3) es la regla más importante del sistema.

---

## 3. Resolución del cliente (la regla de oro)

**El cliente facturable es quien contrata el transporte, identificado por el EMISOR de la orden de transporte — nunca por el lugar de carga ni por el destinatario.**

Tres roles que el sistema NO debe colapsar:
- **Cliente facturable** = emisor de la OC (membrete de quien manda la orden)
- **Lugar de carga** = origen físico (puede ser un tercero: Relisa, Diversey…)
- **Destinatario** = destino de la mercancía (puede ser un cuarto: Entrepinares, Cobadu…)

Ejemplos reales que motivaron la regla:
- OC **Baltransa** (emisor Baltransa) carga en **Diversey** (Valdemoro), entrega en **Entrepinares** → cliente = **Baltransa**, no Diversey.
- OC **Quimidroga** carga en **Relisa** (Barcelona) → cliente = **Quimidroga**, no Relisa.

**Precedencia de resolución del cliente:**
1. Emisor de la OC / albarán (Foresa/Bresfor) → cliente.
2. Respaldo: `cliente_probable` que infiere el modelo, si el emisor no resolvió.
3. Si no hay emisor reconocido en el catálogo de clientes → `cliente_no_reconocido` + REVISAR, mostrando el emisor leído (ej. "emisor BALTRANSA no resuelto a cliente conocido"). **NUNCA usar el lugar de carga como fallback de cliente.**

Distinción de estados (no confundir — son ejes distintos con acciones distintas para el operador):
- **Sin documento de transporte** → `PENDIENTE_DOCUMENTACION` ("falta el papel, subilo").
- **Con documento, emisor fuera de catálogo** → `cliente_no_reconocido` / REVISAR ("el papel dice X, agregá X al catálogo o revisá").

**El cliente viene del documento, NUNCA de la ficha** — ni siquiera para clientes conocidos. La ficha dice el lugar de carga, que solo coincide con el cliente por casualidad geográfica (Foresa carga en Foresa) y falla justo donde carga ≠ cliente (Quimidroga, Baltransa).

---

## 4. El documento manda sobre la ficha (asimetría de confianza)

La ficha manuscrita es sospechosa; el documento impreso es confiable. Reglas concretas:

**D-01 — Peso.** El peso facturable sale SIEMPRE del documento de peso (báscula/albarán), **nunca de la OC** (la OC lleva el peso *planificado*, no el real). Refinamiento confirmado: cuando hay peso de carga (origen) y de descarga (destino) y difieren, **manda el de origen (CMR/albarán de carga)**. Orden de precedencia del peso: **CMR/albarán de origen > documento de descarga > (nunca) OC**. Si el único peso disponible es el de la OC → REVISAR "falta documento de peso", no facturar el peso de la OC.
- Ejemplo real: OC Quimidroga dice 25.000/24.000 (planificado); albarán Relisa (origen) 24.420; recepción Obadu (destino) 24.460 → factura **24.420** (origen).

**Material.** Sale del documento (CMR/albarán/OC), no de la ficha.
- Ejemplo real RNM: ficha dice "Sosa 50%", CMR dice "Sosa Cáustica 25%" → vale **25%** (documento).

**Matrícula.** Ver §6 (reconciliación tolerante): cuando los documentos convergen en una matrícula y la ficha difiere por poco, se corrige la ficha contra el documento.

Principio general: si un dato de la ficha contradice un documento de transporte, **gana el documento**, y el viaje se marca REVISAR informando la corrección para que el humano la vea.

---

## 5. Identidad de un viaje (llaves) — y por qué son DOS

Un error acá borra viajes reales creyéndolos duplicados, o factura dos veces el mismo. Hay **dos problemas distintos que requieren dos llaves distintas**:

### 5.1 Deduplicar viajes de la ficha entre sí → `matrícula tractora + km_inicio`

`cliente + fecha + origen + destino + material` **NO es único**: hay días con 3, 4 o más viajes del mismo cliente, misma ruta corta, mismo material (caso confirmado: 4 viajes Foresa Villagarcia→Caldas metanol el mismo día).

El discriminador que SIEMPRE existe y es intrínsecamente único: el **kilometraje de inicio**. El odómetro es estrictamente creciente; dos viajes distintos del mismo camión no pueden tener el mismo km_inicio (uno empieza donde el otro terminó). Confirmado con dato real: los km encadenan viaje a viaje (fin del viaje N ≈ inicio del viaje N+1).

- Llave de dedup: **`matrícula_tractora + km_inicio`**.
- Desempate ante colisión (posible error de lectura de km): **`cantidad`** (casi siempre difiere entre viajes reales).
- Salvaguarda (simétrica a la de matrícula, §6): si matrícula+fecha+cliente+ruta+material coinciden y el km_inicio difiere **por poco**, sospechar mismo viaje con km mal leído → REVISAR, no asumir automáticamente que son distintos.

**El km NO sirve para emparejar documento↔viaje** — no aparece en ningún documento de transporte, es exclusivo de la ficha.

### 5.2 Emparejar un documento con su viaje → referencia, o ruta+material+peso+fecha

- **Nivel 1:** `referencia` del documento (número de OC/guía/albarán), si existe — es la más fuerte, la emite el cliente.
- **Nivel 2** (no hay referencia, o para desambiguar días multi-pata): **origen + destino + material + fecha + peso**. Son datos que el documento SÍ trae. Este es el mecanismo para el caso Baltransa (fecha de la OC = fecha de emisión, distinta de la del viaje; se desambigua por ruta+material).
- La referencia no siempre está (Foresa/Bresfor a veces, o el documento no llegó) → por eso Nivel 2 es necesario como respaldo.

---

## 6. Reconciliación de matrícula (documento vs ficha mal leída)

Cuando la matrícula de la ficha no matchea ningún documento, pero los documentos convergen:

- **Match exacto primero.** El fallback solo actúa si el match exacto falla.
- **Fallback tolerante, SOLO si:** (a) los documentos del envío **convergen** en una sola matrícula (unanimidad de documentos legibles); (b) esa matrícula está a distancia ≤1 de **exactamente una** ficha; (c) distancia de edición real ≤1. Entonces: tomar la matrícula del **documento** como la del viaje, guardar la lectura original para auditoría, marcar REVISAR ("matrícula ficha 0337LPL corregida a 0332LPL según N documentos coincidentes — verificar que sea el mismo camión").
- **Salvaguardas (NO adivinar):** documentos que no convergen (0332 vs 0337) → posible envío de dos camiones → REVISAR sin corregir. Candidato no único → REVISAR. Distancia >1 → REVISAR.
- **Por qué convergencia y no cercanía:** camiones comprados en lote tienen matrículas casi consecutivas; dos camiones reales a distancia 1 en el mismo envío son posibles. La convergencia de los documentos (no la cercanía de la matrícula) es lo que hace seguro el fallback.
- Parámetro `MATRICULA_DIST_MAX` (default 1) y definición de convergencia (default: unanimidad) configurables. Aflojar unanimidad→mayoría solo si con dato real un solo documento con OCR sucio da falsos negativos seguido.

---

## 7. Cardinalidad documento ↔ viaje (NO siempre 1:1)

**FORESA metanol (Villagarcia→Caldas):** la ficha cuenta el viaje en **rotaciones** ("6 VIAJES", "3 VIAJES" en el campo cantidad — no kg). **Cada rotación es un albarán/viaje facturable independiente.** Por eso hay más albaranes que líneas de ficha. El modelo NO debe asumir un albarán por línea de ficha.

Regla general: la cardinalidad documento↔viaje puede ser N:1. Al correlacionar, no descartar documentos "sobrantes" — pueden ser rotaciones legítimas del mismo cliente/ruta.

---

## 8. Reglas por cliente (del instructivo)

Confirmadas contra documentos reales. Las pendientes están marcadas.

**FORESA** — cliente por albarán (no OC). Referencia = número que empieza por `20` arriba-derecha del CMR/albarán (ej. 2016126, 2009926), NUNCA el que empieza por 5030 (ese es el nº interno del albarán). Rutas: Caldas-Orember, Caldas-Otros, Retornos a Caldas, Villagarcia-Caldas (metanol, cuenta rotaciones §7). Pendiente: Villagarcia-Otros (metanol).

**BRESFOR** — cliente por albarán. Aveiro es **ORIGEN** (puerto de carga), no destino. Ruta Aveiro-Otros.

**QUIMIDROGA** — OC con "Referencia en factura". Lugar de carga puede ser un tercero (Relisa, TEPSA planta cargadora). Variante **QUIMIDROGA PORTUGAL** → país de facturación PT (afecta IVA).

**RNM GROUP** — OC/hoja de carga **puede traer o no el precio** total del viaje (ambos válidos, la ausencia NO es error). Referencia = Número de Guía. Empresa portuguesa → país PT. Material del documento (ojo ficha mal leída, ver §4).

**BALTRANSA** — OC ("Orden de Transporte") con **precio final del viaje** (salvo excepciones donde no lo pone). Referencia = número de Orden de Carga. **La línea de indexación debe figurar en factura al 0%** (regla dura). Cliente español → IVA 21%. Fecha de OC = fecha de emisión, suele diferir de la del viaje (desambiguar por §5.2). Pendiente: ficha Baltransa.

**Pendientes de mapear:** HELM Ibérica, Transportes Santos, Comatra, Baltransa ficha, Villagarcia-Otros.

---

## 9. Principios permanentes

- Fallar ruidoso antes que en silencio. Null antes que invención plausible. Revisión humana antes que corrección automática de dato incierto.
- El documento impreso manda sobre la ficha manuscrita.
- "Se ve bien" no cuenta hasta un readback con dato real de las tablas.
- Evidencia compatible ≠ documento válido.
- El cruce contra las bases (clientes, puntos, flota, choferes, productos, tarifas) no es solo validación: prepara el matcheo para la carga automatizada en el sistema de escritorio (Gesruta). Un dato que coincide con la base es cargable; uno que no, va a revisión.

---

## 10. Pendientes de dominio (abiertos)

- Mapear clientes pendientes (§8).
- Bases a incorporar al cruce: tablas de clientes, puntos geográficos, chóferes, tractoras/remolques, productos, tarifas, indexación, e histórico de viajes de los últimos 2 años clasificados por cliente/origen/destino frecuente.
- Segunda empresa (Hnos. Estévez Casal) — su ficha usa el mismo formato; validar que las reglas aplican igual.
