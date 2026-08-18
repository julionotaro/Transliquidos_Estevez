# ÍNDICE — Documentación TLE

> **Leer esto primero, siempre.** No hace falta leer todo lo demás: hace falta saber qué existe y dónde está cada cosa.
> Última actualización: 14/08/2026.

---

## Cómo usar este índice

Cada chat nuevo lee **este archivo** y después solo los documentos que su tarea necesita.

**Regla de precedencia** (cuál manda si dos documentos se contradicen):

1. Las decisiones registradas en este índice (sección "Conflictos resueltos")
2. `modelo-dominio-lectura.md` — fuente de verdad del dominio
3. Los documentos marcados **VIGENTE** abajo
4. Lo demás es histórico: sirve para entender por qué se decidió algo, no para decidir hoy

Si encontrás una contradicción que no está listada abajo, **no la resuelvas por tu cuenta**: preguntá a Julio y después actualizá este índice.

---

## Documentos de dominio y negocio

| Documento | Qué contiene | Cuándo leerlo | Estado |
|---|---|---|---|
| `modelo-dominio-lectura.md` | Cómo se lee un viaje: las dos clases de documento, los 6 datos que facturan, resolución del cliente, peso, llaves de deduplicación y correlación, matrículas, rotaciones Foresa | **Siempre.** Todo encargo arranca acá | **VIGENTE — fuente de verdad** |
| `modelo-estrategico.md` | El porqué del proyecto: objetivo de oficina agéntica, fases, las dos empresas | Al empezar un chat nuevo | **VIGENTE** |
| `reglas-facturacion.md` | Reglas derivadas de contrastar 32 facturas reales de junio 2026: estructura de factura, grupos de indexación, Baltransa, paralizaciones, repartos, rectificativas, clientes menores | Antes de tocar el auditor o cualquier regla de cobro | **VIGENTE — muy denso** |
| `reglas-por-cliente.md` | Matriz por cliente: porte/IVA, fuente del peso, referencia, indexación, precio. Variantes de Foresa | Antes de tocar reglas de un cliente | **VIGENTE con correcciones** |
| `reglas-por-cliente-addendum.md` | Corrige el anterior. HELM: manda el precio del documento | Siempre junto al anterior | **VIGENTE — prevalece** |
| `decisiones-dominio.md` | D-01 a D-05: cantidad a facturar, €/tonelada vs €/viaje, los cuatro regímenes de indexación, grupo por defecto | Antes de tocar cantidad, precio o indexación | **VIGENTE** |
| `decisiones-dominio-indexacion.md` | Detalle de indexación | Al trabajar indexación | Por revisar |
| `catalogo-maestro.md` | Empresas, flota, clientes y rutas frecuentes, estructura de archivo, **ciclo de facturación** | Al armar catálogos de clientes, puntos o rutas | **VIGENTE** |
| `verdad-de-campo-fichas.md` | Los 9 viajes de las 3 fichas reales, leídos dígito por dígito. Patrón para medir cualquier motor de lectura | Al probar o cambiar el modelo que lee fichas | **VIGENTE — congelado** |

## Documentos técnicos

| Documento | Qué contiene | Cuándo leerlo |
|---|---|---|
| `grafo-ingesta-dedup.md` | Tramo nuevo de la ingesta: deduplicación, peso de origen, los 3 nodos nuevos | Al tocar la ingesta |
| `catalogo-puntos.md` | Catálogo canónico de puntos + resolvedor (`catalogo/`): cascada, precedencia doc/ficha, aprendizaje de alias, bootstrap | Al tocar puntos, tarifas o correlación de ruta |
| `correlacion-n2.md` | Correlación N2 doc↔viaje (`correlacion/`): clasificador binario, cascada N1/N2, ventana temporal por tipo de documento, §7 | Al tocar la correlación documento↔viaje |
| `contrato-viaje-v1.md` | Estructura de datos de un viaje, versión actual | Al cambiar campos de un viaje |
| `contrato-viaje.md` | Versión anterior | Solo histórico |
| `validador-factura.md` | Documentación del auditor de facturas | Al tocar el auditor |
| `CORRECCIONES-doc.md` | Cómo funciona la tabla de correcciones | Al tocar la vista de pendientes |
| `deploy-async-tabla-editable.md` | Cómo se desplegó la tabla editable | Histórico |
| `deploy-pendientes-fetch.md` | Cómo se arregló el guardado de la tabla | Histórico |
| `prueba-document-ai.md` | Prueba de Document AI y su resultado | Si se reabre la elección de motor |

## Documentos de estado

| Documento | Qué contiene |
|---|---|
| `ESTADO-Y-TRASPASO.md` | Estado operativo y traspaso entre sesiones |
| `fase2-cierre-y-fase3-bloqueantes.md` | Qué cerró la fase 2 y qué bloquea la fase 3 |
| `verificacion-fix-identidad-cliente-2026-08-04.md` | Verificación del arreglo del campo cliente |
| `brief-v3-oficina-agentica.md` | Brief de la visión de oficina agéntica |

---

## Conflictos resueltos — decisiones de Julio del 14/08/2026

Estas decisiones **mandan sobre cualquier documento** que diga lo contrario.

**R-01 — Fecha de carga: manda la FICHA DEL CHÓFER.**
Es la **excepción** al principio general de §4 del modelo de dominio (donde el documento impreso manda sobre la ficha). Para la fecha de carga, y solo para ella, prevalece lo que escribió el chófer. El resto (cliente, peso, material, matrícula) sigue mandando el documento.

**R-02 — Mínimo facturable: 23 toneladas SIEMPRE.**
Si el peso real es menor a 23 t, se factura 23 t. Sin excepciones por cliente.
*Precisión a confirmar con Julio si alguna vez aplica:* el mínimo se evalúa sobre la **línea facturada**, no sobre cada rotación individual. En Foresa metanol las líneas diarias agregan 26-159 t, con lo cual el mínimo nunca llega a activarse en la práctica.

**R-03 — El documento de Baltransa se titula "ORDEN DE CARGA", igual que Quimidroga y otros.**
El clasificador de documentos debe reconocer "ORDEN DE CARGA" como orden. No asumir que "Orden de Transporte" es el único título posible.

**R-04 — Baltransa: fila desactualizada en `reglas-por-cliente.md`.**
Esa matriz deja Baltransa como "pendiente" en porte/IVA, peso, referencia y precio. Pero `reglas-facturacion.md` y `modelo-dominio-lectura.md` ya lo tienen resuelto:
- IVA 21% siempre, incluso destinos PT/FR
- Precio cerrado (cantidad 1) **o** por tonelada (sufijo /TN) — ambos casos existen
- Referencia = número de Orden de Carga
- Indexación incluida en el precio, con línea a 0,000 en factura
- **Sigue pendiente:** de qué documento sale el peso en Baltransa

---

## Reglas que viven fuera del modelo de dominio

Reglas de negocio reales que hoy están solo en documentos secundarios. Hasta que suban al modelo de dominio, **leerlas donde están**:

- **Ciclo de facturación**: quincenal para todos, mensual para Foresa metanol → `catalogo-maestro.md`
- **Quimidroga España vs Portugal**: por prefijo de referencia (`70xxxx` = España con IVA; `100xxxx` = Portugal sin IVA) → `reglas-por-cliente.md`
- **HELM**: el precio sale del documento, no del tarifario → `reglas-por-cliente-addendum.md`
- **€/tonelada manda sobre €/viaje** cuando el tarifario ofrece ambos (D-02) → `decisiones-dominio.md`
- **Paralización**: se decide comercialmente. El sistema solo puede listarla, nunca calcularla → `reglas-facturacion.md`
- **Repartos**: 90 € por doble destino, **fuera** de la base de indexación → `reglas-facturacion.md`
- **Rectificativas**: una referencia repetida entre facturas puede ser rectificación legítima, no duplicado → `reglas-facturacion.md`
- **Porte e IVA dependen de a quién se factura, no de la geografía**: RNM va sin IVA aunque el viaje sea Vigo→Navia → `reglas-por-cliente.md`
- **Tarifario Foresa desactualizado**: el cargado es de 2025 y junio 2026 factura ~2% por encima → `reglas-facturacion.md`
- **HEC**: no se calculan km de unidad tractora → `ONBOARDING.md`

---

## Datos (fuera de `docs/`)

| Dónde | Qué |
|---|---|
| `datos/` | Exportaciones de Gesruta: puntos geográficos, clientes, chóferes, listado de viajes. **Pendiente de subir por Claude Code** (los CSV grandes no pasan por el ESCRITOR) |
| Tabla `tarifas` (n8n) | Tarifas por cliente y ruta. No van a Git |
| Tabla `indexacion` (n8n) | Tramos de indexación por grupo y fecha. No van a Git |
| Tabla `viajes` (n8n) | Viajes leídos por la ingesta |
| Tabla `correcciones` (n8n) | Correcciones de la oficina sobre lo leído |

---

## Pendientes de dominio (preguntas abiertas para Julio)

- Baltransa: ¿de qué documento sale el peso?
- Tarifa Quimidroga Barcelona→Leiria (no figura en el tarifario 2026)
- Tarifa Foresa 2026 oficial (la cargada es de 2025)
- Solapas de indexación AGENCIA y AUTONOMOS (no estaban en el código)
- Mapear clientes pendientes: HELM ficha, Transportes Santos, Comatra, Villagarcia-Otros

---

## Mantenimiento

Actualizar este índice es parte del cierre de cada sesión. Si se crea un documento y no entra acá, deja de existir a efectos prácticos.

**Nunca copiar reglas de dominio dentro de este archivo ni dentro del ONBOARDING.** Una regla copiada es una regla que va a quedar vieja y contradecir al original. Acá solo van punteros y decisiones.
