# Brief v3 - Oficina agentica Transliquidos Estevez

Objetivo: cerrar una version utilizable en la oficina real. Hoy el sistema procesa documentos sueltos; falta el circuito completo desde el escaner hasta la factura emitida y archivada.

---

## 0. Estado actual (construido y publicado)

| Pieza | ID | Estado |
|---|---|---|
| [ESTEVEZ] Ingesta Viaje | WD0q9Ic0oDvUoJwp | Activo. Archiva a SIN-CLASIFICAR, extrae con gpt-4o, mueve a cliente si es inequivoco (Fase 1b, SIN PROBAR) |
| [ACTIVO] Archivador Drive | 2bgdkH6nW4EtnEQw | Activo. Modos subir y mover. Raiz 1bT45GYDALNuVPXOB-POQyio4Di0S-eah |
| [ESTEVEZ] Auditar Factura | IlIod0DlephaLmAV | Activo. Validador v2, lee tarifas e indexacion en vivo |
| [ESTEVEZ] Export Viajes Excel | ObSZK7wHv4k9oFi6 | Activo. GET /webhook/export-viajes |
| tabla tarifas | Siwhv2AUWTSeFlrJ | 538 filas (FORESA 157, QUIMIDROGA 238, HELM 69, RNM 55, JARAMA 19) |
| tabla indexacion | or1otD9WsjJ3V8Cr | 70 tramos, 6 solapas oficiales |
| tabla viajes | lrBxWpTUxMtO8U48 | VACIA. detalle en JSON: hay que aplanar |
| tabla documentos | SmmE2PIufLwrfztM | VACIA |

---

## 1. Decisiones cerradas (no reabrir)

- **D-1** Entrada = carpeta de Drive vigilada. Se instala Drive para escritorio en el PC de oficina; el escaner escribe en carpeta local sincronizada. NO se usa mail desde escaner.
- **D-2** Un viaje sin documentacion escaneada asociada **BLOQUEA la facturacion** de ese viaje. No se factura con aviso: se factura o no se factura.
- **D-3** Datos de prueba descartados (5 viajes, 4 documentos borrados el 25/07/2026). El modelo de datos se rehace limpio.
- **D-4** Minimo facturable 23 t aplica a TODOS los clientes por tonelada, incluido metanol Foresa Villagarcia->Caldas.
- **D-5** Cliente sin regla explicita de indexacion -> solapa OTROS por defecto, con aviso.
- **D-6** Ruta sin tarifa cargada -> aviso, no bloquea la validacion.
- **D-7** Paralizacion: se determina comercialmente, no hay documento fuente ni formula. El sistema solo la lista, nunca la calcula.
- **D-8** Repartos: 90 EUR cuando un camion tiene dos destinos para una misma carga. Linea aparte, FUERA de la base de indexacion.
- **D-9** Indexacion: el porcentaje se resuelve por tramo de fechas segun la fecha del VIAJE. Los tramos no son quincenas fijas: dependen de cuantas veces se actualizo ese mes.

---

## 2. Alcance a especificar

### 2.1 Canal de entrada
Carpeta `_ENTRADA` bajo la raiz de Drive, vigilada por Google Drive Trigger con polling (el VPS es HTTP: no hay push notifications).

Idempotencia por construccion: procesado el archivo, el flujo lo SACA de `_ENTRADA`. Carpeta vacia = nada pendiente. Estado auto-evidente para la oficina sin abrir n8n.

Subcarpetas: `_ENTRADA` (bandeja), `_ERROR` (fallo de extraccion, revision humana).

El upload web actual (ingesta-viaje.html) queda como canal alternativo. El campo `canal` de documentos ya distingue web/drive/email.

### 2.2 Modelo de datos
Problema de fondo: hoy `viajes` guarda todo en un campo `detalle` JSON. No se puede agregar nada (ni km por matricula, ni dietas por chofer). Hay que aplanar.

- **hojas** (nueva): id, conductor, tractora, semi, fecha_recepcion, file_id, n_viajes, estado. Padre de los viajes de una ficha fisica.
- **viajes** (aplanar): hoja_id, fecha_carga, empresa, tractora, semi, conductor, cliente, origen, destino, material, referencia, tipo_doc, kg_documento, kg_hoja, fuente_peso, importe_documento, tarifa_tn_documento, km_inicio, km_final, km_cargados, km_vacios, estado, factura_id.
- **gastos** (nueva): hoja_id, conductor, fecha, tipo (dieta/gasoleo/peaje/lavado/otro), importe, forma (efectivo/credito). **La dieta por chofer sale de aca.**
- **documentos** (existe): poblar `viaje_id`, hoy siempre vacio.

Consultas que el modelo debe habilitar: km vacio y lleno por matricula; dietas por chofer; origen/destino por chofer y matricula; documentacion faltante por viaje.

### 2.3 Escaneo en serie de fichas
El prompt actual asume UNA hoja por PDF. El escaneo en serie mete N hojas en un archivo.

Propuesta: el extractor devuelve `hojas[]` con `pagina_inicio` por hoja, y se valida que los cambios de conductor/tractora coincidan con el conteo de hojas detectadas. Si detecta mas de una hoja, **exige confirmacion humana en la previsualizacion antes de grabar**. Riesgo real conocido: el modelo funde dos hojas en una.

### 2.4 Ciclo de vida del archivo (tres etapas)
Estructura real confirmada contra el ZIP de junio: `{anio}/FACTURACION {MES} {ANIO}/{CLIENTE}/FRA {NNN}/`. **Falta el cuarto nivel (FRA) y el renombrado.**

1. Ingesta -> `SIN-CLASIFICAR/`, nombre `{timestamp}-{original}` (cliente aun desconocido). YA IMPLEMENTADO.
2. Post-extraccion -> `{CLIENTE}/` si el cliente es inequivoco. YA IMPLEMENTADO (Fase 1b, sin probar).
3. Post-facturacion -> `{CLIENTE}/FRA {NNN}/` y **renombrado a `{referencia}.pdf`**. FALTA.

La etapa 3 es una accion explicita "cerrar factura": el operador elige cliente + periodo, el sistema muestra la previsualizacion, el operador confirma con el numero de factura, y recien ahi se mueve, renombra y marca `facturado`.

Requiere agregar accion `renombrar` al Archivador (Drive file:update).

### 2.5 Conciliacion y bloqueo (D-2)
Cruce ficha de chofer <-> documentacion de viaje por (matricula + fecha +/-1 dia), confirmado por origen/destino o material.

Lo valioso no es el match sino los NO-match, en las dos direcciones:
- Viaje sin CMR/albaran -> **no facturable, bloquea**.
- Documento sin viaje -> ficha de chofer no cargada o viaje no declarado.

La previsualizacion de factura muestra ambas listas antes de dejar facturar.

### 2.6 Excel de consulta en Drive
Google Sheet (no xlsx): vivo, accesible desde cualquier lado, filtrable, escrito por el nodo nativo de n8n. El webhook xlsx actual queda como snapshot descargable.

Solapas: VIAJES, DOCUMENTOS, GASTOS, y **PENDIENTES** (la conciliacion: viajes sin documento y documentos sin viaje). Refresco programado cada 15 min + al cerrar cada ingesta.

### 2.7 Router de entrada
Un unico punto de entrada que clasifica el PDF con gpt-4o-mini sobre la primera pagina y despacha:
- hoja manuscrita de chofer -> flujo fichas
- CMR / albaran / orden de carga -> flujo documentacion de viaje (correlacion)
- factura Gesruta -> validador

Hoy son webhooks separados; el trigger de Drive necesita decidir solo.

---

## 3. Riesgos tecnicos a resolver en la spec

1. **Archivo parcial por sincronizacion.** Drive para escritorio puede sincronizar un PDF incompleto y el trigger dispara sobre un archivo a medio subir. Mitigacion propuesta: esperar N segundos y verificar estabilidad de tamanio/modifiedTime, o validar que el PDF abra y tenga paginas antes de procesar.
2. **Polling, no push.** El VPS es HTTP: Google no puede notificar. Latencia esperada 1-2 min.
3. **Fusion de hojas** en escaneo en serie (ver 2.3).
4. **Renombrado en Drive** no esta implementado en el Archivador.
5. **Credencial del nodo Mover Archivo** del Archivador: asignada via MCP, PENDIENTE DE VERIFICACION VISUAL en la UI.

---

## 4. Preguntas abiertas (dominio, sin respuesta aun)

- Baltransa por tonelada: aplica el minimo 23 t?
- Clavo Food Factory: criterio 1,52 vs 1,31 EUR/km. Diferido hasta que toque un caso real.
- Tarifas faltantes: TRANSTAMBRE, TANK SOLUTIONS, TRANSPORTES SANTOS, FORESTAL DEL ATLANTICO, HISPALENSE, CB SYSTEM OIL, BALTRANSA.
- Datos sospechosos del Excel QUIMIDROGA a confirmar: Barcelona->LLEIDA 470,00 EUR/tn (posible typo de 47,00); vigencias 2026-12-15 y 2025-01-15 sueltas; rutas Italia con valores 1.500-3.500 en columna EUR/tn (parecen precio cerrado por viaje).

---

## 5. Fases sugeridas

- **F1** Modelo de datos: crear hojas y gastos, aplanar viajes, adaptar la ingesta a las columnas nuevas.
- **F2** Canal Drive: carpeta vigilada + router de clasificacion + manejo de archivo parcial.
- **F3** Correlacion documento <-> viaje y tablero PENDIENTES.
- **F4** Google Sheet de consulta.
- **F5** Cierre de factura: previsualizacion con bloqueo (D-2), mover a FRA {NNN}, renombrar por referencia.

F1 y F2 son prerequisito de todo lo demas. F5 es lo que cierra el circuito de oficina.
