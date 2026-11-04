// Prática solo com IA: a IA sorteia o tema (área e assunto) onde o usuário mais precisa praticar, o usuário só escolhe dificuldade e tempo.
// Padrões: dificuldade "medio", tempo = o da estação gerada (10 min), 15 itens de checklist.
import { Limitador, rota } from './seguranca.js';
import { ErroIA } from './ia.js';
import { desempenhoTemas, diretrizesDoTema } from './temas.js';
import { inserirEstacao } from './estacoes.js';
import { tituloLivre } from './assinatura.js';
import { AREAS } from './estacao-esquema.js';

const limpaTema = (v) => String(v ?? '').replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, 160);
export const DIFICULDADE_PADRAO = 'medio';
export const ITENS_PADRAO = 15;
export const TEMPO_PADRAO_MIN = 10;
const NIVEIS = { facil: 'básica', medio: 'intermediária', dificil: 'avançada' };
const SINONIMOS = { básica: 'facil', basica: 'facil', fácil: 'facil', intermediária: 'medio', intermediaria: 'medio', médio: 'medio', avançada: 'dificil', avancada: 'dificil', difícil: 'dificil' };
const ERROS_IA = { IA_NAO_CONFIGURADA: 503, IA_CHAVE_INVALIDA: 502, IA_LIMITE: 429, IA_DEMORA: 504, IA_FALHA: 502, IA_RESPOSTA_INVALIDA: 502, IA_ESQUEMA: 502 };
const NOME_AREA = { clinica_medica: 'Clínica Médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e Obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de Família e Comunidade' };

/** Quanto o tema precisa de prática (maior = mais necessidade). Sem histórico = necessidade média-alta; cartões vencidos e lacunas somam. */
export function necessidade(t) {
  const base = t.desempenho === null || t.desempenho === undefined ? 2.5 : 0.5 + (1 - t.desempenho) * 5;
  return base + Math.min(1.5, (t.cartoes_vencidos ?? 0) * 0.15) + Math.min(1.5, (t.lacunas ?? 0) * 0.3);
}

/** Sorteio ponderado: pesos positivos, `aleatorio()` em [0,1). */
export function sortearPonderado(lista, peso, aleatorio) {
  const total = lista.reduce((s, x) => s + peso(x), 0);
  let r = aleatorio() * total;
  for (const x of lista) { r -= peso(x); if (r < 0) return x; }
  return lista[lista.length - 1];
}

/** Escolhe área (entre as 3 de maior necessidade) e, nela, o tema (entre os 5 de maior necessidade). `recentes` = temas feitos há pouco, evitados se houver alternativa. */
export function escolherTema(temas, { aleatorio = Math.random, recentes = [] } = {}) {
  const evitar = new Set(recentes.map((r) => String(r).toLowerCase()));
  let cand = temas.filter((t) => t.area && AREAS.includes(t.area)).map((t) => ({ ...t, necessidade: necessidade(t) }));
  if (cand.some((t) => !evitar.has(t.nome.toLowerCase()))) cand = cand.filter((t) => !evitar.has(t.nome.toLowerCase()));
  if (!cand.length) return null;
  const porArea = new Map();
  for (const t of cand) porArea.set(t.area, [...(porArea.get(t.area) ?? []), t]);
  const areas = [...porArea.entries()].map(([area, l]) => {
    const top = [...l].sort((a, b) => b.necessidade - a.necessidade);
    return { area, top, peso: top.slice(0, 3).reduce((s, t) => s + t.necessidade, 0) };
  }).sort((a, b) => b.peso - a.peso).slice(0, 3);
  const a = sortearPonderado(areas, (x) => x.peso, aleatorio);
  const t = sortearPonderado(a.top.slice(0, 5), (x) => x.necessidade, aleatorio);
  return t;
}

function motivo(t) {
  const partes = [];
  if (t.desempenho === null || t.desempenho === undefined) partes.push('você ainda não tem histórico neste tema');
  else partes.push(`seu aproveitamento nele está em ${Math.round(t.desempenho * 100)}%`);
  if (t.cartoes_vencidos > 0) partes.push(`${t.cartoes_vencidos} cartão(ões) para revisar`);
  if (t.lacunas > 0) partes.push(`${t.lacunas} lacuna(s) registradas`);
  return `Sugerido porque ${partes.join(', ')}.`;
}

const inteiro = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null; };

export function registrarSolo(app, { q, autenticar, ia, aleatorio = Math.random, limitador = new Limitador({ max: 8, janelaMs: 3_600_000 }) }) {
  async function sugerir(userId) {
    const [temas, rec] = await Promise.all([
      desempenhoTemas(q, userId),
      q(`select tema from praticas_solo where usuario_id = $1 and criado_em > now() - interval '3 days'`, [userId]),
    ]);
    const t = escolherTema(temas, { aleatorio, recentes: rec.rows.map((r) => r.tema) });
    if (!t) return null;
    return { tema: t.nome, area: t.area, area_nome: NOME_AREA[t.area], motivo: motivo(t), necessidade: Math.round(t.necessidade * 100) / 100 };
  }

  app.get('/api/solo/sugestao', autenticar, rota(async (req, res) => {
    const s = await sugerir(req.usuario.id);
    res.json({ sugestao: s, padroes: { dificuldade: DIFICULDADE_PADRAO, tempo_min: null, tempo_padrao_min: TEMPO_PADRAO_MIN, itens: ITENS_PADRAO }, ia: ia.configurado() });
  }));

  app.get('/api/solo/historico', autenticar, rota(async (req, res) => {
    const r = await q(`select id, estacao_id, tema, area, dificuldade, tempo_min, itens, motivo, criado_em from praticas_solo where usuario_id = $1 order by criado_em desc limit 20`, [req.usuario.id]);
    res.json({ itens: r.rows });
  }));

  app.post('/api/solo/iniciar', autenticar, rota(async (req, res) => {
    if (!ia.configurado()) return res.status(503).json({ erro: 'A IA não está configurada neste servidor.', codigo: 'IA_NAO_CONFIGURADA' });
    const b = req.body ?? {};
    const bruta = b.dificuldade === undefined || b.dificuldade === '' ? DIFICULDADE_PADRAO : String(b.dificuldade);
    const dif = NIVEIS[bruta] ? bruta : SINONIMOS[bruta];
    if (!dif) return res.status(400).json({ erro: 'Dificuldade inválida. Use facil, medio ou dificil.' });
    const tempo = b.tempo === undefined || b.tempo === null || b.tempo === '' ? null : inteiro(b.tempo, 5, 30);
    if (b.tempo !== undefined && b.tempo !== null && b.tempo !== '' && tempo === null) return res.status(400).json({ erro: 'Tempo inválido (5 a 30 minutos).' });
    const itens = b.itens === undefined || b.itens === null || b.itens === '' ? ITENS_PADRAO : inteiro(b.itens, 5, 40);
    if (itens === null) return res.status(400).json({ erro: 'Número de itens inválido (5 a 40).' });
    if (limitador.excedeu(req.usuario.id)) return res.status(429).json({ erro: 'Muitos pedidos à IA. Tente de novo mais tarde.', codigo: 'LIMITE' });

    // o usuário pode confirmar exatamente o tema que viu na sugestão; sem isso, sorteia agora
    let alvo = null;
    if (typeof b.tema === 'string' && b.tema.trim() && AREAS.includes(b.area)) alvo = { tema: b.tema.trim().slice(0, 200), area: b.area, motivo: 'Tema confirmado por você.' };
    else alvo = await sugerir(req.usuario.id);
    if (!alvo) alvo = { tema: '', area: AREAS[Math.floor(aleatorio() * AREAS.length)], motivo: 'Ainda sem histórico: a IA escolheu o tema.' };
    limitador.registrar(req.usuario.id);
    try {
      const r = await ia.gerarEstacao({
        area: alvo.area, subtema: alvo.tema, dificuldade: NIVEIS[dif],
        instrucoes: `Prática individual, sem avaliador humano. O checklist (PEP) deve ter exatamente ${itens} itens observáveis, cobrindo anamnese, exame, conduta e comunicação, com ênfase no tema.`,
        diretrizes: alvo.tema ? await diretrizesDoTema(q, { nome: alvo.tema, area: alvo.area }) : [],
      });
      const estacao = { ...r.estacao, titulo: await tituloLivre(q, r.estacao.titulo) };
      if (tempo) estacao.duracao_min = tempo;
      const id = await inserirEstacao(q, { estacao, origem: 'ia', status: 'rascunho', usuarioId: req.usuario.id, semente: r.sorteio?.semente ?? null, dificuldade: NIVEIS[dif] });
      await q('update estacoes set variacao_tema = $2 where id = $1', [id, limpaTema(alvo.tema || estacao.diagnostico_alvo || estacao.titulo)]);
      const tempoFinal = estacao.duracao_min || TEMPO_PADRAO_MIN;
      const pep = Array.isArray(estacao.pep) ? estacao.pep.length : 0;
      const p = await q(`insert into praticas_solo (usuario_id, estacao_id, tema, area, dificuldade, tempo_min, itens, motivo) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [req.usuario.id, id, alvo.tema || estacao.diagnostico_alvo || estacao.titulo, alvo.area, dif, tempoFinal, pep, alvo.motivo]);
      const avisos = [...(r.avisos ?? [])];
      if (pep !== itens) avisos.push(`A IA gerou ${pep} itens de checklist em vez de ${itens}.`);
      res.status(201).json({ id: p.rows[0].id, estacao_id: id, titulo: estacao.titulo, tema: alvo.tema, area: alvo.area, motivo: alvo.motivo, dificuldade: dif, tempo_min: tempoFinal, itens_pedidos: itens, itens: pep, avisos });
    } catch (e) {
      if (e instanceof ErroIA) return res.status(ERROS_IA[e.codigo] ?? 502).json({ erro: e.message, codigo: e.codigo });
      throw e;
    }
  }));
}
