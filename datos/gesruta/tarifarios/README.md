# Tarifarios — fuente de verdad de precios

Subidos por Julio 2026-10-09. **Prioridad: los tarifarios de CLIENTE mandan sobre el general**
(están más actualizados y con más rutas). Dentro de cada ruta, **priorizar siempre €/TN**
salvo que la orden de flete/OC indique un precio fijo por viaje.

## Archivos
- `tarifario-RNM-2026.xlsx` / `.csv` — RNM. Columnas: origen; destino; **€/viaje**; **€/TN**. 61 rutas.
- `tarifario-QUIMIDROGA-2026.xlsx` / `.csv` — QUIMIDROGA. Por ciudad, con **vigencia** (desde/hasta 2026)
  y dos tramos: **€/TN a 40 TN** (normal) y **€/TN a 44 TN** (megacamión, cuando exista). 238 rutas.
- `tarifario-general-2026.xls` — formato Gesruta (Cliente; Origen; Destino; Carga; Concepto; Precio; U.M.).
  Cobertura de todos los clientes, pero **algunas rutas quedaron desactualizadas** (ver abajo).

## Coherencia verificada (2026-10-09)
- QUIMIDROGA Barcelona→Aveiro = **84,68 €/TN** en el archivo Quimidroga Y en el general. ✔ coherente.
- QUIMIDROGA Barcelona→Coruña/Pontevedra = **79,71 €/TN** (zona Galicia). ✔ coherente.
- **DISCREPANCIA — RNM Aveiro→Navia:** general = **900 €/viaje flat** (desactualizado);
  archivo RNM = **40,30 €/TN (927 €/viaje)**. → **manda el de cliente: 40,30 €/TN.**
- RNM en el general está casi todo como €/viaje flat (900, 700…), desactualizado; el archivo RNM
  tiene el €/TN correcto por ruta. Usar SIEMPRE el archivo RNM para ese cliente.

## Regla operativa
1. Cliente con tarifario propio (RNM, QUIMIDROGA) → usar ese archivo.
2. Resto → tarifario general.
3. Dentro de la ruta: €/TN por defecto; fijo por viaje solo si la OC lo indica.
4. QUIMIDROGA: respetar la vigencia (desde/hasta) y usar el tramo de 40 TN (44 TN solo si es megacamión).
