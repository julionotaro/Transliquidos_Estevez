# Throttle / batching de las llamadas de visión — ingesta de viajes

Encargo `encargos/2026-08-07-throttle-ingesta.md`. Documenta **por qué** y
**dónde** se limita el ritmo de las llamadas de visión, y **cómo aflojarlo**
cuando OpenAI suba el tier. No hay cambio de código de nodo Code: el throttle
vive en la configuración del nodo HTTP, y este documento es la fuente de verdad
de esos números para que no queden como "magia enterrada".

## El problema (corrida real 2026-08-07, ejecución 664)

`[ESTEVEZ] Ingesta Viaje` (`WD0q9Ic0oDvUoJwp`) lee las **fichas** manuscritas
una llamada de visión **por página rasterizada** (`Preparar Payload` emite N
ítems `pass:'fichas'`, ver `ficha/nodo-preparar-payload.wrapper.js`). El nodo
HTTP `Extraer GPT-4o` corre una vez por ítem.

Sin throttle, n8n dispara esos N ítems casi en paralelo dentro del mismo minuto.
Un viaje real de 3 documentos = ~11 páginas → ~11 llamadas simultáneas. En la
página ~10 se chocó el límite de **30.000 TPM** de gpt-4o y la ejecución 664
**murió entera sin guardar nada**. No es falta de crédito: es concurrencia.

Subir de a 2 páginas evita el choque pero no es usable — Julio necesita subir el
viaje completo de una sola vez.

## La solución — batching con espera + reintento, en el nodo HTTP

n8n ya trae batching en el nodo HTTP Request (v4.4): en vez de código propio +
un nodo `Wait`, se usa la capacidad nativa del nodo. Configurado en
`Extraer GPT-4o`:

| Parámetro | Ruta en el nodo | Valor | Qué hace |
|---|---|---|---|
| Batch size | `options.batching.batch.batchSize` | **3** | páginas por tanda |
| Batch interval (ms) | `options.batching.batch.batchInterval` | **45000** | espera entre tandas |
| Retry on fail | settings → Retry On Fail | **on** | reintenta el ítem que falla |
| Max tries | settings → Max Tries | **5** | hasta 5 intentos |
| Wait between tries (ms) | settings → Wait Between Tries | **5000** | backoff entre intentos |

Con 3 páginas por tanda y 45 s de espera entre tandas, 11 páginas se procesan en
~4 tandas (3+3+3+2) con 3 esperas ≈ **135 s de throttle** + el tiempo de cada
llamada. El presupuesto de tokens por ventana queda muy por debajo del límite
(ver derivación abajo), y si una página igual choca el 429, el retry con backoff
la reintenta en vez de matar la ejecución completa — el viaje se completa aunque
una página haya tenido que esperar.

## El límite es configurable — no lo ates al modelo

El encargo pide que el límite sea un **parámetro configurable**, no un número
mágico, porque Julio va a subir el tier de OpenAI y el throttle debe poder
aflojarse **sin reescribir código**. Se cumple así:

- Los dos números que gobiernan el ritmo (`batchSize`, `batchInterval`) están en
  el propio nodo `Extraer GPT-4o`, visibles en la UI de n8n. Para aflojar el
  throttle cuando suba el tier: **subir `batchSize` y/o bajar `batchInterval`**.
  Con tier alto se puede llegar a `batchInterval: 0` (sin espera) sin tocar nada
  más.
- El throttle **no depende del modelo**. El swap de fichas a GPT-5
  (`gpt-5.6-sol`, encargo `swap-modelo-lectura-gpt5`) vive en el payload; el nodo
  HTTP es el mismo y su batching aplica igual sea cual sea el modelo que emita
  `Preparar Payload`. Cambiar de modelo no toca el throttle y cambiar el throttle
  no toca el modelo.

### Derivación del presupuesto (para recomputar si cambia el tier)

- Límite actual: **30.000 TPM** (gpt-4o, tier de la cuenta al 2026-08-07).
- Costo aproximado de input por página de ficha (imagen `detail:high` de A4 +
  recortes de banda + prompt): del orden de ~1–2,5 k tokens de input por llamada.
- Ritmo configurado: 3 páginas / 45 s ≈ 4 páginas/min ⇒ **~4–10 k TPM**, holgado
  bajo los 30 k. Conservador a propósito: prioriza "el viaje entero entra de una"
  sobre velocidad.
- Al subir el tier (p. ej. a 90 k / 300 k TPM) el margen se multiplica: se puede
  subir `batchSize` a 6–10 y/o bajar `batchInterval` proporcionalmente. La regla:
  `TPM_efectivo ≈ (batchSize / batchInterval_seg) × 60 × tokens_por_pagina`, que
  debe quedar bajo el TPM del tier con margen.

## Estado del deploy

El throttle está aplicado en el **DRAFT** del workflow `WD0q9Ic0oDvUoJwp`
(batching visible en el nodo; retry aplicado vía `setNodeSettings`). La versión
activa sigue corriendo sin throttle hasta que Julio **publique**. Entra en el
deploy consolidado (ver `docs/deploy-consolidado-planilla.md` /
`encargos/2026-08-07-deploy-consolidado-planilla.md`): al publicar, el throttle
va junto con el swap de modelo y los fixes de Planilla.

## Verificación

- **No hay cambio de código en repo** para el throttle (es config de nodo HTTP),
  así que la suite existente no se ve afectada; se mantiene verde
  (`node --test ficha/tests/*.test.js`, build `--check` al día).
- La **corrida real de 11 páginas** no se puede disparar desde el sandbox (el
  webhook `studio-julio.duckdns.org` está bloqueado por el proxy). Queda para
  Julio **post-publish**: subir los 3 PDFs de prueba juntos (11 páginas) en una
  sola subida y confirmar que:
  1. completa **sin error de rate limit** y guarda los 2 viajes;
  2. lo extraído es **idéntico** a procesar las páginas de a pocas (el throttle
     cambia el ritmo, no QUÉ se extrae);
  3. reportar **tiempo total** (esperado: throttle ~135 s + tiempo de llamadas).
- Prueba del parámetro: cambiar `batchInterval` (p. ej. a 10000) y verificar que
  el ritmo cambia — el throttle responde al parámetro, no a un valor fijo.
