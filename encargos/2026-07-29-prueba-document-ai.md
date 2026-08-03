# Encargo a Claude Code — Prueba de idoneidad: Document AI sobre las bandas de la ficha

> **Esto es una PRUEBA, no una construcción.** No se cablea nada a producción, no se toca el workflow vivo, no se construye el consenso. El objetivo es responder una sola pregunta con evidencia: **¿un OCR especializado en manuscrito lee los odómetros de estas fichas mejor que los LLM de visión?** Si la respuesta es sí, se hace un encargo aparte para integrarlo. Si es no, cerramos la vía y el proyecto toma otra decisión de diseño. En ambos casos el resultado es una tabla, no un deploy.

---

## 0. Por qué esta prueba

Tres modelos de visión probados sobre las mismas 3 fichas reales, todos con recorte por banda ya aplicado:

| Motor | Resultado sobre odómetros |
|---|---|
| gpt-4o-mini | Lee 8 como 2 sobre banda ampliada legible. Descartado. |
| gpt-4o (producción actual) | 6 OK / 3 REVISAR, con 1 OK malo oculto (V9: leyó 1054400/114, real 1054410/124) |
| Gemini 2.5 Flash | Lee 8 como 3 (339056 por 839056). Errores independientes de gpt-4o, útil como red, inútil como lector |

Diagnóstico: el recorte por banda funcionó y mejoró de forma medible, pero ninguno de los tres lee los dígitos con fiabilidad. Los odómetros manuscritos son el peor caso para un LLM generalista: números largos, sin redundancia semántica, sin contexto que permita autocorregir. Un dígito mal leído no lo corrige nada.

Agregar un cuarto motor generalista no va a cambiar esto. La hipótesis a probar es que un OCR entrenado específicamente en dígitos manuscritos sí los lee — y que además reporta confianza por carácter, lo que permitiría decidir sin adivinar.

## 1. Credenciales y procesador — YA CREADOS

Julio ya provisionó el procesador y la credencial. Datos reales, usar tal cual:

- Project ID: lector-de-fichas
- Processor ID: 1049209471c32899
- Región: eu
- Tipo de procesador: Document OCR (general, con soporte de manuscrito)
- Endpoint de predicción: https://eu-documentai.googleapis.com/v1/projects/163988540080/locations/eu/processors/1049209471c32899:process
- Credencial en n8n: nombre "Document AI" (tipo service account, con client_email + private_key). Asignarla al nodo HTTP de la sonda igual que se hace con cualquier credencial nueva vía MCP — recordar que las credenciales de nodos HTTP no se pueden setear por update_workflow, hay que asignarla a mano en la UI si el nodo ya existe, o verificar que quede asignada si se crea por create_workflow_from_code.
- La API espera OAuth2 Bearer token derivado de la service account (scope https://www.googleapis.com/auth/cloud-platform), no una API key simple. Si el nodo HTTP de n8n no puede generar el token directo desde la credencial de service account, puede hacer falta un nodo Google Cloud nativo o un paso de intercambio de JWT — evaluar contra lo que exponga el nodo real.

## 2. REGLA DE ARRANQUE

1. Consolidar la tabla de verdad de campo de los 9 viajes ANTES de correr nada. Esto es obligatorio y va primero. En la sesión anterior se reportó "5/5 OK limpios" y era falso — el V9 tenía un dato malo que se descubrió recién al releer la ejecución. Esa clase de error invalida toda la prueba. Recortar los 9 bloques de km de la ficha real, leerlos, y escribir la tabla completa (km_inicio, km_final, km_recorridos, matrícula, kg por viaje) en docs/verdad-de-campo-fichas.md del repo cliente. Todo lo que siga se compara mecánicamente contra esa tabla, no por inspección visual ad-hoc.
2. Verificar que las credenciales de Document AI están cargadas y el procesador responde antes de construir la sonda.
3. Si algo de este encargo no se corresponde con la realidad, parar y reportar.

## 3. Alcance

Repo: julionotaro/transliquidos_Estevez, rama claude/prueba-document-ai. Nada se mergea a main en este encargo salvo la tabla de verdad de campo y el documento de resultados.

Insumo: las mismas 3 fichas reales (ficha_real.pdf) y las mismas bandas ya definidas en REGIONES_FICHA (band_matricula, km_v1, km_v2, km_v3). El rasterizador y /rasterizar-regiones ya funcionan y están vivos — no se tocan.

Fuera de alcance: integrar Document AI al canal ficha, construir el consenso, tocar WD0q9Ic0oDvUoJwp, escribir en la tabla viajes.

## 4. Qué probar

### 4.1 — Configuraciones

Correr Document AI sobre los mismos insumos en dos modalidades, porque un OCR se comporta distinto a un LLM y no está claro cuál le sirve más:

- Modalidad A — banda recortada. Cada banda (km_v1, etc.) va sola al procesador. Es el equivalente directo de lo que hacen hoy los LLM.
- Modalidad B — página completa con filtrado posterior. La página entera a 300 DPI va al procesador; Document AI devuelve todo el texto detectado con sus bounding boxes; se filtran los tokens que caen dentro de las coordenadas de cada banda. A diferencia de un LLM, un OCR puede beneficiarse del contexto de layout completo, y este camino además da las coordenadas reales de cada número (útil para la integración futura).

Si una modalidad es claramente superior, decirlo. Si son equivalentes, preferir A por coste.

### 4.2 — Procesador

Empezar con el procesador de Document OCR con detección de manuscrito habilitada. Si expone variantes o versiones (p. ej. una específica para formularios), probar la que el propio servicio recomiende para handwriting y reportar cuál se usó.

### 4.3 — Qué capturar de cada lectura

Por cada campo de cada viaje:
- El valor leído.
- La confianza reportada por carácter y/o por token. Este es el dato que más importa después del acierto: si Document AI reporta baja confianza justo en los dígitos que lee mal, tenemos una señal accionable que ningún LLM nos dio.
- Coste de la llamada y latencia (para dimensionar producción).

## 5. Criterio de éxito — definido ANTES de correr

Sobre los odómetros (km_inicio, km_final) de los 9 viajes, que son los campos que rompen:

| Resultado | Veredicto |
|---|---|
| >= 17/18 dígitos-campo correctos | Document AI resuelve el problema. Se hace encargo de integración. |
| 14–16 correctos, y la confianza reportada marca los errores | Sirve con guarda de confianza. El umbral de confianza reemplaza al consenso. Encargo de integración con guarda. |
| 14–16 correctos, pero la confianza NO correlaciona con el error | No sirve mejor que gpt-4o. Misma trampa: error confiado e invisible. |
| < 14 correctos | No sirve. Cerrar la vía. |

Añadir la misma medición para matrícula y cantidad_kg, aunque el criterio decisorio son los odómetros.

La correlación confianza↔error es tan importante como la tasa de acierto. Un OCR que se equivoca pero lo señala es utilizable. Uno que se equivoca con confianza alta tiene exactamente el defecto de gpt-4o y no aporta nada.

## 6. Entregable

Un documento docs/prueba-document-ai.md con:

1. La tabla comparativa completa: por viaje y campo, verdad de campo / gpt-4o+crop / Gemini+crop / Document AI modalidad A / Document AI modalidad B.
2. Tasa de acierto de cada motor sobre odómetros, contada mecánicamente.
3. Tabla de confianza reportada vs acierto real (¿marca sus errores o no?).
4. Coste por página y latencia.
5. Veredicto explícito según §5, sin ambigüedad, y la recomendación que se desprenda.

Commit del documento + la tabla de verdad de campo a main. El código de la sonda queda en la rama.

## 7. Lo que NO quiero en el reporte

- Estimaciones o conteos inferidos. Todo número sale de comparar contra la tabla de verdad de campo, mecánicamente.
- "Se ve bien" sin corrida real.
- Un veredicto tibio. Si Document AI no resuelve, decirlo claro: es información valiosa y cierra una puerta que hay que cerrar.

## 8. Contexto de la decisión

Este proyecto lleva dos días de pruebas de lectura sin llegar a un sistema confiable. Si Document AI no da el salto, la decisión de diseño pasa a ser una de estas, y no hay que insistir con más motores:

- Rediseñar la ficha con casillas por dígito (sube el acierto de cualquier OCR dramáticamente).
- Aceptar que los 3 odómetros por viaje se teclean a mano, y automatizar todo el resto del circuito (clientes, tarifas, indexación, validación, archivado), que ya funciona.

Por eso esta prueba tiene que ser rápida y concluyente. No es el comienzo de otra ronda de iteración: es el desempate.
