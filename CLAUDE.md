# CLAUDE.md — Transliquidos Estévez

> Este archivo lo lee Claude Code automáticamente al abrir una sesión en este repo.
> Es la primera instrucción, antes de cualquier tarea.

---

## PASO 1 — OBLIGATORIO ANTES DE TOCAR NADA

Leer **`docs/INDICE.md`**.

Es el mapa de toda la documentación del proyecto y contiene las decisiones de dominio vigentes.
No se empieza ninguna tarea sin haberlo leído. Sin él no se sabe qué reglas existen ni dónde están,
y las reglas de negocio quedan enterradas en documentos que nadie abre. Ya pasó.

Después del índice, leer solo los documentos que la tarea concreta requiera, según lo que el propio
índice indique.

---

## PASO 2 — OBLIGATORIO AL TERMINAR

**Si la tarea creó, renombró o dejó obsoleto algún archivo en `docs/`, actualizar `docs/INDICE.md`
en el MISMO commit.**

**Si la tarea reveló o confirmó una regla de negocio nueva**, anotarla en el documento de dominio que
corresponda y reflejarla en el índice. Nunca dejarla solo en el mensaje de commit ni en el chat.

Un documento que no está en el índice no existe a efectos prácticos: nadie va a saber que está.

---

## Reglas de trabajo en este repo

**Inspeccioná primero.** Leer el estado actual antes de modificar nada. Siempre.

**Si la realidad contradice el encargo, PARAR Y REPORTAR.** No adaptar el encargo a lo que se
encuentra, no improvisar una solución intermedia, no seguir adelante "asumiendo". Julio decide.

**Fallar ruidoso antes que en silencio.** Null antes que invención plausible. Revisión humana antes
que corrección automática de un dato incierto. Un dato equivocado en silencio envenena una factura.

**"Se ve bien" no cuenta como verificación.** Nada está verificado hasta leer las tablas con dato real.

**Toda lógica se versiona en el repo**, nunca solo dentro de un nodo de n8n. Los archivos `.generated.js`
se producen con `build-nodo.js` a partir de los módulos puros; **no se editan a mano**.

**Claude Code implementa; no decide diseño.** Las decisiones de arquitectura y de dominio se toman en
el chat con Julio y llegan acá como encargo.

**Nunca copiar reglas de dominio dentro de este archivo.** Una regla copiada queda vieja y contradice
al original. Acá solo van punteros.

---

## Encoding de los datos de Gesruta

Los CSV exportados del sistema de escritorio están en **cp850** (codepage DOS), no UTF-8 ni cp1252.
Leerlos con otro encoding corrompe la Ñ y los acentos: `PORRIÑO` se convierte en basura y deja de
coincidir con el mismo nombre bien escrito, que es exactamente lo que rompe cualquier trabajo de
normalización. El byte `0xA5` es `Ñ`.

---

## Límites de las herramientas

- El **ESCRITOR de GitHub** (vía n8n) solo sirve para archivos de menos de ~8 KB. Archivos grandes y
  CSV van por Claude Code con git real.
- **Los deploys de n8n son manuales**: el conector puede cambiar el grafo (nodos, cableado), pero el
  código de los nodos lo pega Julio a mano, y las credenciales se asignan a mano en la interfaz.
- Al inspeccionar ejecuciones de n8n, `truncateData:5` **oculta el último elemento**. No es un fallo
  del pipeline.

---

## Tests

Criterio de éxito: la suite en verde. Los tests de dominio (rotaciones Foresa, deduplicación, peso de
origen) son regresiones críticas: si uno rompe, **parar y reportar** — puede ser una regla correcta
que el encargo nuevo no contempló.

---

## Hooks

Este repo tiene controles automáticos antes de cada commit:

- **Guardián del índice**: bloquea si se modifica docs/ sin actualizar docs/INDICE.md
- **Guardián de credenciales**: bloquea si detecta claves o tokens en el código

En una máquina nueva, instalarlos una vez:

    bash scripts/instalar-hooks.sh

Para saltar los controles en un caso justificado: git commit --no-verify

Detalle de cada guardián y cómo agregar uno nuevo: `docs/hooks.md`.
