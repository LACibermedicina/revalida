#!/usr/bin/env python3
"""Logomarca do Revalida Prático a partir das duas referências (docs/marca/logo-fonte/):
  facetas (M teal facetado) + robozinho com balão (traço de tinta). Rode vetorizar.py antes (já versionado em logo-fonte/*.json).
Gera SVG em docs/marca/logo/ e o componente web/src/Logo.jsx. Uso (na raiz do projeto): python3 docs/marca/gerar-logo.py"""
import json, sys
from pathlib import Path
AQUI = Path(__file__).resolve().parent; RAIZ = AQUI.parent.parent; FONTE = AQUI / 'logo-fonte'; SAIDA = AQUI / 'logo'
F = json.loads((FONTE / 'facetas.json').read_text()); R = json.loads((FONTE / 'robo.json').read_text())
TINTA = '#16233B'; CREME = '#FFF6E6'; LATAO = '#B08A45'

def facetas_svg(modo='cor', tinta=TINTA):
    out = []
    for p in F['poligonos']:
        d = 'M' + 'L'.join(f'{x} {y}' for x, y in p['pts']) + 'Z'
        if modo == 'cor':
            out.append(f'<path d="{d}" fill="{p["cor"]}" stroke="{p["cor"]}" stroke-width=".9" stroke-linejoin="round"/>')
        else:   # monocromático: mesma cor, a luminosidade vira opacidade
            c = p['cor'].lstrip('#'); lum = (int(c[0:2], 16) * .3 + int(c[2:4], 16) * .59 + int(c[4:6], 16) * .11) / 255
            out.append(f'<path d="{d}" fill="{tinta}" fill-opacity="{1.05 - lum:.2f}" stroke="{tinta}" stroke-opacity="{1.05 - lum:.2f}" stroke-width=".9" stroke-linejoin="round"/>')
    return ''.join(out)

BALAO = [  # balão em facetas (coordenadas da imagem do robô 251x471): [pontos, índice da cor]
    ([(47, 6), (16, 22), (6, 58), (24, 92), (42, 108), (47, 52)], 0),
    ([(47, 6), (78, 22), (88, 58), (47, 52)], 1),
    ([(88, 58), (70, 92), (52, 108), (42, 108), (47, 52)], 2),
]
def cores_balao(): return [p['cor'] for p in F['poligonos'] if p['nome'] in ('esq-clara', 'faixa', 'centro')]

def balao_svg(tinta=TINTA, modo='cor'):
    cs = cores_balao() if modo == 'cor' else [tinta] * 3
    ops = ['1', '1', '1'] if modo == 'cor' else ['.3', '.55', '.85']
    o = ''.join(f'<path d="M{"L".join(f"{x} {y}" for x, y in pts)}Z" fill="{cs[i]}" fill-opacity="{ops[i]}"/>' for pts, i in BALAO)
    contorno = 'M47 6L78 22L88 58L70 92L52 108L42 108L24 92L6 58L16 22Z'
    return o + f'<path d="{contorno}" fill="none" stroke="{tinta}" stroke-width="4" stroke-linejoin="round"/><path d="M47 108L38 121L56 121Z" fill="{tinta}"/>'

def robo_svg(tinta=TINTA, fundo=CREME, modo='cor'):
    base = f'<path d="{R["ext"]}" fill="{fundo}" stroke="{fundo}" stroke-width="5" stroke-linejoin="round"/>' if fundo else ''
    return base + f'<path d="{R["d"]}" fill="{tinta}"/>' + balao_svg(tinta, modo)

def simbolo(modo='cor', tinta=TINTA, fundo=CREME, sx=.74, rh=140):
    """200x200: facetas ao fundo; o robô, com o balão subindo pelo vão superior do M, à frente."""
    s = rh / R['h']
    fx, fy = (200 - F['w'] * sx) / 2, 40
    nx = fx + 124 * sx                      # centro do vão superior do M
    rx, ry = nx - 47 * s, 196 - rh
    return (f'<g transform="translate({fx:.1f} {fy:.1f}) scale({sx})">{facetas_svg(modo, tinta)}</g>'
            f'<g transform="translate({rx:.1f} {ry:.1f}) scale({s:.4f})">{robo_svg(tinta, fundo, modo)}</g>')

def svg(vb, corpo, extra='', fundo=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Revalida Prático">{extra}{fundo}{corpo}</svg>'

def escrever(p, t):
    p = Path(p); p.parent.mkdir(parents=True, exist_ok=True); p.write_text(t, encoding='utf8'); print('ok', p.relative_to(RAIZ))

FONTE_TXT = "Outfit,'Poppins','Montserrat',system-ui,sans-serif"
def horizontal(tinta=TINTA):
    return svg('0 0 640 200', f'<g transform="translate(4 0)">{simbolo()}</g><text x="214" y="98" font-family="{FONTE_TXT}" font-weight="800" font-size="68" fill="{tinta}" letter-spacing="-1">Revalida</text><text x="216" y="156" font-family="{FONTE_TXT}" font-weight="600" font-size="46" fill="#3F8F80" letter-spacing="1">Prático</text>')

def icone_app():
    fundo = '<defs><linearGradient id="lgf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7EEDD"/><stop offset="1" stop-color="#E3D2B3"/></linearGradient><clipPath id="lgc"><rect width="256" height="256" rx="58"/></clipPath></defs><g clip-path="url(#lgc)"><rect width="256" height="256" fill="url(#lgf)"/><g transform="translate(24 20) scale(1.04)">'
    return svg('0 0 256 256', simbolo() + '</g></g>', fundo=fundo)

if __name__ == '__main__':
    escrever(SAIDA / 'simbolo.svg', svg('0 0 200 200', simbolo()))
    escrever(SAIDA / 'horizontal.svg', horizontal())
    escrever(SAIDA / 'icone-app.svg', icone_app())
    escrever(SAIDA / 'monocromatica.svg', svg('0 0 200 200', simbolo('mono', TINTA, '#FFFFFF')))
    escrever(SAIDA / 'monocromatica-branca.svg', svg('0 0 200 200', simbolo('mono', '#FFFFFF', None)))
