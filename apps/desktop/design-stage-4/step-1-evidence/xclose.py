"""Ask the window to close, as a window manager's close button does (WM_DELETE_WINDOW). Nested display :99 only."""
import ctypes, sys, os
assert os.environ.get('DISPLAY') == ':99'
x = ctypes.CDLL('libX11.so.6'); x.XOpenDisplay.restype = ctypes.c_void_p; x.XInternAtom.restype = ctypes.c_ulong
d = ctypes.c_void_p(x.XOpenDisplay(b':99')); win = int(sys.argv[1], 16)
class CM(ctypes.Structure):
    _fields_ = [('type', ctypes.c_int), ('serial', ctypes.c_ulong), ('send_event', ctypes.c_int), ('display', ctypes.c_void_p),
                ('window', ctypes.c_ulong), ('message_type', ctypes.c_ulong), ('format', ctypes.c_int), ('l', ctypes.c_long * 5)]
class Ev(ctypes.Union): _fields_ = [('cm', CM), ('pad', ctypes.c_long * 24)]
e = Ev(); e.cm.type = 33; e.cm.window = win; e.cm.format = 32
e.cm.message_type = x.XInternAtom(d, b'WM_PROTOCOLS', 0); e.cm.l[0] = x.XInternAtom(d, b'WM_DELETE_WINDOW', 0); e.cm.l[1] = 0
x.XSendEvent(d, ctypes.c_ulong(win), 0, ctypes.c_long(0), ctypes.byref(e)); x.XFlush(d)
