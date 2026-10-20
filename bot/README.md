# Bot de carga en Gesruta — Transliquidos Estévez (TLE)

Etapa 2 del pipeline TLE. Automatiza la **carga** de viajes y albaranes en **Gesruta**
(ERP de escritorio) controlando la pantalla con Python. La **extracción** (etapa 1, genera
`orden.json`) **no vive acá** — está en `ordenes-carga/` y el resto del repo.

> **División de tareas:** el Claude de la nube hace la EXTRACCIÓN (`orden.json`); este bot hace
> la CARGA. El medio de intercambio es este repo (rama `main`).

---

## Qué hace (v1, probado)

- Carga **uno o varios viajes en continuo**.
- **Cabecera:** el usuario escribe el código de tractora (`cabeza`); Gesruta autocompleta
  matrícula/remolque/chófer y el bot **verifica**. Si el remolque no coincide, lo cambia con
  **BUSCAR** (doble clic en el campo código → dígitos → lupa → doble clic en la fila).
- **Albaranes:** referencia, fechas, cliente, origen (se reescribe sobre el autocompletado),
  destino, carga, y **líneas** (porte + indexación, con quita-puntos de miles).
- **Kilómetros (chofer propio):** lee el tacógrafo en pantalla y calcula `carga` y `vacío`;
  las coordenadas del formulario km se **anclan al rectángulo de la ventana** (robusto aunque
  abra corrida).
- Graba cada albarán, **graba el viaje** (foco + F2) y **encadena** al siguiente.
- **En desarrollo** (`gastos_test.py`): choferes **autónomos** (Fraga, Alfonsín, Abal) → sus km
  van en **Gastos** (conceptos KILOMETROS / KILOMETROS EN VACIO), no en el formulario Kilómetros.

## Reglas de oro

- **No inventar, fallar ruidoso.** Ante un dato dudoso, se para y se reporta; nunca se improvisa.
- **No se tocan datos reales de prueba** salvo autorización; no se generan albaranes ficticios en producción.
- **El bot NO teclea ni almacena la clave de Gesruta.** La escribe el usuario a mano. No hay archivo de config con secretos.
- Todo `esperado` del `orden.json` es para **verificar** contra lo que muestra Gesruta; si no coincide, parar.

---

## Cómo se corre

Requisitos: Windows con Gesruta instalado/accesible, Python 3.x y las dependencias de
`requirements.txt` (`pip install -r requirements.txt`).

1. Abrir Gesruta y dejar **"Entrada de Viajes"** en el menú (según el caso).
2. Dejar el `orden.json` a cargar como `orden_actual.json` **junto al script** (ver Interfaz).
3. Doble clic en **`robot_viajes.bat`** (o `python robot_viajes.py`).
4. Revisar **`robot_log.txt`** (se escribe al lado) y la pantalla.

Scripts:

| Archivo | Para qué |
|---|---|
| `robot_viajes.py` / `.bat` | **Bot principal v1**: multi-viaje en continuo. |
| `robot_viaje.py` / `.bat`  | Variante de un solo viaje, multi-albarán (matrículas cargadas a mano). |
| `gastos_test.py` / `.bat`  | **WIP**: prueba de carga de km en *Gastos* para autónomos. |
| `inspector/run_inspect.bat` | Inspector **solo lectura**: vuelca el árbol de ventanas/controles de Gesruta (`gesruta_tree.txt`) y la identidad del ejecutable (`gesruta_identidad.txt`). No teclea ni graba nada. |

---

## Interfaz con la extracción (qué lee / qué escribe)

**LEE** el `orden.json` producido por la etapa 1. Contrato y formato:
`ordenes-carga/CONTRATO-orden-json.md`. Ubicación canónica de cada orden:

```
ordenes-carga/ordenes/<AAAA-MM>/<chofer>/<AAAA-MM-DD>/orden.json
```

> **Hoy (v1):** el bot lee una copia local llamada `orden_actual.json` **junto al script**.
> La lectura directa desde la ruta `ordenes-carga/...` está pendiente de implementar.
> Hay un `orden.ejemplo.json` con la estructura (datos ficticios).

Campos clave del contrato que usa el bot:
- `cabecera.tipo`: `"propio"` | `"autonomo"`. Autónomo → km en *Gastos*; la orden trae `km.vacio` por albarán.
- `km`: `{ inicio, fin, carga, vacio? }`. Propio: el vacío lo calcula el bot (tacógrafo). Autónomo: `vacio` explícito.

**ESCRIBIRÁ (a futuro)** un `resultado.json` en la misma carpeta de la orden, con los Nº de
viaje/albarán que genere Gesruta. El formato lo define la etapa 1. **No implementado todavía.**

---

## Entorno técnico (notas)

- Gesruta corre desde un recurso de red: `\\servidor\WGESRUTA\gesruta.exe` (Plus42, SL). No figura
  como "app instalada" de Windows, por eso el control de escritorio lo engancha por el ejecutable
  `gesruta.exe`.
- UI *owner-drawn*: muchas rejillas (líneas, km, Gastos) no exponen celdas por API; se operan por
  **coordenadas 1920×1080** + verificación por portapapeles.
- Regla de foco: el Tab **selecciona** el contenido del campo (teclear reemplaza); el clic de mouse
  **no** selecciona (teclear agrega). Por eso Origen se reescribe sobre la selección del Tab.

Versión actual: **v1** (`VERSION = "viajes-1"` en `robot_viajes.py`). Ver `CHANGELOG.md`.
