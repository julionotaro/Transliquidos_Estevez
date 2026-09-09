# Verificación — fix de identidad de cliente (desbloquea PR #1)

Corrida real: módulos committeados (`ficha/clientes.js` + `ficha/tarifas.js`)
contra la tabla `Tarifas` VIVA (Siwhv2AUWTSeFlrJ, 698 filas) y los viajes VIVOS
de la tabla `Viajes` (leídos por el workflow `SCRATCH Dump Viajes+Tarifas`,
ejecución 643, 2026-08-04). No es fixture ni "se ve bien".

## Resultado por viaje

Al momento de la corrida la tabla `Viajes` tenía **11** filas (los 9 originales
+ 2 del probe nuevo). Resultado con el fix aplicado:

| # | cliente (leído) | ruta | identidad resuelta | resultado |
|---|---|---|---|---|
| 1 | FORESA | CALDAS DE REIS → TERUEL | FORESA IND.QUIMICAS DEL NOROESTE, S.A. | **RESUELVE** 56 €/t (DIRECTO) |
| 2 | TEPSA | BARCELONA → LEIRIA PORTUGAL | (sin mapear) | SIN_TARIFA · cliente_no_mapeado: TEPSA |
| 3 | RNM | AVEPTO → PORRIÑO | RNM TRANSPORTES QUIMICOS, LDA | SIN_TARIFA · geografía (AVEPTO ≠ AVEIRO) |
| 4–9 | FORESA | CALDAS → ORENSE (×6) | FORESA IND.QUIMICAS DEL NOROESTE, S.A. | SIN_TARIFA · hueco ORENSE/OREMBER |
| 10 | RNM | PORTO DE AVEIRO → JAANA DA NIZERE | RNM TRANSPORTES QUIMICOS, LDA | SIN_TARIFA · geografía (destino ilegible) |
| 11 | ASTURIANO ZINC | SAN JUAN DE NIEVA → DS SMITH PAPER VIANA | (sin mapear) | SIN_TARIFA · cliente_no_mapeado |

**Resuelven: 1/11.**

## Antes vs. después — qué arregló el fix

- **Antes de la recarga de `Tarifas`:** 1 viaje resolvía legítimamente
  (FORESA CALDAS DE REIS→TERUEL).
- **Después de la recarga, antes de este fix:** 0/11 (todos caían por
  IDENTIDAD — el código corto "FORESA"/"RNM" no igualaba la razón social del
  Excel). Regresión real.
- **Con este fix:** vuelve a resolver FORESA CALDAS DE REIS→TERUEL. La identidad
  de FORESA y RNM ahora resuelve a su razón social; el bug de matching de
  identidad queda cerrado.

Cada SIN_TARIFA restante es por **razón de negocio / lectura real**, NO por el
bug de identidad:

- **ORENSE (viajes 4–9):** FORESA no tiene fila con destino ORENSE/OURENSE; el
  tarifario usa "OREMBER" como etiqueta de cliente en el destino. Es el hueco
  destino-por-cliente vs destino-por-localidad ya documentado (deuda técnica del
  PR #1, D-01), no un bug de matching.
- **TEPSA / ASTURIANO ZINC:** clientes sin identidad mapeada → REVISAR ruidoso
  con el valor leído (comportamiento correcto: no están en el tarifario; que
  Julio los vea, no que se les asigne tarifa a ciegas).
- **AVEPTO / PORTO DE AVEIRO→JAANA DA NIZERE:** lecturas de OCR con el origen o
  destino mal leídos. La identidad resuelve; la geografía no matchea. Resolverlo
  exigiría un alias de misread (AVEPTO→AVEIRO), prohibido por la disciplina del
  proyecto (y por el propio encargo).

## Discrepancia con el encargo (reportada, no silenciada)

El encargo listaba **RNM AVEPTO→Porriño** entre los que "deben volver a resolver
tarifa". No resuelve, y no debe: "AVEPTO" es un misread de "AVEIRO" (la única
fila RNM→Porriño tiene origen AVEIRO). El "resolvía antes" era en realidad el
FALSO match AVEPTO→AZAMBUJA(PT) que el guardia de fragmentos de 2 letras del
PR #1 ya eliminó — nunca fue una resolución legítima. Hacerlo resolver
reintroduciría ese bug y contradice los tests existentes
(`tarifas: OCR "AVEPTO" ... SIN_TARIFA`). Por eso el fix resuelve el caso de
identidad real (FORESA Teruel) y deja AVEPTO en SIN_TARIFA por su razón real.

## Estado del PR #1

El bug de identidad que bloqueaba el merge está resuelto y verificado contra
datos vivos. Ningún viaje que resolvía legítimamente antes de la recarga queda
roto. Queda para revisión de Julio — no se mergea desde acá.
