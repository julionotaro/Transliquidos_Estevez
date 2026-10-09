# 3 JUEGOS PARA CARGAR — Empresa TLE (0006 TRANS. LIQUIDOS ESTEVEZ S.L.)
# Conceptos: FORESA/QUIMIDROGA nacional -> P (IVA 21). RNM internacional (Portugal) -> PI (IVA 0) + idx GPT.
# PASO FINAL por albaran: tras grabar, leer Nº viaje (cabecera) y Nº albaran (linea), emparejar por origen->destino, reportar al cerrar. No escribir el repo.

# ================== JUEGO A ==================
# ORDEN — PABLO CARLES — EMPRESA: TLE
CABEZA 7963            # tractora 7963MDF; remolque PO0628R; chofer PABLO CARLES

ALB 1 FORESA
  cliente  1                      # FORESA IND. QUIMICAS DEL NOROESTE, S.A.
  origen   1                      # Caldas de Reis
  destino  HARIN                  # Enguera (Harinas Almela)
  carga    1                      # COLA (multiproducto RES 1440 + RES 2130)
  ref      2027535                # FORESA nº corto 20xxxxx
  salida   25/09/2026
  llegada  01/10/2026
  porte    um=TN cant=24,380 precio=64,04   # REVISAR tarifa: 64,04 (general, cascada Caldas->Valencia) vs 69,38 (juego anterior). REVISAR peso multiproducto. importe 1.561,30, IVA 21
  index    concepto=G factor=0,1386         # importe 216,40
  km       inicio=352.600 fin=353.695 carga=1.059 vacio_previo=–

ALB 2 QUIMIDROGA
  cliente  403                    # QUIMIDROGA, S.A. (lugar carga = Relisa)
  origen   B                      # Barcelona
  destino  PADRO                  # Padron (Piensos Nanfor)
  carga    62                     # LISINA (lisina liquida 50%)
  ref      710250                 # "Referencia en factura: 710250"
  salida   02/10/2026
  llegada  06/10/2026
  porte    um=TN cant=24,680 precio=79,71   # importe 1.967,24, IVA 21 (Barcelona->Padron zona Coruna/Pontevedra)
  index    concepto=G factor=0,145          # importe 285,25 (Oct)
  km       inicio=354.055 fin=355.362 carga=1.267 vacio_previo=360

# ================== JUEGO B ==================
# ORDEN — NUNO PAIVA — EMPRESA: TLE
CABEZA 8504            # tractora 8504KDR; remolque R4905BDF; chofer NUNO PAIVA

ALB 1 RNM
  cliente  661                    # RNM TRANSPORTES QUIMICOS, LDA
  origen   AVEIR                  # Aveiro (Gafanha da Nazare)
  destino  PO                     # Pontevedra (ENCE)
  carga    51                     # SOSA
  ref      0141169643             # RNM guia de remessa
  salida   30/09/2026
  llegada  02/10/2026
  porte    um=TN cant=24,240 precio=19,26   # importe 466,86, IVA 0 (internacional)
  index    concepto=GPT factor=0,137        # importe 63,96 (grupo Otros, sept)
  km       inicio=4.252 fin=4.548 carga=296 vacio_previo=–

ALB 2 FORESA
  cliente  1                      # FORESA IND. QUIMICAS DEL NOROESTE, S.A.
  origen   1                      # Caldas de Reis
  destino  OR                     # Orense (Finsa Orember, San Ciprian de Viñas)
  carga    1                      # COLA (ABEIRO 3009 -> resina)
  ref      2027312                # FORESA nº corto 20xxxxx
  salida   01/10/2026
  llegada  01/10/2026
  porte    TARIFA PENDIENTE                 # FORESA Caldas->Orense no esta en el tarifario general -> Julio define. Cargar albaran; porte+index pendientes. IVA 21
  index    concepto=G factor=0,1664         # pendiente hasta tener el porte
  km       inicio=4.569 fin=4.693 carga=124 vacio_previo=21

ALB 3 RNM
  cliente  661                    # RNM TRANSPORTES QUIMICOS, LDA
  origen   AVEIR                  # Aveiro
  destino  REVISAR                # Montehermoso / Caceres (Acenorca) -> sin codigo de punto, confirmar
  carga    51                     # SOSA
  ref      0941027205             # RNM guia de remessa
  salida   05/10/2026
  llegada  06/10/2026
  porte    TARIFA PENDIENTE                 # RNM Aveiro->Montehermoso/Caceres no esta en el tarifario RNM -> Julio define. Cargar albaran; porte+index pendientes. IVA 0
  index    concepto=GPT factor=0,145        # pendiente hasta tener el porte
  km       inicio=5.136 fin=5.604 carga=468 vacio_previo=443

# NOTA JUEGO B: aparecio un doc de FENOL (Moeve/Huelva -> FORESA Caldas, 07/10) con el remolque R4905BDF de Nuno,
# pero NO esta en la ficha. ¿Es un viaje a cargar (FORESA entrante)? Confirmar.

# ================== JUEGO C ==================
# ORDEN — JOSE CARLOS ALFONSIN — EMPRESA: TLE
CABEZA 4916            # tractora 4916NJG; remolque R1783BBJ; chofer JOSE CARLOS ALFONSIN

ALB 1 FORESA
  cliente  1                      # FORESA IND. QUIMICAS DEL NOROESTE, S.A.
  origen   1                      # Caldas de Reis
  destino  9731                   # Tordera (IP Decor)
  carga    1                      # COLA (RES 0011 -> resina)
  ref      2028736                # FORESA nº corto 20xxxxx
  salida   02/10/2026
  llegada  05/10/2026
  porte    um=TN cant=22,940 precio=72,36   # importe 1.659,94, IVA 21
  index    concepto=G factor=0,1664         # importe 276,21 (Oct)
  km       inicio=86.816 fin=88.016 carga=1.200 vacio_previo=–

ALB 2 QUIMIDROGA
  cliente  403                    # QUIMIDROGA, S.A.
  origen   B                      # Barcelona (TEPSA)
  destino  CORTE                  # Cortegaca (Continental, Portugal)
  carga    VINKA                  # VINKA-PLAST (multiproducto QD390 + DINP)
  ref      710701                 # "Referencia en factura: 710701"
  salida   06/10/2026
  llegada  08/10/2026
  porte    um=TN cant=22,220 precio=84,68   # importe 1.881,59, IVA 21 (zona Aveiro)
  index    concepto=G factor=0,145          # importe 272,83 (Oct)
  km       inicio=88.143 fin=89.313 carga=1.170 vacio_previo=127

ALB 3 RNM
  cliente  661                    # RNM TRANSPORTES QUIMICOS, LDA
  origen   AVEIR                  # Aveiro
  destino  PO                     # Pontevedra (ENCE)
  carga    51                     # SOSA
  ref      0141170178             # RNM guia de remessa
  salida   08/10/2026
  llegada  09/10/2026
  porte    um=TN cant=23,980 precio=19,26   # importe 461,85, IVA 0 (internacional)
  index    concepto=GPT factor=0,145        # importe 66,97 (Oct)
  km       inicio=89.381 fin=89.673 carga=292 vacio_previo=68
