# Reglas por cliente — v1
Matriz canonica de tratamiento por cliente. Supera a los criterios genericos del contrato v1
en todo lo que aqui se especifique. Fuente: instrucciones operativas de Julio + documentacion real.

## Regla general que cambia el modelo

El **porte y el IVA NO dependen de la geografia de la ruta**: dependen de **la entidad a la que se factura**.
Dos casos reales que lo demuestran:
- RNM Vigo -> Navia: ambos puntos en Espana, pero RNM es empresa portuguesa -> **porte internacional, sin IVA**.
- Quimidroga Barcelona -> Leiria (Portugal): se factura a Quimidroga Espana -> **porte nacional, con IVA**.

## Matriz

| Cliente | Porte / IVA | Fuente del peso | Referencia a usar | Indexacion | Precio |
|---|---|---|---|---|---|
| **FORESA** (todas las variantes) | Nacional, con IVA | **Albaran, siempre** | referencia **corta** que empieza por `20`, arriba a la derecha (ej. 2009926, 2011874). NO el numero largo 50302xxxxx | ver variantes | tarifario Foresa: primero tabla de clientes especiales, si no hay, por provincia |
| **QUIMIDROGA** | **Depende del prefijo de la Referencia en factura**: `70xxxx` -> Quimidroga Espana, nacional con IVA. `100xxxx` -> Quimidroga Portugal, internacional sin IVA | CMR (peso neto) | Referencia en factura (`704061`, `704449`) | por viaje, solapa QUIMIDROGA | tarifario Quimidroga por origen/destino |
| **RNM** | **Internacional, sin IVA siempre** (empresa portuguesa), aunque origen y destino sean espanoles | CMR | `Albaran No` del albaran RNM (ej. 0941026143) | por viaje, solapa **OTROS** | tarifario RNM x peso del CMR |
| **HELM** | Nacional, con IVA | CMR / bascula | numero de pago indicado en la OC (`6100295057`) | por viaje, solapa HELM | la OC trae **Coste de transporte** explicito; ver conflicto abajo |
| **BALTRANSA** | pendiente de confirmar | pendiente | pendiente | **incluida en el precio**, no se agrega linea | pendiente |

## Variantes de FORESA

| Variante | Referencia | Material | Indexacion | Nota |
|---|---|---|---|---|
| A Orember | corta `20xxxxx` | RES = Cola; otros = FINCAT | **quincenal agregada** | verificar matriculas tractora y remolque |
| Villagarcia -> Caldas (resina/cola) | **no se usa referencia** | Metanol | **mensual agregada** sobre precio base | |
| Villagarcia -> Caldas (metanol) | no hay; se usa **fecha de carga de la ficha del chofer** | Metanol | **mensual agregada** sobre precio base | el proveedor del servicio es **HEC** |
| A otros destinos | corta `20xxxxx` | RES = Cola; otros = FINCAT | por linea | |
| Villagarcia -> otros destinos | **Numero de Orden de Carga del mail** (ej. 2610748) | segun OC | por linea | viene con mail (OC) + albaran |

## Reglas transversales

1. **Fecha de carga**: si la ficha del chofer y el documento discrepan, **prevalece la ficha del chofer**.
2. **Peso**: FORESA siempre albaran. Todos los demas: CMR o documento de bascula.
3. **Minimo facturable**: si el peso real es menor a 23 t, se factura **23 t**.
4. **Cargas de HEC**: **no se calculan km de unidad tractora**.
5. **Matriculas**: verificar tractora y remolque contra el albaran en todos los casos.

## Conflicto abierto — HELM

Las instrucciones dicen dos cosas incompatibles para el precio de HELM:
- "Cantidad x tarifa de tarifario segun origen/destino"
- "importe del viaje al que se le debe agregar la indexacion" (la OC trae `Coste de transporte: 1.960,00 EUR`)

Hasta que Julio lo resuelva, el sistema muestra **ambos** valores y marca `revision_humana`.
