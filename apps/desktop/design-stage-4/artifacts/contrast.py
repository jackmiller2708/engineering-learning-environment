#!/usr/bin/env python3
"""Computes WCAG 2 contrast ratios for token pairs in prototype/proto.css (base tokens, direction B).
A numeric check of design tokens only. It is not a conformance claim."""
import re, math, sys
css = open(sys.argv[1]).read().split('/* ===== exploration')[0]
tok = {}
for m in re.finditer(r'--([\w-]+):\s*light-dark\(\s*oklch\(([^)]*)\)\s*,\s*oklch\(([^)]*)\)\s*\)', css):
    tok[m.group(1)] = (m.group(2), m.group(3))
for m in re.finditer(r'--([\w-]+):\s*oklch\(([^)/]*)\)\s*;', css):
    tok.setdefault(m.group(1), (m.group(2), m.group(2)))
def lin(c): return c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4
def to_srgb(s):
    L, C, h = [float(x) for x in s.split()]; a = C*math.cos(math.radians(h)); b = C*math.sin(math.radians(h))
    l_=L+.3963377774*a+.2158037573*b; m_=L-.1055613458*a-.0638541728*b; s_=L-.0894841775*a-1.2914855480*b
    l,m,s=l_**3,m_**3,s_**3
    r= 4.0767416621*l-3.3077115913*m+.2309699292*s; g=-1.2684380046*l+2.6097574011*m-.3413193965*s; bb=-.0041960863*l-.7034186147*m+1.7076147010*s
    f=lambda x: 12.92*x if x<=.0031308 else 1.055*x**(1/2.4)-.055
    return [min(1,max(0,f(v))) for v in (r,g,bb)]
def lum(s):
    r,g,b=[lin(v) for v in to_srgb(s)]; return .2126*r+.7152*g+.0722*b
def cr(a,b):
    x,y=lum(a),lum(b); x,y=max(x,y),min(x,y); return (x+.05)/(y+.05)
pairs=[('text','ground',4.5),('text','panel',4.5),('muted','panel',4.5),('muted','raised',4.5),('muted','ground',4.5),('muted','bench',4.5),
 ('accent','panel',4.5),('accent','ground',4.5),('accent','new-tint',4.5),('on-accent','accent',4.5),
 ('on-bar','bar',4.5),('on-bar-2','bar',4.5),('danger','panel',4.5),('danger','danger-tint',4.5),('text','danger-tint',4.5),('notice','notice-tint',4.5),
 ('edge','panel',3),('edge','ground',3),('danger','panel',3),('focus','panel',3),('focus','ground',3),('focus-bar','bar',3),('accent','bench',3),('rule','panel',1)]
bad=0
for i,theme in enumerate(('light','dark')):
    print(theme)
    for a,b,need in pairs:
        if a not in tok or b not in tok: print('  missing',a,b); continue
        v=cr(tok[a][i],tok[b][i]); ok=v>=need
        if not ok: bad+=1
        print(f'  {a:10s} on {b:12s} {v:5.2f}  need {need}  {"ok" if ok else "BELOW"}')
print('below target:',bad)
