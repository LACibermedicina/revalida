#!/usr/bin/env python3
"""Gera o playbook em 4 idiomas a partir de conteudo.py e diagramas.py.
Saídas (nesta pasta): playbook.html (autônomo, interativo, com roadmap imersivo) e playbook.{pt,es,en,zh}.md (com Mermaid).
Uso: python3 docs/playbook/gerar.py"""
import html, json, math, re, sys
from pathlib import Path
AQUI = Path(__file__).parent
sys.path.insert(0, str(AQUI))
import conteudo as C
import diagramas as D

L = C.L
e = html.escape
RM_TITULO = {'pt': 'Roadmap interativo', 'es': 'Hoja de ruta interactiva', 'en': 'Interactive roadmap', 'zh': '交互式路线图'}
SEC_EXTRA = {  # onde cada diagrama entra (depois de qual seção) e seus títulos de grupo
 'jornada': ['jornada'], 'randomico': ['randomico'], 'seguranca': ['seguranca'], 'arquitetura': ['funcionamento', 'MER'],
}
GRUPO = {'MER': D.T('Modelo entidade-relacionamento', 'Modelo entidad-relación', 'Entity-relationship model', '实体-关系模型')}

def inline(s):
    s = e(s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'`(.+?)`', r'<code>\1</code>', s)
    return s

def blocos(paragrafos):
    out, lista = [], []
    def fecha():
        nonlocal lista
        if lista: out.append('<ul>' + ''.join(f'<li>{inline(i)}</li>' for i in lista) + '</ul>'); lista = []
    for p in paragrafos:
        if p.startswith('- '): lista.append(p[2:])
        else: fecha(); out.append(f'<p>{inline(p)}</p>')
    fecha(); return ''.join(out)

def quebrar(txt, lim, zh):
    if zh or any('一' <= c <= '鿿' for c in txt):
        n = max(4, lim // 2)
        return [txt[i:i + n] for i in range(0, len(txt), n)]
    linhas, atual = [], ''
    for w in txt.split():
        if atual and len(atual) + 1 + len(w) > lim: linhas.append(atual); atual = w
        else: atual = (atual + ' ' + w).strip()
    if atual: linhas.append(atual)
    return linhas

def recorte_losango(cx, cy, w, h, tx, ty):
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0: return cx, cy
    k = 1 / (abs(dx) / (w / 2) + abs(dy) / (h / 2))
    return cx + dx * k, cy + dy * k

def recorte(cx, cy, w, h, tx, ty):
    """ponto onde a reta do centro (cx,cy) ao alvo (tx,ty) sai do retângulo w×h"""
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0: return cx, cy
    k = min((w / 2) / abs(dx) if dx else math.inf, (h / 2) / abs(dy) if dy else math.inf)
    return cx + dx * k, cy + dy * k

# ---------------- MER (SVG)
def svg_mer():
    W, GX, GY, X0, Y0, BW, LH = 200, 245, 175, 20, 20, 200, 15
    pos = {}
    for n, (c, r, f) in D.ENT.items():
        h = 26 + LH * len(f) + 6
        pos[n] = (X0 + c * GX, Y0 + r * GY, BW, h)
    cols = max(c for c, _, _ in D.ENT.values()) + 1; rows = max(r for _, r, _ in D.ENT.values()) + 1
    out = [f'<svg class="dg" viewBox="0 0 {X0*2 + (cols-1)*GX + BW} {Y0*2 + (rows-1)*GY + 120}" role="img" aria-labelledby="t-mer">',
           '<title id="t-mer">ER</title>']
    vistos = set()
    for a, b, ca, cb in D.REL:
        k = frozenset((a, b)) if frozenset((a, b)) not in vistos or (a, b) in [] else None
        if frozenset((a, b)) in vistos: continue
        vistos.add(frozenset((a, b)))
        xa, ya, wa, ha = pos[a]; xb, yb, wb, hb = pos[b]
        ca_, cb_ = (xa + wa / 2, ya + ha / 2), (xb + wb / 2, yb + hb / 2)
        p1 = recorte(*ca_, wa, ha, *cb_); p2 = recorte(*cb_, wb, hb, *ca_)
        dash = ' dash' if (a in D.AUX or b in D.AUX) else ''
        out.append(f'<line class="er-l{dash}" x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" x2="{p2[0]:.1f}" y2="{p2[1]:.1f}"/>')
        for (px, py), (qx, qy), card in ((p1, p2, ca), (p2, p1, cb)):
            dx, dy = qx - px, qy - py; d = math.hypot(dx, dy) or 1
            out.append(f'<text class="er-c" x="{px + dx / d * 13 + (-dy / d) * 9:.1f}" y="{py + dy / d * 13 + (dx / d) * 9 + 4:.1f}" text-anchor="middle">{card}</text>')
    for n, (c, r, f) in D.ENT.items():
        x, y, w, h = pos[n]
        out.append(f'<g class="er-e h{r}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8"/><rect class="hd" x="{x}" y="{y}" width="{w}" height="22" rx="8"/><text class="nm" x="{x + 8}" y="{y + 15}">{e(n)}</text>')
        for i, fl in enumerate(f):
            pk, fk = fl.startswith('*'), '#' in fl
            txt = fl.replace('*', '').replace('#', '').strip()
            out.append(f'<text class="fd{" pk" if pk else ""}" x="{x + 8}" y="{y + 38 + i * LH}">{"🔑 " if pk else ""}{"↗ " if fk and not pk else ""}{e(txt)}</text>')
        out.append('</g>')
    out.append('</svg>')
    return ''.join(out)

# ---------------- fluxograma (SVG)
def svg_fluxo(fid, nos, arestas, lang):
    CX, CY, X0, Y0 = 215, 112, 20, 36
    NW, NH, DW, DH = 180, 72, 200, 100
    zh = lang == 'zh'
    pos = {}
    for nid, c, r, k, t in nos:
        w, h = (DW, DH) if k == 'dec' else (NW, NH)
        pos[nid] = (X0 + c * CX + (CX - 30) / 2, Y0 + r * CY + 40, w, h, k, t[lang])
    cols = max(n[1] for n in nos) + 1; rows = max(n[2] for n in nos) + 1
    VW, VH = X0 * 2 + (cols - 1) * CX + 200, Y0 + (rows - 1) * CY + 40 + DH + 40
    out = [f'<svg class="dg" viewBox="0 0 {VW} {VH}" role="img" aria-label="{e(fid)}"><defs><marker id="ar-{fid}-{lang}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="ah"/></marker></defs>']
    for a, b, lab in arestas:
        xa, ya, wa, ha, ka, _ = pos[a]; xb, yb, wb, hb, kb, _ = pos[b]
        ca, cb = (xa, ya), (xb, yb)
        back = xb < xa - 1
        if back:   # volta: arco por cima
            top = min(ya - ha / 2, yb - hb / 2) - 34
            p1 = (xa, ya - ha / 2); p2 = (xb, yb - hb / 2)
            out.append(f'<path class="fl-l" d="M{p1[0]:.1f} {p1[1]:.1f} C{p1[0]:.1f} {top:.1f} {p2[0]:.1f} {top:.1f} {p2[0]:.1f} {p2[1] - 2:.1f}" marker-end="url(#ar-{fid}-{lang})"/>')
            mx, my = (p1[0] + p2[0]) / 2, top + 6
        else:
            p1 = (recorte_losango if ka == 'dec' else recorte)(xa, ya, wa, ha, xb, yb); p2 = (recorte_losango if kb == 'dec' else recorte)(xb, yb, wb, hb, xa, ya)
            out.append(f'<line class="fl-l" x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" marker-end="url(#ar-{fid}-{lang})"/>')
            mx, my = p1[0] + (p2[0] - p1[0]) * 0.38, p1[1] + (p2[1] - p1[1]) * 0.38
        if lab:
            t = lab[lang] if isinstance(lab, dict) else lab
            out.append(f'<text class="fl-t" x="{mx:.1f}" y="{my - 4:.1f}" text-anchor="middle">{e(t)}</text>')
    for nid, (x, y, w, h, k, t) in pos.items():
        cls = {'start': 'st', 'end': 'en', 'dec': 'dc', 'proc': 'pr'}[k]
        if k == 'dec': forma = f'<polygon points="{x},{y - h / 2} {x + w / 2},{y} {x},{y + h / 2} {x - w / 2},{y}"/>'
        else: forma = f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" rx="{h / 2 if k in ("start", "end") else 10}"/>'
        linhas = quebrar(t, 17 if k == 'dec' else 24, zh)[:5]
        y0 = y - (len(linhas) - 1) * 7.5
        tspans = ''.join(f'<tspan x="{x}" y="{y0 + i * 15 + 4:.1f}">{e(l)}</tspan>' for i, l in enumerate(linhas))
        out.append(f'<g class="fl-n {cls}">{forma}<text text-anchor="middle">{tspans}</text></g>')
    out.append('</svg>')
    return ''.join(out)

# ---------------- Mermaid (para os .md)
def mer_mermaid():
    L_ = ['```mermaid', 'erDiagram']
    vistos = set()
    for a, b, ca, cb in D.REL:
        if frozenset((a, b)) in vistos: continue
        vistos.add(frozenset((a, b)))
        esq = '||' if ca == '1' else '}o'; dire = '||'
        L_.append(f'  {a} {esq}--{dire} {b} : "fk"')
    for n, (_, _, f) in D.ENT.items():
        L_.append(f'  {n} {{')
        for fl in f:
            pk, fk = fl.startswith('*'), '#' in fl
            nome = re.sub(r'[^a-z_0-9 ]', '', fl.replace('·', ' ').split(' ')[0] if False else re.sub(r'\[\]', '', fl.replace('*', '').replace('#', '').split(' · ')[0].split(' ')[0]))
            if not nome: continue
            tag = ' PK' if pk and fk else ' PK' if pk else ' FK' if fk else ''
            L_.append(f'    string {nome}{tag}')
        L_.append('  }')
    L_.append('```'); return '\n'.join(L_)

def fluxo_mermaid(nos, arestas, lang):
    L_ = ['```mermaid', 'flowchart LR']
    for nid, c, r, k, t in nos:
        txt = t[lang].replace('"', "'")
        L_.append(f'  {nid}' + {'dec': '{"' + txt + '"}', 'start': '(["' + txt + '"])', 'end': '(["' + txt + '"])', 'proc': '["' + txt + '"]'}[k])
    for a, b, lab in arestas:
        l = (lab[lang] if isinstance(lab, dict) else lab) if lab else None
        L_.append(f'  {a} -->' + (f'|{l}| ' if l else ' ') + b)
    L_.append('```'); return '\n'.join(L_)

FLUXO = {f[0]: f for f in D.FLUXOS}
ICONE = {'visao': '🩺', 'manuais': '📚', 'jornada': '🧭', 'trilha': '🗺️', 'randomico': '🎲', 'seguranca': '🛡️', 'desempenho': '📊', 'radio': '🎙️',
         'arquitetura': '🧬', 'instalacao': '💊', 'negocio': '💼', 'testes': '🧪', 'roadmap': '🚀'}

# ---------------- Markdown
def gerar_md(lang):
    U = C.UI
    out = [f"# {U['titulo'][lang]}", '', f"_{U['sub'][lang]}_", '', f"> {U['honesto'][lang]}", '']
    out += [f"## {U['indice'][lang]}", ''] + [f"- [{t[lang]}](#{sid})" for sid, t, _ in C.S] + [f"- [{RM_TITULO[lang]}](#roadmap)", '']
    for sid, t, corpo in C.S:
        out += [f'<a id="{sid}"></a>', f'## {t[lang]}', '']
        out += [p if p.startswith('- ') else p + '\n' for p in corpo[lang]] + ['']
        for d in SEC_EXTRA.get(sid, []):
            if d == 'MER': out += [f"### {U['diag_mer'][lang]}", '', U['diag_leg'][lang], '', mer_mermaid(), '']
            else: _, tit, nos, ar = FLUXO[d]; out += [f'### {tit[lang]}', '', fluxo_mermaid(nos, ar, lang), '']
    COL = {'pt': ('Fase · trilha', 'Marco', 'Status'), 'es': ('Fase · línea', 'Hito', 'Estado'), 'en': ('Phase · track', 'Milestone', 'Status'), 'zh': ('阶段 · 方向', '里程碑', '状态')}[lang]
    out += ['<a id="roadmap"></a>', f'## {RM_TITULO[lang]}', '', '| ' + ' | '.join(COL) + ' |', '|---|---|---|']
    ST = {'feito': U['st_feito'][lang], 'val': U['st_val'][lang], 'prox': U['st_prox'][lang]}
    TR = {k: U['tr_' + k][lang] for k in ('prod', 'plat', 'cont', 'neg')}
    for rid, tr, st, fase, tit, txt in C.RM:
        out.append(f"| {fase[lang]} · {TR[tr]} | **{tit[lang]}** — {txt[lang]} | {ST[st]} |")
    out += ['', f"_{U['fonte'][lang]}_", '']
    return '\n'.join(out)

# ---------------- HTML
def gerar_html():
    U = C.UI
    def por_lang(fn, tag='div', cls=''):
        return ''.join(f'<{tag} data-l="{l}"{f" class={chr(34)}{cls}{chr(34)}" if cls else ""}>{fn(l)}</{tag}>' for l in L)
    def sp(chave): return ''.join(f'<span data-l="{l}">{e(U[chave][l])}</span>' for l in L)
    toc = ''.join(f'<li><a href="#{sid}"><i aria-hidden="true">{ICONE.get(sid, "✚")}</i>{"".join(f"<span data-l={chr(34)}{l}{chr(34)}>{e(t[l])}</span>" for l in L)}</a></li>' for sid, t, _ in C.S)
    toc += f'<li><a href="#roadmap"><i aria-hidden="true">{ICONE["roadmap"]}</i>{"".join(f"<span data-l={chr(34)}{l}{chr(34)}>{e(RM_TITULO[l])}</span>" for l in L)}</a></li>'
    secoes = []
    for sid, t, corpo in C.S:
        s = f'<section id="{sid}" class="rev c{len(secoes) % 5}"><h2><span class="ico" aria-hidden="true">{ICONE.get(sid, "✚")}</span>{"".join(f"<span data-l={chr(34)}{l}{chr(34)}>{e(t[l])}</span>" for l in L)}</h2>' + por_lang(lambda l: blocos(corpo[l])) + '</section>'
        for d in SEC_EXTRA.get(sid, []):
            if d == 'MER':
                s += f'<figure class="fig"><figcaption>{sp("diag_mer")}</figcaption><p class="leg">{sp("diag_leg")}</p><div class="rolagem" tabindex="0" role="region" aria-label="ER">{svg_mer()}</div></figure>'
            else:
                _, tit, nos, ar = FLUXO[d]
                s += f'<figure class="fig"><figcaption>{"".join(f"<span data-l={chr(34)}{l}{chr(34)}>{e(tit[l])}</span>" for l in L)}</figcaption>' + \
                     ''.join(f'<div data-l="{l}" class="rolagem" tabindex="0" role="region" aria-label="{e(tit[l])}">{svg_fluxo(d, nos, ar, l)}</div>' for l in L) + '</figure>'
        secoes.append(s)
    rm = [{'id': r[0], 'tr': r[1], 'st': r[2], 'fase': r[3], 'tit': r[4], 'txt': r[5]} for r in C.RM]
    ui = {k: U[k] for k in ('ler', 'imersivo', 'sair_imersivo', 'dica_rm', 'filtro', 'todos', 'progresso', 'st_feito', 'st_prox', 'st_val', 'tr_prod', 'tr_plat', 'tr_cont', 'tr_neg')}
    rmsec = (f'<section id="roadmap" class="rev c4"><h2><span class="ico" aria-hidden="true">{ICONE["roadmap"]}</span>{"".join(f"<span data-l={chr(34)}{l}{chr(34)}>{e(RM_TITULO[l])}</span>" for l in L)}</h2>'
             '<p class="sub" id="rm-dica"></p><div id="rm-filtro" class="chips" role="group"></div>'
             '<div class="prog" aria-live="polite"><div class="barra"><i id="rm-barra"></i></div><span id="rm-prog"></span></div>'
             '<div id="rm-trilho" class="trilho" role="tablist" tabindex="0"></div><article id="rm-det" class="det" aria-live="polite"></article>'
             '<button type="button" class="btn" id="rm-imersivo"></button></section>')
    return TEMPLATE.replace('@@TITULO@@', ''.join(f'<span data-l="{l}">{e(U["titulo"][l])}</span>' for l in L)) \
        .replace('@@SUB@@', por_lang(lambda l: e(U['sub'][l]), 'p', 'sub')) \
        .replace('@@HONESTO@@', por_lang(lambda l: e(U['honesto'][l]), 'p')) \
        .replace('@@INDICE@@', sp('indice')).replace('@@TOC@@', toc) \
        .replace('@@CORPO@@', ''.join(secoes) + rmsec) \
        .replace('@@FONTE@@', por_lang(lambda l: e(U['fonte'][l]), 'p', 'sub')) \
        .replace('@@DADOS@@', json.dumps({'rm': rm, 'ui': ui, 'rmTitulo': RM_TITULO}, ensure_ascii=False).replace('</', '<\\/'))

TEMPLATE = (AQUI / 'modelo.html').read_text(encoding='utf-8')

if __name__ == '__main__':
    (AQUI / 'playbook.html').write_text(gerar_html(), encoding='utf-8')
    for l in L: (AQUI / f'playbook.{l}.md').write_text(gerar_md(l), encoding='utf-8')
    print('ok:', 'playbook.html +', ' '.join(f'playbook.{l}.md' for l in L))
