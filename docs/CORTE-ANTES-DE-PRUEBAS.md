# Corte de desarrollo — estado real antes de las pruebas definitivas

> Julio, 31/08/2026: *"Vamos a hacer un corte en el desarrollo y vamos a empezar
> con las pruebas definitivas, salvo que haya alguna otra cosa, punto o tema a
> cerrar para empezar a ver los resultados reales."*
>
> Este documento contesta esa pregunta con precisión: **qué quedó cerrado**, y
> **qué falta para que una prueba dé un resultado que signifique algo**.

---

## Lo que quedó cerrado

### 1. Extracción anclada por emisor — los 4 clientes que más pesan

`catalogo/plantillas-cliente.json`, los cuatro **confirmados por Julio**:

| Cliente | Documento | Ancla de la referencia | Formato |
|---|---|---|---|
| **FORESA** | CMR/ALBARAN | **2.º** número bajo el título | 7 dígitos |
| **BRESFOR** | CMR/GUIA DE REMESSA | **1.º** número tras `Doc. int:` | 10 dígitos |
| **RNM** | Guía Remessa | `Número/Number` | 10 dígitos, empieza en 0 |
| **QUIMIDROGA** | Orden de transporte | `Referencia en factura:` | variable (6-8) |

**El principio que salió de mirar los documentos:** la referencia **no se extrae
por formato** —varía, y Julio lo advirtió— sino por la **etiqueta ancla**, que sí
es estable. Y el ancla **pertenece al emisor, no al tipo de documento**: Foresa y
Bresfor emiten papeles casi idénticos y su regla es la **opuesta**.

Cada plantilla lleva además la sección **"no confundir"**, que vale tanto como el
resto: en los documentos observados hay entre **tres y cinco números** que
compiten con la referencia (pedido, ref. del comprador, albarán interno,
referencia de la terminal).

### 2. Las plantillas están en producción, no sólo documentadas

`ficha/plantillas.js` las pone a trabajar en dos sitios:

- **`promptDeCliente()`** — el trozo de prompt que le dice al modelo, para *ese*
  emisor, qué ancla mirar y qué ignorar. Sustituye al *"extrae los datos clave"*,
  que es lo que hacía que eligiera mal entre cinco números.
- **`verificarReferencia()`** — la guarda que corre **después** de leer, y **no
  depende del modelo**. Comprueba el formato del emisor y, sobre todo, que el
  valor **no coincida con otro número del documento**. Un número de pedido tiene
  formato de número y pasa cualquier validación de forma: sólo se lo caza
  comparándolo con el resto.

23 tests. Uno fija explícitamente que el mismo número es válido para Foresa e
inválido para Bresfor.

### 3. Tarifa: cascada completa y trazable

```
1. tarifa CONTRACTUAL (tabla Tarifas)          → origen_del_precio 'contractual'
2. tarifa POR ANALOGÍA confirmada              → 'analogia'  + REVISAR
3. precio impreso en la ORDEN                  → 'orden'     + REVISAR
4. nada, con el motivo escrito                 → null
```

Cada fila dice **de dónde salió su precio**. Las 12 analogías que Julio confirmó
una por una están activas; las 3 "negociables" y las 5 descartadas, fuera.

### 4. Conjunto cerrado por cliente

`ficha/rutas-conocidas.js` cambia la pregunta de *"¿cuál de los 790 puntos es?"*
a *"¿cuál de las rutas conocidas de este cliente es?"*. Sale de los 7.578 portes
reales del año.

- **No rechaza rutas nuevas, las marca.** `RNM → TERUEL` resuelve pero avisa.
- **Corrobora lecturas débiles:** si el texto da una lectura dudosa y el cliente
  hizo esa ruta 120 veces, la duda se levanta. Es lo que baja REVISAR sin
  inventar nada.
- **Un empate no se rompe con la frecuencia.**

### 5. Memoria de decisiones

`ficha/memoria-decisiones.js`: una duda que un humano resolvió no se vuelve a
preguntar. Con `tasaRevisar()`, el número que dice si el sistema aprende.

---

## Las reglas de negocio que se fijaron (todas en `INDICE.md`)

| | Regla |
|---|---|
| **R-01** | Fecha de carga: manda la **ficha del chófer**. Reconfirmada el 31/08 para **todos** los clientes, incluido RNM |
| **R-07** | Referencia de Foresa y Bresfor: reglas **opuestas** |
| **R-08** | Para facturar manda el peso de **carga** (albarán/CMR). La báscula de descarga no factura |
| **R-09** | Destino de RNM: manda la **Guía Remessa** |

---

## ⚠ Lo que FALTA para que la prueba signifique algo

Esto es lo que Julio preguntó, y la respuesta honesta es que **hay cuatro cosas**,
y dos son bloqueantes.

### BLOQUEANTE 1 — Nada de esto está corriendo todavía

Todo lo de arriba vive en el repo. **El flujo de n8n sigue ejecutando el código
anterior.** Si se corre una prueba hoy, no mide nada de lo que se construyó.

Hace falta: pegar en n8n los `.generated.js` regenerados, y cargar
`plantillas-cliente.json`, `rutas-por-cliente.json` y `tarifa-por-analogia.json`
donde el flujo pueda leerlos.

**Es exactamente el defecto que venimos arrastrando: el hallazgo que no llega a
producción.** Sin esto, la prueba mide la versión vieja.

### BLOQUEANTE 2 — Sin set de control, la prueba vuelve a ser una anécdota

Sin las respuestas correctas escritas **antes** de correr, "salió mejor" y "salió
peor" son opiniones. Con set de control es un número.

Julio ya lo empezó a preparar. Hacen falta los juegos con su respuesta correcta
al lado, y **quedan versionados en el repo** para que no se pierdan otra vez.

### NO bloqueante, pero conviene antes

**Los 17 puntos duplicados del catálogo** (mismo nombre, dos `Cód.Pto.`:
ALBACETE `AB`/`ALBAC`, GIJON `GIJ`/`GIJON`…). Ante uno de esos el resolvedor se
niega a elegir y manda a REVISAR — correctamente, porque no puede saber cuál usó
la oficina. Son **17 decisiones de un minuto** que eliminan una fuente permanente
de REVISAR.

**Los puntos que faltan dar de alta en Gesruta**: `NOGALES` (RNM/DIMENSA) y
`CALDAS DE REIS → PADRON` para Foresa. No se arreglan por código.

### Lo que puede esperar

- **"Reparto"**: única columna de las 29 sin mapear.
- **HELM, CLAVO, BALTRANSA, TRANSTAMBRE, Q. DEL JARAMA**: sin plantilla. Decisión
  de Julio: probar primero con los cuatro que ya están, que son el mayor
  porcentaje.
- **Formato de importación de Gesruta**: para la semana siguiente.

---

## Qué esperar de la prueba, dicho antes de correrla

Para que el resultado se pueda leer sin discusión, conviene fijar ahora qué se
mide:

1. **% de filas OK sin tocar** — el número principal.
2. **% en REVISAR** — debe ser **decreciente** entre corridas; si no baja, la
   memoria no se está llenando.
3. **Filas llenas y equivocadas: idealmente cero.** Es el modo de fallo caro y
   el único que no se puede tolerar. Una fila vacía con motivo es aceptable; una
   llena y falsa, no.

**No hay que esperar 100 %.** El input incluye manuscrito escaneado, y eso tiene
un techo. Lo que sí se puede exigir es que **todo error se auto-declare**.
