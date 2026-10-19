# Flujos de carga en Gesruta — hoja de ruta

> Especificación de los tipos de trabajo que hay que cargar y CÓMO se cargan en Gesruta.
> Definida por Julio (sesión 2026-10-16). Es la base para evolucionar el extractor y el
> bot de carga. El formato `orden.json` (ver `ordenes-carga/CONTRATO-orden-json.md`)
> tiene que crecer para cubrir estas dimensiones.

## Dimensiones que atraviesan todo

1. **Empresa / titular de la carga:**
   - **TLE** (Trans. Líquidos Estévez) — empresa `0006` en Gesruta.
   - **THEC** (Transportes Hnos. Estévez Casal) — se carga en su propia sesión de Gesruta.
   - **PROVE** (proveedores contratados / THEC cargado desde TLE) — cabecera con código
     **PROVE**, y en el campo *Proveedor* = "Transportes Hnos. Estévez Casal".
2. **Tipo de chofer (solo aplica a TLE):**
   - **Propio** — viáticos en *Gastos*, km en el formulario *Kilómetros*.
   - **Autónomo** (hoy solo 3: **Fraga, Alfonsín, Abal**) — SIN viáticos; los km van en
     *Gastos* (no en el formulario Kilómetros). Su ficha trae km cargados y km vacíos.
3. **Tipo de viaje:** convencional · metanol · frigo. Cambia la fuente de datos, si hay
   carga a Excel además de Gesruta, y qué se pone en el albarán.

---

## 1. Viajes CONVENCIONALES

- **Fuente de datos:** ficha del chofer + documento de transporte.
- **Carga:** solo Gesruta.

| Caso | Cabecera | Albarán | Gastos | Kilómetros |
|---|---|---|---|---|
| **TLE propio** | unidad + chofer | cliente, viaje, tarifas | viáticos | formulario Kilómetros |
| **TLE autónomo** | unidad + chofer | cliente, viaje, tarifas | **km** (no viáticos) | — (van en Gastos) |
| **THEC / proveedor** | **PROVE** + matrícula + chofer; Proveedor = "Transportes Hnos. Estévez Casal" | cliente, viaje, tarifas | — | — |

Es el flujo que ya estamos haciendo (TLE propio y autónomo). Falta el camino THEC/PROVE.

---

## 2. METANOL (FORESA: Villagarcía → Caldas)

- **Fuente de datos:** ficha del chofer + documento de transporte.
- **Carga:** archivo **Excel** + Gesruta.
- **Excel** (TLE y THEC): por día, la cantidad de TN de cada viaje. Máximo **6 viajes diarios**.
- **Gesruta TLE:** cabecera con matrículas + chofer; albarán con cliente, origen, destino,
  carga, **sin referencia**, fecha, y tarifa con la **totalidad de TN cargadas en el día**
  como cantidad (precio auto); km en *Kilómetros*; dietas en *Gastos*.
- **Gesruta THEC:** cabecera **PROVE** + matrículas + chofer; Proveedor = "Transportes Hnos.
  Estévez Casal"; albarán igual (total TN del día, precio auto). **Sin Gastos ni Km.**
- Indexación: esta ruta NO lleva línea de indexación por albarán (se acumula en facturación),
  igual que Caldas→Orember. El importe igual se calcula y guarda (ver regla de indexación).

---

## 3. FRIGOS

- **Fuente de datos:** ficha del chofer + ficha resumen de cargas/descargas.
- **Carga:** archivo **Excel** + Gesruta.
- **Excel** (TLE y THEC): por matrícula → fechas, origen/es, destino/s, km inicial, km final,
  cliente, material, cantidad de pallets.
- **Gesruta TLE:** cabecera con matrículas + chofer; albarán con cliente, origen, destino,
  carga, **sin referencia**, fechas; **orígenes y destinos de máx. 19 caracteres cada uno**
  (si son varios, abreviar); tarifa con los **km cargados del día** como cantidad y precio
  **según lógica de Excel (a revisar)**; km en *Kilómetros*; dietas en *Gastos*.
- **Gesruta THEC:** igual, pero en la sesión de THEC.

---

## GASTOS (a modelar)

Tipos: **lavaderos · gasoil · AdBlue · taller · ITV · dietas/viáticos**. Hoy solo registramos
dietas/viáticos y, para autónomos, km. Falta definir cómo se cargan los demás.

- **Autónomos (Alfonsín, Abal, Fraga) con tractora propia:** sus km van en **Gastos** con los
  conceptos de Gesruta **KILOMETROS** (= `km.carga`) y **KILOMETROS EN VACIO** (= `km.vacio`),
  NO en el formulario Kilómetros. La extracción ya entrega `km.carga`, `km.vacio` y `cabecera.tipo`.

---

## Qué implica para el formato `orden.json` (propuesta, a confirmar)

Para cubrir lo anterior, la orden tendría que llevar (además de lo actual):

- `empresa`: `TLE` | `THEC` | `PROVE` (+ `proveedor` cuando sea PROVE/THEC-desde-TLE).
- `cabecera.tipo`: `propio` | `autonomo` **(ya agregado)**.
- `viaje_tipo`: `convencional` | `metanol` | `frigo`.
- Por albarán, según el tipo: `sin_referencia` (metanol/frigo), `cantidad` = total TN del día
  (metanol) o km del día (frigo), orígenes/destinos abreviados ≤19 car (frigo).
- `km`: para autónomos, `carga` **y** `vacio` explícitos (vienen de la ficha).
- `gastos`: viáticos/dietas, y a futuro lavaderos/gasoil/adblue/taller/itv.
- `indexacion.cargar`: `true|false` (false = importe conocido pero no se carga por albarán).

> Estado: el flujo **convencional TLE (propio/autónomo)** está operativo. **THEC/PROVE,
> metanol y frigos** están documentados aquí pero NO implementados todavía. Priorizar con Julio.
