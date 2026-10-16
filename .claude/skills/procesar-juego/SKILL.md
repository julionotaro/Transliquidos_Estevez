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
- Rasterizar con **pymupdf** (`fitz`) a PNG `Matrix(2.1–2.2)` y leer las imágenes (no hay poppler).
  Para dígitos dudosos (km, odómetros) recortar y ampliar (`Matrix(5–7)`). Cuidado 5↔9.
- **Ficha del chofer:** chofer, tractora (cabeza = matrícula sin letras), remolque, y por viaje:
  fecha carga/descarga, lugar carga/descarga, mercancía, cantidad, km inicio/fin, km recorridos,
  vacíos. Verificar matrícula/remolque/chofer contra `ficha/flota.js` (padrón real).
- **Documentos:** por albarán → cliente, origen, destino, referencia, peso, fechas.

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

## 3. Generar la salida
- **orden.json** (ver CONTRATO) en `ordenes-carga/ordenes/<AAAA-MM>/<chofer-slug>/<AAAA-MM-DD>/`
  (mes y fecha = primera fecha de carga), junto a la **ficha** copiada ahí (`ficha_<ts>.pdf`).
  Un archivo por juego; NO reusar un orden.json gigante. Números con coma decimal; destino/carga
  por código + `esperado` para que el bot verifique.
- **Libro maestro** `datos/registro-procesamiento.csv`: una fila por albarán, **28 columnas,
  NUNCA un `;` en observaciones** (bug recurrente). `base = porte(+idx)`, `total = base·(1+iva)`.
- **Archivo de documentos:** cada albarán renombrado por su referencia en
  `procesados/<CLIENTE>/<AAAA-MM>/`. La ficha NO va a procesados (vive solo en ordenes/).

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
