# Armador de `orden.json` (resolvedor de etapa 1) — Corrida 2

Convierte **hechos crudos** (lo que un humano lee con la vista de la ficha + documentos)
en los `viajes` de un `orden.json` válido, haciendo la parte **determinística**:
resuelve códigos, busca tarifa, calcula indexación y porte, aplica mínimo 23 TN y
formatea los números al estilo ES. **Reusa** los módulos ya testeados del repo; no
reimplementa reglas, las lee. **Nunca inventa** una tarifa: si no hay fila ni analogía
confirmada, marca `tarifa_pendiente` con motivo.

## Correr

```bash
# Golden-test (compara contra un orden.json hecho a mano; debe dar idéntico)
node herramientas/armar_orden/golden_test.js

# Armar una orden desde hechos crudos (imprime, o escribe si das salida)
node herramientas/armar_orden/armar_orden.js herramientas/armar_orden/raw/<juego>.json [salida.json]
```

## Qué reusa (sin reescribir)

| Módulo | Para |
|---|---|
| `ficha/clientes.js` → `resolverCliente` | literal cliente → razón social |
| `catalogo/clientes-gesruta.js` → `codigoCliente` | razón social → código Gesruta |
| `catalogo/resolver-punto.js` → `resolverPunto` | literal punto → código + nombre canónico |
| `ficha/tarifas.js` → `buscarTarifa` | tarifa vigente (tabla `datos/n8n-export/tarifas.csv`) |
| `catalogo/tarifa-por-analogia.json` | cascada por analogía **confirmada** (destino sin fila propia) |
| `ficha/indexacion.js` → `grupoIndexacion`, `buscarPct` | grupo + factor de la quincena |
| `ficha/conductores.js` → `tipoConductor` | propio / autónomo |

## Hechos crudos (entrada) — ver `raw/*.json`

Por viaje: `matricula`, `remolque` (+ `duo_secundario` si aplica). Por albarán:
`cliente_lit`, `origen_lit`, `destino_lit`, `carga_lit`, `referencia`, `salida`,
`llegada` (dd/mm/aaaa), `peso_kg`, `km_inicio`, `km_fin`.

> `destino_lit` lleva el **nombre del punto que porta la tarifa**, ya elegido por el
> humano (p.ej. CURIA SPAIN → `VALLADOLID`). La tarifa de un destino sin fila propia
> (p.ej. `COGERSA`) la resuelve el armador por analogía confirmada (→ ASTURIAS).

## Alcance (deliberado)

**Hace** (determinístico): códigos cliente/punto/material; tarifa por **tabla
(desambiguada por material)**, **tarifario propio de RNM (€/TN)** y **analogía
confirmada**; concepto/IVA e indexación nacional (P/G) / internacional (PI/GPT);
**indexación acumulada** (`cargar:false`) para FORESA Orember / Villagarcía→Caldas metanol;
mínimo 23 TN; porte y formato ES. **Puntos solo con confianza alta** (si no, `null` +
literal, revisar). Albaranes sin tarifa → `tarifa_pendiente` con `porte/indexacion: null`.

**Golden-test verde (`node golden_test.js`)** contra 4 juegos:
`jose-ramon-pineiro/2026-10-14`, `francisco-asensi/2026-10-05`,
`manuel-sabaris/2026-10-02`, `nuno-felipe-silva-paiva/2026-09-30`.

**No hace todavía** (corridas siguientes): leer la ficha (visión), elegir qué nombre de
punto usar ante una dirección cruda o un destino sin tarifa (criterio humano por ahora),
emitir las filas del libro maestro, y las reglas capa-3 **procedurales** (duotrailer,
autónomo en Gastos, FORESTAL precio fijo con idx incluida, BALTRANSA idx-0,
DIVERSEY→BALTRANSA). Cada una entra con su propio golden-test.
