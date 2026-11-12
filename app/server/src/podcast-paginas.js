// Páginas públicas para ouvir um episódio ou uma playlist SEM conta: HTML simples, sem JavaScript (o <audio> nativo toca),
// com Open Graph, noindex e links para o RSS e o MP3. Todo texto vem escapado.
export const esc = (s) => String(s ?? '').replace(/[<>&'"\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' }[c] ?? ''));
export const duracaoTexto = (s) => { const n = Math.max(0, Math.round(Number(s) || 0)); const m = Math.floor(n / 60), r = n % 60; return n >= 3600 ? `${Math.floor(n / 3600)} h ${String(m % 60).padStart(2, '0')} min` : `${m}:${String(r).padStart(2, '0')} min`; };

const CSS = `:root{--bg:#EFE3CC;--card:#FBF4E4;--fg:#2F2418;--suave:#76644D;--borda:#DCCBA9;--mar:#2F8F80;--latao:#B08A45}
@media (prefers-color-scheme:dark){:root{--bg:#1A130D;--card:#2A2017;--fg:#F2E7D5;--suave:#BCA98C;--borda:#4A3A2A;--mar:#63C7B0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;padding:20px 14px 40px}
main{max-width:720px;margin:0 auto}.marca{display:flex;align-items:center;gap:10px;font-weight:800;margin-bottom:14px}.marca img{width:34px;height:34px;border-radius:9px}
.cartao{background:var(--card);border:1px solid var(--borda);border-radius:18px;padding:18px;margin:0 0 14px;box-shadow:0 10px 24px -16px rgba(60,35,15,.5)}
h1{font-size:1.45rem;line-height:1.25;margin:.1rem 0 .3rem}h2{font-size:1.1rem;margin:0 0 .2rem}.sub{color:var(--suave);font-size:.92rem;margin:0 0 .7rem}
audio{width:100%;margin:.4rem 0}a{color:var(--mar);font-weight:600}.acoes{display:flex;flex-wrap:wrap;gap:8px;margin:.5rem 0}.acoes a{border:1px solid var(--borda);border-radius:999px;padding:.3rem .8rem;text-decoration:none;font-size:.88rem}
details{margin-top:.5rem}summary{cursor:pointer;font-weight:700;color:var(--mar)}.roteiro{white-space:pre-wrap;margin:.6rem 0 0}.aviso{background:#FFF1CC;color:#5B4306;border-radius:12px;padding:.5rem .8rem;font-size:.9rem}
footer{color:var(--suave);font-size:.82rem;text-align:center;margin-top:18px}`;

function moldura({ titulo, descricao, url, corpo }) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} · Revalida Prático</title><meta name="robots" content="noindex,nofollow">
<meta name="description" content="${esc(String(descricao).slice(0, 200))}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(String(descricao).slice(0, 200))}"><meta property="og:url" content="${esc(url)}">
<link rel="icon" href="/favicon.png"><style>${CSS}</style></head>
<body><main><div class="marca"><img src="/favicon.png" alt="" width="34" height="34">Revalida Prático · Podcast de estudo</div>
${corpo}
<footer>Conteúdo de estudo gerado com IA a partir de roteiros do Revalida Prático. Não substitui orientação médica.<br>Quem tem este link pode ouvir; o autor pode desativá-lo a qualquer momento.</footer></main></body></html>`;
}

const player = (audioUrl) => (audioUrl
  ? `<audio controls preload="none" src="${esc(audioUrl)}">Seu navegador não toca áudio. <a href="${esc(audioUrl)}">Baixar o MP3</a>.</audio>`
  : `<p class="aviso">Este episódio ainda não tem áudio gravado; leia a transcrição abaixo.</p>`);

export function paginaEpisodio({ titulo, album, roteiro, duracao_s, audioUrl, baixarUrl, txtUrl, url }) {
  const corpo = `<section class="cartao"><p class="sub">${esc(album)} · ${esc(duracaoTexto(duracao_s))}</p><h1>${esc(titulo)}</h1>${player(audioUrl)}
<div class="acoes">${baixarUrl ? `<a href="${esc(baixarUrl)}">Baixar MP3</a>` : ''}<a href="${esc(txtUrl)}">Transcrição (.txt)</a></div>
<details open><summary>Transcrição</summary><div class="roteiro">${esc(roteiro)}</div></details></section>`;
  return moldura({ titulo, descricao: roteiro, url, corpo });
}

export function paginaPlaylist({ titulo, descricao, itens, rssUrl, url }) {
  const lista = itens.map((i, k) => `<section class="cartao"><h2>${k + 1}. ${esc(i.titulo)}</h2><p class="sub">${esc(duracaoTexto(i.duracao_s))}</p>${player(i.audioUrl)}
<div class="acoes">${i.baixarUrl ? `<a href="${esc(i.baixarUrl)}">Baixar MP3</a>` : ''}<a href="${esc(i.txtUrl)}">Transcrição (.txt)</a></div>
<details><summary>Ler a transcrição</summary><div class="roteiro">${esc(i.roteiro)}</div></details></section>`).join('\n');
  const corpo = `<section class="cartao"><h1>${esc(titulo)}</h1><p class="sub">${itens.length} episódio${itens.length === 1 ? '' : 's'}${descricao ? ` · ${esc(String(descricao).slice(0, 300))}` : ''}</p>
<div class="acoes"><a href="${esc(rssUrl)}">Assinar por RSS</a></div>
<p class="sub">Para ouvir no seu app de podcast, copie o endereço do RSS e use “adicionar podcast por URL”.</p></section>
${lista || '<p class="aviso">Esta playlist ainda não tem episódios.</p>'}`;
  return moldura({ titulo, descricao: descricao || titulo, url, corpo });
}
