# Encargo 2026-08-04 — PR de Pieza 2 + reemplazo de tabla Tarifas

## Contexto

Dos tareas independientes en este encargo:

- **(A)** Abrir el PR de la Pieza 2, que quedó en la rama `claude/planilla-carga-auditoria` en origin sin PR.
- **(B)** Reemplazar la tabla `Tarifas` con un tarifario nuevo exportado del sistema de escritorio, que Julio proporcionó en Excel (`Tarifas_general.xls`). Esto llena huecos de tarifas y limpia deuda de datos antes de la ronda de verificación con viajes reales de hoy.

Son independientes: la carga de tarifas va en rama propia, NO en la de la planilla.

---

## Tarea A — Abrir el PR de la Pieza 2

- Abrí el PR desde `claude/planilla-carga-auditoria` hacia la rama base habitual.
- Título y cuerpo: resumí lo que entró — planilla unificada (copilot de carga + auditoría), lookup de tarifas con fallback por fragmento ≥3 chars, dedup de indexación en código (`deduplicarIndexacion()`), filtro por columna sin CDN, 166/166 tests, endpoint `GET /webhook/viajes-planilla`.
- En el cuerpo dejá constancia explícita de los hallazgos de verificación real, porque son **decisiones de negocio / deuda técnica, no bugs de la planilla**:
  1. El fix AVEPTO→AZAMBUJA(PT): match espurio por fragmento de 2 letras ("PT"), resuelto exigiendo fragmentos ≥3 chars, con test de regresión que reproduce el caso.
  2. El caso que parecía "FORESA Caldas→Orense SIN_TARIFA" NO era brecha de tarifario. "Orember" es un **cliente** cargado con esa etiqueta, no la localidad Ourense/Orense; la ruta real es Caldas de Reis→Ourense. Deuda técnica anotada: el sistema mezcla destino-por-cliente con destino-por-localidad. Se corregirá a futuro para respetar lógica de localidad; por ahora se deja como está.
  3. Los 9 viajes vivos tienen `kg_documento` nulo, así que el importe muestra "-" legítimamente (comportamiento correcto, no bug de mapeo).
- **No mergear.** Dejarlo para revisión de Julio.

---

## Tarea B — Reemplazar la tabla Tarifas desde el Excel

**Decisión ya tomada por Julio:** este Excel es la exportación directa del sistema de escritorio, es la fuente autoritativa, y **REEMPLAZA** la tabla actual — no complementa. El reemplazo elimina de paso la deuda de la tabla vieja (bug de cross-join y orígenes empaquetados tipo "CALDAS/VILLAGARCIA"): el Excel trae orígenes atómicos.

### Regla de arranque — inspeccioná primero

1. **Tabla destino:** `Tarifas`, id `Siwhv2AUWTSeFlrJ`, project `grgBpWySVCpXvuii`. Columnas actuales (7): `cliente, origen, destino, material, tarifa_tn, precio_fijo, vigente_desde`.
2. **Fuente:** `Tarifas_general.xls`, una solapa `Hoja1`, 704 filas de datos, 69 clientes. Julio sube el archivo. Columnas relevantes del Excel: `Cliente, Origen, Destino, Carga, Concepto, Precio, U.M., Fec.Ult.Apli., Desde`. (Tiene 30 columnas en total; el resto — proveedores, comisiones, provincias en "Cualquiera", etc. — no se mapea salvo que encuentres una razón.)

### Mapeo — mapeá, no recrees

- `Cliente` → `cliente`
- `Origen` → `origen`
- `Destino` → `destino`
- `Carga` → `material`
- `Precio` → `tarifa_tn` **o** `precio_fijo` **según U.M.** (ver abajo — crítico)
- `Fec.Ult.Apli.` (o `Desde` si la primera es nula) → `vigente_desde`

### El punto crítico: Precio depende de U.M.

La columna `Precio` NO siempre es €/tonelada. Distribución de U.M. en el Excel: TONELADAS 386, Cualquiera 190, UNIDADES 111, KILOMETROS 16, LITROS 1.

- `U.M. = TONELADAS` → precio por tonelada → va a **`tarifa_tn`**.
- `U.M. = UNIDADES / Cualquiera / KILOMETROS / LITROS` → precio fijo por viaje (o por otra unidad que no es tonelada) → va a **`precio_fijo`**.

No metas todo en una sola columna. Un precio de 1300 con U.M. "Cualquiera" es un flete fijo, no €/tonelada — mezclarlos factura mal en silencio, que es exactamente la clase de bug que ya cazamos antes. Si aparece una U.M. que no encaja limpio en tarifa_tn ni precio_fijo (ej. KILOMETROS, LITROS), marcala/logueala en vez de asumir; son pocas filas y conviene que Julio las vea.

### Dedup antes de insertar

El propio Excel tiene filas repetidas (ej. Barcelona→Caldas de Reis aparece 3× al mismo precio; Tarragona→Caldas 2×). Dedup por `(cliente, origen, destino, material)` antes de cargar. Si hay dos filas con misma clave y **distinto precio**, no elijas en silencio: logueá el conflicto para que Julio lo revise y quedate con la de `Fec.Ult.Apli.` más reciente como default.

### Ejecución del reemplazo

- Vaciá la tabla `Tarifas` actual y cargá las filas del Excel (deduplicadas y con el precio en la columna correcta). Si vaciar-y-recargar es riesgoso en la infra, hacelo transaccional o cargá a tabla nueva y renombrá — pero el estado final es: `Tarifas` = contenido del Excel, nada de la carga vieja.

### Tests

- Mapeo U.M.→columna: un caso TONELADAS aterriza en `tarifa_tn` con `precio_fijo` vacío; un caso "Cualquiera"/precio alto aterriza en `precio_fijo` con `tarifa_tn` vacío. Verificado por readback.
- Readback distinguiendo null legítimo de null por columna sin mapear (el bug de `estado_lectura` no se puede repetir).
- Conteo antes/después de filas en `Tarifas`.
- Suite existente sigue verde (166/166).
- Re-correr el lookup de la planilla contra los 9 viajes vivos: ninguna tarifa que antes resolvía debe romper tras el reemplazo.

### Verificación — corrida real, no "se ve bien"

- Contá filas finales en `Tarifas` y reportá antes/después.
- Confirmá que el lookup de la planilla sigue funcionando sobre datos reales tras el reemplazo (ejecución real, no solo tests).
- Reportá la lista de conflictos de precio (misma clave, distinto precio) si los hubo, para revisión de Julio.

### Commit / entrega

- Rama propia (no `claude/planilla-carga-auditoria`), commits chicos (parseo+mapeo / dedup / reemplazo / verificación).
- No abrir PR de esta tarea salvo que se pida; reportá el resultado y esperá.
