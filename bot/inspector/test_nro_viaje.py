# test_nro_viaje.py  --  SOLO LECTURA. ¿Se puede leer el Nº de viaje por software (Win32)?
#
# USO (correr DOS veces, una por pantalla):
#   1) Dejá abierta "Entrada de Viajes" con un viaje GRABADO (que se vea el Nº, p. ej. 00050961)
#      y corré test_nro_viaje.bat  -> genera test_nro_viaje_log.txt
#   2) Después dejá abierta "Entrada de Albaranes" de ese mismo viaje (que también muestra el Nº
#      de viaje, según Julio) y volvé a correrlo. El log se ACUMULA (append) con separador.
#
# No teclea, no graba, no toca datos: solo enumera ventanas y vuelca TODO control con texto.
# Objetivo: encontrar en QUÉ control (y en qué pantalla) aparece el Nº de viaje como texto legible.
import ctypes, re, datetime, os
u32 = ctypes.WinDLL('user32', use_last_error=True)
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
u32.GetWindowTextLengthW.argtypes=[ctypes.c_void_p]; u32.GetWindowTextLengthW.restype=ctypes.c_int
u32.GetWindowTextW.argtypes=[ctypes.c_void_p,ctypes.c_wchar_p,ctypes.c_int]; u32.GetWindowTextW.restype=ctypes.c_int
u32.GetClassNameW.argtypes=[ctypes.c_void_p,ctypes.c_wchar_p,ctypes.c_int]; u32.GetClassNameW.restype=ctypes.c_int
u32.EnumWindows.argtypes=[WNDENUMPROC,ctypes.c_void_p]; u32.EnumChildWindows.argtypes=[ctypes.c_void_p,WNDENUMPROC,ctypes.c_void_p]
u32.IsWindowVisible.argtypes=[ctypes.c_void_p]; u32.IsWindowVisible.restype=ctypes.c_bool
class RECT(ctypes.Structure): _fields_=[("l",ctypes.c_long),("t",ctypes.c_long),("r",ctypes.c_long),("b",ctypes.c_long)]
u32.GetWindowRect.argtypes=[ctypes.c_void_p,ctypes.POINTER(RECT)]; u32.GetWindowRect.restype=ctypes.c_bool
def _text(h):
    n=u32.GetWindowTextLengthW(h); b=ctypes.create_unicode_buffer(n+2); u32.GetWindowTextW(h,b,n+2); return b.value or ""
def _cls(h):
    b=ctypes.create_unicode_buffer(256); u32.GetClassNameW(h,b,256); return b.value or ""
def _rect(h):
    r=RECT(); u32.GetWindowRect(h,ctypes.byref(r)); return (r.l,r.t,r.r,r.b)
def all_hwnds():
    acc=[]
    def top(h,l):
        acc.append(h)
        def ch(c,l2): acc.append(c); return True
        u32.EnumChildWindows(h,WNDENUMPROC(ch),0); return True
    u32.EnumWindows(WNDENUMPROC(top),0); return acc

HERE=os.path.dirname(os.path.abspath(__file__))
out=open(os.path.join(HERE,"test_nro_viaje_log.txt"),"a",encoding="utf-8")
def p(s): print(s); out.write(s+"\n")

p("\n==================== TEST Nº VIAJE (Win32) %s ===================="%datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
# Pista: ¿qué ventana Gesruta está activa? (para saber en qué pantalla se corrió)
act=u32.GetForegroundWindow()
p("Ventana en primer plano: %r (clase=%s)"%(_text(act), _cls(act)))

# 1) Candidatos al patrón de Nº de viaje: 8 dígitos 0xxxxxxx
cands=[]
for h in all_hwnds():
    t=(_text(h) or "").strip()
    if re.fullmatch(r"0\d{7}", t): cands.append((t,_cls(h),_rect(h)))
p("--- Candidatos patron viaje (0+7 digitos): %d ---"%len(cands))
for t,c,r in cands: p("   '%s'  (clase=%s, rect=%s)"%(t,c,r))
uniq=list(dict.fromkeys([t for t,_,_ in cands]))
p("   UNICOS: %r"%uniq)
p("   => %s"%("OK: se leeria '%s'"%uniq[0] if len(uniq)==1 else "NO resuelto (0 o >1): el campo NO es legible por Win32 o hay varios"))

# 2) Todo control con texto numerico (4-12 digitos), por si el Nº tiene otro formato
p("--- Controles con texto numerico (4-12 digitos) ---")
seen=set()
for h in all_hwnds():
    t=(_text(h) or "").strip()
    if re.fullmatch(r"\d[\d ]{2,13}", t) and t not in seen:
        seen.add(t); p("   '%s'  (clase=%s, rect=%s)"%(t,_cls(h),_rect(h)))

# 3) VOLCADO COMPLETO: TODO control VISIBLE con texto (para ver si el Nº esta "escondido"
#    en un control con otro formato o junto a otra etiqueta). Esto es lo nuevo vs la version previa.
p("--- Volcado COMPLETO de controles visibles con texto ---")
n=0
for h in all_hwnds():
    if not u32.IsWindowVisible(h): continue
    t=(_text(h) or "").strip()
    if not t: continue
    cls=_cls(h)
    if cls.upper().startswith("TOOLTIP"): continue
    n+=1; p("   [%s] %r"%(cls, t[:120]))
p("   (total controles visibles con texto: %d)"%n)
p("==== FIN. Resultado en test_nro_viaje_log.txt (se acumula por cada corrida) ====")
out.close()
