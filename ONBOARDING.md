# ONBOARDING — Transliquidos Estévez

> **PASO 1 OBLIGATORIO: leer `docs/INDICE.md`.**
> Ese archivo es el mapa de toda la documentación. Sin él no se sabe qué existe, y las reglas de
> negocio quedan enterradas en documentos que nadie abre. Ha pasado.

---

## Regla de oro de este repo

**Las reglas de dominio NO se copian acá.** Viven en `docs/`, y `docs/INDICE.md` dice cuál está en
cuál. Una regla copiada en dos sitios queda vieja en uno de los dos y genera contradicciones.
Este archivo solo explica **qué es el proyecto y cómo se trabaja**. Nada más.

---

## Qué es el proyecto

Julio es administrativo (con proyección a tráfico y facturación) en un grupo transportista de
líquidos de Villagarcía de Arousa: dos firmas, **Trans. Líquidos Estévez S.L. (TLE, CIF B36532802)**
y **Hermanos Estévez Casal (HEC)**.

Se automatiza el puesto administrativo: leer fichas de chófer y documentación de transporte, extraer
los datos que facturan, y dejarlos listos para cargar en Gesruta y para auditar la factura.

Repo: `julionotaro/transliquidos_Estevez`.

**Restricción de fondo:** Gesruta es un programa de escritorio Windows en el ordenador de la empresa.
No tiene API. La automatización termina en "carga asistida": el sistema entrega la línea lista para
tipear. El robot que teclea en Gesruta es una pieza futura, todavía no construida.

**Aislamiento:** el dominio (clientes, tarifas, rutas, Gesruta) vive SOLO en este repo.
A `estudio-ia` solo vuelven patrones estructurales, nunca reglas de este cliente.

---

## Cómo se trabaja

| Quién | Hace |
|---|---|
| **Julio** | Todas las decisiones de negocio y de dominio |
| **Chat** | Diseño, arquitectura, dominio, operar n8n, redactar encargos |
| **Claude Code** | Implementar en rama. Nunca decide diseño |

**Reglas operativas:**

- **"Inspeccioná primero"**: leer el estado actual antes de modificar nada. Siempre.
- **Fallar ruidoso antes que en silencio.** Null antes que invención plausible. Revisión humana antes
  que corrección automática de un dato incierto.
- **"Se ve bien" no cuenta.** Un cambio no está verificado hasta leer las tablas con dato real.
- **Los deploys de n8n son manuales.** El conector puede cambiar el grafo (nodos, cableado), pero el
  código de los nodos lo pega Julio a mano, y las credenciales se asignan a mano en la interfaz.
- **Toda lógica se versiona en el repo**, nunca solo dentro de un nodo de n8n.
- Si la realidad contradice un encargo, **parar y reportar**. No adaptar el encargo a lo que se encuentra.

**Formato de encargo a Claude Code:** Contexto / "inspeccioná primero" / cambios numerados / tests /
commit / verificación manual.

---

## Estado actual

Rama vigente: **`claude/dedup-viajes-peso-origen`**.

Lo construido y funcionando:

| Pieza | ID n8n | Qué hace |
|---|---|---|
| Ingesta de viajes | `WD0q9Ic0oDvUoJwp` | Sube ficha + documentos → extrae → devuelve línea Gesruta |
| Vista pendientes | `C3eZ1RteNAZDdaCV` | Tabla editable de viajes con datos a revisar |
| Auditor de facturas | `IlIod0DlephaLmAV` | Audita una factura emitida antes de enviarla |
| Export a Excel | `ObSZK7wHv4k9oFi6` | Histórico de lo extraído |

Para el estado operativo al día, ver `docs/ESTADO-Y-TRASPASO.md` y el ROADMAP.

---

## Aprendizajes técnicos

- El nodo **Form** de n8n no sirve para procesos largos (se cuelga). Patrón correcto:
  **Webhook + Respond to Webhook + página HTML propia con `fetch()`**.
- Formularios HTML nativos (`<form>`) navegan y pierden la página: usar `fetch()` con `preventDefault`.
- Credencial OpenAI para nodos HTTP: tipo **Bearer Auth** (`OpenAI Bearer`, `MJD7lLvCk947vvMl`),
  no la credencial nativa de OpenAI. Se asigna a mano tras crear el nodo.
- El **ESCRITOR de GitHub** solo sirve para archivos pequeños (menos de ~8 KB). Archivos grandes y
  CSV van por Claude Code con git real.
- `truncateData:5` al inspeccionar ejecuciones **oculta el último elemento**. No es un fallo del pipeline.
- nginx: los paths `/form/` y `/webhook/` ya están ruteados en `mcp-ssl.conf`.

---

## Recursos

| Recurso | ID |
|---|---|
| Proyecto n8n | `grgBpWySVCpXvuii` |
| Ingesta viaje | `WD0q9Ic0oDvUoJwp` |
| Vista pendientes | `C3eZ1RteNAZDdaCV` |
| Auditor de facturas | `IlIod0DlephaLmAV` |
| GitHub Read | `OtNo3Tk6Qu2R91rp` |
| GitHub Write | `05hNhH7nbtXsXL9M` |
| Credencial OpenAI Bearer | `MJD7lLvCk947vvMl` |
| Tabla `viajes` | `lrBxWpTUxMtO8U48` |
| Tabla `tarifas` | `Siwhv2AUWTSeFlrJ` |
| Tabla `indexacion` | `or1otD9WsjJ3V8Cr` |
| VPS | Hostinger KVM2, Ubuntu 24.04 |

---

## Nota de contexto

Este proyecto pasó semanas "sin lanzar la versión básica". Ese tiempo fue formalizar un dominio que
solo Julio tenía en la cabeza y nadie había escrito. El resultado es el modelo de dominio versionado,
que es el activo que permite que lo que sigue vaya rápido. No es atraso; es la base.
