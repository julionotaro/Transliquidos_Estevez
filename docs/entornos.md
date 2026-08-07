# Entornos e infraestructura — Transliquidos Estévez (TLE)

> Fuente única de verdad de infraestructura para todos los chats del proyecto. Si algo de acá
> cambia, se actualiza este archivo — no se repite en cada onboarding.
> Última actualización: 2026-08-07.

## Repos (regla de oro: por defecto todo va a transliquidos_Estevez)

| Repo | Qué contiene | Cuándo se toca |
|---|---|---|
| `julionotaro/transliquidos_Estevez` | **EL repo del proyecto**. Ficha, cruce, validador, pendientes, planilla, encargos, docs de dominio e infraestructura | Siempre, por defecto |
| `julionotaro/estudio-ia` | Fábrica transversal. Rasterizador en `activos/rasterizador/` | Solo si se toca el rasterizador |
| `julionotaro/tyrion` | OTRO proyecto (Colegio de Gestores), sin relación con TLE | Nunca en contexto TLE. Si un chat lo menciona trabajando en TLE, está confundido |

## Cómo se suben los encargos (no se copian a mano)

Van al repo por workflow n8n, a `encargos/AAAA-MM-DD-nombre.md` en `transliquidos_Estevez` branch `main`.

- **ESCRITOR** (n8n id `05hNhH7nbtXsXL9M`): escribe archivos. Body `{repo, path, message, branch, content}`.
  Confirmar siempre con `get_execution` el commit devuelto. Poco fiable con archivos >~8KB — para docs
  largos subir corrección corta en vez de reescribir el original entero.
- **LECTOR** (n8n id `OtNo3Tk6Qu2R91rp`): lee cualquier repo. Body `{repo, path, ref}`. Carpeta→lista,
  archivo→contenido crudo.
- Tras subir, mensaje corto a Claude Code: `"Encargo en encargos/[archivo].md (main), leé la regla de arranque"`.

## n8n — datos operativos

- Conector MCP: `Studio-julio` (`https://studio-julio.duckdns.org/mcp-server/http`).
- Project id: `grgBpWySVCpXvuii`.
- **Tablas de datos**: `Tarifas` (`Siwhv2AUWTSeFlrJ`), `Indexacion` (`or1otD9WsjJ3V8Cr`), `viajes`,
  `ultimo_km_tractora`, `documentos`.
- **Workflows clave**:
  - Ingesta Viaje (`WD0q9Ic0oDvUoJwp`) — canal ficha, lectura, cruce.
  - Vista Pendientes (`C3eZ1RteNAZDdaCV`) — contiene el nodo **Planilla**. OJO: la planilla NO vive en
    Ingesta Viaje, vive acá.
  - Validador (`IlIod0DlephaLmAV`).
  - ESCRITOR (`05hNhH7nbtXsXL9M`), LECTOR (`OtNo3Tk6Qu2R91rp`), Dify Bridge (`0tGxducQ0fq5uKbs`).

### Reglas de oro n8n
- Después de `update_workflow` va **siempre** `publish_workflow` (los edits caen en draft; producción
  corre la última publicada).
- Credenciales de nodos HTTP **no** se asignan por MCP — se hacen a mano en la UI tras cualquier
  edición que toque un nodo HTTP.
- Borrado de filas: no hay tool MCP. Se purga por la UI de n8n (Data Tables).
- Tras cargas masivas o pruebas: **archivar/desconectar workflows scratch de inmediato**. Un scratch
  de borrado mal desconectado disparó un borrado accidental de las 698 filas de Tarifas (se recuperó
  sin pérdida, pero no repetir). Patrón seguro: borrado one-shot (Start→Borrar, sin trigger reusable),
  dry-run previo, archivar apenas termina.

## Despliegue de código a nodos n8n (procedimiento manual)

El código de los nodos Code se edita en el repo (`build-nodo.js` genera → se pega en el nodo). La
herramienta MCP no puede escribir el código de un nodo de forma segura (el cuerpo es demasiado grande
para pasarlo como JSON escapado sin riesgo de corromper producción). Por eso **el deploy es manual**:

1. Abrir el archivo `.generated.js` en GitHub (link raw), copiar todo (Ctrl+A, Ctrl+C).
2. En n8n, abrir el workflow correcto y el nodo correcto (verificar nombre exacto — la UI a veces
   traduce; confirmar contra el canvas).
3. Un nodo Code muestra un panel grande de JavaScript. Un nodo HTTP muestra Método/URL/Auth — ese NO
   se toca para pegar código. Si ves Método/URL, estás en el nodo equivocado.
4. Seleccionar todo el código viejo del panel, borrarlo, pegar el nuevo.
5. Cerrar el nodo (queda en draft).
6. Repetir para cada nodo del workflow, y recién entonces **Publish** (una vez por workflow).
7. Recomendado: antes de pegar, guardar el código viejo en un .txt aparte por si hay que revertir.

## VPS

- Repos clonados en `/root/estudio-ia` (tiene git; `/opt/estudio-ia` NO).
- Rasterizador corre en Docker; rebuild con `--no-cache` obligatorio.
- El VPS bloquea CDN — los assets de las vistas van servidos localmente, no desde CDN.

## Reparto de tareas Chat ↔ Claude Code

- **El chat** (interfaz conversacional): diseño, arquitectura, decisiones de dominio, redacción de
  encargos, y operaciones sobre n8n vía el conector `Studio-julio` (leer/editar/publicar workflows,
  tablas de datos, ejecuciones). NO edita el repo directamente (usa ESCRITOR/LECTOR).
- **Claude Code**: implementación contra el repo. Trabaja en rama, reporta, se mergea tras verificar.
  Nunca diseña dominio — ejecuta el encargo. Tiene acceso directo a las tablas del Studio para
  dump/verificación. El webhook de ingesta está bloqueado desde su sandbox (las corridas reales de
  ingesta las hace Julio).

## Método de trabajo

- Pipeline: brief → encargo a Claude Code (formato: Contexto / regla de arranque "inspeccioná
  primero" / cambios / tests / commit / verificación) → build en rama → deploy manual → verificación.
- "Se ve bien" no cuenta hasta corrida real con datos reales. Varios bugs propios se cazaron así.
- Columnas nuevas se **mapean**, no solo se crean (el bug de `estado_lectura` escribiendo null por
  columna sin mapear se repitió como riesgo). Verificar siempre por readback, distinguiendo null
  legítimo de null por falta de mapeo.

## Documentos de referencia en el repo

- `docs/dominio-facturacion.md` — reglas de negocio: qué se factura, tarifas, indexación, IVA,
  documentación por cliente, set de validación. **Leer antes de cualquier encargo de facturación.**
- `docs/entornos.md` — este archivo.
- `docs/throttle-ingesta.md` — rationale del throttle de visión.
- `docs/deploy-consolidado-2026-08-07.md` — instructivo del deploy pendiente.
