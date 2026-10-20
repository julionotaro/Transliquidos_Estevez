# Contrato `resultado.json` — salida del bot (cierra el loop)

> Lo que el **bot** escribe después de cargar un `orden.json`, para que la **extracción**
> (Claude nube) escriba los Nº de Gesruta en el libro maestro **sin intervención manual**.
> Es el contrato de SALIDA, espejo del de entrada (`CONTRATO-orden-json.md`).
> Dueño del formato de salida: el bot (escritorio). La extracción lo LEE.

## Dónde va

El bot lo escribe junto a la orden que cargó:
`ordenes-carga/ordenes/<AAAA-MM>/<chofer>/<AAAA-MM-DD>/resultado.json`
(o lo deja al lado del script y Julio lo copia ahí). Julio lo pushea a git; la extracción lo
lee y actualiza `datos/registro-procesamiento.csv`.

## Formato

```json
{
  "orden": "ordenes/2026-10-05/pedro-fraga-estevez/2026-10-05/orden.json",
  "empresa": "TLE",
  "corrida": "2026-10-20T17:30:00",
  "bot_version": "viajes-1",
  "viajes": [
    {
      "cabeza": "5358",
      "chofer": "PEDRO FRAGA ESTEVEZ",
      "nro_viaje_gesruta": "123456",
      "estado": "grabado",
      "motivo": "",
      "albaranes": [
        { "referencia": "2029398", "nro_albaran_gesruta": "00050948", "estado": "grabado", "motivo": "" },
        { "referencia": "2029388", "nro_albaran_gesruta": "00050949", "estado": "grabado", "motivo": "" }
      ]
    }
  ]
}
```

## Reglas

- **Llave de cruce:** `referencia` (por albarán) + `cabeza`/`chofer` (por viaje). Con eso la
  extracción encuentra cada fila del registro y le escribe `nro_viaje_gesruta` y
  `nro_albaran_gesruta`.
- **`estado`** por albarán y por viaje: `grabado` | `abortado` | `error`. Si no es `grabado`,
  `motivo` explica por qué (texto corto). Fallar ruidoso: mejor `error` + motivo que un número inventado.
- Un albarán no cargable (tarifa_pendiente, punto faltante) → `estado: "omitido"`, `motivo`.
- El bot **no inventa** números: si Gesruta no mostró el Nº, lo deja vacío + `estado: "error"`.

## Qué hace la extracción al leerlo

Por cada albarán del `resultado.json`: busca en el registro la fila con esa `referencia`,
escribe `nro_viaje_gesruta` / `nro_albaran_gesruta`, pasa `estado_carga` a CARGADO (o lo que
corresponda), y commitea. Así el libro maestro queda completo sin que nadie tipee los números.
