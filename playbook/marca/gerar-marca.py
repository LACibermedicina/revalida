#!/usr/bin/env python3
"""Gera a logomarca e o mascote "Revi" (broto-doutor low poly) em todos os formatos e os aplica no app.
Uso: python3 docs/marca/gerar-marca.py   (na raiz do projeto)"""
import math, sys, os
from pathlib import Path
RAIZ = Path(__file__).resolve().parents[2]
AQUI = RAIZ / 'docs' / 'marca'

C = {'luz': '#A9E2CB', 'menta': '#8CD3B6', 'agua': '#6BBFA2', 'verde': '#4FA68B', 'medio': '#3E8F7A', 'fundo': '#2D7A68', 'sombra': '#1F5F52',
     'noite': '#154A40', 'cruz': '#F26B5B', 'cruz2': '#D9503F', 'jaleco': '#F4FBF8', 'jaleco2': '#DDF1E8', 'jaleco3': '#C4E5D7', 'tinta': '#16233B'}

def poly(pts, cor, extra=''):
    return f'<polygon points="{" ".join(f"{x:g},{y:g}" for x, y in pts)}" fill="{cor}"{extra}/>'

def leque(centro, pts, cores):
    """Facetas em leque a partir do centro: um triângulo por lado do contorno."""
    return ''.join(poly([pts[i], pts[(i + 1) % len(pts)], centro], cores[i % len(cores)]) for i in range(len(pts)))



# ---- Revi v3: prancheta médica com rosto, corpo de ataduras com cruz, estetoscópio de cachecol, espelho frontal, caneta que brilha e pilha de livros.
# Visual "3D de desenho animado" feito em vetor: gradientes de plástico fosco, luz suave de cima à esquerda, luz de contorno (rim) e sombra de contato.
DEFS = """<defs>
<linearGradient id="rvg-prancheta" x1=".15" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".65" stop-color="#EEF3F5"/><stop offset="1" stop-color="#D3DFE4"/></linearGradient>
<radialGradient id="rvg-atadura" cx=".3" cy=".2" r="1"><stop offset="0" stop-color="#FFFDF6"/><stop offset=".6" stop-color="#F3ECDD"/><stop offset="1" stop-color="#D9CDB6"/></radialGradient>
<linearGradient id="rvg-prata" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F7F9"/><stop offset=".5" stop-color="#B9C4CC"/><stop offset="1" stop-color="#7E8C97"/></linearGradient>
<linearGradient id="rvg-tubo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B6F96"/><stop offset=".55" stop-color="#2E3D5E"/><stop offset="1" stop-color="#1D2842"/></linearGradient>
<linearGradient id="rvg-cruz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF7A6B"/><stop offset="1" stop-color="#C2302B"/></linearGradient>
<linearGradient id="rvg-sapato" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6BC9AC"/><stop offset="1" stop-color="#2D7A68"/></linearGradient>
<linearGradient id="rvg-livro1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4FB59A"/><stop offset="1" stop-color="#1F6454"/></linearGradient>
<linearGradient id="rvg-livro2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6C85A"/><stop offset="1" stop-color="#C98F1E"/></linearGradient>
<linearGradient id="rvg-livro3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5E78C9"/><stop offset="1" stop-color="#26357A"/></linearGradient>
<linearGradient id="rvg-papel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFDF4"/><stop offset="1" stop-color="#E5D9BE"/></linearGradient>
<linearGradient id="rvg-rim" x1="0" y1="0" x2="1" y2="0"><stop offset=".55" stop-color="#9BE7FF" stop-opacity="0"/><stop offset="1" stop-color="#9BE7FF" stop-opacity=".95"/></linearGradient>
<radialGradient id="rvg-brilho"><stop offset="0" stop-color="#E9FFFF"/><stop offset=".35" stop-color="#7CF2FF" stop-opacity=".85"/><stop offset="1" stop-color="#7CF2FF" stop-opacity="0"/></radialGradient>
<filter id="rvg-sombra" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.4" flood-color="#0E2F3A" flood-opacity=".28"/></filter>
<filter id="rvg-suave" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>
</defs>"""

CSS = """<style>
.rv-m-resp{animation:rv-resp 3.8s ease-in-out infinite;transform-origin:92px 270px}
.rv-m-cab{animation:rv-cab 5.2s ease-in-out infinite;transform-origin:92px 132px}
.rv-m-olho{animation:rv-pisca 4.6s infinite;transform-box:fill-box;transform-origin:center}
.rv-m-cachecol{animation:rv-cachecol 4.4s ease-in-out infinite;transform-origin:92px 134px}
.rv-m-aceno{animation:rv-aceno 1.5s ease-in-out infinite;transform-origin:68px 166px}
.rv-m-escreve{animation:rv-escreve 2.8s ease-in-out infinite;transform-origin:68px 166px}
.rv-m-brilho{animation:rv-brilho 2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.rv-m-estrela{animation:rv-estrela 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes rv-resp{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-1.4px) scaleY(1.01)}}
@keyframes rv-cab{0%,100%{transform:rotate(-1.8deg)}50%{transform:rotate(2deg)}}
@keyframes rv-pisca{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes rv-cachecol{0%,100%{transform:rotate(-.8deg)}50%{transform:rotate(1deg)}}
@keyframes rv-aceno{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(14deg)}}
@keyframes rv-escreve{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(3deg)}}
@keyframes rv-brilho{0%,100%{transform:scale(.85);opacity:.75}50%{transform:scale(1.2);opacity:1}}
@keyframes rv-estrela{0%,100%{transform:scale(.4);opacity:0}50%{transform:scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.rv-m-resp,.rv-m-cab,.rv-m-olho,.rv-m-cachecol,.rv-m-aceno,.rv-m-escreve,.rv-m-brilho,.rv-m-estrela{animation:none}}
</style>"""

TINTA = '#1B2540'

def rosto(expr):
    """Rosto na prancheta (centro 92,96)."""
    s = f'<circle cx="68" cy="104" r="6.5" fill="#FF8F8A" opacity=".38"/><circle cx="116" cy="104" r="6.5" fill="#FF8F8A" opacity=".38"/>'
    def olho(cx, cy):
        return (f'<g class="rv-m-olho"><ellipse cx="{cx}" cy="{cy}" rx="7" ry="9" fill="{TINTA}"/><circle cx="{cx + 2.4}" cy="{cy - 3.2}" r="2.8" fill="#fff"/><circle cx="{cx - 2.4}" cy="{cy + 3.4}" r="1.3" fill="#fff" opacity=".9"/></g>')
    if expr == 'feliz':
        s += f'<path d="M71 96Q78 86 85 96M99 96Q106 86 113 96" fill="none" stroke="{TINTA}" stroke-width="3.4" stroke-linecap="round"/>'
        s += f'<path d="M80 106Q92 124 104 106Z" fill="{TINTA}"/><path d="M85 114Q92 118 99 114Q92 121 85 114Z" fill="#FF8F8A"/>'
    elif expr == 'pensando':
        s += olho(79, 94).replace('cx="79"', 'cx="81"') + olho(105, 91)
        s += f'<path d="M70 80Q78 76 87 79M98 73Q106 70 114 75" fill="none" stroke="{TINTA}" stroke-width="2.8" stroke-linecap="round"/>'
        s += f'<path d="M85 112Q93 110 101 113" fill="none" stroke="{TINTA}" stroke-width="3" stroke-linecap="round"/>'
    else:
        s += olho(78, 95) + olho(106, 95)
        s += f'<path d="M83 108Q92 117 101 108" fill="none" stroke="{TINTA}" stroke-width="3.2" stroke-linecap="round"/>'
    return s

def cabeca3d(expr='normal', animar=True):
    """Cabeça-prancheta com clipe, espelho frontal e rosto."""
    c = ' class="rv-m-cab"' if animar else ''
    s = f'<g{c}>'
    s += '<rect x="53" y="48" width="80" height="84" rx="15" fill="#0E2F3A" opacity=".18" transform="translate(2 4)"/>'
    s += '<rect x="52" y="44" width="80" height="84" rx="15" fill="url(#rvg-prancheta)"/>'
    s += '<path d="M64 46H120" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>'
    s += '<rect x="52" y="44" width="80" height="84" rx="15" fill="none" stroke="url(#rvg-rim)" stroke-width="3"/>'
    # clipe metálico
    s += '<rect x="73" y="35" width="38" height="17" rx="6" fill="url(#rvg-prata)"/><rect x="80" y="38" width="24" height="5" rx="2.5" fill="#fff" opacity=".6"/><circle cx="92" cy="47" r="2.6" fill="#7E8C97"/>'
    # faixa + espelho frontal
    s += '<rect x="50" y="62" width="84" height="9" rx="4" fill="url(#rvg-tubo)"/>'
    s += '<circle cx="92" cy="66.5" r="12.5" fill="url(#rvg-prata)" stroke="#7E8C97" stroke-width="1.6"/><circle cx="92" cy="66.5" r="3.6" fill="#2E3D5E"/><path d="M84 60Q89 56 96 57" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>'
    s += rosto(expr)
    return s + '</g>'

def cruz3d(cx, cy, k=1.0):
    a, e = 15 * k, 5 * k
    d = f'M{cx - e} {cy - a}H{cx + e}V{cy - e}H{cx + a}V{cy + e}H{cx + e}V{cy + a}H{cx - e}V{cy + e}H{cx - a}V{cy - e}H{cx - e}Z'
    return f'<path d="{d}" fill="url(#rvg-cruz)" stroke="#fff" stroke-width="{3.2 * k}" stroke-linejoin="round"/><path d="M{cx - e + 1.5} {cy - a + 2.5}H{cx + e - 1.5}" stroke="#fff" stroke-width="{2 * k}" stroke-linecap="round" opacity=".55"/>'

CORPO = 'M66 150Q58 196 68 234Q92 246 116 234Q126 196 118 150Q92 160 66 150Z'

def corpo_ataduras(animar=True):
    s = f'<clipPath id="rvg-corpo"><path d="{CORPO}"/></clipPath><path d="{CORPO}" fill="url(#rvg-atadura)"/><g clip-path="url(#rvg-corpo)" fill="none" stroke-linecap="round">'
    for i, y in enumerate(range(160, 246, 13)):
        d = f'M56 {y + (i % 2) * 4}Q92 {y + 14} 128 {y - 6 + (i % 2) * 4}'
        s += f'<path d="{d}" stroke="#CDBFA4" stroke-width="2.6" opacity=".8"/><path d="{d}" transform="translate(0 -3.2)" stroke="#fff" stroke-width="1.8" opacity=".7"/>'
    s += '</g>'
    s += f'<path d="{CORPO}" fill="none" stroke="url(#rvg-rim)" stroke-width="3"/>'
    s += cruz3d(92, 214, .82)
    return s

def cachecol(animar=True):
    c = ' class="rv-m-cachecol"' if animar else ''
    s = f'<g{c}>'
    s += '<path d="M54 134Q92 156 130 134" fill="none" stroke="url(#rvg-tubo)" stroke-width="12" stroke-linecap="round"/><path d="M58 141Q92 164 126 141" fill="none" stroke="url(#rvg-tubo)" stroke-width="10" stroke-linecap="round"/>'
    s += '<path d="M58 131Q92 152 126 131" fill="none" stroke="#8FA3CC" stroke-width="2" stroke-linecap="round" opacity=".7"/>'
    s += '<path d="M112 154Q120 182 100 192" fill="none" stroke="url(#rvg-tubo)" stroke-width="6" stroke-linecap="round"/>'
    s += '<circle cx="98" cy="196" r="9" fill="url(#rvg-prata)" stroke="#6D7B87" stroke-width="2"/><circle cx="98" cy="196" r="5" fill="#9FB0BC"/><path d="M92 191Q96 188 101 189" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>'
    s += '<path d="M66 146Q58 170 70 180" fill="none" stroke="url(#rvg-tubo)" stroke-width="5" stroke-linecap="round"/><circle cx="70" cy="181" r="3.4" fill="url(#rvg-prata)"/>'
    return s + '</g>'

def livros():
    s = '<ellipse cx="190" cy="289" rx="48" ry="6" fill="#0E2F3A" opacity=".16"/>'
    def livro(x, y, w, h, grad, tit, cruz=False):
        o = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="url(#rvg-{grad})"/>'
        o += f'<rect x="{x + 4}" y="{y + h - 6}" width="{w - 8}" height="4" rx="1.5" fill="url(#rvg-papel)"/>'
        o += f'<path d="M{x + 5} {y + 3}V{y + h - 8}" stroke="#fff" stroke-width="2" opacity=".4" stroke-linecap="round"/>'
        o += f'<rect x="{x + w * .32}" y="{y + h * .3}" width="{w * .42}" height="3" rx="1.5" fill="#F7DA85"/><rect x="{x + w * .38}" y="{y + h * .5}" width="{w * .3}" height="2.4" rx="1.2" fill="#F7DA85" opacity=".8"/>'
        if cruz: o += f'<path d="M{x + w - 14} {y + 5}h4v3h3v4h-3v3h-4v-3h-3v-4h3z" fill="#FF7A6B" stroke="#fff" stroke-width="1"/>'
        return o + f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="none" stroke="url(#rvg-rim)" stroke-width="2.2"/>'
    s += livro(142, 258, 92, 30, 'livro1', 'a') + livro(150, 230, 78, 28, 'livro2', 'b') + livro(156, 204, 68, 26, 'livro3', 'c', True)
    return s

def braco_caneta(pose, animar=True):
    cls = ' class="rv-m-aceno"' if pose == 'acenando' else (' class="rv-m-escreve"' if animar else '')
    s = f'<g{cls}>'
    s += '<path d="M68 168Q50 164 45 142" fill="none" stroke="#D9CDB6" stroke-width="14" stroke-linecap="round"/><path d="M68 166Q51 162 46 141" fill="none" stroke="url(#rvg-atadura)" stroke-width="12" stroke-linecap="round"/>'
    s += '<path d="M60 160Q52 158 49 150M56 152Q50 148 48 142" fill="none" stroke="#CDBFA4" stroke-width="2" stroke-linecap="round"/>'
    # caneta: corpo, ponta, luz
    s += '<g transform="rotate(-16 44 138)"><rect x="40" y="94" width="8" height="48" rx="4" fill="url(#rvg-livro1)"/><rect x="41.4" y="98" width="2.2" height="36" rx="1" fill="#fff" opacity=".5"/><path d="M40 96L44 84L48 96Z" fill="#F4F7F9"/>'
    s += '<circle cx="44" cy="83" r="2.8" fill="#E9FFFF"/></g>'
    s += f'<g transform="rotate(-16 44 138)"><circle class="rv-m-brilho" cx="44" cy="83" r="17" fill="url(#rvg-brilho)"/></g>' if animar else '<g transform="rotate(-16 44 138)"><circle cx="44" cy="83" r="17" fill="url(#rvg-brilho)"/></g>'
    s += '<circle cx="45" cy="141" r="8.6" fill="url(#rvg-atadura)" stroke="#D9CDB6" stroke-width="1.4"/>'
    s += (f'<path class="rv-m-estrela" d="M24 70l2.2 5 5 2.2-5 2.2-2.2 5-2.2-5-5-2.2 5-2.2z" fill="#9BE7FF"/><path class="rv-m-estrela" style="animation-delay:-1.2s" d="M62 76l1.6 3.6 3.6 1.6-3.6 1.6-1.6 3.6-1.6-3.6-3.6-1.6 3.6-1.6z" fill="#E9FFFF"/>' if animar else '')
    return s + '</g>'

def pernas():
    s = ''
    for x, sh in ((74, 0), (98, 0)):
        s += f'<rect x="{x}" y="232" width="15" height="32" rx="7" fill="url(#rvg-atadura)"/><path d="M{x} 244Q{x + 8} 249 {x + 15} 243M{x} 254Q{x + 8} 259 {x + 15} 253" fill="none" stroke="#CDBFA4" stroke-width="2"/>'
        s += f'<ellipse cx="{x + 7.5}" cy="268" rx="13" ry="8" fill="url(#rvg-sapato)"/><path d="M{x} 264Q{x + 6} 260 {x + 12} 262" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>'
    return s

def braco_apoiado():
    return ('<path d="M116 166Q140 180 148 202" fill="none" stroke="#D9CDB6" stroke-width="14" stroke-linecap="round"/><path d="M116 164Q139 178 147 200" fill="none" stroke="url(#rvg-atadura)" stroke-width="12" stroke-linecap="round"/>'
            '<circle cx="150" cy="203" r="8.6" fill="url(#rvg-atadura)" stroke="#D9CDB6" stroke-width="1.4"/>')

def figura(expr='normal', pose='parado', animar=True):
    """Corpo inteiro (240x300)."""
    s = (DEFS + CSS if animar else DEFS) + livros()
    s += '<ellipse cx="92" cy="289" rx="46" ry="6.5" fill="#0E2F3A" opacity=".2"/>'
    R = ' class="rv-m-resp"' if animar else ''
    s += f'<g filter="url(#rvg-sombra)"><g{R}>{pernas()}{braco_apoiado()}{corpo_ataduras(animar)}{cachecol(animar)}{cabeca3d(expr, animar)}{braco_caneta(pose, animar)}</g></g>'
    return s

def corpo_mascote(expr='normal', pose='parado'):
    return figura(expr, pose, True)

def busto(expr='normal', animar=False):
    return f'{cabeca3d(expr, animar)}{cachecol(animar)}'

def simbolo(uid='rv'):
    """Símbolo da marca: cabeça-prancheta com espelho, estetoscópio e corpo de atadura com cruz (estático)."""
    return f'{DEFS}<g transform="translate(100 104) scale(.98) translate(-92 -140)"><path d="{CORPO}" fill="url(#rvg-atadura)"/>{cruz3d(92, 214, .82)}{busto("normal", False)}</g>'

def cabeca(expr='normal', uid='x'):
    return busto(expr, True)

def avatar_interno(expr='normal', animar=True):
    return f'{DEFS}{CSS if animar else ""}<g transform="translate(100 112) scale(1.42) translate(-92 -108)"><path d="{CORPO}" fill="url(#rvg-atadura)"/>{busto(expr, animar)}</g>'


def svg(vb, corpo, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Revalida Prático"{extra}>{corpo}</svg>'

def mascote(expr='normal', pose='parado', animar=True):
    return svg('0 0 240 300', figura(expr, pose, animar))

def avatar(expr='normal', animar=True):
    defs = '<defs><linearGradient id="avf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EAFBF4"/><stop offset="1" stop-color="#BFEBDC"/></linearGradient><clipPath id="avc"><circle cx="100" cy="100" r="100"/></clipPath></defs>'
    return svg('0 0 200 200', f'{defs}<g clip-path="url(#avc)"><circle cx="100" cy="100" r="100" fill="url(#avf)"/>{avatar_interno(expr, animar)}</g>')

def mono(cor):
    contra = '#154A40' if cor == '#FFFFFF' else '#FFFFFF'
    return svg('0 0 200 200', f'<g transform="translate(100 104) scale(.98) translate(-92 -140)"><g fill="{cor}"><rect x="52" y="44" width="80" height="84" rx="15"/><rect x="73" y="35" width="38" height="17" rx="6"/><path d="{CORPO}"/><path d="M54 134Q92 156 130 134" fill="none" stroke="{cor}" stroke-width="12" stroke-linecap="round"/></g>'
               f'<g fill="{contra}"><ellipse cx="78" cy="95" rx="7" ry="9"/><ellipse cx="106" cy="95" rx="7" ry="9"/><circle cx="92" cy="66.5" r="11"/><path d="M92 199h10v-9h9v-10h-9v-9h-10v9h-9v10h9z" transform="translate(-5 4)"/></g>'
               f'<path d="M83 108Q92 117 101 108" fill="none" stroke="{contra}" stroke-width="3.4" stroke-linecap="round" transform="translate(0 0)"/></g>')

def icone_app(uid='rv'):
    """Ícone do app: cabeça-prancheta em destaque (legível em 16 px), recortada no quadrado arredondado."""
    return svg('0 0 256 256', f'<defs><linearGradient id="{uid}-fd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EAFBF4"/><stop offset="1" stop-color="#BFEBDC"/></linearGradient><clipPath id="{uid}-cp"><rect width="256" height="256" rx="58"/></clipPath></defs>'
               f'<g clip-path="url(#{uid}-cp)"><rect width="256" height="256" fill="url(#{uid}-fd)"/>{DEFS}<g transform="translate(128 150) scale(1.78) translate(-92 -112)"><path d="{CORPO}" fill="url(#rvg-atadura)"/>{busto("normal", False)}</g></g>')

def horizontal():
    fonte = "Outfit,'Poppins','Montserrat',system-ui,sans-serif"
    return svg('0 0 640 200', f'<g transform="translate(6 -4) scale(.98)">{simbolo("rvh")}</g><text x="226" y="98" font-family="{fonte}" font-weight="800" font-size="68" fill="#16233B" letter-spacing="-1">Revalida</text><text x="228" y="156" font-family="{fonte}" font-weight="600" font-size="46" fill="#3E8F7A" letter-spacing="1">Prático</text>')

def escrever(p, t):
    p = Path(p)
    if (RAIZ / 'web' in p.parents or RAIZ / 'watch' in p.parents) and not os.environ.get('REVI_VETORIAL'):
        print('pulado (o mascote oficial é o Secreto-Bot; use REVI_VETORIAL=1 para sobrescrever):', p.relative_to(RAIZ)); return
    p.parent.mkdir(parents=True, exist_ok=True); p.parent.mkdir(parents=True, exist_ok=True); p.write_text(t, encoding='utf8'); print('ok', p.relative_to(RAIZ))

def componente(nome, doc, vb, corpo_svg_fn, props=''):
    return f"""import React from 'react';

/** {doc} Gerado por docs/marca/gerar-marca.py (mesma geometria de docs/marca/). */
"""

def main():
    escrever(AQUI / 'simbolo.svg', svg('0 0 200 200', simbolo('rvs')))
    escrever(AQUI / 'icone-app.svg', icone_app('rva'))
    escrever(AQUI / 'monocromatica.svg', mono('#16233B'))
    escrever(AQUI / 'monocromatica-branca.svg', mono('#FFFFFF'))
    escrever(AQUI / 'horizontal.svg', horizontal())
    escrever(AQUI / 'mascote.svg', mascote('normal', 'parado'))
    escrever(AQUI / 'mascote-acenando.svg', mascote('feliz', 'acenando'))
    escrever(AQUI / 'mascote-pensando.svg', mascote('pensando', 'parado'))
    escrever(AQUI / 'mascote-estatico.svg', mascote('normal', 'parado', False))
    escrever(AQUI / 'avatar.svg', avatar('normal'))
    escrever(AQUI / 'avatar-feliz.svg', avatar('feliz'))
    escrever(AQUI / 'avatar-pensando.svg', avatar('pensando'))
    escrever(RAIZ / 'web/public/favicon.svg', icone_app('rvf'))
    escrever(RAIZ / 'watch/icones/icon.svg', icone_app('rvw'))
    escrever(RAIZ / 'web/src/Logo.jsx', f"""import React from 'react';

/** Logomarca do Revalida Prático: a cabeça do mascote Revi (broto-doutor low poly, com cruz médica e rosto de IA).
 *  Gerada por docs/marca/gerar-marca.py (mesma geometria de docs/marca/). */
export default function Logo({{ tamanho = 30 }}) {{
  return (
    <svg className="logo" width={{tamanho}} height={{tamanho}} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <g className="logo-facetas" dangerouslySetInnerHTML={{{{ __html: {simbolo()!r} }}}} />
    </svg>
  );
}}
""")
    def corpo(expr, pose):
        return corpo_mascote(expr, pose)
    escrever(RAIZ / 'web/src/Mascote.jsx', f"""import React from 'react';

/** Revi, o mascote do Revalida Prático (broto-doutor low poly). `expressao`: normal | feliz | pensando.
 *  `corpo`: corpo inteiro (parado ou acenando) ou só o avatar redondo. Animado por CSS (respira, pisca, balança o broto; acena); respeita "reduzir movimento". Gerado por docs/marca/gerar-marca.py. */
const CABECA = {{ normal: {avatar_interno('normal')!r}, feliz: {avatar_interno('feliz')!r}, pensando: {avatar_interno('pensando')!r} }};
const CORPO = {{ parado: {{ normal: {corpo_mascote('normal','parado')!r}, feliz: {corpo_mascote('feliz','parado')!r}, pensando: {corpo_mascote('pensando','parado')!r} }},
  acenando: {{ normal: {corpo_mascote('normal','acenando')!r}, feliz: {corpo_mascote('feliz','acenando')!r}, pensando: {corpo_mascote('pensando','acenando')!r} }} }};

export default function Mascote({{ expressao = 'normal', corpo = false, pose = 'parado', tamanho = 96, titulo = 'Revi, o mascote', className = '' }}) {{
  const e = CABECA[expressao] ? expressao : 'normal';
  if (corpo) {{
    return (
      <svg className={{`mascote ${{className}}`.trim()}} width={{tamanho * 0.8}} height={{tamanho}} viewBox="0 0 240 300" role="img" aria-label={{titulo}}>
        <g dangerouslySetInnerHTML={{{{ __html: (CORPO[pose] ?? CORPO.parado)[e] }}}} />
      </svg>
    );
  }}
  return (
    <svg className={{`mascote avatar ${{className}}`.trim()}} width={{tamanho}} height={{tamanho}} viewBox="0 0 200 200" role="img" aria-label={{titulo}}>
      <defs><linearGradient id="mascote-fundo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#EAFBF4" /><stop offset="1" stopColor="#BFEBDC" /></linearGradient><clipPath id="mascote-recorte"><circle cx="100" cy="100" r="100" /></clipPath></defs>
      <g clipPath="url(#mascote-recorte)"><circle cx="100" cy="100" r="100" fill="url(#mascote-fundo)" /><g dangerouslySetInnerHTML={{{{ __html: CABECA[e] }}}} /></g>
    </svg>
  );
}}
""")

if __name__ == '__main__':
    main()
