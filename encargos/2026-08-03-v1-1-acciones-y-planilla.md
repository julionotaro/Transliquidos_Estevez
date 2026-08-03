# Encargo a Claude Code — v1.1: acciones sobre pendientes + planilla de carga/auditoría

> Cierra la operabilidad de v1. Dos piezas: (1) acciones de corrección sobre la vista de pendientes, (2) una planilla unificada que sirve a la vez como **copilot de carga** (datos compilados para transcribir al sistema de escritorio) y **auditoría de facturación** (revisar antes de emitir).
>
> Margen de uso limitado. Si la pieza 2 crece, entregá la 1 y reportá.

---

## 0. REGLA DE ARRANQUE

1. Inspeccionar la vista de pendientes ya desplegada (`/webhook/viajes-pendientes`) — la pieza 1 la extiende.
2. Confirmar el esquema real de `viajes` (las columnas del cruce ya existen) y cómo se resuelven hoy tarifa e indexación.
3. **Dato nuevo de dominio, importante:** Julio aportó una exportación real del sistema de escritorio (HNOS. ESTEVEZ CASAL). Contiene el **caso multi-viaje FORESA que nunca se había verificado con papel**: expediente `00050461`, ruta CALDAS DE REIS→OREMBER, tres viajes `Nº 01/02/03` con referencias distintas (2002854, 2002844, 2002866) e importes distintos, mismo cabeza/remolque. Esto confirma el modelo de Fase 2 (albarán = unidad, bloque = N viajes) contra dato real. Anotarlo en el cierre: el multi-viaje deja de estar "no verificado" — la estructura coincide con la exportación real.
4. Si algo contradice el encargo, parar y reportar.

---

## PIEZA 1 — Acciones de corrección sobre pendientes

### Canal: en la misma pantalla, no fuera de ella

La corrección se hace **en la vista de pendientes**, conectada a la base. **No** por email, Telegram ni formulario suelto. El motivo es trazabilidad: una corrección hecha por un canal externo se pierde; hecha en el sistema queda registrada, y eso importa cuando una factura se discute con un cliente.

### Tres acciones por fila

- **Corregir dato** — editar un campo mal leído (ej. cliente "FORBA"→"FORESA"). Al corregir el cliente, el sistema **re-evalúa el régimen de indexación** y, si con el dato corregido el viaje ya no tiene motivo de revisión, sale de la lista.
- **Marcar resuelto** — para cuando la documentación faltante llegó por otra vía. Saca el viaje de pendientes sin editar campos.
- **Anotar incidencia** — texto libre para lo que no encaja en las anteriores. No saca el viaje de la lista; agrega una nota visible.

### Registro obligatorio (audit)

Cada acción guarda: **usuario, fecha/hora, campo afectado, valor anterior, valor nuevo**. Sin esto la corrección no es auditable y no sirve.

Guardar en una columna/tabla de historial. Si es columna JSON en `viajes` (ej. `historial_correcciones`), append, nunca sobrescribir — se conservan todas las correcciones, no solo la última.

### Tests
- Corregir "FORBA"→"FORESA" en un viaje FORESA Caldas→Orense → régimen pasa a `agregada_quincenal`, el viaje sale de REVISAR, queda registro con valor anterior "FORBA".
- Marcar resuelto un `PENDIENTE_DOCUMENTACION` → sale de la lista, queda registro.
- Anotar incidencia → el viaje permanece, la nota se ve, queda registro.
- El historial acumula (dos correcciones sobre el mismo viaje → dos entradas).

---

## PIEZA 2 — Planilla de carga / auditoría (unificada)

Una sola planilla, dos usos: **compilar los datos para cargarlos a mano en el sistema de escritorio** y **auditar la facturación antes de emitir**. Comparten casi todas las columnas; se unifican.

### Columnas — en el orden del sistema de escritorio

Derivadas de la exportación real que aportó Julio. Estas son las que se cargan a mano; el resto (estados, códigos internos, fechas de factura) las pone el sistema de escritorio solo y **no** van acá.

| Columna | Origen en el sistema |
|---|---|
| Empresa | `viajes` (membrete: TLE / HEC) |
| Nº (dentro del expediente) | orden del viaje en el bloque (01, 02, 03 para multi-viaje) |
| Cliente | `viajes.cliente` |
| Origen | `viajes.origen` |
| Destino | `viajes.destino` |
| Carga (material) | `viajes` material |
| Referencia | `viajes.referencia` (del documento, regla por cliente) |
| Cabeza (matrícula tractora) | `viajes` |
| Remolque | `viajes` |
| Chofer | `viajes` / hoja |
| Cantidad (kg) | `viajes.kg_documento` — **del documento, D-01** |
| Tarifa (€/t o €/viaje) | tarifario |
| Precio / Importe | cálculo (cantidad × tarifa, D-02) |
| % Indexación | según `regimen_indexacion` — **ver nota** |
| Importe indexación | cálculo |
| Tipo IVA | según cliente (BALTRANSA y clientes españoles 21%, D-04) |

### Nota sobre indexación en esta planilla

La indexación **por línea** se puede calcular y mostrar por viaje. La **agregada** (quincenal/mensual, FORESA) **no** — se cierra en facturación. Para esos viajes, la columna muestra el **régimen** (`agregada_quincenal`, pendiente de cierre), no un número. No inventar un importe de indexación para un viaje cuyo régimen es agregado; eso sería el error que D-03 previene.

### Formato: tabla filtrable por columna

- Tabla HTML con **filtro por columna** (el pedido explícito de Julio) y ordenamiento.
- Servida por webhook como la vista de pendientes.
- Librería de tabla liviana está permitida (ej. una que dé filtros/orden sin build), pero **servida localmente** — el VPS bloquea CDN (aprendizaje ya registrado). Descargar el asset al repo y servirlo desde `/static/`, no enlazar a un CDN.
- Sin framework, sin paso de build.

### Doble uso, misma tabla

- **Como copilot de carga:** todas las columnas en el orden del escritorio, para transcribir de un vistazo. Que se pueda filtrar por cliente, por chofer, por fecha, para cargar por lotes.
- **Como auditoría:** las mismas filas, con foco en detectar errores antes de facturar — resaltar visualmente los viajes con `REVISAR`, `PENDIENTE_DOCUMENTACION`, `SIN_TARIFA`, o indexación sin cerrar. Una fila resaltada = mirar antes de facturar.

### Qué NO incluir
- Viajes en estado pendiente/revisar **no se ocultan** — se muestran resaltados. El objetivo de la auditoría es justamente verlos.
- No calcular la indexación agregada (se cierra en facturación).
- No emitir ni marcar como facturado nada — es una planilla de lectura + revisión, la carga sigue siendo manual.

### Tests
- Un viaje normal FORESA aparece con todas sus columnas pobladas y el importe = cantidad × tarifa.
- Multi-viaje (expediente con Nº 01/02/03) → tres filas, cada una con su referencia, su kg, su importe.
- Viaje con régimen agregado → columna indexación muestra el régimen, no un número.
- Viaje con `REVISAR` → fila resaltada.
- Filtro por cliente → muestra solo ese cliente.
- Filtro por fecha de carga → funciona.
- La tabla se sirve sin llamar a ningún CDN (assets locales).

---

## Commit

```
feat(v1.1): acciones de correccion en pendientes + planilla carga/auditoria

Pendientes ahora editable: corregir dato (re-evalua regimen), marcar resuelto,
anotar incidencia, todo con registro usuario/fecha/valor-anterior. Planilla
unificada carga/auditoria con las columnas del sistema de escritorio, filtrable
por columna, servida con assets locales. Multi-viaje FORESA confirmado contra
exportacion real. La indexacion agregada muestra regimen, no importe (D-03).
```

## Verificación manual
1. Corregir "FORBA"→"FORESA" en la pantalla → el viaje sale de REVISAR y el régimen se recalcula; el registro guarda el valor anterior.
2. Abrir la planilla → los viajes de la corrida aparecen con las columnas del escritorio, filtrables.
3. Filtrar por cliente y por fecha → funciona.
4. Confirmar que los viajes con REVISAR/PENDIENTE se ven resaltados, no ocultos.
5. Confirmar que la planilla carga sin acceso a CDN (assets locales).

## Fuera de alcance
- Carga automática al sistema de escritorio (futuro, Julio lo detallará).
- Cierre de facturación / cálculo de indexación agregada (Fase 5).
- Fase 3 (archivo con dedup) — bloqueada por persistencia de documentos.
- Retomar Document AI.
