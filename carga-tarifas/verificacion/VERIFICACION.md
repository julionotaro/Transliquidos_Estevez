# Verificación — reemplazo de la tabla Tarifas (encargo 2026-08-04, tarea B)

Corrida real contra `Tarifas` (id `Siwhv2AUWTSeFlrJ`, proyecto n8n
`grgBpWySVCpXvuii`), no "se ve bien". Todo lo que sigue viene de ejecuciones
reales (workflows n8n), no de inspección de código.

## 1. Conteo antes/después

- **Antes del reemplazo:** tabla `Tarifas` con datos del load anterior (no
  contados exactamente antes de vaciar; el encargo pedía reemplazo total, no
  comparación fila a fila con el contenido viejo).
- **Vaciado:** `deleteRows` con `dryRun:false` sobre `Tarifas` — confirmado
  vacío por readback (`Leer Tarifas` devolvió `[]`) antes de cargar.
- **Después del reemplazo:** **698 filas**, confirmado por ejecución real
  (workflow `SCRATCH Contar Tarifas`, execution 636: `Leer Tarifas` →
  `Contar` → `{"total": 698}`).
- **698 = 704 filas crudas del Excel − 0 excluidas por U.M. desconocida − 6
  fusionadas por dedup** (ver `reporte-carga-2026-08-04.json`).

Nota operativa: durante la carga se produjo un borrado accidental de las 698
filas recién insertadas (el nodo "Borrar Tarifas" del workflow scratch de
conteo había quedado conectado al mismo trigger que use para reverificar, y
seguía en `dryRun:false` de un borrado intencional anterior). Se detectó por
readback vacío, se desconectó el nodo para que no pueda volver a dispararse,
y se re-insertaron las 698 filas desde los mismos archivos locales
(`carga-tarifas/scripts` + datos en `filas-finales.json`, no versionado por
tamaño). Sin pérdida de datos porque todo estaba guardado localmente antes de
tocar la tabla en producción.

## 2. Conflictos de precio (mismo cliente+origen+destino+material, precio distinto)

Detectados por `deduplicarTarifasExcel()` — no se descartan en silencio, se
listan aquí para revisión de Julio (detalle completo en
`reporte-carga-2026-08-04.json`):

1. **DROGAS VIGO, S.L. — SANTANDER → PORRIÑO — Cualquiera**: 43.48 €/tn
   (vigente desde 2024-12-16) vs 38.0 €/tn (vigente desde 2023-01-16).
   Elegida: **43.48** (vigencia más reciente).
2. **HELM IBERICA, S.A. — BILBAO → MONZON (HUESCA) — SOSA**: 708.1 €
   (sin fecha de vigencia) vs 764.75 € (vigente desde 2026-01-01).
   Elegida: **764.75** (vigencia más reciente; la fila sin fecha se trata
   como la más vieja).

## 3. Avisos — U.M. KILOMETROS/LITROS

17 filas con `U.M.` en KILOMETROS o LITROS fueron mapeadas a `precio_fijo`
pero **marcadas con aviso**: no son un flete cerrado por viaje, son una
tarifa por kilómetro/litro. Van a `precio_fijo` porque es la columna menos
incorrecta de las dos, pero **no se deben facturar a ciegas** — requieren
revisión de Julio antes de usarse. Lista completa en
`reporte-carga-2026-08-04.json` → `avisos`.

## 4. Regresión real contra los 9 viajes vivos — HALLAZGO CRÍTICO

Ejecución real (workflow `SCRATCH Regresion Tarifas`, execution 637) del
lookup `buscarTarifa()` de `ficha/tarifas.js` (rama
`claude/planilla-carga-auditoria`) contra los 9 viajes reales de la tabla
`Viajes` y la tabla `Tarifas` ya reemplazada:

**Resultado: los 9 viajes devuelven `SIN_TARIFA`.**

Antes del reemplazo, al menos 2 de los 9 resolvían tarifa (según el propio PR
de la Pieza 2, que documenta el fix de AVEPTO→PORRIÑO y menciona
CALDAS DE REIS→TERUEL como ruta con tarifa encontrada). Ahora ninguno
resuelve.

**Causa raíz:** `ficha/tarifas.js` → `clienteParaTarifa()` mapea el cliente
del viaje a un código corto (`'FORESA'`, `'RNM'`, `'QUIMIDROGA'`,
`'QUIMICAS DEL JARAMA'`, `'HELM'`), y `buscarTarifa()` filtra las filas de
`Tarifas` con **igualdad exacta**: `norm(f.cliente) !== clienteTarifa`. La
tabla vieja tenía `cliente` con esos mismos códigos cortos. La tabla nueva
(export directo del Excel) tiene razones sociales completas:
`"FORESA IND.QUIMICAS DEL NOROESTE, S.A."`, `"RNM TRANSPORTES QUIMICOS, LDA"`,
`"QUIMIDROGA, S.A."`, `"QUIMICAS DEL JARAMA, S.A."`, `"HELM IBERICA, S.A."` —
ninguna es nunca igual a su código corto. El filtro nunca encuentra
candidatas y todo cae en `SIN_TARIFA`, incluso para rutas que sí están en la
tabla.

Ejemplo real (execution 637):
```
{"cliente":"FORESA","origen":"CALDAS DE REIS","destino":"TERUEL",
 "estado":"SIN_TARIFA","motivo":"sin_tarifa: FORESA CALDAS DE REIS -> TERUEL"}
{"cliente":"RNM","origen":"AVEPTO","destino":"PORRIÑO",
 "estado":"SIN_TARIFA","motivo":"sin_tarifa: RNM AVEPTO -> PORRIÑO"}
```

**Esto NO se corrige en esta pieza** (`ficha/tarifas.js` vive en la rama
`claude/planilla-carga-auditoria`, fuera del alcance de esta tarea B, y
tocarlo aquí mezclaría dos piezas independientes). Se deja documentado para
que Julio decida: `clienteParaTarifa`/`buscarTarifa` necesitan pasar a
matchear por fragmento (ej. `norm(f.cliente).indexOf(clienteTarifa) >= 0`)
en vez de igualdad exacta, con cuidado porque hay razones sociales que
comparten sustring real (`"FORESA FRANCE, SAS"` vs
`"FORESA IND.QUIMICAS DEL NOROESTE, S.A."` son clientes distintos).

**Implicación para el PR de la Pieza 2 (Tarea A):** el PR #1 no debe
mergearse sin resolver esto — en cuanto la tabla `Tarifas` reemplazada quede
como la única fuente real (ya lo es, esta tarea la reemplazó), el lookup de
la planilla deja de resolver tarifas para todos los clientes conocidos.
