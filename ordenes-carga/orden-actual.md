# ORDEN — JOSE ANTONIO VAZQUEZ HERMO — EMPRESA: TLE
# Empresa TLE -> Seleccion de Empresas: 0006 TRANS. LIQUIDOS ESTEVEZ S.L.
CABEZA 7394            # tractora 7394LZP; remolque R1832BBC; chofer JOSE ANTONIO VAZQUEZ HERMO

ALB 1 FORESA
  cliente  1                      # FORESA IND. QUIMICAS DEL NOROESTE, S.A.
  origen   1                      # Caldas de Reis
  destino  9731                   # Tordera (IP Decor)
  carga    1                      # COLA (RES 0540 = resina -> COLA)
  ref      2027538
  salida   28/09/2026
  llegada  30/09/2026
  porte    um=TN cant=23,280 precio=72,36   # importe 1.684,54, IVA 21
  index    concepto=G factor=0,1386         # cant=1.684,54; importe 233,48
  km       inicio=436.483 fin=437.690 carga=1.207 vacio_previo=–

ALB 2 HELM
  cliente  323                    # HELM IBERICA, S.A.
  origen   B                      # Barcelona (carga Miladerto)
  destino  PORT                   # Portalegre (entrega real Ribeira de Nisa; zona con tarifa)
  carga    MONOE                  # Monoetilenglicol
  ref      6100316242
  salida   30/09/2026
  llegada  02/10/2026
  porte    um=UN cant=1 precio=1.800,00     # importe 1.800,00, IVA 21 (precio fijo de la orden de flete)
  index    concepto=G factor=0,1176         # cant=1.800,00; importe 211,68
  km       inicio=437.820 fin=439.049 carga=1.229 vacio_previo=130

ALB 3 RNM
  cliente  661                    # RNM TRANSPORTES QUIMICOS, LDA
  origen   AVEIR                  # Aveiro (carga Gafanha da Nazare)
  destino  NAVIA                  # Navia (ENCE / Celulosas de Asturias)
  carga    51                     # SOSA (sosa caustica liq 50%)
  ref      0141169903
  salida   02/10/2026
  llegada  05/10/2026
  porte    um=TN cant=23,120 precio=40,30   # importe 931,74, IVA 0 (internacional, PORTES INTERNACIONALES)
  index    concepto=GPT factor=0,1450       # cant=931,74; importe 135,10
  km       inicio=439.341 fin=439.949 carga=608 vacio_previo=292

# Concepto de porte: G/GPT nacional -> concepto P; internacional -> concepto PI (IVA 0). ALB3 es PI.
# PASO FINAL por albaran: tras grabar, leer de pantalla el Nº de viaje (cabecera) y Nº de albaran (linea),
# emparejar por origen->destino, y reportarlos al cerrar el viaje completo. No escribir el repo (lo hace Claude nube).
