#!/usr/bin/env python3
"""Vetoriza as duas referências da logomarca (docs/marca/logo-fonte/):
 - facetas-referencia.png  -> polígonos coloridos (k-means de cores + contornos simplificados)
 - robo-balao-referencia.png -> traço único (contornos suavizados)
Saída: logo-fonte/facetas.json e logo-fonte/robo.json (usados por gerar-logo.py). Requer opencv-python e numpy."""
import json
from pathlib import Path
import cv2, numpy as np
AQUI = Path(__file__).resolve().parent / 'logo-fonte'

def rgba_sobre(c, fundo=255):
    im = cv2.imread(str(c), cv2.IMREAD_UNCHANGED)
    if im.shape[2] == 4:
        a = im[:, :, 3:4] / 255.0
        return (im[:, :, :3] * a + fundo * (1 - a)).astype(np.uint8), im[:, :, 3]
    return im, np.full(im.shape[:2], 255, np.uint8)

def suaviza(pts):
    """Polilinha -> caminho com curvas quadráticas pelos pontos médios (cantos arredondados leves)."""
    n = len(pts)
    if n < 3: return ''
    mid = lambda a, b: ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    f = lambda p: f'{p[0]:.1f} {p[1]:.1f}'
    m0 = mid(pts[-1], pts[0]); d = f'M{f(m0)}'
    for i in range(n):
        d += f'Q{f(pts[i])} {f(mid(pts[i], pts[(i + 1) % n]))}'
    return d + 'Z'

# Facetas desenhadas sobre a referência (vértices lidos da imagem 248x198); a cor de cada faceta é amostrada da própria imagem.
VERTICES = {
    'A': (22, 22), 'B': (22, 148), 'C': (69, 186), 'D': (69, 78), 'E': (70, 152), 'F': (106, 116),
    'G': (124, 78), 'H': (124, 133), 'P': (222, 22), 'Q': (222, 148), 'R': (204, 182), 'S': (155, 98),
}
FACETAS = [  # (nome, vértices) na ordem de pintura
    ('esq-clara', 'A D B'), ('esq-media', 'B D C'), ('esq-escura', 'D F E'), ('faixa', 'A G H F D'),
    ('dir-topo', 'G P S'), ('centro', 'G S H'), ('dir-base-escura', 'H S R'), ('dir-grande', 'S P Q R'),
]

def facetas():
    bgr, alfa = rgba_sobre(AQUI / 'facetas-referencia.png')
    h, w = bgr.shape[:2]; saida = []
    for nome, vs in FACETAS:
        pts = np.array([VERTICES[v] for v in vs.split()], np.int32)
        m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [pts], 255)
        m = cv2.erode(m, np.ones((7, 7), np.uint8))
        sel = bgr[m > 0]
        cor = np.median(sel, axis=0).astype(int)
        saida.append({'nome': nome, 'cor': '#%02X%02X%02X' % (cor[2], cor[1], cor[0]), 'pts': [list(map(float, VERTICES[v])) for v in vs.split()]})
    (AQUI / 'facetas.json').write_text(json.dumps({'w': w, 'h': h, 'poligonos': saida}, ensure_ascii=False))
    print('facetas:', [(s['nome'], s['cor']) for s in saida])

def robo():
    bgr, alfa = rgba_sobre(AQUI / 'robo-balao-referencia.png')
    S = 4
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = np.where(alfa < 128, 255, gray).astype(np.uint8)
    g = cv2.resize(gray, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC); g = cv2.GaussianBlur(g, (0, 0), 2.2)
    m = (g < 128).astype(np.uint8) * 255
    cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    d = ''; ext = ''
    for i, c in enumerate(cs):
        if cv2.contourArea(c) < 40 * S: continue
        x, y, cw, ch = cv2.boundingRect(c)
        if (y + ch) / S < 112 and (x + cw) / S < 105: continue   # fragmentos do balão: redesenhado em facetas
        a = cv2.approxPolyDP(c, 1.6, True).reshape(-1, 2) / S
        s = suaviza([(float(x), float(y)) for x, y in a]); d += s
        if hier[0][i][3] == -1: ext += s
    # balão: região branca fechada pelo contorno (para preencher com cor)
    h, w = gray.shape
    (AQUI / 'robo.json').write_text(json.dumps({'w': w, 'h': h, 'd': d, 'ext': ext}))
    print('robô:', w, 'x', h, 'caminho', len(d), 'bytes')

if __name__ == '__main__':
    facetas(); robo()
