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

### 2. Albarán → cargar la cabecera del albarán con lo que haya
Cargar `cliente.codigo`, `origen.codigo`, `destino.codigo`, `carga.codigo`, `referencia`, `salida`,
`llegada`. Si un **`codigo` viene `null`** (no se pudo resolver): **no inventar** — cargar los que sí
están y **dejar vacío solo ese campo** (resiliencia, §3 bis). No abortar el viaje.

### 3. Líneas (porte / indexación / reparto) — cargar TODAS las que la orden traiga
- **`lineas.porte`**: cargar `um`, `cantidad`, `precio`, `concepto_esperado` (P/PI), `iva_esperado`.
- **`lineas.indexacion`** (objeto): cargar `concepto` (G/GPT), `cantidad`, `factor`. Si trae
  `cargar:false` → es **acumulada**: se calcula para control pero **no** se carga la línea. Si es
  `null` → no hay línea de indexación (precio con idx incluida).
- **`lineas.reparto`** (objeto): doble destino → cargar la línea **código `REP`, cantidad 1,
  `precio`** (90 por defecto). Fuera de la base de indexación.

### 3 bis. RESILIENCIA — un dato puntual faltante NO deja el albarán sin líneas
**Regla (Julio 05/11):** cuando falta un dato **puntual** del albarán (la **tarifa**, el **peso/TN**,
el **% de indexación**, o un **código** de punto), se **cargan todas las líneas posibles** y se deja
**vacío SOLO ese campo**. NO se deja el albarán como "Pedido" ni se saltea. En la orden ese dato
viene en `null` y los flags lo señalan:
- **`tarifa_pendiente:true`** → el **`precio`** del porte viene `null` (y la `cantidad` de la
  indexación también): cargar la línea con `um`/`cantidad`/`concepto`/`iva` y **dejar el precio
  vacío**. El humano completa solo el precio.
- **`peso_pendiente:true`** → la **`cantidad`** (TN) del porte viene `null`: cargar `precio`/
  `concepto`/`iva` y **dejar la cantidad vacía**.
- **`factor`/`cantidad` de la indexación en `null`** → cargar el `concepto` y dejar vacío lo que falte.
- **`codigo` en `null`** (destino u otro) → cargar el resto y dejar ese campo vacío.

El **aborto se reserva** para cuando faltan los **datos básicos del viaje** (la cabecera:
matrícula/chófer no cargables, §1). Un dato puntual faltante **nunca** aborta ni deja todo en Pedido.

### 5. KM
- `km.pendiente:true` → **saltear** el formulario de Kilómetros (no inventar). 
- `km.cargar:false` (2ª cisterna de un duotrailer, `cabecera.duo_secundario:true`) → **saltear** km,
  dietas y gastos de ese viaje (ya se contaron en el viaje líder).
- Si no, cargar km del tramo (`inicio`/`fin`/`carga`; `vacio` si viene, para autónomos).

### 6. Números de Gesruta
- El **Nº de viaje** y **Nº de albarán** los **genera Gesruta**: se **capturan de la pantalla** al
  grabar, **nunca** se pre-asignan. Guardarlos en `resultado.json` por albarán.

---

## CLAVO (FRIGOS) — carga POR KM (cliente `4`)

Cuando el albarán trae **`facturacion:"km"`** (cliente CLAVO), la carga es distinta. Todos los
albaranes de la ficha van en **UN viaje** de Gesruta (una ficha = un viaje con N albaranes).

1. **Entrada de Viajes (cabecera):** igual que siempre — cabeza (código tractora) / matrícula /
   remolque / chófer. Si es THEC → **PROVE** (ver arriba). Empresa siempre **TLE (0006)**.
2. **Entrada de Albaranes — línea de porte** (`lineas.porte`):
   - Para `S`/`R`: **Cdgo `P` (PORTES NACIONALES)**, **Cantidad = los KM** (`cantidad`), **UM `TN`**
     (Gesruta lo muestra así aunque sea km — es cosmético), **Precio = €/km** (`precio`), **IVA 21**.
     El **Importe lo calcula Gesruta** (cantidad × precio). NO teclear el importe.
   - Para `U`/`C` (importe fijo Reinosa/cercanías): **`um:"UN"`, Cantidad `1`, Precio = el fijo**.
   - **Origen y Destino por código.**
3. **Multi-punto → Campo1:** si el albarán trae **`campo1`**, escribirlo en el campo **Campo1** de
   Gesruta (son todos los puntos del lado múltiple, abreviados). El campo **Origen** lleva el **1er**
   punto y **Destino** el **último** (ya vienen resueltos por código). Las **Cargas/Descargas** se
   cargan con sus puntos y fechas.
4. **Indexación `cargar:false`** (CLAVO es **agregada**, como FORESA): **NO** cargar la línea de
   indexación por albarán — se cierra en facturación. (Si `factor` viene vacío, igual: no se carga.)
5. **Kilómetros:** **1 apunte por viaje** con **Km carga = `km.carga`** (el total) y **Km vacío =
   `km.vacio`**. (El `km.carga` coincide con la Cantidad del porte.)
6. **NO cargar** dietas, palets, gasoil, AdBlue ni otros gastos (son control interno del Excel).

Todo lo demás (resiliencia por dato faltante, captura de Nº de viaje/albarán, `resultado.json`) es igual.

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
