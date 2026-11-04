# Contrato `orden.json` — salida de la etapa 1 (extracción) para el bot de carga

La etapa 1 (Claude en la nube: lee fichas + docs, aplica reglas, resuelve códigos)
produce este JSON. La etapa 2 (bot Python local) lo lee y carga en Gesruta por
pantalla. Este archivo es el "contrato" entre las dos. Confirmado con Julio 2026-10-14.

## Estructura

```
{
  "empresa": "TLE" | "THEC",
  "viajes": [                      // varios viajes en continuo (una o varias fichas)
    {
      "cabecera": {
        "cabeza": "4916",          // código tractora = matrícula sin letras
        "verificar": { "matricula": "4916NJG", "remolque": "R1783BBJ", "chofer": "JOSE CARLOS ALFONSIN" }
        // matrícula y remolque COMPLETOS y correctos. El bot se encarga de buscarlos:
        // la extracción NO explica cómo buscar ni manda fragmentos (criterio Julio 2026-10-14:
        // cuanto más estándar y simple, menos puntos de fallo). SIN objeto "buscar".
      },
      "albaranes": [ { ...albarán... } ]
      // REGLA: cada viaje = UNA tractora + UN remolque. Si en la ficha cambia la tractora
      // o el remolque, se parte en un viaje nuevo (Gesruta crea otro viaje para las
      // matrículas nuevas), aunque el odómetro corra continuo.
    }
  ]
}
```

## Campos del albarán

- `cliente`: `{ "codigo", "esperado" }` — código Gesruta + razón social para verificar.
- `origen`: `{ "codigo", "esperado" }` — **por código**, igual que destino (Caldas=1,
  Barcelona=B, Aveiro=AVEIR). El bot borra el autocompletado y escribe el código (FORESA
  autocompleta Caldas=1; se reescribe igual).
- `destino`: `{ "codigo", "esperado" }`. Si el punto no existe en Gesruta → `codigo: null`
  (ver `_bloqueo`; con `tarifa_pendiente: true` se carga como Pedido en cuanto haya punto).
- `carga`: `{ "codigo", "esperado" }` — **siempre por código** (catálogo completo en
  `datos/gesruta/materiales.csv`). Si no hay código, se reporta, no se inventa (el buscador
  por nombre tampoco lo encontraría).
- `referencia`: string.
- `salida` / `llegada`: `dd/mm/aaaa` (fecha de carga / descarga reales de la ficha).
- `lineas.porte`: `{ um: "TN"|"UN", cantidad, precio, concepto_esperado: "P"|"PI", iva_esperado }`.
  Números con **coma decimal** y punto de miles (`"1.561,30"`). Los kg no van. UN = precio
  fijo con cantidad "1".
- `lineas.indexacion`: `null` si no aplica; si aplica `{ concepto: "G"|"GPT", cantidad, factor, cargar? }`
  donde `cantidad` = importe del porte y `factor` = factor de la quincena. Conceptos: **solo
  G (nacional) o GPT (internacional)**. `cargar` (opcional, default `true`): si es `false`, el
  importe se conoce (queda para control de totales) pero el bot **NO** carga la línea por albarán;
  esa indexación se acumula en facturación (p.ej. FORESA Caldas→Orember, metanol).
- `km`: `{ inicio, fin, carga, vacio?, cargar? }` como enteros string, sin separador de miles.
  `carga` = fin − inicio. Para chofer **propio** el vacío lo calcula el bot en pantalla; para
  **autónomo** va explícito en `vacio` (sale de la ficha) porque sus km se cargan en *Gastos*.
  `cargar` (opcional, default `true`): si es `false`, **el bot NO carga el formulario de km de ese
  viaje** (los km ya se cuentan en el viaje emparejado; ver `duo_secundario`).
  `pendiente` (opcional, default `false`): si es `true`, el dato de km no está listo → **el bot
  saltea el formulario de km** (propio) y **no carga los km en Gastos** (autónomo); queda pendiente.
- `tarifa_pendiente`: `true` → solo cabecera, Estado "Pedido" (sin líneas). `false` normal.
- `peso_pendiente` (opcional, default `false`): `true` → el peso/importe no está confirmado →
  **no se abre Líneas**, el albarán queda **Pedido** (verde). Igual que `tarifa_pendiente` a efectos
  de no cargar líneas.

## Conducta resiliente del bot (Julio 2026-11-03)

Un campo faltante en **un** albarán **nunca** abandona el viaje entero. Reglas:
- **Cabecera (matrícula/chofer):** único caso que justifica saltear un viaje. Si no se puede crear,
  se saltea ese viaje (queda `estado: abortado` en el resultado) y **los demás viajes siguen**.
- **Cada albarán:** cargar siempre la cabecera con lo que haya (cliente/origen/destino/carga/ref/
  fechas). Si un `codigo` viene `null`, no inventar: se carga lo que esté y el albarán queda Pedido.
- **Líneas:** se abren y cargan **solo** si `porte` es objeto y no hay `tarifa_pendiente` ni
  `peso_pendiente`. Si `porte` es `null`, o `tarifa_pendiente`, o `peso_pendiente` → **no** se abre
  Líneas: queda **Pedido** (verde). Indexación `cargar:false` = acumulada (no se carga línea);
  `null` = sin línea.
- **KM:** `pendiente:true` o `cargar:false` (2ª cisterna duo) → saltear el formulario / Gastos.
- Nº de viaje/albarán: capturados de pantalla, nunca pre-asignados.
- El `resultado.json` reporta por albarán `estado` (`CARGADO`/`PEDIDO`) y `pendiente_de` (ver
  `CONTRATO-resultado-json.md`).

En una línea: **carga todo lo que puede, deja Pedido lo que no, nunca inventa un dato, nunca abandona
el viaje por un campo, y reporta qué quedó pendiente.**

## Cabecera — campos extra

- `cabecera.tipo`: `"propio"` | `"autonomo"`. Autónomo (hoy Fraga, Alfonsín, Abal) → km en
  *Gastos*, sin viáticos; la orden trae `km.vacio` por albarán.
- `cabecera.duo_secundario`: `true` en el **2º viaje de un DUOTRAILER** (una tractora arrastra 2
  cisternas en el mismo viaje físico → 2 viajes en Gesruta, uno por matrícula). El 2º viaje lleva
  su **cabecera + albarán + líneas (porte/idx propios de su cisterna)**, pero el bot **SALTEA lo del
  tramo compartido**: formulario de km (viene con `km.cargar:false`) y **viáticos/gastos/dietas**
  (van una sola vez, en el viaje líder). Así el km y las dietas NO se duplican.
- `cabecera.proveedor` (fichas **THEC/PROVE**, Julio 2026-11-04): código del proveedor (THEC = `"5"`).
  Cuando la ficha es THEC (`empresa: "THEC"`, o `cabecera.proveedor` presente, o `cabecera.cabeza:
  "PROVE"`), **cambia SOLO la cabecera** de "Entrada de Viajes":
  - **Cabeza** = se escribe la palabra `PROVE` (no el código de tractora; no autocompleta).
  - **Matrícula tractora** (al lado) = la matrícula COMPLETA (de `verificar.matricula`).
  - **Remolque**: código vacío; **Matrícula remolque** (al lado) = la COMPLETA (de `verificar.remolque`).
  - **Proveedor** = el código (`"5"` THEC). Sin chofer en la cabecera.
  - De ahí en más, albaranes normales. (Existe también perfil de Estévez Casal — pendiente.)
- **A futuro** (ver `docs/flujos-carga.md`): `viaje_tipo` (convencional/metanol/frigo) y `gastos`.
  Todavía NO implementados.

## Reglas de seguridad para el bot

- Todo `esperado` es para VERIFICAR contra lo que muestra Gesruta; si no coincide, parar.
- `destino.codigo: null` o `tarifa_pendiente: true` → no cargar líneas de ese albarán.
- `_bloqueo` (string) explica por qué un albarán no es cargable aún.
