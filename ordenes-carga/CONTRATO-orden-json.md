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

## Albarán CLAVO (FRIGOS) — facturación POR KM (Julio 2026-11-06)

CLAVO FOOD FACTORY (cliente `4`) se factura **por kilómetro**, no por TN. El albarán trae
`facturacion: "km"` y estos campos propios (detalle en `docs/cliente-CLAVO-frigos.md`):

- `facturacion`: `"km"` — marca el modo (el bot lo trata distinto al porte por TN).
- `sentido`: `"S"` (salida) | `"R"` (retorno) | `"U"` (ruta fija Reinosa) | `"C"` (cercanías).
  Lo **deriva el armador** de origen/destino/km (no hace falta leerlo): determina la tarifa.
- `lineas.porte`: para `S`/`R` → `{ um: "TN", cantidad: <km>, precio: <€/km>, concepto_esperado:
  "P", iva_esperado: "21" }`. **La `cantidad` son los KM** (Gesruta muestra la UM como `TN`, es
  cosmético); el **Importe lo calcula Gesruta** = cantidad × precio. Para `U`/`C` → importe fijo
  (`um: "UN"`, `cantidad: "1"`, `precio: <fijo>`).
- `lineas.indexacion`: **agregada como FORESA** → `{ concepto: "G", cantidad: <importe del porte>,
  factor: <% mensual|null>, cargar: false }`. `cargar:false` ⇒ el bot **NO** carga la línea por
  albarán; la indexación se cierra en facturación. `factor:null` = el % del mes aún no se sabe.
- **Multi-punto → campos separados:** varias **cargas** → `origen` = 1er punto, `origenes` = lista,
  **`campo1`** = esa lista abreviada (≤19 car.) → campo **Campo1** de Gesruta. Varios **repartos** →
  `destino` = último punto, `destinos` = lista, **`campo2`** = esa lista abreviada → campo **Campo2**
  de Gesruta. Las listas `origenes`/`destinos` dan los nombres completos (col Origen/Destino del
  Excel, unidos con `+`). CLAVO **NO** lleva línea `reparto`/`REP`.
- `km`: 1 apunte por viaje → `{ inicio, fin, carga, vacio }` (`carga` = km total con carga = la
  `cantidad` del porte). Es el formulario **Kilómetros** de Gesruta.
- THEC (chófer de THEC en un viaje CLAVO) → **perfil THEC de Gesruta**: `empresa:"THEC"`, cabecera
  **normal** (cabeza = código de tractora, **sin** `proveedor`), km normales. **NO** usa PROVE
  (corrección Julio 10/11; PROVE sigue sólo para los clientes químicos). El armador lo fuerza solo.

## Conducta resiliente del bot (Julio 2026-11-03; aclarado 2026-11-05)

La resiliencia opera a **nivel de línea/dato**, NO a nivel de los datos básicos del viaje. Hay que
distinguir TRES casos (Julio 2026-11-05):

1. **Datos básicos del viaje — cabecera de "Entrada de Viaje"** (matrícula tractora / remolque /
   chofer): si NO coinciden o NO se cargan, el viaje **SE ABORTA** (fallar ruidoso). Es lo correcto:
   un viaje sin sus datos básicos no se puede facturar. Es el **único** caso que saltea un viaje; el
   bot deja `estado: abortado` y **sigue con los demás viajes**. (Confirmado en vivo: remolque que no
   coincidía → abortó bien; se corrigió la matrícula en Gesruta y cargó.)

2. **Dato puntual faltante DENTRO de una línea** (tarifa/precio, cantidad/TN, factor de indexación),
   **sin** flag de pendiente: la línea **SÍ se carga**, completando lo que haya y dejando **SOLO** ese
   campo vacío. **No** es Pedido (queda `estado: CARGADO`); el campo faltante se reporta en
   `pendiente_de` (`precio_porte` / `cantidad_porte` / `factor_indexacion`) para completarlo luego.

3. **Albarán no cargable por diseño** → **Pedido** (verde, sin abrir Líneas): `tarifa_pendiente`,
   `peso_pendiente`, `porte` null, o destino sin código. Indexación `cargar:false` = acumulada (no se
   carga línea); `null` = sin línea.

- **KM:** `pendiente:true` o `cargar:false` (2ª cisterna duo) → saltear el formulario / Gastos.
- Nº de viaje/albarán: capturados de pantalla, nunca pre-asignados.
- El `resultado.json` reporta por albarán `estado` (`CARGADO`/`PEDIDO`) y `pendiente_de` (ver
  `CONTRATO-resultado-json.md`).

En una línea: **los datos básicos del viaje mal/ausentes → abortar ese viaje (los demás siguen); un
dato de línea faltante → cargar la línea con ese campo vacío; nunca inventa; siempre reporta lo
pendiente.**

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
