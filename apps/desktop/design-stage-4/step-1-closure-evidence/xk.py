"""Send keys to the isolated nested X server only (DISPLAY must be :99). Usage: xkeys.py focus | key Tab shift+Tab Return | text 'abc'"""
import ctypes, sys, time, os, subprocess
assert os.environ.get('DISPLAY') == ':99', 'refusing: not the isolated display'
x=ctypes.CDLL('libX11.so.6'); t=ctypes.CDLL('libXtst.so.6')
x.XOpenDisplay.restype=ctypes.c_void_p; x.XKeysymToKeycode.restype=ctypes.c_ubyte
x.XStringToKeysym.restype=ctypes.c_ulong
d=x.XOpenDisplay(b':99'); assert d
def kc(name): 
    ks=x.XStringToKeysym(name.encode()); assert ks, name
    return x.XKeysymToKeycode(ctypes.c_void_p(d), ctypes.c_ulong(ks))
def press(name, mods=()):
    for m in mods: t.XTestFakeKeyEvent(ctypes.c_void_p(d), kc(m), 1, 0)
    t.XTestFakeKeyEvent(ctypes.c_void_p(d), kc(name), 1, 0); t.XTestFakeKeyEvent(ctypes.c_void_p(d), kc(name), 0, 0)
    for m in reversed(mods): t.XTestFakeKeyEvent(ctypes.c_void_p(d), kc(m), 0, 0)
    x.XFlush(ctypes.c_void_p(d)); time.sleep(0.25)
cmd=sys.argv[1]
if cmd=='focus':
    win=int(sys.argv[2],16)
    x.XSetInputFocus(ctypes.c_void_p(d), ctypes.c_ulong(win), 1, 0); x.XSync(ctypes.c_void_p(d),0)
elif cmd=='key':
    for k in sys.argv[2:]:
        parts=k.split('+'); mods={'shift':'Shift_L','ctrl':'Control_L','alt':'Alt_L'}; press(parts[-1], [mods[m] for m in parts[:-1]])
elif cmd=='text':
    for ch in sys.argv[2]:
        names={' ':'space','-':'minus'}; n=names.get(ch,ch)
        if ch.isupper(): press(n,['Shift_L'])
        else: press(n)
