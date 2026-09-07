#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recorta catalogo/rutas-por-cliente.json a los clientes que se van a PROBAR.

El JSON completo pesa 440 KB (58 clientes) y no entra embebido en un nodo Code de
n8n. Pero para las pruebas definitivas solo importan los cuatro clientes
confirmados: son el mayor porcentaje del volumen. Este recorte deja solo esos y
solo los campos que usa rutas-conocidas.js (nombre, nif, rutas con origen/destino/
material/frecuencia), que es lo unico que el conjunto cerrado necesita.

Es un DERIVADO: se regenera del completo, no se edita a mano. El completo sigue
siendo la fuente para el informe y el analisis.
"""
import json, os, unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = os.path.join(RAIZ, 'catalogo/rutas-por-cliente.json')
SALIDA = os.path.join(RAIZ, 'catalogo/rutas-por-cliente-test.json')

# Los cuatro confirmados por Julio. Se matchea por token contenido en la razon
# social (FORESA -> "FORESA IND.QUIMICAS...").
CLIENTES = ['FORESA', 'BRESFOR', 'QUIMIDROGA', 'RNM']

def norm(s):
    t = unicodedata.normalize('NFD', str(s or '').upper())
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn')

d = json.load(open(FUENTE, encoding='utf-8'))
out = {'generado_de': os.path.basename(FUENTE),
       'nota': 'RECORTE para pruebas: solo los 4 clientes confirmados y los campos '
               'que usa rutas-conocidas.js. Derivado; se regenera con '
               'herramientas/recortar-rutas-clientes.py. No editar a mano.',
       'clientes': {}}

for cid, c in d['clientes'].items():
    n = norm(c['nombre'])
    if not any(cl in n for cl in CLIENTES):
        continue
    out['clientes'][cid] = {
        'nombre': c['nombre'], 'nif': c.get('nif', ''),
        'rutas': [{'nombre_origen': R['nombre_origen'],
                   'nombre_destino': R['nombre_destino'],
                   'nombre_material': R['nombre_material'],
                   'n_viajes': R['n_viajes']} for R in c['rutas']],
    }

json.dump(out, open(SALIDA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
kb = os.path.getsize(SALIDA) / 1024
nrut = sum(len(c['rutas']) for c in out['clientes'].values())
print('clientes:', len(out['clientes']), ' rutas:', nrut, ' tamano: %.0f KB' % kb)
for cid, c in out['clientes'].items():
    print('  %-40s %3d rutas' % (c['nombre'][:40], len(c['rutas'])))
