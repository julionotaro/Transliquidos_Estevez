#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Construye la MATRIZ CLIENTE x RUTA x MATERIAL a partir del export anual de
viajes de Gesruta, y la contrasta contra el tarifario oficial.

POR QUE EXISTE. El sistema venia haciendo la pregunta dificil:
"dado este texto de direccion, cual de los 214 puntos es?" -- conjunto abierto.
La pregunta correcta es la que hace la oficina: "dado que el cliente es RNM,
cual de SUS rutas conocidas es?" -- conjunto cerrado de 5 a 20 opciones, con
frecuencias. Este script produce ese conjunto cerrado a partir de lo que la
empresa REALMENTE facturo, no de lo que alguien supone.

SALIDAS (todas en catalogo/ o informes/):
  catalogo/rutas-por-cliente.json   el conjunto cerrado + tarifa observada
  catalogo/planta-a-provincia.json  candidatos de traduccion PLANTA -> PROVINCIA
  informes/rutas-sin-tarifa.md      rutas frecuentes que el tarifario no cubre

EL HALLAZGO QUE ORIGINA ESTE SCRIPT. El tarifario esta indexado por PROVINCIA o
LOCALIDAD ("TERUEL", "BARCELONA"); el registro operativo esta indexado por la
PLANTA CONSIGNATARIA ("UTISA TERUEL", "IP DECOR SPAIN, SAU"). Son dos vocabularios
distintos para el mismo punto, y por eso buscar la tarifa por (cliente, origen,
destino) fallaba de forma masiva y sistematica -- no por alias sueltos.
Verificado a la cifra exacta: FORESA CALDAS->IP DECOR se facturo a 72,36, que es
exactamente la tarifa CALDAS->BARCELONA. IP Decor esta en Barcelona.

De ahi el puente por PRECIO: si una ruta sin tarifa se facturo a un importe
IDENTICO al de una unica tarifa del mismo cliente+origen, ese destino tarifado es
el candidato de traduccion. Es un GENERADOR DE CANDIDATOS, no un oraculo: se
emite para que un humano lo confirme una vez. Nunca se aplica solo.

NO INVENTA NADA: si una ruta tuvo varios precios, los lista todos y marca el
caso; el precio que manda es el MAS RECIENTE y siempre queda marcado como
observado (no pactado).
"""
import xlrd, json, os, sys, unicodedata
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIAJES  = os.path.join(RAIZ, 'datos/gesruta/viajes-anio-2026-08-19.xls')
TARIFAS = os.path.join(RAIZ, 'datos/gesruta/tarifas-general-2026-08-04.xls')

def norm(s):
    t = '' if s is None else str(s)
    t = unicodedata.normalize('NFD', t.upper())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return ' '.join(''.join(c if c.isalnum() else ' ' for c in t).split())

def fecha_excel(v):
    try:
        y, m, d = xlrd.xldate_as_tuple(float(v), 0)[:3]
        return '%04d-%02d-%02d' % (y, m, d)
    except Exception:
        return None

def leer_viajes():
    sh = xlrd.open_workbook(VIAJES).sheet_by_index(0)
    h = sh.row_values(0); ix = {n: i for i, n in enumerate(h)}
    out = []
    for r in range(1, sh.nrows):
        v = sh.row_values(r)
        g = lambda c: v[ix[c]] if c in ix else ''
        out.append({
            'cliente':   str(g('cliente')).strip(),
            'nomcliente': str(g('nomcliente')).strip(),
            'nif':       str(g('nifcliente')).strip(),
            'origen':    str(g('desde')).strip(),
            'nomorigen': str(g('nomdesde')).strip(),
            'destino':   str(g('hasta')).strip(),
            'nomdestino':str(g('nomhasta')).strip(),
            'material':  str(g('carga')).strip(),
            'nommaterial': str(g('nomcarga')).strip(),
            'concepto':  str(g('codcon')).strip(),
            'precio':    g('precio'),
            'importe':   g('import'),
            'cantidad':  g('cantid'),
            'unidad':    str(g('unimed')).strip(),
            'fecha':     fecha_excel(g('desdef')),
            'refere':    str(g('refere')).strip(),
        })
    return out

def leer_tarifas():
    sh = xlrd.open_workbook(TARIFAS).sheet_by_index(0)
    h = sh.row_values(0); ix = {n: i for i, n in enumerate(h)}
    out = []
    for r in range(1, sh.nrows):
        v = sh.row_values(r)
        out.append({
            'cliente': str(v[ix['Cliente']]).strip(),
            'origen':  str(v[ix['Origen']]).strip(),
            'destino': str(v[ix['Destino']]).strip(),
            'carga':   str(v[ix['Carga']]).strip(),
            'concepto':str(v[ix['Concepto']]).strip(),
            'precio':  v[ix['Precio']],
            'um':      str(v[ix['U.M.']]).strip(),
        })
    return out

def main():
    viajes  = leer_viajes()
    tarifas = leer_tarifas()

    # --- Matriz: (cliente, origen, destino, material) -> historia -------------
    celdas = defaultdict(list)
    for v in viajes:
        if v['concepto'] != 'P':      # solo PORTES; los demas conceptos son cargos
            continue
        celdas[(v['cliente'], v['origen'], v['destino'], v['material'])].append(v)

    # --- Indice del tarifario oficial, por nombre normalizado ----------------
    # 'Cualquiera' es COMODIN en el tarifario, tanto en Destino como en Carga.
    # Tratarlo como un literal marcaba clientes enteros como "sin tarifa": CLAVO
    # factura por KM con destino comodin y aparecian sus 500+ viajes como huecos.
    COMODIN = 'CUALQUIERA'
    ofi = defaultdict(list)
    for t in tarifas:
        ofi[(norm(t['cliente']), norm(t['origen']), norm(t['destino']))].append(t)

    def tarifa_oficial(nomcli, nomorg, nomdst):
        c, o = norm(nomcli), norm(nomorg)
        exacta = ofi.get((c, o, norm(nomdst)), [])
        if exacta:
            return exacta, 'exacta'
        comodin = ofi.get((c, o, COMODIN), [])
        if comodin:
            return comodin, 'comodin'
        return [], None

    por_cliente = defaultdict(lambda: {'nombre': '', 'nif': '', 'rutas': []})
    sin_tarifa = []

    for (cli, o, d, mat), vs in celdas.items():
        vs_ord = sorted(vs, key=lambda x: x['fecha'] or '')
        ult = vs_ord[-1]
        precios = sorted({round(float(x['precio']), 4) for x in vs if x['precio'] not in ('', None)})
        cab = por_cliente[cli]
        cab['nombre'] = ult['nomcliente']; cab['nif'] = ult['nif']

        filas_ofi, modo_ofi = tarifa_oficial(ult['nomcliente'], ult['nomorigen'], ult['nomdestino'])
        tiene_ofi = bool(filas_ofi)

        ruta = {
            'origen': o, 'nombre_origen': ult['nomorigen'],
            'destino': d, 'nombre_destino': ult['nomdestino'],
            'material': mat, 'nombre_material': ult['nommaterial'],
            'n_viajes': len(vs),
            'ultima_fecha': ult['fecha'],
            'unidad': ult['unidad'],
            'precio_ultimo': round(float(ult['precio']), 4) if ult['precio'] not in ('', None) else None,
            'precios_vistos': precios,
            'precio_estable': len(precios) == 1,
            'en_tarifario_oficial': tiene_ofi,
            'match_tarifario': modo_ofi,     # 'exacta' | 'comodin' | None
        }
        cab['rutas'].append(ruta)
        if not tiene_ofi:
            sin_tarifa.append((len(vs), cli, ult['nomcliente'], ult['nomorigen'],
                               ult['nomdestino'], ult['nommaterial'],
                               ruta['precio_ultimo'], ruta['unidad'], len(precios)))

    for c in por_cliente.values():
        c['rutas'].sort(key=lambda r: -r['n_viajes'])

    # --- Puente por PRECIO: PLANTA -> PROVINCIA -----------------------------
    # Indice de tarifas por (cliente, origen) para buscar el importe identico.
    por_co = defaultdict(list)
    for t in tarifas:
        try: pr = round(float(t['precio']), 4)
        except (TypeError, ValueError): continue
        if norm(t['destino']) == COMODIN:
            continue      # un comodin no traduce una planta: no es un nombre de punto
        por_co[(norm(t['cliente']), norm(t['origen']))].append((t['destino'], pr, t['um']))

    puente = []
    for cli, c in por_cliente.items():
        for R in c['rutas']:
            if R['en_tarifario_oficial'] or R['precio_ultimo'] is None:
                continue
            cands = por_co.get((norm(c['nombre']), norm(R['nombre_origen'])), [])
            iguales = [x for x in cands if abs(x[1] - R['precio_ultimo']) < 0.005]
            if len(iguales) != 1:
                continue          # 0 = no hay puente; >1 = ambiguo, no se emite
            puente.append({
                'cliente': c['nombre'], 'origen': R['nombre_origen'],
                'planta': R['nombre_destino'], 'provincia_tarifada': iguales[0][0],
                'precio': R['precio_ultimo'], 'n_viajes': R['n_viajes'],
                'confirmado': False,
            })
    puente.sort(key=lambda x: -x['n_viajes'])
    with open(os.path.join(RAIZ, 'catalogo/planta-a-provincia.json'), 'w', encoding='utf-8') as f:
        json.dump({'nota': 'CANDIDATOS deducidos por coincidencia exacta de precio. '
                           'Requieren confirmacion humana: poner confirmado=true. '
                           'Un candidato sin confirmar NO se usa para facturar.',
                   'candidatos': puente}, f, ensure_ascii=False, indent=1)

    os.makedirs(os.path.join(RAIZ, 'informes'), exist_ok=True)
    with open(os.path.join(RAIZ, 'catalogo/rutas-por-cliente.json'), 'w', encoding='utf-8') as f:
        json.dump({'generado_de': os.path.basename(VIAJES),
                   'viajes_leidos': len(viajes),
                   'clientes': dict(por_cliente)}, f, ensure_ascii=False, indent=1)

    # --- Informe ------------------------------------------------------------
    sin_tarifa.sort(reverse=True)
    tot_rutas = sum(len(c['rutas']) for c in por_cliente.values())
    tot_viajes_sin = sum(s[0] for s in sin_tarifa)
    L = []
    L.append('# Rutas reales sin tarifa oficial\n')
    L.append('> Generado por `herramientas/construir-matriz-rutas.py` desde el export')
    L.append('> anual de Gesruta. Cada fila es una ruta que la empresa **facturo de verdad**')
    L.append('> y que el tarifario oficial **no cubre** por (cliente, origen, destino).\n')
    L.append('| # | viajes | cliente | origen | destino | material | ult. precio | u.m. | precios distintos |')
    L.append('|---|---|---|---|---|---|---|---|---|')
    for i, s in enumerate(sin_tarifa[:60], 1):
        L.append('| %d | **%d** | %s | %s | %s | %s | %s | %s | %s |' %
                 (i, s[0], s[2][:28], s[3], s[4], s[5], s[6], s[7],
                  s[8] if s[8] > 1 else ''))
    L.append('')
    L.append('## Resumen')
    L.append('')
    L.append('- viajes (lineas de porte) leidos: **%d**' % sum(len(v) for v in celdas.values()))
    L.append('- combinaciones cliente x ruta x material distintas: **%d**' % tot_rutas)
    L.append('- de esas, **sin** tarifa oficial: **%d** (%.0f%%)' % (len(sin_tarifa), 100.0*len(sin_tarifa)/tot_rutas))
    L.append('- viajes que caen en una ruta sin tarifa oficial: **%d** (%.0f%% del total)' %
             (tot_viajes_sin, 100.0*tot_viajes_sin/sum(len(v) for v in celdas.values())))
    L.append('')
    L.append('## Puente PLANTA -> PROVINCIA deducido por precio')
    L.append('')
    L.append('El tarifario indexa por **provincia**; el viaje real, por **planta**.')
    L.append('Cuando una ruta sin tarifa se facturo a un importe **identico** al de una')
    L.append('unica tarifa del mismo cliente+origen, ese es el candidato de traduccion.')
    L.append('**Son candidatos: hay que confirmarlos a mano una vez** (`catalogo/planta-a-provincia.json`).')
    L.append('')
    L.append('| viajes | cliente | origen | planta (lo que dice el documento) | provincia (lo que dice el tarifario) | precio |')
    L.append('|---|---|---|---|---|---|')
    for x in puente[:40]:
        L.append('| **%d** | %s | %s | %s | **%s** | %s |' %
                 (x['n_viajes'], x['cliente'][:26], x['origen'], x['planta'],
                  x['provincia_tarifada'], x['precio']))
    L.append('')
    L.append('- candidatos de traduccion inequivocos: **%d**, que cubren **%d viajes**'
             % (len(puente), sum(x['n_viajes'] for x in puente)))
    with open(os.path.join(RAIZ, 'informes/rutas-sin-tarifa.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')

    print('clientes:', len(por_cliente), ' rutas:', tot_rutas, ' sin tarifa oficial:', len(sin_tarifa))
    print('viajes en rutas sin tarifa:', tot_viajes_sin, 'de', sum(len(v) for v in celdas.values()))

main()
