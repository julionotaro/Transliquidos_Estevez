# Plan de reordenamiento y estabilización — antes de la 2ª etapa

> Evaluación del estado actual del trabajo TLE-carga y plan profesional para dejarlo
> firme antes de escalar (objetivo: 20 viajes/día). Sesión 2026-10-16.

## 0. Resumen ejecutivo (recomendaciones)

1. **Separar en dos pistas** el trabajo: **Operación** (procesar juego → `orden.json`,
   tarea repetitiva) y **Desarrollo** (evolución de reglas, flujos y formato). Hoy conviven
   en un mismo chat gigante, lo que encarece y mezcla contextos.
2. **Encapsular la Operación en un *skill* reproducible** (`procesar-juego`) y correrla en
   **chats cortos y nuevos, uno por juego**, dentro de **un Proyecto** que tenga el repo
   adjunto. El Desarrollo sigue en una pista aparte (chat largo como este).
3. **Abrir un backlog de actualización en Gesruta**: dar de alta los puntos faltantes y
   cargar las tarifas confirmadas (muchas llegaron por Excel y no están en Gesruta). Cuanto
   más correcto esté Gesruta, menos tiene que “pisar” el bot → menos errores.
4. **Agregar un validador automático** que corra antes de cada commit (esquema de
   `orden.json`, integridad del registro, JSON de catálogo). Mata de raíz el bug recurrente
   del `;` en observaciones y los desalineados.
5. **Limpieza controlada** del repo (huérfanos y formato viejo) y aclarar el alcance (conviven
   restos de la etapa n8n anterior).

> Dato clave: **ningún viaje se cargó aún en Gesruta** (0 con Nº de viaje). Estamos en
> pre-producción: el momento ideal para estabilizar antes de escalar.

## 1. Dónde estamos (números reales)

- **Pipeline etapa 1 (extracción):** sólido. 8 juegos leídos, 27 albaranes en el libro
  maestro, 5 órdenes generadas + 3 fichas de lote inicial.
- **Etapa 2 (carga):** el bot local está en construcción; **0 viajes cargados** todavía.
- **Estados del registro:** 22 PENDIENTE_CARGA, 3 TARIFA_PENDIENTE, 2 CARGADO_PRUEBA.
- **Clientes activos:** FORESA (12), RNM (7), QUIMIDROGA (5), + HELM, FORESTAL, BRESFOR.
- **Fuentes de verdad ya ordenadas:** `catalogo/correcciones-julio.json` (reglas),
  `datos/gesruta/tarifarios/` (tarifas cliente), `catalogo/tarifa-por-analogia.json`
  (cascadas), `catalogo/alias-empresa-punto.json` (identidad de puntos),
  `datos/registro-procesamiento.csv` (libro maestro), `ordenes-carga/` (órdenes + fichas).

## 2. Diagnóstico — qué conviene acomodar

| Tema | Situación | Riesgo |
|---|---|---|
| Chat único gigante | Procesamiento + desarrollo mezclados | Costo, contexto perdido, lentitud |
| Gesruta desalineado | 3 puntos faltan; 13 tarifas confirmadas viven solo en Excel/analogía | El bot debe teclear/pisar → más errores al escalar |
| Validación manual | El `;` en observaciones rompió el registro varias veces | Facturas con datos corridos |
| Huérfanos | 5 PDF sueltos en `procesados/`, `orden-actual.md` viejo, 3 docs sin indexar | Ruido, confusión de fuentes |
| Alcance mezclado | Conviven restos de la etapa n8n (`validador/`, `herramientas/`, `ficha/`…) | Difícil saber qué está vivo |
| Loop sin cerrar | Falta el paso que escribe el Nº de viaje/albarán de Gesruta al registro | Seguimiento incompleto post-carga |

## 3. Arquitectura — separación de responsabilidades

**Sí, conviene separar** (responde tu pregunta). Propuesta:

- **Pista OPERACIÓN** — “procesar un juego”. Entrada: PDFs en `entrada/`. Salida: `orden.json`
  + fila(s) de registro + archivo en `procesados/`. Es repetitiva y bien definida →
  se encapsula en un **skill `procesar-juego`** (procedimiento + punteros a las reglas) y se
  corre en **un chat NUEVO y corto por juego**. Así no arrastra la historia enorme.
- **Pista DESARROLLO** — evolución de reglas, flujos (THEC/PROVE, metanol, frigos), formato,
  refactors. Chat largo (como este) o su propio espacio.

**Proyecto vs agente:** recomendado **un solo Proyecto de Claude** con el repo adjunto (así
cada chat ya tiene el contexto), y dentro dos “carriles” de chat (operación efímera /
desarrollo). No hace falta un repo nuevo: el repo es uno; lo que separamos son los chats y
el skill. Un editor por cosa: vos editás skills/decisiones; Claude edita git.

## 4. Gobernanza de datos y sincronización con Gesruta

**4.1 Una sola casa por tipo de dato** (ya casi logrado): tarifas cliente → `tarifarios/`;
cascadas/analogías → `tarifa-por-analogia.json`; identidad de punto → `alias-empresa-punto.json`;
reglas/decisiones → `correcciones-julio.json`; financiero por albarán → registro; órdenes+fichas
→ `ordenes-carga/ordenes/`. **El general de Gesruta está desactualizado**: mandan los archivos
de cliente.

**4.2 Backlog “actualizar en Gesruta”** (nuevo doc `docs/pendientes-gesruta.md`): lista viva de
lo que hay que cargar/dar de alta EN Gesruta para que autocomplete y el bot no tenga que pisar:
- **Puntos a dar de alta:** NOGALES (Badajoz), MONTEHERMOSO (Cáceres); resolver TEPSA por ciudad.
- **Tarifas a cargar/actualizar:** las 13 analogías confirmadas (ej. Barcelona→Begonte 74,73),
  RNM en €/TN (hoy el general tiene flat viejo), FORESA Caldas→Teruel 56 bajo TE, etc.
- Prioridad: las de clientes/rutas más frecuentes primero.

**4.3 Depuración del catálogo:** marcar en el general las rutas desactualizadas, y dejar el
archivo de cliente como fuente. No duplicar importes en `correcciones` (ya se limpió).

## 5. Calidad (QA) y estabilización

- **Validador automático** (`herramientas/validar.py`, correr antes de cada commit):
  (1) cada `orden.json` cumple el esquema del CONTRATO; (2) registro: 28 columnas, sin `;`
  en observaciones, `pdf_doc` existe, `total ≈ base·(1+iva)`, idx coherente; (3) JSON de
  catálogo válidos; (4) toda ficha de `ordenes/` existe. Falla ruidoso.
- **Cerrar el loop:** definir el paso en que, tras cargar en Gesruta, se capturan Nº de viaje
  y Nº de albarán y se escriben en el registro (hoy 0 cargados; columnas ya existen).
- **Control de totales de facturación:** el registro ya guarda idx aun cuando no se carga por
  albarán (`IDX ACUMULADA`); usarlo para cuadrar el acumulado mensual.

## 6. Limpieza del repo (controlada, con tu OK)

- Mover los 5 PDF sueltos de `procesados/` (clasificar o descartar).
- Retirar `ordenes-carga/orden-actual.md` (formato viejo del Claude de escritorio, superado).
- Indexar en `docs/INDICE.md` los 3 docs sueltos (`grafo-ingesta-tarifa`, `dominio-facturacion`,
  `entornos`).
- **Aclarar alcance:** `validador/`, `herramientas/`, `encargos/`, `informes/`, `ficha/` (67
  archivos), `prompts/`, `briefs/`, `pruebas/` son de la etapa anterior (n8n). Decidir si este
  repo es SOLO el pipeline TLE-carga (y mover lo demás a `archivo/` o a otro repo) o sigue siendo
  el repo global. No borrar nada sin confirmar.
- **MINAR ANTES DE ARCHIVAR (revisado 2026-10-16).** Esas carpetas NO son chatarra: tienen
  conocimiento que hoy NO usamos y nos sirve. Confirmado al inspeccionarlas:
  `ficha/conductores.js` (autónomos Abal/Fraga/Alfonsín + regla token, no substring),
  `informes/rutas-sin-tarifa.md` (42 rutas reales sin tarifa → backlog),
  `ficha/flota.js` (padrón tractora/remolque/chofer), `catalogo/rutas-por-cliente.json`
  (rutas conocidas por cliente, evita destinos imposibles), `ficha/indexacion.js` /
  `periodo-facturacion.js` / `odometro.js` / `tarifa-contractual.js` (lógica de dominio).
  Plan: tratar `ficha/` como **`referencia/`** (no archivar), cosechar lo vigente al catálogo
  activo, y archivar solo la plomería n8n muerta (`nodo-*.generated.js`, wrappers, `build-nodo.js`).

## 7. Plan por fases

- **Fase 0 — Estabilizar (ya):** validador + limpieza de huérfanos + indexar docs + abrir
  `pendientes-gesruta.md`. (1 iteración)
- **Fase 1 — Separar pistas:** skill `procesar-juego`; mover el repo a un Proyecto; convención
  de chat corto por juego. (1 iteración)
- **Fase 2 — Sync Gesruta:** vos cargás/das de alta puntos y tarifas del backlog; yo verifico
  que el bot autocompleta y dejo de pisar.
- **Fase 3 — Ampliar flujos:** THEC/PROVE (convencional) → metanol → frigos, y cerrar el loop
  del Nº de viaje. (según `docs/flujos-carga.md`)

## 8. Buenas prácticas / convenciones (vigentes)

- **Git = única fuente de verdad.** No duplicar planillas/tablas.
- **Un editor por cosa.** Vos: skills y decisiones. Claude: git.
- **Fallar ruidoso**, null antes que inventar, revisión humana antes de corregir un dato incierto.
- **Nombrar y archivar** cada orden (mes/chofer/fecha); ficha en un solo lugar.
- **Nada de `;` en observaciones** del registro (lo fuerza el validador).
- **Reglas nuevas → a `correcciones-julio.json` e índice**, nunca solo en el chat.
