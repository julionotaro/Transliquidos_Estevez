# test_captura_nro.py -- SOLO LECTURA. Captura por GDI (ctypes) la zona del Nº de viaje y la guarda
# como PNG (encoder con zlib de la stdlib; NO usa Pillow). Objetivo: comprobar que el recorte sale
# legible, para que la EXTRACCION (vista) lo lea y complete nro_viaje_gesruta sin paso manual.
#
# USO: dejá "Entrada de Viajes" delante con el viaje GRABADO (que se vea el Nº arriba a la izquierda,
#      p. ej. 00050962) y corré test_captura_nro.bat. Genera:
#         nro_viaje_crop.png       (el recorte de la zona del Nº)
#         nro_viaje_crop_full.png  (una franja mas ancha, por si el Nº quedo fuera del recorte chico)
#         test_captura_nro_log.txt
#      Pasale a Claude los dos PNG.
#
# No teclea, no graba, no toca datos: solo lee pixeles de la pantalla.
import ctypes, zlib, struct, os, datetime

# --- Zona del Nº de viaje, en pixeles REALES de pantalla (layout maximizado 1920x1080) ---
# Recorte chico (justo el Nº) y uno ancho (toda la franja "Viaje ... Exp."), por las dudas.
CROP      = (8,  82, 250, 32)    # (left, top, width, height)
CROP_FULL = (0,  78, 420, 42)

SRCCOPY = 0x00CC0020

def capturar(left, top, w, h):
    u = ctypes.windll.user32; g = ctypes.windll.gdi32
    sdc = u.GetDC(0); mdc = g.CreateCompatibleDC(sdc)
    bmp = g.CreateCompatibleBitmap(sdc, w, h); g.SelectObject(mdc, bmp)
    g.BitBlt(mdc, 0, 0, w, h, sdc, left, top, SRCCOPY)
    class BMIH(ctypes.Structure):
        _fields_ = [("biSize",ctypes.c_uint32),("biWidth",ctypes.c_int32),("biHeight",ctypes.c_int32),
                    ("biPlanes",ctypes.c_uint16),("biBitCount",ctypes.c_uint16),("biCompression",ctypes.c_uint32),
                    ("biSizeImage",ctypes.c_uint32),("biXPels",ctypes.c_int32),("biYPels",ctypes.c_int32),
                    ("biClrUsed",ctypes.c_uint32),("biClrImportant",ctypes.c_uint32)]
    bmi = BMIH(); bmi.biSize=40; bmi.biWidth=w; bmi.biHeight=-h  # top-down
    bmi.biPlanes=1; bmi.biBitCount=24; bmi.biCompression=0
    stride = ((w*3 + 3)//4)*4
    buf = ctypes.create_string_buffer(stride*h)
    g.GetDIBits(mdc, bmp, 0, h, buf, ctypes.byref(bmi), 0)
    data = buf.raw
    rows = []
    for y in range(h):
        off = y*stride; row = bytearray()
        for x in range(w):
            b = data[off+x*3]; gg = data[off+x*3+1]; r = data[off+x*3+2]  # DIB es BGR
            row += bytes((r, gg, b))
        rows.append(bytes(row))
    g.DeleteObject(bmp); g.DeleteDC(mdc); u.ReleaseDC(0, sdc)
    return rows

def guardar_png(width, height, rgb_rows, path):
    raw = bytearray()
    for row in rgb_rows:
        raw.append(0)          # filtro 'none'
        raw.extend(row)
    comp = zlib.compress(bytes(raw), 9)
    def chunk(typ, data):
        return struct.pack(">I", len(data)) + typ + data + struct.pack(">I", zlib.crc32(typ+data) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8 bits, color-type 2 (RGB)
    with open(path, "wb") as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', comp) + chunk(b'IEND', b''))

HERE = os.path.dirname(os.path.abspath(__file__))
log = open(os.path.join(HERE, "test_captura_nro_log.txt"), "a", encoding="utf-8")
def p(s): print(s); log.write(s+"\n")

p("\n==================== TEST CAPTURA Nº VIAJE (GDI) %s ===================="%datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
# tamaño de pantalla, para saber si el layout es el esperado (1920x1080)
u = ctypes.windll.user32
p("Resolucion virtual: %dx%d"%(u.GetSystemMetrics(0), u.GetSystemMetrics(1)))
for nombre, (l,t,w,h) in (("nro_viaje_crop.png", CROP), ("nro_viaje_crop_full.png", CROP_FULL)):
    try:
        rows = capturar(l, t, w, h)
        ruta = os.path.join(HERE, nombre)
        guardar_png(w, h, rows, ruta)
        p("  OK  %s  (rect left=%d top=%d w=%d h=%d) -> %s"%(nombre, l, t, w, h, ruta))
    except Exception as e:
        p("  ERROR capturando %s: %r"%(nombre, e))
p("==== FIN. Pasale a Claude los PNG + este log. ====")
log.close()
