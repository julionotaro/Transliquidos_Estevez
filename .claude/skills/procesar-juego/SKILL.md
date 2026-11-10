---
name: procesar-juego
description: "Procesa un juego nuevo (ficha de chofer + documentos de transporte) de Transliquidos Estevez: lo lee, aplica las reglas de negocio, resuelve codigos de Gesruta y genera la orden.json + fila(s) del libro maestro + archivo. Usalo cuando Julio suba un viaje a entrada/ y pida procesarlo o generar su orden."
---

# Procesar un juego → orden.json (Transliquidos Estévez)

Convierte los PDFs de un juego (ficha + docs) en una **orden de carga** lista para el bot, una
fila por albarán en el libro maestro, y los documentos archivados. Es facturación real:
**no inventar, fallar ruidoso, null antes que dato plausible, revisión humana antes que
corrección automática.**

Rol: sos la **etapa 1 (extracción)**. La **etapa 2 (carga en Gesruta)** la hace el bot local
leyendo la orden.json. Vos NO cargás en Gesruta.

## 0. Contexto obligatorio (leer antes de tocar nada)
1. `CLAUDE.md` → `docs/INDICE.md` (mapa) → **`catalogo/correcciones-julio.json`** (reglas, la
   fuente de verdad; aplicarlas ANTES de escribir). También `ordenes-carga/CONTRATO-orden-json.md`
   (formato) y `docs/flujos-carga.md` (tipos de flujo).
2. Rama **`main`**. `git fetch origin main && git reset --hard origin/main`.

## 1. Leer los PDFs
- **Contar las páginas del escaneo y leerlas TODAS** (`doc.page_count`). Un juego trae varias páginas
  (ficha + OC + **CMR/albarán** + báscula); el CMR/albarán con el **peso real** suele ir en página
  aparte de la OC. Saltear páginas = facturar el previsto de la OC (error 03/11 Abalo; ver D-01/R-08).
- Rasterizar con **pymupdf** (`fitz`) a PNG `Matrix(2.1–2.2)` y leer las imágenes (no hay poppler).
  Para dígitos dudosos (km, odómetros) recortar y ampliar (`Matrix(5–7)`). Cuidado 5↔9.
- **Ficha del chofer:** chofer, tractora (cabeza = matrícula sin letras), remolque, y por viaje:
  fecha carga/descarga, lugar carga/descarga, mercancía, cantidad, km inicio/fin, km recorridos,
  vacíos. Verificar matrícula/remolque/chofer contra `ficha/flota.js` (padrón real).
- **Documentos:** por albarán → cliente, origen, destino, referencia, **peso** (del CMR/albarán/báscula
  de carga — **NUNCA de la OC**, que trae el previsto redondo; D-01/R-08), fechas.

## 2. Reglas clave (resumen; la verdad está en correcciones-julio.json)
- **Tipo de chofer:** AUTÓNOMO si el **apellido** (token exacto, NO substring) es
  **ABAL, FRAGA o ALFONSIN** (ojo: ABAL ≠ ABALO/ABELO). El resto, PROPIO. → `cabecera.tipo`.
  Autónomo: km (carga+vacío de la ficha) van en Gastos, sin viáticos → la orden trae `km.vacio`.
- **Referencia por cliente:** FORESA = Nº corto que empieza en **20** (no el 5030…). BRESFOR =
  el que empieza en **5050** (doc int / albarán FINSA). QUIMIDROGA = "Referencia en factura".
  RNM = guía de remessa (10 díg empieza en 0) / carta de porte. HELM = Nº de orden de flete.
- **Carga:** siempre por **código** (catálogo `datos/gesruta/materiales.csv`). Resinas (RES xxxx)
  → COLA (cod 1).
- **Cliente/origen/destino:** por código. Resolver con `catalogo/` (clientes, puntos-alta,
  alias-empresa-punto, rutas-por-cliente). Usar el punto que **tiene la tarifa** (ej. Teruel = TE,
  no UTISA TERUEL). Si el punto no existe en Gesruta → `destino.codigo: null` + `_bloqueo`.
- **Tarifa:** €/TN por defecto. Prioridad: tarifario de cliente (`datos/gesruta/tarifarios/`) >
  general. Cascada/analogía en `tarifa-por-analogia.json` (solo confirmadas). Peso FORESA = albarán.
- **Concepto/IVA:** nacional P (IVA 21), internacional PI (IVA 0). QUIMIDROGA y HELM facturan
  Portugal como nacional. BRESFOR (Aveiro, cod 42) es internacional PI.
- **Indexación:** solo **G** (nacional) / **GPT** (internacional). Rutas FORESA Caldas→Orember y
  Villagarcía→Caldas (Metanol): el importe se calcula y guarda, pero va con **`cargar: false`**
  (no se carga por albarán; se acumula en facturación). Baltransa: línea de porte + línea idx
  con cantidad 1 e importe 0.
- **Viaje nuevo si cambia tractora o remolque** (Gesruta necesita otro viaje para las matrículas).

## 2 bis. Cliente CLAVO (FRIGOS) — facturación POR KM (rama aparte)

Si el cliente es **CLAVO FOOD FACTORY** (código `4`), el modelo es **distinto**: se factura
**por kilómetro**, no por TN. Guía completa en **`docs/cliente-CLAVO-frigos.md`**. Resumen:

- **Papeles:** **parte/hoja de ruta** (con el **odómetro** inicio/fin de cada tramo + dietas) +
  **talones de porte** TLE (1 por tramo, con `K ≤ km` y `km × €/km`) + albaranes de terceros (prueba).
- **Por tramo extraé:** origen (**1er punto** si hay varias cargas) + lista de orígenes (→ **Campo1**);
  **destino = último** + lista de destinos si hay varios repartos (→ **Campo2**); carga
  (CONGELADO/PAN RALLADO/…), **odómetro inicio/fin**, km vacío, fecha carga/descarga. El **sentido lo
  deriva el armador** (S/R/U/C de origen/destino/km); no se lee.
- **La tarifa NO se teclea del talón:** la resuelve el armador por sentido + mes
  (`catalogo/tarifas-clavo.json`); y el **sentido lo DERIVA solo** de origen/destino/km (no hace falta
  declararlo). El `raw` del tramo lleva: `cliente_lit` (CLAVO → el armador detecta modo km),
  `origen_lit` (1er) + `origenes` (→ Campo1), `destino_lit` (último) + `destinos` (→ Campo2), `km_facturable`
  (= odómetro fin − inicio), `km_inicio`/`km_fin`/`km_vacio`, `carga_lit`, `salida`/`llegada`.
  Todos los albaranes de la ficha van en **UN viaje** (una ficha = un viaje de Gesruta).
- **Excel como `.xlsx`** (para abrir/pegar directo): `python3 -I herramientas/armar_orden/excel_frigos_xlsx.py <orden.json> <salida.xlsx>` (mismas columnas, fechas y números tipados).
- **Dos salidas** (flujo objetivo): la **orden.json** (armador, modo km) **y** las **filas del Excel
  FRIGOS** para pegar: `node herramientas/armar_orden/excel_frigos.js <orden.json>` (TSV, columnas A–Q).
- **Dietas, palets, gasoil, AdBlue, otros gastos:** control interno del Excel (de la parte); **NO** se
  cargan a Gesruta por ahora.
- **Puntos:** el resolver usa la **base completa de Gesruta** (`catalogo/puntos-gesruta-base.json`)
  por debajo de los curados → **no hay que dar de alta a mano** (salvo puntos agregados a Gesruta
  después del export). **Pendiente:** el **% de índice del mes** (agregado, se cierra en facturación).
- **Archivado (igual que los químicos):** cliente `CLAVO`. La **parte/ficha** del chófer va a
  `ordenes/`; el **talón + sus albaranes de entrega** a `procesados/CLAVO/<AAAA-MM>/` en **un PDF por
  tramo** (ver `docs/nomenclatura-archivos.md`, sección CLAVO).

## 3. Generar la salida (con las herramientas; NO a mano)
1. **Escribir el `raw`** del juego en `herramientas/armar_orden/raw/<chofer-slug>-<AAAA-MM-DD>.json`
   (formato: mirar cualquier raw existente). Incluir siempre:
   - `"escaneo": "<nombre del PDF de entrada>"` en la raíz;
   - `peso_kg` = el **peso REAL del documento** (nunca el mínimo 23.000 ya aplicado; el mínimo lo
     aplica el armador), también en los de precio fijo si el documento lo trae;
   - números **sin comillas**; `cabeza` **con comillas** (conserva el cero: `"03729"`);
   - notas propias de un albarán en `"_obs": "..."` (van a las observaciones del registro).
2. **Armar la orden:** `node herramientas/armar_orden/armar_orden.js <raw> <carpeta>/orden.json`.
   El comando **valida el raw primero**: si dice `RAW CON ERRORES`, corregir el raw (no usar
   `--forzar`). Los `AVISOS DE LECTURA` hay que **mirarlos contra el papel** (odómetro que retrocede,
   peso fuera de rango, referencia que ya está en el registro = posible juego repetido…).
   Carpeta: `ordenes-carga/ordenes/<AAAA-MM>/<chofer-slug>/<AAAA-MM-DD>/` (mes y fecha = primera
   fecha de carga), junto a la **ficha** copiada ahí (`ficha_<ts>.pdf`). Un orden.json por juego.
3. **Libro maestro:** `node herramientas/armar_orden/registro_filas.js <raw> --agregar` genera y
   agrega las filas (28 columnas, cuentas y formato correctos). **No escribir filas a mano.**
   Sin `--agregar` solo las muestra. Rechaza referencias que ya están en el registro.
- Si un albarán sale con **`INDEXACION PENDIENTE`** (falta el % del tramo en
  `datos/gesruta/indexacion-gasoleo.json`): la línea de índice va con el factor vacío y la fila
  queda `INDICE_PENDIENTE`. **Avisar a Julio**; cuando esté el %, regenerar orden y fila.
- **Archivo de documentos:** un PDF por albarán, renombrado por su referencia, en
  `procesados/<CLIENTE>/<AAAA-MM>/`. **El PDF del albarán debe contener la OC + la documentación
  de carga (CMR / albarán de carga / báscula) en UN SOLO archivo**, no la OC y la carga por separado
  (regla Julio 05/11). Si las páginas vienen sueltas en el escaneo, unirlas en ese único PDF.
  *Dejar lo ya archivado como está; implementar el PDF único de ahora en más.* La ficha NO va a
  procesados (vive solo en ordenes/).

## 4. Cerrar
- **Correr el validador:** `python3 -I herramientas/validar_carga.py`. Si falla, arreglar.
- `git add -A`, commit descriptivo con la atribución del proyecto, `git push -u origin main`
  (rebase + reintentos si hay push concurrente).
- **Reportar** a Julio: tabla resumen (cliente/ruta/carga/ref/TN/tarifa/total) y **marcar ruidoso**
  todo lo no resuelto (tarifa pendiente, punto faltante, dato dudoso, mapeo inferido).
- Si aparece una regla/tarifa/punto nuevo confirmado → anotarlo en `correcciones-julio.json` /
  `alias-empresa-punto.json` / `tarifa-por-analogia.json` e índice. Nunca dejarlo solo en el chat.

## Fuentes de datos (todas en el repo)
`catalogo/correcciones-julio.json` (reglas) · `datos/gesruta/materiales.csv` (cargas) ·
`catalogo/puntos-alta.json` + `alias-empresa-punto.json` (puntos) · `datos/gesruta/tarifarios/`
(tarifas cliente) · `tarifa-por-analogia.json` (cascadas) · `catalogo/rutas-por-cliente.json`
(rutas conocidas por cliente, evita destinos imposibles) · `ficha/flota.js` (padrón tractora/
remolque/chofer) · `ficha/conductores.js` (autónomo/dependiente) · `datos/registro-procesamiento.csv`
(libro maestro) · `docs/pendientes-gesruta.md` (qué falta cargar en Gesruta).
