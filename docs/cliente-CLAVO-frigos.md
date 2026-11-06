# Cliente CLAVO FOOD FACTORY (FRIGOS) — facturación POR KM

> Cliente nuevo documentado el 06/11/2026 a partir de un juego real (tractora
> 5132-LMC, chófer José Carlos Rodríguez, 26–31/10/2026) + el Excel de control
> `CONTROL_FACTURACION_FRIGOS_2026.xlsx` + 3 pantallas de carga en Gesruta que
> envió Julio. Es el PRIMER cliente que se factura **por kilómetro**, no por
> tonelada: por eso tiene su propio documento.

---

## 1. Identidad

- **CLAVO FOOD FACTORY, S.A.** — CIF **A49012339**. Fábrica en **PG La Vega,
  47100 TORDESILLAS (Valladolid)**. Horario descarga 08:00–13:00.
- **Código de cliente Gesruta = `4`** (ya en `catalogo/clientes-gesruta.js`).
- Es cliente **ESPAÑOL** → concepto **P (PORTES NACIONALES)**, **IVA 21**.
- Negocio: logística de frío. CLAVO fabrica en Tordesillas; TLE/THEC le mueve
  materia prima y producto terminado por toda España (CONGELADO, PAN RALLADO,
  REFRIGERADO, SECO y mezclas). Los remitentes/destinatarios de los albaranes
  son terceros (FRUMEN, Costco, STEF, Montfrisa…), pero **quien paga es CLAVO**.

---

## 2. Lo que lo hace distinto: se factura POR KM (no por TN)

`rutas-por-cliente.json` (cliente 4) ya lo tiene con `"unidad": "KM"`.

**Importe del tramo = KM con carga × tarifa €/km.** No hay tonelaje, no aplica
el mínimo de 23 TN, no hay (por ahora) línea de indexación de gasóleo.

### Tarifa €/km — **la resuelve el armador** (confirmado Julio 06/11)

La tarifa NO se teclea del talón: se resuelve por **corredor/sentido** y se
multiplica por los km con carga. El cálculo manuscrito del talón (`K × €/km`) es
**verificación**, no fuente. Tarifas vigentes (octubre 2026), del histórico:

| Corredor / sentido | €/km (histórico → vigente) |
|---|---|
| **SALIDA** (`S`) — distribución centro/norte (corredor Tordesillas↔Madrid: Getafe, Torrejón, Castro Urdiales, Colmenar…) | 1,44 → 1,48 → **1,52** |
| **RETORNO** (`R`) / backbone Galicia (Tordesillas↔Caldas de Reis y retornos a base) | 1,24 → 1,27 → **1,31** |
| **Cercanías** (`C`, local tipo Campiño) — importe **fijo** | **212 €** (oct; 206 en ene) |
| **Tordesillas–Reinosa** (`U`) — importe **fijo** | **315 €** (oct; 306 en ene) |

- **Manda la tarifa más reciente** (sube durante el año). Los valores de
  referencia (S, R, Cercanías, Reinosa) viven en las **celdas de cada solapa
  mensual** del Excel y cambian mes a mes. **Octubre 2026:** S `1,52` · R `1,31`
  · Tordesillas–Caldas `1,31` · Cercanías `212` · Reinosa `315`. (Enero: 1,48 /
  1,27 / 206 / 306.)
- El Excel marca el sentido en la columna **L**: `S`=Salida, `R`=Retorno,
  `U`=ruta fija (Reinosa), `C`=Cercanías.

---

## 3. La documentación del chófer — tres papeles

| Papel | Qué es | Qué aporta |
|---|---|---|
| **HOJA DE RUTA / PARTE** (rotulada *"Dietas"*) | El esqueleto del período de un camión | Secuencia de tramos, **odómetro inicio/fin** de cada uno, fechas, lugares, mercancía, y el desglose de **dietas/gastos** (dieta+descarga+doblaje+nocturnidad por día, gasóleo, peajes) |
| **TALÓN DE PORTE de TLE** (manuscrito, uno por tramo) | La base de facturación | Origen→destino(s), `K ≤ <km>` y la cuenta `km × €/km = importe`, palets |
| **Albaranes / cartas de porte de terceros** (CLAVO "Traspaso entre Depósitos -18°C", FRUMEN, Costco, STEF…) | Prueba de entrega, sellada por el destinatario | Justifican el tramo; **no** cambian el importe |

No hay tickets de gasóleo sueltos: el gasóleo sale del parte.

---

## 4. El Excel de control (`CONTROL_FACTURACION_FRIGOS_2026.xlsx`)

Lo completa **Julio** a mano a partir de los papeles. Una hoja por mes,
organizado por **camión** en bloques, con totales por tractora. Una **fila = un
tramo = un albarán** de Gesruta. Mapeo:

| Columna | Fuente |
|---|---|
| Emp (TLE/HEC) | empresa del camión (HEC = THEC) |
| Tractora | parte/talón |
| Fecha carga / descarga | parte |
| Origen / Destino | talón + parte |
| Nº Carg / Nº Rep | nº de cargas / de destinos del tramo |
| Kms carga / descarga | **odómetro** inicio / fin (parte) |
| Kms con carga (K) | fin − inicio |
| Kms en vacío (N) | inicio de este tramo − fin del anterior (misma tractora) |
| L (S/R/U/C) | sentido → **determina la tarifa** |
| Importe a facturar (M) | **K × €/km** (fijos U=306 / C=206) |
| Cliente / Carga | CLAVO / tipo de mercancía |
| Palets Dev. | palets devueltos |
| Dietas (Dobl/Noct/C-D/Dieta/Total), Gasoil, AdBlue, Otros | parte — **control interno** |
| **GesR** | marca de **"ya cargado en Gesruta"** (confirmado Julio 06/11) |

El Excel es la **fuente para la carga en Gesruta**.

---

## 5. Cómo se carga en Gesruta (3 formularios) — confirmado con pantallas 06/11

Empresa siempre **0006 TRANS. LIQUIDOS ESTÉVEZ** (TLE), incluido THEC (ver §6).

### 5.1 Entrada de Viajes (cabecera)
- **Cabeza** = código de tractora (ej. `5132`) → **Matrícula** autocompleta
  (`5132LMC`). **Remolque** (`9520` → `R9520BCV`). **Chófer** por código
  (ej. `19` = JOSE CARLOS RODRIGUEZ).
- THEC: ver §6 (PROVE).

### 5.2 Entrada de Albaranes (la línea de porte)
Una línea por albarán, **Estado `Pedido`**:

| Campo | Valor |
|---|---|
| Cdgo | **`P`** |
| Concepto | **PORTES NACIONALES** |
| Cantidad | **= KM con carga** (ej. 764,000) |
| UM | **TN** *(es cosmético: el número es KM, no toneladas)* |
| Precio | **= €/km** (ej. 1,5200) |
| Iva | **21,00** |
| Importe | Cantidad × Precio (lo calcula Gesruta; ej. 764 × 1,52 = **1.161,28**) |
| Origen / Destino | por **código de punto Gesruta** (ej. CALDAS DE REIS = `1`, TORREJON = `9735`) |

Debajo, **CARGAS** (punto + fecha de carga) y **DESCARGAS** (punto + fecha de
descarga). **Sin línea de indexación en el albarán**: la indexación va **agregada
en facturación** (ver §5.4).

> **Multi-reparto:** un talón con varios destinos = **UN** albarán con **UNA**
> línea de porte por el **km total** del viaje (confirmado Julio 06/11). En el
> campo **Destino** va el **ÚLTIMO** destino; en **Campo2** van **TODOS** los
> destinos con **abreviaturas**, procurando **≤ 19 caracteres** para que entren
> en la factura. CLAVO **NO** lleva línea `REP` (eso es FORESA): el multi-destino
> ya está contenido en los km.

### 5.3 Kilómetros (odómetro / tacógrafo)
**Un apunte por viaje** (confirmado Julio 06/11): **Nueva lectura** (odómetro
final del viaje), **Fecha**, y **Km carga = km total con carga** (= la `Cantidad`
del porte, ej. 764) y **Km vacío** (ej. 0) por chófer (= Km Bonificables). *(El
`244` de la pantalla de ejemplo fue un error de llenado de Julio; el correcto es
km carga 764, km vacío 0.)*

### 5.4 Indexación de gasóleo — AGREGADA, como FORESA (confirmado Julio 06/11)
CLAVO **sí** lleva indexación, **igual que FORESA**: **NO** por albarán, sino
**una sola línea en el momento de FACTURACIÓN** sobre el acumulado del período
(modalidad **agregada**). Concepto **G** (CLAVO español → nacional). El **% es
mensual**: **agosto = 0,0766 · septiembre = 0,1370 · octubre = PENDIENTE** (Julio
aún tiene que conseguirlo). En el armador se trataría como la agregada de FORESA
(la línea por albarán va con `cargar: false` / se acumula y se cierra en factura).

---

## 6. THEC (empresa HEC en el Excel) → modelo PROVE

Igual que ya definimos para THEC (confirmado Julio 06/11): el viaje de THEC se
carga **en el perfil de TLE** (empresa 0006). En Entrada de Viajes: **Cabeza =
`PROVE`**, matrícula de tractora **completa** tecleada, remolque **completo**
tecleado, **Proveedor = `5`**. Km y costos de proveedor **vacíos**. De ahí, el/los
albarán(es) igual que §5.2. Disparador: el tramo es de un camión THEC.

Tractoras vistas (de los bloques del Excel):
- **5132LMC** → R9520BCV, José Carlos Rodríguez — TLE (propio).
- **6124HZT** → Luis M. Triñanes — TLE (propio).
- **9400 LLC** → Manuel Eirín — **THEC** (PROVE). *Pendiente de alta en
  `flota.json` con su remolque cuando llegue un juego suyo.*

---

## 7. Qué NO se carga en Gesruta (por ahora) — confirmado Julio 06/11

Palets, dietas (doblaje/nocturnidad/descarga/dieta), gasoil, AdBlue y otros
gastos son **control interno del Excel** (coste / pago a empleados, hoja PALETS):
**no** se cargan a Gesruta como facturables por ahora.

---

## 8. Pendientes

*(Resueltos el 06/11: km form = 1 apunte/viaje con km total; multi-reparto = 1
albarán, Destino=último + Campo2 abreviado ≤19; indexación = agregada tipo FORESA;
cercanías/fijos de octubre = 212/315.)*

1. **% de indexación de OCTUBRE 2026** — Julio lo tiene que conseguir (ago 0,0766
   · sep 0,1370). Sin él, la línea de índice del período de octubre queda pendiente.
2. **Armador:** falta el **modo €/km** (hoy el pipeline es €/TN + precio fijo) y la
   **indexación agregada mensual** de CLAVO (reusar la mecánica agregada de FORESA).
3. **Agrupación de viajes** en Gesruta: confirmar si es un viaje por tramo o varios
   albaranes por viaje/tractora-día (la pantalla mostró 1 albarán por viaje).
4. **THEC 9400 LLC (Manuel Eirín):** alta en `flota.json` con su remolque cuando
   llegue un juego suyo.

---

## 9. Dónde vive cada cosa

- Código de cliente: `catalogo/clientes-gesruta.js` (CLAVO = 4).
- Tarifas por corredor (unidad KM): `catalogo/rutas-por-cliente.json` (cliente 4).
- Regla de odómetro → km carga/vacío: `catalogo/correcciones-julio.json`
  (campo "kilometros/odometro", 16/10) y la regla CLAVO (06/11).
- Modelo PROVE (THEC): regla "empresa/cabecera (PROVE)" en `correcciones-julio.json`.
