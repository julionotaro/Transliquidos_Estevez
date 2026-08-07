# Encargo 2026-08-07 — Swap del modelo de lectura de ficha: gpt-4o → GPT-5 (visión)

## Contexto y por qué

La lectura de fichas manuscritas es ahora un **bloqueante de facturación**, no un detalle. El
motor actual (gpt-4o en el nodo de lectura de ficha) produce errores en origen/destino que
impiden el cruce con tarifas: en la corrida real del 2026-08-07 leyó "Avello/Becerra" por
"Aveiro/Begega", "Agensi" por "Asensi". Un origen mal leído = factura no emitible.

Evidencia acumulada (no es hipótesis):
- gpt-4o, gpt-4-mini y gpt-4 ya fallan en estos documentos.
- El documento llega bien al modelo (imagen directa, sin OCR previo que lo degrade).
- Benchmarks 2026: gpt-4.1 ~85% en manuscrito limpio, cae a ~65% en la 3ª página de multipágina
  (deriva de contexto + continuaciones alucinadas — exactamente los síntomas: errores que
  empeoran con más páginas, alucinaciones tipo "Jaana da Nizere"). La familia GPT-5 sube a ~95%
  en manuscrito.

Julio decidió: seguir en OpenAI (no hay API de Anthropic), pero usar **el mejor modelo de visión
de GPT disponible**, no gpt-4.

## Regla de arranque — inspeccioná primero

1. **Identificá qué modelos GPT-5 con visión están disponibles en la cuenta de OpenAI de Julio.**
   No hardcodees un nombre a ciegas. Objetivo: el GPT-5 con visión más capaz al que la cuenta
   tenga acceso (ideal la familia más nueva tipo GPT-5.6/"Sol" si está habilitada; si no, el
   GPT-5 con visión disponible). Verificá con una llamada de prueba mínima antes de cablearlo,
   para no dejar el pipeline apuntando a un modelo que la cuenta no puede invocar.
2. **Localizá el nodo de lectura de ficha** en el workflow `[ESTEVEZ] Ingesta Viaje`
   (`WD0q9Ic0oDvUoJwp`) y su código fuente en el repo. Ojo con nombres traducidos en la UI:
   el nodo de código es `Preparar Payload` en el repo (aparece como "Carga útil del preparador"
   en la UI); el nodo HTTP que llama a OpenAI es `Extraer GPT-4o` (aparece "Extract GPT-4o"). El
   swap toca el modelo de la llamada HTTP y, si hace falta, el prompt/formato del payload.
3. **Revisá el prompt actual** (system + user) que ya trae la disciplina "no confabules / null si
   no es legible / REVISAR ruidoso". Se conserva. GPT-5 puede requerir ajustes menores de formato
   de mensajes o de parámetros (p.ej. la forma de pasar la imagen, tokens máximos, temperatura),
   pero la lógica de extracción y el esquema de salida NO cambian.

## Cambios

- Cambiar el modelo de la llamada de lectura de ficha de `gpt-4o` al GPT-5 con visión elegido.
- Mantener el mismo esquema de salida (el JSON que consume el resto del pipeline no cambia — cruce,
  tarifas, indexación, planilla siguen leyendo lo mismo).
- Conservar el prompt disciplinado; adaptá solo lo que GPT-5 exija a nivel de API.
- Si el cambio de modelo permite subir varias páginas sin la deriva de contexto de gpt-4o,
  anotalo — puede reducir la necesidad del throttle (que va en encargo aparte), pero no asumas:
  reportá lo que observes.

## Tests

- Las 3 fichas de prueba reales del 2026-08-07 (ficha 2498KZL, 2 viajes: RNM Sosa→Orovalle/Begega,
  Asturiana Zinc→DS Smith/Viana Castelo). Golden set de lectura correcta:
  - Viaje 1: cliente RNM, origen **AVEIRO** (no "Avello"), destino **BEGEGA/OROVALLE** (no
    "Becerra"), mercancía **SOSA**, cantidad 17.900.
  - Viaje 2: cliente ASTURIANA ZINC, origen **CASTRILLÓN**, destino **VIANA CASTELO**, mercancía
    ÁCIDO SULFÚRICO, cantidad 24.160.
  - Conductor: "ASENSI" es la lectura correcta (el CMR impreso lo confirma); "Agensi" es
    aceptable como REVISAR si el modelo no está seguro, pero NO debe inventar un tercer valor.
- Campo ilegible → null / REVISAR, nunca un valor inventado. La disciplina anti-confabulación se
  mantiene.
- Suite existente sigue verde.

## Verificación — corrida real

Corré las 3 fichas por el pipeline con el modelo nuevo y compará campo por campo contra el
golden set de arriba. Reportá:
- Qué leyó GPT-5 en origen/destino/mercancía/cliente de cada viaje.
- Si Aveiro/Begega/Castrillón/Viana Castelo salen correctos (era el fallo bloqueante).
- Costo y latencia por página vs gpt-4o (para que Julio dimensione el impacto económico del
  cambio).

## Commit / entrega

- Rama propia. Commits chicos (identificación de modelo / swap de llamada / ajuste de prompt si
  hizo falta / verificación).
- Este cambio va al nodo de lectura, que se despliega manualmente a producción (copy-paste + publish,
  como los otros nodos). Dejá el archivo generado listo para el deploy consolidado.
- No abrir PR salvo que se pida; reportá resultado con la comparación de lectura y el costo/latencia.
