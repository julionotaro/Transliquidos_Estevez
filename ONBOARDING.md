# ONBOARDING — Oficina Agentica Transliquidos Estevez
Punto de arranque para continuar el proyecto en un chat nuevo. Resume todo el conocimiento construido.

## Contexto
Julio es administrativo (con proyeccion a trafico y facturacion) en un grupo transportista de liquidos
de Villagarcia de Arousa: dos firmas, **Trans. Liquidos Estevez S.L. (TLE, CIF B36532802)** y
**Hermanos Estevez Casal (HEC)**. Se automatiza el puesto administrativo como primera validacion real
de la Oficina de Agentes. Repo cliente: `julionotaro/transliquidos_Estevez`.

Regla de aislamiento: el dominio (clientes, tarifas, Gesruta, rutas) vive SOLO en el repo del cliente.
A `estudio-ia` solo vuelven patrones estructurales validados.

## Restriccion tecnica
Gesruta (sistema de gestion) es **Windows desktop en el ordenador de la empresa**: sin API ni RPA web.
La automatizacion termina en "carga asistida": el sistema entrega la linea lista para tipear.

## Lo construido y PUBLICADO (funciona)

### 1. Ingesta de viajes — `WD0q9Ic0oDvUoJwp`
URL: https://studio-julio.duckdns.org/form/ingesta-viaje
Formulario: sube PDF/fotos de la hoja del chofer + documentos -> gpt-4o extrae -> devuelve una
"linea Gesruta" por viaje. Hoja = N viajes independientes (un chofer, varios clientes por semana).

### 2. Validador de facturas — `IlIod0DlephaLmAV` (patron webhook, el que funciona)
Webhook: https://studio-julio.duckdns.org/webhook/auditar-factura
Pagina HTML propia (auditar-factura.html) que hace fetch al webhook y pinta el informe.
ESTE es el patron correcto para procesos largos: Webhook + Respond to Webhook + pagina propia con fetch.
NO usar el nodo Form de completion para procesos >15s: se cuelga en waiting/3000.
Audita: importe=cantidad x precio, indexacion (% por cliente+fecha), minimo 23t, matriculas,
regimen agregado (Orember) vs por linea, cuadre base/IVA/total.

## Reglas de dominio confirmadas

### Emisor vs Cliente
Emisor = quien cobra (grupo Estevez: TLE o HEC). Cliente = destinatario a quien se factura.
Se distingue por ROL en el documento, nunca por nombre fijo.

### Cliente = contratante, no destinatario de la mercancia
RNM carga en Aveiro y descarga en Drogas Vigo: el cliente es RNM. TEPSA es planta de Quimidroga.
MILADERTO es planta de Helm. Finsa/Orember/Cella son destinos de Foresa.

### Porte / IVA por entidad facturada (no por geografia)
- RNM: siempre internacional sin IVA (empresa portuguesa), aunque origen y destino sean espanoles.
- QUIMIDROGA: por prefijo de Referencia en factura. 70xxxx -> Espana, nacional con IVA. 100xxxx -> Portugal, sin IVA.
- FORESA / HELM / BRESFOR: nacional con IVA.

### Peso a facturar (fuente por cliente)
- FORESA: siempre el peso del ALBARAN.
- Resto: peso NETO del CMR; si no hay, documento de bascula.
- Cantidad del documento de origen manda sobre la hoja y sobre la orden (que es estimacion).
- Minimo facturable: si el peso real < 23 t, se factura 23 t.
- HELM: precio CERRADO del documento (campo Coste de transporte). NO se calcula por peso; el peso es informativo. Solo se le agrega indexacion.

### Referencia por cliente
- FORESA: referencia corta que empieza por 20 (arriba dcha del albaran). NO el numero largo 5030xxxxx. Villagarcia->otros destinos usa el n de Orden de Carga del mail.
- QUIMIDROGA: "Referencia en factura" (704061...).
- RNM: Albaran No (0941026143).
- HELM: numero de pago de la OC (6100295057).

### Indexacion (suplemento gasoleo)
El % sale de la solapa del cliente + RANGO de fechas (no siempre quincenas; a veces tramos de dias).
Seis solapas cargadas en el validador: FORESA-BRESFOR, HELM, QUIMIDROGA, OTROS, AGENCIA, AUTONOMOS.
Cliente sin solapa propia -> OTROS. RNM -> OTROS.
Regimenes por tipo de servicio:
- Foresa Caldas->Ourense (Orember): AGREGADA quincenal (sobre el total del rango). Puede mezclar 2 quincenas.
- Foresa Villagarcia->Caldas (metanol): AGREGADA mensual. Puede mezclar 2 meses.
- Baltransa: INCLUIDA en el precio (no se agrega linea).
- Todo lo demas (incluido Foresa a otros destinos): POR LINEA.

### Fecha de carga
Si hoja del chofer y documento discrepan, prevalece la ficha del chofer.

### HEC
No se calculan km de unidad tractora en cargas de HEC.

## Errores reales detectados en facturas (casos de prueba validados)
- 2026/315 (Foresa): indexacion 0.1517 y 0.1064 mal aplicadas (correcto 0.1279); Termolan sin indexacion; una linea sin matricula.
- 2026/313 (Foresa Orember, agregada): base de indexacion 1a quincena julio inflada (declara 12.802,40, real 10.989,73; cobra 192,87 de mas).
- 2026/317 (Quimidroga): ref 703224 (0.1517) y 703194 (0.1064) mal, correcto 0.1171 julio; totales descuadrados.

## PENDIENTES

### De Julio (dominio)
- Criterio base indexacion con linea REPARTOS (D-08): incluye o no los 90 EUR.
- Tarifa Quimidroga Barcelona->Leiria (a verificar).
- Datos completos de Baltransa (porte, peso, referencia, tarifa).

### De Julio (infraestructura)
- Crear data tables en n8n y pasar IDs: `viajes`, `tarifas`, `indexacion`, `ultimo_km_tractora`, `facturacion_reglas`.
  (Las data tables se crean por UI, no por MCP.)

### Tecnicos (Claude, cuando existan las tablas)
- Migrar las 6 tablas de indexacion embebidas en el validador a la data table `indexacion`.
- Conectar persistencia de la ingesta (guardar viajes, actualizar ultimo_km_tractora).
- Loop de aprobacion humana por Telegram en la ingesta.
- Front propio para ingesta y validador (patron dashboard+webhook+fetch), reemplazando los formularios.
- Cargar tablas `tarifas` (Foresa/Quimidroga/RNM/HELM) para calcular importes, no solo validarlos.

## Aprendizajes tecnicos clave
- Nodo Form de n8n NO sirve para procesos largos (se cuelga waiting/3000). Usar Webhook + Respond to Webhook + pagina propia con fetch (patron Tyrion).
- Credencial OpenAI para nodos HTTP: tipo Bearer Auth (`OpenAI Bearer`, MJD7lLvCk947vvMl), no la credencial OpenAI nativa. Se asigna por updateNodeParameters con bloque credentials, no por setNodeCredential.
- nginx: el path /form/ y /webhook/ deben estar ruteados en mcp-ssl.conf. Ya estan.
- create_workflow_from_code no auto-asigna credenciales a nodos HTTP: reasignar tras crear.

## Recursos
| Recurso | ID |
|---|---|
| Ingesta viaje | WD0q9Ic0oDvUoJwp |
| Validador factura (webhook) | IlIod0DlephaLmAV |
| GitHub Write | 05hNhH7nbtXsXL9M |
| GitHub Read | OtNo3Tk6Qu2R91rp |
| Credencial OpenAI Bearer | MJD7lLvCk947vvMl |
| Repo cliente | julionotaro/transliquidos_Estevez |
