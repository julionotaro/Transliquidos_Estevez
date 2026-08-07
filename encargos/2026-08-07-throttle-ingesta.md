# Encargo 2026-08-07 — Throttle / batching de páginas en la ingesta (rate limit)

## Contexto

La ingesta de PDFs grandes falla por rate limit del proveedor de visión. En la corrida del
2026-08-07, un PDF de ~11 páginas (los 3 documentos juntos) chocó el límite de 30.000 TPM de
gpt-4o en la página ~10: el workflow manda las páginas casi simultáneas y se pisan dentro del mismo
minuto. No es falta de crédito (Julio tiene saldo) — es **concurrencia**. Subir de a 2 páginas
funciona pero NO es usable; Julio necesita subir el viaje completo de una.

Julio además va a pedir upgrade de tier/TPM en OpenAI (acción suya, en paralelo). Este encargo es la
parte de código: que el pipeline respete el límite sea cual sea, en vez de dispararse todo junto.

## Regla de arranque — inspeccioná primero

1. Localizá en `[ESTEVEZ] Ingesta Viaje` (`WD0q9Ic0oDvUoJwp`) el punto donde se disparan las
   llamadas de visión por página (el loop/split que genera N ítems de rasterización → N llamadas).
   Mirá el código real, no asumas la forma.
2. Confirmá cómo n8n está paralelizando hoy esas llamadas (batch size, concurrencia del nodo HTTP).
3. Tené en cuenta que el modelo de visión puede cambiar en paralelo (encargo de swap a GPT-5). El
   throttle debe funcionar independientemente del modelo — parametrizá el límite, no lo ates a
   gpt-4o.

## Cambios

- Introducir **batching con espera** entre lotes de páginas para no superar el TPM del proveedor:
  procesar en tandas pequeñas, esperar lo necesario entre tandas, reanudar. La forma concreta
  (batch size del nodo HTTP + nodo Wait, o control en el código del loop) la elegís según lo que
  ya exista en el workflow — lo importante es el resultado: un PDF de 11+ páginas se procesa de una
  sola subida sin chocar el rate limit.
- El límite (TPM / páginas por minuto) debe ser un **parámetro configurable**, no un número mágico
  enterrado — Julio va a subir el tier de OpenAI y el throttle debe poder aflojarse sin reescribir.
- Manejo del error de rate limit: si aun así se choca, reintentar con backoff en vez de fallar la
  ejecución entera (hoy la ejecución 664 murió y no guardó nada). Idealmente el viaje se completa
  aunque una página haya tenido que esperar.

## Tests

- Simular/procesar un lote que antes chocaba el límite (11 páginas) y confirmar que completa sin
  error de rate limit.
- Confirmar que el resultado es idéntico a procesar las mismas páginas de a pocas (el throttle no
  cambia QUÉ se extrae, solo el ritmo).
- Parámetro de límite: cambiarlo y verificar que el ritmo cambia.
- Suite existente verde.

## Verificación — corrida real

Procesá los 3 PDFs de prueba juntos (11 páginas) en una sola subida y confirmá que completa sin
rate limit y guarda los 2 viajes. Reportá tiempo total.

## Commit / entrega

- Rama propia, commits chicos. Nodos afectados se despliegan manual (copy-paste + publish); dejá los
  generados listos para el deploy consolidado.
- No abrir PR salvo que se pida.
