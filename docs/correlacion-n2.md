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

## Tolerancia de 1 letra en matrícula (mismo envío) — "por bueno"

Encargo Julio (rama `claude/matricula-tolerancia-envio`, apila sobre N2). Cuando la
matrícula de un documento no coincide exacta con la de una ficha del envío pero está
a **distancia de edición 1** de **una sola** matrícula candidata (documentos
convergentes), el emparejamiento se da **por bueno**: se corrige la ficha (el
documento impreso manda sobre la manuscrita), se registra como **corrección
automática reversible** en `viaje.correccion_matricula` (`{de, a, distancia, metodo}`)
+ un **aviso no bloqueante**, y **ya NO marca REVISAR** (antes sí — patrón alias de
puntos: se aprende y se registra, no se frena). Se conserva `tractora_original`.

Sigue marcando **REVISAR** (no adivina) cuando: hay **más de una** ficha candidata a
distancia 1 (ambiguo), los documentos **no convergen** (posible envío de dos
camiones, matrículas de lote), o la distancia es **> 1**. Implementado en
`reconciliarMatriculaFicha` (`ficha/correlacionar.js`). Regresión byte-idéntica
(los fixtures v3.1 no tocaban ese camino); 2 tests de reconciliación actualizados al
nuevo contrato + aserción `estado_lectura==='OK'` para el caso único.

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

### Estado del cableado (preparado, SIN publicar)

El wrapper `nodo-formatear.wrapper.js` **ya pasa** `opts.viajesExistentes` y
`opts.catalogoPuntos` a `procesar()`, leyéndolos de dos nodos upstream de forma
defensiva (try/catch → inerte si no existen). Y esos dos nodos **ya están agregados
como borrador** al workflow `[ESTEVEZ] Ingesta Viaje` (WD0q9Ic0oDvUoJwp), colgados
de `Hook Viaje` (sin publicar → no afecta la versión activa):

| Nodo (borrador) | Tabla | Filtro |
|---|---|---|
| **Cargar Catalogo Puntos** | `puntos` (`YjxcHHb5B4hT0RFU`, 324) | ninguno (returnAll) |
| **Leer Viajes N2** | `viajes` (`lrBxWpTUxMtO8U48`) | `fecha >= hoy-45d` |

⚠️ **Nombres dedicados a propósito.** Ya existe un nodo `Leer Viajes Existentes` en
el workflow, pero corre **DESPUÉS** de Formatear (`Guardar Hoja → Leer Viajes
Existentes → Preparar Filas Viajes`, alimenta el dedup §5.1). N2 necesita el pool
**ANTES** de Formatear, por eso el reader dedicado `Leer Viajes N2` cuelga de
`Hook Viaje` (corre apenas dispara el trigger, mucho antes de que la cadena
Rasterizar→GPT→Formatear llegue a Formatear).

### Lo que Julio decide/aplica (no se toca por MCP)

1. **Pegar `nodo-formatear.generated.js`** en el nodo Code *Formatear Linea Gesruta*,
   manual, y **Publish** (regla del repo: código de nodo no se toca por MCP). Al
   publicar se activan juntos el wrapper + los dos readers borrador.
2. **Verificar el orden de ejecución en una corrida de prueba** ANTES de confiar en
   N2: que `$('Leer Viajes N2')` y `$('Cargar Catalogo Puntos')` tengan datos cuando
   corre Formatear (deben haber ejecutado antes). Si por el motor quedaran vacíos, N2
   simplemente no dispara (gated) — no rompe nada, pero no correlaciona.
3. **Decisión de diseño abierta:** ¿el pool de N2 debe filtrar por fecha (45 d, como
   quedó) o por otra ventana? Ajustable en el nodo `Leer Viajes N2`.

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
