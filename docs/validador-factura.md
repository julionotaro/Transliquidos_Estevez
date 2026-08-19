# Validador de Factura
Workflow `[ESTEVEZ] Validar Factura` (HvMzL9tlL8OBpGcM). Publicado.
URL: https://studio-julio.duckdns.org/form/validar-factura

## Que hace
Recibe el PDF de una factura ya emitida y la audita ANTES de enviarla al cliente.
Flujo: Form -> extraccion gpt-4o de lineas y conceptos -> auditoria (Code) -> informe.

## Chequeos
1. Importe de cada linea = cantidad x precio.
2. Minimo facturable 23 t (aviso).
3. Matricula presente en cada linea de viaje (error si falta).
4. Indexacion: el % corresponde al rango de fechas del viaje (grupo FORESA-BRESFOR); base = importe de transporte; importe = base x pct.
5. Falta de linea de indexacion en viajes que la requieren (error).
6. Cuadre: suma de lineas vs base imponible; IVA = base x %; total = base + IVA.

## Rangos de indexacion (embebidos, migrar a data table `indexacion` cuando exista)
grupo FORESA-BRESFOR:
- 2026-06-01 a 2026-06-15 = 0.1452
- 2026-06-16 a 2026-06-30 = 0.1279
- 2026-07-01 a 2026-07-15 = 0.1064
- 2026-07-16 a 2026-07-31 = 0.1064

## Pendiente
- Migrar rangos a la data table `indexacion` (grupo, desde, hasta, pct) cuando este creada.
- Anadir grupos QUIMIDROGA, HELM, OTROS.
- Criterio base REPARTOS (D-08).
- Regimenes agregados quincenal/mensual (Caldas-Ourense, Villagarcia-Caldas): hoy el validador asume indexacion por linea; para esos destinos habra que validar el agregado, no la linea.

---

# Auditor v4 (Encargo 4, 2026-08) — alineado al modelo de dominio de agosto

Lógica: `validador/auditar.js` → nodo Code `Auditar` (workflow `IlIod0DlephaLmAV`)
vía `validador/build-nodo.js`. **El generado no se edita a mano.** 26 tests.

## Qué se agregó

**Cliente desde catálogo (CAMBIO 1).** Data table `clientes` (`vnwM306ej7xLqgJs`):
`id_cliente, nombre_canonico, alias, cif, grupo_indexacion, pais, regimen_iva,
ciclo_facturacion`. El **CIF es llave dura** (prioridad sobre el nombre). Cliente
no reconocido en el catálogo **bloquea** `listo_para_pago` (§3, con el emisor
visible) — ya no cae en OTROS con aviso. Sin catálogo pasado, hay fallback legacy
(reglas hardcodeadas) para compatibilidad.

**Contraste factura ↔ `viajes` (CAMBIO 2).** Por línea: sin viaje que la respalde
→ DISCREPANCIA; peso viaje (origen, §4/D-01) vs cantidad facturada >±2% →
DISCREPANCIA; referencia ya facturada en otra factura → **REVISAR** (puede ser
rectificativa legítima, no se marca error a ciegas). **Viaje real no facturado** →
sección informativa, **no** bloquea. Si no hay viajes del período → se **declara**
en el informe ("Contraste contra viajes: no ejecutado").

**Rotaciones Foresa (CAMBIO 3).** En rutas de `RUTAS_MULTIVIAJE` (Villagarcía→Caldas
metanol) no se aplica el mínimo de 23 t (la cantidad puede ser rotaciones, §7). La
lista se pasa por `opts` (el Code node no puede `require` cruce.js).

**Tarifa vía origen (CAMBIO 4).** `buscarTarifa`: origen vacío deja de ser comodín
→ SIN_TARIFA, nunca un match por descarte.

**Reglas de dominio (CAMBIO 5).** BALTRANSA sin línea de indexación a 0 → **error**
(antes aviso, §8). Referencia FORESA que empieza por `5030` (nº interno del albarán)
→ DISCREPANCIA; formato esperado empieza por `20`. IVA por país desde
`clientes.regimen_iva` (RNM PT sin IVA, etc.), no hardcodeado.

## Reglas de dominio incorporadas (decididas/confirmadas)

- Fecha de carga: manda la ficha (excepción a §4) — dato de la ingesta, no del auditor.
- Mínimo 23 t siempre, sobre la **línea facturada**, no por rotación.
- Baltransa: documento "ORDEN DE CARGA" (clasificador no asume "Orden de Transporte").
- Rectificativas: referencia repetida entre facturas puede ser legítima → REVISAR.
- Paralizaciones: solo se listan, nunca se calculan.
- Repartos: 90 € por doble destino, fuera de la base de indexación.
- Ciclo: quincenal general, mensual Foresa metanol (en `clientes.ciclo_facturacion`).

## Lo que está bien y NO se tocó

Tri-estado con SIN_TARIFA bloqueante, `listo_para_pago`, BALTRANSA indexación-a-0 +
IVA 21%, régimen agregado FORESA, cuadre de totales.

## Fuera de alcance (para que el próximo chat no lo re-deduzca)

- **Cargar filas en `clientes`**: la tabla está creada y vacía. Migrar las reglas
  hardcodeadas del fallback legacy a filas es un paso de datos pendiente.
- **Cablear el grafo**: agregar nodos `Leer Clientes` / `Leer Viajes` al workflow
  `IlIod0DlephaLmAV` y que su salida llegue como `input.clientes` / `input.viajes`
  al nodo Auditar. Hasta entonces, CAMBIO 1/2/3/5c-IVA quedan inactivos (degradan a
  []); CAMBIO 4/5a/5b-FORESA ya están activos con solo pegar el nodo.
- **Correlación N2 en el contraste**: hoy el contraste factura↔viaje empareja por
  `referencia`. Integrar la cascada N2 (`correlacion/correlacionar-n2.js`) para
  emparejar cuando no hay referencia es una mejora posterior.
- **Paralizaciones / repartos / rectificativas**: el auditor las lista/avisa; la
  decisión es humana (no hay regla de cálculo).

## Deploy

1. Cargar filas en `clientes` (tabla `vnwM306ej7xLqgJs`).
2. Agregar `Leer Clientes` + `Leer Viajes` al grafo del auditor y mergear su salida al input del nodo Auditar.
3. Pegar `validador/nodo-auditar.generated.js` en el nodo Code `Auditar` y publicar.
4. Verificación: una factura Foresa metanol (sin aviso de 23 t) y una Baltransa (contraste contra viajes).
