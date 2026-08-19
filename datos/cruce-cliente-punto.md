# Cruce cliente ↔ punto — histórico Gesruta

Fuente: `Listado_de_viajes.csv` (3.267 viajes, 01/02/25–31/07/25), leído en **cp850**.
Generado por el chat de diseño. Es un informe, no código de producción.

## Cifras

- **214 puntos distintos** (origen ∪ destino); 72 orígenes, 176 destinos
- **44 clientes reales** (de los 672 del catálogo de Gesruta)
- Top 20 puntos = **85,6%** del volumen · Top 40 = **91,7%**
- **0 colisiones** al normalizar los 214: el subconjunto realmente usado está limpio
- 22 de 44 clientes tienen **un solo origen** en todo el histórico

> **Ojo con el alcance:** son 6 meses de 2025, no 2 años. Rutas estacionales o clientes
> nuevos pueden faltar. No tratar la ausencia de un punto como prueba de que no existe.

## Orígenes por cliente

| Cliente | Viajes | Orígenes | Dominante | % |
|---|---|---|---|---|
| FORESA IND.QUIMICAS DEL NOROESTE, S.A. | 1932 | 10 | CALDAS DE REIS | 73% |
| CLAVO FOOD FACTORY, S.A. | 378 | 17 | TORDESILLAS | 54% |
| BRESFOR IND. DO FORMOL, S.A. | 322 | 2 | AVEIRO | 99% |
| QUIMIDROGA, S.A. | 281 | 7 | BARCELONA | 76% |
| BALTRANSA, S.A. | 83 | 9 | VALDEMORO | 57% |
| HELM IBERICA, S.A. | 35 | 3 | TARRAGONA | 83% |
| RNM TRANSPORTES QUIMICOS, LDA | 35 | 9 | ESTARREJA | 34% |
| DROGAS VIGO, S.L. | 20 | 8 | AVEIRO | 30% |
| TRANSTAMBRE, S.L. | 20 | 11 | SETUBAL | 35% |
| TRANSPORTES SANTOS, S.A. | 20 | 8 | TARRAGONA | 35% |
| TRANSPORTES A MARTIN, S.L.U. | 14 | 3 | TARRAGONA | 79% |
| COMATRA, S.C.L. | 12 | 6 | TARRAGONA | 42% |
| ROTANK IBERICA, S.L. | 10 | 1 | RUBI | 100% |

**BRESFOR carga en AVEIRO en 320 de 322 viajes.** Gesruta usa `AVEIRO` como punto, así que
aunque el CMR diga *Gafanha da Nazaré*, la traducción para tarifa y para Gesruta es directa.
No hace falta modelar la geografía real portuguesa.

## Top 25 puntos

| Punto | Usos | Nº clientes | Cliente principal |
|---|---|---|---|
| CALDAS DE REIS | 2010 | 7 | FORESA |
| OREMBER | 1008 | 2 | FORESA |
| VILLAGARCIA | 434 | 4 | FORESA |
| UTISA TERUEL | 358 | 3 | FORESA / BRESFOR |
| AVEIRO | 353 | 6 | BRESFOR |
| BARCELONA | 262 | 8 | QUIMIDROGA |
| TORDESILLAS | 206 | 2 | CLAVO FOOD |
| TARRAGONA | 132 | 12 | FORESA |
| IP DECOR SPAIN, SAU | 91 | 1 | FORESA |
| MIRANDA DE EBRO | 60 | 3 | QUIMIDROGA |
| ORENSE | 56 | 3 | QUIMIDROGA |
| TERMOLAN, S.A. | 49 | 1 | FORESA |
| VALDEMORO | 48 | 2 | BALTRANSA |
| LEIRIA (PT) | 44 | 3 | QUIMIDROGA |
| CURIA SPAIN, SAU | 40 | 1 | FORESA |
| URSA IBERICA, S.A. | 40 | 1 | FORESA |
| BRAGA (PT) | 38 | 2 | QUIMIDROGA |
| HUELVA | 33 | 4 | FORESA |
| NEFAB PONTEV. SL | 27 | 1 | FORESA |
| VIGO | 26 | 8 | FORESA |
| SANTAREM | 22 | 3 | QUIMIDROGA |
| COGERSA | 20 | 1 | FORESA |
| REINOSA | 19 | 1 | CLAVO FOOD |
| CURTIS | 18 | 1 | BALTRANSA |
| SEVILLA | 17 | 4 | BRESFOR |

## Empresas usadas como punto (36)

Destinos cargados con el nombre de la empresa, no de la localidad. **Casi todos son de FORESA.**
La columna de localidad va vacía a propósito: la completa Julio.

| Punto (empresa) | Usos | Cliente | Localidad real |
|---|---|---|---|
| IP DECOR SPAIN, SAU | 91 | FORESA | |
| TERMOLAN, S.A. | 49 | FORESA | |
| CURIA SPAIN, SAU | 40 | FORESA | |
| URSA IBERICA, S.A. | 40 | FORESA | |
| NEFAB PONTEV. SL | 27 | FORESA | |
| KRONOSPAN, S.L. | 14 | BRESFOR | |
| DROGAS VIGO, S.L. | 13 | FORESA | |
| TABLESTUY, S.L. | 9 | FORESA | |
| ALCOVER QUIMINA, S.L. | 9 | FORESA | |
| SERVYECO IBERIA, SL | 8 | FORESA | |
| CLARIANT, S.A. | 6 | FORESA | |
| ZNDS TABLEROS, S.L. | 5 | FORESA | |
| COMERCIAL GODO, S.L. | 4 | FORESA | |
| DROGAS CONDE, S.A. | 4 | FORESA | |
| IND.QUIM.CUADRADO, SA | 4 | FORESA | |
| MADERAS DE LLODIO, SA | 3 | FORESA | |
| CATENVA, S.L. | 3 | FORESA | |
| ADHESIVOS GIMPEX, S.L | 3 | FORESA | |
| ARCHELA CONTRACHAPADOS, SL | 3 | FORESA | |

*(las 19 más frecuentes de 36; el resto tienen 1-2 usos)*

Nota: `COGERSA` (20), `REINOSA` (19) y `TORTOSA` (7) no llevan forma societaria pero también
son empresa o localidad ambigua — revisar junto con las anteriores.

## Entradas mal cargadas que sí se usan

- `FRANCIA` (5 usos, Clavo Food Factory) — es un país, no un punto. **Error de carga.**
- **No aparecen rutas disfrazadas de punto** entre los 214 usados.
  `VOLCALIS-ISOLAM.MINERAIS,SA` lleva guion pero es nombre de empresa, no una ruta.

Los duplicados de código del catálogo (ALBACETE = `AB` y `ALBAC`, ALICANTE = `A` y `ALICA`)
**no afectan**: ningún par aparece con las dos formas en viajes reales. La decisión "usar el
más frecuente" queda registrada pero no hay que aplicarla a nada por ahora.

## Qué falta

- `puntos-geograficos.csv` completo: sin él no se puede asignar `Cód.Pto.` a los 214.
  El resumen en repo solo trae 150 de 807 filas.
- Lo que escriben los chóferes en las fichas: nunca se digitalizó. Se aprende con el uso.
