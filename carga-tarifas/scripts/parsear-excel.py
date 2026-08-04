#!/usr/bin/env python3
"""Convierte Tarifas_general.xls (Hoja1) a JSON con nombres de columna tal
cual el Excel y fechas ya resueltas a 'YYYY-MM-DD' (o '' si estan vacias).

No aplica ninguna regla de negocio (eso vive en carga-tarifas.js, testeado).
Solo hace la conversion mecanica de formato .xls -> JSON.

Uso: python3 parsear-excel.py <ruta_al_xls> > filas-crudas.json
"""
import sys
import json
import xlrd

COLUMNAS = ['Cliente', 'Origen', 'Destino', 'Carga', 'Precio', 'U.M.', 'Fec.Ult.Apli.', 'Desde']


def fecha_a_string(valor, datemode):
    if valor == '' or valor is None:
        return ''
    t = xlrd.xldate_as_tuple(valor, datemode)
    return '%04d-%02d-%02d' % (t[0], t[1], t[2])


def main():
    if len(sys.argv) != 2:
        print('uso: parsear-excel.py <ruta_al_xls>', file=sys.stderr)
        sys.exit(1)

    wb = xlrd.open_workbook(sys.argv[1])
    sh = wb.sheet_by_index(0)
    headers = [sh.cell_value(0, c) for c in range(sh.ncols)]
    idx = {h: i for i, h in enumerate(headers)}

    faltantes = [c for c in COLUMNAS if c not in idx]
    if faltantes:
        print('ERROR: faltan columnas esperadas en el Excel: %s' % faltantes, file=sys.stderr)
        sys.exit(1)

    filas = []
    for r in range(1, sh.nrows):
        fila = {}
        for c in COLUMNAS:
            v = sh.cell_value(r, idx[c])
            if c in ('Fec.Ult.Apli.', 'Desde'):
                v = fecha_a_string(v, wb.datemode)
            elif c == 'Precio':
                v = float(v) if v != '' else None
            fila[c] = v
        filas.append(fila)

    print('filas leidas: %d (esperado: 704 filas de datos + 1 encabezado)' % len(filas), file=sys.stderr)
    json.dump(filas, sys.stdout, ensure_ascii=False)


if __name__ == '__main__':
    main()
