# Decisiones de dominio — Transliquidos Estevez
Registro de criterios confirmados por Julio. El validador no puede inferirlos: se codifican aquí.

## D-01 — Cantidad a facturar
Se factura **siempre la cantidad real del documento de origen** (albarán / CMR / guía).
- No se usa la báscula de destino. Caso real: albarán Foresa 23.140 kg vs báscula Finsa 23.100 kg → vale 23.140.
- No se usa la cantidad de la orden de transporte: es **estimación**. Caso real: orden Quimidroga 24.000 kg vs CMR 23.820 kg → vale 23.820.
- La cantidad de la hoja del chofer es solo control cruzado.

Validación: si hoja y documento de origen difieren, alertar pero usar el documento.

## D-02 — Modelo de precio cuando la tarifa ofrece €/viaje y €/t
Manda **€/tonelada × cantidad real**. El €/viaje del tarifario es informativo.
Caso real RNM Aveiro→Porriño: 23.880 kg × tarifa €/t (no los 437 €/viaje).

## D-03 — Indexación (suplemento gasóleo): tres regímenes
La indexación **no siempre es una línea por viaje**. Determina el régimen el cliente y el servicio:

| Régimen | Aplica a | Cómo se genera |
|---|---|---|
| **Por línea** | caso general (Quimidroga, RNM, resto) | línea de indexación junto a cada viaje |
| **Agregada quincenal** | Foresa **Caldas de Reis → Ourense** | un único campo por el **total** de la quincena |
| **Agregada mensual** | Foresa **Villagarcía → Caldas de Reis** (metanol) | un único campo por el **total** del mes |
| **Incluida en precio** | **Baltransa** | NO se agrega indexación: la tarifa ya la contiene |

Consecuencia técnica: el cálculo de indexación **no se cierra en la ingesta del viaje**.
Se marca el régimen en cada viaje y se resuelve en el cierre de facturación (F4).
Campo nuevo en el viaje: `regimen_indexacion` = `linea | agregada_quincenal | agregada_mensual | incluida`.

## D-04 — Grupo de indexación por defecto
El grupo sale de la solapa correspondiente del suplemento gasóleo.
Si el cliente **no tiene solapa propia**, se aplica el grupo **OTROS**.
El cliente es el **contratante**, no el destinatario: RNM es el cliente aunque descargue en Drogas Vigo.

## D-05 — Pendiente de verificación
- Tarifa Quimidroga **Barcelona → Leiria (PT)**: no figura en el tarifario 2026. Existen Barcelona→otros destinos PT a 84,68 €/t y Leiria solo desde Caparroso/Logroño. Julio verifica si aplica 84,68 o hay acuerdo aparte. Hasta entonces: `revision_humana`.
