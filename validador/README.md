# Validador de facturas — informe tri-valuado (v3)

Logica de auditoria del validador de facturas. Es la **fuente de verdad** del nodo
Code `Auditar` del workflow n8n `[ESTEVEZ] Auditar Factura (webhook)` (`IlIod0DlephaLmAV`).

## Que cambia respecto de v2

Nada de la logica de contraste: duplicados, indexacion por tramo, minimo 23 t,
matriculas, regimen agregado, Baltransa al 21%, cuadre base/IVA/total y contraste
contra tarifario funcionan igual. **Solo cambia la capa de salida.**

### El falso OK que se elimina

En v2, una linea cuya ruta no tenia tarifa cargada caia en `avisos`:

```js
if (!tf) { avisos.push(et + ' sin tarifa cargada ...'); }
...
L.push(errores.length === 0 ? 'RESULTADO: factura APTA.' : ...);
```

Como el veredicto solo miraba `errores`, una factura entera de rutas sin tarifar
(TRANSTAMBRE, TANK SOLUTIONS, SANTOS, BALTRANSA...) se presentaba como
**"factura APTA"**. No hubo verificacion — no habia tarifa contra la cual
contrastar — pero la oficina lo leia como aprobado.

Principio rector de v3: **"no verificado" jamas puede parecerse a "validado OK".**

## Los tres estados

| Estado | Significado |
|---|---|
| `VALIDADO_OK` | Existe tarifa para la ruta y el importe esta dentro de tolerancia. |
| `DISCREPANCIA` | Existe tarifa pero algo no cuadra (importe, indexacion, matricula, referencia duplicada...). |
| `SIN_TARIFA` | **No existe tarifa cargada para esa ruta. NO VERIFICADO.** |

**Precedencia:** si no hay tarifa, la linea es `SIN_TARIFA` aunque tenga ademas
otros hallazgos — el hecho estructural es que el importe no se pudo contrastar.
Los otros hallazgos no se pierden: van en `detalle` y en el array `hallazgos`.

**Bloqueo:** `SIN_TARIFA` es bloqueante para `listo_para_pago`. Una linea no
verificada nunca se aprueba en automatico; queda senalada para revision humana.

> Relacion con D-6 ("ruta sin tarifa cargada -> aviso, no bloquea"): `SIN_TARIFA`
> **no** fuerza el veredicto "NO enviar" — eso lo siguen haciendo solo los errores
> reales, como decidio D-6. Lo que si bloquea es la aprobacion automatica para
> pago (`listo_para_pago: false`) y la posibilidad de que la linea se lea como un OK.

## Contrato de salida

```json
{
  "resumen": { "validadas_ok": 0, "discrepancias": 0, "sin_tarifa": 0 },
  "detalles": [
    { "linea_id": "L1", "estado": "VALIDADO_OK", "detalle": "..." }
  ],
  "listo_para_pago": false
}
```

Cada entrada de `detalles` trae ademas `referencia`, `origen`, `destino`,
`importe`, `hallazgos[]` y `avisos[]`. `linea_id` es `L{n}` por posicion en la
factura (la referencia no sirve como id: las referencias duplicadas son
precisamente uno de los defectos que el validador detecta).

El nodo devuelve tambien `informe`: el mismo texto plano que ya consume
`auditar-factura.html`, ahora con el resumen por estado al principio, los tres
estados diferenciados (`OK` / `X` / `?`) y una linea `LISTO PARA PAGO: SI|NO`.
No se invento un canal nuevo. Para servir JSON en vez de texto basta cambiar el
nodo `Responder`.

## Archivos

| Archivo | Que es |
|---|---|
| `auditar.js` | La logica. Unica fuente de verdad. |
| `nodo-auditar.wrapper.js` | Envoltorio de n8n (lee OpenAI + data tables, arma el item). |
| `build-nodo.js` | Concatena los dos anteriores en el script del nodo Code. |
| `nodo-auditar.generated.js` | **Generado. No editar a mano.** Contenido exacto del nodo `Auditar`. |
| `tests/auditar.test.js` | Tests, incluida la regresion del falso OK. |

El nodo Code de n8n no puede importar archivos: necesita un script autocontenido.
Generarlo desde una sola fuente evita que el repo y el workflow se separen en
silencio (el error clasico de este proyecto: creer que un cambio esta aplicado y
no estarlo).

## Uso

```bash
cd validador
npm test        # node --test tests/*.test.js
npm run build   # regenera nodo-auditar.generated.js
npm run check   # falla si el generado quedo desactualizado
```

Sin dependencias: runtime de Node (probado en v22) y el test runner incorporado.

Tras tocar `auditar.js` o el wrapper: `npm run build` y copiar
`nodo-auditar.generated.js` al nodo `Auditar` del workflow.

## Logging

`console.log` / `console.error` con prefijo `[validador]` — el logging estandar
del runtime, visible en el log de ejecucion de n8n. Se registra la generacion de
cada informe (cliente, conteos por estado, `listo_para_pago`) y los errores de
entrada. **Sin ELK ni infraestructura de observabilidad**: para este volumen
(batch, bajo) es sobre-ingenieria. `setLogActivo(false)` lo silencia en tests.

## Pendientes heredados (no tocados por este cambio)

- Baltransa al validador (`PRECIO_CERRADO`, `porteDe`).
- Cargar tarifas de TRANSTAMBRE, TANK SOLUTIONS, TRANSPORTES SANTOS, FORESTAL DEL
  ATLANTICO, HISPALENSE, CB SYSTEM OIL, BALTRANSA — hasta que existan, esas rutas
  saldran (correctamente) como `SIN_TARIFA`.
- Regimenes agregados quincenal/mensual: hoy se valida la base declarada contra la
  suma del rango; falta el criterio base de REPARTOS (D-08).

## Estado de despliegue

Aplicado al nodo Code `Auditar` del workflow `IlIod0DlephaLmAV` y publicado
(version activa `95054237-f66f-4488-8822-cc8367f0e097`, 26/07/2026). Verificado
con una ejecucion real en n8n (ejec. 541) contra las data tables vivas: una ruta
FORESA -> TRANSTAMBRE salio `SIN_TARIFA` y la factura quedo `LISTO PARA PAGO: NO`.
Pendiente la pasada con un PDF de factura real desde `auditar-factura.html`.
