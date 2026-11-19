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

---

## Estado — DEV (19/11/2026)

**QUIMIDROGA: IMPLEMENTADO.** El armador lee el tarifario oficial de QUIMIDROGA
(`datos/gesruta/tarifarios/tarifario-QUIMIDROGA-2026.csv`) con `precio_tn_40` y **vigencia
`desde`/`hasta`**. Código: `lib/datos.js::cargarTarifarioQuimidroga` + `armar_orden.js::tarifaQuimidroga`
y la nueva precedencia en `resolverTarifa`. Test: `tarifa-quimidroga.test.js` (4 casos, verde).

**Decisión de precedencia (punto 1, la resolví yo como dev):** el **overlay
`tarifas-confirmadas-julio.json` va al TOPE** (correcciones humanas mandan sobre cualquier tarifario
con error). Orden final:
1. overlay confirmado-julio
2. tarifario de cliente (RNM / QUIMIDROGA, €/TN, con vigencia)
3. export n8n `tarifas.csv`
4. analogía confirmada

Dejé el **export por encima del general** (y el general sin sumar todavía, ver abajo) para **no
regresionar** el golden, que se construyó sobre el export. RNM sigue mandando su €/TN (discrepancia
Aveiro→Navia intacta).

**Aceptación: cumplida.** golden verde; jacobo 714592 (Barcelona→Vilarinho) = **84,68 €/TN**,
`tarifa_pendiente: false`, **sin** la entrada de overlay (la quité: estaba marcada `por: "Julio
(tarifario oficial Quimidroga)"`); vigencia respetada (Espinho 2025 no matchea en 2026); RNM OK.

**PENDIENTE (no bloquea la aceptación):** tarifario **general** (`.xls`, cp850) y **Jarama** (`.xls`).
Necesitan convertir `.xls`→CSV (o un parser) y definir su lugar (el general va DEBAJO del export para
no pisar rutas que ya funcionan). Mientras tanto el operador sigue usando el overlay para esos clientes
(entradas marcadas `por: "Julio (tarifario oficial <cliente>)"`), que se limpian cuando se sumen.
