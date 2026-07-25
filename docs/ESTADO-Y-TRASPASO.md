# Estado y traspaso - Transliquidos Estevez (25/07/2026)

Documento de handoff. Estado real, no optimista.

---

## 1. EL BLOQUEO PRINCIPAL

**La extraccion de la ficha manuscrita del chofer no funciona con calidad utilizable.** Todo lo demas del circuito depende de ella y esta esperando.

Probado contra una ficha real conocida (PDF de 3 fichas: Asensi/2498KZL, Pablo Carles/8420KKT, Marcos/3729JLH):

| | GPT-4o | GPT-5 |
|---|---|---|
| Viajes detectados | 6 de 9 | 9 de 9 |
| Ano | 2022 (inventado) | 2026 correcto |
| Odometros | secuencias +300 / +2000 inventadas | null (no inventa) |
| km recorridos | fabricados | valores reales pero desordenados entre bloques |
| Gastos | 1 de 3 correcto | ninguno |
| Pesos (kg) | null | null |
| Matriculas | 1 de 3 correcta | 1 de 3 correcta |

Conclusion: GPT-5 falla de forma mas segura (deja null en vez de inventar) pero no lee mejor. Ninguno de los dos produce datos suficientes para cargar viajes.

**Importante:** la informacion SI esta legible en el papel. Un humano lee las fichas sin problema. El fallo es del modelo leyendo PDF escaneado, no del documento.

### Causa tecnica sospechada, no confirmada
El PDF se envia a OpenAI como `type: file`. Para manuscrito eso rinde peor que una imagen en alta resolucion con `detail: high`. n8n no puede rasterizar PDF a imagen de forma nativa. Se descarto escanear a JPG porque la oficina solo puede sacar PDF.

### Caminos NO probados todavia
1. **Gemini** (1M contexto, menor costo, 93% en benchmark de manuscrito 2026 vs 95% GPT-5). API distinta a OpenAI: endpoint, credencial y el PDF va como `inline_data`. ~20 min de trabajo + API key de Google AI Studio.
2. **OCR especializado antes del LLM**: Google Document AI, Azure Document Intelligence, Mistral OCR. Extraen texto y el LLM solo estructura.
3. **Rasterizar el PDF** en un servicio externo o contenedor aparte antes de mandarlo.
4. **Cambiar el papel**: que el chofer llene un formulario digital en vez de manuscrito. Elimina el problema de raiz. Es la opcion mas confiable y la menos tecnica.
5. **Captura asistida**: el operador tipea 4-5 campos clave (fecha, matricula, kg, km) y el sistema hace el resto. Reduce el problema a lo que el modelo si lee bien.

---

## 2. SEGUNDO BLOQUEO: el webhook sincrono

GPT-5 tarda 144 segundos. El formulario web se queda esperando y el navegador corta con "failed to fetch" aunque el workflow termine bien. Con escaneo en serie de 15 paginas es peor.

**La ingesta tiene que pasar a asincrona** antes de seguir probando modelos: entra el archivo, responde "recibido" al instante, procesa por detras, resultado a la tabla y al Sheet. Si no, cada prueba hay que leerla desde la ejecucion de n8n.

---

## 3. LO QUE SI FUNCIONA Y ESTA PUBLICADO

| Pieza | ID | Estado |
|---|---|---|
| [ACTIVO] Archivador Drive | 2bgdkH6nW4EtnEQw | Subir + mover. Raiz `1bT45GYDALNuVPXOB-POQyio4Di0S-eah` |
| [ESTEVEZ] Auditar Factura | IlIod0DlephaLmAV | Validador v2, lee tarifas e indexacion en vivo |
| [ESTEVEZ] Export Viajes Excel | ObSZK7wHv4k9oFi6 | GET /webhook/export-viajes |
| [ESTEVEZ] Ingesta Viaje | WD0q9Ic0oDvUoJwp | v3: dos pasadas + correlacion + guardas |

**El validador de facturas es la pieza mas valiosa y esta terminada.** Detecta referencias duplicadas intra-factura (caso real: fra 295), indexacion con porcentaje equivocado, IVA mal calculado, Baltransa sin 21%, y contrasta importes contra tarifario. Eso encuentra dinero. No depende de la ficha manuscrita.

### Tablas
- `tarifas` (Siwhv2AUWTSeFlrJ): 540 filas. FORESA 157 (2025 y 2026), QUIMIDROGA 238, HELM 69, RNM 55, JARAMA 19.
- `indexacion` (or1otD9WsjJ3V8Cr): 70 tramos, 6 solapas oficiales del Excel SUPLEMENTO_GASOLEO.
- `Viajes` (lrBxWpTUxMtO8U48): 26 columnas aplanadas. VACIA.
- `hojas` (JGTTKMagiTfGY3Em): 13 columnas. VACIA.
- `gastos` (AuxJzNObrY24MK4j): 6 columnas. VACIA.
- `documentos` (SmmE2PIufLwrfztM): VACIA.

### Arquitectura de la ingesta v3
Dos pasadas independientes sobre el mismo PDF, sin partirlo:
- Pasada A: solo fichas manuscritas (modelo configurable en `MODELO_FICHAS`)
- Pasada B: solo documentos impresos (`MODELO_DOCS`, gpt-4o, funciona bien)
- Correlacion en codigo por matricula + ventana de fechas + peso. El modelo NO correlaciona.

El payload se arma segun familia de modelo: gpt-5 y modelos de razonamiento rechazan `max_tokens` y `temperature != 1`; usan `max_completion_tokens`.

### Guardas anti-fabricacion (funcionan, verificadas)
- Odometros identicos en toda la hoja -> se anulan + error
- km cargados multiplo exacto de 500 -> se anulan (cubre hojas de un solo viaje)
- Ano fuera de rango +/-1 del actual -> anula la fecha
- km_recorridos de la ficha vs final-inicio: diferencia > 5 km -> error
- Viaje sin documentacion -> error, estado `sin_documentacion` (regla D-2)
- Peso de ficha identico al del documento en todos los viajes -> aviso de posible copia

---

## 4. ERRORES COMETIDOS EN ESTA SESION (para no repetirlos)

1. **Afirme haber implementado las dos pasadas sin haberlo hecho.** Describi el diseno como si estuviera aplicado. Verificar siempre contra las llamadas reales.
2. **Puse `0` como marcador de tipo en el esquema JSON.** El modelo lo copiaba literal y entraban ceros a la base como si fueran datos. Los marcadores deben ser `null`.
3. **Construi la busqueda de tarifario solo en el validador de facturas, no en la ingesta.** La ingesta sigue diciendo "PENDIENTE (tabla tarifas)". Falta portarlo.
4. **Implemente la estructura de carpetas sin el nivel `FRA {NNN}`** ni el renombrado por referencia. Se descubrio despues contra el ZIP real de junio.
5. **Hice `km_recorridos` obligatorio** cuando en muchas fichas no esta escrito. Es opcional: el calculo lo hace el codigo, el campo escrito es verificacion.

---

## 5. DECISIONES CERRADAS (no reabrir)

- D-1 Entrada = carpeta de Drive vigilada. Se instala Drive para escritorio. NO mail desde escaner.
- D-2 Viaje sin documentacion escaneada BLOQUEA la facturacion.
- D-3 Datos de prueba descartados, modelo de datos limpio.
- D-4 Minimo 23 t aplica a todos los clientes por tonelada, incluido metanol Foresa.
- D-5 Cliente sin regla de indexacion -> solapa OTROS con aviso.
- D-6 Ruta sin tarifa cargada -> aviso, no bloquea.
- D-7 Paralizacion se determina comercialmente. El sistema la lista, nunca la calcula.
- D-8 Repartos: 90 EUR por doble destino, fuera de la base de indexacion.
- D-9 Indexacion por tramo de fechas segun fecha del VIAJE. Los tramos no son quincenas fijas.
- D-10 Escaneo en serie es obligatorio. Una ficha por PDF retrasa demasiado la oficina.
- D-11 Solo PDF. El escaner no saca JPG.

---

## 6. PENDIENTES ABIERTOS

### Dominio (falta respuesta del cliente)
- Baltransa por tonelada: aplica el minimo 23 t?
- Clavo Food Factory: criterio 1,52 vs 1,31 EUR/km.
- Tarifas sin cargar: TRANSTAMBRE, TANK SOLUTIONS, TRANSPORTES SANTOS, FORESTAL DEL ATLANTICO, HISPALENSE, CB SYSTEM OIL, BALTRANSA.
- Datos sospechosos del Excel QUIMIDROGA a confirmar: Barcelona->LLEIDA 470,00 EUR/tn (posible typo de 47,00); vigencias sueltas 2026-12-15 y 2025-01-15; rutas Italia con 1.500-3.500 en columna EUR/tn (parecen precio cerrado por viaje).

### Tecnico
- Verificar en la UI que el nodo `Mover Archivo` del Archivador quedo con la credencial `Drive Oficina`. Los nodos HTTP creados por MCP no la reciben automaticamente.
- Fase 1b (mover a carpeta de cliente tras extraccion) NUNCA se probo.
- Portar la busqueda de tarifario a la ingesta.

### Fases sin empezar
- F2 Canal Drive: carpeta vigilada, router de clasificacion, manejo de archivo parcial por sincronizacion.
- F3 Correlacion documento-viaje y tablero PENDIENTES.
- F4 Google Sheet de consulta (VIAJES, DOCUMENTOS, GASTOS, PENDIENTES).
- F5 Cierre de factura: previsualizacion con bloqueo D-2, mover a `{CLIENTE}/FRA {NNN}/`, renombrar cada PDF por su referencia. Requiere agregar accion `renombrar` al Archivador.

---

## 7. LECTURA HONESTA DE POR QUE ESTAMOS ESTANCADOS

Se consumieron muchos ciclos iterando sobre la calidad de lectura del manuscrito, que es la parte mas dificil de todo el sistema, mientras el resto del circuito (mas cerca de terminar) espera.

Dos recomendaciones para retomar:

**Primera: desacoplar.** El validador de facturas ya funciona y no depende de la ficha. Se puede poner en uso en la oficina hoy: cargan la factura de Gesruta antes de enviarla y el sistema la audita contra tarifario e indexacion. Eso entrega valor sin esperar a resolver el manuscrito.

**Segunda: cuestionar el papel.** Antes de seguir probando modelos, evaluar si la ficha manuscrita tiene que seguir siendo manuscrita. Un formulario digital que el chofer complete (movil o papel con casillas OCR-friendly) elimina el problema entero. Ninguna mejora de modelo va a ser tan fiable como no tener que leer letra a mano.
