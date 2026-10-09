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
  catalogo/tarifa-por-analogia.json candidatos: rutas cuya tarifa la oficina toma
                                    de OTRA ruta del mismo cliente+origen
  informes/rutas-sin-tarifa.md      rutas frecuentes que el tarifario no cubre

POR QUE FALLA LA BUSQUEDA DE TARIFA — diagnostico verificado, 2026-08-27.

Se descarto una hipotesis propia antes de darla por buena. La hipotesis era que
el tarifario estaba indexado por PROVINCIA y el registro de viajes por PLANTA
CONSIGNATARIA, o sea dos vocabularios distintos. LOS DATOS LA DESMIENTEN:

  - Los literales del tarifario estan en el catalogo de puntos: 294/294 = 100 %
  - Los literales de los viajes, tambien: 293/295 = 99 %
  - Ambas tablas mezclan provincias, pueblos y empresas en la MISMA proporcion
    (tarifario destino: 23 % provincia / 9 % empresa / 68 % otro;
     viajes destino:    17 % provincia / 16 % empresa / 67 % otro)

NO HAY PROBLEMA DE VOCABULARIO entre tarifario y viajes: las dos tablas beben del
mismo catalogo de 790 puntos. La causa real es mas simple y menos halagadora:
EL TARIFARIO ESTA INCOMPLETO respecto de lo que la empresa realmente transporta.
De los 790 puntos, 294 aparecen en tarifas y 295 en viajes, pero solo 152 en las
dos. Hay 143 puntos a los que se viaja sin tarifa cargada.

Desglose de las 532 combinaciones sin tarifa (1.973 viajes):
   281 comb /  419 viajes  el CLIENTE no tiene ninguna tarifa cargada
   138 comb / 1234 viajes  el DESTINO no esta en ninguna tarifa de ese cliente
    47 comb /  192 viajes  el ORIGEN no esta en ninguna tarifa de ese cliente
    47 comb /   82 viajes  ni origen ni destino estan
    19 comb /   46 viajes  existen por separado, pero no esa combinacion

TARIFA POR ANALOGIA. Cuando el destino real no esta tarifado, la oficina aplica a
mano la tarifa de otra ruta del mismo cliente y origen (regla que Julio describio
y que documenta catalogo/tarifario-historico.js). Ese gesto deja huella: el
importe facturado coincide EXACTAMENTE con el de esa otra tarifa. Este script
detecta esas coincidencias y las emite como candidatos.

Lo que un candidato dice es "para este destino la oficina cobra la tarifa de
aquel otro", NO "este destino ES aquel otro". Es un GENERADOR DE CANDIDATOS, no
un oraculo: se emite con confirmado=false para que un humano lo valide una vez.

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
            'primera_fecha': vs_ord[0]['fecha'],
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

    # --- Por que NO matchea cada ruta: se calcula, no se supone ------------
    clientes_tar = {norm(t['cliente']) for t in tarifas}
    org_de = defaultdict(set); dst_de = defaultdict(set)
    for t in tarifas:
        org_de[norm(t['cliente'])].add(norm(t['origen']))
        dst_de[norm(t['cliente'])].add(norm(t['destino']))

    diag = defaultdict(lambda: [0, 0])   # causa -> [combinaciones, viajes]
    for cid, c in por_cliente.items():
        cn = norm(c['nombre'])
        for R in c['rutas']:
            if R['en_tarifario_oficial']:
                R['causa_sin_tarifa'] = None
                continue
            o, ds = norm(R['nombre_origen']), norm(R['nombre_destino'])
            if cn not in clientes_tar:
                k = 'el CLIENTE no tiene ninguna tarifa cargada'
            elif o not in org_de[cn] and ds not in dst_de[cn]:
                k = 'ni el origen ni el destino aparecen en las tarifas de ese cliente'
            elif ds not in dst_de[cn]:
                k = 'el DESTINO no aparece en ninguna tarifa de ese cliente'
            elif o not in org_de[cn]:
                k = 'el ORIGEN no aparece en ninguna tarifa de ese cliente'
            else:
                k = 'origen y destino existen por separado, pero NO esa combinacion'
            diag[k][0] += 1; diag[k][1] += R['n_viajes']
            R['causa_sin_tarifa'] = k

    # --- Tarifa POR ANALOGIA: detectada por coincidencia exacta de importe ---
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
                'destino_real': R['nombre_destino'],
                'destino_tarifado': iguales[0][0],
                'precio': R['precio_ultimo'], 'n_viajes': R['n_viajes'],
                'confirmado': False,
            })
    puente.sort(key=lambda x: -x['n_viajes'])

    # --- LOS VEREDICTOS HUMANOS SOBREVIVEN A LA REGENERACION ----------------
    # Bug real, 27/08/2026: Julio reviso los 21 candidatos uno por uno y al
    # re-correr este script para agregar un campo se perdieron TODOS. Un
    # generador que pisa decisiones humanas es peor que no tener generador: el
    # trabajo de revision se evapora sin aviso y la cascada se queda sin
    # analogias en silencio.
    #
    # Por eso el archivo se MEZCLA, no se sobrescribe: los candidatos se
    # recalculan desde el dato, pero estado/veredicto/quien/cuando se arrastran
    # desde el archivo anterior. Un candidato nuevo nace sin confirmar.
    destino_json = os.path.join(RAIZ, 'catalogo/tarifa-por-analogia.json')
    CAMPOS_HUMANOS = ('estado', 'confirmado', 'veredicto', 'revisado_por', 'fecha_revision')

    def firma(x):
        return (norm(x.get('cliente')), norm(x.get('origen')),
                norm(x.get('destino_real')), norm(x.get('destino_tarifado')))

    veredictos = {}
    if os.path.exists(destino_json):
        try:
            previo = json.load(open(destino_json, encoding='utf-8'))
            for x in previo.get('candidatos', []):
                if x.get('estado'):
                    veredictos[firma(x)] = {k: x[k] for k in CAMPOS_HUMANOS if k in x}
        except (ValueError, OSError) as e:
            raise SystemExit('No se pudo leer %s (%s). Se aborta ANTES de escribir: '
                             'sobrescribirlo perderia los veredictos humanos.' % (destino_json, e))

    usados = set()
    for x in puente:
        v = veredictos.get(firma(x))
        if v:
            x.update(v); usados.add(firma(x))

    # Un veredicto cuyo candidato ya no aparece no se tira: se avisa. Puede
    # significar que la ruta dejo de hacerse, o que cambio de precio y el puente
    # ya no la detecta — las dos cosas hay que saberlas.
    huerfanos = [k for k in veredictos if k not in usados]

    with open(destino_json, 'w', encoding='utf-8') as f:
        json.dump({'nota': 'CANDIDATOS de TARIFA POR ANALOGIA, deducidos porque el importe '
                           'facturado coincide EXACTAMENTE con el de otra ruta del mismo '
                           'cliente+origen. Significa "aqui se cobra la tarifa de aquella otra '
                           'ruta", NO "este destino es aquel otro". Requieren confirmacion '
                           'humana: poner confirmado=true. Sin confirmar NO se factura con ellos.',
                   'veredictos_arrastrados': len(usados),
                   'veredictos_huerfanos': [' -> '.join(k[2:]) for k in huerfanos],
                   'candidatos': puente}, f, ensure_ascii=False, indent=1)
    if huerfanos:
        print('AVISO: %d veredicto(s) sin candidato actual: %s'
              % (len(huerfanos), '; '.join(' -> '.join(k[2:]) for k in huerfanos)))

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
    L.append('## Por que no matchea')
    L.append('')
    L.append('No es un problema de vocabulario: **el tarifario y los viajes beben del mismo')
    L.append('catalogo de puntos** (294/294 y 293/295 de los literales estan en el). La causa')
    L.append('es que **el tarifario esta incompleto** respecto de lo que se transporta.')
    L.append('')
    L.append('| combinaciones | viajes | causa |')
    L.append('|---|---|---|')
    for k, (nc, nv) in sorted(diag.items(), key=lambda x: -x[1][1]):
        L.append('| %d | **%d** | %s |' % (nc, nv, k))
    L.append('')
    L.append('## Tarifa por analogia — candidatos a CONFIRMAR a mano')
    L.append('')
    L.append('Cuando el destino real no esta tarifado, la oficina aplica la tarifa de otra')
    L.append('ruta del mismo cliente y origen. Ese gesto deja huella: el importe facturado')
    L.append('coincide **exactamente** con el de esa otra tarifa.')
    L.append('')
    L.append('Cada fila dice *"para este destino se cobra la tarifa de aquel otro"*, **no**')
    L.append('*"este destino es aquel otro"*. Confirmar en `catalogo/tarifa-por-analogia.json`.')
    L.append('')
    L.append('| # | viajes | cliente | origen | destino REAL | se cobra la tarifa de | precio | ok? |')
    L.append('|---|---|---|---|---|---|---|---|')
    for i, x in enumerate(puente[:40], 1):
        L.append('| %d | **%d** | %s | %s | **%s** | %s | %s |  |' %
                 (i, x['n_viajes'], x['cliente'][:26], x['origen'], x['destino_real'],
                  x['destino_tarifado'], x['precio']))
    L.append('')
    L.append('- candidatos inequivocos: **%d**, que cubren **%d viajes**'
             % (len(puente), sum(x['n_viajes'] for x in puente)))
    with open(os.path.join(RAIZ, 'informes/rutas-sin-tarifa.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')

    print('clientes:', len(por_cliente), ' rutas:', tot_rutas, ' sin tarifa oficial:', len(sin_tarifa))
    print('viajes en rutas sin tarifa:', tot_viajes_sin, 'de', sum(len(v) for v in celdas.values()))

main()
