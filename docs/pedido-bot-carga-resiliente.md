# Pedido para Claude Desktop — Bot de carga Gesruta RESILIENTE

> Para **pegar a Claude Escritorio** (quien maneja el bot que carga en Gesruta por control de
> pantalla). Describe **cómo debe comportarse el bot** cuando un albarán no está 100% completo.
> No cambia el formato de `orden.json`; cambia la conducta del bot al consumirlo.

---

## Problema a resolver

Hoy, si un albarán no puede resolver un campo (p. ej. el **destino** sin código, o la **tarifa** o
el **peso** pendientes), el bot **aborta la carga entera** y pierde el resto del viaje. Eso es fallar
de forma destructiva: se pierde la cabecera y los demás albaranes que **sí** estaban completos.

**Principio:** un campo faltante en UN albarán **nunca** debe abandonar el viaje entero. El bot
carga todo lo que puede y deja lo incompleto en estado **"Pedido"** (verde) para que un humano lo
termine — un solo campo en Gesruta, no el viaje de nuevo.

---

## Reglas de conducta (por nivel)

### 1. Cabecera (único caso que justifica saltear un viaje)
- La cabecera trae `cabeza`, `verificar{matricula, remolque, chofer}`, `tipo`.
- Si la **matrícula/chofer** no se pueden cargar (p. ej. no existen en Gesruta) → **no se puede
  crear el viaje**: saltear ESE viaje y registrarlo en `resultado.json` con el motivo. Es el único
  caso de "saltear". El resto de viajes de la orden se procesan igual.

### 2. Albarán → siempre crear la cabecera del albarán
Cargar lo que haya: `cliente.codigo`, `origen.codigo`, `destino.codigo`, `carga.codigo`,
`referencia`, `salida`, `llegada`. Reglas:
- Si un **`codigo` viene `null`** (no se pudo resolver): **no inventar**. Cargar los que sí están y
  dejar el albarán como **Pedido** (ver §4). No abortar.
- Nunca teclear texto "a criterio" en lugar de un código: si no hay código, es Pedido.

### 3. Líneas (porte e indexación) — lo que dispara "Pedido"
- **`lineas.porte` tiene objeto** y `tarifa_pendiente:false` y **sin** `peso_pendiente` →
  cargar la línea de porte: `um`, `cantidad`, `precio`, concepto (`P`/`PI`), IVA.
- **`lineas.porte` es `null`**, o **`tarifa_pendiente:true`**, o **`peso_pendiente:true`** →
  **NO abrir "Líneas"**. El albarán queda **Pedido (verde)** y listo. (Confirmado: el aviso
  "¿convertir en albarán?" solo salta al entrar a Líneas; si no se tocan, queda Pedido.)
- **`lineas.indexacion`**: si es objeto con `cargar:false` → es indexación **acumulada**: calcular
  para control pero **no** cargar línea. Si es objeto sin ese flag → cargar la línea
  (`concepto` G/GPT, `cantidad`, `factor`). Si es `null` → **no** hay línea de indexación (precio
  con idx incluida, o Pedido).

### 4. Estado "Pedido" = cargar lo posible y seguir
Cuando el albarán no está completo (código null / `tarifa_pendiente` / `peso_pendiente`):
- Crear el albarán con su cabecera (cliente/puntos/carga/ref/fechas que haya), **sin tocar Líneas**.
- Dejarlo **Pedido (verde)**. No es un error: es un estado válido que el humano completa después.
- Registrar en `resultado.json` qué faltó (campo + motivo).

### 5. KM
- `km.pendiente:true` → **saltear** el formulario de Kilómetros (no inventar). 
- `km.cargar:false` (2ª cisterna de un duotrailer, `cabecera.duo_secundario:true`) → **saltear** km,
  dietas y gastos de ese viaje (ya se contaron en el viaje líder).
- Si no, cargar km del tramo (`inicio`/`fin`/`carga`; `vacio` si viene, para autónomos).

### 6. Números de Gesruta
- El **Nº de viaje** y **Nº de albarán** los **genera Gesruta**: se **capturan de la pantalla** al
  grabar, **nunca** se pre-asignan. Guardarlos en `resultado.json` por albarán.

---

## Qué devolver (`resultado.json`, uno por juego)
Por cada albarán: `{referencia, estado, nro_viaje_gesruta, nro_albaran_gesruta, pendiente_de}` donde
`estado` ∈ `CARGADO` | `PEDIDO`, y `pendiente_de` dice qué falta (p. ej. `"destino"`, `"tarifa"`,
`"peso (D-01)"`) cuando quedó Pedido. Es el espejo del contrato de entrada y cierra el loop al libro
maestro. Ver `ordenes-carga/CONTRATO-resultado-json.md`.

---

## Resumen en una línea
**El bot carga todo lo que puede, deja Pedido lo que no, nunca inventa un dato, nunca abandona el
viaje entero por un solo campo, y reporta qué quedó pendiente.**
