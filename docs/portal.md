# Portal único TLE

> Una sola URL con un menú a las herramientas de la oficina, para no tener que
> recordar tres direcciones sueltas.

## Qué es

- **URL:** `https://studio-julio.duckdns.org/webhook/tle`
- **Workflow:** `[ESTEVEZ] Portal` (`J6iyASN55Kcs8JXI`), proyecto `grgBpWySVCpXvuii`.
- **Fuente del HTML:** `portal/index.html` en este repo. El workflow solo lo
  sirve; el contenido se versiona en Git (patrón `[OFICINA] Dashboard v0`).

El menú tiene tres tarjetas: **Ingesta de viaje**, **Viajes pendientes** y
**Auditar factura**.

## Cómo se actualiza

Editar `portal/index.html` (o las páginas que sirve, ver abajo) en el repo y
pushear. **No hay que republicar el workflow**: cada request vuelve a leer el
archivo desde GitHub, así que el cambio se ve en la siguiente recarga.

## Cómo sirve el HTML (patrón real, NO raw directo)

El brief pedía `HTTP Request → raw.githubusercontent.com`. **La realidad del
patrón a copiar (`Dashboard v0`) es otra** y es la que se usó: el `HTTP Request`
hace `POST` al lector interno `https://studio-julio.duckdns.org/webhook/gh-read-v2`
con body `{ repo, path, ref, raw:true }` y recibe `{ data: <html> }`, que el
`Respond to Webhook` devuelve como `text/html`. Ventaja: ese lector ya maneja el
acceso al repo (incluido privado) con su credencial; un `GET` directo a
`raw.githubusercontent.com` fallaría si el repo es privado.

## `main` vs rama — PENDIENTE al mergear

Los tres `HTTP Request` apuntan a `ref: "claude/portal-tle"` (la rama), porque el
portal todavía no está en `main`. **Al mergear a `main` hay que cambiar `ref` a
`"main"`** en los nodos `Traer Portal`, `Traer Ingesta` y `Traer Auditar` del
workflow (o re-crear con el `ref` corregido). Mientras tanto el portal lee de la
rama.

## Por qué el portal sirve tres páginas, no una

Al verificar los webhooks reales vía MCP (`get_workflow_details`) aparecieron dos
diferencias con el brief — se resolvieron usando lo real, como pide el brief:

| Herramienta | Webhook real | Método | Navegable con `<a>`? |
|---|---|---|---|
| Viajes pendientes | `/webhook/viajes-pendientes` | **GET** | Sí — link directo |
| Ingesta de viaje | `/webhook/ingesta-viaje` | **POST** | No (un `<a>` hace GET → 404) |
| Auditar factura | `/webhook/auditar-factura` | **POST** | No (idem) |

Ingesta y auditor son endpoints **POST** (reciben archivos), no páginas. El form
de ingesta ya existía (`ficha/ingesta-viaje.html`) pero **ningún workflow lo
servía por URL**; el auditor no tenía página (su descripción dice: "pensado para
llamarse desde una página HTML propia via fetch").

Para que "los tres links abren la herramienta" sea verdad, el workflow del portal
sirve por GET, además del menú, esas dos páginas:

| Ruta GET | Sirve | POSTea a |
|---|---|---|
| `/webhook/tle` | `portal/index.html` (menú) | — |
| `/webhook/tle-ingesta` | `ficha/ingesta-viaje.html` (form existente) | `/webhook/ingesta-viaje` |
| `/webhook/tle-auditar` | `validador/auditar.html` (nueva, mínima) | `/webhook/auditar-factura` |

`validador/auditar.html` es un front-end mínimo (subir PDF → fetch POST → mostrar
el informe). Es v0 deliberado: el Encargo 4 reescribe el auditor; la página
renderiza la respuesta tal cual, así sigue sirviendo cuando cambie el formato.

## Verificación manual

1. `GET /webhook/tle` → 200 con el menú.
2. Cada tarjeta abre su herramienta (ingesta, pendientes, auditor).
3. Se ve bien en móvil (las tarjetas se apilan).

Si una tarjeta no abre: revisar que `gh-read-v2` tenga acceso al repo
`julionotaro/transliquidos_estevez` con la credencial de GitHub (si el repo es
privado y la credencial no lo alcanza, el `HTTP Request` devuelve error en vez del
HTML).
