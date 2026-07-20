# Contrato de datos — Viaje (v1)
Supera a `contrato-viaje.md` (v0). Corregido contra documentación real (hoja Asensi 2498KZL,
semana 09–16/07/2026) y planillas reales de tarifas e indexación.

## Corrección estructural principal

La **hoja principal NO es un viaje: es una semana de un chofer con N viajes independientes**,
cada uno de cliente distinto. La hoja de Asensi contiene tres viajes de tres clientes
diferentes (Foresa, Quimidroga, RNM) con tres documentos de respaldo distintos.

Consecuencia: se elimina la separación `tramos[]` / `lineas[]` de la v0. Cada bloque de la
hoja es **un viaje completo** (ruta + km + carga + documento). Un envío al formulario produce
**una hoja → N viajes**, cada uno se valida, tarifica y archiva por separado.

## Esquema v1

```json
{
  "empresa": "TLE | HEC",
  "conductor": { "nombre": "string", "tipo": "flota | autonomo | proveedor" },
  "tractora": "placa",
  "semi": "placa",
  "viajes": [
    {
      "orden": 1,
      "fecha_carga": "YYYY-MM-DD",
      "cliente_hoja": "texto tal como lo escribio el chofer",
      "cliente": "normalizado contra catalogo",
      "origen": "string",
      "destino": "string",
      "pais_origen": "ES | PT | FR | otro",
      "pais_destino": "ES | PT | FR | otro",
      "material": "string",
      "fecha_descarga": "YYYY-MM-DD",
      "cantidad_kg_hoja": 0,
      "cantidad_kg_documento": 0,
      "referencia_doc": "albaran / CMR / guia",
      "tipo_doc": "albaran | cmr | guia | orden_transporte | mail",
      "km_inicio": 0,
      "km_final": 0,
      "km_cargados": 0,
      "km_vacios": 0,
      "porte": "P | PI"
    }
  ],
  "gastos": [ { "tipo": "dieta | gasoleo | peaje | lavado | otro", "importe": 0.0, "forma": "efectivo | credito" } ],
  "observaciones": "string"
}
```

## Reglas de cálculo (corregidas)

| Regla | Detalle |
|---|---|
| km cargados | `km_final − km_inicio` del propio viaje |
| **km vacíos** | `km_inicio(viaje N) − km_final(viaje N-1)` **dentro de la misma hoja**. Solo el **primer** viaje de la hoja necesita la tabla `ultimo_km_tractora`. Corrección importante respecto de v0: en la mayoría de los casos el dato está en la propia hoja. |
| Cantidad a facturar | **la del documento de origen** (albarán/CMR), no la de la hoja ni la de báscula de destino. Ver discrepancias abajo. |
| Mínimo facturable | 23 t (Foresa; salvo apartado Origen Bresfor y salvo acuerdo expreso) |
| Porte | PI si `pais_origen ≠ pais_destino` o alguno ≠ ES |
| Indexación | suplemento gasóleo: % según **grupo de cliente + rango de fechas** (ver tabla `indexacion`) |

## Tarifas — tres modelos distintos conviviendo

Hallazgo: cada cliente tarifica con una lógica diferente. La tabla `tarifas` debe soportar las tres.

| Cliente | Modelo | Clave de búsqueda |
|---|---|---|
| **Foresa** | €/t por **provincia de destino**, con excepciones por cliente final, tabla Galicia, tabla Portugal, tabla Retornos y apartado Origen Bresfor | provincia o cliente final |
| **Quimidroga** | €/t por **par ciudad origen → ciudad destino**, con vigencia desde/hasta y unidad (TONELADAS o UNIDADES) | origen + destino + fecha |
| **RNM** | **€/viaje Y €/tonelada** en la misma fila | origen + destino |

Columnas de la tabla `tarifas` (n8n, nunca en Git):
`cliente, pais_origen, ciudad_origen, pais_destino, ciudad_destino, provincia_destino, cliente_final, unidad, precio_ton, precio_viaje, minimo_tn, vigente_desde, vigente_hasta, notas`

Columnas de la tabla `indexacion`:
`grupo, desde, hasta, pct` — grupos reales: `FORESA-BRESFOR`, `HELM`, `QUIMIDROGA`, `OTROS`, `AGENCIA`, `AUTONOMOS`.
La resolución es: cliente → grupo → fila cuyo rango contiene la fecha de carga.

Tabla nueva `facturacion_reglas` (detectada en INSTRUCCIONES_ENVIO_FACTURACION):
`cliente, tipo_servicio, periodo, tipo_envio, emails, requiere_excel`
Facturación no es "quincenal salvo Foresa metanol": Foresa tiene **cinco regímenes distintos**
según tipo de servicio (metanol Villagarcía-Caldas mensual; metanol Villagarcía-Otros quincenal;
destino Orember quincenal **con Excel obligatorio**; retornos quincenal o mensual; general quincenal).
Bresfor: quincenal con entrega por correo postal.

## Validaciones (v1)

1. Cliente normalizado existe en catálogo. El chofer escribe abreviado y con faltas (`FORESA`, `TEPSA`, `RNM`, `AUCTRO`, `RES 2090`) → el normalizador debe tolerarlo.
2. **Cruce de cantidad**: hoja vs documento de origen vs báscula de destino. Si difieren, marcar y usar la del documento de origen.
3. Placa tractora/semi coherente entre hoja y documento. Caso real detectado: hoja de Marcos declara remolque `R-7749300` y los albaranes del mismo día alternan `PO01372R` y `R7749BDB`.
4. Tarifa resuelta para el par origen-destino en la fecha. Si no hay fila → `revision_humana`, **nunca inventar precio**.
5. Indexación resuelta por grupo + fecha. Si el cliente no tiene grupo asignado → `revision_humana`.
6. Autónomo con gastos → alerta.
7. km cargados > 0; km vacíos ≥ 0 (si negativo, el chofer anotó mal o falta un viaje intermedio).

## Salida — una línea Gesruta por viaje
Empresa → cabecera (placa/PROVE) → por viaje: cliente, origen, destino, material, referencia,
fecha carga → porte + cantidad + IVA → indexación (G/GPT + %) → gastos (solo flota) →
km cargados / km vacíos. Más: importe calculado, carpeta de archivo y régimen de facturación aplicable.
