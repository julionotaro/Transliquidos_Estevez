# Encargo 2026-08-07 — Deploy consolidado del nodo Planilla (3 fixes en git)

## Contexto

Hay tres fixes ya implementados, testeados y pusheados que todavía NO están en producción porque el
nodo Planilla del workflow vivo `[ESTEVEZ] Ingesta Viaje` (`WD0q9Ic0oDvUoJwp`) sigue con código
viejo. Hasta desplegar, la planilla en producción NO resuelve indexación ni identidad de tarifas.

Los tres fixes que el nodo Planilla regenerado ya arrastra:
1. **Identidad de tarifas** por razón social exacta (`ficha/clientes.js` + `tarifas.js`) — mapa
   código→razón social, match exacto, sin alias → REVISAR.
2. **Indexación por `tipo`** — tras la recarga de la tabla Indexacion, el consumidor matchea por
   `tipo`=categoría (no por `cliente`).
3. **REVISAR de bordes §4.4** — fecha no cubierta o solape con % distinto → REVISAR con motivo
   accionable.

Todo está en la rama `claude/recarga-indexacion` (que salió de `claude/planilla-carga-auditoria`,
así que arrastra también el fix de identidad). 177/177 tests, build al día.

## Qué hacer

1. Confirmá cuál es el archivo `.generated.js` del nodo Planilla en la rama correcta y que está
   sincronizado con el código fuente (build check).
2. **Este deploy lo hace Julio a mano** (copy-paste del generado en el nodo de n8n + publish), igual
   que el deploy de contaminación/OCR del 2026-08-04. Tu tarea: dejar CLARÍSIMO para Julio:
   - El nombre EXACTO del nodo en la UI de n8n (ojo traducciones: confirmá cómo se ve en pantalla,
     no solo el nombre del repo).
   - El link raw de GitHub al archivo `.generated.js` exacto a pegar.
   - Si es un solo nodo o varios (si los 3 fixes tocan más de un nodo del workflow vivo, listalos
     todos con su archivo correspondiente).
3. Si conviene coordinar este deploy con el del swap de modelo de lectura (GPT-5) y el del throttle
   para hacer UN solo pase de copy-paste+publish sobre el workflow, proponé el orden. Menos toques
   al workflow vivo = menos riesgo.

## Verificación — tras el deploy (Julio + Code)

- Subir 1 viaje real por la ingesta y confirmar que la planilla resuelve tarifa e indexación (no
  quedan en blanco ni todo REVISAR por el bug viejo de match).
- Confirmar que un viaje con fecha en borde de indexación cae en REVISAR con motivo, no en silencio.

## Entrega

- No hay código nuevo en este encargo (los fixes ya están). Es un encargo de **coordinación de
  deploy**: dejá el instructivo exacto de qué pegar y dónde, para que Julio lo ejecute sin
  ambigüedad de nombres de nodo.
