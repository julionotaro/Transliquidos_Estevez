# BRIEF — Archivado documental y correlacion de escaneos
## Proyecto: Oficina Agentica Transliquidos Estevez
## Fecha: 23/07/2026 — Sometido al Equipo de Diseno (Dify) el 23/07 via workflow temporal UxxWmdGZQEIGQhkf

---

## Contexto del sistema actual

Cliente: grupo transportista de liquidos (dos firmas: TLE y HEC), Villagarcia de Arousa. Se automatiza el puesto administrativo (ingesta de viajes, facturacion, auditoria).

**Ya construido y operativo (no redisenar):**
- Ingesta de viajes (workflow n8n WD0q9Ic0oDvUoJwp): webhook recibe PDFs/fotos -> gpt-4o extrae JSON -> informe 'linea Gesruta' + persistencia en data tables. Probada end-to-end el 23/07 con caso real Baltransa.
- Validador de facturas (IlIod0DlephaLmAV).
- Data tables: viajes (fecha, empresa, tractora, semi, conductor, estado, detalle), ultimo_km_tractora, tarifas, indexacion, facturacion_reglas. estado: pendiente -> confirmado (loop Telegram pendiente).
- Herramientas genericas de la Oficina (probadas, en estudio-ia/activos/herramientas-oficina/):
  - Lector de Buzon: POST /webhook/lector-buzon — lee Gmail, devuelve mensajes + adjuntos binarios.
  - Archivador Drive: POST /webhook/archivador-drive — entrada {contenido_b64, nombre_archivo, carpeta_raiz_id, cliente, anio, mes, mime_type, formato_mes}; crea ruta a demanda, idempotente, devuelve file_id y ruta. formato_mes 'texto_facturacion' -> carpetas 'FACTURACION JULIO 2026' (parametro en incorporacion).
  - Loop aprobacion Telegram: patron 3 nodos (Solicitar -> Wait resume:webhook -> IF decision).
- Contrato Coordinador<->Auxiliar definido (catalogo cerrado, escalado con 6 casos, nunca ejecuta sin aprobacion humana).

**Restriccion estructural:** Gesruta es desktop Windows sin API. La automatizacion termina en 'carga asistida'.

---

## Problema 1 — Los documentos originales se pierden

La ingesta recibe el PDF, lo manda a gpt-4o y lo descarta. Se persisten los datos pero no el documento. Ante un reclamo hay que poder presentar el albaran/CMR original.

### Requerimiento 1: archivado documental
1. Todo documento se guarda en Google Drive ANTES de procesarse (si la extraccion falla, el documento no se pierde).
2. Ruta: FACTURACION CLIENTES/FACTURACION LIQUIDOS/{ANO}/FACTURACION {MES} {ANO}/{CLIENTE}. El ano en Drive es '2026' a secas. Usar el Archivador Drive generico (no reimplementar).
3. Problema de secuencia: el CLIENTE se conoce DESPUES de extraer, pero el archivado conviene ANTES. Opciones: a) carpeta transitoria SIN-CLASIFICAR y mover tras extraer; b) archivar despues de extraer con staging del b64 ante fallo; c) doble escritura. Elegir con criterio de robustez sobre parches.
4. Nueva data table `documentos`: nombre, tipo (orden_transporte/cmr/albaran/hoja_chofer/...), cliente, referencia, file_id, ruta, fecha recepcion, canal (webhook/mail), vinculo a viajes. Definir columnas exactas.
5. Canal mail: el Lector de Buzon debe alimentar la misma ingesta sin duplicar la logica de extraccion.

## Problema 2 — Escaneos separados a correlacionar

La ficha semanal del chofer se escanea en UN archivo; la documentacion de cada cliente (albaranes, CMR, OC) llega en OTROS, en otros momentos o canales. Hoy la ingesta asume todo junto.

### Requerimiento 2: correlacion ficha-chofer <-> documentacion-cliente
1. Modelo tipo 'expediente': el VIAJE es la entidad central; acepta documentos de cualquier canal y orden; acumula identificadores.
2. Claves de cruce (todas debiles): fecha carga, cliente, matricula tractora, material, peso aproximado, origen/destino. NO hay clave fuerte unica.
3. Correlacion por scoring con umbral: alto -> asociacion automatica; bajo o empate -> estado `sin_asociar` (bandeja). Definir: formula, pesos, umbral, ventana temporal de candidatos.
4. La bandeja `sin_asociar` es el punto de entrada del Auxiliar Administrativo: propone asociacion como PENDIENTE_APROBACION y el humano decide por Telegram. Scoring determinista en Code node; el agente solo en la excepcion.
5. Caso borde: documento que llega ANTES que la ficha (no existe el viaje). Definir: viaje provisional o espera en bandeja.

---

## Encargo al Equipo de Diseno
Producir especificacion tecnica de las dos piezas:
- Esquema exacto de `documentos` (y cambios a `viajes` si hacen falta).
- Decision fundada sobre secuencia archivar/extraer (3a/3b/3c).
- Flujo de correlacion: scoring con pesos, umbral, ventana, estados (recibido -> archivado -> asociado | sin_asociar) y transiciones.
- Topologia n8n: que se modifica en WD0q9Ic0oDvUoJwp, que es workflow nuevo, donde llaman a las herramientas genericas.
- Contrato de datos correlacion <-> Auxiliar (formato del caso sin_asociar y de la propuesta).
- Plan de tests: incluir empate de candidatos y documento huerfano.

Criterios: logica robusta sobre parches; nada de dominio en herramientas genericas; el humano aprueba, el sistema propone.

## Fuera de alcance
- Gesruta (sin API). Calculo de importes por tarifario (encargo separado). Agentes de Facturacion y Transporte (fase posterior). Defectos de la prueba 479 (encargo directo separado).
