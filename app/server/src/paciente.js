// Prática solo com paciente IA. A IA entra na sala como um usuário de sistema (admin e avaliador/ator) e o usuário real é o candidato.
// Assim a estação usa o mesmo caminho das salas (checklist, transcrição, autocorreção, desempenho, registro) e o gabarito nunca chega ao candidato.
import { Limitador, rota } from './seguranca.js';
import { traduzirErro, calcularNota } from './salas.js';
import { notaAutomatica } from './analise-transcricao.js';
import { ErroIA } from './ia.js';
import { respostaHeuristica } from './paciente-ia.js';

export const EMAIL_PACIENTE_IA = 'paciente-ia@sistema.interno';
export const NOME_PACIENTE_IA = 'Paciente IA (ator)';
const MAX_TURNOS = 400;
const limpa = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const ERROS_IA = { IA_NAO_CONFIGURADA: 503, IA_CHAVE_INVALIDA: 502, IA_LIMITE: 429, IA_DEMORA: 504, IA_FALHA: 502, IA_RESPOSTA_INVALIDA: 502, IA_ESQUEMA: 502 };

/** Usuário de sistema que representa a IA (sem senha utilizável: não consegue entrar). */
export async function garantirPacienteIA(q) {
  const r = await q(`insert into usuarios (nome, email, senha_hash, papel_app, sistema) values ($1,$2,'!sem-login','usuario',true)
    on conflict (email) do update set sistema = true returning id`, [NOME_PACIENTE_IA, EMAIL_PACIENTE_IA]);
  return r.rows[0].id;
}

export function registrarPaciente(app, { q, autenticar, ia, contexto, analisar, guardarAnalise, guardarSegmento, itensDaEstacao, difundir = async () => {},
  ID, U, falha, naoAchou, proibido, limitador = new Limitador({ max: 300, janelaMs: 3_600_000 }) }) {
  const erroIA = (res, e) => { if (e instanceof ErroIA) return res.status(ERROS_IA[e.codigo] ?? 502).json({ erro: e.message, codigo: e.codigo }); throw e; };
  const soloIA = async (execId) => (await q('select si.*, e.sala_id from salas_ia si join execucoes e on e.sala_id = si.sala_id where e.id = $1', [execId])).rows[0] ?? null;

  /* ---------- começar ---------- */
  // Estação aleatória do banco (ou uma já escolhida/gerada). Sem script do ator a estação não pode ser praticada com o paciente IA.
  app.post('/api/solo/praticar', autenticar, rota(async (req, res) => {
    const u = U(req); const b = req.body ?? {};
    const aberta = (await q(`select e.id execucao_id, e.sala_id, e.ciclo_id, t.titulo from salas_ia si join execucoes e on e.sala_id = si.sala_id join ciclo_itens i on i.id = e.item_id
        join estacoes t on t.id = i.estacao_id where si.usuario_id = $1 and e.estado = 'em_andamento' order by e.iniciada_em desc limit 1`, [u])).rows[0];
    if (aberta && b.repetir !== true) return res.status(200).json({ retomada: true, execucao_id: aberta.execucao_id, sala_id: aberta.sala_id, titulo: aberta.titulo });
    let est;
    if (b.estacao_id !== undefined) {
      est = (await q(`select id, titulo, area, script_ator, status, origem, variacao_tema from estacoes where id = $1 and (status = 'aprovada' or criado_por = $2)`, [String(b.estacao_id), u])).rows[0];
      if (!est) return res.status(404).json({ erro: 'Estação não encontrada.', codigo: 'ESTACAO_INEXISTENTE' });
    } else {
      const area = ['clinica_medica', 'cirurgia', 'ginecologia_obstetricia', 'pediatria', 'mfc'].includes(b.area) ? b.area : null;
      est = (await q(`select t.id, t.titulo, t.area, t.script_ator, t.status, t.origem, t.variacao_tema from estacoes t left join usuario_estacao ue on ue.estacao_id = t.id and ue.usuario_id = $1
          where t.status = 'aprovada' and length(t.script_ator) >= 20 and exists (select 1 from pep_itens p where p.estacao_id = t.id) and ($2::text is null or t.area = $2)
          order by coalesce(ue.vezes_realizada, 0) asc, random() limit 1`, [u, area])).rows[0];
      if (!est) return res.status(404).json({ erro: 'Nenhuma estação aprovada com script do ator para sortear.', codigo: 'SEM_ESTACAO' });
    }
    if (String(est.script_ator ?? '').trim().length < 20) return res.status(409).json({ erro: 'Esta estação ainda não tem o script do ator; o paciente IA precisa dele.', codigo: 'SEM_SCRIPT' });
    if (!(await q('select 1 from pep_itens where estacao_id = $1 limit 1', [est.id])).rows[0]) return res.status(409).json({ erro: 'Esta estação não tem checklist (PEP).', codigo: 'SEM_PEP' });
    const prat = (await q('select tema from praticas_solo where estacao_id = $1 and usuario_id = $2 order by criado_em desc limit 1', [est.id, u])).rows[0];
    const principal = (await q(`select t.nome from estacao_temas et join temas t on t.id = et.tema_id where et.estacao_id = $1 order by t.relevancia desc, t.nome limit 1`, [est.id])).rows[0];
    const variacao = limpa(prat?.tema || est.variacao_tema || principal?.nome || '', 160);
    const fonte = est.origem === 'ia' ? 'ia' : 'banco';
    try {
      const iaId = await garantirPacienteIA(q);
      const sala = (await q('select rv_sala_criar($1) id', [iaId])).rows[0].id;
      await q('select rv_sala_entrar($1,$2)', [sala, u]);
      await q('select rv_candidato_definir($1,$2,$3)', [sala, iaId, u]);
      const ciclo = (await q('select rv_ciclo_criar($1,$2,$3::uuid[]) id', [sala, iaId, `{${est.id}}`])).rows[0].id;
      const ex = (await q('select rv_execucao_iniciar($1,$2) r', [ciclo, iaId])).rows[0].r;
      await q('insert into salas_ia (sala_id, usuario_id, estacao_id, fonte, tema, variacao_tema) values ($1,$2,$3,$4,$5,$6)', [sala, u, est.id, fonte, variacao, variacao]);
      if (est.origem === 'ia' && variacao && !est.variacao_tema) await q('update estacoes set variacao_tema = $2 where id = $1', [est.id, variacao]);
      res.status(201).json({ execucao_id: ex.execucao_id, sala_id: sala, estacao_id: est.id, titulo: est.titulo, area: est.area, fonte, variacao_tema: variacao });
    } catch (e) { falha(res, e); }
  }));

  /* ---------- conversa com o paciente ---------- */
  app.get('/api/execucoes/:id/paciente', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req)); if (!x) return naoAchou(res);
    if (x.papel !== 'candidato' || !(await soloIA(x.id))) return proibido(res);
    const si = await soloIA(x.id);
    res.json({ estado: x.estado, estacao: { id: x.estacao_id, titulo: x.titulo, area: x.area, duracao_min: x.duracao_min }, iniciada_em: x.iniciada_em, fonte: si.fonte, variacao_tema: si.variacao_tema,
      turnos: (await q('select ordem, autor, texto, criado_em from paciente_turnos where execucao_id = $1 order by ordem', [x.id])).rows });
  }));

  app.post('/api/execucoes/:id/paciente', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req)); if (!x) return naoAchou(res);
    const si = await soloIA(x.id);
    if (x.papel !== 'candidato' || !si) return proibido(res);
    if (x.estado !== 'em_andamento') return res.status(409).json({ erro: 'A estação já foi encerrada.', codigo: 'EXECUCAO_NAO_ANDAMENTO' });
    const texto = limpa(req.body?.texto, 600);
    if (!texto) return res.status(400).json({ erro: 'Escreva ou fale algo para o paciente.' });
    if (limitador.excedeu(U(req))) return res.status(429).json({ erro: 'Muitas mensagens em pouco tempo. Aguarde um pouco.', codigo: 'LIMITE' });
    limitador.registrar(U(req));
    const ja = (await q('select count(*)::int n from paciente_turnos where execucao_id = $1', [x.id])).rows[0].n;
    if (ja >= MAX_TURNOS) return res.status(429).json({ erro: 'Limite de falas desta estação atingido.', codigo: 'LIMITE' });
    const est = (await q('select titulo, area, cenario, script_ator, perfil_paciente from estacoes where id = $1', [x.estacao_id])).rows[0];
    const materiais = (await q('select id, titulo, gatilho from estacao_materiais where estacao_id = $1 order by ordem', [x.estacao_id])).rows;
    const turnos = (await q('select autor, texto from paciente_turnos where execucao_id = $1 order by ordem', [x.id])).rows;
    let fala; let liberar = []; let fonte = 'ia'; let aviso;
    try {
      if (!ia.configurado()) throw new ErroIA('IA_NAO_CONFIGURADA', 'IA não configurada.');
      const r = await ia.responderPaciente({ estacao: est, materiais, turnos, pergunta: texto });
      fala = r.fala; liberar = r.liberar ?? [];
    } catch (e) {
      if (!(e instanceof ErroIA)) throw e;
      fala = respostaHeuristica(est.script_ator, texto); fonte = 'script';
      aviso = e.codigo === 'IA_NAO_CONFIGURADA' ? 'IA não configurada: o paciente respondeu só com trechos do script.' : 'A IA falhou: o paciente respondeu só com trechos do script.';
    }
    const ordem = (await q('select coalesce(max(ordem),0)+1 n from paciente_turnos where execucao_id = $1', [x.id])).rows[0].n;
    await q(`insert into paciente_turnos (execucao_id, ordem, autor, texto) values ($1,$2,'candidato',$3), ($1,$4,'paciente',$5)`, [x.id, ordem, texto, ordem + 1, fala]);
    await guardarSegmento(x.id, texto, Math.max(0, Date.now() - new Date(x.iniciada_em).getTime()), 'navegador').catch(() => {});
    const iaId = await garantirPacienteIA(q);
    const liberados = [];
    for (const mid of liberar) {
      await q('insert into execucao_materiais (execucao_id, material_id, liberado_por) values ($1,$2,$3) on conflict do nothing', [x.id, mid, iaId]);
      const m = materiais.find((y) => y.id === mid); if (m) liberados.push({ id: m.id, titulo: m.titulo });
    }
    if (liberados.length) await difundir(x.sala_id, 'material_liberado', { ator: iaId });
    res.status(201).json({ fala, fonte, aviso, liberados, ordem: ordem + 1 });
  }));

  /* ---------- encerrar e corrigir pela IA ---------- */
  app.post('/api/execucoes/:id/corrigir-ia', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req)); if (!x) return naoAchou(res);
    if (x.papel !== 'candidato' || !(await soloIA(x.id))) return proibido(res);
    if (x.estado !== 'em_andamento') return res.status(409).json({ erro: 'A estação já foi encerrada.', codigo: 'EXECUCAO_NAO_ANDAMENTO' });
    const segmentos = (await q('select texto from transcricoes where execucao_id = $1 order by ordem', [x.id])).rows;
    if (!segmentos.length) return res.status(400).json({ erro: 'Converse com o paciente antes de encerrar: sem fala não há o que corrigir.', codigo: 'SEM_FALA' });
    try {
      const a = await analisar(x, segmentos);
      const peps = await itensDaEstacao(x.estacao_id);
      const parciais = new Map((await q('select id, pontos_parcial from pep_itens where estacao_id=$1 and pontos_parcial is not null', [x.estacao_id])).rows.map((r) => [r.id, Number(r.pontos_parcial)]));
      const base = peps.map((p) => ({ id: p.id, secao: p.secao, descricao: p.descricao, critico: p.critico, resultado: 'nao', pontos: 0, pontos_total: p.pontos_total }));
      const r = notaAutomatica(base, a.itens ?? [], parciais);
      const c = await calcularNota(q, x.id, r.marcas);
      if (c.erro) return res.status(400).json({ erro: c.erro });
      const iaId = await garantirPacienteIA(q);
      const fim = (await q('select rv_execucao_finalizar($1,$2,$3,$4::jsonb) r', [x.id, iaId, c.nota, JSON.stringify(c.checklist)])).rows[0].r;
      await q('update execucoes set transcricao_liberada = true, transcricao_liberada_em = now() where id = $1', [x.id]);
      await guardarAnalise(x.id, true, a, segmentos.length);
      await q(`update ciclos set estado = 'concluido' where id = $1`, [x.ciclo_id]);
      await q(`update salas set estado = 'encerrada', ciclo_ativo_id = null where id = $1`, [x.sala_id]);
      res.json({ ...fim, nota: c.nota, max: c.max, criticos_falhos: c.checklist.criticos_falhos, fonte_correcao: a.fonte, aviso: a.aviso ?? null });
    } catch (e) { if (e instanceof ErroIA) return erroIA(res, e); return falha(res, e); }
  }));

  app.post('/api/execucoes/:id/desistir-ia', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req)); if (!x) return naoAchou(res);
    if (x.papel !== 'candidato' || !(await soloIA(x.id))) return proibido(res);
    try {
      const iaId = await garantirPacienteIA(q);
      await q('select rv_execucao_cancelar($1,$2,true)', [x.id, iaId]);
      await q(`update ciclos set estado = 'encerrado' where id = $1`, [x.ciclo_id]);
      await q(`update salas set estado = 'encerrada', ciclo_ativo_id = null where id = $1`, [x.sala_id]);
      res.json({ ok: true });
    } catch (e) { falha(res, e); }
  }));

  /* ---------- script do ator como estudo e apoio ---------- */
  // Quem já fez a estação (ou modera/criou) estuda o script e os materiais; antes disso o gabarito não sai.
  app.get('/api/estacoes/:id/script-ator', autenticar, ID, rota(async (req, res) => {
    const u = U(req);
    const e = (await q('select id, titulo, area, cenario, script_ator, criado_por from estacoes where id = $1', [req.params.id])).rows[0];
    if (!e) return res.status(404).json({ erro: 'Estação não encontrada.' });
    const papel = (await q('select papel_app from usuarios where id = $1', [u])).rows[0]?.papel_app;
    const fez = (await q('select 1 from usuario_estacao where usuario_id = $1 and estacao_id = $2', [u, e.id])).rows[0];
    if (!(fez || e.criado_por === u || papel === 'admin' || papel === 'moderador')) return res.status(403).json({ erro: 'O script do ator fica disponível para estudo depois que você fizer a estação.', codigo: 'FAZER_ANTES' });
    const materiais = (await q('select id, tipo, titulo, gatilho, conteudo from estacao_materiais where estacao_id = $1 order by ordem', [e.id])).rows;
    res.json({ estacao_id: e.id, titulo: e.titulo, area: e.area, cenario: e.cenario, script_ator: e.script_ator, tem_script: String(e.script_ator).trim().length >= 20, materiais });
  }));

  /* ---------- registro: com quem, quem participou, em que modalidade ---------- */
  app.get('/api/historico/estacoes', autenticar, rota(async (req, res) => {
    const u = U(req); const pagina = Math.max(1, Number.parseInt(req.query?.pagina, 10) || 1); const por = 10;
    const lista = (await q(`with meus as (
        select e.id, e.sala_id, e.ciclo_id, e.item_id, e.estado, e.nota::float8 nota, e.iniciada_em, e.finalizada_em, e.candidato_id, e.avaliador_id, i.estacao_id
          from execucoes e join ciclo_itens i on i.id = e.item_id
         where e.estado = 'finalizada' and (e.candidato_id = $1 or e.avaliador_id = $1 or exists (select 1 from sala_participantes sp where sp.sala_id = e.sala_id and sp.usuario_id = $1 and sp.papel = 'observador' and sp.entrou_em <= e.finalizada_em and (sp.saiu_em is null or sp.saiu_em >= e.iniciada_em))))
        select m.*, count(*) over() total, t.titulo, t.area, t.origem, t.variacao_tema, t.variacao_de, si.sala_id is not null com_ia, si.variacao_tema variacao_pratica, si.fonte fonte_ia,
          case when si.sala_id is not null then 'solo_ia'
               when exists (select 1 from ciclos_randomicos r where r.sala_id = m.sala_id and r.origem = 'trilha') then 'trilha'
               when exists (select 1 from ciclos_randomicos r where r.sala_id = m.sala_id) then 'randomico'
               when exists (select 1 from ciclo_itens x where x.ciclo_id = m.ciclo_id and x.grupo = 'Chamado') then 'comunidade'
               else 'sala' end modalidade,
          (select coalesce(sum(p.pontos_total),0)::float8 from pep_itens p where p.estacao_id = m.estacao_id) maximo
        from meus m join estacoes t on t.id = m.estacao_id left join salas_ia si on si.sala_id = m.sala_id
        order by m.finalizada_em desc limit $2 offset $3`, [u, por, (pagina - 1) * por])).rows;
    const itens = [];
    for (const r of lista) {
      const ps = [{ usuario_id: r.candidato_id, papel: 'candidato' }, ...(r.avaliador_id !== r.candidato_id ? [{ usuario_id: r.avaliador_id, papel: 'avaliador_ator' }] : []),
        ...(await q(`select sp.usuario_id, 'observador' papel from sala_participantes sp where sp.sala_id = $1 and sp.papel = 'observador' and sp.usuario_id <> $2 and sp.entrou_em <= $3 and (sp.saiu_em is null or sp.saiu_em >= $4)`,
          [r.sala_id, r.candidato_id, r.finalizada_em, r.iniciada_em])).rows];
      const nomes = new Map((await q('select id, nome, sistema from usuarios where id = any($1::uuid[])', [`{${[...new Set(ps.map((p) => p.usuario_id))].join(',')}}`])).rows.map((n) => [n.id, n]));
      itens.push({ execucao_id: r.id, estacao_id: r.estacao_id, titulo: r.titulo, area: r.area, data: r.finalizada_em, nota: r.nota, maximo: r.maximo, modalidade: r.modalidade,
        feita_com_ia: Boolean(r.com_ia), estacao_gerada_por_ia: r.origem === 'ia', variacao_tematica: r.variacao_pratica || r.variacao_tema || '', variacao_de: r.variacao_de ?? null,
        participantes: ps.map((p) => { const n = nomes.get(p.usuario_id); return { usuario_id: p.usuario_id, nome: n?.sistema ? 'Paciente IA' : (n?.nome ?? '—'), papel: p.papel, ia: Boolean(n?.sistema), eu: p.usuario_id === u }; }) });
    }
    res.json({ pagina, por, total: lista[0]?.total ? Number(lista[0].total) : 0, itens });
  }));
}
