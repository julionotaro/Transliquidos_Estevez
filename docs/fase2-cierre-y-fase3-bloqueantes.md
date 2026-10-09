# Fase 2 — cierre, decisiones y bloqueantes de Fase 3

> Estado al 2026-08-02. Fase 2 (cruce ficha↔documento, modelo albarán=unidad)
> desplegada en producción (`WD0q9Ic0oDvUoJwp`, activeVersion `48991d63`).
> Rama: `claude/cruce-ficha-documento`.

## Lo que Fase 2 dejó en producción

- **Modelo albarán=unidad**: un bloque de ficha puede ser N viajes; el campo
  `cantidad` se discrimina entre kg y nº de viajes de forma determinista
  (`ficha/cruce.js`, `RUTAS_MULTIVIAJE`), con red de seguridad `<100` →
  `posible_multiviaje_ruta_no_registrada`.
- **Precedencia D-01**: kg del documento de origen. **km de la ficha**, repartido
  y marcado `origen_km='derivado_de_bloque'` en el caso multi-viaje.
- **Estado único** `PENDIENTE_DOCUMENTACION` con `pendiente_falta` +
  `pendiente_reclamar_a`. Antigüedad = `createdAt` de la fila.
- **`regimen_indexacion`** marcado por ruta (D-03/D-06); NO se calcula la
  indexación acá (se cierra en facturación).
- **Audit trail** `origen_campos` (JSON por campo).
- 7 columnas nuevas creadas y mapeadas (Viajes: 5; documentos: 2 creadas, **sin
  mapear todavía** — ver bloqueante abajo).

## Decisión — vocabulario de `estado`

El estado pasó de `pendiente`/`sin_documentacion` a
`con_documentacion`/`PENDIENTE_DOCUMENTACION`. **Los vocabularios conviven**: no
se migran las filas viejas. Único lector de la tabla `viajes` hoy: el workflow
`[ESTEVEZ] Export Viajes Excel`, que vuelca `estado` como passthrough (no filtra
por valor). No hay pantalla Control para Estevez (el tablero es Fase 4). Cuando
se construya el tablero (Fase 4), tiene que entender ambos vocabularios o migrar
las filas viejas en ese momento.

## ✅ Multi-viaje: modelo confirmado contra exportación real (2026-08-03)

Actualización del encargo v1.1 §0.3: Julio aportó una exportación real del
sistema de escritorio (HNOS. ESTEVEZ CASAL). Contiene el caso multi-viaje FORESA
que hasta ahora solo tenía cobertura unitaria: expediente `00050461`, ruta
CALDAS DE REIS→OREMBER, **tres viajes Nº 01/02/03** con referencias distintas
(2002854, 2002844, 2002866) e importes distintos, mismo cabeza/remolque.

**Esto confirma la estructura del modelo de Fase 2 contra dato real**: bloque de
ficha = N viajes, cada uno con su propio albarán/referencia/importe. El multi-viaje
deja de estar "no verificado" a nivel de modelo de dominio.

Lo que **sigue sin probar** es la LECTURA: no hay todavía una ficha manuscrita real
de ese expediente para confirmar que gpt-4o lee bien `cantidad=3` en el campo de
la ficha (el riesgo de OCR de un bloque multi-viaje, distinto del riesgo de
estructura de datos que ya se cerró). Cuando aparezca esa ficha escaneada, es la
primera corrida a hacer para cerrar también el riesgo de lectura.

## 🚧 BLOQUEANTE de Fase 3 — persistencia por documento

**Fase 3 (deduplicación / archivo) NO arranca hasta resolver la persistencia por
documento, incluido el matching PDF↔página.**

Hallazgo (2026-08-01): la tabla `documentos` **no recibe hoy los campos extraídos**
por gpt-4o. `Registrar Documento` inserta con `tipo`/`cliente`/`referencia`/
`viaje_id` vacíos; `Actualizar Documento` solo setea `cliente` (derivado del path
de archivado) y `estado`. Nadie escribe `referencia`, `tipo`, `matricula` ni `kg`
por documento. Las columnas `kg` y `matricula` se crearon en Fase 2 pero quedan
**sin mapear** a propósito: mapearlas requiere una pieza de persistencia nueva que
no está definida.

La tupla de identidad que Fase 3 asume para deduplicar —**cliente + referencia +
matrícula**— **no existe en `documentos`**. Antes de Fase 3 hay que:

1. Escribir los campos extraídos por documento en la tabla `documentos`
   (referencia, tipo, matrícula, kg), no solo el log de archivado.
2. Resolver el **matching PDF↔página**: el archivado es por archivo/PDF; la
   extracción es por página/documento dentro del PDF. Hay que decidir cómo casarlos.

### Decisión de dominio pendiente para Fase 3

Cuando un PDF combinado tiene 4 páginas que son 4 documentos del **mismo viaje**
(orden de carga + CMR + carta de porte + ticket), ¿son **4 filas** en `documentos`
o **1**? Definir al armar Fase 3.
