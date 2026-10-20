# gastos_test.py  --  TEST ENFOCADO de la ventana GASTOS (choferes autonomos).
# Julio deja ABIERTA la ventana "Entrada de Albaranes" de un viaje de PRUEBA.
# El robot: abre Gastos -> por cada par (cargado, vacio) agrega una fila en
#   KILOMETROS (cantidad=cargado) y otra en KILOMETROS EN VACIO (cantidad=vacio).
# Mecanismo confirmado en vivo:
#   - Seleccionar concepto en la lista izquierda.
#   - F3 agrega una fila ABAJO, autocompletada (matricula/chofer/precio/fecha/concepto).
#   - La fila nueva es la ULTIMA de ese concepto (rejilla filtrada por concepto).
#   - CLIC en la celda Cantidad -> teclear -> Enter (reemplaza el "1" y calcula Importe).
#   - El Tab NO lleva a Cantidad: por eso se clickea la celda.
# SEGURIDAD: SAVE=False -> NO toca el disquete; las filas quedan sin guardar para
#   que Julio verifique y cierre sin guardar. "no inventar, fallar ruidoso".

import json, ctypes, time, sys, os, datetime

VERSION = "gastos-test-1"
try: ctypes.windll.user32.SetProcessDPIAware()
except Exception: pass
import pygetwindow as gw
import pyautogui, pyperclip
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.30

HERE = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(HERE, "gastos_log.txt")
_logf = open(LOG_PATH, "w", encoding="utf-8")
def log(s):
    line = "[%s] %s" % (datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3], s)
    print(line); _logf.write(line+"\n"); _logf.flush()
def caps_off():
    try:
        if ctypes.windll.user32.GetKeyState(0x14) & 1: pyautogui.press('capslock'); time.sleep(0.2)
    except Exception: pass

# ================== PARES DE PRUEBA (cargado, vacio) por albaran ==================
# Cambia estos valores libremente. Son solo para validar el mecanismo.
PARES = [ (1200, 120), (1170, 130) ]
SAVE = False     # False = NO guarda (deja las filas para verificar y cerrar sin guardar)
# ==================================================================================

# ---- Coordenadas 1920x1080 (ventana Gastos MAXIMIZADA) ----
GASTOS_BTN = (1827, 108)      # boton "Gastos" en la barra de Entrada de Albaranes
G_KILOMETROS = (80, 386)      # concepto KILOMETROS en la lista izquierda
G_KM_VACIO   = (80, 360)      # concepto KILOMETROS EN VACIO
G_ADD_BTN = (310, 953)        # "hoja blanca" = Anadir un registro nuevo (en vez de F3)
G_CANT_X = 690                # x de la celda Cantidad
G_ROW1_Y = 184               # y de la fila 1
G_ROWH   = 28                # alto de fila
# Guardar/finalizar = F2 (segun Julio). Disquete queda como alternativa manual.
G_SAVE   = (26, 1007)

def cant_xy(row_idx):  # row_idx 0-based dentro del concepto
    return (G_CANT_X, G_ROW1_Y + row_idx*G_ROWH)

# ---- infra ventanas (Win32) ----
u32 = ctypes.WinDLL('user32', use_last_error=True)
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
u32.GetWindowTextLengthW.argtypes=[ctypes.c_void_p]; u32.GetWindowTextLengthW.restype=ctypes.c_int
u32.GetWindowTextW.argtypes=[ctypes.c_void_p,ctypes.c_wchar_p,ctypes.c_int]; u32.GetWindowTextW.restype=ctypes.c_int
u32.GetClassNameW.argtypes=[ctypes.c_void_p,ctypes.c_wchar_p,ctypes.c_int]; u32.GetClassNameW.restype=ctypes.c_int
u32.EnumWindows.argtypes=[WNDENUMPROC,ctypes.c_void_p]; u32.EnumChildWindows.argtypes=[ctypes.c_void_p,WNDENUMPROC,ctypes.c_void_p]
def _text(h):
    n=u32.GetWindowTextLengthW(h); b=ctypes.create_unicode_buffer(n+2); u32.GetWindowTextW(h,b,n+2); return b.value or ""
def _cls(h):
    b=ctypes.create_unicode_buffer(256); u32.GetClassNameW(h,b,256); return b.value or ""
def all_hwnds():
    acc=[]
    def top(h,l):
        acc.append(h)
        def ch(c,l2): acc.append(c); return True
        u32.EnumChildWindows(h,WNDENUMPROC(ch),0); return True
    u32.EnumWindows(WNDENUMPROC(top),0); return acc
def has_window(substr):
    su=substr.upper()
    for h in all_hwnds():
        if "TOOLTIP" in _cls(h).upper(): continue
        if su in (_text(h) or "").upper(): return True
    return False
def find_kw(kws):
    for h in all_hwnds():
        if "TOOLTIP" in _cls(h).upper(): continue
        t=_text(h); tu=t.upper()
        if tu.startswith("GESRUTA VR"): continue
        if any(k in tu for k in kws): return h,t
    return None,None

def ges_main():
    for w in gw.getAllWindows():
        if (w.title or "").upper().startswith("GESRUTA VR"): return w
    return None
def active_title():
    try:
        a=gw.getActiveWindow(); return (a.title if a else "") or ""
    except Exception: return ""
def is_ges_active(): return "GESRUTA" in active_title().upper()
def ensure_ges():
    for _ in range(5):
        if is_ges_active(): return True
        w=ges_main()
        if w:
            try: w.activate()
            except Exception: pass
        pyautogui.click(400,10); time.sleep(0.4)
    return is_ges_active()

def gastos_front():
    """Trae/activa la ventana Gastos si existe."""
    for h in all_hwnds():
        if _text(h).strip().upper()=="GASTOS" and "TOOLTIP" not in _cls(h).upper():
            try: ctypes.windll.user32.SetForegroundWindow(h)
            except Exception: pass
            time.sleep(0.2); return True
    return is_ges_active()

def add_row(concept_xy, concept_name, row_idx, cantidad):
    """Selecciona concepto, F3, clic en Cantidad de la fila nueva, teclea y Enter."""
    gastos_front()
    pyautogui.moveTo(*concept_xy,duration=0.12); time.sleep(0.1); pyautogui.click(*concept_xy); time.sleep(0.5)
    log("  concepto %s seleccionado"%concept_name)
    # Abrir fila con la HOJA BLANCA (no F3: la tecla se pierde si el foco no esta exacto en Gastos)
    pyautogui.moveTo(*G_ADD_BTN,duration=0.12); time.sleep(0.1); pyautogui.click(*G_ADD_BTN); time.sleep(0.9)
    log("  hoja-blanca -> fila nueva (idx %d) en %s"%(row_idx,concept_name))
    # Ir a Cantidad: clic directo en la celda de la fila nueva
    cx,cy=cant_xy(row_idx)
    pyautogui.moveTo(cx,cy,duration=0.12); time.sleep(0.1); pyautogui.click(cx,cy); time.sleep(0.3)
    pyautogui.write(str(cantidad),interval=0.05); time.sleep(0.2)
    pyautogui.press('enter'); time.sleep(0.5)
    log("  -> Cantidad(%s) = %s [Enter]  @ (%d,%d)"%(concept_name,cantidad,cx,cy))

try:
    log("==== GASTOS TEST %s ===="%VERSION)
    log("Pares (cargado,vacio): %r | SAVE=%s"%(PARES,SAVE))
    w=ges_main()
    if not w: log("ABORTO: no encuentro Gesruta."); sys.exit(1)
    try:
        if w.isMinimized: w.restore()
        w.maximize(); w.activate()
    except Exception as e: log("aviso foco %r"%e)
    time.sleep(0.8); ensure_ges(); caps_off()

    if not has_window("ENTRADA DE ALBARANES"):
        log("ABORTO: deja ABIERTA la ventana 'Entrada de Albaranes' de un viaje de prueba."); sys.exit(1)

    # abrir Gastos
    log("--- abrir Gastos ---")
    ensure_ges(); pyautogui.moveTo(*GASTOS_BTN,duration=0.15); time.sleep(0.1); pyautogui.click(*GASTOS_BTN); time.sleep(1.0)
    t0=time.time(); ok=False
    while time.time()-t0<8:
        if has_window("GASTOS"): ok=True; break
        time.sleep(0.3)
    if not ok: log("ABORTO: no abrio la ventana Gastos (boton tapado? ventana no maximizada?)."); sys.exit(1)
    log("  ventana Gastos abierta")
    time.sleep(0.5)

    # cargar filas: por cada albaran una fila KILOMETROS y una KM EN VACIO
    for i,(carga,vacio) in enumerate(PARES):
        log("##### ALBARAN idx %d : cargado=%s vacio=%s #####"%(i,carga,vacio))
        add_row(G_KILOMETROS, "KILOMETROS",        i, carga)
        add_row(G_KM_VACIO,   "KILOMETROS EN VACIO", i, vacio)

    if SAVE:
        log("--- FINALIZAR con F2 ---")
        gastos_front(); time.sleep(0.3); pyautogui.press('f2'); time.sleep(1.2)
        h,t=find_kw(("AVISO","ATENCION","ATENCIÓN","GRABAR"))
        if h: log("  aviso tras F2: %r (revisa a mano)"%t)
        log("  F2 enviado (revisar)")
    else:
        log("--- SAVE=False: NO guardo. Verifica la rejilla y cerra Gastos SIN guardar. ---")
    log("==== FIN gastos test. Revisa gastos_log.txt y la pantalla. ====")
finally:
    _logf.close()
