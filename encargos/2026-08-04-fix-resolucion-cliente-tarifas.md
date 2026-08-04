# Encargo 2026-08-04 — Resolución explícita de identidad de cliente (desbloquea PR #1)

## Contexto

`Tarifas` fue reemplazada en producción con el Excel exportado del sistema (698 filas, rama `claude/recarga-tarifas-excel`, ya ejecutado — es un data table de n8n, no depende de merge de git). El Excel trae razón social completa (`"FORESA IND.QUIMICAS DEL NOROESTE, S.A."`), pero `ficha/tarifas.js` compara `cliente` por igualdad exacta contra códigos cortos (`"FORESA"`, `"RNM"`, etc.). Regresión confirmada por corrida real: 9/9 viajes vivos dan SIN_TARIFA (antes al menos 2/9 resolvían). Esto bloquea el merge del PR #1.

## Decisión de diseño (ya tomada, no se re-discute)

**NO usar matching por fragmento para `cliente`.** El fix de AVEPTO→AZAMBUJA(PT) (fragmentos de 2 chars dando falso positivo) es la prueba de por qué: un fragmento corto puede cruzar dos razones sociales que no tienen relación ("S.A.", "TRANSPORTES" aparecen en decenas de nombres). El fragmento es aceptable para origen/destino (geografía con solapes esperables); NO para identidad de cliente, donde un falso positivo factura a un cliente la tarifa de otro, en silencio.

Esto es consistente con precedente ya establecido en el proyecto: *"NO se usó alias para FORBA — decisión deliberada"* (régimen de indexación) y el patrón *"cliente no reconocido falla ruidoso"* (Fase 2 cruce). La disciplina del proyecto es no adivinar identidad de cliente — acá se extiende la misma disciplina, no se crea una excepción.

## Solución a implementar

1. **Mapa de alias explícito** (código corto ↔ razón social exacta tal como quedó en `Tarifas.cliente` tras la recarga). Formato a elección de Code según lo que ya exista en el repo (data table nueva, o archivo de constantes versionado — lo que sea más consistente con cómo se resuelven otros catálogos del proyecto). Poblalo, como mínimo, con los clientes de los 9 viajes vivos actuales, para que la verificación real sea posible; agregá los demás códigos que encuentres referenciados en el código o en `viajes` que no tengan aún razón social mapeada.
2. **`ficha/tarifas.js`**: resolver `cliente` del viaje → alias → razón social → **match exacto** contra `Tarifas.cliente`. Eliminar cualquier comparación por fragmento o substring sobre esta columna.
3. **Código de cliente sin alias mapeado**: no asignar tarifa a ciegas ni intentar fuzzy-match. Mismo patrón REVISAR ruidoso que ya existe para "cliente no reconocido" — con el valor leído en el motivo, igual que ese patrón.
4. Dejalo estructurado para que sea reusable por otros módulos que en el futuro necesiten resolver identidad de cliente (no lo enterres como constante interna de `tarifas.js` si podés evitarlo — pero no te desvíes a refactor grande, alcanza con que el mapa esté en un lugar claro y con nombre propio).

## Rama

Sobre `claude/planilla-carga-auditoria` (la del PR #1) — ahí vive `ficha/tarifas.js`, y es lo que bloquea ese PR. Commits chicos.

## Tests

- Los 2 casos ya identificados como regresión real: FORESA Caldas de Reis→Teruel y RNM AVEPTO→Porriño deben volver a resolver tarifa.
- Un código de cliente sin alias mapeado → REVISAR ruidoso, no excepción ni silencio.
- Ningún test nuevo debe usar matching por fragmento sobre `cliente`; si alguno de los tests existentes lo asumía, corregirlo.
- Suite completa sigue verde.

## Verificación — corrida real

Re-correr el lookup de la planilla contra los 9 viajes vivos reales (no fixture) tras el fix. Reportá cuántos de los 9 resuelven tarifa ahora vs. antes del reemplazo de `Tarifas`, y confirmá que el/los que siguen en SIN_TARIFA lo están por razón de negocio real (ej. FORESA→Ourense, ya documentado — no por el bug de matching).

## Entrega

Cuando esté verificado, el PR #1 queda desbloqueado para revisión de Julio — no lo mergees vos.
