#!/usr/bin/env python3
"""Gera a logomarca do Revalida Prático (SVG) e a folha de marca. Original: referência gráfica = facetas triangulares em verdes-água
e grade de losangos/cubos da imagem anexada, aplicadas a uma CRUZ MÉDICA com batimento (ECG) e ao "estudo prático" (livro/estação).
Uso: python3 docs/marca/gerar_marca.py"""
from pathlib import Path
import math
AQUI = Path(__file__).parent
# paleta (verdes-água claros do anexo + acentos já usados no app)
T = {'t1': '#A9E2CB', 't2': '#8CD3B6', 't3': '#6BBFA2', 't4': '#4FA68B', 't5': '#3E8F7A', 't6': '#2D7A68', 't7': '#1F5F52', 't8': '#154A40'}
CORAL = '#FF6F59'; SOL = '#F7B731'; MAR = '#1F7AE0'

CONTORNO = 'M82 12H118L130 24V70H176L188 82V118L176 130H130V176L118 188H82L70 176V130H24L12 118V82L24 70H70V24Z'

def polis(lista):
    return ''.join(f'<polygon points="{p}" fill="{c}"/>' for p, c in lista)

def simbolo_corpo(ecg=True, mono=None):
    """cruz facetada 200×200: 4 braços divididos por diagonais + centro em pirâmide (luz vinda do alto à esquerda)"""
    cor = (lambda k: mono) if mono else (lambda k: T[k])
    f = [
     # braço superior
     ('70,70 70,12 130,70', cor('t2')), ('70,12 130,12 130,70', cor('t4')),
     # braço esquerdo
     ('70,70 12,70 70,130', cor('t1')), ('12,70 12,130 70,130', cor('t3')),
     # braço direito
     ('130,70 188,130 130,130', cor('t6')), ('130,70 188,70 188,130', cor('t5')),
     # braço inferior
     ('70,130 130,188 130,130', cor('t7')), ('70,130 70,188 130,188', cor('t6')),
     # centro em pirâmide
     ('70,70 130,70 100,100', cor('t3')), ('70,70 100,100 70,130', cor('t2')), ('130,70 130,130 100,100', cor('t6')), ('70,130 100,100 130,130', cor('t8')),
    ]
    s = f'<clipPath id="rv-cx"><path d="{CONTORNO}"/></clipPath><g clip-path="url(#rv-cx)">' + polis(f) + '</g>'
    if ecg:
        s += ('<polyline points="22,100 64,100 76,100 86,78 100,126 112,86 120,100 178,100" fill="none" stroke="#fff" stroke-width="6" '
              'stroke-linecap="round" stroke-linejoin="round"/>')
    return s

def svg(vb, corpo, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Revalida Prático">{extra}{corpo}</svg>'

def simbolo(): return svg('0 0 200 200', simbolo_corpo())
def mono(cor='#16233B'): return svg('0 0 200 200', simbolo_corpo(ecg=False, mono=cor).replace('fill="%s"' % cor, 'fill="%s"' % cor) + f'<polyline points="22,100 64,100 76,100 86,78 100,126 112,86 120,100 178,100" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    '') if False else svg('0 0 200 200', f'<path d="{CONTORNO}" fill="{cor}"/><polyline points="22,100 64,100 76,100 86,78 100,126 112,86 120,100 178,100" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>')

def horizontal(escuro='#16233B'):
    g = simbolo_corpo()
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 200" role="img" aria-label="Revalida Prático"><g>{g}</g>'
            f'<text x="226" y="98" font-family="Outfit,\'Poppins\',\'Montserrat\',system-ui,sans-serif" font-weight="800" font-size="68" fill="{escuro}" letter-spacing="-1">Revalida</text>'
            f'<text x="228" y="156" font-family="Outfit,\'Poppins\',\'Montserrat\',system-ui,sans-serif" font-weight="600" font-size="46" fill="{T["t5"]}" letter-spacing="1">Prático</text>'
            f'<polyline points="470,140 500,140 510,124 522,160 534,132 542,140 600,140" fill="none" stroke="{CORAL}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>')

def icone():
    defs = f'<defs><linearGradient id="fd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EAFBF4"/><stop offset="1" stop-color="#BFEBDC"/></linearGradient></defs>'
    return svg('0 0 256 256', f'<rect width="256" height="256" rx="58" fill="url(#fd)"/><g transform="translate(40 40) scale(.88)">{simbolo_corpo()}</g>', defs)

def padrao(cols=17, lado=15):
    """grade de cubos isométricos (referência do anexo) recortada em forma de cruz, sombreada do claro ao escuro"""
    w = lado * math.sqrt(3); h = lado * 2
    pol = []
    def dentro(x, y, W, H):  # cruz normalizada
        u, v = x / W, y / H
        return (0.33 <= u <= 0.67 and 0.03 <= v <= 0.97) or (0.03 <= u <= 0.97 and 0.33 <= v <= 0.67)
    W = cols * w; rows = int(cols * 1.15); H = rows * lado * 1.5 + lado
    for r in range(rows):
        for c in range(cols):
            x = c * w + (w / 2 if r % 2 else 0) + w / 2; y = r * lado * 1.5 + lado
            if not dentro(x, y, W, H): continue
            t = (x / W) * .55 + (y / H) * .45          # 0 claro → 1 escuro
            k = min(7, max(0, int(t * 8))); topo = T[f't{max(1, 3 - (1 if t < .3 else 0))}'] if False else T[f't{min(8, 1 + k)}']
            esq = T[f't{min(8, 2 + k)}']; dir_ = T[f't{min(8, 3 + k)}']
            P = lambda *pts: ' '.join(f'{px:.1f},{py:.1f}' for px, py in pts)
            a = lado * .5
            pol.append((P((x, y - lado), (x + w / 2, y - a), (x, y), (x - w / 2, y - a)), topo))
            pol.append((P((x - w / 2, y - a), (x, y), (x, y + lado), (x - w / 2, y + a)), esq))
            pol.append((P((x + w / 2, y - a), (x, y), (x, y + lado), (x + w / 2, y + a)), dir_))
    return svg(f'-4 -4 {W + 8:.0f} {H + 8:.0f}', polis(pol))

arq = {'simbolo.svg': simbolo(), 'horizontal.svg': horizontal(), 'monocromatica.svg': mono(), 'monocromatica-branca.svg': mono('#FFFFFF'), 'icone-app.svg': icone(), 'padrao-cubos.svg': padrao()}
for n, c in arq.items(): (AQUI / n).write_text(c, encoding='utf-8')
print('ok:', ', '.join(arq))
