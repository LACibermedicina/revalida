// Regras puras do estudo (sem banco, sem rede): repetição espaçada, desempenho, trilha, erros transversais.

export const CATEGORIAS = ['conhecimento', 'sequencia', 'comunicacao', 'tempo'];
export const ERROS_TIPO = {
  leitura_comandos: 'Não leu todos os comandos',
  instabilidade: 'Ignorou instabilidade',
  anamnese_sem_direcao: 'Anamnese sem direção',
  nao_verbalizar: 'Não verbalizou',
  consentimento_privacidade: 'Esqueceu consentimento/privacidade',
  exame_generico: 'Exame físico genérico',
  exame_sem_interpretar: 'Pediu exame sem interpretar',
  diagnostico_sem_conduta: 'Diagnóstico sem conduta',
  medicacao_incompleta: 'Medicação incompleta',
  excesso_fala: 'Excesso de fala',
  sem_orientacao_final: 'Sem orientação final',
  sem_cronometro: 'Não treinou sob tempo',
};
export const norm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * SM-2 simplificado. qualidade: 0 errei, 3 difícil, 4 bom, 5 fácil.
 * Errou (<3): volta para amanhã e zera a sequência; acertou: 1 dia, 3 dias, depois intervalo × facilidade.
 */
export function sm2(estado, qualidade) {
  const q = Math.max(0, Math.min(5, Math.round(qualidade)));
  let { facilidade = 2.5, intervalo_dias = 0, repeticoes = 0 } = estado ?? {};
  facilidade = Number(facilidade);
  if (q < 3) { repeticoes = 0; intervalo_dias = 1; }
  else {
    repeticoes += 1;
    intervalo_dias = repeticoes === 1 ? 1 : repeticoes === 2 ? 3 : Math.max(intervalo_dias + 1, Math.round(intervalo_dias * facilidade));
  }
  facilidade = Math.max(1.3, Math.round((facilidade + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))) * 100) / 100);
  return { facilidade, intervalo_dias, repeticoes, acertou: q >= 3 };
}

/** Desempenho de um tema: percentual das estações (0–1); sem estações, usa o acerto dos cartões; sem nada, null. */
export function desempenhoTema({ pontos = 0, maximo = 0, acertos = 0, erros = 0 }) {
  if (maximo > 0) return Math.round((pontos / maximo) * 1000) / 1000;
  if (acertos + erros >= 3) return Math.round((acertos / (acertos + erros)) * 1000) / 1000;
  return null;
}

/** Ordena a trilha. 'fracos' = do menor ao maior desempenho; 'fortes' = do maior ao menor. Sem dados vai depois, por relevância. */
export function ordenarTrilha(temas, ordem = 'fracos') {
  const com = temas.filter((t) => t.desempenho !== null && t.desempenho !== undefined);
  const sem = temas.filter((t) => t.desempenho === null || t.desempenho === undefined);
  const f = ordem === 'fortes' ? -1 : 1;
  com.sort((a, b) => f * (a.desempenho - b.desempenho) || b.relevancia - a.relevancia || a.nome.localeCompare(b.nome, 'pt'));
  sem.sort((a, b) => b.relevancia - a.relevancia || a.nome.localeCompare(b.nome, 'pt'));
  return [...com, ...sem];
}

/** Próximo passo sugerido para o tema, em linguagem de treino (não "revisar tema X"). */
export function proximoPasso(t) {
  if (t.desempenho === null || t.desempenho === undefined) return { passo: 'praticar', texto: 'Ainda sem estação neste tema: faça uma estação cronometrada para medir.' };
  if (t.desempenho < 0.6) return { passo: 'aprofundar', texto: t.cartoes_total ? 'Resumo curto, cartões do dia e refazer a estação logo em seguida.' : 'Leia o resumo, gere a série de cartões e refaça a estação logo em seguida.' };
  if (t.desempenho < 0.8) return { passo: 'consolidar', texto: 'Cartões do dia e uma nova estação em alguns dias.' };
  return { passo: 'manter', texto: 'Mantenha com cartões espaçados e um bloco misto de vez em quando.' };
}

/** Dias até o reteste sugerido de uma estação, conforme o último percentual. */
export const diasParaReteste = (percentual) => (percentual < 0.6 ? 1 : percentual < 0.8 ? 3 : 7);

/**
 * Separa erro transversal (mesmo tipo de erro em 3+ estações diferentes) de erro de tema.
 * Cada lacuna: { erro_tipo, categoria, estacao_id }. Sem erro_tipo, a chave é a categoria.
 */
export function agruparErros(lacunas, minimoTransversal = 3) {
  const grupos = new Map();
  for (const l of lacunas) {
    const chave = l.erro_tipo ?? `cat:${l.categoria}`;
    if (!grupos.has(chave)) grupos.set(chave, { chave, erro_tipo: l.erro_tipo ?? null, categoria: l.categoria, total: 0, estacoes: new Set() });
    const g = grupos.get(chave); g.total += 1; g.estacoes.add(l.estacao_id);
  }
  const lista = [...grupos.values()].map((g) => ({
    chave: g.chave, erro_tipo: g.erro_tipo, categoria: g.categoria, rotulo: g.erro_tipo ? ERROS_TIPO[g.erro_tipo] : `Lacuna de ${g.categoria}`,
    total: g.total, estacoes: g.estacoes.size, transversal: g.estacoes.size >= minimoTransversal,
  }));
  lista.sort((a, b) => b.estacoes - a.estacoes || b.total - a.total);
  return { transversais: lista.filter((g) => g.transversal), de_tema: lista.filter((g) => !g.transversal) };
}
