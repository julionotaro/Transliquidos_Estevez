# Modelo estratégico — Oficina agéntica TLE / Hnos. Estévez Casal

> El **porqué** del proyecto: objetivo, fases y alcance. El **cómo** (reglas de lectura, correlación, facturación) vive en el documento hermano `modelo-dominio-lectura.md`, que es la fuente de verdad técnica que citan los encargos.
> Consolidado a partir del instructivo de objetivos (agosto 2026).

---

## Objetivo principal

Generar una **oficina agéntica** para la gestión de tareas de administración, facturación y transporte de las dos empresas del grupo:
- **Transliquidos Estévez (TLE)**
- **Transporte Hermanos Estévez Casal**

Ambas usan el mismo formato de ficha de chófer; el modelo de dominio aplica a las dos (validar caso por caso al incorporar la segunda).

---

## Objetivo a corto plazo — eficientizar el proceso

Cuatro etapas, en orden:

**1. Extracción de datos documentales** (ficha de chófer + documentos de transporte).
De dónde sale cada dato según cada cliente está en `modelo-dominio-lectura.md` §2 y §8. Los clientes frecuentes están mapeados; quedan pendientes (HELM, Santos, Comatra, algunas rutas) que se completan sobre la marcha.

**2. Cruce y confección de planillas.**
- Tabla de **fichas**: cómo se confeccionan, dónde se guardan.
- Tabla de **viajes**: cómo se confecciona, dónde se guarda.
- El cruce se apoya en las bases (clientes, puntos geográficos, chóferes, tractoras/remolques, productos, tarifas, indexación, histórico de viajes 2 años) — ver `modelo-dominio-lectura.md` §9.

**3. Validación de facturación.**
Los 6 datos críticos → tarifa e indexación (`modelo-dominio-lectura.md` §2).

**4. Clasificar, ordenar y guardar los archivos** (PDF, Excel, facturas).

---

## Objetivo a mediano plazo — automatización

**1. Carga eficiente y automatizada de datos en el sistema de escritorio** (Gesruta).
Es la **Pieza C** del roadmap técnico: un robot que toma los viajes en estado `confirmada` y los teclea en Gesruta (sin API), marcando `cargada_gesruta` solo tras acuse. La herramienta (pywinauto vs Power Automate Desktop) se decide con la **sonda de instrumentabilidad** de Gesruta, aún pendiente. El cruce contra bases de la etapa de extracción existe justamente para preparar este matcheo.

**2. Generar oficina agéntica / auxiliar administrativo.**
El horizonte: agentes que asisten la administración más allá de la ingesta de viajes.

---

## Estado del corto plazo (contexto honesto)

El corto plazo tomó más de lo previsto porque el dominio **no estaba formalizado en ningún lado** — se fue extrayendo de la operación real, caso por caso: matrícula manuscrita que rompe la correlación, cliente que sale del emisor y no del lugar de carga, peso del documento y no de la orden, pase de documentos que se había desconectado, km como discriminador de viajes, Foresa que cuenta rotaciones. Cada hallazgo evitó un modo de facturación incorrecta silenciosa.

Ese trabajo produjo el activo que faltaba: el **modelo de dominio escrito** (`modelo-dominio-lectura.md`). A partir de su existencia, las etapas restantes y los encargos futuros arrancan citándolo en vez de re-descubrir el dominio a los tropezones. Es la base sobre la que el corto plazo se cierra rápido.

---

## Roadmap técnico vigente (piezas)

Estado resumido; el detalle vive en el ROADMAP del repo y en los encargos.

- **A+B — tabla de resultado editable + persistencia de correcciones.** Desplegada y operable (tras el fix de fetch de acciones).
- **Reparación pase de documentos / cliente=emisor / peso D-01 / correlación de matrícula.** Resuelto el bloqueante de facturación para casos que el sistema resuelve solo.
- **Desambiguación por ruta/material** (días multi-pata, caso Baltransa) — pendiente, encargo aparte. Usa `modelo-dominio-lectura.md` §5.2.
- **Deduplicación** (llave matrícula+km_inicio) — pendiente, encargo aparte. Usa §5.1.
- **Pieza C — robot Gesruta** — pendiente; depende de la sonda de instrumentabilidad.
- **Ruteo de modelo por tipo de documento** (Sol manuscrito / Luna-Terra impreso, con medición) — pendiente; la tabla A+B + `correcciones` es el medidor.
- **Reconstruir `docs/entornos.md`** (se perdió) y **`campos_dudosos`** en el correlacionador (para "!" por celda fino).
