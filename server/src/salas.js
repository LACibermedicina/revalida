// Salas, ciclos e papéis dinâmicos. A regra de negócio vive em funções do Postgres (db/migracoes/004): cada chamada é
// uma transação atômica que trava a linha da sala. Aqui ficam: validação de entrada, tradução de erros, permissões de
// vídeo e a difusão de estado (cada pessoa recebe o estado FILTRADO pelo seu papel, nunca um estado comum a todos).
import crypto from 'node:crypto';
import { idValido, rota } from './seguranca.js';
import { permissoesDeMidia } from './agora.js';

export const GRACA_SAIDA_MS = 60_000;

const ERROS = {
  NAO_ADMIN: [403, 'Só o administrador da sala pode fazer isso.'],
  NAO_PERMITIDO: [403, 'Você não tem permissão para essa ação.'],
  TRANSCRICAO_ENCERRADA: [409, 'A estação já foi encerrada: a transcrição parou.'],
  NAO_ESTA_NA_SALA: [403, 'Você não está nesta sala.'],
  SALA_INEXISTENTE: [404, 'Sala não encontrada.'],
  CICLO_INEXISTENTE: [404, 'Ciclo não encontrado.'],
  EXECUCAO_INEXISTENTE: [404, 'Estação não encontrada.'],
  SOLICITACAO_INEXISTENTE: [404, 'Pedido não encontrado.'],
  FILA_VAZIA: [400, 'Não há estações para iniciar.'],
  ACAO_INVALIDA: [400, 'Ação inválida.'],
  PAPEL_INVALIDO: [400, 'Papel inválido.'],
  ITEM_INVALIDO: [400, 'Esse item não pertence ao ciclo.'],
  ESTACAO_INEXISTENTE: [400, 'Alguma estação informada não existe.'],
  ESTACAO_NA_FILA: [409, 'Alguma dessas estações já está na fila deste ciclo. Confirme se quer repetir a prática.'],
  EXECUCAO_EM_ANDAMENTO: [409, 'Já existe uma estação em andamento nesta sala.'],
  CICLO_ATIVO: [409, 'Já existe um ciclo ativo. Encerre ou pause o atual primeiro.'],
  CICLO_INATIVO: [409, 'Este ciclo não está ativo.'],
  CICLO_NAO_PAUSADO: [409, 'Este ciclo não está pausado.'],
  SEM_CANDIDATO: [409, 'Defina um candidato presente na sala.'],
  SOLICITACAO_INATIVA: [409, 'Este pedido já foi decidido.'],
  PEDIDO_PENDENTE: [409, 'Você já tem um pedido pendente.'],
  NAO_E_OBSERVADOR: [409, 'Só observadores podem pedir um papel.'],
  EXECUCAO_INATIVA: [409, 'Esta estação não está mais em andamento.'],
  PARTICIPANTE_AUSENTE: [409, 'Essa pessoa não está na sala.'],
  PARTICIPANTE_INVALIDO: [409, 'Escolha outra pessoa para esse papel.'],
  CANDIDATO_NAO_AVALIA: [409, 'O candidato não pode ser o avaliador.'],
  SALA_ENCERRADA: [409, 'Esta sala foi encerrada.'],
  NAO_E_CANDIDATO: [409, 'Você não é o candidato desta sala.'],
  JA_NA_SALA: [409, 'Essa pessoa já está na sala.'],
  CONVITE_PENDENTE: [409, 'Já existe um convite pendente para essa pessoa.'],
  CONVITE_INEXISTENTE: [404, 'Convite não encontrado.'],
  CONVITE_INATIVO: [409, 'Este convite já foi respondido ou cancelado.'],
  CANDIDATO_OCUPADO: [409, 'Já há um candidato na sala. Entre como observador ou aguarde a vaga.'],
};

/** Traduz o erro do Postgres (função de regra) em { status, erro, codigo }; o que não for regra vira 500 genérico. */
export function traduzirErro(e) {
  const bruto = e?.code === 'RV001' ? e.message : (String(e?.stderr ?? e?.message ?? '').match(/ERROR:\s+([A-Z_]{4,})/) ?? [])[1];
  if (bruto && ERROS[bruto]) return { status: ERROS[bruto][0], erro: ERROS[bruto][1], codigo: bruto };
  if (e?.code === '22P02') return { status: 400, erro: 'Identificador inválido.', codigo: 'ID_INVALIDO' };
  if (e?.code === '23505' || e?.code === '40P01' || e?.code === '40001') return { status: 409, erro: 'A sala mudou enquanto você agia. Tente de novo.', codigo: 'CONFLITO' };
  return null;
}

const ids = (v) => Array.isArray(v) && v.length > 0 && v.length <= 60 && v.every(idValido) ? `{${[...new Set(v)].join(',')}}` : null;
const grupo = (g) => (typeof g === 'string' && g.trim() ? g.trim().slice(0, 60) : null);
const snap = (s) => JSON.stringify(s && typeof s === 'object' && !Array.isArray(s) && JSON.stringify(s).length <= 4000 ? s : {});
/** nome do papel que o módulo de mídia entende */
const papelDeMidia = (p) => (p.papel === 'admin' || p.e_avaliador ? 'avaliador_ator' : p.papel === 'candidato' ? 'candidato' : 'observador');

/**
 * Presença com tempo de graça: ao sair/cair, a vaga é liberada na hora; se admin ou candidato do ciclo ativo não
 * voltarem em `gracaMs`, o ciclo (e a estação) são pausados e ficam retomáveis. Os temporizadores vivem na memória do
 * processo: se a API reiniciar nesse intervalo, o ciclo só pausa quando alguém chamar `rv_sala_pausar_por_saida`.
 */
export function criarPresenca({ q, difundir, gracaMs = GRACA_SAIDA_MS, setT = setTimeout, clearT = clearTimeout }) {
  const timers = new Map();
  const cancelar = (salaId) => { const t = timers.get(salaId); if (t) { clearT(t); timers.delete(salaId); } };
  return {
    cancelar,
    async sair(salaId, usuarioId) {
      await q('select rv_sala_sair($1,$2)', [salaId, usuarioId]);
      await difundir(salaId, 'participante_saiu');
      cancelar(salaId);
      const t = setT(async () => {
        timers.delete(salaId);
        try {
          const r = await q('select rv_sala_pausar_por_saida($1) as pausou', [salaId]);
          if (r.rows[0]?.pausou) await difundir(salaId, 'ciclo_pausado');
        } catch (e) { console.error('pausa por saída falhou', e?.message ?? e); }
      }, gracaMs);
      t?.unref?.();
      timers.set(salaId, t);
    },
    pendentes: () => timers.size,
  };
}

const RESULTADOS = new Set(['sim', 'parcial', 'nao']);
/**
 * Nota calculada NO SERVIDOR a partir das marcas do avaliador ({ [item_do_pep]: 'sim' | 'parcial' | 'nao' }).
 * O cliente só diz o que marcou; quanto vale cada item e a soma saem do banco.
 */
export async function calcularNota(q, execucaoId, marcas) {
  if (!marcas || typeof marcas !== 'object' || Array.isArray(marcas)) return { erro: 'Marcas inválidas.' };
  const itens = (await q(
    `select p.id, p.secao, p.descricao, p.pontos_total, p.pontos_parcial, p.critico
       from execucoes e join ciclo_itens i on i.id = e.item_id join pep_itens p on p.estacao_id = i.estacao_id
      where e.id = $1 order by p.ordem`, [execucaoId])).rows;
  const conhecidos = new Set(itens.map((i) => i.id));
  for (const [k, v] of Object.entries(marcas)) {
    if (!conhecidos.has(k)) return { erro: 'Há marca para um item que não pertence a esta estação.' };
    if (!RESULTADOS.has(v)) return { erro: 'Cada marca deve ser sim, parcial ou nao.' };
  }
  let nota = 0, max = 0, criticosFalhos = 0;
  const detalhe = itens.map((i) => {
    const total = Number(i.pontos_total); const parcial = i.pontos_parcial === null ? total / 2 : Number(i.pontos_parcial);
    const r = marcas[i.id] ?? 'nao';                                  // item sem marca conta como não realizado
    const pts = r === 'sim' ? total : r === 'parcial' ? parcial : 0;
    nota += pts; max += total; if (i.critico && r !== 'sim') criticosFalhos++;
    return { id: i.id, secao: i.secao, descricao: i.descricao, critico: i.critico, resultado: r, pontos: pts, pontos_total: total };
  });
  const r2 = (n) => Math.round(n * 100) / 100;
  return { nota: r2(nota), max: r2(max), checklist: { marcas, itens: detalhe, criticos_falhos: criticosFalhos } };
}

export function registrarSalas(app, { q, autenticar, agora, cfg, difundir, presenca, aoFinalizar }) {
  const falha = (res, e) => {
    const t = traduzirErro(e);
    if (!t) throw e;
    return res.status(t.status).json({ erro: t.erro, codigo: t.codigo });
  };
  const idOk = (res, ...valores) => (valores.every(idValido) ? true : (res.status(400).json({ erro: 'Identificador inválido.' }), false));
  /** executa a função de regra, difunde o novo estado e responde */
  const agir = (evento, sql, args) => rota(async (req, res) => {
    try {
      const a = typeof args === 'function' ? args(req) : args;
      if (a === null) return res.status(400).json({ erro: 'Dados inválidos.' });
      const r = (await q(`select ${sql} as r`, a)).rows[0].r;
      const salaId = req.salaId ?? (await salaDe(req)) ?? null;
      if (salaId) await difundir(salaId, evento, { ator: req.usuario.id });
      res.json(r ?? { ok: true });
    } catch (e) { falha(res, e); }
  });
  // descobre a sala a partir do recurso da URL (ciclo, execução ou solicitação)
  const salaDe = async (req) => {
    const p = req.params;
    if (p.id && req.path.startsWith('/api/salas/')) return p.id;
    const tabela = req.path.startsWith('/api/ciclos/') ? 'ciclos' : req.path.startsWith('/api/execucoes/') ? 'execucoes' : req.path.startsWith('/api/solicitacoes/') ? 'solicitacoes_papel' : req.path.startsWith('/api/convites/') ? 'convites_sala' : null;
    if (!tabela) return null;
    return (await q(`select sala_id from ${tabela} where id=$1`, [p.id])).rows[0]?.sala_id ?? null;
  };
  const validarId = (req, res, prox) => (idValido(req.params.id) && (req.params.uid === undefined || idValido(req.params.uid)) && (req.params.item === undefined || idValido(req.params.item))
    ? prox() : res.status(400).json({ erro: 'Identificador inválido.' }));
  const U = (req) => req.usuario.id;

  app.post('/api/salas', autenticar, rota(async (req, res) => {
    const id = (await q('select rv_sala_criar($1) as id', [U(req)])).rows[0].id;
    res.status(201).json({ id });
  }));

  app.post('/api/salas/:id/entrar', autenticar, validarId, rota(async (req, res) => {
    try {
      const r = (await q('select rv_sala_entrar($1,$2) as r', [req.params.id, U(req)])).rows[0].r;
      await difundir(req.params.id, 'participante_entrou');
      res.json(r);
    } catch (e) { falha(res, e); }
  }));

  // Sair de propósito: libera a vaga na hora; admin/candidato têm o tempo de graça antes de o ciclo pausar (como na queda de conexão).
  app.post('/api/salas/:id/sair', autenticar, validarId, rota(async (req, res) => {
    try {
      if (presenca) await presenca.sair(req.params.id, U(req));
      else { await q('select rv_sala_sair($1,$2)', [req.params.id, U(req)]); await difundir(req.params.id, 'participante_saiu'); }
      res.json({ ok: true });
    } catch (e) { falha(res, e); }
  }));

  app.get('/api/salas/:id/estado', autenticar, validarId, rota(async (req, res) => {
    try { res.json((await q('select rv_sala_estado($1,$2) as r', [req.params.id, U(req)])).rows[0].r); } catch (e) { falha(res, e); }
  }));

  app.post('/api/salas/:id/ciclos', autenticar, validarId, agir('ciclo_criado',
    'rv_ciclo_criar($1,$2,$3::uuid[],$4)', (req) => { const l = ids(req.body?.estacoes); return l && [req.params.id, U(req), l, grupo(req.body?.grupo)]; }));
  // Estação que já está na fila: avisa quais são (com a situação de cada uma) e só repete se o pedido confirmar (repetir: true).
  const adicionarItens = agir('itens_adicionados',
    'rv_ciclo_itens_adicionar($1,$2,$3::uuid[],$4,$5)', (req) => { const l = ids(req.body?.estacoes); return l && [req.params.id, U(req), l, grupo(req.body?.grupo), req.body?.repetir === true]; });
  app.post('/api/ciclos/:id/itens', autenticar, validarId, rota(async (req, res, prox) => {
    const l = ids(req.body?.estacoes);
    const admin = l && req.body?.repetir !== true && (await q('select 1 from ciclos c join salas s on s.id = c.sala_id where c.id = $1 and s.admin_id = $2', [req.params.id, U(req)])).rows[0];
    if (admin) { // só o administrador da sala vê os títulos da fila
      const ja = (await q(`select i.estacao_id id, t.titulo, i.posicao,
          coalesce((select e.estado from execucoes e where e.item_id = i.id order by e.iniciada_em desc limit 1), 'na_fila') situacao
        from ciclo_itens i join estacoes t on t.id = i.estacao_id where i.ciclo_id = $1 and i.estacao_id = any($2::uuid[]) order by i.posicao`, [req.params.id, l])).rows;
      if (ja.length) return res.status(409).json({ erro: ja.length === 1 ? `"${ja[0].titulo}" já está na fila deste ciclo. Deseja duplicar a prática dela?` : `${ja.length} dessas estações já estão na fila deste ciclo. Deseja duplicar a prática delas?`, codigo: 'ESTACAO_NA_FILA', repetidas: ja });
    }
    return adicionarItens(req, res, prox);
  }));
  app.patch('/api/ciclos/:id/itens/:item/liberar', autenticar, validarId, agir('item_liberado',
    'rv_item_liberar($1,$3,$2,$4)', (req) => typeof req.body?.liberada === 'boolean' ? [req.params.id, U(req), req.params.item, req.body.liberada] : null));

  app.post('/api/ciclos/:id/execucoes', autenticar, validarId, agir('estacao_iniciada',
    'rv_execucao_iniciar($1,$2,$3)', (req) => (req.body?.item_id === undefined || idValido(req.body.item_id)) ? [req.params.id, U(req), req.body?.item_id ?? null] : null));
  app.post('/api/execucoes/:id/finalizar', autenticar, validarId, rota(async (req, res) => {
    try {
      let nota = req.body?.nota; let checklist = req.body?.checklist; let extra = {}; let confiavel = false;
      if (req.body?.marcas !== undefined) {
        const c = await calcularNota(q, req.params.id, req.body.marcas);
        if (c.erro) return res.status(400).json({ erro: c.erro });
        nota = c.nota; checklist = c.checklist; confiavel = true; extra = { nota: c.nota, max: c.max, criticos_falhos: c.checklist.criticos_falhos };
      } else if (nota !== undefined && nota !== null && !(typeof nota === 'number' && nota >= 0 && nota <= 1000)) return res.status(400).json({ erro: 'Dados inválidos.' });
      const r = (await q('select rv_execucao_finalizar($1,$2,$3,$4::jsonb) as r', [req.params.id, U(req), nota ?? null, confiavel ? JSON.stringify(checklist) : snap(checklist)])).rows[0].r;   // o que o servidor calculou não é cortado
      const sala = await salaDe(req); if (sala) await difundir(sala, 'estacao_finalizada', { ator: U(req) });
      // conferência do PEP pela transcrição (já parada): em segundo plano, nunca atrasa nem derruba a finalização
      if (aoFinalizar) Promise.resolve().then(() => aoFinalizar(req.params.id)).catch(() => {});
      res.json({ ...r, ...extra });
    } catch (e) { falha(res, e); }
  }));

  // Checklist da estação em andamento: SÓ para quem avalia (admin da sala ou avaliador delegado). O candidato nunca recebe o gabarito.
  app.get('/api/execucoes/:id/pep', autenticar, validarId, rota(async (req, res) => {
    const x = (await q(
      `select e.estado, e.iniciada_em, e.avaliador_id, s.admin_id, t.titulo, t.duracao_min, t.script_ator, t.cenario
         from execucoes e join salas s on s.id = e.sala_id join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id where e.id = $1`, [req.params.id])).rows[0];
    if (!x) return res.status(404).json({ erro: ERROS.EXECUCAO_INEXISTENTE[1], codigo: 'EXECUCAO_INEXISTENTE' });
    if (U(req) !== x.admin_id && U(req) !== x.avaliador_id) return res.status(403).json({ erro: ERROS.NAO_PERMITIDO[1], codigo: 'NAO_PERMITIDO' });
    const itens = (await q(
      `select p.id, p.secao, p.ordem, p.descricao, p.pontos_total, p.pontos_parcial, p.critico
         from execucoes e join ciclo_itens i on i.id = e.item_id join pep_itens p on p.estacao_id = i.estacao_id where e.id = $1 order by p.ordem`, [req.params.id])).rows;
    res.json({ estado: x.estado, titulo: x.titulo, duracao_min: x.duracao_min, iniciada_em: x.iniciada_em, script_ator: x.script_ator, cenario: x.cenario, itens });
  }));

  // Estatísticas da última estação finalizada da sala: todos que estão na sala veem (é o feedback do fim da estação).
  app.get('/api/salas/:id/ultima-execucao', autenticar, validarId, rota(async (req, res) => {
    const dentro = (await q('select 1 from sala_participantes where sala_id=$1 and usuario_id=$2 and saiu_em is null', [req.params.id, U(req)])).rows[0];
    if (!dentro) return res.status(403).json({ erro: ERROS.NAO_ESTA_NA_SALA[1], codigo: 'NAO_ESTA_NA_SALA' });
    const x = (await q(
      `select e.id, e.nota, e.checklist, e.iniciada_em, e.finalizada_em, e.candidato_id, e.avaliador_id, i.estacao_id, t.titulo, t.area, t.duracao_min, u.nome candidato_nome,
              extract(epoch from (e.finalizada_em - e.iniciada_em))::int duracao_s,
              (select coalesce(sum(p.pontos_total),0) from pep_itens p where p.estacao_id = i.estacao_id) max
         from execucoes e join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id join usuarios u on u.id = e.candidato_id
        where e.sala_id = $1 and e.estado = 'finalizada' order by e.finalizada_em desc limit 1`, [req.params.id])).rows[0];
    if (!x) return res.json({ ultima: null });
    const hist = (await q(
      `select e.nota, e.finalizada_em from execucoes e join ciclo_itens i on i.id = e.item_id
        where e.candidato_id = $1 and i.estacao_id = $2 and e.estado = 'finalizada' order by e.finalizada_em desc limit 6`, [x.candidato_id, x.estacao_id])).rows;
    const vezes = (await q('select vezes_realizada from usuario_estacao where usuario_id=$1 and estacao_id=$2', [x.candidato_id, x.estacao_id])).rows[0]?.vezes_realizada ?? 1;
    const nota = x.nota === null ? null : Number(x.nota); const max = Number(x.max);
    res.json({ ultima: {
      id: x.id, avaliador_id: x.avaliador_id, titulo: x.titulo, area: x.area, duracao_min: x.duracao_min, duracao_s: x.duracao_s, candidato: x.candidato_nome, finalizada_em: x.finalizada_em,
      nota, max, percentual: nota !== null && max > 0 ? Math.round((nota / max) * 100) : null, vezes_realizada: vezes,
      criticos_falhos: x.checklist?.criticos_falhos ?? null, itens: x.checklist?.itens ?? [],
      historico: hist.map((h) => ({ nota: h.nota === null ? null : Number(h.nota), em: h.finalizada_em })),
    } });
  }));

  /* ---------- cancelar estação, abandonar a vaga de candidato, convidar pessoas online ---------- */
  // Cancelar não finaliza: sem nota, sem contagem de estações feitas e sem feedback; a estação pode ser refeita.
  app.post('/api/execucoes/:id/cancelar', autenticar, validarId, agir('estacao_cancelada',
    'rv_execucao_cancelar($1,$2,$3)', (req) => [req.params.id, U(req), req.body?.liberar_candidato === true]));
  app.post('/api/salas/:id/candidato/abandonar', autenticar, validarId, agir('candidato_abandonou', 'rv_candidato_abandonar($1,$2)', (req) => [req.params.id, U(req)]));

  // Quem avalia vê quem está online e ainda fora da sala (visto nos últimos 90 s). Só nome: nada de e-mail.
  app.get('/api/salas/:id/online', autenticar, validarId, rota(async (req, res) => {
    const s = (await q(`select s.admin_id, exists (select 1 from sala_participantes sp where sp.sala_id = s.id and sp.usuario_id = $2 and sp.e_avaliador and sp.saiu_em is null) av from salas s where s.id = $1`, [req.params.id, U(req)])).rows[0];
    if (!s) return res.status(404).json({ erro: ERROS.SALA_INEXISTENTE[1], codigo: 'SALA_INEXISTENTE' });
    if (s.admin_id !== U(req) && !s.av) return res.status(403).json({ erro: ERROS.NAO_PERMITIDO[1], codigo: 'NAO_PERMITIDO' });
    const busca = String(req.query?.busca ?? '').trim().slice(0, 60).replace(/[%_\\]/g, ' ');
    const r = await q(`select u.id, u.nome, exists (select 1 from convites_sala c where c.sala_id = $1 and c.convidado_id = u.id and c.estado = 'pendente') convidado
        from usuarios u where u.ativo and u.id <> $2 and u.visto_em > now() - interval '90 seconds'
         and not exists (select 1 from sala_participantes sp where sp.sala_id = $1 and sp.usuario_id = u.id and sp.saiu_em is null)
         and ($3 = '' or u.nome ilike '%' || $3 || '%') order by u.nome limit 50`, [req.params.id, U(req), busca]);
    res.json(r.rows);
  }));
  app.post('/api/salas/:id/convites', autenticar, validarId, rota(async (req, res) => {
    const alvo = req.body?.usuario_id;
    if (!idValido(alvo)) return res.status(400).json({ erro: 'Escolha uma pessoa online.' });
    const ok = (await q(`select 1 from usuarios where id = $1 and ativo and visto_em > now() - interval '90 seconds'`, [alvo])).rows[0];
    if (!ok) return res.status(409).json({ erro: 'Essa pessoa não está online agora.', codigo: 'NAO_ONLINE' });
    try {
      const r = (await q('select rv_convite_criar($1,$2,$3) as r', [req.params.id, U(req), alvo])).rows[0].r;
      await difundir(req.params.id, 'convite_enviado', { ator: U(req) });
      res.status(201).json(r);
    } catch (e) { falha(res, e); }
  }));
  app.delete('/api/convites/:id', autenticar, validarId, rota(async (req, res) => {
    try { await q('select rv_convite_cancelar($1,$2)', [req.params.id, U(req)]); const sala = await salaDe(req); if (sala) await difundir(sala, 'convite_cancelado', { ator: U(req) }); res.json({ ok: true }); } catch (e) { falha(res, e); }
  }));
  // Convites que recebi (pendentes). Mostra se a vaga de candidato está livre para eu poder escolher.
  app.get('/api/convites', autenticar, rota(async (req, res) => {
    const r = await q(`select c.id, c.sala_id, c.criado_em, u.nome convidante,
        not exists (select 1 from sala_participantes sp where sp.sala_id = c.sala_id and sp.papel = 'candidato' and sp.saiu_em is null) vaga_candidato,
        exists (select 1 from execucoes e where e.sala_id = c.sala_id and e.estado = 'em_andamento') estacao_em_andamento
      from convites_sala c join usuarios u on u.id = c.convidante_id join salas s on s.id = c.sala_id
     where c.convidado_id = $1 and c.estado = 'pendente' and s.estado = 'aberta' order by c.criado_em desc limit 20`, [U(req)]);
    res.json(r.rows);
  }));
  app.post('/api/convites/:id/responder', autenticar, validarId, rota(async (req, res) => {
    const papel = req.body?.papel === 'candidato' ? 'candidato' : 'observador';
    try {
      const r = (await q('select rv_convite_responder($1,$2,$3,$4) as r', [req.params.id, U(req), req.body?.aceitar === true, papel])).rows[0].r;
      const sala = await salaDe(req); if (sala) await difundir(sala, r.estado === 'aceita' ? 'convite_aceito' : 'convite_recusado', { ator: U(req) });
      res.json(r);
    } catch (e) { falha(res, e); }
  }));

  app.post('/api/ciclos/:id/proximo', autenticar, validarId, agir('ciclo_proximo',
    'rv_ciclo_proximo($1,$2,$3,$4::jsonb)', (req) => typeof req.body?.acao === 'string' ? [req.params.id, U(req), req.body.acao, snap(req.body?.snapshot)] : null));
  app.post('/api/ciclos/:id/retomar', autenticar, validarId, agir('ciclo_retomado', 'rv_ciclo_retomar($1,$2)', (req) => [req.params.id, U(req)]));

  app.post('/api/salas/:id/solicitacoes', autenticar, validarId, agir('papel_solicitado',
    'rv_solicitar_papel($1,$2,$3)', (req) => typeof req.body?.papel === 'string' ? [req.params.id, U(req), req.body.papel] : null));
  app.post('/api/solicitacoes/:id/decidir', autenticar, validarId, agir('papel_decidido',
    'rv_solicitacao_decidir($1,$2,$3,$4::jsonb)', (req) => typeof req.body?.aceitar === 'boolean' ? [req.params.id, U(req), req.body.aceitar, snap(req.body?.snapshot)] : null));
  app.post('/api/solicitacoes/:id/cancelar', autenticar, validarId, rota(async (req, res) => {
    try {
      await q('select rv_solicitacao_cancelar($1,$2)', [req.params.id, U(req)]);
      const s = await salaDe(req); if (s) await difundir(s, 'solicitacao_cancelada');
      res.json({ ok: true });
    } catch (e) { falha(res, e); }
  }));

  app.patch('/api/salas/:id/candidato', autenticar, validarId, agir('candidato_definido',
    'rv_candidato_definir($1,$2,$3)', (req) => idValido(req.body?.usuario_id) ? [req.params.id, U(req), req.body.usuario_id] : null));
  app.patch('/api/salas/:id/avaliador', autenticar, validarId, agir('avaliador_delegado',
    'rv_avaliador_delegar($1,$2,$3)', (req) => idValido(req.body?.usuario_id) ? [req.params.id, U(req), req.body.usuario_id] : null));
  app.patch('/api/salas/:id/participantes/:uid/video', autenticar, validarId, agir('video_alterado',
    'rv_video_pausar($1,$2,$3,$4)', (req) => typeof req.body?.pausado === 'boolean' ? [req.params.id, U(req), req.params.uid, req.body.pausado] : null));

  // O chefe (admin) libera ou bloqueia o áudio dos observadores — padrão: bloqueado.
  app.patch('/api/salas/:id/audio-observadores', autenticar, validarId, rota(async (req, res) => {
    if (typeof req.body?.liberado !== 'boolean') return res.status(400).json({ erro: 'Informe liberado: true ou false.' });
    const r = await q(`update salas set audio_observadores=$3, versao=versao+1 where id=$1 and admin_id=$2 and estado='aberta' returning audio_observadores`, [req.params.id, U(req), req.body.liberado]);
    if (!r.rows[0]) return res.status(403).json({ erro: 'Só o administrador da sala pode mudar isso.', codigo: 'NAO_ADMIN' });
    await difundir(req.params.id, 'audio_observadores');
    res.json({ audio_observadores: r.rows[0].audio_observadores });
  }));

  // Token de vídeo da sala. Vídeo: todos, exceto quem o admin pausou; token curto para a pausa valer em até 2 min
  // mesmo se um cliente adulterado ignorar o aviso. Áudio: principais sempre; observador só se liberado.
  app.get('/api/salas/:id/agora-token', autenticar, validarId, rota(async (req, res) => {
    const r = await q(
      `select s.canal_video, s.audio_observadores, s.estado, sp.papel, sp.e_avaliador, sp.video_pausado_por
       from salas s join sala_participantes sp on sp.sala_id=s.id and sp.usuario_id=$2 and sp.saiu_em is null where s.id=$1`, [req.params.id, U(req)]);
    const p = r.rows[0];
    if (!p) return res.status(403).json({ erro: 'Você não está nesta sala.', codigo: 'NAO_ESTA_NA_SALA' });
    const pausado = p.video_pausado_por !== null;
    const perm = { ...permissoesDeMidia(papelDeMidia(p), p.audio_observadores), };
    perm.video = !pausado;
    const base = { canal: p.canal_video, papel: p.papel, audioObservadores: p.audio_observadores, videoPausado: pausado, pode: perm };
    if (!agora.configurado()) return res.json({ modo: 'demo', ...base });
    const uid = (parseInt(crypto.createHash('md5').update(String(U(req))).digest('hex').slice(0, 8), 16) % 2000000000) + 1;
    const audio = !perm.audio ? 'nenhum' : p.papel === 'observador' ? 'curto' : 'sempre';
    const t = await agora.gerarToken({ canal: p.canal_video, uid, audio, video: pausado ? 'nenhum' : 'curto' });
    res.json({ modo: 'agora', appId: agora.appId(), uid, ...t, ...base, fallbackUrl: cfg.obter('PHP_TOKEN_URL') || null });
  }));
}
