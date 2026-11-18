"""Read the webview's localStorage for the app origin from a COPY of its sqlite files (read-only on the original)."""
import sqlite3, shutil, glob, os, tempfile, sys
G = os.path.dirname(os.path.abspath(__file__))
src = glob.glob(f'{G}/xdg/data/dev.engineering-learning-environment.desktop/localstorage/tauri_localhost_0.localstorage')
if not src: print('NO localstorage file'); sys.exit(0)
d = tempfile.mkdtemp()
for ext in ('', '-wal', '-shm'):
    if os.path.exists(src[0] + ext): shutil.copy(src[0] + ext, os.path.join(d, 'db.localstorage' + ext))
c = sqlite3.connect(os.path.join(d, 'db.localstorage')); rows = c.execute('select key, value from ItemTable').fetchall()
def dec(v): return v.decode('utf-16le') if isinstance(v, (bytes, bytearray)) else v
print('items:', [(k, dec(v)) for k, v in rows] or 'none (table empty)')
