# ÍNDICE — Documentación TLE

> **Leer esto primero, siempre.** No hace falta leer todo lo demás: hace falta saber qué existe y dónde está cada cosa.
> Última actualización: 31/08/2026.

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

## ⭐ EMPEZAR POR AQUÍ — `EXTRACCION-Y-CARGA-GESRUTA.md` **VIGENTE**

**Documento maestro de la extracción.** Si tu tarea toca leer fichas o documentos,
resolver cliente / origen / destino / material / chófer / matrícula, calcular
tarifa o régimen de indexación, o escribir prompts: **leelo antes que nada**.

Sale de analizar ~70 páginas de documentación real (9 juegos de ficha +
documentos) y las 8.755 líneas del histórico de Gesruta. Contiene:

- De dónde sale **cada** campo y qué documento manda sobre él (jerarquía por campo)
- Los **formatos por cliente** (FORESA, BRESFOR, QUIMIDROGA, RNM, BALTRANSA,
  TRANSTAMBRE, Q. DEL JARAMA) — dónde está la referencia en cada uno
- Los **conjuntos cerrados** y por qué nada se traduce con criterio libre:
  28 tractoras, 25 chóferes, 558 materiales, ~305 puntos
- El **tarifario histórico**: por qué el oficial no alcanza y cómo se resuelve
- **Régimen de indexación por país del cliente** (no por destino)
- La tabla de los **12 bugs reales** con su causa raíz — para no repetirlos
- **Modalidad de indexación** (§10 bis): por línea o por período, y por qué la
  agregación va por **tramo de pct** y nunca por quincena natural
- **Los tres ejes de la indexación** (§10 ter): grupo, modalidad y período son
  independientes; el % de la OC manda sobre la tabla
- **Suplemento Gasóleo** (§10 quater): los % oficiales y los **cuatro defectos**
  del archivo, entre ellos una fecha corrupta que deja 55 días ambiguos
- **PLAN-FUNCIONAMIENTO-INTEGRAL.md**: inventario COMPLETO de falencias con su
  causa raíz verificada y el orden de cierre. Leerlo antes de tocar la ingesta.
- **Vista viajes-pendientes**: muestra el FORMATO OBJETIVO completo (23+ columnas:
  identidad + códigos Gesruta + Precio/Ud./Importe/Rég./Quinc./Origen del precio).
  Lee Viajes + Puntos + Tarifas. El precio es el contractual (tabla Tarifas); para
  viajes incompletos queda vacío (honesto).
- **Código de cliente Gesruta** (`catalogo/clientes-gesruta.js`): nombre → código,
  minado del CSV de facturación; es el que faltaba para las columnas amarillas
- **KM** (§11): por qué la cadena de km vacíos va por **tractora** y no por ficha,
  y el padrón de últimos odómetros que se persiste entre ingestas
- Qué **NO** debe hacer el sistema nunca

Notas del análisis documento por documento: `analisis/A..H.md`.

**Precedencia:** este documento manda sobre lo que digan los archivos históricos
en materia de extracción. Si contradice a `modelo-dominio-lectura.md`, gana
`modelo-dominio-lectura.md` en el modelo de dominio y éste en las reglas de
extracción concretas.


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
| `contrato-viaje-v1.md` | Estructura de datos de un viaje, versión actual | Al cambiar campos de un viaje |
| `contrato-viaje.md` | Versión anterior | Solo histórico |
| `validador-factura.md` | Documentación del auditor de facturas | Al tocar el auditor |
| `CORRECCIONES-doc.md` | Cómo funciona la tabla de correcciones | Al tocar la vista de pendientes |
| `deploy-async-tabla-editable.md` | Cómo se desplegó la tabla editable | Histórico |
| `deploy-pendientes-fetch.md` | Cómo se arregló el guardado de la tabla | Histórico |
| `prueba-document-ai.md` | Prueba de Document AI y su resultado | Si se reabre la elección de motor |
| `CORTE-ANTES-DE-PRUEBAS.md` | **Estado real al cerrar el desarrollo (31/08): qué quedó cerrado y qué FALTA para que una prueba signifique algo.** Incluye los dos bloqueantes | **Antes de correr las pruebas definitivas** |

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

**R-05 — Por qué falla la búsqueda de tarifa: el tarifario está INCOMPLETO. No es un problema de nombres.** *(27/08/2026, medido)*
Se había supuesto que el tarifario indexaba por **provincia** y el registro de viajes por **planta consignataria** — dos vocabularios distintos para el mismo punto. **Los datos lo desmienten:** los literales del tarifario están en el catálogo de puntos 294/294 (100%) y los de los viajes 293/295 (99%); las dos tablas mezclan provincia/pueblo/empresa en la misma proporción. **Beben del mismo catálogo de 790 puntos.**
La causa real: de esos 790, 294 aparecen en tarifas y 295 en viajes, pero **solo 152 en las dos**. Hay 143 puntos a los que se viaja sin tarifa cargada — 532 combinaciones cliente×ruta×material, **1.973 viajes (26% del año)**.
Cuando el destino no está tarifado, la oficina aplica a mano la tarifa de otra ruta del mismo cliente+origen (ver `catalogo/tarifario-historico.js`). Eso deja huella: el importe coincide **al céntimo**. Los candidatos detectados así están en `catalogo/tarifa-por-analogia.json`.
**Consecuencia de diseño:** completar alias entre tarifario y viajes no arregla nada, porque no hay nada que traducir ahí. Lo que resuelve estas rutas es el **tarifario histórico**. El problema de alias es **otro y separado**: literal-del-documento → punto del catálogo.

**R-06 — El modelo NO aprende entre corridas; el sistema sí.** *(27/08/2026)*
GPT/Claude no retienen nada de una ejecución a la siguiente: sin cambios, la corrida 500 sale igual que la corrida 1. Lo que puede aprender es el sistema, y el sitio donde aprende es `ficha/memoria-decisiones.js`: **una duda que un humano resolvió no se vuelve a preguntar**. Solo entra lo decidido por un humano (con autor), el ámbito del cliente manda sobre la regla global, y toda entrada es revocable.
**El número por el que se mide:** `tasaRevisar()`. Si el % de filas en REVISAR no baja semana a semana, el sistema no está aprendiendo — y hay que mirar eso, no ajustar prompts.

**R-07 — La referencia de FORESA y BRESFOR sigue reglas OPUESTAS.** *(31/08/2026, decisión de Julio)*
Los dos emiten documentos casi idénticos —mismo diseño, dos números arriba a la derecha— y la regla es la contraria en cada uno:

| Cliente | Cuál manda | Formato | Ejemplos |
|---|---|---|---|
| **FORESA** | el **2º** número, bajo `CMR/ALBARAN` | **7 dígitos** | `2016400`, `2017065` |
| **BRESFOR** | el **1º** número, tras `Doc. int:` | **10 dígitos** | `5050139934`, `5050139937` |

**Consecuencia de diseño:** la referencia **no** se puede extraer con una regla común de "documento tipo CMR". Hay que identificar primero al **emisor** (casilla 1 / remitente) y recién después aplicar su regla. Anclas y campos: `catalogo/plantillas-cliente.json`.

**R-08 — Para facturar manda el peso de CARGA (albarán/CMR).** *(31/08/2026, decisión de Julio)*
El ticket de báscula de la planta que **descarga** (`MOVIMIENTO MERCANCIA` de FINSA o FORESA) **no se usa para facturar**, aunque dé un neto distinto (21.980 en carga vs 21.960 en descarga); sirve sólo como corroboración. Y dentro de los documentos de carga manda la **carta de porte / albarán** sobre la **OC**, porque la OC trae el previsto redondo: verificado en 3 juegos de Quimidroga (OC 24.000 → real 24.040 / 23.980; OC 25.000 → real 24.300). Cierra la falencia **F6** del plan.

**R-09 — Destino de RNM: manda la GUÍA REMESSA.** *(31/08/2026, Julio invirtió el orden)*
Jerarquía: **Guía Remessa** (`Morada de Entrega`) → CMR casilla 3 → OC. Motivo verificado sobre 3 juegos: cuando el CMR lo emite un **tercero** y RNM figura como *consignatario*, su casilla 3 trae la sede de RNM (Carreira, Portugal) y no el destino real — pasó en el viaje Avilés→Nogales. La guía es correcta en los tres.
La **referencia** de RNM mantiene el orden original: observación de la OC (si la trae) → **Guía Remessa** `Número/Number`, 10 dígitos (fuente habitual) → CMR casilla 5.

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
| `datos/gesruta/` | **Los export originales de Gesruta, versionados** (27/08/2026): `viajes-anio-2026-08-19.xls` (8.755 líneas), `tarifas-general-2026-08-04.xls` (704 tarifas), `puntos-geograficos-2026-08-27.csv` (807 puntos, **cp850**), `linea-facturacion-2026-08-26.csv`. Están en el repo a propósito: cuando se pasaban por chat, cada contenedor nuevo los perdía y había que volver a pedirlos |
| `datos/` | Otras exportaciones y resúmenes derivados |
| `catalogo/rutas-por-cliente.json` | **Conjunto CERRADO de rutas por cliente** con la tarifa observada, frecuencia y última fecha. Lo genera `herramientas/construir-matriz-rutas.py` desde el export anual. Sirve para preguntar "¿cuál de las rutas de ESTE cliente es?" en vez de "¿cuál de los 790 puntos es?" |
| `catalogo/tarifa-por-analogia.json` | Candidatos donde la oficina cobra la tarifa de **otra** ruta del mismo cliente+origen (detectados por coincidencia exacta de importe). `confirmado: false` ⇒ **no se factura con ellos** hasta que Julio los valide |
| `informes/rutas-sin-tarifa.md` | Qué rutas reales no cubre el tarifario y **por qué**. Regenerable, no escrito a mano |
| `catalogo/plantillas-cliente.json` | **QUÉ y DÓNDE buscar cada campo, por emisor**: la etiqueta ancla, el formato, y los números que PARECEN el dato y no lo son. FORESA, BRESFOR, RNM y QUIMIDROGA **confirmados por Julio**. Lo pone a trabajar `ficha/plantillas.js` (prompt + guarda de referencia) |
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
