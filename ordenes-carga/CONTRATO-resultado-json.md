# Contrato `resultado.json` — salida del bot (cierra el loop)

> Lo que el **bot** escribe después de cargar un `orden.json`, para que la **extracción**
> (Claude nube) escriba los Nº de Gesruta en el libro maestro **sin intervención manual**.
> Es el contrato de SALIDA, espejo del de entrada (`CONTRATO-orden-json.md`).
> Dueño del formato de salida: el bot (escritorio). La extracción lo LEE.

## Dónde va (transporte por git — Julio NO es mensajero)

El bot corre **desde el clon del repo** y escribe `resultado.json` (+ el crop `nro_viaje_v<N>.png`)
en la carpeta de la orden que cargó:
`ordenes-carga/ordenes/<AAAA-MM>/<chofer>/<AAAA-MM-DD>/`, y **hace `git add + commit + push` él mismo**
(reusa el git ya configurado en la PC — con credenciales cacheadas para no pedir clave en cada corrida).
La extracción (Claude nube) lo lee de git y actualiza `datos/registro-procesamiento.csv`.

> Decisión 2026-10-23: el **transporte** del resultado va por **git, lo empuja el bot** (no Julio).
> El **número** lo lee Claude del PNG (fiable, falla ruidoso; sin OCR instalado). Un OCR local en el
> bot (template-matching) queda como mejora futura opcional para que el número salga ya como texto.

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
      "nro_viaje_gesruta": "",
      "nro_viaje_crop": "nro_viaje_v1.png",
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
- **Nº de viaje por IMAGEN (la PC no tiene OCR):** al grabar el viaje, el bot captura un recorte
  del Nº y lo guarda como **PNG** (`nro_viaje_v<N>.png`) junto al `resultado.json`, y pone su
  nombre en **`nro_viaje_crop`**. Si Win32 pudo leer el texto, llena `nro_viaje_gesruta`; si no
  (lo normal), lo deja **vacío** y la EXTRACCIÓN abre ese PNG, lee el número de la imagen y lo
  completa. Esto NO es error: `estado` sigue `grabado`. El mismo patrón (`<campo>_crop`) aplica a
  cualquier número que el bot solo pueda capturar como imagen (ej. a futuro `nro_albaran_crop`).
- El bot **no inventa** números: si no hay ni texto ni PNG, deja el Nº vacío + `estado: "error"`.

## Qué hace la extracción al leerlo

Por cada albarán del `resultado.json`: busca en el registro la fila con esa `referencia`,
escribe `nro_viaje_gesruta` / `nro_albaran_gesruta`, pasa `estado_carga` a CARGADO (o lo que
corresponda), y commitea. Así el libro maestro queda completo sin que nadie tipee los números.

**Si `nro_viaje_gesruta` viene vacío y hay `nro_viaje_crop`:** la extracción abre ese PNG (está
junto al `resultado.json`), lee el número de la imagen y lo usa como `nro_viaje_gesruta`. (Claude
lee imágenes; hace de "OCR" sin software instalado en la PC.)
