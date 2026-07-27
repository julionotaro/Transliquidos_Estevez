# Barrido de modelos — lectura de ficha manuscrita

Comparativa para elegir `MODELO_FICHAS`. **Sin llenar todavia**: la fase PRUEBA
necesita el PDF real de las 3 fichas, que no esta disponible desde la sesion de
build.

## Que cambio respecto de la medicion anterior

La tabla de `ESTADO-Y-TRASPASO.md §1` midio los modelos **con el PDF entrando
como `type:'file'`**. Esa medicion ya no aplica: desde v3.3 la ficha entra como
**imagen rasterizada a 300 DPI**, que es la condicion en la que el test del 26/07
mostro que el manuscrito si se lee. Hay que **re-medir todo**, incluidos los
modelos que ya se habian probado.

## Protocolo

1. Subir el PDF de las 3 fichas (Asensi/2498KZL, Pablo Carles/8420KKT,
   Marcos/3729JLH) por `ingesta-viaje.html`.
2. Una corrida por modelo, mandando `modelo_fichas` en el body del webhook. No
   hace falta tocar el workflow entre corridas.
3. Leer el resultado del nodo `Formatear Linea Gesruta` en la ejecucion.
4. Anotar la fila. Contar sobre los **9 viajes** conocidos (3 fichas x 3 bloques).

## Barra de corte

Aciertan los campos que **facturan**: `kg`, `km`, `fecha`, `matricula`.
Los nombres de destino **no cuentan** (se cruzan contra el documento en el
encargo 3).

**Criterio: el mas barato que pase la barra Y que falle seguro** — devolver
`null` vale mas que inventar. Un modelo que acierta mas pero fabrica valores
plausibles es peor que uno que deja huecos: el hueco lo ve un humano, el invento
se factura.

## Tabla

| Modelo | Coste rel. | Viajes 9/9 | Ano | Odometros | km | Gastos | kg | Matriculas | Inventa? | Pasa barra |
|---|---|---|---|---|---|---|---|---|---|---|
| `gpt-4o-mini` | 1x | — | — | — | — | — | — | — | — | — |
| `gemini-flash` | ~1x | *(pendiente credencial)* | — | — | — | — | — | — | — | — |
| `gpt-4o` | ~17x | — | — | — | — | — | — | — | — | — |

> Referencia historica **sobre PDF-archivo** (no comparable, solo contexto):
> gpt-4o detecto 6/9 viajes, invento el ano (2022) y secuencias de odometro;
> gpt-5 detecto 9/9, dejo odometros en null, ningun gasto, kg en null en ambos.

## Notas por corrida

*(una entrada por corrida: id de ejecucion, que se vio, que fallo)*

## Decision

**Pendiente.** La elige el operador con la tabla llena.

`MODELO_FICHAS` quedo en `gpt-4o-mini` como **punto de partida del barrido**, por
ser el mas barato — no como ganador. Nadie lo midio todavia sobre imagen.
