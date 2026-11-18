#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera las filas del Excel de control del SHUTTLE METANOL (FORESA Villagarcia->Caldas)
para copiar/pegar en el Excel de Julio, replicando su ESTRUCTURA real (confirmada por
imagen 18/11): una HOJA por TRACTORA; cabecera [tractora, empresa, chofer]; una FILA por
DIA con la FECHA en la col A, las cantidades (kg) de cada viaxe del dia en las columnas
siguientes (B, C, ...), el TOTAL del dia (kg) en la col I, y al final TOTAL TONELADAS MES
(suma de kg / 1000). Julio pega las filas de los dias en la pestana de la tractora del mes.

Lee el raw del juego: toma los albaranes del shuttle (los que traen "shuttle_cantidades",
= FORESA Villagarcia->Caldas metanol sumado por dia).

uso: python3 -I excel_metanol.py <raw.json> [<salida.xlsx>]
  - sin xlsx: imprime un TSV plano (una fila por dia) para inspeccion rapida.
  - con xlsx: escribe el libro con una hoja por tractora en el layout de Julio.
"""
import sys, json

TOTAL_COL = 9  # columna I = TOTAL del dia (como en el Excel de Julio)


def filas_de_raw(raw):
    """Una entrada por albaran-dia de shuttle, en orden de aparicion."""
    out = []
    emp = raw.get("empresa", "")
    chofer = raw.get("chofer", "")
    for v in raw.get("viajes", []):
        mat = v.get("matricula", "")
        for a in v.get("albaranes", []):
            cants = a.get("shuttle_cantidades")
            if not cants:
                continue
            total = sum(cants)
            out.append({"tractora": mat, "chofer": chofer, "empresa": emp,
                        "fecha": a.get("salida", ""), "cants": list(cants),
                        "total_kg": total, "total_tn": round(total / 1000.0, 3)})
    return out


def por_tractora(filas):
    """Agrupa las filas por tractora conservando el orden de aparicion."""
    orden, grupos = [], {}
    for f in filas:
        t = f["tractora"]
        if t not in grupos:
            grupos[t] = []
            orden.append(t)
        grupos[t].append(f)
    return [(t, grupos[t]) for t in orden]


def main():
    if len(sys.argv) < 2:
        print("uso: python3 -I excel_metanol.py <raw.json> [<salida.xlsx>]", file=sys.stderr)
        sys.exit(2)
    raw = json.load(open(sys.argv[1], encoding="utf-8"))
    filas = filas_de_raw(raw)
    if not filas:
        print("(sin shuttle metanol en este raw)")
        return

    # TSV plano a stdout (inspeccion rapida: una fila por dia)
    maxc = max(len(f["cants"]) for f in filas)
    cols = ["Tractora", "Empresa", "Chofer", "Fecha"] + [f"V{i+1}" for i in range(maxc)] + ["TOTAL kg", "TOTAL TN"]
    print("\t".join(cols))
    for f in filas:
        row = [f["tractora"], f["empresa"], f["chofer"], f["fecha"]] + \
              [str(x) for x in f["cants"]] + [""] * (maxc - len(f["cants"])) + \
              [str(f["total_kg"]), str(f["total_tn"]).replace(".", ",")]
        print("\t".join(row))

    if len(sys.argv) < 3:
        return

    # .xlsx con el layout de Julio: una hoja por tractora
    sys.path.insert(0, "/usr/local/lib/python3.13/site-packages")
    import openpyxl
    from openpyxl.styles import Font
    wb = openpyxl.Workbook()
    primera = True
    for tractora, grupo in por_tractora(filas):
        ws = wb.active if primera else wb.create_sheet()
        primera = False
        ws.title = (tractora or "METANOL")[:31]
        chofer = grupo[0]["chofer"]
        emp = grupo[0]["empresa"]
        # cabecera (fila 1): tractora | empresa | chofer
        ws.cell(row=1, column=1, value=tractora).font = Font(bold=True)
        ws.cell(row=1, column=2, value=emp)
        ws.cell(row=1, column=3, value=chofer)
        # encabezado de la columna total (fila 3)
        ws.cell(row=3, column=1, value="Fecha").font = Font(bold=True)
        ws.cell(row=3, column=TOTAL_COL, value="TOTAL kg").font = Font(bold=True)
        # una fila por dia: fecha (col A) | cantidades (col B..) | TOTAL kg (col I)
        r = 4
        mes_kg = 0
        for f in grupo:
            ws.cell(row=r, column=1, value=f["fecha"])
            for j, c in enumerate(f["cants"]):
                ws.cell(row=r, column=2 + j, value=c)
            tcol = max(TOTAL_COL, 2 + len(f["cants"]))
            ws.cell(row=r, column=tcol, value=f["total_kg"])
            mes_kg += f["total_kg"]
            r += 1
        # total del mes (en TONELADAS, como en el Excel de Julio)
        ws.cell(row=r + 1, column=1, value="TOTAL TONELADAS MES").font = Font(bold=True)
        ws.cell(row=r + 1, column=TOTAL_COL, value=round(mes_kg / 1000.0, 3)).font = Font(bold=True)
    wb.save(sys.argv[2])
    print("escrito", sys.argv[2], file=sys.stderr)


if __name__ == "__main__":
    main()
