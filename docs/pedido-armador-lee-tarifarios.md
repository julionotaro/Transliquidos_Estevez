# Pedido al dev — que el armador lea los tarifarios OFICIALES de cliente

> Pedido del operador de datos al desarrollo (armador). Confirmado con Julio 19/11/2026.
> El operador NO toca el código del armador; deja la capacidad pedida acá (ver `ROLES-Y-HANDOFF.md`).

## Problema

`resolverTarifa()` (`herramientas/armar_orden/armar_orden.js`) hoy consulta, en orden:
**RNM-tarifario (solo RNM) → `datos/n8n-export/tarifas.csv` → `tarifas-confirmadas-julio.json` → analogía.**

**No lee el tarifario oficial de QUIMIDROGA, ni el general, ni el de Q. del Jarama**, que tienen
MÁS rutas que el export n8n. Consecuencia: rutas reales y documentadas salen `tarifa_pendiente` y hay
que parchearlas a mano en el overlay `tarifas-confirmadas-julio.json`.

Caso que lo disparó (19/11): **QUIMIDROGA Barcelona→Vilarinho = 84,68 €/TN** está en el tarifario
oficial Quimidroga (vigente todo 2026) pero NO en `tarifas.csv` → el armador la marcó pendiente. Se
grabó en el overlay como solución interina.

## Qué pedimos

Que el armador lea los **tarifarios oficiales de cliente** (`datos/gesruta/tarifarios/`) además del
export, **generalizando lo que ya hace con RNM** (`cargarTarifarioRNM` en `lib/datos.js`).

| Tarifario | Formato (cabecera) | Notas |
|---|---|---|
| RNM `tarifario-RNM-2026.csv` | `origen;destino;eur_viaje;eur_tn` | ya se lee; usar **€/TN** |
| QUIMIDROGA `tarifario-QUIMIDROGA-2026.csv` | `pais_origen;ciudad_origen;pais_destino;ciudad_destino;um;precio_tn_40;desde;hasta;precio_tn_44` | usar **`precio_tn_40`** (44 solo megacamión); **respetar vigencia `desde`/`hasta`** vs la fecha de carga |
| general `tarifario-general-2026.xls` | Gesruta: `Cliente;Origen;Destino;Carga;Concepto;Precio;U.M.` | cobertura de todos los clientes; **encoding cp850** (verificar); algunas rutas desactualizadas |
| Jarama `tarifario-QUIMICAS-JARAMA-2026.xls` | (ver archivo) | cliente Químicas del Jarama |

## Precedencia (base: README de `datos/gesruta/tarifarios/` — confirmar con Julio)

1. `tarifas-confirmadas-julio.json` — correcciones humanas; **deben poder sobreescribir** un tarifario
   con error (hoy el overlay va DESPUÉS del export; revisar su posición al sumar los tarifarios).
2. Tarifario **de cliente** (RNM / QUIMIDROGA / JARAMA) — *"el de cliente manda sobre el general"*.
3. Tarifario **general**.
4. Export `tarifas.csv`.
5. Analogía confirmada (`tarifa-por-analogia.json`).

Dentro de la ruta: **€/TN por defecto**; precio fijo por viaje solo si la OC lo indica (ya se maneja
en el raw con `precio_fijo`/`um:"UN"`).

## Criterio de aceptación

- `node herramientas/armar_orden/golden_test.js` sigue **verde**.
- El raw `jacobo-grande-mendez-2026-11-13.json` resuelve el albarán **714592** (Quimidroga
  Barcelona→Vilarinho **84,68**) **SIN** la entrada de overlay — y entonces se puede **quitar** esa
  entrada de `tarifas-confirmadas-julio.json` (queda marcada `por: "Julio (tarifario oficial Quimidroga)"`).
- Respeta la **vigencia** Quimidroga: una ruta fuera de la fecha de carga no matchea.
- No rompe RNM (sigue mandando el €/TN del archivo RNM sobre el general, discrepancia Aveiro→Navia).

## Mientras tanto (operador)

Sigo grabando en `tarifas-confirmadas-julio.json` las rutas de **tarifario oficial** que el armador aún
no lee (marcadas `por: "Julio (tarifario oficial <cliente>)"`), para no dejar pendiente una tarifa
documentada. Al implementarse esto, esas entradas se pueden limpiar.
