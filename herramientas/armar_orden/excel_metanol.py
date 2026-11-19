#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera las filas del Excel de control del SHUTTLE METANOL (FORESA Villagarcia->Caldas)
para copiar/pegar, como en el Excel de Julio (una hoja por tractora, fila por dia, columnas
con la cantidad de cada albaran del dia + TOTAL del dia).

Lee el raw del juego: toma los albaranes del shuttle (los que traen "shuttle_cantidades",
= FORESA Villagarcia->Caldas metanol sumado por dia). Por cada dia emite una fila:

  Emp  Tractora  Chofer  Fecha  <cant1> <cant2> ... <cantN>  TOTAL(kg)  TOTAL(TN)

Julio pega esa fila en la hoja de la tractora del mes (RESUMEN NOVIEMBRE / 3729 / 8382JJS...).
Cada albaran y el TOTAL van en TN con formato xx,xxx (3 decimales), como en el Excel de Julio
(18/11 total; 19/11 todos los valores, no solo el total). Se mantiene TOTAL kg (entero) de control.

uso: python3 -I excel_metanol.py <raw.json> [<salida.xlsx>]
"""
import sys, json, os

def filas_de_raw(raw):
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
                        "fecha": a.get("salida", ""), "cants": cants,
                        "total_kg": total, "total_tn": round(total / 1000.0, 3)})
    return out


def tn3(x):
    """Toneladas con 3 decimales y coma decimal (xx,xxx), como el Excel de Julio."""
    return f"{x:.3f}".replace(".", ",")


def main():
    if len(sys.argv) < 2:
        print("uso: python3 -I excel_metanol.py <raw.json> [<salida.xlsx>]", file=sys.stderr)
        sys.exit(2)
    raw = json.load(open(sys.argv[1], encoding="utf-8"))
    filas = filas_de_raw(raw)
    if not filas:
        print("(sin shuttle metanol en este raw)")
        return
    maxc = max(len(f["cants"]) for f in filas)
    # Cada albaran en TN con 3 decimales (Julio 19/11: "todos los valores de tn, no solo los totales").
    cols = ["Emp", "Tractora", "Chofer", "Fecha"] + [f"Alb{i+1} (TN)" for i in range(maxc)] + ["TOTAL kg", "TOTAL TN"]
    # TSV a stdout (todas las cantidades en TN, 3 decimales)
    print("\t".join(cols))
    for f in filas:
        row = [f["empresa"], f["tractora"], f["chofer"], f["fecha"]] + \
              [tn3(x / 1000.0) for x in f["cants"]] + [""] * (maxc - len(f["cants"])) + \
              [str(f["total_kg"]), tn3(f["total_tn"])]
        print("\t".join(row))
    # .xlsx opcional
    if len(sys.argv) >= 3:
        sys.path.insert(0, "/usr/local/lib/python3.13/site-packages")
        import openpyxl
        from openpyxl.styles import Font
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = "METANOL"
        ws.append(cols)
        for c in ws[1]:
            c.font = Font(bold=True)
        tn_col = len(cols)  # ultima columna = TOTAL TN
        for f in filas:
            ws.append([f["empresa"], f["tractora"], f["chofer"], f["fecha"]] +
                      [round(x / 1000.0, 3) for x in f["cants"]] + [None] * (maxc - len(f["cants"])) +
                      [f["total_kg"], f["total_tn"]])
            # formato TN = xx,xxx (3 decimales) en cada albaran (cols 5..) y en TOTAL TN
            for col in range(5, 4 + maxc + 1):
                ws.cell(row=ws.max_row, column=col).number_format = "0.000"
            ws.cell(row=ws.max_row, column=tn_col).number_format = "0.000"
        wb.save(sys.argv[2])
        print("escrito", sys.argv[2], file=sys.stderr)


if __name__ == "__main__":
    main()
