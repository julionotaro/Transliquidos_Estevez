#!/usr/bin/env python3
"""Validador del pipeline TLE-carga. Falla ruidoso (exit 1) ante cualquier problema.

Corre antes de cada commit. Chequea:
  1) catalogo/*.json validos
  2) registro-procesamiento.csv: 28 columnas, sin ';' extra, pdf_doc existe, total ~ base*(1+iva)
  3) cada orden.json cumple el esquema del CONTRATO
  4) cada carpeta de orden en ordenes/ tiene su ficha

Uso:  python3 -I herramientas/validar_carga.py
"""
import csv, glob, json, os, sys, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
errs = []
def err(m): errs.append(m)

# ---- 1) JSON de catalogo ----
for f in glob.glob("catalogo/*.json"):
    try: json.load(open(f, encoding="utf-8"))
    except Exception as e: err(f"[catalogo] {f}: JSON invalido: {e}")

# ---- 2) registro ----
REG = "datos/registro-procesamiento.csv"
HDR = ("fecha_proceso;juego_ficha_pdf;empresa;nro_viaje_gesruta;nro_albaran_gesruta;"
       "fecha_carga;fecha_descarga;cod_cliente;cliente;referencia;cod_origen;cod_destino;"
       "carga;concepto;precio;um;cantidad;indexacion_factor;base_sin_iva;iva_pct;total_con_iva;"
       "odometro_inicio;odometro_final;km_carga;peso_real_kg;estado_carga;pdf_doc;observaciones")
raw = open(REG, encoding="utf-8").read().split("\n")
if raw and raw[0] != HDR: err("[registro] cabecera cambiada o reordenada")
def numes(s):  # "1.561,30" / "13.85" / "" -> float|None
    s = s.strip()
    if not s: return None
    s = s.replace(".", "").replace(",", ".") if "," in s else s
    try: return float(s)
    except: return None
for i, ln in enumerate(raw[1:], start=2):
    if not ln: continue
    f = ln.split(";")
    if len(f) != 28:
        err(f"[registro] fila {i}: {len(f)} campos (deben ser 28). Casi siempre un ';' en observaciones"); continue
    if f[26] and not os.path.exists(f[26]): err(f"[registro] fila {i}: pdf_doc no existe: {f[26]}")
    base, iva, total = numes(f[18]), numes(f[19]), numes(f[20])
    if base is not None and total is not None and iva is not None:
        esp = round(base * (1 + iva/100), 2)
        if abs(esp - total) > 0.02: err(f"[registro] fila {i} ref {f[9]}: total {total} != base*(1+iva) {esp}")

# ---- 3) ordenes ----
DATE = re.compile(r"^\d{2}/\d{2}/\d{4}$")
def chk_alb(a, ctx):
    for k in ("cliente", "origen", "destino", "carga", "referencia", "salida", "llegada", "lineas", "km", "tarifa_pendiente"):
        if k not in a: err(f"[orden] {ctx}: falta '{k}'")
    for k in ("cliente", "origen", "destino", "carga"):
        if isinstance(a.get(k), dict) and "codigo" not in a[k]: err(f"[orden] {ctx}: {k} sin 'codigo'")
    for k in ("salida", "llegada"):
        if k in a and not DATE.match(a[k]): err(f"[orden] {ctx}: {k} '{a.get(k)}' no es dd/mm/aaaa")
    L = a.get("lineas", {})
    p = L.get("porte")
    if p and not a.get("tarifa_pendiente"):
        if p.get("concepto_esperado") not in ("P", "PI"): err(f"[orden] {ctx}: concepto_esperado invalido {p.get('concepto_esperado')}")
    ix = L.get("indexacion")
    if ix and ix.get("concepto") not in ("G", "GPT"): err(f"[orden] {ctx}: idx concepto invalido {ix.get('concepto')}")

for f in glob.glob("ordenes-carga/ordenes/**/orden.json", recursive=True):
    try: o = json.load(open(f, encoding="utf-8"))
    except Exception as e: err(f"[orden] {f}: JSON invalido: {e}"); continue
    if o.get("empresa") not in ("TLE", "THEC", "PROVE"): err(f"[orden] {f}: empresa invalida {o.get('empresa')}")
    for vi, v in enumerate(o.get("viajes", [])):
        cab = v.get("cabecera", {})
        if "cabeza" not in cab: err(f"[orden] {f} viaje {vi}: cabecera sin 'cabeza'")
        if cab.get("tipo") not in ("propio", "autonomo", None): err(f"[orden] {f} viaje {vi}: tipo invalido")
        for ai, a in enumerate(v.get("albaranes", [])):
            chk_alb(a, f"{os.path.basename(os.path.dirname(f))} v{vi}a{ai}")

# ---- 4) cada carpeta de orden tiene ficha ----
for d in glob.glob("ordenes-carga/ordenes/*/*/*/"):
    files = os.listdir(d)
    if not any(x.startswith("ficha") for x in files):
        err(f"[ficha] {d}: carpeta sin ficha")

# ---- salida ----
if errs:
    print(f"VALIDACION FALLIDA — {len(errs)} problema(s):")
    for e in errs: print("  -", e)
    sys.exit(1)
print("VALIDACION OK — catalogo, registro, ordenes y fichas consistentes.")
