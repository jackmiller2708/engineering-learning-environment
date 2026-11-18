#!/usr/bin/env python3
"""usage: render.py <abs-out.png> <width> <height> <url>
Headless Firefox in a throwaway profile. Renders 16px larger and crops, because headless Firefox leaves an
unpainted strip at the right and bottom edge."""
import subprocess, sys, tempfile, os
from PIL import Image
out, w, h, url = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
with tempfile.TemporaryDirectory() as d:
    shot = os.path.join(d, 's.png')
    subprocess.run(['firefox', '--headless', '--no-remote', '--profile', os.makedirs(os.path.join(d,'p')) or os.path.join(d, 'p'), '--screenshot', shot,
                    f'--window-size={w+16},{h+16}', url + ('&' if '?' in url else '?') + f'fw={w}&fh={h}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
    Image.open(shot).convert('RGB').crop((0, 0, w, h)).save(out)
