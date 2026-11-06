# Nomenclatura de carpetas y archivos — pipeline de carga

> Criterio ÚNICO para `ordenes-carga/ordenes/` y `procesados/`. Unificado 2026-10-22.
> Consolida lo que estaba disperso en `catalogo/correcciones-julio.json`
> (reglas `archivo_procesados`) y en la cabecera de `ordenes-carga/ordenes/INDICE.md`.

Hay DOS árboles con roles distintos y SIN duplicar contenido:

- **`ordenes-carga/ordenes/`** — la **ficha del chófer** + la **`orden.json`** de cada juego.
- **`procesados/`** — los **documentos de transporte** (albaranes/OC) archivados por cliente.

La ficha vive SOLO en `ordenes/`; los documentos de transporte viven SOLO en `procesados/`.

---

## 1) `ordenes-carga/ordenes/`

Ruta: **`ordenes-carga/ordenes/<AAAA-MM>/<chofer>/<AAAA-MM-DD>/`**

- **`<AAAA-MM>`** y **`<AAAA-MM-DD>`**: la **primera fecha de CARGA** del viaje (la de la
  ficha), NUNCA la del escaneo.
- **`<chofer>`**: nombre del chófer en **minúsculas**, **ASCII** (acentos fuera, `ñ`→`n`),
  tokens separados por **guion** (`-`). El nombre se toma del **padrón canónico
  `catalogo/flota.json`**, no de cómo lo leyó una ficha suelta, para que un mismo chófer
  tenga SIEMPRE la misma carpeta. Ej.: `MANUEL SABARIS`→`manuel-sabaris`,
  `JOSE RAMON PINEIRO`→`jose-ramon-pineiro`.

Archivos dentro de la carpeta del juego:

- **`ficha_<ts>.pdf`**: la ficha del chófer. `<ts>` = timestamp del escaneo original
  (`AAAAMMDDHHMMSS`, el nombre que trae el escáner). Debe existir una (el validador lo exige).
- **`orden.json`**: la orden de carga (formato en `ordenes-carga/CONTRATO-orden-json.md`).
  Un `orden.json` por juego; no reusar uno gigante.
- **`LEEME.txt`**: solo en juegos del **lote inicial** (procesados antes del formato
  `orden.json`): llevan ficha pero no `orden.json`.

---

## 2) `procesados/`

Ruta: **`procesados/<CLIENTE>/<AAAA-MM>/`**

- **`<CLIENTE>`**: razón social corta en **MAYÚSCULAS**, como el cliente de
  `catalogo/clientes-gesruta.js` (ej.: `FORESA`, `BRESFOR`, `QUIMIDROGA`, `RNM`, `BALTRANSA`,
  `ARACHEM`, `HELM`, `FORESTAL`). Es el cliente **que se factura**, no el punto de carga
  (ej.: un viaje cargado en Diversey pero facturado a Baltransa va en `BALTRANSA/`).
- **`<AAAA-MM>`**: mes de la **fecha de carga** del albarán.

Archivos:

- **`<referencia>.pdf`** — **UN solo PDF por albarán** que contiene **la OC + la documentación
  de carga** (CMR / albarán de carga / báscula) **juntas en el mismo archivo**, nombrado por su
  **referencia de facturación** (la misma que va en la columna `referencia` del registro).
  Ej.: `710297.pdf`, `5050141131.pdf`, `338681.pdf`. Si las páginas vienen sueltas en el escaneo,
  **unirlas** en ese único PDF. **Regla Julio 05/11.**
- **NO separar la OC del resto** en un `<referencia>-orden.pdf` aparte: ese formato de dos
  archivos es el **viejo** (lote ya archivado). **Dejar lo ya hecho como está; de ahora en más,
  un único PDF con OC + carga.** Los `-orden.pdf` existentes se conservan (no re-tocar).
- **NUNCA** nombrar por el timestamp del escaneo. Un archivo con nombre de timestamp dentro
  de `procesados/<CLIENTE>/` es señal de documento SIN procesar mal archivado.

### CLAVO (FRIGOS) — mismo esquema (Julio 06/11)

CLAVO usa **el mismo procedimiento de archivado que los químicos**: cliente `CLAVO`, carpeta
`procesados/CLAVO/<AAAA-MM>/`. Dos buckets:

- **Fichas de chóferes** (la **parte** / hoja de ruta): van a **`ordenes/`** (como siempre), NO a
  procesados — son compartidas por todos los tramos de ese chófer/semana.
- **Talón + albaranes:** por cada tramo, **UN PDF** con el **talón de porte TLE + sus albaranes de
  entrega** juntos (equivalente a la OC + documentación de carga de los químicos). Como CLAVO **no
  tiene referencia de facturación**, se nombra por el **Nº de albarán de Gesruta** (capturado al
  cargar); si aún no se cargó, `<AAAA-MM-DD>-<destino>.pdf` provisional.

### Carpetas especiales en `procesados/`

- **`_descartados/`**: juegos YA RESUELTOS que NO se procesan (duplicados o ya facturados).
  Conservan su nombre de escaneo. `LEEME.txt` explica por qué cada uno.
- **`_sin_clasificar/`**: documentos que **no están en el registro** — revisar si procesar o
  descartar. Conservan su nombre de escaneo hasta resolverse.

---

## Regla de oro

`procesados/<CLIENTE>/` contiene **solo albaranes YA procesados** (presentes en
`datos/registro-procesamiento.csv`), nombrados por su **referencia**. Un documento con nombre
de **timestamp** = NO procesado → va a `_sin_clasificar/` (o a `_descartados/` si se resuelve
que no corresponde cargarlo).
