# Encargo a Claude Code — Fase 3: Archivo en Drive con reglas de negocio

> Convierte el archivador actual (upload + move, sin reglas) en un archivo ordenado según las reglas reales de la oficina, con deduplicación y acceso estable para los agentes.
>
> **Depende de la Fase 2.** No arrancar hasta que el cruce ficha↔documento esté entregado: el archivo necesita saber a qué viaje pertenece cada documento y quién es el cliente, y eso lo produce el cruce.

---

## 0. REGLA DE ARRANQUE

1. Inspeccionar el **Drive Archiver actual** (modos upload + move ya implementados, Fase 1b construida) y la tabla `documentos`. Este encargo extiende lo que existe, no lo reemplaza.
2. Confirmar el estado real de la Fase 2 (cruce) — este encargo consume su salida.
3. Verificar qué campos de la tabla `documentos` guardan hoy la ubicación en Drive. Si guarda **rutas** en vez de **file_id**, eso hay que cambiarlo (§4).
4. Si algo contradice este encargo, **parar y reportar**.

## 1. Estructura de carpetas — definitiva

**La empresa (TLE / HEC) es siempre la raíz.** Sale del membrete de la ficha, dato que el sistema ya extrae. Tanto fichas como documentos cuelgan de ella.

### Fichas de chofer
```
/{Transliquidos Estevez | Hnos Estevez Casal}/
  /Fichas/
    /{año}/
      /{mes en palabra}/          → "Julio"
        /{Chofer}/                → "Marcos Pérez"
          /{DD-DD-MM}.pdf
```

**Nomenclatura del archivo:** día de inicio, día de fin, mes.
- Bloques del 15, 16 y 17 de julio → `15-17-07.pdf`
- Los tres bloques el mismo día → `15-15-07.pdf` (formato uniforme, no variable)
- El mes va aunque sea redundante con la carpeta — así el archivo se identifica fuera de contexto.

**Colisión imposible por regla de negocio:** un chofer no puede tener dos fichas con el mismo rango de fechas (confirmado por Julio). Si aparecen dos, es un duplicado → §3.

### Documentos de transporte
```
/{Transliquidos Estevez | Hnos Estevez Casal}/
  /facturacion clientes/
    /facturacion liquidos/
      /{año}/
        /facturacion {mes} {año}/     → "facturacion julio 2026"
          /{cliente}/                 → "FORESA"
            /_sin_asignar/            ← acá escribe la ingesta (§2)
              /{referencia}.pdf
            /FRA {NNN}/               ← acá los mueve el cierre de facturación
              /{referencia}.pdf
```

**Un solo PDF por viaje**, nombrado con la referencia. Todos los documentos de ese viaje (albarán + CMR + carta de porte + ticket + autorización) van **combinados en ese único PDF**. Llegan siempre juntos, así que se combinan en la ingesta — no hay que reconstruir el PDF después.

Orden interno del PDF combinado: documento de origen primero (albarán/CMR según cliente), después el resto. Documentarlo.

### Reemplazados
```
/{empresa}/
  /_reemplazados/
    /{año}/{mes}/
      /{referencia}_reemplazado_{YYYYMMDD}.pdf
```
El guion bajo lo manda al fondo del listado y deja claro que no es documentación operativa. La fecha en el nombre permite varias versiones sin pisarse.

## 2. Staging — dónde escribe la ingesta

`FRA {NNN}` es el número de factura, y **no existe cuando el documento se archiva**. La ingesta escribe en staging; el cierre de facturación mueve.

Una factura agrupa **varios viajes** de un período (D-03: hay regímenes quincenales y mensuales, así que un cliente puede tener más de una factura en el mismo mes). Los documentos llegan viaje por viaje, **antes** de saber en qué factura van a caer. Por eso "en qué carpeta FRA va este documento" **no se determina en la ingesta**.

**En la ingesta**, el documento se archiva en staging:
```
/{empresa}/facturacion clientes/facturacion liquidos/{año}/
  /facturacion {mes} {año}/{cliente}/_sin_asignar/{referencia}.pdf
```

**En el cierre de facturación** (Fase 5), cuando se conoce qué viajes entran en qué factura y cuál es su número real, los documentos correspondientes se mueven de `_sin_asignar/` a su carpeta definitiva `FRA {NNN}/`.

Consecuencias que este encargo debe respetar:

- La ingesta **nunca crea carpetas `FRA`**. Solo escribe en `_sin_asignar/`.
- El movimiento a `FRA {NNN}` es responsabilidad del cierre de facturación, **fuera del alcance de este encargo**. Acá solo se construye el staging y se deja el mecanismo de movimiento disponible (el Drive Archiver ya tiene modo `move`).
- Un documento que sigue en `_sin_asignar/` pasado el período de facturación es una señal de que no se facturó. Debe ser consultable — no un archivo perdido en una carpeta que nadie mira.

## 3. Deduplicación

### Cómo se detecta

Tuplas distintas según el tipo:

| Tipo | Tupla de identidad |
|---|---|
| **Documento de transporte** | `cliente + referencia + matrícula` |
| **Ficha de chofer** | `empresa + chofer + fecha del primer bloque` |

**Por qué la fecha no entra en la tupla del documento:** la referencia ya es única por cliente, y la fecha es un campo que se lee mal con frecuencia. Incluirla generaría falsos "no duplicado" cuando la fecha se leyó distinto en dos escaneos del mismo papel.

**Si algún campo de la tupla no se pudo leer** (null), no se puede afirmar ni descartar el duplicado → no archivar como nuevo, marcar para revisión. Un duplicado no detectado por datos faltantes ensucia el archivo en silencio.

### Qué se hace con el duplicado

Cuando llega algo cuya tupla ya existe:

1. Comparar la calidad del entrante contra el archivado, con **dos señales objetivas**:
   - Cantidad de texto extraído por el OCR (más caracteres reconocidos).
   - Cantidad de campos en `REVISAR` (menos es mejor).

2. Decidir:

| Situación | Acción |
|---|---|
| El nuevo mejora en **ambas** señales | Reemplaza. El anterior va a `_reemplazados/`. Se registra. |
| El nuevo empeora en **ambas** | Se descarta. Va a `_reemplazados/` con nota. Gana el original. |
| Mejora en una y empeora en la otra | **No reemplaza automáticamente.** Va al tablero de pendientes para que una persona decida. |

El tercer caso importa: un escaneo con ruido puede generar más caracteres sin ser mejor. No quiero que "más texto" se confunda con "mejor lectura".

3. **Siempre queda registro.** Nada se borra. La carpeta `_reemplazados/` conserva todo lo desplazado, con fecha.

## 4. Acceso de los agentes — decisión de arquitectura

Los agentes del equipo (validador, cierre de facturación, auxiliar administrativo) van a necesitar acceder a documentos archivados. **No deben navegar la estructura de carpetas.**

**El motivo:** las rutas cambian. Todo documento nace en `_sin_asignar/` y al facturar se mueve a `FRA {NNN}/` — o sea que **la ruta de cada documento cambia al menos una vez en su vida**. Cualquier agente que guarde una ruta queda apuntando a la nada, y falla en silencio.

**El diseño:**

- La tabla `documentos` guarda el **`file_id` de Google Drive**, no la ruta.
- Los `file_id` de Drive **son permanentes**: sobreviven a renombrados y movimientos de carpeta. Mover un archivo de `_sin_asignar/` a `FRA 332/` no altera su `file_id`.
- Los agentes consultan la tabla por los datos del viaje (cliente, referencia, matrícula, fecha) y obtienen el `file_id`. Con ese ID descargan el archivo por la API de Drive.
- La ruta legible se guarda también, pero **solo como dato informativo para humanos** — nunca como llave de acceso.

Resultado: la oficina navega carpetas ordenadas, los agentes usan IDs estables, y reorganizar el Drive no rompe nada.

**Si hoy la tabla `documentos` guarda rutas en vez de `file_id`, migrar.** Reportarlo si es el caso.

## 5. Tests

**Estructura y nomenclatura:**
- Ficha de TLE, chofer Marcos Pérez, bloques del 15 al 17 de julio 2026 → `/Transliquidos Estevez/Fichas/2026/Julio/Marcos Pérez/15-17-07.pdf`
- Ficha con los tres bloques el mismo día → `15-15-07.pdf` (formato uniforme).
- Ficha de HEC → cuelga de `/Hnos Estevez Casal/`, no de TLE.
- Documento FORESA referencia 2009926, julio 2026 → `/…/facturacion julio 2026/FORESA/_sin_asignar/2009926.pdf`
- La ingesta **nunca** crea una carpeta `FRA {NNN}` (test explícito: no debe aparecer ninguna tras archivar).
- Consulta de documentos que siguen en `_sin_asignar/` pasado el período → devuelve la lista (no facturados).
- Los N documentos de un viaje quedan en **un solo PDF**, con el documento de origen primero.

**Deduplicación:**
- Mismo `cliente + referencia + matrícula` que uno ya archivado → detectado como duplicado, no se archiva como nuevo.
- Duplicado con más texto extraído **y** menos REVISAR → reemplaza; el anterior aparece en `_reemplazados/` con fecha.
- Duplicado peor en ambas señales → no reemplaza; el original permanece.
- Duplicado mejor en una y peor en otra → ni reemplaza ni descarta; va al tablero.
- Tupla incompleta (algún campo null) → no se archiva como nuevo, se marca para revisión.
- Ficha duplicada (`empresa + chofer + fecha`) → mismo tratamiento.

**Acceso:**
- La tabla `documentos` guarda `file_id`, no ruta.
- Mover un archivo de `_sin_asignar/` a `FRA {NNN}/` → el `file_id` guardado sigue resolviendo al archivo correcto.

**No regresión:** los modos upload y move existentes siguen funcionando.
`node --test` / runner verde. `npm run check` al día.

## 6. Commit

```
feat(archivo): estructura, nomenclatura y deduplicacion en Drive

Fichas por empresa/año/mes/chofer con nombre DD-DD-MM. Documentos por
empresa/facturacion/año/mes/cliente/_sin_asignar con un PDF combinado por
viaje nombrado con la referencia; el movimiento a FRA {NNN} lo hace el cierre
de facturacion. Deduplicacion por tupla (cliente+referencia+matricula para
documentos, empresa+chofer+fecha para fichas) con criterio objetivo de calidad
y carpeta _reemplazados que conserva todo. La tabla documentos guarda file_id
de Drive, no rutas: los agentes acceden por ID estable y los movimientos de
carpeta no rompen nada.
```

## 7. Verificación manual

1. Archivar las 3 fichas reales y confirmar que caen en la ruta correcta con el nombre correcto.
2. Reenviar una de esas fichas → detectado como duplicado, no se archiva dos veces.
3. Reenviar una versión de peor calidad → el original permanece, el nuevo va a `_reemplazados/`.
4. Mover a mano un archivo de `_sin_asignar/` a una carpeta `FRA` en Drive → confirmar que el `file_id` guardado sigue resolviendo.
5. Confirmar visualmente que el Drive queda navegable para alguien que no conoce el sistema.

## 8. Fuera de alcance

- El tablero de pendientes como interfaz (Fase 4) — este encargo produce los datos que alimentan el tablero, no la pantalla.
- El movimiento de `_sin_asignar/` a `FRA {NNN}` al cerrar la factura — es del cierre de facturación (Fase 5). Acá solo se construye el staging.
- Retomar Document AI (deuda de v2 de lectura).
- Tocar el validador.
