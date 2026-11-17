---
name: "cargar-viajes-gesruta"
description: "Procedimiento para cargar viajes y albaranes en Gesruta (app de escritorio) por control de pantalla, para Transliquidos Estévez. Úsalo cuando Julio pida cargar uno o varios viajes/albaranes en Gesruta."
---

# Cargar viajes en Gesruta (Transliquidos Estévez)

> **FUENTE DE VERDAD VERSIONADA.** Esta es la copia del procedimiento del bot
> **guardada en el repo** (respaldo 17/11). El bot de escritorio carga la versión
> **sincronizada en la cuenta** de claude.ai; si las dos difieren, **manda ésta** y
> la de la cuenta hay que re-sincronizarla desde acá (claude.ai → Settings → Skills).
> No editar solo la copia sincronizada: ese cambio no se guarda y se pierde.

Dar de alta viajes y albaranes en Gesruta (app de escritorio Windows) por control de la computadora. Es facturación real: **no inventar, fallar ruidoso**. Verificar cada código contra lo que muestra Gesruta y PARAR/preguntar si algo no coincide. Nada se presenta a DGT ni se envía; solo cargar.

Rol: sos "las manos". Cargás a partir de una ORDEN ya resuelta (no decidís reglas de negocio) y **NO escribís en el repositorio**: del registro en git se encarga Claude (nube), único editor del libro mayor.

## Reglas de oro
- No inventar ningún dato. Si un código no devuelve el nombre esperado, parar y preguntar a Julio.
- Confirmar los datos sensibles (importes, indexación, km).
- Formato español: coma decimal (2.035,71 · 0,1370).
- **En los buscadores, teclear solo unos pocos caracteres** y elegir de la lista (matrículas/códigos pueden llevar separadores; no teclear la matrícula de corrido).
- Al introducir el **cliente** salta el cartel "Consulta Situación Riesgo Cliente": es informativo → **cerrarlo** (X arriba a la derecha del cartel) sin más.
- **NO grabar (F2 / disquete) hasta terminar TODO el albarán.** El albarán se finaliza recién con la carga de km. Grabar antes saca de la pantalla de líneas (pregunta "¿Convertir pedido en albarán?") y deja el viaje en **modo lectura**. Si quedó bloqueado, volver a edición con el **lápiz** de la barra inferior (al lado de la hoja en blanco).
- **No re-abrir Gesruta a mitad de una carga** (no usar open_application repetidamente): puede disparar de nuevo "Selección de Empresas"/login. Si el panel de Claude tapa la ventana, traerla al frente clicando su **barra de título**.
- **Claude no puede teclear la clave de login** (es autenticación): el login de usuario (Operaciones) lo hace Julio, o deja Gesruta ya logueado y posicionado en Viajes/Albaranes.

## Conceptos del dominio
- **Viaje** = la(s) hoja(s) de servicio que rinde el chofer. **Cada origen/destino = un albarán.** Un viaje puede tener varios albaranes.
- **Concepto e IVA** del albarán se cargan solos según la radicación (fiscal) del cliente. Nacional → **P** (IVA 21). Internacional (p. ej. RNM, cliente portugués) → **PI** (IVA 0) + indexación **GPT**. Quimidroga factura Portugal como nacional → P (IVA 21) + G.
- **Código de cabeza (tractora)** = la matrícula sin las letras (ej. 2498KZL → 2498). Al meterlo trae matrícula, remolque y chofer; **verificar los tres contra la orden**. Si el remolque/chofer que trae no coincide con la orden, parar y preguntar; si hay que cambiar el remolque, buscarlo por matrícula (pocos dígitos).
- Empresas: **TLE = 0006** TRANS. LIQUIDOS ESTÉVEZ S.L. · **THEC = EC06** TRANSPORTES HNOS ESTEVEZ CASAL S.L.

## Secuencia de pantallas (siempre la misma)
Mapeo por pantalla. **Velocidad:** cargar cada pantalla **en bloque** (una sola secuencia de acciones encadenadas: clic/teclear/Tab por campo) y **verificar con UNA sola captura por pantalla**, nunca campo a campo. Detenerse solo si una resolución no coincide, en el cartel de cliente, o en los km.

### Pantalla 0 — Inicio
Idealmente Julio deja Gesruta **ya logueado** y en **Viajes/Albaranes** (sobre un viaje existente o un viaje nuevo ya abierto). Si hay que elegir empresa: "Selección de Empresas" → **0006 TLE** → doble clic. Si pide login de usuario (Operaciones + clave): **lo hace Julio** (Claude no teclea credenciales).

### Pantalla 1 — Cabecera del viaje (una vez por viaje)
- **Viaje nuevo:** icono de **hoja en blanco de la barra inferior** (vacía toda la cabecera, Viaje nº en blanco). Al abrir Viajes/Albaranes aparece el último viaje — NO editarlo. (Escape cancela una inserción.)
- **Cabeza** = cód de tractora → trae matrícula/remolque/chofer. **Verificar los tres**; cambiar remolque por buscador si no coincide.

### Pantalla 2 — Albarán · Cabecera (por albarán)
- **Abrir albarán:** tras completar cabeza/remolque/chofer (y proveedor si aplica), pulsar **F3** o el icono de **hoja en blanco a la DERECHA de la rejilla** de albaranes. **NO** la hoja en blanco de **abajo** (esa crea un viaje nuevo). Abre "Entrada de Albaranes"; vale igual para cada albarán del viaje. (El viaje no debe estar grabado/bloqueado; si lo está, volver a edición con el lápiz. Doble clic sobre un albarán existente lo abre para editar, no crea uno nuevo.)
- Campos, en orden: **Cliente** (cód; verificar razón social; cerrar el cartel de riesgo) · **Origen** (cód; a veces lo autocompleta el cliente → no teclear) · **Destino** (cód) · **Carga** (cód; si no se tiene, doble clic en la celda → buscar por nombre) · **Referencia** ("Refe.", arriba derecha) · **Fecha Salida** · **Fecha Llegada** (triple clic y teclear dd/mm/aaaa). Dejar vacíos los campos no pedidos. Cargas/descargas se autollenan de origen/destino.
- **Campo1 / Campo2 — multi-punto (CLAVO/FRIGOS), OBLIGATORIO si la orden los trae.** Cuando el albarán de la orden incluye `campo1` y/o `campo2` (carga o reparto con **más de un punto**), hay que rellenar en Gesruta los campos **Campo1** y **Campo2** del albarán con esos valores **tal cual vienen en la orden** (listas abreviadas ≤19 car., p. ej. `GETAF/TORRE`): **Campo1** = todos los puntos de la **carga** (orígenes), **Campo2** = todos los puntos del **reparto** (destinos). `Origen`/`Destino` siguen siendo el 1er punto de carga / el último de reparto (por código); Campo1/Campo2 son el **detalle completo** y no se deben dejar vacíos en multi-punto. Si la orden NO trae `campo1`/`campo2` (un solo punto), dejar esos campos vacíos.

### Pantalla 3 — Albarán · Solapa Líneas (por albarán)
- **Línea de porte:** icono "Añadir nuevo" (arriba a la derecha de la rejilla de líneas). Concepto (P/PI) e IVA entran solos — verificar que correspondan (RNM internacional debe salir **PI / IVA 0**).
  - **Por tonelada:** UM = **TN**, Cantidad = toneladas, Precio (verificar tarifa; si no se autocarga, teclearlo según la orden).
  - **Precio fijo / unitario:** UM = **UN** (doble clic en UM → UNIDADES = cód UN), Cantidad = **1**, Precio = importe fijo. Los **kg NO se cargan**.
- **Línea de indexación — SOLO si la orden la trae** (la orden incluye concepto G/GPT y factor). Si la orden no trae indexación, **no agregar esta línea**. Cuando corresponde: "Añadir nuevo", concepto **G** (nacional) o **GPT** (internacional), **Cantidad** = importe de la línea de porte, **Precio** = factor. **NO aplicar DUO** (Dto 0).
- **TARIFA PENDIENTE** (la orden lo indica): cargar **solo cabecera + km**; dejar las líneas de porte e indexación **sin cargar**. En este caso, al preguntar "¿Convertir pedido en albarán?" responder **NO**, y poner el desplegable **Estado = "Pedido"**.

### Pantalla 4 — KM (por albarán) — ENTRAR AQUÍ, no grabar con el disquete
- Al terminar las líneas, pulsar **Kilómetros** (arriba a la derecha). Gesruta pregunta "¿Desea grabar el albarán?" → **Sí**, y "¿Convertir pedido en albarán?" → **Sí** (salvo tarifa pendiente → **NO** + Estado "Pedido"). Abre el formulario de km.
- Form de km (a nivel viaje, odómetro):
  - **Km. carga** (fila Chofer) = odómetro fin − inicio (de la orden).
  - **Km. vacío (lo calcula Claude en pantalla, no precalcular):** tras cargar los km cargados, Gesruta muestra un parcial en **"Nueva lectura"**. **Km vacío = (Nueva lectura parcial) − (KM fin)**. Colocarlo en **"KM vacío"**. **Comprobación:** luego "Nueva lectura" debe coincidir con "KM fin"; si no, parar y preguntar.
  - Guardar con el disquete del cuadro de km.
- Repetir pantallas 2–4 por cada albarán.

## Registro de números de Gesruta (paso final por albarán)
Tras grabar cada albarán, leer de la pantalla el Nº de viaje (cabecera) y el Nº de albarán (rejilla), emparejar por origen→destino, y reportarlos al cerrar el viaje completo. No inventarlos ni pre-asignarlos; si no aparecen donde se espera, parar. No escribir en ningún repositorio: del registro en git se encarga Claude (nube).

## Formato de orden (lo genera Claude nube)
Un bloque por albarán, campos en el orden de pantalla, con el valor *esperado* de cada resolución (la línea `index` aparece solo si ese albarán lleva indexación):
```
# ORDEN — <chofer> — EMPRESA: <TLE|THEC>
CABEZA <cód>            # tractora <matr>; remolque <matr|–>; chofer <nombre>
ALB n <nombre>
  cliente  <cód>                 # <razón social>
  origen   <cód|AUTO>            # <localidad>  (1er punto de la carga)
  destino  <cód>                 # <localidad>  (último punto del reparto)
  campo1   <lista abrev>         # SOLO multi-carga: todos los orígenes (≤19 car.)
  campo2   <lista abrev>         # SOLO multi-reparto: todos los destinos (≤19 car.)
  carga    <cód|BUSCAR:nombre>    # <nombre>
  ref      <referencia>
  salida   dd/mm/aaaa
  llegada  dd/mm/aaaa
  porte    um=<TN|UN> cant=<n> precio=<n>   # importe <n>, IVA <21|0>   (o: TARIFA PENDIENTE → sin líneas, Estado Pedido)
  index    concepto=<G|GPT> factor=<n>      # SOLO si lleva indexación; cant=importe porte; importe <n>
  km       inicio=<n> fin=<n> carga=<n>     # vacío lo calcula Claude en pantalla
```

## Notas (control por pantalla)
- El PC debe estar desbloqueado y la pantalla encendida. El acceso de control caduca a los ~30 min de inactividad: re-solicitarlo.
- Gesruta corre desde ruta de red; si no se reconoce por nombre, resolver el acceso por el ejecutable (gesruta.exe).
- El panel de Claude puede tapar la parte derecha del formulario; traer Gesruta al frente clicando su barra de título (NO re-abrir con open_application).
