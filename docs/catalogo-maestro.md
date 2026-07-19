# Catálogo maestro — v0
Base de referencia para validación (F3). Las tarifas e indexaciones reales NO van en Git:
viven en las data tables `tarifas` e `indexacion` de n8n.

## Empresas
| Código | Nombre | Rol |
|---|---|---|
| TLE | Transliquidos Estevez | Principal. Carga viajes en Gesruta. Contrata a HEC y proveedores. |
| HEC | Hermanos Estevez Casal | Flota menor. Factura sus servicios a TLE. |

## Flota
| Empresa | Recursos |
|---|---|
| TLE | 30 tractoras con cisterna + 2 equipos frigo |
| HEC | 3 cisternas + 2 frigo |
| Autónomos | 3 choferes con cisterna propia (sin viáticos, solo km) |
| Proveedores | Comatra y otros (cabecera Gesruta: PROVE) |

## Clientes y rutas frecuentes
| Cliente | Rutas habituales | Material | Notas |
|---|---|---|---|
| Foresa | Caldas de Reis → Orember (Ourense) | Resina | |
| Foresa | Villagarcía → Caldas de Reis | Metanol | **Facturación MENSUAL** (excepción a la quincenal) |
| Foresa | Caldas de Reis → otros / Retornos → Caldas | Varios | Retornos = ingreso de mercadería |
| Bredfor | Aveiro (PT) → Ourense / otros | — | Porte internacional (PI, indexación GPT) |
| Helm | — | — | Completar |
| Baltransa | Orígenes/destinos variables | — | Completar |
| Quimidroga | — | — | Completar |

## Estructura de archivo físico/digital
```
{año}/{mes}/{cliente}/{nº factura}/
  factura.pdf
  factura.xlsx
  documentos-escaneados.pdf
```
Clasificación documental: por cliente → destino.
1. Foresa: Caldas-Orember | Caldas-otros | Retornos
2. Bredfor: Aveiro-Orense | Aveiro-otros
3. Helm · 4. Baltransa · 5. Quimidroga · 6. Menores

## Ciclo de facturación
- Quincenal: todos los clientes salvo excepción.
- Mensual: Foresa metanol (Villagarcía→Caldas).
- Flujo: pro-forma → chequeo (referencia, placa, ruta, material, cantidad, indexación) → factura → archivo → envío de 3 archivos al cliente.
