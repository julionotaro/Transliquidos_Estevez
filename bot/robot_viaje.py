# robot_viaje.py  --  VIAJE MULTI-ALBARAN.  GRABA de verdad.
# Julio deja el viaje con matriculas cargadas y el PRIMER albaran en blanco abierto.
# El robot llena/graba cada albaran, usa F3 para el siguiente, y F2 para grabar el viaje.
# Si un km aborta (vacio fuera de rango, etc.), se DETIENE la cadena y NO graba el viaje.
# Secuencia KM/grabado confirmada en vivo:
#   Kilometros -> Si -> Si -> (form) leer Tacografo, calcular;
#   Km carga: Ctrl+A+valor+Tab ; Km vacio: Ctrl+A+valor+Enter (autocompleta Bonificable carga);
#   click Bonificable carga + Enter (autocompleta Bonificable vacio);
#   disquete del formulario (graba km, cierra) ; disquete del albaran (graba albaran).
#   Regla km:  Km carga = fin - inicio (cargado) ;  Km vacio = inicio_real - Tacografo.
#   inicio_real se reconstruye del tacografo (el chofer escribe los ultimos N digitos).

import json, ctypes, time, sys, os, datetime

VERSION = "viaje-1"
try:
    ctypes.windll.user32.SetProcessDPIAware()
except Exception:
    pass
import pygetwindow as gw
import pyautogui, pyperclip

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.30

HERE = os.path.dirname(os.path.abspath(__file__))
ORDEN_PATH = os.path.join(HERE, "orden_actual.json")
LOG_PATH = os.path.join(HERE, "robot_log.txt")
_logf = open(LOG_PATH, "w", encoding="utf-8")
def log(s):
    line = "[%s] %s" % (datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3], s)
    print(line); _logf.write(line+"\n"); _logf.flush()
def caps_off():
    try:
        if ctypes.windll.user32.GetKeyState(0x14) & 1:
            pyautogui.press('capslock'); time.sleep(0.2)
    except Exception: pass

# ---- Coordenadas 1920x1080 ----
C_REFE=(590,180); C_CLIENTE=(130,234); C_ORIGEN=(124,259); C_DESTINO=(124,286)
C_CARGA=(124,337); C_SALIDA=(125,418); C_LLEGADA=(125,481)
LINEAS_TAB=(318,151); ADD_LINE=(1878,181)
L_CANT1=(393,200); L_PRECIO1=(524,200)
L_CDGO2=(40,226); L_CANT2=(393,226); L_PRECIO2=(524,226)
KILOMETROS_BTN=(1878,105)
K_NUEVA_LECTURA=(922,407); K_TACOGRAFO=(1037,407); K_CARGA=(975,485); K_VACIO=(1035,485)
K_BONIF_CARGA=(1229,487); K_SAVE=(632,638)
ALB_SAVE=(49,1005)
NUEVO_ALB_BTN=(1878,332)   # hoja blanca 'Anadir nuevo' en Entrada de Viajes

RISK_KW=("RIESGO","SITUAC"); INFO_KW=("AVISO","ATENCION","ATENCIÓN")  # quitado "CONSULTA": matcheaba "Consulta de Albaranes" (ventana normal)
ALL_KW=RISK_KW+INFO_KW; WM_CLOSE=0x0010; GA_ROOT=2

u32 = ctypes.WinDLL('user32', use_last_error=True)
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
u32.GetWindowTextLengthW.argtypes=[ctypes.c_void_p]; u32.GetWindowTextLengthW.restype=ctypes.c_int
u32.GetWindowTextW.argtypes=[ctypes.c_void_p,ctypes.c_wchar_p,ctypes.c_int]; u32.GetWindowTextW.restype=ctypes.c_int
u32.GetClassNameW.argtypes=[ctypes.c_void_p,ctypes.c_wchar_p,ctypes.c_int]; u32.GetClassNameW.restype=ctypes.c_int
u32.EnumWindows.argtypes=[WNDENUMPROC,ctypes.c_void_p]; u32.EnumChildWindows.argtypes=[ctypes.c_void_p,WNDENUMPROC,ctypes.c_void_p]
u32.PostMessageW.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_void_p,ctypes.c_void_p]
u32.SetForegroundWindow.argtypes=[ctypes.c_void_p]
u32.GetAncestor.argtypes=[ctypes.c_void_p,ctypes.c_uint]; u32.GetAncestor.restype=ctypes.c_void_p
class RECT(ctypes.Structure):
    _fields_=[("left",ctypes.c_long),("top",ctypes.c_long),("right",ctypes.c_long),("bottom",ctypes.c_long)]
u32.GetWindowRect.argtypes=[ctypes.c_void_p, ctypes.POINTER(RECT)]
def _text(h):
    n=u32.GetWindowTextLengthW(h); b=ctypes.create_unicode_buffer(n+2); u32.GetWindowTextW(h,b,n+2); return b.value or ""
def _cls(h):
    b=ctypes.create_unicode_buffer(256); u32.GetClassNameW(h,b,256); return b.value or ""
def _rect(h):
    r=RECT(); u32.GetWindowRect(h,ctypes.byref(r)); return r
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
        if su in (_text(h) or "").upper(): return True
    return False
def find_kw(kws):
    for h in all_hwnds():
        if "TOOLTIP" in _cls(h).upper(): continue   # ignorar globos de ayuda (p.ej. 'Guardar los datos actuales [F2]')
        t=_text(h); tu=t.upper()
        if tu.startswith("GESRUTA VR"): continue
        if any(k in tu for k in kws): return h,t
    return None,None
def click_si(dh):
    btns=[]
    def cb(ch,l):
        if "BUTTON" in _cls(ch).upper(): btns.append((ch,_text(ch)))
        return True
    u32.EnumChildWindows(dh,WNDENUMPROC(cb),0)
    for ch,t in btns:
        if t.upper().replace('&','').strip().startswith('S'):
            r=_rect(ch); pyautogui.click((r.left+r.right)//2,(r.top+r.bottom)//2); log("     click Si %r"%t); return True
    return False
def handle_si(timeout,tag):
    t0=time.time()
    while time.time()-t0<timeout:
        h,t=find_kw(ALL_KW+("GRABAR","CONVERTIR","PEDIDO"))
        if h:
            log("  [%s] dialogo %r"%(tag,t))
            if click_si(h): time.sleep(0.8); return True
        time.sleep(0.3)
    return False

def open_km_form(timeout):
    """Despeja dialogos (Si en grabar/convertir, Esc en avisos) hasta que abra el form de km."""
    t0=time.time()
    while time.time()-t0<timeout:
        if find_kw(("KILOMETRO",))[0]: return True
        h,t=find_kw(ALL_KW+("GRABAR","CONVERTIR","PEDIDO"))
        if h:
            if click_si(h):
                log("    dialogo %r -> Si"%t); time.sleep(0.9); continue
            log("    aviso %r -> Esc"%t); pyautogui.press('esc'); time.sleep(0.6)
            if find_kw(ALL_KW)[0]: pyautogui.press('enter'); time.sleep(0.4)
            continue
        time.sleep(0.3)
    return bool(find_kw(("KILOMETRO",))[0])

def ges_main():
    for w in gw.getAllWindows():
        if (w.title or "").upper().startswith("GESRUTA VR"): return w
    return None
def active_title():
    try:
        a=gw.getActiveWindow(); return (a.title if a else "") or ""
    except Exception as e: return "<err:%r>"%e
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

def find_dialog():
    for h in all_hwnds():
        if "TOOLTIP" in _cls(h).upper(): continue
        t=_text(h)
        if not t: continue
        tu=t.upper()
        if tu.startswith("GESRUTA VR"): continue
        if any(k in tu for k in ALL_KW): return h,t
    return None,None
def wait_and_close(appear_timeout, tag):
    t0=time.time(); appeared=False
    while True:
        h,title=find_dialog()
        if h:
            appeared=True; log("  [%s] ventana: %r -> cerrando"%(tag,title))
            pyautogui.press('esc'); time.sleep(0.7)
            if not find_dialog()[0]: ensure_ges(); return True
            try: u32.PostMessageW(h,WM_CLOSE,0,0)
            except Exception: pass
            time.sleep(0.7)
            if not find_dialog()[0]: ensure_ges(); return True
            try:
                root=u32.GetAncestor(h,GA_ROOT); u32.SetForegroundWindow(root)
            except Exception: pass
            time.sleep(0.3); pyautogui.press('esc'); time.sleep(0.7)
            if not find_dialog()[0]: ensure_ges(); return True
            pyautogui.press('enter'); time.sleep(0.7)
            if not find_dialog()[0]: ensure_ges(); return True
            if time.time()-t0>appear_timeout+15: return False
            continue
        if appeared: ensure_ges(); return True
        if time.time()-t0>appear_timeout: return True
        time.sleep(0.3)

def field(xy,val,label,click="single",tab=False,clear=False):
    x,y=xy; ok=False
    for i in range(4):
        ensure_ges()
        pyautogui.moveTo(x,y,duration=0.12); time.sleep(0.1)
        (pyautogui.tripleClick if click=="triple" else pyautogui.click)(x,y); time.sleep(0.25)
        if is_ges_active(): ok=True; break
    if clear:
        # SOLO teclas simples (Backspace/Supr). NUNCA Ctrl+A ni End (se portan mal en Gesruta).
        for _ in range(8): pyautogui.press('backspace')
        for _ in range(8): pyautogui.press('delete')
        time.sleep(0.15)
    pyautogui.write(val,interval=0.05)
    if tab: time.sleep(0.2); pyautogui.press('tab')
    time.sleep(0.3); log("  -> %s: '%s'%s"%(label,val,"  [vaciado]" if clear else ""))
def type_sel(val,label,tab=True):
    # Escribe sobre el campo que YA tiene foco por Tab (contenido SELECCIONADO -> reemplaza). SIN clic ni borrado.
    pyautogui.write(str(val),interval=0.05)
    if tab: time.sleep(0.2); pyautogui.press('tab')
    time.sleep(0.3); log("  -> %s (sobre seleccion): '%s'"%(label,val))
def grid_click(xy,label):
    x,y=xy; ensure_ges(); pyautogui.moveTo(x,y,duration=0.12); time.sleep(0.1); pyautogui.click(x,y); time.sleep(0.3); log("  clic %s"%label)
def grid_type(xy,val,label,confirm=False):
    x,y=xy; ensure_ges(); pyautogui.moveTo(x,y,duration=0.12); time.sleep(0.1); pyautogui.click(x,y); time.sleep(0.25)
    pyautogui.write(str(val),interval=0.05)
    if confirm: time.sleep(0.2); pyautogui.press('tab')
    time.sleep(0.3); log("  -> %s: '%s'%s"%(label,val,"  [Tab]" if confirm else ""))

# ---- helpers KM (foco = formulario, click directo) ----
def km_front():
    h,_=find_kw(("KILOMETRO",))
    if h:
        try: u32.SetForegroundWindow(h)
        except Exception: pass
        time.sleep(0.2)
    return h
def to_int(s):
    d=''.join(c for c in (s or "") if c.isdigit()); return int(d) if d else None
def km_read(xy,label):
    x,y=xy; pyperclip.copy("<<x>>"); km_front()
    pyautogui.moveTo(x,y,duration=0.12); time.sleep(0.1); pyautogui.click(x,y); time.sleep(0.2)
    pyautogui.hotkey('ctrl','a'); time.sleep(0.1); pyautogui.hotkey('ctrl','c'); time.sleep(0.3)
    raw=pyperclip.paste(); v=to_int(raw); log("  leer %-14s -> raw=%r int=%r"%(label,raw,v)); return v
def km_type(xy,val,label,commit='tab'):
    x,y=xy; km_front()
    pyautogui.moveTo(x,y,duration=0.12); time.sleep(0.1); pyautogui.click(x,y); time.sleep(0.2)
    pyautogui.hotkey('ctrl','a'); time.sleep(0.1); pyautogui.write(str(val),interval=0.05)
    time.sleep(0.2)
    if commit=='tab': pyautogui.press('tab')
    elif commit=='enter': pyautogui.press('enter')
    time.sleep(0.3); log("  -> %s = %s [%s]"%(label,val,commit))
def num(v):
    # quita separador de miles (punto); conserva la coma decimal. '1.659,94' -> '1659,94'
    return str(v).replace('.','')
def _km_raw(xy):
    x,y=xy; pyperclip.copy("<<vacio>>"); km_front()
    pyautogui.moveTo(x,y,duration=0.12); time.sleep(0.1); pyautogui.click(x,y); time.sleep(0.2)
    pyautogui.hotkey('ctrl','a'); time.sleep(0.1); pyautogui.hotkey('ctrl','c'); time.sleep(0.3)
    return pyperclip.paste()
def read_tacografo():
    # Lee un ODOMETRO valido. Descarta fechas/horas ('/' o ':') y valores fuera de rango.
    for attempt in range(4):
        for xy,nm in ((K_NUEVA_LECTURA,"NuevaLectura"),(K_TACOGRAFO,"Tacografo")):
            raw=_km_raw(xy)
            d=''.join(c for c in (raw or "") if c.isdigit())
            v=int(d) if d else None
            ok = (raw is not None) and ('/' not in raw) and (':' not in raw) and (v is not None) and (1000<=v<=99999999)
            log("  leer Tacografo[%s] intento %d -> raw=%r -> %s"%(nm,attempt+1,raw,("OK %d"%v if ok else "DESCARTADO")))
            if ok: return v
        time.sleep(0.8)
    return None
def reconstruct(ficha,T):
    cv=int(str(ficha).replace('.','').replace(',','').strip()); n=len(str(cv)); mod=10**n
    base=(T//mod)*mod; cand=base+cv
    if cand<T: cand+=mod
    return cand

def do_albaran(alb, n):
    """Llena cabecera+lineas+km y graba UN albaran. True=grabado, False=aborto (parar cadena)."""
    cli=alb.get("cliente",{}) or {}
    log("##### ALBARAN idx %d : %s #####"%(n, cli.get("esperado","")))
    if "_bloqueo" in alb: log("  ABORTO: albaran BLOQUEADO: %s"%alb["_bloqueo"]); return False
    ref=alb.get("referencia","") or ""; salida=alb.get("salida","") or ""; llegada=alb.get("llegada","") or ""
    ori=alb.get("origen",{}) or {}; des=alb.get("destino",{}) or {}; car=alb.get("carga",{}) or {}
    lineas=alb.get("lineas",{}) or {}; porte=lineas.get("porte") or {}; index=lineas.get("indexacion")
    km=alb.get("km",{}) or {}; tarifa_pend=bool(alb.get("tarifa_pendiente"))

    ensure_ges()
    if find_dialog()[0]: log("  ABORTO: dialogo abierto antes de cabecera: %r"%(find_dialog()[1],)); return False

    # ---- CABECERA ----
    if ref:     field(C_REFE, ref, "Refe")
    if salida:  field(C_SALIDA, salida, "FechaSalida", click="triple")
    if llegada: field(C_LLEGADA, llegada, "FechaLlegada", click="triple")
    # Cliente: campo vacio en albaran nuevo -> clic + escribir. Tras Tab aparece aviso/riesgo.
    if cli.get("codigo"):
        field(C_CLIENTE, cli["codigo"], "Cliente", tab=True)
        wait_and_close(6.0,"cliente")
        # IMPORTANTE: esperar a que el aviso/ventana de riesgo cierre del TODO antes de seguir
        _t0=time.time()
        while time.time()-_t0<5:
            if not find_dialog()[0]: break
            time.sleep(0.3)
        time.sleep(1.0); ensure_ges(); time.sleep(0.4)   # cierra aviso/ventana riesgo; el foco queda en Origen SELECCIONADO
    # Origen: Gesruta lo autocompleta y queda SELECCIONADO tras el Tab del cliente -> escribir reemplaza. SIN clic.
    if ori.get("codigo"):
        type_sel(ori["codigo"], "Origen"); wait_and_close(1.2,"post-origen")
    else:
        pyautogui.press('tab'); time.sleep(0.3); log("  origen sin codigo: dejo default de Gesruta y Tab a Destino")
    # Destino: tras el Tab de Origen queda SELECCIONADO -> escribir reemplaza. SIN clic.
    if des.get("codigo"):
        field(C_DESTINO, des["codigo"], "Destino", tab=True); wait_and_close(1.2,"post-destino")
    elif des.get("buscar"): log("  Destino BUSCADOR (%r) no calibrado -> salto"%des.get("buscar"))
    # Carga: NO esta en la secuencia Tab (hay campos intermedios) -> clic por coordenada. Campo vacio: escribir va bien.
    if car.get("codigo"):
        field(C_CARGA, car["codigo"], "Carga", tab=True); wait_and_close(1.2,"post-carga")
    elif car.get("buscar"): log("  Carga BUSCADOR (%r) no calibrado -> salto"%car.get("buscar"))

    # ---- LINEAS ----
    if tarifa_pend:
        log("  TARIFA PENDIENTE -> flujo aparte, no construido. Paro cadena."); return False
    elif porte:
        grid_click(LINEAS_TAB,"solapa Lineas"); time.sleep(0.4)
        grid_click(ADD_LINE,"add porte"); time.sleep(0.6)
        if str(porte.get("um","TN")).upper()=="UN": log("  OJO: UM=UN no calibrado -> queda TN")
        grid_type(L_CANT1, num(porte.get("cantidad","")), "Cantidad porte")
        grid_type(L_PRECIO1, num(porte.get("precio","")), "Precio porte", confirm=True)
        if index:
            grid_click(ADD_LINE,"add indexacion"); time.sleep(0.6)
            grid_type(L_CDGO2, str(index.get("concepto","")).upper(), "Cdgo index", confirm=True)
            grid_type(L_CANT2, num(index.get("cantidad","")), "Cantidad index")
            grid_type(L_PRECIO2, num(index.get("factor","")), "Precio index", confirm=True)
        else: log("  sin indexacion")
    else:
        log("  sin porte en la orden -> paro cadena."); return False

    # ---- KM + GRABADO ----
    f_inicio=km.get("inicio"); f_fin=km.get("fin")
    if f_inicio is None or f_fin is None:
        log("  sin km.inicio/fin -> paro cadena."); return False
    log("  --- KM ---  Ficha inicio=%r fin=%r"%(f_inicio,f_fin))
    ensure_ges()
    pyautogui.moveTo(*KILOMETROS_BTN,duration=0.12); time.sleep(0.1); pyautogui.click(*KILOMETROS_BTN); time.sleep(0.6)
    if not open_km_form(16.0):
        log("  ABORTO: no se abrio el formulario de km (dialogos no despejados)."); return False
    global K_NUEVA_LECTURA,K_TACOGRAFO,K_CARGA,K_VACIO,K_BONIF_CARGA,K_SAVE
    _hk=find_kw(("KILOMETRO",))[0]
    if _hk:
        _r=_rect(_hk)
        # ANCLAR coords a la esquina de la ventana (offsets medidos: ventana L=573,T=332)
        K_NUEVA_LECTURA=(_r.left+349,_r.top+75); K_TACOGRAFO=(_r.left+464,_r.top+75)
        K_CARGA=(_r.left+402,_r.top+153); K_VACIO=(_r.left+462,_r.top+153)
        K_BONIF_CARGA=(_r.left+656,_r.top+155); K_SAVE=(_r.left+59,_r.top+306)
        log("  [km-win] L=%d T=%d -> ANCLADO: NL=%r CARGA=%r VACIO=%r BONIF=%r SAVE=%r"%(_r.left,_r.top,K_NUEVA_LECTURA,K_CARGA,K_VACIO,K_BONIF_CARGA,K_SAVE))
    else:
        log("  AVISO: no obtuve rect de la ventana km; uso coords fijas por defecto")
    km_front(); time.sleep(0.4)
    T=read_tacografo()
    if T is None: log("  ABORTO: no pude leer un Tacografo valido (lei fecha/vacio). NO grabo."); return False
    real_inicio=reconstruct(f_inicio,T)
    loaded=int(str(f_fin).replace('.',''))-int(str(f_inicio).replace('.',''))
    real_fin=real_inicio+loaded
    km_carga=loaded; km_vacio=real_inicio-T
    log("  Tacografo=%d real_inicio=%d real_fin=%d => carga=%d vacio=%d"%(T,real_inicio,real_fin,km_carga,km_vacio))
    if km_vacio<0 or km_vacio>2000:
        log("  ABORTO: km vacio implausible (%d). Ficha/odometro no coinciden. NO grabo."%km_vacio); return False
    if km_carga<0 or km_carga>5000:
        log("  ABORTO: km carga implausible (%d). NO grabo."%km_carga); return False
    km_type(K_CARGA, km_carga, "Km carga", commit='tab')
    km_type(K_VACIO, km_vacio, "Km vacio", commit='enter')   # -> Bonificable carga auto
    km_front(); pyautogui.moveTo(*K_BONIF_CARGA,duration=0.12); time.sleep(0.1); pyautogui.click(*K_BONIF_CARGA); time.sleep(0.2)
    pyautogui.press('enter'); time.sleep(0.4); log("  Enter Bonificable (autocompleta vacio)")
    log("  (no toco Nueva lectura; esperado Nueva lectura=%d)"%real_fin)
    km_front(); pyautogui.moveTo(*K_SAVE,duration=0.12); time.sleep(0.1); pyautogui.click(*K_SAVE); time.sleep(1.2)
    handle_si(2.5,"post-km")
    if find_kw(("KILOMETRO",))[0]: log("  AVISO: el form de km sigue abierto")
    ensure_ges(); time.sleep(0.3)
    pyautogui.moveTo(*ALB_SAVE,duration=0.12); time.sleep(0.1); pyautogui.click(*ALB_SAVE); time.sleep(1.2)
    handle_si(2.5,"post-albaran")
    log("  >>> ALBARAN idx %d GRABADO. activa=%r"%(n, active_title()))
    return True

try:
    log("==== ROBOT VIAJE %s ===="%VERSION)
    orden=json.load(open(ORDEN_PATH,encoding="utf-8"))
    albs=orden.get("albaranes",[]) or []
    viaje=orden.get("viaje",{}) or {}
    sel=orden.get("procesar_indices")
    albs_idx=[i for i in sel if 0<=i<len(albs)] if sel else list(range(len(albs)))
    log("Empresa=%r | viaje cabeza=%r | %d albaranes a procesar: %s"%(orden.get("empresa"),viaje.get("cabeza"),len(albs_idx),albs_idx))
    if not albs_idx: log("ABORTO: no hay albaranes"); sys.exit(1)

    w=ges_main()
    if not w: log("ABORTO: no encuentro Gesruta."); sys.exit(1)
    try:
        if w.isMinimized: w.restore()
        w.maximize(); w.activate()
    except Exception as e: log("  aviso foco: %r"%e)
    time.sleep(0.8)
    for _ in range(3): ensure_ges(); time.sleep(0.3)
    caps_off()
    if not is_ges_active(): log("ABORTO: Gesruta no al frente"); sys.exit(1)
    if find_dialog()[0]: log("ABORTO: dialogo abierto al empezar: %r"%(find_dialog()[1],)); sys.exit(1)

    v=viaje.get("verificar",{}) or {}
    log("VIAJE esperado (Julio lo deja cargado): matricula=%r remolque=%r chofer=%r"%(v.get("matricula"),v.get("remolque"),v.get("chofer")))

    grabados=0; total=len(albs_idx)
    for pos,i in enumerate(albs_idx):
        if pos>0:
            ensure_ges()
            # tras grabar el albaran anterior debemos estar en "Entrada de Viajes"
            vt0=time.time(); inviajes=False
            while time.time()-vt0<5:
                if has_window("ENTRADA DE VIAJES"): inviajes=True; break
                time.sleep(0.3)
            if not inviajes:
                log("ABORTO: tras grabar no estoy en 'Entrada de Viajes'; no creo albaran nuevo a ciegas."); break
            log("--- NUEVO ALBARAN idx %d: click 'Anadir nuevo' (hoja blanca) ---"%i)
            pyautogui.moveTo(*NUEVO_ALB_BTN,duration=0.15); time.sleep(0.1); pyautogui.click(*NUEVO_ALB_BTN)
            # el formulario de albaran abre con retardo
            at0=time.time(); abierto=False
            while time.time()-at0<6:
                if has_window("ENTRADA DE ALBARANES"): abierto=True; break
                time.sleep(0.3)
            if not abierto:
                log("ABORTO: no se abrio 'Entrada de Albaranes' tras 'Anadir nuevo'."); break
            time.sleep(1.0); ensure_ges(); time.sleep(0.3)
        ok=do_albaran(albs[i], i)
        if not ok:
            log("### CADENA DETENIDA en albaran idx %d. Reviso antes de seguir. NO grabo viaje. ###"%i); break
        grabados+=1

    log("Albaranes grabados: %d de %d"%(grabados,total))
    if grabados==total and grabados>0:
        ensure_ges(); time.sleep(0.3)
        log("--- F2: grabar VIAJE ---")
        pyautogui.press('f2'); time.sleep(1.2)
        handle_si(3.0,"grabar viaje?")
        log("  viaje grabado. activa=%r"%active_title())
    else:
        log("NO grabo el viaje (F2): no se completaron todos los albaranes.")
    log("==== FIN robot viaje. ====")
finally:
    _logf.close()
