#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Procesa un PDF de facturas (una o varias) y archiva los scans facturados.

Lee el PDF (capa de texto), separa cada factura (cliente, Nº, fecha de
FACTURACION, referencias), cruza las referencias contra el libro maestro
(datos/registro-procesamiento.csv) y, por cada factura con scans nuestros:
  - parte sus paginas en un PDF propio (FACTURA-<Nº>.pdf),
  - llama a mover-facturados.js para mover los scans a
    facturados/<AÑO>/<MM-mes>/<CLIENTE>/<Nº>/ y actualizar registro + log.

Mes de FACTURACION = mes del campo "Fecha" de la factura (NO "Emisión").

DRY-RUN por defecto (no toca nada). Con --mover aplica.

uso: python3 -I herramientas/facturar/procesar-facturas.py <facturas.pdf> [--mover]
"""
import sys, os, re, csv, subprocess, collections

sys.path.insert(0, "/usr/local/lib/python3.13/site-packages")
import fitz

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REGISTRO = os.path.join(ROOT, "datos/registro-procesamiento.csv")
MOVER = os.path.join(ROOT, "herramientas/facturar/mover-facturados.js")
STAGING = "/tmp/claude-0/-home-user/dd3954c2-637c-5b01-a55f-0b9e5dc06118/scratchpad/facturas-split"
MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
         'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']


def cargar_registro():
    ref2pdf = {}
    with open(REGISTRO, encoding='utf-8') as fh:
        rd = csv.reader(fh, delimiter=';')
        next(rd)
        for row in rd:
            if len(row) > 26 and row[9].strip():
                ref2pdf[row[9].strip()] = row[26].strip()
    return ref2pdf


def mes_de(fecha):  # "30/10/2026" -> "2026-10"
    m = re.match(r'(\d{2})/(\d{2})/(\d{4})', fecha or '')
    return f"{m.group(3)}-{m.group(2)}" if m else None


def parsear(doc):
    """Devuelve OrderedDict factura -> {cliente, fecha, paginas[], refs[]}."""
    porfac = collections.OrderedDict()
    for i in range(doc.page_count):
        t = doc[i].get_text()
        lines = [l.strip() for l in t.splitlines() if l.strip()]
        cliente = lines[0] if lines else "?"
        mf = re.search(r'\b(\d{4}/\d{1,6})\b', t)
        fac = mf.group(1) if mf else None
        fecha = None
        if mf:
            md = re.search(r'\b\d{2}/\d{2}/\d{4}\b', t[mf.end():])
            fecha = md.group(0) if md else None
        refs = re.findall(r'\d{2}/\d{2}/\d{4}\s+(\d{5,})', t)
        if fac is None:
            fac = f"__sin_nro_pag{i+1}"
        d = porfac.setdefault(fac, dict(cliente=cliente, fecha=fecha, paginas=[], refs=[]))
        d['paginas'].append(i)
        d['refs'] += refs
        if d['fecha'] is None and fecha:
            d['fecha'] = fecha
    return porfac


def main():
    if len(sys.argv) < 2:
        print("uso: python3 -I procesar-facturas.py <facturas.pdf> [--mover]", file=sys.stderr)
        sys.exit(2)
    pdf = sys.argv[1]
    aplicar = '--mover' in sys.argv[2:]
    ref2pdf = cargar_registro()
    doc = fitz.open(pdf)
    porfac = parsear(doc)

    os.makedirs(STAGING, exist_ok=True)
    con_scans, sin_ref, refs_no_nuestras, anomalias = [], [], [], []

    for fac, d in porfac.items():
        urefs = list(dict.fromkeys(d['refs']))
        matched = [r for r in urefs if r in ref2pdf]
        if not urefs:
            sin_ref.append((fac, d['cliente']))
            continue
        if not matched:
            refs_no_nuestras.append((fac, d['cliente'], len(urefs)))
            continue
        carpetas = set(ref2pdf[r].split('/')[1] for r in matched if '/' in ref2pdf[r])
        if len(carpetas) != 1:
            anomalias.append((fac, d['cliente'], sorted(carpetas)))
            continue
        cliente_folder = carpetas.pop()
        mes = mes_de(d['fecha'])
        if not mes:
            anomalias.append((fac, d['cliente'], ['sin fecha de facturación']))
            continue
        con_scans.append(dict(fac=fac, cliente=d['cliente'], cliente_folder=cliente_folder,
                              mes=mes, paginas=d['paginas'], matched=matched,
                              total=len(urefs)))

    # Reporte
    print(f"\n{'='*70}\nPROCESAR FACTURAS {'(APLICANDO)' if aplicar else '(DRY-RUN)'}  —  {pdf}")
    print(f"{len(porfac)} facturas · {doc.page_count} páginas · registro {len(ref2pdf)} refs\n")
    print(f"--- {len(con_scans)} facturas CON scans nuestros (se archivan) ---")
    tot = 0
    for p in con_scans:
        tot += len(p['matched'])
        print(f"  {p['fac']:>9}  {p['cliente_folder']:10} mes={p['mes']}  "
              f"{len(p['matched'])}/{p['total']} scans  -> facturados/{p['mes'][:4]}/"
              f"{p['mes'][5:]}-{MESES[int(p['mes'][5:])]}/{p['cliente_folder']}/{p['fac'].replace('/','-')}/")
    print(f"\n  TOTAL scans a archivar: {tot}")
    if refs_no_nuestras:
        print(f"\n--- {len(refs_no_nuestras)} facturas con refs que NO están en nuestro registro (nada que mover) ---")
        for fac, cli, n in refs_no_nuestras:
            print(f"  {fac:>9}  {cli[:30]:30} ({n} refs ajenas)")
    if sin_ref:
        print(f"\n--- {len(sin_ref)} facturas SIN referencia (CLAVO por km, o servicios sin REF: revisar a mano) ---")
        for fac, cli in sin_ref:
            print(f"  {fac:>9}  {cli[:40]}")
    if anomalias:
        print(f"\n--- {len(anomalias)} ANOMALÍAS (revisar) ---")
        for fac, cli, info in anomalias:
            print(f"  {fac:>9}  {cli[:30]:30} {info}")

    if not aplicar:
        print(f"\n(DRY-RUN) No se movió nada. Repetir con --mover para aplicar.")
        return

    # APLICAR: partir PDF por factura y llamar al mover
    print(f"\n{'='*70}\nAPLICANDO\n")
    for p in con_scans:
        split_path = os.path.join(STAGING, "FACTURA-" + p['fac'].replace('/', '-') + ".pdf")
        nd = fitz.open()
        for pg in p['paginas']:
            nd.insert_pdf(doc, from_page=pg, to_page=pg)
        nd.save(split_path)
        nd.close()
        cmd = ["node", MOVER, "--cliente", p['cliente_folder'], "--factura", p['fac'],
               "--mes", p['mes'], "--refs", ",".join(p['matched']),
               "--factura-pdf", split_path, "--mover"]
        r = subprocess.run(cmd, capture_output=True, text=True)
        tail = [l for l in r.stdout.splitlines() if ('✅' in l or '✗' in l or 'ERROR' in l or 'skip' in l)]
        print(f"  {p['fac']:>9} {p['cliente_folder']:10}: " + ("; ".join(tail[-2:]) if tail else "ok"))
        if r.returncode != 0:
            print(f"      STDERR: {r.stderr.strip()[:200]}")
    print("\nListo. Validar con: python3 -I herramientas/validar_carga.py")


if __name__ == "__main__":
    main()
