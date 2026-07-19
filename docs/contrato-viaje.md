# Contrato de datos — Viaje (v0)
JSON que produce la extracción (F2) y consume la validación (F3).
Refleja 1:1 la hoja principal + documentos adjuntos.

## Esquema

```json
{
  "empresa": "TLE | HEC",
  "conductor": {
    "nombre": "string",
    "tipo": "flota | autonomo | proveedor",
    "cabecera_gesruta": "placa 4 dígitos | PROVE"
  },
  "tractora": "placa",
  "semi": "placa",
  "fecha_hoja": "YYYY-MM-DD",
  "tramos": [
    {
      "fecha_carga": "YYYY-MM-DD",
      "carga": { "empresa": "string", "localidad": "string" },
      "fecha_descarga": "YYYY-MM-DD",
      "descarga": { "empresa": "string", "localidad": "string" },
      "km_origen": 0,
      "km_destino": 0
    }
  ],
  "lineas": [
    {
      "cliente": "string (catálogo)",
      "origen": "string",
      "destino": "string",
      "material": "string",
      "referencia_doc": "nº albarán / CMR / mail",
      "fecha_carga": "YYYY-MM-DD",
      "porte": "P | PI",
      "cantidad_tn": 0.0,
      "precio": {
        "modo": "peso_tarifa | acordado",
        "tarifa_origen_destino": 0.0,
        "importe": 0.0
      },
      "iva_pct": 0,
      "indexacion": { "tipo": "G | GPT", "pct": 0.0 }
    }
  ],
  "gastos": [
    { "tipo": "viatico | gasoil | hospedaje | lavado | otro", "importe": 0.0 }
  ],
  "documentos_fuente": ["hoja_principal", "albaran", "cmr", "hoja_carga", "mail"]
}
```

## Reglas de cálculo

| Regla | Detalle |
|---|---|
| km cargados | `km_destino − km_origen` por tramo |
| km vacíos | `km_origen (tramo actual) − km_destino (último viaje anterior de la MISMA tractora)` — requiere estado persistente por tractora |
| Precio por peso | mínimo facturable **23 tn**; tarifa según planilla cliente + origen-destino |
| IVA | según porte P (nacional) / PI (internacional) |
| Indexación | `G` nacional, `GPT` Portugal; % según planilla por cliente + fecha |
| Gastos | solo conductores de flota (TLE/HEC); autónomos: solo km cargados/vacíos |
| Facturación HEC→TLE | HEC factura su flota a TLE (viaje interno, no cliente final) |

## Validaciones (F3)
1. Cliente, origen, destino y material existen en catálogo maestro.
2. Placa tractora/semi coherente entre hoja principal y albarán/CMR.
3. `cantidad_tn ≥ 23` cuando `modo = peso_tarifa` (si no, alertar, no bloquear).
4. Tarifa e indexación resueltas desde planillas por cliente + fecha; si no hay match → estado `revision_humana`.
5. km cargados > 0 y coherentes con la ruta (tolerancia configurable).
6. Autónomo con gastos cargados → alerta (no corresponde).

## Estado persistente
- **Tabla `viajes`**: un registro por viaje con el JSON completo.
- **Tabla `ultimo_km_tractora`**: placa → km final del último viaje. Sin esto no hay km vacíos automáticos.
- **Tabla `tarifas`** y **tabla `indexacion`**: planillas del cliente, cargadas como datos, nunca en Git.

## Salida F3 — "Línea Gesruta"
Texto plano en el orden exacto de tipeo:
1. Empresa → 2. Cabecera (placa/PROVE) → 3. Por albarán: cliente, origen, destino, material, referencia, fecha carga → 4. Porte + cantidad + IVA → 5. Indexación (G/GPT + %) → 6. Gastos (solo flota) → 7. km cargados / km vacíos.
Más: propuesta de archivo (carpeta cliente/destino) y flag de facturación (quincenal / Foresa-metanol mensual).
