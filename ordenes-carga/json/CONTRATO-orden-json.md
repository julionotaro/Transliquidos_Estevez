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
        "verificar": { "matricula", "remolque", "chofer" },   // valores esperados para verificar
        "buscar":    { "remolque": "178", "chofer": "JOSE" }  // pocos chars para el buscador
      },
      "albaranes": [ { ...albarán... } ]
    }
  ]
}
```

## Campos del albarán

- `cliente`: `{ "codigo", "esperado" }` — código Gesruta + razón social para verificar.
- `origen`: **solo el nombre** (string). El bot borra lo que haya y lo escribe (FORESA
  autocompleta Caldas; se reescribe igual).
- `destino`: `{ "codigo", "esperado" }`. Si el punto no existe en Gesruta → `codigo: null`
  (albarán no cargable; ver `_bloqueo`).
- `carga`: `{ "codigo", "esperado" }` — **siempre por código** (catálogo completo en
  `datos/gesruta/materiales.csv`). Si no hay código, el buscador por nombre tampoco lo
  encontraría → se reporta, no se inventa.
- `referencia`: string.
- `salida` / `llegada`: `dd/mm/aaaa` (fecha de carga / descarga reales de la ficha).
- `lineas.porte`: `{ um: "TN"|"UN", cantidad, precio, concepto_esperado: "P"|"PI", iva_esperado }`.
  Números con **coma decimal** y punto de miles (`"1.561,30"`). Los kg no van. UN = precio
  fijo con cantidad "1".
- `lineas.indexacion`: `null` si no aplica; si aplica `{ concepto: "G"|"GPT", cantidad, factor }`
  donde `cantidad` = importe del porte y `factor` = factor de la quincena.
- `km`: `{ inicio, fin, carga }` como enteros string, sin separador de miles. `carga` = fin − inicio.
  El vacío entre albaranes lo calcula el bot en pantalla.
- `tarifa_pendiente`: `true` → solo cabecera + km, Estado "Pedido" (sin líneas). `false` normal.

## Reglas de seguridad para el bot

- Todo `esperado` es para VERIFICAR contra lo que muestra Gesruta; si no coincide, parar.
- `destino.codigo: null` o `tarifa_pendiente: true` → no cargar líneas de ese albarán.
- `_bloqueo` (string) explica por qué un albarán no es cargable aún.
