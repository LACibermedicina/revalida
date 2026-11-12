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


# ===== v2 (jaleco): só o robozinho de jaleco médico segurando um balão verde estilo origami; sem o M facetado ao fundo =====
VERDES = ['#1F6F63', '#2F8F80', '#3FAE98', '#7FD6C7', '#B6EBDD']
JALECO = '#FFFDF7'
# balão origami: facetas dobradas (centro, pontas, base) com vincos; coordenadas da imagem do robô (251x471)
FACETAS = [  # (pontos, índice do verde)
    ([(47, 6), (16, 22), (28, 50)], 3), ([(47, 6), (78, 22), (66, 50)], 4), ([(47, 6), (28, 50), (66, 50)], 2),
    ([(16, 22), (6, 58), (28, 50)], 1), ([(78, 22), (88, 58), (66, 50)], 0), ([(28, 50), (6, 58), (24, 92)], 0),
    ([(66, 50), (88, 58), (70, 92)], 1), ([(28, 50), (66, 50), (47, 76)], 3), ([(28, 50), (47, 76), (24, 92)], 2),
    ([(66, 50), (70, 92), (47, 76)], 1), ([(24, 92), (47, 76), (42, 108)], 1), ([(70, 92), (47, 76), (52, 108)], 0),
    ([(47, 76), (42, 108), (52, 108)], 2),
]
def balao_origami(tinta=TINTA, modo='cor'):
    o = ''
    for pts, i in FACETAS:
        d = 'M' + 'L'.join(f'{x} {y}' for x, y in pts) + 'Z'
        fill = VERDES[i] if modo == 'cor' else tinta
        op = '1' if modo == 'cor' else f'{.15 + i * .17:.2f}'
        o += f'<path d="{d}" fill="{fill}" fill-opacity="{op}" stroke="{"#145A50" if modo == "cor" else tinta}" stroke-opacity=".55" stroke-width="1.2" stroke-linejoin="round"/>'
    contorno = 'M47 6L78 22L88 58L70 92L52 108L42 108L24 92L6 58L16 22Z'
    return o + f'<path d="{contorno}" fill="none" stroke="{tinta}" stroke-width="3.6" stroke-linejoin="round"/><path d="M47 108L37 122L57 122Z" fill="{VERDES[1] if modo == "cor" else tinta}" stroke="{tinta}" stroke-width="2.4" stroke-linejoin="round"/>'

def jaleco_svg(tinta=TINTA, modo='cor'):
    """jaleco por cima do corpo do robô: manga levantada (segura o fio), manga solta, corpo com lapelas, botões e bolso com cruz."""
    c = JALECO if modo == 'cor' else '#FFFFFF'
    L = f'stroke="{tinta}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"'
    corpo = f'<path d="M86 246 L196 244 L208 300 L214 408 L180 420 L134 414 L84 420 L70 404 L76 300Z" fill="{c}" {L}/>'
    manga_e = f'<path d="M88 252 L64 282 L50 304 L68 316 L84 296 L104 270Z" fill="{c}" {L}/>'
    manga_d = f'<path d="M188 250 L214 262 L220 336 L196 344 L184 300Z" fill="{c}" {L}/>'
    lapelas = f'<path d="M134 246 L146 300 L120 266Z M158 246 L146 300 L176 266Z" fill="{c}" {L}/><path d="M146 300 L146 410" fill="none" {L}/>'
    bolso = f'<rect x="164" y="338" width="30" height="34" rx="4" fill="{c}" {L}/>'
    cruz = f'<path d="M179 346 v18 M170 355 h18" fill="none" stroke="{VERDES[1] if modo == "cor" else tinta}" stroke-width="5" stroke-linecap="round"/>'
    botoes = ''.join(f'<circle cx="140" cy="{y}" r="3.6" fill="{tinta}"/>' for y in (330, 360, 390))
    esteto = f'<path d="M126 252 q-14 40 6 56 q16 10 22 -8" fill="none" stroke="{tinta}" stroke-width="3.2" stroke-linecap="round"/><circle cx="156" cy="304" r="5" fill="#B08A45" stroke="{tinta}" stroke-width="2"/>'
    return corpo + manga_e + manga_d + lapelas + bolso + cruz + botoes + esteto

def robo_jaleco(tinta=TINTA, fundo=CREME, modo='cor'):
    base = f'<path d="{R["ext"]}" fill="{fundo}" stroke="{fundo}" stroke-width="6" stroke-linejoin="round"/>' if fundo else ''
    # o balão de tinta original fica sob o balão origami (cobre toda a área dele)
    return base + f'<path d="{R["d"]}" fill="{tinta}"/>' + jaleco_svg(tinta, modo) + balao_origami(tinta, modo)

def personagem(tinta=TINTA, modo='cor'):
    """v4: cabeça do robô de tinta + corpo como o do modelo 3D (Modelo_3D-3): tronco quadrado de juta, jaleco em dois painéis com gola,
    tela de ECG no peito, bolso com adesivo, braços de manga redonda com mãos de juta e pernas curtas e separadas com pés redondos."""
    c = JALECO if modo == 'cor' else '#FFFFFF'; cab = '#FFF6E6' if modo == 'cor' else '#FFFFFF'
    juta = '#C9A672' if modo == 'cor' else '#FFFFFF'; lat = LATAO if modo == 'cor' else tinta
    L = f'stroke="{tinta}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"'
    o = ''
    # pernas curtas separadas (juta) e pés arredondados
    for x in (96, 116):
        o += f'<rect x="{x}" y="146" width="14" height="22" rx="5" fill="{juta}" {L}/><ellipse cx="{x + 7}" cy="171" rx="9.5" ry="6" fill="{juta}" {L}/><path d="M{x} 160 h14" stroke="{tinta}" stroke-width="1.6" stroke-dasharray="2 2"/>'
    # braço esquerdo erguido (manga redonda + mão de juta) segurando o fio do balão
    o += f'<path d="M58 71 L59 106" fill="none" stroke="{tinta}" stroke-width="1.8" stroke-linecap="round"/>'
    o += f'<path d="M93 106 L72 118 L64 109" fill="none" stroke="{tinta}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M93 106 L72 118 L64 109" fill="none" stroke="{c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'
    o += f'<circle cx="60" cy="106" r="6.5" fill="{juta}" {L}/><circle cx="64" cy="112" r="2.6" fill="{juta}" {L.replace("3.2", "1.8")}/>'
    # pescoço + cabeça (recorte do robô de tinta original)
    o += f'<rect x="104" y="90" width="16" height="9" rx="2" fill="{c}" {L}/>'
    o += (f'<defs><clipPath id="rvcab"><rect x="70" y="100" width="140" height="143"/></clipPath></defs>'
          f'<g transform="translate(59.7 7) scale(.38)" clip-path="url(#rvcab)"><path d="{R["ext"]}" fill="{cab}"/><path d="{R["d"]}" fill="{tinta}"/></g>')
    # tronco quadrado de juta com tela de ECG
    o += f'<rect x="94" y="99" width="36" height="50" rx="7" fill="{juta}" {L}/>'
    o += f'<rect x="102" y="115" width="20" height="17" rx="3" fill="#0A3A3F" stroke="{tinta}" stroke-width="2.4"/><path d="M104 124 h4 l2 -6 l3 11 l2 -5 h7" fill="none" stroke="#7FFFF0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
    # jaleco: dois painéis, gola, botão e bolso com adesivo
    o += f'<path d="M93 101 L104 101 L104 148 L93 148 Q91 124 93 101Z" fill="{c}" {L}/><path d="M120 101 L131 101 Q133 124 131 148 L120 148Z" fill="{c}" {L}/>'
    o += f'<path d="M103 99 L110 112 L98 108Z M121 99 L114 112 L126 108Z" fill="{c}" {L}/><circle cx="112" cy="138" r="2.6" fill="{tinta}"/>'
    o += f'<rect x="122" y="133" width="9" height="11" rx="1.6" fill="{cab}" stroke="{tinta}" stroke-width="1.8"/><circle cx="126.5" cy="138.5" r="1.6" fill="{tinta}"/>'
    # braço direito caído
    o += f'<path d="M131 106 L139 124 L138 140" fill="none" stroke="{tinta}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M131 106 L139 124 L138 140" fill="none" stroke="{c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'
    o += f'<circle cx="138" cy="146" r="6.5" fill="{juta}" {L}/>'
    return o

def simbolo(modo='cor', tinta=TINTA, fundo=CREME, sx=None, rh=190):
    """200x200: o personagem de jaleco com o balão origami (balão à esquerda, sem fundo). Halo claro só nos contornos (não preenche o vão entre as pernas)."""
    bal = f'<g transform="translate(30 -3) scale(.6)">{balao_origami(tinta, modo)}</g>'
    corpo = f'<g id="rvp">{personagem(tinta, modo)}{bal}</g>'
    if not fundo: return corpo
    halo = (f'<defs><filter id="rvh" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="2.6" result="d"/>'
            f'<feFlood flood-color="{fundo}"/><feComposite in2="d" operator="in" result="h"/><feMerge><feMergeNode in="h"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>')
    return halo + f'<g filter="url(#rvh)">{corpo}</g>'

def escrever_logo_jsx():
    corpo = simbolo().replace('\\', '\\\\').replace('"', '\\"')
    jsx = ("import React from 'react';\n\n/** Nome da marca no menu: só REVALIDA.M3D (o tamanho vem do CSS: .wordmark / .mesa-marca .wordmark). */\n"
           "export const Wordmark = () => <span className=\"wordmark\">REVALIDA<i>.</i>M3D</span>;\n\n"
           "/** Logomarca: Secreto-Bot de jaleco médico segurando um balão verde em origami (sem fundo). Gerada por docs/marca/gerar-logo.py. */\n"
           "export default function Logo({ tamanho = 30 }) {\n  return (\n    <svg className=\"logo\" width={tamanho} height={tamanho} viewBox=\"0 0 200 200\" aria-hidden=\"true\" focusable=\"false\"\n"
           "      dangerouslySetInnerHTML={{ __html: \"" + corpo + "\" }} />\n  );\n}\n")
    escrever(RAIZ / 'web' / 'src' / 'Logo.jsx', jsx)

if __name__ == '__main__':
    escrever(SAIDA / 'simbolo.svg', svg('0 0 200 200', simbolo()))
    escrever(SAIDA / 'horizontal.svg', horizontal())
    escrever(SAIDA / 'icone-app.svg', icone_app())
    escrever(SAIDA / 'monocromatica.svg', svg('0 0 200 200', simbolo('mono', TINTA, '#FFFFFF')))
    escrever(SAIDA / 'monocromatica-branca.svg', svg('0 0 200 200', simbolo('mono', '#FFFFFF', None)))
    escrever_logo_jsx()
