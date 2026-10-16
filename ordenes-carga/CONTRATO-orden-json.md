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
- `km`: `{ inicio, fin, carga, vacio? }` como enteros string, sin separador de miles. `carga` =
  fin − inicio. Para chofer **propio** el vacío lo calcula el bot en pantalla; para **autónomo**
  va explícito en `vacio` (sale de la ficha) porque sus km se cargan en *Gastos*, no en el
  formulario Kilómetros.
- `tarifa_pendiente`: `true` → solo cabecera + km, Estado "Pedido" (sin líneas). `false` normal.

## Cabecera — campos extra

- `cabecera.tipo`: `"propio"` | `"autonomo"`. Autónomo (hoy Fraga, Alfonsín, Abal) → km en
  *Gastos*, sin viáticos; la orden trae `km.vacio` por albarán.
- **A futuro** (ver `docs/flujos-carga.md`): `empresa` (TLE/THEC/PROVE + `proveedor`),
  `viaje_tipo` (convencional/metanol/frigo) y `gastos`. Todavía NO implementados; hoy solo
  flujo convencional TLE.

## Reglas de seguridad para el bot

- Todo `esperado` es para VERIFICAR contra lo que muestra Gesruta; si no coincide, parar.
- `destino.codigo: null` o `tarifa_pendiente: true` → no cargar líneas de ese albarán.
- `_bloqueo` (string) explica por qué un albarán no es cargable aún.
