# Flujo de carga en Gesruta y registro de datos **VIGENTE**

> Última actualización: 08/10/2026. Define cómo se carga un juego en Gesruta y dónde
> queda registrado. Decisión de Julio (08/10/2026): **un solo almacén = git. Sin n8n, sin Google Sheet, sin duplicar.**

## Capas y su rol (no mezclar)

| Capa | Rol |
|---|---|
| **Gesruta** (app de escritorio) | Sistema de facturación real. Se carga por control de pantalla (skill `cargar-viajes-gesruta`). **Genera** el Nº de viaje y el Nº de albarán. |
| **git (este repo)** | **Única fuente de verdad: datos, reglas y libro mayor.** `datos/registro-procesamiento.csv` (una fila por albarán) + reglas (`catalogo/correcciones-julio.json`) + códigos + `datos/n8n-export/` (respaldo histórico de las tablas) + PDFs en `procesados/`. Versionado, gratis. Lo mantiene Claude (único editor de git). |
| **Skill en claude.ai** | **Único almacén del procedimiento** (cómo cargar, incl. captura del Nº). Lo edita **solo Julio** en claude.ai → skills; todo Claude (escritorio o nube) lo lee solo. |

> **n8n (Studio-julio) queda fuera del flujo.** Sus tablas se exportaron a `datos/n8n-export/`
> (08/10/2026) para poder dar de baja el servidor. No es capa operativa ni se espeja más.
> Regla anti-colisión: **un solo editor por cosa** — Julio edita skills, Claude edita git, nadie edita lo mismo dos veces.

## Estructura viaje / albarán (confirmada)

- **1 viaje (administrativo)** = la(s) hoja(s) de servicio del chofer; puede abarcar 1–2 fichas y **varios albaranes**.
- **Cada origen→destino = 1 albarán.** Ej: ficha Asensi 29/09–02/10 = **1 viaje, 2 albaranes** (Forestal Mugardos→Castellón; Quimidroga Barcelona→Aveiro).

## El número lo captura el flujo, nunca se pasa a mano

El **Nº de viaje** y el **Nº de albarán** los **genera Gesruta al grabar**. Regla:

1. **Procesamiento (Claude nube):** al leer el juego se crea la fila en `registro-procesamiento.csv` con el Nº **vacío** y `estado_carga=PENDIENTE_CARGA`, y se genera la orden de carga con todos los códigos.
2. **Carga (control de pantalla):** al grabar cada albarán, se **lee de la pantalla** el Nº de viaje y Nº de albarán recién generados. Como se lee en el instante, **es siempre el número real de ese registro**, aunque haya cargas manuales por fuera del flujo → no se desincroniza. Esto va en el skill, así que no hay que pedirlo en cada carga.
3. **Registro en git:** esos números llegan a `registro-procesamiento.csv` y se marca `estado_carga=CARGADO`. Vía: el Claude de escritorio los reporta al cerrar (y Claude nube los escribe), o si esa conversación tiene conector de GitHub, los escribe directo. **Único almacén: git.**

Nunca pre-asignar ni teclear a mano esos números: solo capturarlos de Gesruta.

## Km (ver también `catalogo/correcciones-julio.json`)

Odómetro continuo por viaje. Km carga por albarán = final − inicio. Entre albaranes del mismo
viaje hay **km vacío** (reposicionamiento). En Gesruta el form "Kilómetros" es a nivel viaje;
Km vacío y Nueva lectura los confirma Julio.
