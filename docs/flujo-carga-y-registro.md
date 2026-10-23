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
2. **Carga (bot `bot/robot_viajes_v2.py`, control de pantalla):** al grabar cada albarán/viaje se capturan los Nº recién generados por Gesruta. El **Nº de albarán** dentro del viaje es su índice (`01`,`02`,…). El **Nº de viaje** es *owner-drawn* (no lo leen portapapeles ni Win32): el bot **captura un recorte PNG** de la pantalla (sin OCR en la PC). Como se captura en el instante, **es siempre el número real de ese registro** → no se desincroniza.
3. **Salida del bot → git (Opción 2, decisión Julio 23/10/2026):** el bot se corre desde el clon del repo apuntando a la carpeta de la orden; escribe ahí el `resultado.json` + el crop `nro_viaje_v<N>.png` y **pushea él mismo** a `main` (`fetch`→`add`→`commit`→`pull --rebase`→`push`; fail-loud si falla). **Julio ya no es el mensajero.** Detalle y contrato: `ordenes-carga/CONTRATO-resultado-json.md`.
4. **Registro en git:** Claude nube lee el `resultado.json` de git (y el crop, para leer el Nº de la imagen), escribe `nro_viaje_gesruta`/`nro_albaran_gesruta` en `registro-procesamiento.csv` y marca `estado_carga=CARGADO`. **Único almacén: git.**

Nunca pre-asignar ni teclear a mano esos números: solo capturarlos de Gesruta.

## Búsqueda de matrícula de remolque/cisterna

Si el remolque autocompletado no coincide, el bot usa el buscador de Gesruta. **Regla (Julio
23/10/2026): buscar siempre por los ÚLTIMOS 3 DÍGITOS NUMÉRICOS de la matrícula.** Las cisternas se
guardan con formato tipo `PO 2194 R`; teclear todos los dígitos (`02194`) no matchea por el 0 a la
izquierda / formato, pero los últimos 3 (`194`) sí.

## Km (ver también `catalogo/correcciones-julio.json`)

Odómetro continuo por viaje. Km carga por albarán = final − inicio. Entre albaranes del mismo
viaje hay **km vacío** (reposicionamiento). En Gesruta el form "Kilómetros" es a nivel viaje;
Km vacío y Nueva lectura los confirma Julio.
