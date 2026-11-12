// Pedidos do candidato que combinam com o gatilho de uma carta (ex.: "solicitar gasometria" ← "peço uma gasometria arterial").
// É só uma DICA para o avaliador liberar a carta: quem libera é sempre o avaliador.
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const VERBOS = new Set('solicitar solicito solicita pedir peco pede pedido requisitar realizar realizo fazer faco exame exames dados dado verificar verifico medir meço medico avaliar avalio'.split(' '));

export function termosDoGatilho(gatilho) {
  return [...new Set(norm(gatilho).split(' ').filter((w) => w.length >= 4 && !VERBOS.has(w)).map((w) => (w.length > 6 ? w.slice(0, 6) : w)))];
}

/** Devolve os ids das cartas cujo gatilho aparece (todos os termos) na fala. */
export function detectarPedidos(segmentos, materiais) {
  const palavras = norm(segmentos.map((s) => s.texto).join(' ')).split(' ');
  const tem = (t) => palavras.some((p) => p.startsWith(t));
  return materiais.filter((m) => !m.liberado && m.gatilho).filter((m) => { const t = termosDoGatilho(m.gatilho); return t.length > 0 && t.every(tem); }).map((m) => m.id);
}
