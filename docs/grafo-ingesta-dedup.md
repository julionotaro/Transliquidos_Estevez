# Grafo de ingesta — tramo de deduplicación (§5.1) + peso origen>destino (§4)

> Fuente de verdad del **tramo de escritura de viajes** del workflow
> `[ESTEVEZ] Ingesta Viaje` (`WD0q9Ic0oDvUoJwp`). Complementa
> `modelo-dominio-lectura.md` §4 (peso) y §5.1 (dedup), que son el *porqué*.
> Este documento es el *cómo* del grafo y del deploy.
>
> Aplicado el 2026-08-14 en la rama `claude/dedup-viajes-peso-origen`
> (commit combinado `4ecce11`).

## Qué cambió y por qué

Dos incorrecciones de facturación silenciosas que el sistema podía cometer solo:

1. **Reingesta duplicada (§5.1).** Volver a procesar un envío (mismo PDF
   reenviado, reproceso) creaba una **segunda fila** del mismo viaje en la tabla
   `viajes`. Un viaje contado dos veces = facturado dos veces.
2. **Peso de descarga en vez de carga (§4, D-01).** Cuando había peso de carga
   (origen) y de descarga (destino) y diferían, el sistema tomaba el primero que
   encontraba (a veces el de descarga, con merma). El peso facturable es el de
   **origen**.

El (2) vive dentro del nodo Code `Formatear Linea Gesruta` (lógica
`correlacionar.js`); no toca el grafo. El (1) **sí es cambio de grafo**, porque
la dedup necesita leer la tabla `viajes` completa y `correlacionar.js` solo ve
la subida actual. Por eso vive en `Preparar Filas Viajes` + nodos nuevos.

## El tramo nuevo del grafo

```
Guardar Hoja ──▶ Preparar Gastos                         (intacto)
            └──▶ Leer Viajes Existentes ──▶ Preparar Filas Viajes ──▶ IF es update
                                                                       ├─ out[0] TRUE  ──▶ Actualizar Motivo Viaje
                                                                       └─ out[1] FALSE ──▶ Guardar Viajes
```

Antes era: `Guardar Hoja ──▶ Preparar Filas Viajes ──▶ Guardar Viajes`.

### Nodos nuevos

| Nodo | Tipo | Rol |
|------|------|-----|
| **Leer Viajes Existentes** | dataTable `get` | Trae los viajes ya guardados para que la dedup los compare. Tabla `lrBxWpTUxMtO8U48`. **Filtro: `fecha >= hoy − 45 días`** (`returnAll: true`). Acota la lectura: sin filtro se traería toda la tabla (~200/día, no escala). 45 días cubre cualquier reingreso realista. |
| **IF es update** | if v2.3 | Enruta la salida de `Preparar Filas Viajes` según la marca `_dedup_update` (booleana, `looseTypeValidation`). TRUE → update; FALSE → insert. |
| **Actualizar Motivo Viaje** | dataTable `update` | Update por `id` de la fila existente. Escribe **solo** `motivo_revision` y `estado_lectura` — aditivo, no pisa ningún otro dato (el humano pudo haber corregido algo). |

### La lógica de dedup (dónde vive)

- **`ficha/dedup.js`** (lógica pura, testeada): función `dedupViajes(candidatos,
  existentes)` → `{ insertar, actualizarMotivo, omitidos }`. Se **inlinea** en el
  nodo `Preparar Filas Viajes` vía `build-nodo.js` (`logica: ['dedup.js']`).
- **`ficha/nodo-preparar-filas-viajes.wrapper.js`**: lee
  `$('Leer Viajes Existentes').all()`, llama `dedupViajes`, y emite:
  - filas a **insertar** (sin marca) → van por la rama FALSE del IF a `Guardar Viajes`;
  - items `{ _dedup_update: true, id, motivo_revision, estado_lectura }` → van por
    la rama TRUE a `Actualizar Motivo Viaje`;
  - los **omitidos** (duplicado puro) no se emiten.

Contrato de decisión (§5.1), llave de identidad = `matrícula_tractora + km_inicio`:

| Situación | Acción |
|-----------|--------|
| Llave nueva | INSERTAR |
| Llave existe, datos iguales | OMITIR (duplicado puro) |
| Llave existe, datos difieren | OMITIR inserción + UPDATE aditivo de `motivo_revision` (+`REVISAR`) |
| Misma ruta, `km_inicio` por poco distinto (≤ `UMBRAL_KM_INICIO`=50) | INSERTAR pero marcar `REVISAR` (posible km mal leído; no duplicado encubierto) |

`UMBRAL_KM_INICIO` es constante nombrada en `dedup.js` — ajustable si con dato
real las rutas cortas (dos vueltas seguidas a <50 km) generan ruido.

## Seguridad del deploy parcial

`Preparar Filas Viajes` lee `$('Leer Viajes Existentes')` dentro de un
`try/catch`: si ese nodo aún no existe (deploy a medias), degrada a **insertar
todo** (sin dedup) en vez de romper el pipeline. Mismo patrón defensivo que la
lectura de `Guardar Hoja`. La dedup es una capa de idempotencia, no un bloqueante.

`IF es update` con `looseTypeValidation`: las filas a insertar no traen el campo
`_dedup_update` (undefined → falsy → rama FALSE). Solo los items de update lo
traen en `true`.

## Deploy (nodos Code = pegado manual + Publish)

Los cambios de grafo se aplicaron por MCP; los cambios de **código** de los nodos
Code se pegan a mano (regex/backslashes no viajan seguro por MCP) desde los
`.generated.js` de la rama:

1. `Formatear Linea Gesruta` ← `ficha/nodo-formatear.generated.js` (peso §4)
2. `Preparar Filas Viajes` ← `ficha/nodo-preparar-filas-viajes.generated.js` (dedup §5.1)
3. `Aplicar Accion` ← `ficha/nodo-aplicar-accion.generated.js` (cliente→correcciones, commit `221f14f`)

Después: **Publish** del workflow (deja firmes los 3 nodos nuevos del grafo).

## Verificación en corrida real (pendiente)

- **Dedup:** reingestar un envío ya cargado → no crea filas nuevas; si algún dato
  cambió, la fila existente queda con `motivo_revision` con sufijo *"reingreso de
  viaje ya existente…"* y `estado_lectura=REVISAR`, sin perder lo previo.
- **Peso §4:** viaje con doc de carga y de descarga que difieren → factura el de
  origen + aviso *"peso origen … manda sobre descarga …"*.
- **Rendimiento:** si `Leer Viajes Existentes` se siente lento, es el costo del
  filtro de 45 días; se puede acotar más.
