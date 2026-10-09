# ORDEN DE CARGA ACTUAL — Gesruta

> Archivo fijo: siempre contiene el juego pendiente de cargar. Claude (nube) lo actualiza por juego.
> Procedimiento de pantalla: skill `cargar-viajes-gesruta`. Facturación real: **no inventar, fallar ruidoso**.

## Juego: ficha Asensi (20261007140856.pdf) — **EMPRESA: TLE**

**EMPRESA = TLE** (Trans. Líquidos Estévez, S.L.). En Gesruta → "Selección de Empresas" →
**0006 TRANS. LIQUIDOS ESTÉVEZ S.L.** (si fuese **THEC** / Transportes Hermanos Estévez Casal,
se selecciona la otra empresa y cambia la parte del sistema — confirmar su código).

**1 viaje, 2 albaranes.** Cabeza (tractora) = **2498** (2498KZL → trae solos remolque R1007BCV y chofer FRANCISCO ASENSI).

### Albarán 1 — FORESTAL
- Cliente (cód): **321** — FORESTAL DEL ATLANTICO, S.A.
- Origen → Destino (cód): **MUGAR** (Mugardos) → **CASTE** (Castellón)
- Carga (cód): **1** — COLA
- Referencia (Nº pedido): **26P1213**
- Fecha salida (carga): **29/09/2026** · Fecha llegada (descarga): **30/09/2026**
- Línea porte: concepto **P** (PORTES NACIONALES), **U.M. = UN**, cantidad **1**, precio **2.025,00** (precio fijo; kg NO se cargan)
- Indexación: **NINGUNA** (incluida en el precio → NO agregar línea G)
- IVA: 21% (entra solo)
- Km: odómetro inicio **873.922** → fin **874.976** = **1.054** km carga

### Albarán 2 — QUIMIDROGA
- Cliente (cód): **403** — QUIMIDROGA, S.A.
- Origen → Destino (cód): **B** (Barcelona, carga en TEPSA) → **AVEIR** (Aveiro / Heliflex, PT)
- Carga: **VINKA-PLAST** (si no toma código, doble clic y buscar por nombre)
- Referencia: **710515**
- Fecha salida (carga): **30/09/2026** · Fecha llegada (descarga): **02/10/2026**
- Línea porte: concepto **P**, **U.M. = TN**, cantidad **24,040**, precio **84,68** €/TN (porte 2.035,71)
- Indexación: 2ª línea, concepto **G**, cantidad = importe del porte (2.035,71), precio (factor) **0,1370** → 278,89. **NO** aplicar descuento DUO.
- IVA: 21%
- Km: odómetro inicio **875.255** → fin **876.375** = **1.120** km carga
- (Km vacío entre albarán 1 y 2: 874.976 → 875.255 = **279** km — reposicionamiento; lo confirma Julio en el form de Km del viaje)

## PASO FINAL POR ALBARÁN — capturar el número (siempre, sin que nadie lo pida)
Al grabar, Gesruta muestra el **Nº de viaje** (cabecera) y el **Nº de albarán** (línea).
Leerlos de la pantalla (nunca inventarlos ni pre-asignarlos) y reportarlos al cerrar,
indicando a qué albarán corresponde cada uno, para que queden en el libro mayor
(`datos/registro-procesamiento.csv`). Si la conversación tiene conector de GitHub, escribirlos ahí directo.
