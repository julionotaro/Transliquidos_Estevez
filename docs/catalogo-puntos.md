# Catálogo canónico de puntos + resolvedor

> Un catálogo único de puntos geográficos con alias, y un **resolvedor** que
> convierte cualquier literal (escrito a mano en ficha o documento) al punto
> canónico que entiende Gesruta. Compartido por ingesta, auditor y (futuro) robot
> Gesruta. §9: el cruce contra bases no es validación, es preparación de la carga.

## Piezas

| Archivo / tabla | Qué es |
|---|---|
| Data table `puntos` (`YjxcHHb5B4hT0RFU`) | Registro canónico en n8n. Columnas: `id_punto` (clave Gesruta), `nombre_canonico`, `alias` (\|-separados), `municipio`, `provincia`, `pais`, `tipo`, `empresa_sede`, `origen_alta` |
| `catalogo/resolver-punto.js` | Módulo puro: `normalizar`, `resolverPunto`, `resolverPuntoDocFicha`, `aprenderAlias`. 12 tests |
| `catalogo/semillas-puntos.json` | Enriquecen por nombre (país/tipo/empresa/alias): AVEIRO (puerto PT, origen), RELISA/DIVERSEY/TEPSA (planta_cargadora), BREDFOR→BRESFOR. **OREMBER NO es alias de Ourense** — son puntos Gesruta distintos (OR vs OU) |
| `catalogo/bootstrap-puntos.js` | Script de una corrida: siembra + cosecha + asigna + encola |
| `catalogo/cola-puntos.json` | **Revisar de arriba hacia abajo.** Literales sin resolver, ordenados por frecuencia |
| `catalogo/puntos-alta.json` | Canónico listo para cargar en la data table |

## El resolvedor (`resolverPunto`)

Cascada estricta; **nunca resuelve en silencio** salvo match exacto:

1. Normalizado == `nombre_canonico` → **alta**
2. Normalizado == un `alias` → **alta**
3. Distancia de edición ≤1 contra **un solo** canónico → **media + REVISAR**
4. Contención de tokens **unívoca** (`CALDAS` ⊂ `CALDAS DE REIS`) → **media + REVISAR**
5. Multi-candidato o sin match → `punto_no_reconocido` + REVISAR, con el **literal textual** en el motivo

`normalizar` descarta ruido: formas societarias (S.A./S.L.), `POL. IND.`, `POLIGONO`,
`PLANTA`, `FABRICA`, `PUERTO DE`/`PTO.` (así `Puerto de Aveiro`→`AVEIRO`).

**Precedencia doc>ficha (§4)** (`resolverPuntoDocFicha`): el documento manda; si
difieren, gana el documento y la corrección queda en el motivo. Solo-ficha resuelve
pero **baja la confianza un escalón** (la ficha es sospechosa).

## Aprendizaje automático de alias (`aprenderAlias`)

Decisión de Julio: los alias se aprenden **automático**, sin cola de aprobación,
cuando el operador corrige un punto. Salvaguardas duras:

1. **Un literal no puede ser alias de dos canónicos.** Si contradice uno existente,
   NO se escribe → conflicto → a `cola-puntos.json`.
2. Todo alias guarda **procedencia** (de qué corrección, cuándo, qué viaje) → reversible.
3. (Pendiente de UI) Informe "Aliases aprendidos esta semana" en la vista pendientes.

## Fuente del seed y estado

- **Semilla primaria: `datos/puntos-214-parte{1,2}.csv`** (`punto;cod_pto;usos`) — los
  214 puntos usados con su `Cód.Pto.` real (= `id_punto`, lo que teclea el robot).
  Son el **destino** de la traducción: los nombres que Gesruta ya tiene cargados.
- **Cola = 1** (solo `FRANCIA`, basura excluida). **99.9% del volumen** resuelto
  automático. El normalizador y la cascada están validados contra dato real.
- **OREMBER (`OR`) y ORENSE (`ORE`/`OU`) son puntos Gesruta DISTINTOS**, no alias.
  Corregido (la semilla vieja los unía).
- **Aviso para la ficha (Encargo 3)**: lo que escribe el chófer NO está en ningún
  dato (nunca se digitalizó). El caso típico — ficha "FORESA" vs punto "CALDAS DE
  REIS" — **no comparte una sola letra**; ningún parecido de texto los une. La vía
  es **cliente + material → punto** (Foresa: METANOL→Villagarcía 418/418;
  COLA/FINCAT/FORMOL→Caldas). La resolución empresa→punto **no se construye todavía**:
  Julio escaneará 30-40 fichas reales primero. El resolvedor no se toca; falta
  alimentarlo.
- Duplicados (GARNICA/GUADALAJARA/GUARDA/RENTERÍA/SEGOVIA): pendientes de Gesruta.

### Correcciones de fichas reales (`datos/alias-fichas-reales.md`, commit `6fd02d6`)

- **OREMBER (`OR`) — alias generosos.** El 2º punto más usado (1.008 viajes) aparece
  escrito de ≥7 formas por los chóferes (`OROMBOR`, `OROMBER`, `ORENBER`, `OREMBEL`,
  `ORENTBER`, `OREMBEA`); **ninguna** pasa el filtro de distancia ≤1. Añadidos a
  `semillas-puntos.json` como alias explícitos. Es planta **FINSA** en Ourense.
- **OREMBER ≠ CELLA — no fusionar.** El grupo FINSA tiene otra planta en **Cella
  (Teruel)** que aparece como destino separado (`FINSA CELLA`, `Cella - Teruel`). Son
  **dos puntos distintos**; desambiguar por localidad (Ourense→OREMBER, Teruel/Cella→
  CELLA). ⚠️ **CELLA no está entre los 214 usados ni cargado**: falta su `Cód.Pto.`
  real de Gesruta (sembrado como pendiente en `semillas`, no resuelve hasta cargarlo).
- **Anleo/Navia — no era discrepancia.** El chófer escribió `Anleo` (parroquia de
  Navia), no Avilés; destino real = `NAVIA`. Alias deseado: `ANLEO → NAVIA`. ⚠️
  **Decisión pendiente de Julio**: el catálogo Gesruta ya tiene un canónico `ANLEO`
  (id `ANLEO`, cargado). Por precedencia (canónico exacto > alias), poner `ANLEO`
  como alias de `NAVIA` sería **inerte** — seguiría resolviendo al punto `ANLEO`. Se
  necesita confirmar si el punto Gesruta `ANLEO` se usa de verdad, o si `Anleo` en
  ficha debe rutear a `NAVIA` vía **override por cliente/ruta** (no un alias). Por eso
  NO se agregó todavía.

## Cómo re-correr

```
node catalogo/bootstrap-puntos.js     # regenera puntos-alta.json y cola-puntos.json
node --test catalogo/resolver-punto.test.js
```

Última corrida (214 puntos, datos/puntos-214-parte{1,2}.csv): 324 canónicos, 150 literales cosechados, **149 resueltos automático, cola = 1** (solo FRANCIA, que es basura excluida), **99.9% del volumen**. El seed completo cierra la cola.

## Pendiente (para cerrar el catálogo)

- Cargar `puntos-alta.json` en la data table `puntos` (hoy la tabla está creada y vacía;
  se carga tras revisar, para no fijar un seed incompleto en producción).
- Subir el `puntos-geograficos.csv` completo (807) para bajar la cola.
- Cablear `resolverPunto` en el auditor (`buscarTarifa`, Encargo 4) y en la ingesta.
- UI de aliases aprendidos en pendientes.
