# Sonda de idoneidad — Document AI (modalidad A: banda recortada)

Código de la sonda del encargo `encargos/2026-07-29-prueba-document-ai.md`.
**No toca producción.** Workflow n8n: `PROBE Document AI A` (id `zHldfwmVKYmn2JCL`).

## Topología

```
Hook (webhook POST /probe-docai-a)
  -> Descargar Ficha (Google Drive download, ficha_real.pdf, cred "Drive Oficina")
  -> Rasterizar (HTTP POST http://rasterizador:8000/rasterizar-regiones, dpi=300, las 4 bandas)
  -> Armar DocAI (Code: un item por banda con {rawDocument:{content:b64,mimeType:image/png}})  [armar-docai.js]
  -> Document AI (HTTP POST al endpoint :process, auth googleApi)
  -> Extraer DocAI (Code: texto + confianza por token, salida chica y legible)  [extraer-docai.js]
```

Endpoint: `https://eu-documentai.googleapis.com/v1/projects/163988540080/locations/eu/processors/1049209471c32899:process`

## Modalidad A vs B

- **A (esta sonda):** cada banda (band_matricula, km_v1/v2/v3) va sola al procesador.
  12 llamadas por PDF (3 páginas × 4 bandas).
- **B (pendiente):** página completa → Document AI → filtrar tokens por bounding box
  dentro de cada banda. Da además las coordenadas reales de cada número.

## CAVEAT de credencial (documentado en el encargo §1)

El nodo `Document AI` usa `authentication: predefinedCredentialType` +
`nodeCredentialType: googleApi`. **El MCP no puede asignar la credencial `googleApi`
a un nodo HTTP** (rechaza: "node type httpRequest does not accept credential
googleApi"). Hay que asignar la credencial **"Document AI"** (id `2R6Urftw9Vj0oLj4`,
tipo service account) a ese nodo **a mano en la UI de n8n** (un clic). Recién ahí
la sonda corre. n8n deriva el Bearer OAuth2 (scope cloud-platform) desde la
service account automáticamente — no hace falta paso de JWT manual.

## Cómo correr (una vez asignada la credencial)

Publicar el workflow y ejecutarlo como webhook (las ejecuciones manuales con
binarios pesados no son legibles por el MCP; las webhook sí):
`execute_workflow(zHldfwmVKYmn2JCL, production, {type:webhook, POST, body:{}})`.
Leer el nodo `Extraer DocAI` (salida chica: texto + confianza por token).
