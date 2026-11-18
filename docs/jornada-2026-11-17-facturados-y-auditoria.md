# Jornada 17/11 — Carpeta `facturados/` + auditoría de "información a salvo"

Dos encargos de Julio tras confirmar que FRIGOS quedó operativo.

## 1. Carpeta `facturados/` (facturación quincenal)

**Problema:** al salir una factura, sus scans quedaban mezclados en `procesados/`
con los aún no facturados (pueden quedar pendientes los viajes sin documentación
entregada antes del corte) → difícil encontrar el respaldo de una factura.

**Hecho:**
- Convención `facturados/<AÑO>/<MM-mes de FACTURACIÓN>/<CLIENTE>/<Nº factura>/`
  (mes de facturación, **no** de emisión — decisión de Julio).
- Bandeja `facturas-entrada/` donde Julio sube los PDF de factura.
- Herramienta `herramientas/facturar/mover-facturados.js`: cruza las referencias
  contra el registro, mueve cada `pdf_doc`, actualiza el registro (`pdf_doc` +
  marca en observaciones) y anota en `datos/facturacion-log.csv`. Dry-run por
  defecto, `--mover` aplica. Idempotente y ruidoso.
- Doc `docs/flujo-facturados.md` + entradas en INDICE.
- **Probado en dry-run** con refs reales de FORESA (cruce y destino correctos).

**Pendiente:** calibrar la **lectura del PDF de factura** (de dónde salen las
referencias) con la primera factura real que suba Julio. CLAVO se factura distinto
(Excel por km, sin `referencia`): su archivado facturado se definirá cuando surja.

## 2. Auditoría "toda la info a salvo, ordenada y guardada"

- ✅ **458 tests** pasan · validador OK · golden OK.
- ✅ Todas las fuentes que cita `procesar-juego` **existen y están trackeadas por
  git** (sin `.gitignore`, nada sin trackear ni en riesgo local).
- ✅ Tarifas confirmadas y por analogía **cableadas** en el armador
  (`herramientas/armar_orden/lib/datos.js`). `correcciones-julio.json` es lectura
  del operador por diseño (no la consume código).
- ⚠️→✅ **Único hueco:** el skill `cargar-viajes-gesruta` (procedimiento del bot)
  vivía **solo en los skills sincronizados de la cuenta, no en el repo** — por eso
  el fix de Campo1/Campo2 no se había guardado. **Respaldado** en
  `.claude/skills/cargar-viajes-gesruta/SKILL.md` (fuente de verdad versionada; la
  copia de la cuenta se re-sincroniza desde ahí). Falta: Julio actualiza el skill en
  claude.ai → Settings → Skills para que el bot lo tome de forma permanente.
- Corregida una línea desfasada en `procesar-juego` (excel_frigos ahora A..R con palets).
