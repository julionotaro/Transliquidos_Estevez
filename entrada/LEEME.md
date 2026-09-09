# entrada/ — dónde subir los PDF escaneados

Esta carpeta es el **buzón de entrada** de la digitalización. Acá se suben los
juegos escaneados; desde acá se leen, se aplican las reglas y se cargan a la
base de datos (tablas `Viajes`, `ultimo_km_tractora`, `documentos`, `gastos`).

## Cómo escanear (IMPORTANTE — así sale bien)

**Un PDF por ficha de chófer, con SUS documentos adentro.**

- Página 1: la **ficha del chófer** (la hoja manuscrita con conductor, tractora,
  y los 2-3 viajes con km y gastos).
- Después: los **documentos de transporte de esos viajes** (orden de carga,
  CMR, albarán, guía, ticket de báscula), en el mismo PDF.
- **Un solo chófer por PDF.** No mezclar dos choferes en el mismo archivo.

Por qué así: el sistema ata cada documento a su viaje por el "principio del
envío" (una ficha = un camión; todos los documentos del mismo sobre son de ese
camión). Mantener ficha + sus documentos juntos es lo que hace que la lectura
sea confiable aunque una matrícula se lea con un carácter mal.

Ejemplo: la ficha de Manuel Aboy con sus 3 viajes (FORESA, HELM, RNM) y los
documentos de los tres = **un** PDF.

## Cómo subir (desde el navegador, sin conocimientos técnicos)

1. Entrá a esta carpeta `entrada/` en GitHub.
2. Botón **"Add file" → "Upload files"**.
3. **Arrastrá** los PDF (podés soltar varios a la vez).
4. Abajo, **"Commit changes"**.

Listo. Cada PDF queda acá esperando que se procese.

## Nombre de archivo (opcional, ayuda)

Si podés, nombralos con fecha y chófer: `2026-09-10-aboy.pdf`. Si no, el nombre
que traiga el escáner también sirve.

## Qué pasa después

Se leen los PDF de esta carpeta, se cargan los viajes a la base con su estado
(`OK` o `REVISAR` con el motivo), y el archivo procesado se mueve fuera de
`entrada/` para no cargarlo dos veces.
