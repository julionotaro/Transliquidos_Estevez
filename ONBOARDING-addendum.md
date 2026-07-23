# Addendum ONBOARDING — estado al cierre 23/07/2026 (sesion completa)
Complementa ONBOARDING.md. Este es el documento de arranque del proximo chat.

## ARRANQUE DEL PROXIMO CHAT
Objetivo inmediato: **Fase 1a del archivado documental** (spec aprobada, abajo).
1. Confirmar Studio-julio activo (una tool simple, ej. search_projects).
2. Verificar que Julio borro la fila id=1 de `ultimo_km_tractora` (km_final '0' espuria) en la UI. Si no, recordarselo: corrompe el calculo de km vacios.
3. Verificar estado del parametro `formato_mes` en el Archivador Drive (pedido al Laboratorio; bloquea Fase 1b, no la 1a).
4. Implementar Fase 1a sobre `WD0q9Ic0oDvUoJwp`: archivar todo documento entrante a SIN-CLASIFICAR via Archivador (`POST /webhook/archivador-drive`, carpeta_raiz_id `142CU26PlAH-SuyEi9xoTCjebDwy6NDIi`) ANTES de extraer + registrar en tabla `documentos` con estado. OJO: si se toca el nodo `Extraer GPT-4o`, la credencial se pierde y Julio debe reasignarla en UI.

## SPEC APROBADA 23/07 — Archivado documental + correlacion (corrida 2, score 8.0/10)
Brief en `briefs/brief-archivado-correlacion.md`. Decisiones vigentes:
- **Secuencia**: opcion 3a — archivar en carpeta transitoria SIN-CLASIFICAR antes de extraer; mover a ruta final tras identificar cliente. Fallo de extraccion -> documento queda en SIN-CLASIFICAR, estado `recibido`.
- **Ruta final**: FACTURACION CLIENTES/FACTURACION LIQUIDOS/{ANO}/FACTURACION {MES} {ANO}/{CLIENTE}. Carpeta raiz (FACTURACION LIQUIDOS): ID `142CU26PlAH-SuyEi9xoTCjebDwy6NDIi`. Ano '2026' a secas. formato_mes `texto_facturacion`.
- **Tabla `documentos`** (CREADA, ID `SmmE2PIufLwrfztM`): nombre, tipo, cliente, referencia, file_id, ruta, fecha_recepcion, canal, viaje_id, estado. Estados: recibido -> archivado -> asociado | sin_asociar.
- **Scoring correlacion**: ventana +/-10 dias; pesos: matricula 3, fecha exacta 3 (+/-1 dia 2), cliente 2, peso +/-5% 2, material (tokens) 1; asociar si score >= 7 Y segundo candidato a >= 3 puntos. Empate o score bajo -> sin_asociar. Documento sin viaje candidato -> sin_asociar (NO crear viaje provisional en v1).
- **Contrato correlacion <-> Auxiliar** (version Liaison, la completa): caso = `{documento:{...}, candidatos:[{viaje_id, score}]}`; propuesta = `{estado:'PENDIENTE_APROBACION', instruccion_accion:'asociar_documento', documento_id, viaje_id}`.
- **Topologia**: la define quien implementa (conoce el workflow real). Correlacion = workflow NUEVO; archivado = extension de la ingesta; Lector de Buzon alimenta la misma ingesta.
- **Fases**: 1a archivado a SIN-CLASIFICAR + registro (sin dependencias) | 1b movimiento a ruta final (requiere formato_mes) | 2 correlacion + scoring | 3 bandeja + Telegram + Auxiliar Administrativo (integracion Oficina).

## Decision de metodo (23/07): Equipo de Diseno reposicionado
Recomendacion aceptada en sesion: usar el Equipo de Diseno como REVISOR ADVERSARIAL de disenos hechos en chat (no como autor) en proyectos con contexto profundo; como autor completo solo en greenfield. Evidencia: corrida 1 evasiva y con stack equivocado; corrida 2 buena porque el brief anclaba los valores; el Critic evalua plantilla, no sustancia. Pendiente: encargo al KB de Dify (quitar sesgo Tyrion/SQL, reorientar Critic).

## Criterios de dominio cerrados
- **D-08 REPARTOS**: los 90 EUR de traslados NO entran en la base de indexacion.
- **Quimidroga Barcelona -> Leiria (PT)**: 88,25 EUR/tonelada.
- **BALTRANSA**: cliente cuando el doc principal es su Orden de Transporte (Chemetall/Houghton/Stellantis/Luboil/West Horse/Quaker son cargadores/destinatarios). Referencia = nº de Orden (332175). Importe = PRECIO de cabecera, CERRADO: sin calculo por peso, sin minimo 23t. Indexacion INCLUIDA. Peso = neto CMR (KGRS de la Orden es estimacion). Porte/IVA por pais del CLIENTE: Baltransa espanola = P 21% SIEMPRE, aun descargando en Portugal. (RNM portuguesa = PI 0% siempre.)

## Data tables (IDs reales) — Project `grgBpWySVCpXvuii`
| Tabla | ID | Columnas |
|---|---|---|
| tarifas | Siwhv2AUWTSeFlrJ | cliente, origen, destino, material, tarifa_tn, precio_fijo, vigente_desde |
| indexacion | or1otD9WsjJ3V8Cr | cliente, tipo, pct, desde, hasta |
| viajes | lrBxWpTUxMtO8U48 | fecha, empresa, tractora, semi, conductor, estado, detalle |
| ultimo_km_tractora | QzSfS4rYbsr5rjps | tractora, km_final, fecha |
| facturacion_reglas | mPe8wIu2xSwbflzF | (vacia) cliente, servicio, regimen_indexacion, fuente_peso, iva, minimo_tn, fuente_referencia, notas |
| documentos | SmmE2PIufLwrfztM | (vacia) nombre, tipo, cliente, referencia, file_id, ruta, fecha_recepcion, canal, viaje_id, estado |

## Ingesta `WD0q9Ic0oDvUoJwp` — estado real
Topologia: Hook Viaje (webhook /webhook/ingesta-viaje, binaryData) -> Preparar Payload -> Extraer GPT-4o -> Formatear Linea Gesruta -> [Responder | Preparar Filas Viajes -> Guardar Viajes | Preparar KM Tractora -> Upsert KM Tractora].
- Probada end-to-end (ejec. 479, Orden Baltransa 332175): fila en viajes (estado pendiente, detalle=JSON del viaje) + upsert km.
- **Defectos de la 479 CORREGIDOS y publicados** (23/07 tarde): prompt con LITERALIDAD OBLIGATORIA (material ADR caracter a caracter, origen/destino tal cual, null real nunca "null" ni 0); normalizacion post-parse en Formatear (strings null->null, odometros 0->null); Preparar KM exige kf>0.
- **Pendiente de Julio**: borrar en UI la fila id=1 de ultimo_km_tractora (km 0 espuria) y opcionalmente la fila id=1 de viajes (datos sucios pre-correccion). No hay tool MCP de borrado de filas.
- Entrada: pagina propia `ingesta-viaje.html` (patron webhook+fetch, verifica respuesta real). `/form/ingesta-viaje` NO existe.
- Validador `IlIod0DlephaLmAV`: SIN los cambios Baltransa (PRECIO_CERRADO, porteDe) — pendiente.

## Pendientes (orden sugerido)
1. Fase 1a archivado (ver ARRANQUE).
2. Fase 1b (tras formato_mes del Laboratorio).
3. Fase 2 correlacion (workflow nuevo).
4. Fase 3 bandeja + Telegram + Auxiliar (integracion Oficina; contrato en estudio-ia/templates/oficina/).
5. Baltransa al validador + migrar indexacion embebida a data table + cargar tarifas y facturacion_reglas.
6. Encargo KB Dify (reposicionamiento Equipo de Diseno).
7. nginx: publicar UI n8n por HTTPS (location / en mcp-ssl.conf).

## Aprendizajes tecnicos (acumulados, vigentes)
- **Credenciales nodos HTTP**: setNodeCredential rechaza httpBearerAuth; updateNodeParameters anida credentials DENTRO de parameters (n8n lo ignora, falla en runtime 'Credentials not found'); get_workflow_details no las expone. SIEMPRE asignar a mano en UI tras editar el nodo por MCP.
- **Webhook path duplicado** con otro trigger del mismo workflow: update_workflow falla opaco ('server isn't responding'). Eliminar primero el trigger viejo.
- **Diagnostico MCP**: 'Tool not found' = conector off O servidor caido; 'server isn't responding' = sesion colgada o servidor caido (si VPS sano: ciclar toggle / chat nuevo); JSON-RPC pidiendo text/event-stream en navegador = servidor SANO; 404 en raiz nginx = normal; probar una tool simple antes de diagnosticar caida (el fallo puede ser de UNA operacion).
- **GitHub desde chat**: LECTOR test_workflow (OtNo3Tk6Qu2R91rp) pineando Webhook {body:{repo,path,ref,raw}} + get_execution ['GH Get']; sha del blob en header ETag. ESCRITOR (05hNhH7nbtXsXL9M) body {repo,path,content,message,sha?}; sha para update. pinData con JSON-escapado-como-string falla ('Expected object, received string'); markdown plano funciona.
- **Briefs largos a Dify**: execute_workflow falla silencioso >2.5k chars. Via: workflow temporal manualTrigger -> Code (brief en template literal) -> HTTP a http://187.127.233.43/v1/chat-messages con token de app. Crear esqueleto por create_workflow_from_code + addNode por update_workflow.
- **SDK create_workflow_from_code**: requiere patron workflow()/trigger()/node() (leer get_sdk_reference); 'wf.addTrigger' no existe.

## Recursos
| Recurso | ID / URL |
|---|---|
| Ingesta viaje | WD0q9Ic0oDvUoJwp — /webhook/ingesta-viaje |
| Validador factura | IlIod0DlephaLmAV — /webhook/auditar-factura |
| GitHub Write | 05hNhH7nbtXsXL9M — /webhook/gh-tyrion-write |
| GitHub Read | OtNo3Tk6Qu2R91rp — /webhook/gh-read-v2 |
| Dify Bridge Diseno | 0tGxducQ0fq5uKbs (briefs cortos) |
| Archivador Drive (Laboratorio) | /webhook/archivador-drive |
| Lector Buzon (Laboratorio) | /webhook/lector-buzon |
| Carpeta raiz FACTURACION LIQUIDOS | 142CU26PlAH-SuyEi9xoTCjebDwy6NDIi |
| Credencial OpenAI Bearer | MJD7lLvCk947vvMl |
| Project n8n | grgBpWySVCpXvuii |
| n8n UI | http://187.127.233.43:5678 |
| Repo cliente | julionotaro/transliquidos_Estevez |
