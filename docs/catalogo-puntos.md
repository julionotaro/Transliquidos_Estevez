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

## Fuente del seed y estado (actualizado)

- **Semilla primaria: `datos/tabla-traduccion-puntos.md`** — el cruce (hecho por el
  chat de diseño) de los 214 puntos usados contra el catálogo Gesruta de 807:
  **emparejan al 100% por nombre exacto**, con su `Cód.Pto.` real (= `id_punto`, lo
  que teclea el robot). No hay cola de *emparejamiento*.
- **La cola residual (93) NO es un fallo del matching.** Son los puntos de menor
  volumen cuyo `Cód.Pto.` no está en el repo (la tabla trae solo el top-30 = ~90%
  del volumen; el resto de los 214 está en el catálogo Gesruta completo, que no se
  sube). Con el volumen que importa, la cobertura automática es **89.8%**.
- **Corrección de datos**: OREMBER (`OR`) y ORENSE (`OU`) son puntos Gesruta
  **distintos**, no alias entre sí. La semilla vieja que los unía se corrigió.
- Duplicados sin resolver (GARNICA/GUADALAJARA/GUARDA/RENTERÍA/SEGOVIA): están en el
  catálogo completo, no en el top-30; Julio los consulta en Gesruta.
- No hay tool MCP para leer filas de una data table; por eso el seed viene de los
  `.md` de `datos/`, no de la tabla `tarifas`.

## Cómo re-correr

```
node catalogo/bootstrap-puntos.js     # regenera puntos-alta.json y cola-puntos.json
node --test catalogo/resolver-punto.test.js
```

Última corrida (seed real, tabla-traduccion-puntos.md): 176 canónicos (30 usados de la tabla con su Cód.Pto. real + 142 del registro + 4 semillas), 150 literales cosechados, 57 resueltos automático, 93 a cola, **89.8% del volumen** cubierto automático.

## Pendiente (para cerrar el catálogo)

- Cargar `puntos-alta.json` en la data table `puntos` (hoy la tabla está creada y vacía;
  se carga tras revisar, para no fijar un seed incompleto en producción).
- Subir el `puntos-geograficos.csv` completo (807) para bajar la cola.
- Cablear `resolverPunto` en el auditor (`buscarTarifa`, Encargo 4) y en la ingesta.
- UI de aliases aprendidos en pendientes.
