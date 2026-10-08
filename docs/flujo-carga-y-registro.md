# Flujo de carga en Gesruta y registro de datos **VIGENTE**

> Última actualización: 08/10/2026. Define cómo se carga un juego en Gesruta y dónde
> queda registrado. Decisión de Julio (08/10/2026).

## Capas y su rol (no mezclar)

| Capa | Rol |
|---|---|
| **Gesruta** (app de escritorio) | Sistema de facturación real. Se carga por control de pantalla (skill `cargar-viajes-gesruta`). **Genera** el Nº de viaje y el Nº de albarán. |
| **git (este repo)** | **Libro mayor / respaldo / auditoría.** `datos/registro-procesamiento.csv` (una fila por albarán) + reglas (`catalogo/correcciones-julio.json`) + PDFs en `procesados/`. Versionado, con historial, respaldado. Lo mantiene Claude. |
| **n8n (Studio-julio)** | Capa operativa / dashboards / flujos en vivo. Tabla `Viajes` (una fila por albarán, con `estado_carga`, `nro_viaje_gesruta`, `nro_albaran_gesruta`). Se **espeja a git** como respaldo. |

## Estructura viaje / albarán (confirmada)

- **1 viaje (administrativo)** = la(s) hoja(s) de servicio del chofer; puede abarcar 1–2 fichas y **varios albaranes**.
- **Cada origen→destino = 1 albarán.** Ej: ficha Asensi 29/09–02/10 = **1 viaje, 2 albaranes** (Forestal Mugardos→Castellón; Quimidroga Barcelona→Aveiro).

## El número lo captura el flujo, nunca se pasa a mano

El **Nº de viaje** y el **Nº de albarán** los **genera Gesruta al grabar**. Regla:

1. **Procesamiento (Claude nube):** al leer el juego se crea la fila en `registro-procesamiento.csv` con el Nº **vacío** y `estado_carga=PENDIENTE_CARGA`, y se genera la orden de carga con todos los códigos.
2. **Carga (control de pantalla):** al grabar cada albarán, se **lee de la pantalla** el Nº de viaje y Nº de albarán recién generados y se escriben en la tabla `Viajes` de n8n con `estado_carga=CARGADO` (paso 9 del skill). Como se lee en el instante, **es siempre el número real de ese registro**, aunque haya cargas manuales por fuera del flujo → no se desincroniza.
3. **Sincronización (Claude nube):** se espeja `Viajes` (n8n) → `registro-procesamiento.csv` (git), emparejando por referencia, y se completan Nº de viaje/albarán y estado.

Nunca pre-asignar ni teclear a mano esos números: solo capturarlos de Gesruta.

## Km (ver también `catalogo/correcciones-julio.json`)

Odómetro continuo por viaje. Km carga por albarán = final − inicio. Entre albaranes del mismo
viaje hay **km vacío** (reposicionamiento). En Gesruta el form "Kilómetros" es a nivel viaje;
Km vacío y Nueva lectura los confirma Julio.
