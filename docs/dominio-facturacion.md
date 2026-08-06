# Dominio de facturación — Transliquidos Estévez (TLE)

> Fuente única de verdad del negocio para el circuito ingesta → cruce → validación → facturación.
> Redactado a partir de los catálogos reales de GESRUTA, el instructivo de Julio, facturas reales y
> el Excel de suplemento gasoleo vigente. Fecha: 2026-08-06.
>
> **Regla general del proyecto**: ante dato ambiguo, faltante o fuera de catálogo, **fallar ruidoso
> (REVISAR)**, nunca rellenar en silencio ni adivinar. Es el mismo patrón "cliente no reconocido →
> REVISAR" y se aplica a todo lo de abajo.

## 1. Qué es un viaje y cómo se factura

La unidad facturable es el **albarán** (no el bloque de ficha del chofer; un bloque puede ser N
viajes). Cada viaje factura, como mínimo, una línea de **porte**:

- Concepto `P` = PORTES NACIONALES, o PORTES INTERNACIONALES según el servicio.
- Importe = `cantidad` (kg/toneladas) × `precio` (€/tonelada), salvo tarifas de precio fijo por
  viaje (ver §3).
- Los kg vienen **del documento de origen** (albarán/CMR), nunca de la ficha, la báscula ni la
  orden (precedencia D-01).

Sobre el porte se añade, según el cliente, una línea de **indexación de gasoil** (ver §4).

Total factura: suma de líneas → base imponible → IVA → total. **IVA lo determina el país del
cliente, no la geografía del viaje** (cliente español factura 21% aunque descargue en Portugal).

## 2. Concentración del negocio (histórico feb–jul 2025, 3.267 viajes)

- **FORESA**: 1.932 viajes (59%). El negocio depende de este cliente.
- CLAVO FOOD 378, BRESFOR 322, QUIMIDROGA 281. Los cuatro grandes = 89%.
- Cola larga: BALTRANSA 83, HELM 35, RNM 35, DROGAS VIGO 20, y decenas más.
- Ruta #1 absoluta: **Caldas de Reis → OREMBER** (≈1.000 viajes FORESA).

Implicación: cualquier regla que afecte a FORESA afecta a la mayoría de la facturación. Priorizar
correctitud en FORESA sobre casos raros.

## 3. Tarifas

- Tabla `Tarifas` en el Studio, recargada desde el Excel exportado del sistema (698 filas tras
  dedup). Es la fuente autoritativa. Trae **razón social completa** del cliente ("FORESA
  IND.QUIMICAS DEL NOROESTE, S.A."), no códigos cortos.
- Lookup: la **identidad del cliente se resuelve por match exacto** contra la razón social (mapa
  de alias código→razón social en `ficha/clientes.js`). Nunca por fragmento sobre el cliente — un
  fragmento puede cruzar dos razones sociales distintas y facturar mal en silencio.
- El **fallback por fragmento sí aplica a origen/destino** (geografía), con fragmentos ≥3 chars
  (los de 2 letras, p.ej. "PT", dan falsos positivos — caso AVEPTO→AZAMBUJA(PT)).
- El **precio depende de la U.M.**: TONELADAS → €/tonelada (`tarifa_tn`); UNIDADES, "Cualquiera",
  KILOMETROS, LITROS → precio fijo por viaje (`precio_fijo`). No mezclar.
- Cliente sin tarifa para su ruta → **SIN_TARIFA** (estado real de negocio, no bug).

### Nota OREMBER (corrige un diagnóstico previo)

"OREMBER" **no** es un cliente cargado como localidad. Es un **punto geográfico legítimo**
(provincia Ourense, cód. OR) en el catálogo. Existe además un cliente homónimo "OREMBER, S.A."
(cód. 65), pero en los ≈1.000 viajes el cliente es FORESA y OREMBER es el destino. Si un viaje
FORESA→OREMBER da SIN_TARIFA, es porque falta esa fila en `Tarifas`, no por un problema
estructural. Cruce hecho: **los 3.267 destinos históricos existen todos como puntos geográficos**;
no hay epidemia de clientes-como-destino.

## 4. Indexación de gasoil (suplemento)

Suplemento que ajusta el porte por la variación del precio del gasoil. Línea aparte en la factura:

- Concepto `G` = indexación gasoil **nacional**.
- Concepto `GPT` = indexación gasoil **internacional** (clientes fuera de España).

El % se negocia por **categoría de cliente y por período**. Fuente: Excel `SUPLEMENTO_GASOLEO.xlsx`
(archivo vigente, no una muestra), a cargar en la tabla `Indexacion` del Studio.

### 4.1 Categorías activas en v1

`FORESA-BRESFOR`, `HELM`, `QUIMIDROGA`, `OTROS`.

- Regla de asignación: cada cliente pertenece a su categoría nombrada; **todo cliente que no caiga
  en una nombrada usa `OTROS`** (fallback por defecto).
- Las solapas `AGENCIA` y `AUTONOMOS` del Excel existen pero **quedan fuera de v1** (probablemente
  circuito de liquidación a subcontratistas, no facturación a clientes). No cargarlas.
- **BALTRANSA es un caso aparte**: la indexación ya viene calculada en la tarifa final de su OC, y
  debe figurar en factura al **0%**. No se calcula desde esta tabla.

### 4.2 Estructura y cálculo

Cada categoría es una lista de tramos `(fecha_desde, fecha_hasta, %)`. **No es quincenal fijo**: el
% se mantiene mientras el gasoil no se mueve — hay tramos de una semana, de dos o de un mes.

Cálculo: para cada viaje, tomar su fecha → buscar el tramo de su categoría cuyo rango contiene esa
fecha → aplicar ese %. Importe de indexación = importe del porte × %.

### 4.3 Tres modos de computar la línea en factura

- **Agregado (FORESA / BRESFOR)**: **una sola línea** de indexación por período, sobre la
  **sumatoria** de todos los portes del período. En factura aparece como "INDEXACION GASOLEO 1ª/2ª
  QUINCENA" sobre el subtotal.
- **Por línea (QUIMIDROGA, RNM, resto)**: **una línea por cada viaje**, inmediatamente debajo de su
  porte.
- **Incluida (BALTRANSA)**: 0% en factura.

### 4.4 Regla de borde (única, definida por Julio)

**Cualquier hueco, tramo con % vacío, o fecha no cubierta → REVISAR**. No aplicar 0, no elegir
tramo vecino en silencio, no interpolar. Vale también para solapes en fechas de corte: si un viaje
cae en un día que pertenece a dos tramos con % distinto, es REVISAR hasta que la oficina defina
convención.

Los tramos vacíos del pasado (abril 2026 en algunas categorías) no se corrigen — quedan como
histórico; la regla aplica de acá en adelante.

## 5. Documentación por cliente (de dónde sale cada dato)

Cada cliente arma sus papeles distinto. Lo conocido (instructivo):

- **FORESA**: sub-casos Caldas-Orember (con ficha de báscula), Caldas-otros, retornos a Caldas,
  Villagarcia-Caldas (metanol).
- **BRESFOR**: Aveiro-otros.
- **QUIMIDROGA**: España y Portugal (documentación distinta).
- **RNM GROUP**: el albarán / hoja de carga **puede o no** indicar el precio total del viaje.
- **BALTRANSA**: la orden de carga suele traer el precio final; recordar la regla de indexación 0%.
- **Pendientes de mapear**: HELM, BALTRANSA (ficha), TRANSPORTES SANTOS, COMATRA, Villagarcia-otros
  (metanol). Son clientes chicos; no bloquean v1.

## 6. Set de validación histórico

`Listado_de_viajes` (3.267 viajes feb–jul 2025) trae, por viaje, las columnas `Tarifa` e `Importe`
ya facturados y cobrados. Es un **set de validación de oro** para el porte: el validador puede
recalcular y comparar contra lo que la oficina cobró.

**Limitación**: los tramos de indexación del Excel vigente arrancan en abril 2026, así que los
viajes de 2025 no se pueden re-validar por su línea de indexación (solo por el porte).

Columnas del listado que importan para facturar: `Viaje, Cliente, Origen, Destino, Carga,
Referencia, Inicio, Final, Importe, Nº, Cabeza (tractora), Remolque, Proveedor, Chofer, Cantidad,
Precio`. El resto son administrativas.

## 7. Reglas de dominio no inferibles (resumen)

- Albarán = unidad facturable; un bloque de ficha puede ser N viajes.
- `cantidad` en la ficha = kg, salvo rutas multi-viaje conocidas (FORESA Villagarcia/Caldas→Orense)
  donde = número de viajes. Red de seguridad: valor <100 en ruta no registrada → REVISAR.
- kg del **documento de origen**, nunca de ficha/báscula/orden (D-01).
- Indexación: se marca en ingesta, se resuelve en facturación (D-03).
- IVA por país del cliente, no por geografía del viaje.
- Odómetros (km) = control de flota, no facturan; no bloquean.
- Cliente / dato fuera de catálogo → REVISAR ruidoso, con el valor leído en el motivo.
