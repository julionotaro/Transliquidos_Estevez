# Addendum ONBOARDING — cierres, tablas y migracion a webhook
Complementa ONBOARDING.md. Ultima actualizacion: sesion 23/07/2026.

## Criterios de dominio cerrados
- **D-08 REPARTOS**: los 90 EUR de traslados NO entran en la base de indexacion. La indexacion se calcula solo sobre el precio del viaje. (El validador ya lo hacia asi.)
- **Quimidroga Barcelona -> Leiria (PT)**: 88,25 EUR/tonelada. Coincide con ref 702704 de la factura 2026/317.
- **BALTRANSA (cerrado 23/07)**:
  - Cliente = BALTRANSA cuando el documento principal es su Orden de Transporte. Las empresas de ORIGEN/CARGA y DESTINATARIO/DESCARGA (Chemetall, Houghton, Stellantis, Luboil, West Horse, Quaker Houghton) son cargadores y destinatarios, NO el cliente.
  - Referencia = numero de ORDEN DE TRANSPORTE, arriba a la derecha (ej 332175, 332575).
  - Importe = campo PRECIO de la cabecera de la Orden. Es precio CERRADO: no se calcula por peso y NO se aplica el minimo de 23 t.
  - Indexacion = **INCLUIDA en el precio**. No se agrega linea.
  - Peso = neto del CMR o carta de porte. Los KGRS de la Orden son estimacion previa, no valen.
  - Porte/IVA = **por pais del CLIENTE, no por geografia del viaje**. Baltransa es espanola: nacional con IVA 21% SIEMPRE, incluso descargando en Portugal (caso 332.575, Cacia). Regla general reconfirmada: RNM portuguesa = sin IVA aunque cargue y descargue en Espana.

## Data tables (IDs reales)
Project: grgBpWySVCpXvuii

| Tabla | ID | Columnas |
|---|---|---|
| tarifas | Siwhv2AUWTSeFlrJ | cliente, origen, destino, material, tarifa_tn, precio_fijo, vigente_desde |
| indexacion | or1otD9WsjJ3V8Cr | cliente, tipo, pct, desde, hasta |
| viajes | lrBxWpTUxMtO8U48 | fecha, empresa, tractora, semi, conductor, estado, detalle |
| ultimo_km_tractora | QzSfS4rYbsr5rjps | tractora, km_final, fecha |
| facturacion_reglas | mPe8wIu2xSwbflzF | cliente, servicio, regimen_indexacion, fuente_peso, iva, minimo_tn, fuente_referencia, notas |

`facturacion_reglas` creada por MCP el 23/07, VACIA. Columnas de `tarifas` normalizadas a minuscula.

## Persistencia de la ingesta (implementada y PROBADA 23/07)
Workflow `WD0q9Ic0oDvUoJwp`. Rama paralela desde `Formatear Linea Gesruta`:

```
Hook Viaje -> Preparar Payload -> Extraer GPT-4o -> Formatear Linea Gesruta -+-> Responder
                                                                            +-> Preparar Filas Viajes -> Guardar Viajes
                                                                            +-> Preparar KM Tractora  -> Upsert KM Tractora
```

- `Guardar Viajes`: insert, una fila por viaje, `estado='pendiente'`, `detalle` = JSON completo del viaje. Se persiste al extraer; la aprobacion Telegram (pendiente) solo cambiara estado a 'confirmado'.
- `Upsert KM Tractora`: match por `tractora`, km_final mas alto de la hoja. Omite HEC.
- Prueba end-to-end OK con Orden Baltransa 332175 (ejecucion 479): fila en viajes + fila en ultimo_km_tractora.

## Migracion de Form a Webhook (23/07) — resuelve el cuelgue
El Form Trigger se colgaba en waiting/3000 con procesos >15s. Migrado al patron del auditor:
- `Hook Viaje`: webhook POST `/webhook/ingesta-viaje`, binaryData, allowedOrigins *, responseNode.
- `Responder`: Respond to Webhook text con CORS.
- `Preparar Payload` lee Empresa/Notas de `$json.body.*` con fallback.
- **`/form/ingesta-viaje` YA NO EXISTE.** Entrada: pagina propia `ingesta-viaje.html` (verifica la respuesta real antes de declarar exito).

## Defectos detectados en la prueba 479 (encargo aparte: encargos/2026-07-23-defectos-ingesta.md)
1. `Preparar KM Tractora` acepta km_final=0 del modelo como valido -> fila espuria km 0 para T-10 ESTEVE (corrompe el calculo de km vacios del proximo viaje).
2. El modelo devuelve strings "null" en vez de null (semi, conductor, cliente_hoja) y 0 en numericos desconocidos; se persistieron tal cual.
3. Alucinacion en material ADR: extrajo 'Acido, Ironacano, N.E.P. (Hexafluorozirconato de amonio)' cuando el CMR dice 'LIQUIDO CORROSIVO, ACIDO, INORGANICO, N.E.P. (HEXAFLUOROZIRCONATO DE DIHIDROGENO)'. Grave: la descripcion ADR debe ser literal.
4. Destino embellecido ('Vigo, Pontevedra, Espana' cuando la Orden dice 'Vigo').
5. Las filas id=1 de viajes y ultimo_km_tractora contienen esos datos sucios (limpiar).

## Pendientes
### Dominio
- Cargar tarifas reales en `tarifas` y reglas en `facturacion_reglas` (incluir Baltransa: precio cerrado por orden).
- Migrar las 6 tablas de indexacion embebidas del validador a la data table `indexacion`.
- Aplicar Baltransa al validador (`PRECIO_CERRADO` + `porteDe()` estan corregidos en INGESTA, no en validador).
### Tecnicos
- Corregir defectos 1-5 (encargo redactado).
- Loop aprobacion Telegram pendiente -> confirmado (herramienta generica ya probada).
- Archivado documental + correlacion de escaneos: brief sometido al Equipo de Diseno el 23/07 (briefs/brief-archivado-correlacion.md). Spec pendiente de aprobacion.
- Parametro `formato_mes: texto_facturacion` en Archivador Drive (pedido al Laboratorio).
- Publicar la UI de n8n bajo HTTPS (hoy solo por IP:5678; nginx solo rutea /mcp-server/, /form/, /webhook/).

## Aprendizajes tecnicos
### Credenciales en nodos HTTP (CONFIRMADO)
- `setNodeCredential` con `httpBearerAuth` es RECHAZADO por el MCP para httpRequest.
- `updateNodeParameters` con bloque `credentials` lo anida DENTRO de parameters, donde n8n lo ignora: publica sin error y falla en runtime con `Credentials not found`.
- `get_workflow_details` NO expone credenciales asignadas.
- **Conclusion: la credencial de un nodo HTTP se asigna SIEMPRE a mano en la UI** tras cualquier edicion MCP que toque el nodo.
### Conflicto de path de webhook
Anadir un Webhook con un path ya usado por otro trigger del mismo workflow hace fallar `update_workflow` de forma opaca ('server isn't responding'), no con error de validacion. Solucion: eliminar primero el trigger viejo.
### Diagnostico de estados del MCP
- `Tool not found` -> conector apagado O servidor caido (indistinguibles).
- `server isn't responding` -> conector activo; servidor caido o sesion MCP colgada. Si el VPS esta sano: ciclar toggle o chat nuevo. La sesion NO siempre se recupera sola.
- JSON-RPC pidiendo text/event-stream en el navegador -> servidor SANO.
- 404 de nginx en la raiz del dominio: normal (solo hay paths especificos).
- El error puede ser especifico de UNA operacion (payload que cuelga la validacion) mientras otras tools responden: probar con una tool simple antes de diagnosticar caida.
### Leer/escribir GitHub desde el chat
- LECTOR: `test_workflow` sobre OtNo3Tk6Qu2R91rp pineando `Webhook` con `{body:{repo,path,ref,raw}}` + `get_execution` con nodeNames ['GH Get']. El sha del blob viene en el header ETag de la respuesta.
- ESCRITOR (05hNhH7nbtXsXL9M): mismo patron, body `{repo, path, content, message, sha?, branch?}`. sha requerido para update, omitir para create.
- `test_workflow` falla con 'Expected object, received string' si el pinData contiene JSON escapado como string (ej. respuesta simulada de OpenAI). Contenido markdown plano funciona.
### Someter briefs largos a Dify
`execute_workflow` trunca/falla en silencio con briefs >2-2.5k chars. Via que funciona: workflow temporal (manualTrigger -> Code con brief hardcodeado en template literal -> HTTP a `http://187.127.233.43/v1/chat-messages` con el token de la app), creado por `create_workflow_from_code` (esqueleto) + `update_workflow` (addNode con el brief). Ejemplo: UxxWmdGZQEIGQhkf.

## Recursos
| Recurso | ID / URL |
|---|---|
| Ingesta viaje (webhook) | WD0q9Ic0oDvUoJwp — /webhook/ingesta-viaje |
| Validador factura (webhook) | IlIod0DlephaLmAV — /webhook/auditar-factura |
| GitHub Write | 05hNhH7nbtXsXL9M — /webhook/gh-tyrion-write |
| GitHub Read | OtNo3Tk6Qu2R91rp — /webhook/gh-read-v2 |
| Dify Bridge Equipo Diseno | 0tGxducQ0fq5uKbs — /webhook/dify-design (briefs cortos) |
| Credencial OpenAI Bearer | MJD7lLvCk947vvMl |
| Project n8n | grgBpWySVCpXvuii |
| n8n UI | http://187.127.233.43:5678 (no publicada por HTTPS) |
| Repo cliente | julionotaro/transliquidos_Estevez |
