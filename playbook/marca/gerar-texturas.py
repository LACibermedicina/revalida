#!/usr/bin/env python3
"""Texturas do tema imersivo (juta, madeira) -> web/public/marca/. Ladrilhos sem emendas (ruído periódico).
Uso (na raiz do projeto): python3 docs/marca/gerar-texturas.py   Requer numpy, scipy e pillow."""
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image
RAIZ = Path(__file__).resolve().parents[2]; SAIDA = RAIZ / 'web/public/marca'; SAIDA.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)

def juta(n=128, passo=8):
    """Trama de juta: fios alternados (por cima/por baixo), sombreados, com ruído e fiapos."""
    y, x = np.mgrid[0:n, 0:n]
    cx, cy = (x // passo), (y // passo)
    sobe = ((cx + cy) % 2 == 0)
    fx, fy = (x % passo) / passo, (y % passo) / passo
    fio = np.where(sobe, np.sin(np.pi * fx), np.sin(np.pi * fy))            # perfil redondo do fio
    base = 0.55 + 0.38 * fio
    base *= 0.85 + 0.3 * rng.random((n, n)); base = gaussian_filter(base, .5, mode='wrap')
    cor0, cor1 = np.array([86, 62, 40]), np.array([196, 160, 112])
    img = cor0 + (cor1 - cor0) * np.clip(base, 0, 1)[..., None]
    for _ in range(int(n * n / 90)):                                         # fiapos
        i, j = rng.integers(0, n, 2); l = rng.integers(2, 6); a = rng.random() * 6.28
        for k in range(l): img[(i + int(k * np.sin(a))) % n, (j + int(k * np.cos(a))) % n] *= .75 if rng.random() < .5 else 1.12
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

def madeira(n=512):
    r = rng.random((n, n))
    veio = gaussian_filter(r, (0.8, 46), mode='wrap')
    veio2 = gaussian_filter(rng.random((n, n)), (3, 120), mode='wrap')
    v = (veio - veio.min()) / (np.ptp(veio)); w = (veio2 - veio2.min()) / np.ptp(veio2)
    t = np.clip(.55 * v + .45 * w, 0, 1)
    t = (t - t.mean()) * 2.4 + .5
    y = np.arange(n)[:, None] * np.ones((1, n))
    tabua = (y // 128).astype(int)                                           # 4 tábuas por ladrilho
    tom = (rng.random(4) * .25 - .12)[tabua % 4]
    t = np.clip(t + tom, 0, 1)
    emenda = (y % 128 < 2.2)
    cor0, cor1 = np.array([62, 40, 24]), np.array([150, 108, 70])
    img = cor0 + (cor1 - cor0) * t[..., None]
    img[emenda] *= .45
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

if __name__ == '__main__':
    juta().save(SAIDA / 'tex-juta.png'); madeira().save(SAIDA / 'tex-madeira.jpg', quality=82)
    print('ok', SAIDA / 'tex-juta.png', SAIDA / 'tex-madeira.jpg')
