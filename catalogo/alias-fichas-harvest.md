# Alias cosechados de las 62 fichas reales — para cargar en `puntos.alias`

> Carga UNICA de base (el export de Gesruta fue puntual, no recurrente). El
> aprendizaje continuo de alias nuevos es por correccion del operador en Pendientes
> (`aprenderAlias`), no re-cruzando el export.

## Parte A — Variantes de LUGAR (como el chofer escribe el sitio)

| Cod.Pto | Nombre canonico | Alias (variantes de lugar) |
|---|---|---|
| `1` | CALDAS DE REIS | CALDAS|CALDAS DE REYES|CALDAS REIS |
| `2` | VILLAGARCIA | VILAGARCIA|VILLAGARCIA DE A|VILLGARCIA |
| `AVEIR` | AVEIRO | ADEIRO|DUEIRO |
| `B` | BARCELONA | BCN|PUERTO DE BARCELONA |
| `C` | CORUÑA | A CORUNA |
| `CONDE` | CONDEIXA (PT) | CONDEIXA |
| `FAMAL` | VILANOVA FAMALICAO | FAMALICAO|VILANOVA DE FAMALICAO |
| `H` | HUELVA | PALOS DE LA FRONTERA |
| `LEIRI` | LEIRIA (PT) | LEIRIA|PORTO MOS LEIRIA |
| `NAVIA` | NAVIA | ANLEO |
| `OR` | OREMBER | ORENSE|OURENSE|OURENSO|POLG SAN CIPRIAN |
| `SANTO` | SANTO TIRSO | SA TIPSO|STO TIRSO |
| `T` | TARRAGONA | EL PLA STA MARIA |
| `TE` | TERUEL | CELLA|CELLA TERUEL |
| `TERMO` | TERMOLAN, S.A. | VILA DAS AVES |
| `VENDA` | VENDAS NOVAS(PT) | VENDAS NOVAS |
| `VILAR` | VILARINHO(PT) | VILARINHO |

## Parte B — EMPRESAS como alias del punto (receptora en descarga / cargadora en origen)

> El chofer suele escribir la EMPRESA (no el sitio). La empresa es un literal mas
> que resuelve al mismo punto: va en la MISMA columna `alias`. Si una empresa
> recibe en dos puntos distintos, `aprenderAlias` lo marca como conflicto (no se
> escribe) para que Julio decida.

| Cod.Pto | Nombre canonico | Empresas (alias) |
|---|---|---|
| `1` | CALDAS DE REIS | FORESA |
| `9731` | TORDERA | IP DECOR |
| `9733` | BEGEGA | OROVALLE |
| `AVEIR` | AVEIRO | HELIFLEX |
| `AVILE` | AVILES | ASTURIANA DE ZINC|ASTURIANA DEL ZINC|ASTURIANA ZINC |
| `B` | BARCELONA | RELISA|TEPSA|TEPSA BARCELONA|TEPSA QUIMIDROGA |
| `C` | CORUÑA | HIJOS DE RIVERA |
| `CONDE` | CONDEIXA (PT) | QUIMIJUNO |
| `CURTI` | CURTIS | INLEITE |
| `ESTAR` | ESTARREJA | BONDALLI|BONDALTI |
| `FAMAL` | VILANOVA FAMALICAO | RNM |
| `H` | HUELVA | MOEVE |
| `LEIRI` | LEIRIA (PT) | CABOPOL |
| `MAIA` | MAIA | TINTAS 2000 |
| `NAVIA` | NAVIA | ENCE NAVIA|IND LACTEAS ASTURIANAS |
| `OR` | OREMBER | FINSA|REVI |
| `PADRO` | PADRON | A CORTIZO |
| `PONT` | PONTEDEUME | LECHE CELTA |
| `PORRI` | PORRIÑO | DROGAS VIGO |
| `SILLE` | SILLEDA | NUDEZA |
| `TE` | TERUEL | FINSA|OTESE |
| `TEIXE` | TEIXEIRO | BIOETANOL|VERFEX |
| `VALD` | VALDEMORO | DIVERSEY |
| `VENDA` | VENDAS NOVAS(PT) | MIPECILS LDA |
| `VIANA` | VIANA DO CASTELO | DS SMITH SPAIN |
| `VILAR` | VILARINHO(PT) | ENDUTEX |
