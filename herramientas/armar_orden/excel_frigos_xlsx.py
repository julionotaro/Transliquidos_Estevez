#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera un .xlsx con las filas del Excel FRIGOS (CLAVO) a partir de un orden.json.
Mismas columnas que excel_frigos.js (A..Q), pero como libro de Excel real: fechas como
fecha, km/importe como numero, listo para pegar o abrir con doble clic.

uso: python3 -I excel_frigos_xlsx.py <orden.json> <salida.xlsx>
"""
import sys, json, datetime
sys.path.insert(0, "/usr/local/lib/python3.13/site-packages")
import openpyxl
from openpyxl.styles import Font, Alignment

COLS = ["Emp", "Tractora", "Fecha carga", "Fecha descarga", "Origen", "Nº Carg",
        "Destino", "Nº Rep", "Kms. carga", "Kms. Descarga", "Kms con carga",
        "Salida /Retorno/Unidad", "Importe a facturar por Km", "Kms en vacio",
        "CLIENTE", "CARGA", "GesR"]


def num_es(s):
    if s is None or s == "":
        return None
    return float(str(s).replace(".", "").replace(",", "."))


def fecha(ddmmaaaa):
    try:
        d, m, a = str(ddmmaaaa).split("/")
        return datetime.date(int(a), int(m), int(d))
    except Exception:
        return ddmmaaaa or ""


def intz(s):
    try:
        return int(str(s))
    except Exception:
        return s or ""


def filas(orden):
    out = []
    for v in orden.get("viajes", []):
        emp = orden.get("empresa", "")
        ver = (v.get("cabecera") or {}).get("verificar") or {}
        mat = ver.get("matricula", "")
        for a in v.get("albaranes", []):
            if a.get("facturacion") != "km":
                continue
            km = a.get("km") or {}
            porte = (a.get("lineas") or {}).get("porte") or {}
            cant, prec = num_es(porte.get("cantidad")), num_es(porte.get("precio"))
            importe = round(cant * prec, 2) if (cant is not None and prec is not None) else None
            ori = a.get("origenes")
            origen = "+".join(x.upper() for x in ori) if ori else (a.get("origen") or {}).get("esperado", "").upper()
            n_carg = len(ori) if ori else 1
            des = a.get("destinos")
            destino = "+".join(x.upper() for x in des) if des else (a.get("destino") or {}).get("esperado", "").upper()
            n_rep = len(des) if des else 1
            out.append([
                emp, mat, fecha(a.get("salida")), fecha(a.get("llegada")),
                origen, n_carg, destino, n_rep,
                intz(km.get("inicio")), intz(km.get("fin")), intz(km.get("carga")),
                a.get("sentido") or "", importe, intz(km.get("vacio")),
                "CLAVO", (a.get("carga") or {}).get("esperado", ""), "",
            ])
    return out


def main():
    if len(sys.argv) < 3:
        print("uso: python3 -I excel_frigos_xlsx.py <orden.json> <salida.xlsx>", file=sys.stderr)
        sys.exit(2)
    orden = json.load(open(sys.argv[1], encoding="utf-8"))
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "FRIGOS"
    ws.append(COLS)
    for c in ws[1]:
        c.font = Font(bold=True)
        c.alignment = Alignment(horizontal="center", wrap_text=True)
    for row in filas(orden):
        ws.append(row)
    # formato: fechas dd/mm/aaaa, importe con 2 decimales
    for r in range(2, ws.max_row + 1):
        ws.cell(r, 3).number_format = "DD/MM/YYYY"
        ws.cell(r, 4).number_format = "DD/MM/YYYY"
        ws.cell(r, 13).number_format = "#,##0.00"
    widths = [6, 11, 12, 12, 26, 7, 26, 7, 11, 12, 12, 10, 12, 9, 9, 14, 6]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    wb.save(sys.argv[2])
    print("escrito", sys.argv[2], "con", ws.max_row - 1, "filas")


if __name__ == "__main__":
    main()
