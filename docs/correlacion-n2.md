# Correlación N2 — documento ↔ viaje por ruta/material/peso (§5.2)

> Cuando un documento no trae `referencia` (o la trae con fecha de emisión distinta
> de la del viaje, caso Baltransa), se lo empareja con su viaje por
> **origen + destino + material + fecha + peso**. Módulo puro
> `correlacion/correlacionar-n2.js`. 10 tests.

## Cascada

1. **Nivel 1 — `referencia`.** Match exacto de referencia doc↔viaje. Confianza alta.
   Corta antes de N2.
2. **Nivel 2 — ruta + material + peso + fecha.** Requisitos **duros** (si falla uno,
   el candidato se descarta): `origen_canonico` igual, `destino_canonico` igual
   (vía `resolver-punto.js`, Encargo 2), material compatible. Después desempatan:
   - **ventana temporal** (asimétrica según tipo de documento, ver abajo)
   - **peso ±2%**

Resolución: 1 candidato → `correlacion='N2'`; >1 sin poder desempatar → REVISAR
listando los candidatos; 0 → `sin_correlacion` (REVISAR/PENDIENTE según §3).

## Clasificador binario de documento (CAMBIO 1)

`clasificarDocumento` decide **orden** vs **documento de transporte** — de eso
depende la ventana. Por `tipo_doc`, con marcadores de encabezado como respaldo
(`ORDEN DE TRANSPORTE`/`ORDEN DE CARGA` → orden; `CMR`/`ALBARAN`/`CARTA DE PORTE`/
`TICKET DE BASCULA` → transporte). Sin señal → `desconocido` (ventana ancha, seguro).

## Ventana temporal (asimétrica)

| Clase | Ventana (días respecto a `fecha_doc`) | Por qué |
|---|---|---|
| **orden** | `[fecha_doc, fecha_doc + 2]` — **solo hacia adelante** | la OC se emite ANTES del viaje. `VENTANA_OC_DIAS=2` (Julio) |
| **CMR/albarán/báscula** | `±1 día` | contemporáneo al viaje |
| **desconocido** | `[fecha_doc − 1, fecha_doc + 2]` | ancha, comportamiento seguro |

## Reglas duras

- **El km NO correlaciona** (no existe en ningún documento de transporte, §5).
- Nunca por fecha sola, ni cliente solo, ni ruta sola: **sin origen+destino+material
  no hay N2**.
- **§7 (N:1) intacto**: la cardinalidad doc↔viaje puede ser N:1. Las rotaciones
  Foresa metanol (misma ruta/día) se distinguen por peso; no se colapsan a un viaje.
  Reusa `RUTAS_MULTIVIAJE`/`esRutaMultiviaje` de `cruce.js` (no duplica).

## Cableado en `correlacionar.js` — DIFF listo, deploy EN ESPERA de revisión

El fallback N2 ya está integrado en `ficha/correlacionar.js` (rama
`claude/correlacion-n2-integracion`), pero **NO se pegó en el nodo**: es nodo crítico
y Julio revisa el diff antes de aplicarlo. El diseño es **ADITIVO y GATED**:

- `correlacionar(rA, rB, opts)` acepta dos entradas nuevas en `opts`:
  `viajesExistentes` (pool de viajes ya cargados en Gesruta) y `catalogoPuntos`
  (los 324 puntos canónicos, tabla `puntos`).
- **Sin cablear** esas dos entradas el nodo se comporta **exactamente** como v3.2:
  los documentos sin ficha en el envío quedan huérfanos igual que hoy. La regresión
  (226 tests) pasa **byte-idéntica**; el informe y `datos_json` no cambian.
- **Con** el pool + catálogo cableados, un documento cuya matrícula no ata a ninguna
  ficha del envío se intenta correlacionar contra el pool: `referencia` (N1) o
  `ruta+material+peso+fecha` (N2). El resultado sale en `correlaciones_externas`
  (y en una sección nueva del informe, solo si la hubo).

Punto de integración: la rama de huérfano del match documento→viaje (helper
`intentarN2`). El documento aporta el **punto canónico** (coincide 100% con Gesruta);
N2 nunca usa la matrícula ni la ficha manuscrita.

### Lo que Julio decide/aplica (no se toca por MCP)

1. **Grafo del workflow `[ESTEVEZ] Ingesta Viaje` (WD0q9Ic0oDvUoJwp):** agregar dos
   lecturas de data table que alimenten el nodo *Formatear Linea Gesruta*:
   - **Leer Viajes Existentes** (tabla `viajes`, filtrable por fecha reciente —
     p. ej. últimos 45 días — para no cargar todo el histórico), y
   - **Cargar Catálogo Puntos** (tabla `puntos`, `YjxcHHb5B4hT0RFU`, ya cargada: 324).
   El wrapper `nodo-formatear.wrapper.js` debe pasar `opts.viajesExistentes` y
   `opts.catalogoPuntos` a `procesar()`/`correlacionar()`. **Este cambio de wrapper +
   grafo queda para la sesión de revisión** (hoy el wrapper NO los pasa → inerte).
2. **Pegar `nodo-formatear.generated.js`** en el nodo Code, manual, junto con Publish
   (regla del repo: código de nodo no se toca por MCP).

### Trazabilidad — columna `correlacion`

El campo `correlacion` (`N1`/`N2`/`manual`/`sin_correlacion`) debe persistirse por
viaje para **medir si N2 acierta** (sin medición no sabemos si la ventana de 2 días
es la correcta). Con el cableado de arriba, la escritura toma el valor de
`correlaciones_externas`. Falta (cuando Julio apruebe): agregar la columna a `viajes`
(MCP) + emitirla en Preparar Filas Viajes + mostrarla en `pendientes.js`.

## Re-correr tests

```
node --test correlacion/correlacionar-n2.test.js          # módulo puro (10)
node --test ficha/tests/correlacionar-n2-fallback.test.js # gate on/off cableado (4)
node --test ficha/tests/*.test.js                         # regresión completa (230)
node ficha/build-nodo.js --check                          # generated en sync
```
