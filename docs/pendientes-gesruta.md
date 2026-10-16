# Pendientes de actualizar en Gesruta (backlog)

> Lo que conviene **dar de alta / cargar en Gesruta** para que autocomplete y el bot no
> tenga que teclear ni pisar valores. Cuanto mas correcto este Gesruta, menos errores al
> escalar. Generado desde el catalogo (Fase 0). Marcar [x] cuando quede cargado en GR.

## A. Puntos a dar de alta (hoy quedan en REVISAR)

- [ ] **NOGALES (BADAJOZ)** (cliente RNM) — NOGALES no existe en la tabla de puntos de Gesruta. No es un alias que falte: es un PUNTO que hay que dar de alta en Gesruta (igual que PADRON para FO
- [ ] **BARCELONA** (cliente RNM) — Tepsa es una TERMINAL portuaria de graneles en varias ciudades (Barcelona, Bilbao, Tarragona, Valencia). NO se puede mapear 'TEPSA' -> un punto fijo: 
- [ ] **MONTEHERMOSO (CACERES)** (cliente RNM) — MONTEHERMOSO no existe en la tabla de puntos de Gesruta, igual que NOGALES. Ademas no hay tarifa RNM Aveiro->Caceres/Montehermoso ni ruta cercana en e

## B. Tarifas confirmadas que NO estan como ruta directa en Gesruta

Viven en `tarifa-por-analogia.json` (cobran como otra ruta/zona). Conviene cargar la ruta
real en Gesruta con su precio para que autocomplete.

- [ ] **FORESA IND.QUIMICAS **: VILLAGARCIA -> CURIA SPAIN, SAU = 38.66 (hoy se cobra como VALLADOLID)
- [ ] **FORESA IND.QUIMICAS **: VILLAGARCIA -> COGERSA = 33.1 (hoy se cobra como ASTURIAS)
- [ ] **FORESA IND.QUIMICAS **: CALDAS DE REIS -> SERVYECO IBERIA,SL = 64.91 (hoy se cobra como CASTELLON)
- [ ] **FORESA IND.QUIMICAS **: CALDAS DE REIS -> GERMAN RDGUEZ.IND.SA = 48.17 (hoy se cobra como GUADALAJARA)
- [ ] **FORESA IND.QUIMICAS **: VILLAGARCIA -> PORRIÑO = 12.64 (hoy se cobra como DROGAS VIGO, S.L.)
- [ ] **QUIMIDROGA, S.A.**: BARCELONA -> BEGONTE = 74.73 (hoy se cobra como LUGO)
- [ ] **FORESA IND.QUIMICAS **: CALDAS DE REIS -> CORUÑA = 18.61 (hoy se cobra como DROGAS CONDE, S.A.)
- [ ] **FORESA IND.QUIMICAS **: VILLAGARCIA -> GIJON = 33.1 (hoy se cobra como ASTURIAS)
- [ ] **FORESA IND.QUIMICAS **: CALDAS DE REIS -> LANGREO = 33.1 (hoy se cobra como ASTURIAS)
- [ ] **FORESA IND.QUIMICAS **: VILLAGARCIA -> GIJON = 33.1 (hoy se cobra como ASTURIAS)
- [ ] **QUIMIDROGA, S.A.**: TARRAGONA -> AVEIRO = 80.8 (hoy se cobra como COIMBRA)
- [ ] **QUIMICAS DEL JARAMA,**: MADRID -> PORTUGAL = 46.35 (hoy se cobra como LANDIN (PT))
- [ ] **FORESA IND.QUIMICAS **: CALDAS DE REIS -> ENGUERA = 64.04 (hoy se cobra como VALENCIA)

## C. Tarifas de cliente (Excel) mas actualizadas que el general

- [ ] **RNM**: usar `tarifario-RNM-2026` (EUR/TN por ruta). El general tiene flat viejo (ej. 900) — actualizar.
- [ ] **QUIMIDROGA**: usar `tarifario-QUIMIDROGA-2026` (238 rutas con vigencia). Revisar diffs con el general.
- [ ] **FORESA Caldas->Teruel** y **BRESFOR Aveiro->Teruel**: 56,00 EUR/TN bajo punto TERUEL (TE). Verificar vigencia en GR.
- [ ] **FORESA Caldas->Orember**: 13,85 EUR/TN (COLA). Verificar que GR autocomplete.

## D. Rutas que quedaron TARIFA_PENDIENTE (faltan definir)

- [ ] **RNM Aveiro->Montehermoso/Caceres** (Acenorca): sin tarifa; Julio pide por mail.
- [ ] **RNM Aveiro->Toro/Zamora** y **Aviles->Sines**: sin tarifa (ver registro).

---
_Fuentes: `catalogo/alias-empresa-punto.json`, `catalogo/tarifa-por-analogia.json`, `datos/gesruta/tarifarios/`, `datos/registro-procesamiento.csv`._
