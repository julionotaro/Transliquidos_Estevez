# Encargo a Claude Code — Fase 2: Cruce ficha ↔ documento

> Esta fase construye la pieza que hoy no existe y que bloquea la operación: unir la lectura de la ficha con la lectura de los documentos para producir **viajes consolidados**. Sin esto hay dos mitades sueltas, no un viaje.
>
> **Atención: este encargo corrige un supuesto de modelo que estaba mal en todo el sistema hasta ahora.** Leer §1 antes que nada.

---

## 0. REGLA DE ARRANQUE

1. Inspeccionar el canal ficha real (`WD0q9Ic0oDvUoJwp`) **después del rollback a gpt-4o** — confirmar que Document AI quedó fuera del camino de producción y que el canal lee como antes (5 OK / 9 sobre la ficha de referencia).
2. Leer `docs/decisiones-dominio.md` (D-01 a D-05) y `docs/verdad-de-campo-fichas.md`. Las reglas de negocio de este encargo se apoyan en D-01, D-02 y D-03.
3. Inspeccionar el esquema real de las tablas `viajes` y `documentos` por MCP. No asumirlo desde la doc.
4. Si algo contradice este encargo, **parar y reportar**.

## 1. CAMBIO DE MODELO — leer con atención

Hasta ahora todo el sistema asume **1 bloque de ficha = 1 viaje**. Ese supuesto es incorrecto y hay que corregirlo.

**El modelo real:**

> **El albarán (o documento de origen equivalente) es la unidad facturable. El bloque de la ficha es la declaración del chofer sobre su jornada.**

Un bloque puede representar **N viajes**. Quien define N son los documentos, no la ficha.

### Caso normal (mayoría)
Un bloque = un viaje = un conjunto de documentos (albarán + CMR + carta de porte + ticket, etc., todos del mismo viaje). `cantidad` en la ficha son los **kg**.

### Caso multi-viaje (FORESA Villagarcía → Caldas de Reis, metanol)
Un bloque = **hasta 6 viajes** de la misma ruta, mismo cliente, mismo día.
- En el campo `cantidad` de la ficha el chofer escribe **el número de viajes**, no los kg.
- Cada viaje viene acompañado de **su propio albarán**, con su referencia y sus kg.
- Los km del bloque cubren **la jornada completa** (odómetro del primer viaje al último). No hay km por viaje en ningún documento.

**Nunca un documento cubre varios bloques o viajes.** La relación es siempre 1 documento → 1 viaje.

### Regla de discriminación de `cantidad` — determinista, no adivinanza

```
SI (cliente, ruta) ∈ RUTAS_MULTIVIAJE:
    cantidad = número de viajes
SINO SI cantidad < 100:
    → REVISAR, motivo "posible_multiviaje_ruta_no_registrada"
SINO:
    cantidad = kg
```

`RUTAS_MULTIVIAJE` arranca con una sola entrada: **FORESA, Villagarcía → Caldas de Reis**. Debe ser una lista configurable y fácil de ampliar, no una condición hardcodeada en el medio de la lógica.

**Por qué la red de seguridad del `< 100`:** los pesos siempre están en miles de kg. Un valor de un dígito o dos es imposible como peso. Si otro cliente empieza a hacer multi-viaje en una ruta no registrada, esto lo hace aparecer en el tablero en vez de meter "4 kg" en silencio. Cuando se confirme que esa ruta es multi-viaje, se agrega a la lista y deja de preguntar.

### Reparto de km en el caso multi-viaje

Los N viajes de un bloque multi-viaje recorren **la misma ruta**, así que el total del bloque se reparte entre ellos:

- `km_viaje = km_bloque / N`
- **Marcar el resultado como derivado**, no como leído. Campo tipo `origen_km = 'derivado_de_bloque' | 'leido'`. Si mañana flota analiza consumos, tiene que poder distinguir un km medido de uno repartido. Sin esa marca, en seis meses nadie sabe cuáles son reales.
- **Si no divide exacto:** redondear hacia abajo y asignar el resto al último viaje, para que la suma de los N cierre con el total real del bloque. La regla puede ser otra, pero tiene que ser fija y estar documentada.
- **La duda se propaga:** si el odómetro del bloque quedó en `REVISAR` (baja confianza o guarda de consistencia), los N viajes derivados heredan esa marca. No se puede repartir un número dudoso y que salgan N números confiables.

> Contexto: los odómetros son **control de flota, no facturan**. Esta es la razón por la que el reparto es aceptable. El dato facturable (kg) sale siempre del albarán de cada viaje, según D-01.

## 2. La correlación

### Llave
`matrícula tractora` + `fecha de carga` + `cliente` + `ruta (origen→destino)`.

### Procedimiento
1. Por cada bloque de ficha, determinar cuántos viajes representa (§1).
2. Buscar los documentos que correlacionan por la llave.
3. Agrupar los documentos por viaje: cada albarán/documento de origen define un viaje; el resto de los documentos de ese viaje (CMR, carta de porte, ticket) se adjuntan al mismo.
4. Producir el viaje consolidado: datos del documento como fuente autoritativa, datos de la ficha como control cruzado.

### Precedencia de datos (D-01, no negociable)
- **kg → del documento de origen** (albarán para FORESA, CMR neto para el resto). Nunca de la báscula de destino, nunca de la orden de transporte (es estimación), nunca de la ficha.
- **Si la ficha y el documento difieren en kg → alertar, pero usar el documento.**
- **referencia → del documento**, según la regla por cliente (FORESA: número corto que empieza por 20, nunca el 5030; QUIMIDROGA: "Referencia en factura"; RNM: Nº de Guía; HELM: el que la orden pide; BALTRANSA: nº de ORDEN DE CARGA).
- **km → de la ficha** (los documentos no los traen).
- **gastos (dietas, gasóleo, peajes, lavados) → de la ficha**, es la única fuente.

### Régimen de indexación
Marcar `regimen_indexacion` en cada viaje según D-03 (`linea | agregada_quincenal | agregada_mensual | incluida`). **No calcular la indexación acá** — se resuelve en el cierre de facturación. Cualquier intento de cerrarla en la ingesta está mal planteado.

## 3. Estados y pendientes

**Un solo estado para todo lo incompleto:** `PENDIENTE_DOCUMENTACION`, con un campo que detalle **qué falta** y **a quién se le reclama**.

| Situación | Qué falta | Reclamar a |
|---|---|---|
| Ficha (bloque) sin ningún documento | los documentos del viaje | chofer / cliente cargador |
| Bloque multi-viaje declara N, llegaron M < N | los albaranes faltantes | cliente |
| Documento sin ficha | la ficha | chofer (o simplemente no se escaneó todavía) |

Reglas:
- Un viaje en `PENDIENTE_DOCUMENTACION` **no factura**, pero **se archiva igual**. El archivo no espera a la facturación.
- El bloqueo es **por viaje**, no por ficha entera. Los otros bloques de la misma ficha siguen su curso normal.
- **Mostrar la antigüedad** del pendiente. Un documento sin ficha de ayer es normal; de hace tres semanas es una ficha perdida. La antigüedad reemplaza la necesidad de estados distintos.
- Todo pendiente debe ser visible para que alguien reclame lo que falta. No hay pendientes silenciosos.

## 4. Audit trail

Cada campo del viaje consolidado debe registrar de dónde salió: qué documento, qué página, o qué bloque de ficha. Cuando una factura se discuta con un cliente, hay que poder señalar el papel exacto.

## 5. Tests

- **Caso normal:** 1 bloque + su conjunto de documentos → 1 viaje consolidado, kg del documento, km de la ficha.
- **Discrepancia de kg:** ficha dice 23.140, albarán dice 23.100 → viaje usa 23.100 **y** queda alerta registrada (D-01).
- **Multi-viaje FORESA:** bloque con `cantidad=6` en Villagarcía→Caldas + 6 albaranes → 6 viajes, cada uno con los kg de su albarán, km repartidos y marcados como derivados, suma de km = total del bloque.
- **Multi-viaje parcial:** `cantidad=6` pero llegan 4 albaranes → 4 viajes consolidados + `PENDIENTE_DOCUMENTACION` señalando que faltan 2.
- **Red de seguridad:** bloque de otro cliente con `cantidad=4` → REVISAR con motivo `posible_multiviaje_ruta_no_registrada`, **no** se interpreta como 4 kg.
- **Ficha sin documentación:** bloque sin documentos → `PENDIENTE_DOCUMENTACION`, no factura, se archiva, aparece en el listado con su antigüedad. Los demás bloques de la misma ficha no se ven afectados.
- **Documento sin ficha:** queda como pendiente con su antigüedad, sin romper la ingesta.
- **Propagación de duda:** odómetro de bloque en REVISAR + multi-viaje → los N viajes derivados heredan REVISAR.
- **Reparto no exacto:** km_bloque=895, N=6 → seis valores enteros cuya suma es exactamente 895.
- **Régimen de indexación:** FORESA Villagarcía→Caldas marca `agregada_mensual`; BALTRANSA marca `incluida`; caso general marca `linea`.
- No regresión: la lectura de ficha y la de documentos siguen funcionando igual.
- `node --test` / runner verde. `npm run check` al día.

## 6. Commit

```
feat(cruce): correlacion ficha-documento con modelo albaran = unidad facturable

Corrige el supuesto "1 bloque = 1 viaje": un bloque puede representar N viajes
(FORESA Villagarcia-Caldas), y son los albaranes los que definen N. Regla
determinista para el campo cantidad (viajes vs kg) con red de seguridad para
rutas multiviaje no registradas. Km de bloque repartidos y marcados como
derivados. Precedencia de datos segun D-01: kg del documento de origen, nunca
de la ficha ni de la bascula. Estado unico PENDIENTE_DOCUMENTACION con detalle
de que falta y antiguedad. Audit trail por campo.
```

## 7. Verificación manual

Con el PDF real de las 3 fichas + sus documentos:

1. Contar viajes consolidados y compararlos con la realidad de esas fichas.
2. Confirmar que los kg salen del documento, no de la ficha, en todos los casos.
3. Confirmar que los pendientes (si los hay) están identificados con qué falta y a quién reclamar.
4. Verificar el audit trail: tomar un viaje al azar y confirmar que cada campo señala su origen.
5. **Si hay una ficha real con caso multi-viaje FORESA disponible, probarla.** Si no la hay, decirlo — es el caso que más riesgo tiene de estar mal implementado sin datos reales, y conviene marcarlo como no verificado antes que darlo por bueno.

> Purgar filas de prueba antes de correr (por UI, no hay tool de borrado).

## 8. Fuera de alcance

- Calcular la indexación (se resuelve en el cierre de facturación, D-03).
- El archivo en Drive con reglas de orden y deduplicación (Fase 3).
- El tablero de pendientes como interfaz (Fase 4) — este encargo produce los datos, no la pantalla.
- Retomar Document AI o calibrar km_final (deuda anotada para v2 de lectura).
- Tocar el validador de facturas.
