#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera las filas del Excel de control del SHUTTLE METANOL (FORESA Villagarcia->Caldas)
para copiar/pegar, como en el Excel de Julio (una hoja por tractora, fila por dia, columnas
con la cantidad de cada albaran del dia + TOTAL del dia).

Lee el raw del juego: toma los albaranes del shuttle (los que traen "shuttle_cantidades",
= FORESA Villagarcia->Caldas metanol sumado por dia). Por cada dia emite una fila:

  Tractora  Chofer  Fecha  <cant1> <cant2> ... <cantN>  TOTAL(kg)  TOTAL(TN)

Julio pega esa fila en la hoja de la tractora del mes (RESUMEN NOVIEMBRE / 3729 / 8382JJS...).

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
    cols = ["Emp", "Tractora", "Chofer", "Fecha"] + [f"Alb{i+1}" for i in range(maxc)] + ["TOTAL kg", "TOTAL TN"]
    # TSV a stdout
    print("\t".join(cols))
    for f in filas:
        row = [f["empresa"], f["tractora"], f["chofer"], f["fecha"]] + \
              [str(x) for x in f["cants"]] + [""] * (maxc - len(f["cants"])) + \
              [str(f["total_kg"]), str(f["total_tn"]).replace(".", ",")]
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
        for f in filas:
            ws.append([f["empresa"], f["tractora"], f["chofer"], f["fecha"]] +
                      list(f["cants"]) + [None] * (maxc - len(f["cants"])) +
                      [f["total_kg"], f["total_tn"]])
        wb.save(sys.argv[2])
        print("escrito", sys.argv[2], file=sys.stderr)


if __name__ == "__main__":
    main()
