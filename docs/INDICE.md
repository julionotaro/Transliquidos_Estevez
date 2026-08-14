# ÍNDICE — Documentación TLE

> **Leer esto primero, siempre.** No hace falta leer todo lo demás: hace falta saber qué existe y dónde está cada cosa.
> Última actualización: 14/08/2026.

---

## Cómo usar este índice

Cada chat nuevo lee **este archivo** y después solo los documentos que su tarea necesita, según la columna "Cuándo leerlo".

**Regla de precedencia** (cuál manda si dos documentos se contradicen):

1. `modelo-dominio-lectura.md` — fuente de verdad del dominio
2. Los documentos marcados **VIGENTE** abajo
3. Lo demás es histórico: sirve para entender por qué se decidió algo, no para decidir hoy

Si encontrás una contradicción que no está listada en "Conflictos abiertos", **no la resuelvas por tu cuenta**: preguntá a Julio y después actualizá este índice.

---

## Documentos de dominio y negocio

| Documento | Qué contiene | Cuándo leerlo | Estado |
|---|---|---|---|
| `modelo-dominio-lectura.md` | Cómo se lee un viaje: las dos clases de documento, los 6 datos que facturan, resolución del cliente, peso, llaves de deduplicación y correlación, matrículas, rotaciones Foresa | **Siempre.** Todo encargo arranca acá | **VIGENTE — fuente de verdad** |
| `modelo-estrategico.md` | El porqué del proyecto: objetivo de oficina agéntica, fases, las dos empresas (TLE y Hnos. Estévez Casal) | Al empezar un chat nuevo, para entender el rumbo | **VIGENTE** |
| `reglas-facturacion.md` | Reglas derivadas de contrastar 32 facturas reales de junio 2026: estructura de factura, grupos de indexación, Baltransa confirmado, paralizaciones, repartos, rectificativas, y una lista larga de clientes menores | Antes de tocar el auditor de facturas o cualquier regla de cobro | **VIGENTE — muy denso, poco conocido** |
| `reglas-por-cliente.md` | Matriz por cliente: porte/IVA, fuente del peso, qué referencia usar, indexación, precio. Variantes de Foresa | Antes de tocar reglas de un cliente concreto | **VIGENTE con excepciones** (ver conflictos) |
| `reglas-por-cliente-addendum.md` | Corrige el anterior. Resuelve HELM: manda el precio del documento, no el tarifario | Siempre junto al anterior | **VIGENTE — prevalece sobre `reglas-por-cliente.md`** |
| `decisiones-dominio.md` | Decisiones D-01 a D-05: cantidad a facturar, €/tonelada vs €/viaje, los cuatro regímenes de indexación, grupo por defecto | Antes de tocar cantidad, precio o indexación | **VIGENTE** |
| `decisiones-dominio-indexacion.md` | Detalle de indexación | Al trabajar indexación | Por revisar |
| `catalogo-maestro.md` | Empresas, flota, clientes y rutas frecuentes, estructura de archivo, **ciclo de facturación (quincenal salvo Foresa metanol, que es mensual)** | Al armar catálogos de clientes, puntos o rutas | **VIGENTE — contiene reglas que no están en el modelo de dominio** |
| `verdad-de-campo-fichas.md` | Los 9 viajes de las 3 fichas reales, leídos dígito por dígito. Es el patrón contra el que se mide cualquier motor de lectura | Al probar o cambiar el modelo que lee fichas | **VIGENTE — congelado, no modificar** |

## Documentos técnicos

| Documento | Qué contiene | Cuándo leerlo |
|---|---|---|
| `grafo-ingesta-dedup.md` | Cómo funciona el tramo nuevo de la ingesta: deduplicación, peso de origen, los 3 nodos nuevos | Al tocar la ingesta de viajes |
| `contrato-viaje-v1.md` | Estructura de datos de un viaje, versión actual | Al cambiar qué campos guarda un viaje |
| `contrato-viaje.md` | Versión anterior del anterior | Solo consulta histórica |
| `validador-factura.md` | Documentación del auditor de facturas | Al tocar el auditor |
| `CORRECCIONES-doc.md` | Cómo funciona la tabla de correcciones | Al tocar la vista de pendientes |
| `deploy-async-tabla-editable.md` | Cómo se desplegó la tabla editable | Consulta histórica |
| `deploy-pendientes-fetch.md` | Cómo se arregló el guardado de la tabla | Consulta histórica |
| `prueba-document-ai.md` | Prueba de Document AI y su resultado | Si se reabre la elección de motor de lectura |

## Documentos de estado

| Documento | Qué contiene | Cuándo leerlo |
|---|---|---|
| `ESTADO-Y-TRASPASO.md` | Estado operativo y traspaso entre sesiones | Al empezar un chat |
| `fase2-cierre-y-fase3-bloqueantes.md` | Qué cerró la fase 2 y qué bloquea la fase 3 | Al planificar |
| `verificacion-fix-identidad-cliente-2026-08-04.md` | Verificación del arreglo del campo cliente | Consulta histórica |
| `brief-v3-oficina-agentica.md` | Brief de la visión de oficina agéntica | Al planificar a largo plazo |

---

## Conflictos abiertos (NO resolver sin preguntar a Julio)

**C-01 — Fecha de carga: ¿manda la ficha o el documento?**
`reglas-por-cliente.md` dice que si la ficha del chófer y el documento discrepan, **prevalece la ficha**. `modelo-dominio-lectura.md` §4 establece como principio general que **el documento manda sobre la ficha**. Si la fecha es la excepción a esa regla, hay que escribirlo explícitamente en el modelo de dominio.

**C-02 — Mínimo de 23 toneladas: ¿siempre?**
`reglas-por-cliente.md` dice que si el peso real es menor a 23 t se factura 23 t, sin excepciones. `reglas-facturacion.md` dice que Foresa metanol Villagarcía→Caldas se factura por tonelaje real **sin mínimo**. Falta además confirmar si aplica a Baltransa por tonelada.

**C-03 — Baltransa figura como "pendiente" en un documento y confirmado en otro.**
`reglas-por-cliente.md` lo deja pendiente; `reglas-facturacion.md` y `modelo-dominio-lectura.md` ya lo tienen resuelto. La matriz por cliente está desactualizada en esa fila.

**C-04 — Cómo se titula el documento de Baltransa.**
`reglas-facturacion.md` dice que se titula "ORDEN DE CARGA Nº", no "Orden de Transporte". Importa para clasificar documentos automáticamente.

---

## Reglas que viven fuera del modelo de dominio

Estas son reglas de negocio reales que hoy están solo en documentos secundarios. Hasta que suban al modelo de dominio, **hay que leerlas donde están**:

- **Ciclo de facturación**: quincenal para todos, mensual para Foresa metanol → `catalogo-maestro.md`
- **Quimidroga España vs Portugal**: se distingue por el prefijo de la referencia (`70xxxx` = España con IVA; `100xxxx` = Portugal sin IVA) → `reglas-por-cliente.md`
- **HELM**: el precio sale del documento, no del tarifario → `reglas-por-cliente-addendum.md`
- **€/tonelada manda sobre €/viaje** cuando el tarifario ofrece ambos (D-02) → `decisiones-dominio.md`
- **Paralización**: se decide comercialmente, no hay regla. El sistema solo puede listarla, nunca calcularla → `reglas-facturacion.md`
- **Repartos**: 90 € cuando un camión tiene dos destinos, y queda **fuera** de la base de indexación → `reglas-facturacion.md`
- **Rectificativas**: una referencia repetida entre facturas puede ser una rectificación legítima, no un duplicado → `reglas-facturacion.md`
- **Porte e IVA dependen de a quién se factura, no de la geografía**: RNM es portuguesa, va sin IVA aunque el viaje sea Vigo→Navia → `reglas-por-cliente.md`
- **Tarifario Foresa desactualizado**: el cargado tiene vigor 2025-01-01 y junio 2026 factura ~2% por encima → `reglas-facturacion.md`

---

## Datos (fuera de `docs/`)

| Dónde | Qué |
|---|---|
| `datos/` | Exportaciones de Gesruta: puntos geográficos, clientes, chóferes, listado de viajes. **Pendiente de subir** |
| Tabla `tarifas` (n8n) | Tarifas por cliente y ruta. No van a Git |
| Tabla `indexacion` (n8n) | Tramos de indexación por grupo y fecha. No van a Git |
| Tabla `viajes` (n8n) | Viajes leídos por la ingesta |
| Tabla `correcciones` (n8n) | Correcciones hechas por la oficina sobre lo leído |

---

## Mantenimiento de este índice

Actualizarlo es parte del cierre de cada sesión de trabajo. Si se crea un documento nuevo y no entra acá, deja de existir a efectos prácticos: nadie va a saber que está.
