# ENCARGO — Correccion de defectos de la ingesta (prueba 479, 23/07/2026)
Aplica al workflow n8n `WD0q9Ic0oDvUoJwp` (no hay codigo de repo: se aplica via MCP o UI de n8n, no via Claude Code).

## Contexto
Prueba end-to-end con Orden Baltransa 332175 (ejecucion 479) exitosa en flujo, con 5 defectos de calidad de datos detectados.

## CAMBIO 1 — Prompt de extraccion (`Preparar Payload`)
Anadir al system prompt:
- MATERIAL/MERCANCIA: transcripcion LITERAL del documento, caracter a caracter. NUNCA reformular, resumir ni 'corregir' la descripcion. Critico en mercancias ADR: la descripcion legal debe ser exacta. (Defecto real: extrajo 'Acido, Ironacano, N.E.P. (Hexafluorozirconato de amonio)' cuando el CMR dice 'LIQUIDO CORROSIVO, ACIDO, INORGANICO, N.E.P. (HEXAFLUOROZIRCONATO DE DIHIDROGENO)'.)
- ORIGEN/DESTINO: tal cual figuran en el documento. NO completar provincia/pais desde conocimiento propio. (Defecto: 'Vigo, Pontevedra, Espana' cuando la Orden dice 'Vigo'.)
- NULOS: usar null JSON real, NUNCA la cadena "null". Numericos desconocidos (km, pesos, importes): null, NUNCA 0.

## CAMBIO 2 — Normalizacion post-parse (`Formatear Linea Gesruta`)
Tras `JSON.parse(raw)`, normalizar recursivamente el objeto `v` antes de usarlo:
- Strings "null", "NULL", "" -> null.
- `km_inicio`/`km_final` con valor 0 -> null (un odometro real nunca es 0).
Asi `datos_json` queda limpio para las dos ramas de persistencia y para el Responder.

## CAMBIO 3 — `Preparar KM Tractora`
Condicion de km valido: `typeof kf === 'number' && isFinite(kf) && kf > 0` (hoy acepta 0). Defensa en profundidad ademas del CAMBIO 2.

## CAMBIO 4 — Limpieza de datos
- `ultimo_km_tractora`: eliminar la fila id=1 (T-10 ESTEVE, km_final '0', espuria). Sin esto, el proximo viaje real de esa tractora calculara km vacios contra 0.
- `viajes`: fila id=1 contiene strings "null" en semi/conductor y detalle con material alucinado. Opcional: eliminar y reprocesar 332175 tras aplicar cambios 1-3.

## Tests
1. Reprocesar la Orden 332175 por la pagina de ingesta. Esperado: material literal del CMR; destino 'Vigo'; semi/conductor null reales (no "null"); NINGUNA fila nueva en ultimo_km_tractora (no hay hoja de chofer).
2. Procesar una hoja de chofer real con odometros. Esperado: upsert en ultimo_km_tractora con el km_final mayor, > 0.

## Verificacion manual
Comparar campo a campo el JSON extraido contra el documento original, con foco en material (literal) y numericos (null vs 0).
