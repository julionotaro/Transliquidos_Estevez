# ORDEN — MIGUEL PIRES (Ilidio Miguel Pires) — EMPRESA: TLE
# Empresa TLE -> Seleccion de Empresas: 0006 TRANS. LIQUIDOS ESTEVEZ S.L.
# Viaje grande: 5 albaranes (2 paginas de ficha). Chofer = Ilidio Miguel Pires (la ficha abrevia "Miguel Pires").
CABEZA 0557            # tractora 0557JMS; remolque R0110BBG; chofer MIGUEL PIRES (Ilidio Miguel Pires)

ALB 1 RNM / Drogas Vigo   # REVISAR cliente: ficha dice RNM, pero la documentacion es DROGAS VIGO (DROVI)
  cliente  REVISAR                # RNM (661) o DROGAS VIGO -> confirmar quien factura
  origen   AVEIR                  # Aveiro (carga Gafanha da Nazare)
  destino  PADRO                  # Padron (Exlabesa). Sin tarifa propia -> zona Coruña
  carga    51                     # SOSA (sosa caustica liq 50%)
  ref      1741007450             # albaran/guia DROVI 1741007450 (si fuese RNM, buscar guia RNM)
  salida   18/09/2026
  llegada  21/09/2026
  porte    um=TN cant=22,880 precio=29,09   # RNM Aveiro->Coruña (zona Padron) -> importe 665,58; IVA 0. REVISAR si cliente no es RNM
  index    concepto=GPT factor=0,137        # grupo Otros sept; importe 91,18
  km       inicio=1.136.040 fin=1.136.358 carga=318 vacio_previo=–

ALB 2 FORESA
  cliente  1                      # FORESA IND. QUIMICAS DEL NOROESTE, S.A.
  origen   1                      # Caldas de Reis
  destino  T                      # Tarragona (URSA, El Pla de Santa Maria)
  carga    1                      # COLA (RES 3181 = resina -> COLA)
  ref      2025740                # FORESA: nº corto que empieza en 20 (NO el 5030xxxxxx)
  salida   22/09/2026
  llegada  23/09/2026
  porte    um=TN cant=22,320 precio=72,36   # importe 1.615,08, IVA 21
  index    concepto=G factor=0,1386         # importe 223,85
  km       inicio=1.136.408 fin=1.137.463 carga=1.055 vacio_previo=50

ALB 3 QUIMIDROGA
  cliente  403                    # QUIMIDROGA, S.A.
  origen   B                      # Barcelona (carga TEPSA)
  destino  MEMMA                  # Mem Martins (Adreta Plasticos, Portugal)
  carga    VINKA                  # VINKA-PLAST QD 390
  ref      709434                 # "Referencia en factura: 709434"
  salida   25/09/2026
  llegada  28/09/2026
  porte    um=TN cant=24,100 precio=88,25   # importe 2.126,83, IVA 21 (Quimidroga factura Portugal como nacional)
  index    concepto=G factor=0,137          # importe 291,38
  km       inicio=1.137.610 fin=1.138.998 carga=1.388 vacio_previo=147

ALB 4 RNM
  cliente  661                    # RNM TRANSPORTES QUIMICOS, LDA
  origen   AVEIR                  # Aveiro (carga Gafanha da Nazare)
  destino  TORO                   # Toro / Zamora (Quesos del Duero)
  carga    51                     # SOSA
  ref      0941027097             # RNM guia de remessa (10 dig empieza en 0)
  salida   28/09/2026
  llegada  29/09/2026
  porte    um=TN cant=22,800 precio=REVISAR # RNM Aveiro->Toro/Zamora NO esta en el tarifario RNM -> Julio define EUR/TN; IVA 0
  index    concepto=GPT factor=0,137        # grupo Otros sept (sobre el porte, cuando este el precio)
  km       inicio=1.139.336 fin=1.139.755 carga=419 vacio_previo=338

ALB 5 RNM
  cliente  661                    # RNM TRANSPORTES QUIMICOS, LDA (carga Ferquiastur/Asturiana de Zinc, para RNM)
  origen   AVILE                  # Aviles (Ferquiastur)
  destino  SINES                  # Sines (Enerfuel, Monte Feio, Portugal)
  carga    20                     # ACIDO SULFURICO (98)
  ref      0141169539             # RNM guia req (10 dig empieza en 0)
  salida   30/09/2026
  llegada  01/10/2026
  porte    um=TN cant=22,080 precio=REVISAR # RNM Aviles->Sines NO esta en el tarifario RNM -> Julio define EUR/TN; IVA 0
  index    concepto=GPT factor=0,137        # grupo Otros sept (sobre el porte, cuando este el precio)
  km       inicio=1.140.102 fin=1.141.067 carga=965 vacio_previo=347

# Conceptos: FORESA y QUIMIDROGA nacional -> P (IVA 21). RNM internacional (Portugal) -> PI (IVA 0) + indexacion GPT.
# PASO FINAL por albaran: tras grabar, leer de pantalla Nº de viaje (cabecera) y Nº de albaran (linea),
# emparejar por origen->destino, reportarlos al cerrar el viaje completo. No escribir el repo (lo hace Claude nube).
