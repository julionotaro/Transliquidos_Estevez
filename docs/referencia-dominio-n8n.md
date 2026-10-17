# Referencia de dominio heredada de la etapa n8n

> Mapa de lo que hay en las carpetas de la etapa anterior (n8n) y qué de eso **sirve hoy**.
> No es chatarra: es conocimiento ya trabajado. Cosechado parcialmente al catálogo activo
> (2026-10-17). Lo que NO se cosechó queda como consulta.

## Ya cosechado al catálogo activo
- **Flota** → `catalogo/flota.json` (31 tractoras: matrícula → remolque → chofer + tipo
  propio/autónomo). Fuente: `ficha/flota.js`. Úsalo para verificar la cabecera.
- **Autónomos** → Abal, Fraga, Alfonsín (match por **token**, no substring: ABAL ≠ ABALO/ABELO).
  Fuente: `ficha/conductores.js`. En el skill y en `flota.json`.
- **Servicios FORESA con indexación acumulada** → destino **OREMBER** (702 albaranes) y
  **Villagarcía→Caldas Metanol** (236). Fuente: `ficha/periodo-facturacion.js`. Confirma la regla
  `cargar:false`.
- **Rutas reales sin tarifa oficial** → `informes/rutas-sin-tarifa.md` (42 rutas). Volcado al
  backlog `docs/pendientes-gesruta.md`.

## Útil, aún SIN cosechar (consultar cuando haga falta)
- **`ficha/periodo-facturacion.js`** — grupo de indexación por cliente (FORESA/BRESFOR→FORESA-BRESFOR,
  QUIMIDROGA→QUIMIDROGA, HELM→HELM, resto→OTROS) + modalidad (línea vs acumulada) + período
  (FORESA mensual/quincenal; resto quincenal). Contrastado contra 2.975 líneas reales.
- **`ficha/tarifa-contractual.js`** — motor de tarifa contractual (tabla `Tarifas`) con 2 puentes
  (punto canónico, razón social). Lógica para resolver tarifa cuando no viene en el documento.
- **`catalogo/rutas-por-cliente.json`** — 58 clientes con sus rutas conocidas (de 7.578 portes
  reales). Conjunto cerrado por cliente → evita destinos imposibles (el error Aveiro→Teruel).
- **`ficha/indexacion.js` / `modalidad-indexacion.js`** — cálculo de la línea de indexación.
- **`ficha/odometro.js`** — validación de km/odómetro.
- **`ficha/clientes.js`** — token → razón social por cliente.
- **`ficha/rutas-conocidas.js`, `cruce.js`, `correlacionar.js`, `dedup.js`** — correlación ficha↔doc.
- **`docs/dominio-facturacion.md`** — dominio del negocio completo (base, muy denso).

## Plomería n8n muerta (candidata a archivar, sin valor de consulta)
- `ficha/nodo-*.generated.js` y `*.wrapper.js`, `ficha/build-nodo.js`, `ficha/ingesta-viaje.html`,
  `herramientas/` (build de nodos), `encargos/` (historial de encargos n8n), `prompts/`, `briefs/`,
  `pruebas/`. Git conserva el historial; se pueden mover a `archivo/` sin perder nada.

## Recomendación
Tratar `ficha/` + `informes/` + `catalogo/rutas-por-cliente.json` como **referencia viva** (no
archivar). Archivar solo la plomería n8n. Cosechar lo de "útil sin cosechar" cuando una tarea lo pida.
