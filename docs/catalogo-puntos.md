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
| `catalogo/semillas-puntos.json` | Semillas manuales (`origen_alta='manual'`): OREMBER→Ourense, AVEIRO (puerto PT, origen), RELISA/DIVERSEY/TEPSA (planta_cargadora), BREDFOR→BRESFOR |
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

## Divergencias con el brief (reales, reportadas)

- **Semilla canónica: NO desde `tarifas`.** No hay tool MCP para leer filas de una
  data table, y `datos/` tiene los **resúmenes** de las exportaciones Gesruta, no los
  CSV crudos. Se siembra desde `datos/resumen-puntos-gesruta.md` — que además es la
  fuente correcta del `id_punto` (el `Cód.Pto.` es la clave que entiende Gesruta).
- **Seed incompleto: 150 de 807 puntos.** El resumen trae solo las primeras 150 filas
  del registro Gesruta. Por eso la cola queda **inflada**: puntos reales como
  VILLAGARCIA o TORDESILLAS caen a la cola solo porque no están en esa muestra. Con el
  CSV completo (`puntos-geograficos.csv`, 807 filas) la cobertura sube mucho.
- **`datos/historico-gesruta.csv` no existe** → el bootstrap sigue sin él (era opcional).

## Cómo re-correr

```
node catalogo/bootstrap-puntos.js     # regenera puntos-alta.json y cola-puntos.json
node --test catalogo/resolver-punto.test.js
```

Última corrida: 151 canónicos (6 manuales + 145 Gesruta), 150 literales cosechados,
32 resueltos automático, 118 a cola, **59.8% del volumen** cubierto automático.

## Pendiente (para cerrar el catálogo)

- Cargar `puntos-alta.json` en la data table `puntos` (hoy la tabla está creada y vacía;
  se carga tras revisar, para no fijar un seed incompleto en producción).
- Subir el `puntos-geograficos.csv` completo (807) para bajar la cola.
- Cablear `resolverPunto` en el auditor (`buscarTarifa`, Encargo 4) y en la ingesta.
- UI de aliases aprendidos en pendientes.
