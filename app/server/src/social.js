// Camada social: bloqueio e denúncia entre usuários, notificações, chamados à comunidade, fila de ciclo randômico e trilha guiada.
// Regras duras (valem para TODO o resto do app):
//  • bloqueio é bilateral: quem bloqueou e quem foi bloqueado deixam de se ver (listas, convites, chamados, fila, salas);
//  • denúncia notifica o denunciado e os administradores; o denunciado tem direito de resposta;
//  • padrão: só os dois deixam de se relacionar. Suspensão (7 dias por decisão) só se o administrador decidir.
import crypto from 'node:crypto';
import { idValido, rota, Limitador } from './seguranca.js';
import { traduzirErro } from './salas.js';

export const MOTIVOS = ['assedio', 'conduta', 'conteudo', 'fraude', 'outro'];
export const AREAS = ['clinica_medica', 'cirurgia', 'ginecologia_obstetricia', 'pediatria', 'mfc'];
export const FUSO = 'America/Sao_Paulo';       // "hoje" e dia da semana da trilha
export const SUSPENSAO_DIAS = 7;
const ONLINE = "interval '90 seconds'";

const txt = (v, max) => String(v ?? '').trim().slice(0, max);
const listaIds = (v, max = 10) => (Array.isArray(v) && v.length <= max && v.every(idValido) ? [...new Set(v)] : null);

export function registrarSocial(app, { q, autenticar, difundir = async () => {}, aleatorio = (n) => crypto.randomInt(n) }) {
  const U = (req) => req.usuario.id;
  const exigirAdmin = (req, res, prox) => (['admin', 'root'].includes(req.usuario?.papel_app) ? prox() : res.status(403).json({ erro: 'Sem permissão para esta ação.' }));
  const ADMIN = [autenticar, exigirAdmin];
  const validarId = (req, res, prox) => (idValido(req.params.id) ? prox() : res.status(400).json({ erro: 'Identificador inválido.' }));
  const falha = (res, e) => {
    const t = traduzirErro(e);
    if (!t) throw e;
    return res.status(t.status).json({ erro: t.erro, codigo: t.codigo });
  };
  const limiteDenuncia = new Limitador({ max: 5, janelaMs: 24 * 3600e3 });

  const notificar = (usuario, tipo, dados = {}) => q('insert into notificacoes (usuario_id, tipo, dados) values ($1,$2,$3)', [usuario, tipo, JSON.stringify(dados)]);
  const notificarAdmins = (tipo, dados = {}) => q(
    `insert into notificacoes (usuario_id, tipo, dados) select id, $1, $2 from usuarios where papel_app in ('admin','root') and ativo`, [tipo, JSON.stringify(dados)]);

  /** os dois saem das salas que dividem e os convites pendentes entre eles são cancelados */
  async function separar(a, b) {
    const salas = (await q(
      `select x.sala_id from sala_participantes x join sala_participantes y on y.sala_id = x.sala_id and y.usuario_id = $2 and y.saiu_em is null
        join salas s on s.id = x.sala_id where x.usuario_id = $1 and x.saiu_em is null and s.estado = 'aberta'`, [a, b])).rows;
    for (const s of salas) { await q('select rv_sala_sair($1,$2)', [s.sala_id, a]); await difundir(s.sala_id, 'participante_saiu'); }
    await q(`update convites_sala set estado = 'cancelada', decidido_em = now() where estado = 'pendente' and ((convidante_id = $1 and convidado_id = $2) or (convidante_id = $2 and convidado_id = $1))`, [a, b]);
  }

  /* ================= bloqueio ================= */
  app.get('/api/bloqueios', autenticar, rota(async (req, res) => {
    res.json((await q(`select b.bloqueado_id id, u.nome, b.origem, b.criado_em from bloqueios b join usuarios u on u.id = b.bloqueado_id where b.bloqueador_id = $1 order by b.criado_em desc`, [U(req)])).rows);
  }));
  app.post('/api/bloqueios', autenticar, rota(async (req, res) => {
    const alvo = req.body?.usuario_id;
    if (!idValido(alvo) || alvo === U(req)) return res.status(400).json({ erro: 'Escolha outra pessoa.' });
    const u = (await q('select nome from usuarios where id = $1', [alvo])).rows[0];
    if (!u) return res.status(404).json({ erro: 'Pessoa não encontrada.' });
    await q(`insert into bloqueios (bloqueador_id, bloqueado_id) values ($1,$2) on conflict do nothing`, [U(req), alvo]);
    await separar(U(req), alvo);
    res.status(201).json({ ok: true, nome: u.nome });
  }));
  app.delete('/api/bloqueios/:id', autenticar, validarId, rota(async (req, res) => {
    const r = await q(`delete from bloqueios where bloqueador_id = $1 and bloqueado_id = $2 and origem = 'manual' returning 1`, [U(req), req.params.id]);
    if (!r.rows[0]) return res.status(409).json({ erro: 'Este bloqueio veio de uma denúncia em análise: só o administrador pode encerrá-lo.', codigo: 'BLOQUEIO_DE_DENUNCIA' });
    res.json({ ok: true });
  }));

  /* ================= denúncia ================= */
  app.post('/api/denuncias', autenticar, rota(async (req, res) => {
    const alvo = req.body?.usuario_id; const motivo = req.body?.motivo;
    if (!idValido(alvo) || alvo === U(req)) return res.status(400).json({ erro: 'Escolha outra pessoa.' });
    if (!MOTIVOS.includes(motivo)) return res.status(400).json({ erro: 'Escolha o motivo da denúncia.' });
    const detalhe = txt(req.body?.detalhe, 2000);
    if (motivo === 'outro' && detalhe.length < 10) return res.status(400).json({ erro: 'Descreva o que aconteceu (ao menos 10 caracteres).' });
    const u = (await q('select nome from usuarios where id = $1', [alvo])).rows[0];
    if (!u) return res.status(404).json({ erro: 'Pessoa não encontrada.' });
    const aberta = (await q(`select 1 from denuncias where denunciante_id = $1 and denunciado_id = $2 and estado in ('aberta','respondida','suspensa')`, [U(req), alvo])).rows[0];
    if (aberta) return res.status(409).json({ erro: 'Você já tem uma denúncia em análise contra essa pessoa.', codigo: 'DENUNCIA_ABERTA' });
    if (limiteDenuncia.excedeu(U(req))) return res.status(429).json({ erro: 'Muitas denúncias em 24 horas. Tente amanhã ou fale com o administrador.' });
    limiteDenuncia.registrar(U(req));
    const sala = idValido(req.body?.sala_id) ? req.body.sala_id : null;
    const d = (await q(`insert into denuncias (denunciante_id, denunciado_id, sala_id, motivo, detalhe) values ($1,$2,$3,$4,$5) returning id`,
      [U(req), alvo, sala && (await q('select 1 from salas where id=$1', [sala])).rows[0] ? sala : null, motivo, detalhe])).rows[0];
    // padrão: os dois deixam de se relacionar já
    await q(`insert into bloqueios (bloqueador_id, bloqueado_id, origem) values ($1,$2,'denuncia') on conflict (bloqueador_id, bloqueado_id) do update set origem = 'denuncia'`, [U(req), alvo]);
    await separar(U(req), alvo);
    // o denunciado não vê quem denunciou, mas sabe o motivo e pode responder
    await notificar(alvo, 'denuncia_recebida', { denuncia_id: d.id, motivo });
    await notificarAdmins('denuncia_nova', { denuncia_id: d.id, motivo, denunciante: req.usuario.nome, denunciado: u.nome });
    res.status(201).json({ id: d.id, bloqueado: true });
  }));

  app.get('/api/denuncias/enviadas', autenticar, rota(async (req, res) => {
    res.json((await q(`select d.id, d.motivo, d.estado, d.decisao, d.criada_em, u.nome denunciado from denuncias d join usuarios u on u.id = d.denunciado_id where d.denunciante_id = $1 order by d.criada_em desc limit 30`, [U(req)])).rows);
  }));
  // quem foi denunciado vê o motivo e o relato (nunca quem denunciou) e pode responder
  app.get('/api/denuncias/recebidas', autenticar, rota(async (req, res) => {
    res.json((await q(`select id, motivo, detalhe, estado, resposta, respondida_em, decisao, criada_em from denuncias where denunciado_id = $1 order by criada_em desc limit 30`, [U(req)])).rows);
  }));
  app.post('/api/denuncias/:id/responder', autenticar, validarId, rota(async (req, res) => {
    const resposta = txt(req.body?.resposta, 2000);
    if (resposta.length < 3) return res.status(400).json({ erro: 'Escreva sua resposta.' });
    const r = await q(`update denuncias set resposta = $3, respondida_em = now(), estado = case when estado = 'aberta' then 'respondida' else estado end
      where id = $1 and denunciado_id = $2 and estado in ('aberta','respondida','suspensa') returning id`, [req.params.id, U(req), resposta]);
    if (!r.rows[0]) return res.status(404).json({ erro: 'Denúncia não encontrada ou já encerrada.' });
    await notificarAdmins('denuncia_respondida', { denuncia_id: req.params.id });
    res.json({ ok: true });
  }));

  // administração das denúncias
  app.get('/api/admin/denuncias', ...ADMIN, rota(async (req, res) => {
    const aberto = req.query?.estado !== 'todas';
    res.json((await q(`select d.id, d.motivo, d.detalhe, d.estado, d.resposta, d.respondida_em, d.decisao, d.decisao_nota, d.decidida_em, d.criada_em,
        a.id denunciante_id, a.nome denunciante, b.id denunciado_id, b.nome denunciado, b.suspenso_ate
      from denuncias d join usuarios a on a.id = d.denunciante_id join usuarios b on b.id = d.denunciado_id
      where ($1::boolean is false or d.estado in ('aberta','respondida','suspensa')) order by d.criada_em desc limit 100`, [aberto])).rows);
  }));
  app.post('/api/admin/denuncias/:id/decidir', ...ADMIN, validarId, rota(async (req, res) => {
    const decisao = req.body?.decisao; const nota = txt(req.body?.nota, 1000);
    if (!['manter_bloqueio', 'suspender', 'arquivar'].includes(decisao)) return res.status(400).json({ erro: 'Decisão inválida.' });
    const d = (await q(`select d.*, b.papel_app alvo_papel from denuncias d join usuarios b on b.id = d.denunciado_id where d.id = $1`, [req.params.id])).rows[0];
    if (!d) return res.status(404).json({ erro: 'Denúncia não encontrada.' });
    if (['resolvida', 'arquivada'].includes(d.estado)) return res.status(409).json({ erro: 'Esta denúncia já foi encerrada.' });
    let ate = null;
    if (decisao === 'suspender') {
      if (nota.length < 5) return res.status(400).json({ erro: 'Explique o motivo da suspensão.' });
      if (['admin', 'root'].includes(d.alvo_papel)) return res.status(409).json({ erro: 'Administradores não são suspensos por esta via.' });
      const s = (await q(`insert into suspensoes (usuario_id, denuncia_id, fim, criada_por)
          values ($1,$2, greatest(now(), coalesce((select suspenso_ate from usuarios where id = $1), now())) + make_interval(days => $4), $3) returning fim`,
        [d.denunciado_id, d.id, U(req), SUSPENSAO_DIAS])).rows[0];
      ate = s.fim;
      // sessao_versao muda: as sessões abertas do suspenso caem na hora
      await q('update usuarios set suspenso_ate = $2, sessao_versao = sessao_versao + 1 where id = $1', [d.denunciado_id, ate]);
      await q(`update denuncias set estado='suspensa', decisao=$2, decisao_nota=$3, decidida_por=$4, decidida_em=now() where id=$1`, [d.id, decisao, nota, U(req)]);
    } else {
      await q(`update suspensoes set revogada_em = now() where denuncia_id = $1 and revogada_em is null`, [d.id]);
      await q(`update usuarios set suspenso_ate = null where id = $1 and not exists (select 1 from suspensoes s where s.usuario_id = $1 and s.revogada_em is null and s.fim > now())`, [d.denunciado_id]);
      await q(`update denuncias set estado=$2, decisao=$3, decisao_nota=$4, decidida_por=$5, decidida_em=now() where id=$1`,
        [d.id, decisao === 'arquivar' ? 'arquivada' : 'resolvida', decisao, nota, U(req)]);
      // arquivada: o bloqueio deixa de ser "de denúncia" (quem bloqueou pode desfazer); mantida: continua só os dois sem se relacionar
      if (decisao === 'arquivar') await q(`update bloqueios set origem = 'manual' where bloqueador_id = $1 and bloqueado_id = $2`, [d.denunciante_id, d.denunciado_id]);
    }
    await q(`insert into auditoria_admin (ator_id, acao, alvo, detalhes) values ($1,'denuncia_decidida',$2,$3)`, [U(req), d.id, JSON.stringify({ decisao, nota, ate })]);
    await notificar(d.denunciado_id, 'denuncia_decidida', { denuncia_id: d.id, decisao, ate });
    await notificar(d.denunciante_id, 'denuncia_decidida', { denuncia_id: d.id, decisao });
    res.json({ ok: true, decisao, ate });
  }));

  /* ================= notificações ================= */
  app.get('/api/notificacoes', autenticar, rota(async (req, res) => {
    const itens = (await q(`select id, tipo, dados, lida_em, criada_em from notificacoes where usuario_id = $1 order by criada_em desc limit 30`, [U(req)])).rows;
    res.json({ nao_lidas: itens.filter((i) => !i.lida_em).length, itens });
  }));
  app.post('/api/notificacoes/lidas', autenticar, rota(async (req, res) => {
    await q('update notificacoes set lida_em = now() where usuario_id = $1 and lida_em is null', [U(req)]);
    res.json({ ok: true });
  }));

  /* ================= montagem de sala pareada ================= */
  async function montarSala(admin, candidato, estacoes, origem) {
    const sala = (await q('select rv_sala_criar($1) as id', [admin])).rows[0].id;
    await q('select rv_sala_entrar($1,$2)', [sala, candidato]);
    await q('select rv_candidato_definir($1,$2,$3)', [sala, admin, candidato]);
    // chamado da comunidade: o ciclo já nasce com TODAS as estações pedidas; randômico: começa na primeira e o plano guia as demais
    const fila = origem === 'comunidade' ? estacoes : [estacoes[0]];
    await q('select rv_ciclo_criar($1,$2,$3::uuid[],$4)', [sala, admin, `{${fila.join(',')}}`, origem === 'comunidade' ? 'Chamado' : 'Randômico']);
    if (origem !== 'comunidade') await q(`insert into ciclos_randomicos (sala_id, estacoes, origem) values ($1,$2::uuid[],$3)`, [sala, `{${estacoes.join(',')}}`, origem]);
    return sala;
  }
  /** sorteia estações aprovadas; as que nenhum dos dois fez vêm primeiro. Com orçamento de minutos, preenche o tempo (cada estação vale 2×: papéis invertidos). */
  async function sortearEstacoes(a, b, { area = null, minutos = null } = {}) {
    const r = (await q(
      `select t.id, t.duracao_min from estacoes t where t.status = 'aprovada' and ($1::text is null or t.area = $1)
        order by exists (select 1 from usuario_estacao ue where ue.estacao_id = t.id and ue.usuario_id in ($2,$3)), random() limit 40`, [area, a, b])).rows;
    if (!r.length) return [];
    if (!minutos) return [r[0].id];
    const sel = []; let gasto = 0;
    for (const e of r) { if (sel.length && gasto + 2 * e.duracao_min > minutos) continue; sel.push(e.id); gasto += 2 * e.duracao_min; if (sel.length >= 12) break; }
    return sel;
  }

  /* ================= chamados à comunidade ================= */
  const naoBloqueados = (col) => `not exists (select 1 from bloqueios b where (b.bloqueador_id = $1 and b.bloqueado_id = ${col}) or (b.bloqueador_id = ${col} and b.bloqueado_id = $1))`;
  const expirar = () => q(`update chamados set estado = 'expirado' where estado = 'aberto' and expira_em < now()`);

  app.post('/api/chamados', autenticar, rota(async (req, res) => {
    const area = AREAS.includes(req.body?.area) ? req.body.area : null;
    let estacoes = null;
    if (req.body?.estacoes !== undefined && req.body.estacoes !== null) {
      const l = listaIds(req.body.estacoes);
      if (!l) return res.status(400).json({ erro: 'Lista de estações inválida.' });
      const ok = (await q(`select count(*)::int n from estacoes where id = any($1::uuid[]) and status = 'aprovada'`, [`{${l.join(',')}}`])).rows[0].n;
      if (ok !== l.length) return res.status(400).json({ erro: 'Alguma estação não existe ou não está aprovada.' });
      estacoes = l;
    }
    await q(`update chamados set estado = 'cancelado' where usuario_id = $1 and estado = 'aberto'`, [U(req)]);
    const c = (await q(`insert into chamados (usuario_id, tipo, area, estacoes, mensagem, expira_em) values ($1,'comunidade',$2,$3::uuid[],$4, now() + interval '60 minutes') returning id, expira_em`,
      [U(req), area, estacoes && `{${estacoes.join(',')}}`, txt(req.body?.mensagem, 300)])).rows[0];
    res.status(201).json(c);
  }));
  app.get('/api/chamados', autenticar, rota(async (req, res) => {
    await expirar();
    res.json((await q(`select c.id, c.usuario_id, u.nome, c.area, c.mensagem, c.criado_em, c.expira_em,
        coalesce((select json_agg(json_build_object('id', t.id, 'titulo', t.titulo) order by t.titulo) from estacoes t where t.id = any(c.estacoes)), '[]'::json) estacoes
      from chamados c join usuarios u on u.id = c.usuario_id
      where c.tipo = 'comunidade' and c.estado = 'aberto' and c.usuario_id <> $1 and u.ativo and (u.suspenso_ate is null or u.suspenso_ate <= now())
        and ${naoBloqueados('c.usuario_id')} order by c.criado_em desc limit 50`, [U(req)])).rows);
  }));
  // o meu chamado: aberto, ou já atendido (traz a sala em que fui incluído)
  app.get('/api/chamados/meu', autenticar, rota(async (req, res) => {
    await expirar();
    const c = (await q(`select id, tipo, estado, sala_id, area, mensagem, criado_em, expira_em from chamados where usuario_id = $1 and tipo = 'comunidade' order by criado_em desc limit 1`, [U(req)])).rows[0];
    res.json(c && (c.estado === 'aberto' || (c.estado === 'atendido' && Date.now() - new Date(c.criado_em) < 3 * 3600e3)) ? c : null);
  }));
  app.delete('/api/chamados/:id', autenticar, validarId, rota(async (req, res) => {
    const r = await q(`update chamados set estado = 'cancelado' where id = $1 and usuario_id = $2 and estado = 'aberto' returning 1`, [req.params.id, U(req)]);
    if (!r.rows[0]) return res.status(404).json({ erro: 'Chamado não encontrado.' });
    res.json({ ok: true });
  }));
  // Qualquer usuário pode incluir o autor: numa sala aberta dele (sala_id) ou direto num ciclo de estações específicas (estacoes).
  app.post('/api/chamados/:id/incluir', autenticar, validarId, rota(async (req, res) => {
    await expirar();
    const c = (await q(`select c.id, c.usuario_id, c.area, to_jsonb(c.estacoes) estacoes, u.nome autor_nome from chamados c join usuarios u on u.id = c.usuario_id
        where c.id = $1 and c.tipo = 'comunidade' and c.estado = 'aberto' and u.ativo and (u.suspenso_ate is null or u.suspenso_ate <= now())`, [req.params.id])).rows[0];
    if (!c) return res.status(404).json({ erro: 'Este chamado não está mais aberto.', codigo: 'CHAMADO_FECHADO' });
    if (c.usuario_id === U(req)) return res.status(400).json({ erro: 'Este é o seu próprio chamado.' });
    if ((await q('select rv_bloqueados($1,$2) b', [U(req), c.usuario_id])).rows[0].b) return res.status(404).json({ erro: 'Este chamado não está mais aberto.', codigo: 'CHAMADO_FECHADO' });
    const reivindicar = await q(`update chamados set estado = 'atendido' where id = $1 and estado = 'aberto' returning id`, [c.id]);
    if (!reivindicar.rows[0]) return res.status(409).json({ erro: 'Alguém já incluiu esta pessoa.', codigo: 'CHAMADO_FECHADO' });
    const devolver = () => q(`update chamados set estado = 'aberto' where id = $1`, [c.id]);
    try {
      let sala;
      if (req.body?.sala_id !== undefined) {
        if (!idValido(req.body.sala_id)) { await devolver(); return res.status(400).json({ erro: 'Sala inválida.' }); }
        const s = (await q(`select 1 from salas where id = $1 and admin_id = $2 and estado = 'aberta'`, [req.body.sala_id, U(req)])).rows[0];
        if (!s) { await devolver(); return res.status(403).json({ erro: 'Só o administrador de uma sala aberta pode incluir pessoas.', codigo: 'NAO_ADMIN' }); }
        await q('select rv_sala_entrar($1,$2)', [req.body.sala_id, c.usuario_id]);
        await difundir(req.body.sala_id, 'participante_entrou');
        sala = req.body.sala_id;
      } else {
        const lista = listaIds(req.body?.estacoes) ?? c.estacoes ?? (await sortearEstacoes(U(req), c.usuario_id, { area: c.area || null }));
        if (!lista.length) { await devolver(); return res.status(409).json({ erro: 'Não há estações aprovadas para esse chamado.', codigo: 'SEM_ESTACOES' }); }
        sala = await montarSala(U(req), c.usuario_id, lista, 'comunidade');
      }
      await q('update chamados set sala_id = $2 where id = $1', [c.id, sala]);
      await notificar(c.usuario_id, 'chamado_atendido', { sala_id: sala, por: req.usuario.nome });
      res.json({ sala_id: sala });
    } catch (e) { await devolver(); falha(res, e); }
  }));

  /* ================= fila de ciclo randômico ================= */
  async function parear(meu) {
    const candidatos = (await q(
      `select c.* from chamados c join usuarios u on u.id = c.usuario_id
        where c.tipo = 'randomico' and c.estado = 'aberto' and c.expira_em > now() and c.usuario_id <> $1 and u.ativo
          and (u.suspenso_ate is null or u.suspenso_ate <= now()) and u.visto_em > now() - ${ONLINE}
          and ${naoBloqueados('c.usuario_id')} and (c.area is null or $2::text is null or c.area = $2)
        order by c.criado_em limit 5`, [meu.usuario_id, meu.area || null])).rows;
    for (const par of candidatos) {
      const p = await q(`update chamados set estado = 'atendido' where id = $1 and estado = 'aberto' returning id`, [par.id]);
      if (!p.rows[0]) continue;
      const m = await q(`update chamados set estado = 'atendido' where id = $1 and estado = 'aberto' returning id`, [meu.id]);
      if (!m.rows[0]) { await q(`update chamados set estado = 'aberto' where id = $1`, [par.id]); return null; }
      try {
        const area = meu.area || par.area || null;
        const minutos = meu.minutos && par.minutos ? Math.min(Number(meu.minutos), Number(par.minutos)) : null;
        const est = await sortearEstacoes(meu.usuario_id, par.usuario_id, { area, minutos });
        if (!est.length) { await q(`update chamados set estado = 'aberto' where id = any($1::uuid[])`, [`{${meu.id},${par.id}}`]); return { erro: 'SEM_ESTACOES' }; }
        const [admin, cand] = aleatorio(2) === 0 ? [meu.usuario_id, par.usuario_id] : [par.usuario_id, meu.usuario_id];
        const origem = meu.origem === 'trilha' && par.origem === 'trilha' ? 'trilha' : 'plataforma';
        const sala = await montarSala(admin, cand, est, origem);
        await q('update chamados set sala_id = $2 where id = any($1::uuid[])', [`{${meu.id},${par.id}}`, sala]);
        await notificar(par.usuario_id, 'ciclo_randomico', { sala_id: sala });
        return { sala_id: sala };
      } catch (e) {
        await q(`update chamados set estado = 'aberto' where id = any($1::uuid[])`, [`{${meu.id},${par.id}}`]);
        throw e;
      }
    }
    return null;
  }
  async function entrarNaFila(usuario, { area = null, origem = 'plataforma', minutos = null } = {}) {
    await expirar();
    await q(`update chamados set estado = 'cancelado' where usuario_id = $1 and estado = 'aberto'`, [usuario]);
    const meu = (await q(`insert into chamados (usuario_id, tipo, origem, area, minutos, expira_em) values ($1,'randomico',$2,$3,$4, now() + interval '10 minutes') returning *`, [usuario, origem, area, minutos])).rows[0];
    const r = await parear(meu);
    return r?.sala_id ? { estado: 'pareado', sala_id: r.sala_id } : { estado: 'aguardando', chamado_id: meu.id, ...(r?.erro ? { aviso: 'Ainda não há estações aprovadas para o sorteio.' } : {}) };
  }

  app.post('/api/randomico/entrar', autenticar, rota(async (req, res) => {
    const area = AREAS.includes(req.body?.area) ? req.body.area : null;
    res.status(201).json(await entrarNaFila(U(req), { area }));
  }));
  app.get('/api/randomico/estado', autenticar, rota(async (req, res) => {
    await expirar();
    const c = (await q(`select * from chamados where usuario_id = $1 and tipo = 'randomico' order by criado_em desc limit 1`, [U(req)])).rows[0];
    if (!c) return res.json({ estado: 'ocioso' });
    if (c.estado === 'aberto') {
      const r = await parear(c);
      return res.json(r?.sala_id ? { estado: 'pareado', sala_id: r.sala_id, origem: c.origem } : { estado: 'aguardando', chamado_id: c.id, origem: c.origem });
    }
    if (c.estado === 'atendido' && c.sala_id && Date.now() - new Date(c.criado_em) < 3 * 3600e3) {
      const p = (await q(`select sp.papel, (select u.nome from sala_participantes o join usuarios u on u.id = o.usuario_id where o.sala_id = sp.sala_id and o.usuario_id <> sp.usuario_id limit 1) parceiro
        from sala_participantes sp where sp.sala_id = $1 and sp.usuario_id = $2`, [c.sala_id, U(req)])).rows[0];
      return res.json({ estado: 'pareado', sala_id: c.sala_id, origem: c.origem, papel: p?.papel ?? null, parceiro: p?.parceiro ?? null });
    }
    res.json({ estado: 'ocioso' });
  }));
  app.delete('/api/randomico', autenticar, rota(async (req, res) => {
    await q(`update chamados set estado = 'cancelado' where usuario_id = $1 and tipo = 'randomico' and estado = 'aberto'`, [U(req)]);
    res.json({ ok: true });
  }));
  app.get('/api/randomico/fila', autenticar, rota(async (req, res) => {
    await expirar();
    const n = (await q(`select count(*)::int n from chamados c join usuarios u on u.id = c.usuario_id
      where c.tipo = 'randomico' and c.estado = 'aberto' and c.usuario_id <> $1 and u.visto_em > now() - ${ONLINE} and ${naoBloqueados('c.usuario_id')}`, [U(req)])).rows[0].n;
    res.json({ disponiveis: n });
  }));

  // plano do ciclo randômico da sala (para quem está nela)
  app.get('/api/salas/:id/randomico', autenticar, validarId, rota(async (req, res) => {
    const dentro = (await q('select 1 from sala_participantes where sala_id=$1 and usuario_id=$2 and saiu_em is null', [req.params.id, U(req)])).rows[0];
    if (!dentro) return res.status(403).json({ erro: 'Você não está nesta sala.', codigo: 'NAO_ESTA_NA_SALA' });
    const p = (await q('select sala_id, to_jsonb(estacoes) estacoes, indice, fase, origem, estado from ciclos_randomicos where sala_id = $1', [req.params.id])).rows[0];
    if (!p) return res.json({ ativo: false });
    const ts = (await q(`select t.id, t.titulo, t.duracao_min from unnest($1::uuid[]) with ordinality x(id, n) join estacoes t on t.id = x.id order by x.n`, [`{${p.estacoes.join(',')}}`])).rows;
    res.json({ ativo: p.estado === 'ativo', concluido: p.estado === 'concluido', origem: p.origem, indice: p.indice, fase: p.fase, total: ts.length, estacoes: ts,
      minutos_previstos: ts.reduce((s, t) => s + 2 * t.duracao_min, 0) });
  }));
  // Próxima etapa: depois que a estação da etapa foi finalizada, os papéis se invertem (1×1) e a MESMA estação roda de novo;
  // ao fim das duas voltas passa-se à próxima estação sorteada, com novo sorteio de funções.
  app.post('/api/salas/:id/randomico/seguir', autenticar, validarId, rota(async (req, res) => {
    const sala = req.params.id; const eu = U(req);
    const s = (await q('select admin_id, ciclo_ativo_id from salas where id = $1', [sala])).rows[0];
    if (!s) return res.status(404).json({ erro: 'Sala não encontrada.', codigo: 'SALA_INEXISTENTE' });
    if (s.admin_id !== eu) return res.status(403).json({ erro: 'Só o administrador da sala pode fazer isso.', codigo: 'NAO_ADMIN' });
    const p = (await q('select sala_id, to_jsonb(estacoes) estacoes, indice, fase, origem, estado from ciclos_randomicos where sala_id = $1 for update', [sala])).rows[0];
    if (!p || p.estado !== 'ativo') return res.status(409).json({ erro: 'Esta sala não tem ciclo randômico ativo.', codigo: 'SEM_RANDOMICO' });
    const feitas = (await q(`select count(*)::int n from execucoes where ciclo_id = $1 and estado = 'finalizada'`, [s.ciclo_ativo_id])).rows[0].n;
    if (!feitas) return res.status(409).json({ erro: 'Finalize a estação desta etapa antes de seguir.', codigo: 'ETAPA_EM_ANDAMENTO' });
    try {
      let ciclo = s.ciclo_ativo_id; let admin = eu; let indice = p.indice; let fase = p.fase;
      const inverter = async () => {
        const r = (await q(`select rv_ciclo_proximo($1,$2,'inverter','{}'::jsonb) as r`, [ciclo, admin])).rows[0].r;
        ciclo = r.ciclo_id;
        admin = (await q('select admin_id from salas where id = $1', [sala])).rows[0].admin_id;
      };
      const adicionar = (est) => q('select rv_ciclo_itens_adicionar($1,$2,$3::uuid[],$4,false)', [ciclo, admin, `{${est}}`, 'Randômico']);
      if (fase === 0) {
        await inverter(); await adicionar(p.estacoes[indice]); fase = 1;
      } else {
        indice += 1;
        if (indice >= p.estacoes.length) {
          await q(`select rv_ciclo_proximo($1,$2,'encerrar','{}'::jsonb)`, [ciclo, admin]);
          await q(`update ciclos_randomicos set estado = 'concluido', indice = $2 where sala_id = $1`, [sala, p.estacoes.length]);
          await difundir(sala, 'randomico_concluido');
          return res.json({ concluido: true });
        }
        if (aleatorio(2) === 1) await inverter();           // funções sorteadas de novo a cada estação
        await adicionar(p.estacoes[indice]); fase = 0;
      }
      await q('update ciclos_randomicos set indice = $2, fase = $3 where sala_id = $1', [sala, indice, fase]);
      await difundir(sala, 'randomico_seguiu');
      res.json({ concluido: false, indice, fase, ciclo_id: ciclo, admin_id: admin });
    } catch (e) { falha(res, e); }
  }));

  /* ================= trilha guiada ================= */
  const hoje = async (u) => {
    const t = (await q('select minutos_dia, to_jsonb(dias) dias, ultimo_modo from trilhas where usuario_id = $1', [u])).rows[0];
    if (!t) return { configurada: false };
    const x = (await q(`select (extract(dow from (now() at time zone '${FUSO}')))::int dow,
        coalesce(sum(extract(epoch from (e.finalizada_em - e.iniciada_em))) / 60, 0)::float8 feitos
      from (select 1) z left join execucoes e on e.estado = 'finalizada' and (e.candidato_id = $1 or e.avaliador_id = $1)
        and (e.finalizada_em at time zone '${FUSO}')::date = (now() at time zone '${FUSO}')::date`, [u])).rows[0];
    const feitos = Math.round(x.feitos);
    return { configurada: true, minutos_dia: t.minutos_dia, dias: t.dias, ultimo_modo: t.ultimo_modo, dia_ativo: t.dias.includes(x.dow), minutos_feitos: feitos, restante: Math.max(0, t.minutos_dia - feitos) };
  };
  app.get('/api/trilha', autenticar, rota(async (req, res) => { res.json(await hoje(U(req))); }));
  app.put('/api/trilha', autenticar, rota(async (req, res) => {
    const m = Number(req.body?.minutos_dia);
    if (!Number.isInteger(m) || m < 10 || m > 600) return res.status(400).json({ erro: 'Informe de 10 a 600 minutos por dia.' });
    let dias = [0, 1, 2, 3, 4, 5, 6];                                  // sem escolha = todos os dias
    if (req.body?.dias !== undefined && req.body.dias !== null) {
      if (!Array.isArray(req.body.dias) || req.body.dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return res.status(400).json({ erro: 'Dias inválidos.' });
      if (req.body.dias.length) dias = [...new Set(req.body.dias)].sort();
    }
    await q(`insert into trilhas (usuario_id, minutos_dia, dias) values ($1,$2,$3::int[]) on conflict (usuario_id) do update set minutos_dia = $2, dias = $3::int[], atualizada_em = now()`, [U(req), m, `{${dias.join(',')}}`]);
    res.json(await hoje(U(req)));
  }));
  app.post('/api/trilha/modo', autenticar, rota(async (req, res) => {
    if (!['trilha', 'plataforma'].includes(req.body?.modo)) return res.status(400).json({ erro: 'Modo inválido.' });
    await q('update trilhas set ultimo_modo = $2 where usuario_id = $1', [U(req), req.body.modo]);
    res.json({ ok: true });
  }));
  // A trilha recupera a configuração e entra na fila randômica com o tempo que falta hoje; a sala sorteia as estações até preencher esse tempo.
  app.post('/api/trilha/iniciar', autenticar, rota(async (req, res) => {
    const t = await hoje(U(req));
    if (!t.configurada) return res.status(409).json({ erro: 'Configure sua trilha primeiro.', codigo: 'SEM_TRILHA' });
    if (!t.dia_ativo && req.body?.forcar !== true) return res.status(409).json({ erro: 'Hoje não é um dos seus dias de treino. Quer treinar mesmo assim?', codigo: 'HOJE_NAO_E_DIA' });
    if (t.restante < 10) return res.status(409).json({ erro: 'Você já cumpriu o tempo de hoje. 🎉', codigo: 'META_CUMPRIDA' });
    const r = await entrarNaFila(U(req), { origem: 'trilha', minutos: Math.min(t.restante, 600) });
    res.status(201).json({ ...r, restante: t.restante });
  }));
}
