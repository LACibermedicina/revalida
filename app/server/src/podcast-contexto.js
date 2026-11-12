// Conteúdo pré-formatado para o episódio de podcast, montado NO SERVIDOR a partir de dados do próprio usuário
// (o cliente só diz a origem e os ids; nunca envia o texto que a IA vai ler).
const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const idValido = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const AREAS = { clinica_medica: 'Clínica Médica', cirurgia: 'Cirurgia', ginecologia_obstetricia: 'Ginecologia e Obstetrícia', pediatria: 'Pediatria', mfc: 'Medicina de Família e Comunidade' };
const CATEGORIAS = { conhecimento: 'conhecimento', sequencia: 'sequência da conduta', comunicacao: 'comunicação', tempo: 'gestão do tempo' };
const RESULTADOS = { atendeu: 'fez', parcial: 'fez em parte', nao_atendeu: 'não fez', sim: 'fez', nao: 'não fez' };
export const ORIGENS = ['estacao', 'trilha', 'cartoes', 'erros'];
export class ErroContexto extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

async function estacaoComChecklist(q, estacaoId) {
  const e = (await q('select id, titulo, area, duracao_min from estacoes where id=$1', [estacaoId])).rows[0];
  if (!e) throw new ErroContexto('Estação não encontrada.', 404);
  const itens = (await q('select secao, descricao, pontos_total, critico from pep_itens where estacao_id=$1 order by ordem', [estacaoId])).rows;
  return { e, itens };
}
const blocoTecnico = ({ e, itens }) => {
  const porSecao = new Map();
  for (const i of itens) { if (!porSecao.has(i.secao)) porSecao.set(i.secao, []); porSecao.get(i.secao).push(`${txt(i.descricao, 200)}${i.critico ? ' (item crítico)' : ''}`); }
  return `Estação: "${txt(e.titulo, 140)}", área ${AREAS[e.area] ?? e.area}, ${e.duracao_min} minutos.\nElementos técnicos do checklist, por seção:\n${[...porSecao].slice(0, 12).map(([s, l]) => `- ${txt(s, 60)}: ${l.slice(0, 10).join('; ')}`).join('\n')}`;
};

/** Devolve { titulo, contexto, modo, origem, estacao_id, tema_id } ou lança ErroContexto. `modo` só vale para estação e caderno de erros. */
export async function montarContexto(q, usuarioId, b = {}) {
  const origem = ORIGENS.includes(b.origem) ? b.origem : null;
  if (!origem) throw new ErroContexto('Informe a origem do podcast (estação, trilha, cartões ou caderno de erros).');
  const modo = b.modo === 'aprofundar' ? 'aprofundar' : 'com_desempenho';
  if (origem === 'estacao') {
    if (!idValido(b.estacao_id)) throw new ErroContexto('Informe a estação.');
    const est = await estacaoComChecklist(q, b.estacao_id);
    let contexto = blocoTecnico(est); let m = 'aprofundar';
    if (modo === 'com_desempenho') {
      const ex = idValido(b.execucao_id)
        ? (await q(`select e.id, e.nota, e.checklist from execucoes e join ciclo_itens i on i.id = e.item_id where e.id=$1 and e.candidato_id=$2 and i.estacao_id=$3 and e.estado='finalizada'`, [b.execucao_id, usuarioId, b.estacao_id])).rows[0]
        : (await q(`select e.id, e.nota, e.checklist from execucoes e join ciclo_itens i on i.id = e.item_id where e.candidato_id=$1 and i.estacao_id=$2 and e.estado='finalizada' order by e.finalizada_em desc limit 1`, [usuarioId, b.estacao_id])).rows[0];
      if (!ex) { if (b.modo === 'com_desempenho' && idValido(b.execucao_id)) throw new ErroContexto('Execução não encontrada.', 404); }
      else {
        m = 'com_desempenho';
        const lista = ex.checklist?.itens ?? []; const max = lista.reduce((s, i) => s + Number(i.pontos_total ?? 0), 0);
        const lac = (await q('select categoria, descricao from lacunas where execucao_id=$1 and usuario_id=$2', [ex.id, usuarioId])).rows;
        contexto += `\n\nDESEMPENHO DO ALUNO nesta estação: nota ${ex.nota === null ? 'não calculada' : Number(ex.nota)} de ${max} pontos.\n` +
          lista.slice(0, 30).map((i) => `- ${txt(i.descricao, 160)}: ${RESULTADOS[i.resultado] ?? (i.resultado || 'não registrado')}${i.critico ? ' (crítico)' : ''}`).join('\n') +
          (lac.length ? `\nLacunas registradas pelo aluno: ${lac.slice(0, 10).map((l) => `${CATEGORIAS[l.categoria] ?? l.categoria}${l.descricao ? ` — ${txt(l.descricao, 120)}` : ''}`).join('; ')}.` : '');
      }
    }
    return { titulo: `${m === 'com_desempenho' ? 'Revisão da estação' : 'Aprofundando a estação'}: ${txt(est.e.titulo, 70)}`, contexto, modo: m, origem, estacao_id: est.e.id, tema_id: null,
      aviso: modo === 'com_desempenho' && m === 'aprofundar' ? 'Você ainda não finalizou esta estação, então o episódio só aprofunda o conteúdo.' : undefined };
  }
  if (origem === 'cartoes') {
    const ids = Array.isArray(b.cartao_ids) ? b.cartao_ids.filter(idValido).slice(0, 20) : [];
    let rows;
    if (ids.length) rows = (await q(`select c.frente, c.verso, t.nome tema, t.id tema_id from cartoes c join temas t on t.id = c.tema_id where c.id in (${ids.map((_, i) => `$${i + 1}`).join(',')})`, ids)).rows;
    else if (idValido(b.tema_id)) rows = (await q('select c.frente, c.verso, t.nome tema, t.id tema_id from cartoes c join temas t on t.id = c.tema_id where c.tema_id=$1 order by c.criado_em desc limit 12', [b.tema_id])).rows;
    else throw new ErroContexto('Escolha cartões ou um tema.');
    if (!rows.length) throw new ErroContexto('Sem cartões para este pedido.', 404);
    const tema = rows[0].tema;
    return { titulo: `Revisão de cartões: ${txt(tema, 80)}`, modo: null, origem, estacao_id: null, tema_id: rows.every((r) => r.tema_id === rows[0].tema_id) ? rows[0].tema_id : null,
      contexto: `Cartões para revisar (pergunta | resposta):\n${rows.map((r, i) => `${i + 1}. ${txt(r.frente, 300)} | ${txt(r.verso, 600)}`).join('\n')}` };
  }
  if (origem === 'trilha') {
    const ids = Array.isArray(b.tema_ids) ? b.tema_ids.filter(idValido).slice(0, 6) : (idValido(b.tema_id) ? [b.tema_id] : []);
    if (!ids.length) throw new ErroContexto('Escolha os temas da trilha.');
    const temas = (await q(`select id, nome, area from temas where id in (${ids.map((_, i) => `$${i + 1}`).join(',')})`, ids)).rows;
    if (!temas.length) throw new ErroContexto('Temas não encontrados.', 404);
    const partes = [];
    for (const t of temas) {
      const c = (await q('select frente, verso from cartoes where tema_id=$1 order by criado_em desc limit 4', [t.id])).rows;
      partes.push(`Tema "${txt(t.nome, 100)}"${t.area ? ` (${AREAS[t.area] ?? t.area})` : ''}${c.length ? `. Pontos dos cartões: ${c.map((x) => `${txt(x.frente, 160)} → ${txt(x.verso, 260)}`).join(' | ')}` : ''}`);
    }
    return { titulo: `Trilha de estudo: ${temas.map((t) => txt(t.nome, 40)).slice(0, 3).join(', ')}`, modo: null, origem, estacao_id: null, tema_id: temas.length === 1 ? temas[0].id : null, contexto: `Temas da trilha, do que mais precisa de reforço ao que menos:\n${partes.join('\n')}` };
  }
  // caderno de erros: lacunas recentes do aluno (de uma execução, de uma estação ou as mais recentes)
  const cond = idValido(b.execucao_id) ? ['l.execucao_id = $2', b.execucao_id] : idValido(b.estacao_id) ? ['l.estacao_id = $2', b.estacao_id] : null;
  const rows = (await q(`select l.categoria, l.erro_tipo, l.descricao, e.titulo estacao, p.descricao item from lacunas l join estacoes e on e.id = l.estacao_id left join pep_itens p on p.id = l.pep_item_id
    where l.usuario_id=$1 ${cond ? `and ${cond[0]}` : ''} order by l.criada_em desc limit 20`, cond ? [usuarioId, cond[1]] : [usuarioId])).rows;
  if (!rows.length) throw new ErroContexto('Seu caderno de erros ainda não tem lacunas para este pedido.', 404);
  return { titulo: 'Revisão do meu caderno de erros', modo: 'com_desempenho', origem, estacao_id: cond && idValido(b.estacao_id) ? b.estacao_id : null, tema_id: null,
    contexto: `Erros e lacunas do aluno (mais recentes primeiro):\n${rows.map((r, i) => `${i + 1}. Estação "${txt(r.estacao, 90)}": ${r.item ? `não atendeu "${txt(r.item, 160)}"` : 'lacuna geral'}; categoria ${CATEGORIAS[r.categoria] ?? r.categoria}${r.erro_tipo ? `, tipo ${txt(r.erro_tipo, 40).replace(/_/g, ' ')}` : ''}${r.descricao ? `. Nota do aluno: ${txt(r.descricao, 140)}` : ''}`).join('\n')}` };
}
