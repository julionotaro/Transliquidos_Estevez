# Grafo de ingesta — tramo de tarifa contractual + tipo de conductor

> Fuente de verdad del **cableado de grafo** que hace correr la búsqueda de
> tarifa contractual (`ficha/tarifa-contractual.js`) y el mini-mapa
> chófer→tipo_conductor (`ficha/conductores.js`) dentro del workflow
> `[ESTEVEZ] Ingesta Viaje` (`WD0q9Ic0oDvUoJwp`).
> El *porqué* vive en `ficha/tarifa-contractual.js` (dos puentes) y en
> `docs/catalogo-puntos.md`. Este documento es el *cómo* del grafo y del deploy.
>
> Rama: `claude/tarifa-contractual`.
>
> **Estado (aplicado por MCP, SIN publicar):** ✅ 4 columnas creadas en `Viajes`;
> ✅ nodos `Leer Tarifas` (`e9808b19…`) y `Leer Puntos` (`a4a49fa9…`) creados;
> ✅ 4 reconexiones aplicadas; ✅ 4 columnas mapeadas en `Guardar Viajes`
> (schema 42, value con las 4 expresiones). **Falta (Julio):** pegar el código en
> `Preparar Filas Viajes` + **Publish**.

## Qué agrega y por qué

Hoy el viaje solo copia la tarifa que venga IMPRESA en la OC (casi nunca hay OC),
así que la columna de tarifa queda vacía y la facturación arranca a ciegas. El
cambio trae la tarifa de la tabla **`Tarifas`** (pactada), cruzando los dos
puentes que faltaban: punto canónico (resolver-punto) y razón social (contención
de tokens). Además marca cada viaje con `tipo_conductor` (autónomo | dependiente).

Todo el cálculo vive en el nodo Code **`Preparar Filas Viajes`** (lógica pura
inlineada por `build-nodo.js`). El grafo solo tiene que **darle de comer** las
tablas `Tarifas` y `puntos` — de ahí los dos nodos lectores nuevos.

## El tramo nuevo del grafo

Antes (tramo de dedup ya vigente):

```
Guardar Hoja ──▶ Preparar Gastos
            └──▶ Leer Viajes Existentes ──▶ Preparar Filas Viajes ──▶ IF es update ──▶ …
```

Después (se insertan dos lectores ANTES de Leer Viajes Existentes):

```
Guardar Hoja ──▶ Preparar Gastos                                          (intacto)
            └──▶ Leer Tarifas ──▶ Leer Puntos ──▶ Leer Viajes Existentes ──▶ Preparar Filas Viajes ──▶ …
```

**Por qué en serie y ANTES de `Leer Viajes Existentes`, no en una rama suelta:**
en n8n `$('Leer Tarifas')` solo resuelve si ese nodo **ya se ejecutó** en la
corrida. Una rama paralela no garantiza orden; ponerlos aguas arriba de
`Preparar Filas Viajes` en el mismo camino sí. Y se ubican **antes** de
`Leer Viajes Existentes` (no después) porque este último emite todas las filas
de viajes con `returnAll` — colgar los lectores después los haría correr una vez
por viaje. Aguas arriba, corren tantas veces como items emita `Guardar Hoja`
(pocos).

**Multiplicación de filas — ya blindada en el código.** Un nodo dataTable `get`
corre una vez por item de entrada y CONCATENA. Si entran N items, cada fila de
`Tarifas`/`puntos` aparece N veces. El wrapper `Preparar Filas Viajes` deduplica
las filas de ambos lectores por identidad (`_leerTabla`) antes de usarlas, así
que el resultado es correcto sin importar cuántos items entren. Igual conviene el
punto de inserción con menos items por rendimiento (leer 698 filas pocas veces).

### ⚠️ `Execute Once` en los lectores — OBLIGATORIO (bug de ejec. 921/930/939)

La dedup del wrapper arregla la CORRECCION, pero no el COSTE: encadenar los
lectores en serie multiplica los items del GRAFO antes de llegar al código.

Lo que pasó al desplegar sin esto: `Leer Puntos` emite ~390 filas → el nodo
siguiente, `Leer Viajes Existentes`, corre **una vez por item de entrada**, o sea
**390 lecturas completas** de la tabla `Viajes`. Se colgaba ahí (en las ejecs.
921/939 `Leer Puntos` es el `lastNodeExecuted` y `Leer Viajes Existentes` no
llega a registrarse), con corridas de 5–8 min canceladas a mano y un OOM (907).

**Fix:** `Execute Once` (`executeOnce: true`) en los TRES nodos de la cadena —
`Leer Tarifas`, `Leer Puntos` y `Leer Viajes Existentes`. Cada uno lee su tabla
una sola vez y no multiplica items aguas abajo. Aplicado por MCP el 2026-08-21.
Si algún día se agrega otro lector a esta cadena, va con `Execute Once` también.

### ⚠️ `Always Output Data` en los lectores — OBLIGATORIO (bug de ejec. 951)

Segundo efecto de encadenar los lectores en serie: si un lector devuelve **cero
filas** (tabla vacía), emite **0 items** y n8n **saltea** el nodo siguiente por
falta de item que lo dispare. En 951 la tabla `Viajes` estaba vacía → `Leer
Viajes Existentes` emitió `[]` → `Preparar Filas Viajes` **no se ejecutó** → no se
escribió ningún viaje (huevo y gallina: una tabla vacía nunca recibía su primer
registro).

**Fix:** `Always Output Data` (`alwaysOutputData: true`) en los TRES lectores →
emiten un item vacío `{}` cuando la tabla está vacía, disparando el nodo
siguiente. El wrapper ya tolera ese `{}` (la dedup y la tarifa lo ignoran por no
tener claves). Aplicado por MCP el 2026-08-21. Regla para lectores futuros de esta
cadena: `Execute Once` **y** `Always Output Data`, juntos.

## Nodos nuevos

Ambos son `n8n-nodes-base.dataTable` (typeVersion `1.1`), operación `get`,
`returnAll: true`, **sin filtro** (son tablas de catálogo, se leen enteras).
Calcados de `Leer Viajes Existentes`, quitándole el filtro de fecha.

| Nodo | `dataTableId` | Rol | Posición sugerida |
|------|---------------|-----|-------------------|
| **Leer Tarifas** | `Siwhv2AUWTSeFlrJ` | Tabla `Tarifas` (~698 filas: razón social + origen/destino por nombre + material + tarifa_tn/precio_fijo). | `[1240, 260]` |
| **Leer Puntos** | `YjxcHHb5B4hT0RFU` | Tabla `puntos` (catálogo canónico + alias) para resolver origen/destino del viaje a nombre canónico. | `[1312, 340]` |

Config exacta de cada uno (idéntica salvo `dataTableId`):

```json
{
  "operation": "get",
  "dataTableId": { "__rl": true, "mode": "id", "value": "<ID de la tabla>" },
  "returnAll": true
}
```

## Reconexiones (edges)

Se toca **solo** la segunda salida de `Guardar Hoja` (la que iba a
`Leer Viajes Existentes`); la primera (`Preparar Gastos`) queda intacta.

| Acción | Desde | Hacia |
|--------|-------|-------|
| **Quitar** | `Guardar Hoja` (main[0]) | `Leer Viajes Existentes` |
| **Agregar** | `Guardar Hoja` (main[0]) | `Leer Tarifas` |
| **Agregar** | `Leer Tarifas` (main[0]) | `Leer Puntos` |
| **Agregar** | `Leer Puntos` (main[0]) | `Leer Viajes Existentes` |

`Guardar Hoja → Preparar Gastos` **no se toca.**
`Leer Viajes Existentes → Preparar Filas Viajes` **no se toca.**

## Columnas nuevas en la tabla `Viajes` (`lrBxWpTUxMtO8U48`)

Regla de oro (misma que en dedup): toda columna que emite el wrapper DEBE existir
en la tabla **y** mapearse en el nodo dataTable **`Guardar Viajes`** (schema +
value), o se pierde en silencio. Verificar por readback, no por código.

| Columna | Tipo | Qué guarda |
|---------|------|------------|
| `tipo_conductor` | string | `autonomo` \| `dependiente` \| `''` |
| `tarifa_contractual_tn` | number | €/tn pactada (o vacío) |
| `tarifa_contractual_fijo` | number | precio fijo por viaje pactado (o vacío) |
| `tarifa_contractual_motivo` | string | por qué quedó vacía / a REVISAR (sin match único, ambigua, etc.) |

En **`Guardar Viajes`**: agregar esas 4 columnas al schema y como value
`={{ $json.<columna> }}`. Nada más de ese nodo cambia.

## Seguridad del deploy parcial

`Preparar Filas Viajes` lee los lectores dentro de `try/catch` (`_leerTabla`): si
`Leer Tarifas`/`Leer Puntos` aún no existen (deploy a medias), `tarifasTbl` queda
`[]` y la tarifa sale vacía **sin romper** el pipeline — mismo patrón defensivo
que la dedup con `Leer Viajes Existentes`. Se puede desplegar por partes: primero
el código pegado, después los nodos, después las columnas; en cada estado
intermedio la ingesta sigue corriendo.

**NUNCA inventa:** sin match único la tarifa queda vacía con `..._motivo`
explicando por qué, y el viaje se ve en REVISAR. No se factura una tarifa
adivinada (§2).

## Deploy

Pasos 1–3 **ya aplicados por MCP** (sin publicar). Solo restan 4 y 5, que van a
mano porque el código del nodo Code (regex/backslashes) no viaja seguro por MCP:

1. ~~**Tabla `Viajes`**: crear las 4 columnas.~~ ✅ hecho.
2. ~~**Grafo**: crear `Leer Tarifas` y `Leer Puntos`; aplicar las 4 reconexiones.~~ ✅ hecho.
3. ~~**`Guardar Viajes`**: mapear las 4 columnas nuevas (schema + value).~~ ✅ hecho.
4. **`Preparar Filas Viajes`** ← pegar `ficha/nodo-preparar-filas-viajes.generated.js`.
5. **Publish** del workflow.

Hasta el Publish, el workflow activo sigue corriendo la versión anterior; los
nodos y columnas nuevos quedan guardados pero inertes (el código viejo de
`Preparar Filas Viajes` ni los mira).

## Verificación en corrida real (pendiente)

- **Tarifa OK:** viaje FORESA `Caldas → Cella` (Formol) → `tarifa_contractual_tn`
  poblada desde `Tarifas`, `..._motivo` vacío. (Puente 1: `Cella`→`TERUEL`;
  puente 2: `Foresa`⊂`FORESA IND.QUIMICAS…`.)
- **Sin inventar:** ruta sin tarifa cargada → `tarifa_contractual_*` vacío +
  `..._motivo` = "sin tarifa cargada para …". Viaje en REVISAR, no facturado a ciegas.
- **Ambigüedad:** dos tarifas específicas para la misma ruta/cliente → vacío +
  motivo "N tarifas posibles — revisar cuál aplica".
- **tipo_conductor:** ficha de `JUAN MANUEL ABAL`/`PEDRO FRAGA`/`JOSE CARLOS
  ALFONSIN` → `autonomo`; `CARLOS ABALO`/`RUBEN ABELO` → `dependiente` (no
  confundir con Abal).
- **Dedup de lectores:** confirmar que un viaje con match no sale marcado como
  "N tarifas posibles" por filas repetidas (blindaje `_leerTabla`).

---

## KM vacíos: qué necesita el grafo (2026-08-26)

El nodo **Formatear Linea Gesruta** ahora lee `$('Leer Viajes Existentes')` para
armar el padrón de últimos odómetros por tractora. Requisitos del lector:

- **Execute Once** — si no, corre una vez por item de entrada y multiplica.
- **Always Output Data** — con la tabla vacía debe emitir un item, no cero, o el
  nodo siguiente se saltea (es el bug que dejó la tabla Viajes vacía).

Si el nodo lector no existe todavía, el wrapper lo tolera: cae en `try/catch` y
la ingesta sigue sin padrón, con los km vacíos del primer viaje de cada ficha en
`sin_odometro_previo` (el comportamiento anterior).

**Columna nueva en `viajes`: `origen_km_vacios`** (texto). Como toda columna
nueva, hay que crearla en la tabla Y mapearla en el nodo dataTable
**Guardar Viajes** (schema + value). Verificar por readback, no por código.

`datos_json` incluye además `ultimo_odometro_tractora`: array de
`{matricula_tractora, km_final, fecha_carga, viaje_id, origen}`, listo para
persistir en una tabla de padrón si se decide materializarla. Hoy el padrón se
reconstruye leyendo Viajes, que ya es suficiente.
