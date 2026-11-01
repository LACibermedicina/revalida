// Bloqueio, denúncia, chamados à comunidade, fila randômica e trilha guiada (Postgres real, regras no banco).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp, criarBanco, criarQ, jwtFalso } from './ajuda.mjs';
import { registrarSalas } from '../src/salas.js';
import { registrarSocial } from '../src/social.js';
import { criarAutenticar, criarAssinar } from '../src/auth.js';

const bd = criarBanco('rv_social');
const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
const eventos = [];
const agoraFalso = { configurado: () => false, appId: () => 'x', gerarToken: async () => ({ token: 't', expiraEm: 1, audioExpiraEm: null }) };
const autenticar = async (req, _res, prox) => {
  const id = String(req.headers.authorization).split(' ')[1];
  const u = (await q('select id, nome, papel_app from usuarios where id=$1', [id])).rows[0];
  req.usuario = { id, nome: u.nome, papel_app: u.papel_app }; prox();
};
let sorteio = 0;                       // 0 = quem entrou primeiro na fila é o avaliador; muda p/ testar papéis
before(() => {
  const difundir = async (sala, ev) => { eventos.push([sala, ev]); };
  registrarSalas(app, { q, autenticar, agora: agoraFalso, cfg: { obter: () => '' }, difundir });
  registrarSocial(app, { q, autenticar, difundir, aleatorio: () => sorteio });
});
after(() => bd.derrubar());

const uid = async (n, papel = 'usuario') => (await q(`insert into usuarios (nome,email,senha_hash,visto_em,papel_app) values ($1,$2,'x',now(),$3) returning id`, [n, `${n}${Math.random()}@x.com`, papel])).rows[0].id;
const est = async (t, area = 'clinica_medica', dur = 10) => (await q(`insert into estacoes (titulo, area, duracao_min, status) values ($1,$2,$3,'aprovada') returning id`, [t, area, dur])).rows[0].id;
const api = (m, u, t, corpo) => chamar(m, u, { token: t, corpo });

test('bloqueio é bilateral: sai das listas, das salas, dos convites e dos chamados nos dois sentidos', async () => {
  const [ana, bia, caio] = [await uid('Ana'), await uid('Bia'), await uid('Caio')];
  const sala = (await api('POST', '/api/salas', ana)).corpo.id;
  await api('POST', `/api/salas/${sala}/entrar`, bia);
  assert.equal((await api('POST', '/api/bloqueios', ana, { usuario_id: ana })).status, 400, 'não bloqueia a si mesmo');
  assert.equal((await api('POST', '/api/bloqueios', ana, { usuario_id: bia })).status, 201);
  // quem bloqueou (Ana) é a primeira a sair da sala que divide; Bia segue lá
  assert.equal((await q('select count(*)::int n from sala_participantes where sala_id=$1 and usuario_id=$2 and saiu_em is null', [sala, ana])).rows[0].n, 0);
  // convite e lista online: invisível nos dois sentidos
  const sala2 = (await api('POST', '/api/salas', ana)).corpo.id;
  const lista = (await api('GET', `/api/salas/${sala2}/online`, ana)).corpo;
  assert.ok(lista.some((u) => u.id === caio) && !lista.some((u) => u.id === bia), 'Bia não aparece para Ana');
  assert.equal((await api('POST', `/api/salas/${sala2}/convites`, ana, { usuario_id: bia })).status, 409);
  const sala3 = (await api('POST', '/api/salas', bia)).corpo.id;
  assert.ok(!(await api('GET', `/api/salas/${sala3}/online`, bia)).corpo.some((u) => u.id === ana), 'Ana não aparece para Bia (vice-versa)');
  // entrar na sala do outro é barrado pelo banco (mensagem não diz quem bloqueou)
  const ent = await api('POST', `/api/salas/${sala2}/entrar`, bia);
  assert.equal(ent.status, 403); assert.equal(ent.corpo.codigo, 'BLOQUEADO');
  // chamados à comunidade também somem nos dois sentidos
  await api('POST', '/api/chamados', bia, {}); await api('POST', '/api/chamados', caio, {});
  const veAna = (await api('GET', '/api/chamados', ana)).corpo.map((c) => c.usuario_id);
  assert.ok(veAna.includes(caio) && !veAna.includes(bia));
  const bia2 = (await api('GET', '/api/chamados', bia)).corpo.map((c) => c.usuario_id);
  assert.ok(!bia2.includes(ana));
  const c = (await api('GET', '/api/chamados/meu', bia)).corpo;
  assert.equal((await api('POST', `/api/chamados/${c.id}/incluir`, ana, { sala_id: sala2 })).status, 404, 'Ana não consegue incluir Bia');
  // lista de bloqueios é só de quem bloqueou; desbloquear manual funciona e restaura a visibilidade
  assert.equal((await api('GET', '/api/bloqueios', ana)).corpo.length, 1);
  assert.equal((await api('GET', '/api/bloqueios', bia)).corpo.length, 0, 'o bloqueado não sabe');
  assert.equal((await api('DELETE', `/api/bloqueios/${bia}`, ana)).status, 200);
  assert.ok((await api('GET', `/api/salas/${sala2}/online`, ana)).corpo.some((u) => u.id === bia));
});

test('denúncia: bloqueia os dois, notifica denunciado e admin, dá direito de resposta; suspensão só por decisão do admin e por 7 dias', async () => {
  const [dan, eva, adm] = [await uid('Dan'), await uid('Eva'), await uid('Adm', 'admin')];
  assert.equal((await api('POST', '/api/denuncias', dan, { usuario_id: eva, motivo: 'inventado' })).status, 400);
  assert.equal((await api('POST', '/api/denuncias', dan, { usuario_id: eva, motivo: 'outro', detalhe: 'curto' })).status, 400);
  const d = await api('POST', '/api/denuncias', dan, { usuario_id: eva, motivo: 'assedio', detalhe: 'Mensagens insistentes fora da estação.' });
  assert.equal(d.status, 201);
  assert.equal((await api('POST', '/api/denuncias', dan, { usuario_id: eva, motivo: 'assedio' })).status, 409, 'uma denúncia em análise por par');
  // padrão: só os dois deixam de se relacionar
  assert.equal((await q('select origem from bloqueios where bloqueador_id=$1 and bloqueado_id=$2', [dan, eva])).rows[0].origem, 'denuncia');
  assert.equal((await api('DELETE', `/api/bloqueios/${eva}`, dan)).status, 409, 'bloqueio de denúncia não se desfaz sozinho');
  assert.equal((await q('select suspenso_ate from usuarios where id=$1', [eva])).rows[0].suspenso_ate, null, 'sem suspensão automática');
  // notificações
  const nEva = (await api('GET', '/api/notificacoes', eva)).corpo;
  assert.equal(nEva.itens[0].tipo, 'denuncia_recebida'); assert.equal(nEva.nao_lidas, 1);
  assert.ok((await api('GET', '/api/notificacoes', adm)).corpo.itens.some((n) => n.tipo === 'denuncia_nova'));
  // denunciado vê motivo e relato, NUNCA quem denunciou
  const rec = (await api('GET', '/api/denuncias/recebidas', eva)).corpo;
  assert.equal(rec.length, 1); assert.match(rec[0].detalhe, /insistentes/); assert.ok(!JSON.stringify(rec).includes('Dan'));
  assert.equal((await api('POST', `/api/denuncias/${d.corpo.id}/responder`, dan, { resposta: 'Não sou o denunciado.' })).status, 404, 'só o denunciado responde');
  assert.equal((await api('POST', `/api/denuncias/${d.corpo.id}/responder`, eva, { resposta: 'Foi um mal-entendido, não houve insistência.' })).status, 200);
  assert.equal((await q('select estado from denuncias where id=$1', [d.corpo.id])).rows[0].estado, 'respondida');
  // só admin decide
  assert.equal((await api('GET', '/api/admin/denuncias', dan)).status, 403);
  assert.equal((await api('POST', `/api/admin/denuncias/${d.corpo.id}/decidir`, dan, { decisao: 'arquivar' })).status, 403);
  const lista = (await api('GET', '/api/admin/denuncias', adm)).corpo;
  assert.equal(lista[0].denunciante, 'Dan'); assert.match(lista[0].resposta, /mal-entendido/);
  assert.equal((await api('POST', `/api/admin/denuncias/${d.corpo.id}/decidir`, adm, { decisao: 'suspender' })).status, 400, 'suspender exige justificativa');
  const s = await api('POST', `/api/admin/denuncias/${d.corpo.id}/decidir`, adm, { decisao: 'suspender', nota: 'Reincidência comprovada.' });
  assert.equal(s.status, 200);
  const dias = Number((await q(`select extract(epoch from (suspenso_ate - now()))/86400 d from usuarios where id=$1`, [eva])).rows[0].d);
  assert.ok(dias > 6.9 && dias <= 7.01, `suspensão semanal (${dias})`);
  // acesso: a conta suspensa não passa pelo autenticador real
  const SEG = 's'.repeat(40); const auth = criarAutenticar({ q, jwt: jwtFalso, segredo: SEG });
  const v = (await q('select sessao_versao from usuarios where id=$1', [eva])).rows[0].sessao_versao;
  const tk = criarAssinar({ jwt: jwtFalso, segredo: SEG })({ id: eva, nome: 'Eva', papel_app: 'usuario', sessao_versao: v });
  let st; await auth({ headers: { authorization: `Bearer ${tk}` } }, { status(n) { st = n; return this; }, json() {} }, () => { st = 200; });
  assert.equal(st, 403);
  // admin decide pelo arquivamento: levanta a suspensão e devolve ao bloqueador o poder de desbloquear
  assert.equal((await api('POST', `/api/admin/denuncias/${d.corpo.id}/decidir`, adm, { decisao: 'arquivar', nota: 'Sem provas.' })).status, 200);
  assert.equal((await q('select suspenso_ate from usuarios where id=$1', [eva])).rows[0].suspenso_ate, null);
  assert.equal((await api('DELETE', `/api/bloqueios/${eva}`, dan)).status, 200);
  assert.equal((await api('POST', `/api/admin/denuncias/${d.corpo.id}/decidir`, adm, { decisao: 'arquivar' })).status, 409, 'já encerrada');
  assert.ok((await api('GET', '/api/notificacoes', dan)).corpo.itens.some((n) => n.tipo === 'denuncia_decidida'));
  // administrador não é suspenso por esta via
  const d2 = (await api('POST', '/api/denuncias', dan, { usuario_id: adm, motivo: 'conduta' })).corpo.id;
  assert.equal((await api('POST', `/api/admin/denuncias/${d2}/decidir`, adm, { decisao: 'suspender', nota: 'teste teste' })).status, 409);
});

test('chamado público: qualquer usuário inclui o autor numa sala aberta ou direto em ciclo de estações específicas', async () => {
  await q(`delete from chamados`);
  const [gui, hel, ivo] = [await uid('Gui'), await uid('Hel'), await uid('Ivo')];
  const e1 = await est('Cefaleia'); const e2 = await est('Asma');
  assert.equal((await api('POST', '/api/chamados', gui, { estacoes: ['x'] })).status, 400);
  assert.equal((await api('POST', '/api/chamados', gui, { mensagem: 'Quem treina comigo?', estacoes: [e1, e2] })).status, 201);
  const vis = (await api('GET', '/api/chamados', hel)).corpo;
  assert.equal(vis.length, 1); assert.equal(vis[0].estacoes.length, 2); assert.equal((await api('GET', '/api/chamados', gui)).corpo.length, 0, 'não vê o próprio na lista');
  assert.equal((await api('POST', `/api/chamados/${vis[0].id}/incluir`, gui, {})).status, 400);
  // modo 1: sala aberta do usuário que inclui
  const sala = (await api('POST', '/api/salas', hel)).corpo.id;
  assert.equal((await api('POST', `/api/chamados/${vis[0].id}/incluir`, ivo, { sala_id: sala })).status, 403, 'só admin da sala inclui');
  const ok = await api('POST', `/api/chamados/${vis[0].id}/incluir`, hel, { sala_id: sala });
  assert.equal(ok.status, 200); assert.equal(ok.corpo.sala_id, sala);
  assert.equal((await q('select count(*)::int n from sala_participantes where sala_id=$1 and usuario_id=$2 and saiu_em is null', [sala, gui])).rows[0].n, 1);
  assert.equal((await api('POST', `/api/chamados/${vis[0].id}/incluir`, ivo, { sala_id: sala })).status, 404, 'chamado fechado');
  const meu = (await api('GET', '/api/chamados/meu', gui)).corpo; assert.equal(meu.estado, 'atendido'); assert.equal(meu.sala_id, sala);
  assert.equal((await api('GET', '/api/notificacoes', gui)).corpo.itens[0].tipo, 'chamado_atendido');
  // modo 2: ciclo de estações específicas, com o autor como candidato
  await api('POST', '/api/chamados', gui, { estacoes: [e1, e2] });
  const c2 = (await api('GET', '/api/chamados', ivo)).corpo[0];
  const r = await api('POST', `/api/chamados/${c2.id}/incluir`, ivo, {});
  assert.equal(r.status, 200);
  const itens = (await q('select count(*)::int n from ciclo_itens i join salas s on s.ciclo_ativo_id = i.ciclo_id where s.id=$1', [r.corpo.sala_id])).rows[0].n;
  assert.equal(itens, 2, 'o ciclo nasce com as estações pedidas');
  assert.equal((await q(`select papel from sala_participantes where sala_id=$1 and usuario_id=$2`, [r.corpo.sala_id, gui])).rows[0].papel, 'candidato');
  // cancelar o próprio chamado
  await api('POST', '/api/chamados', gui, {}); const c3 = (await api('GET', '/api/chamados/meu', gui)).corpo;
  assert.equal((await api('DELETE', `/api/chamados/${c3.id}`, hel)).status, 404); assert.equal((await api('DELETE', `/api/chamados/${c3.id}`, gui)).status, 200);
});

test('fila randômica: pareia com quem está disponível, respeita bloqueio, sorteia estação e papéis e inverte depois de cada 1×1', async () => {
  const [jo, kai, lia, mel] = [await uid('Jo'), await uid('Kai'), await uid('Lia'), await uid('Mel')];
  const e1 = await est('Randômica A'); const e2 = await est('Randômica B');
  await q(`update estacoes set status='rascunho' where id not in ($1,$2)`, [e1, e2]);
  await api('POST', '/api/bloqueios', jo, { usuario_id: kai });          // Jo e Kai não se pareiam
  assert.equal((await api('POST', '/api/randomico/entrar', jo, {})).corpo.estado, 'aguardando');
  assert.equal((await api('GET', '/api/randomico/fila', kai)).corpo.disponiveis, 0, 'Kai não vê Jo na fila');
  assert.equal((await api('POST', '/api/randomico/entrar', kai, {})).corpo.estado, 'aguardando', 'bloqueados não se pareiam');
  sorteio = 0;
  const par = (await api('POST', '/api/randomico/entrar', lia, {})).corpo;      // Lia pareia com Jo (o mais antigo sem bloqueio)
  assert.equal(par.estado, 'pareado');
  const sala = par.sala_id;
  const papeis = (await q(`select u.nome, sp.papel from sala_participantes sp join usuarios u on u.id=sp.usuario_id where sala_id=$1 order by u.nome`, [sala])).rows;
  assert.deepEqual(papeis.map((p) => p.nome), ['Jo', 'Lia']);
  assert.deepEqual(papeis.map((p) => p.papel).sort(), ['admin', 'candidato']);
  assert.equal((await api('GET', '/api/randomico/estado', jo)).corpo.estado, 'pareado', 'o primeiro da fila descobre ao consultar');
  assert.equal((await api('GET', '/api/randomico/estado', jo)).corpo.parceiro, 'Lia');
  assert.equal((await api('GET', '/api/randomico/estado', kai)).corpo.estado, 'aguardando');
  const adm1 = (await q('select admin_id from salas where id=$1', [sala])).rows[0].admin_id;
  // seguir antes de finalizar não pode
  assert.equal((await api('POST', `/api/salas/${sala}/randomico/seguir`, adm1, {})).corpo.codigo, 'ETAPA_EM_ANDAMENTO');
  const ciclo = (await q('select ciclo_ativo_id c from salas where id=$1', [sala])).rows[0].c;
  const ex = (await api('POST', `/api/ciclos/${ciclo}/execucoes`, adm1, {})).corpo.execucao_id;
  assert.ok(ex);
  assert.equal((await api('POST', `/api/execucoes/${ex}/finalizar`, adm1, { marcas: {} })).status, 200);
  assert.equal((await api('POST', `/api/salas/${sala}/randomico/seguir`, (await q('select id from usuarios where nome=$1', ['Mel'])).rows[0].id, {})).status, 403, 'só o admin segue');
  const s1 = await api('POST', `/api/salas/${sala}/randomico/seguir`, adm1, {});
  assert.equal(s1.status, 200); assert.equal(s1.corpo.fase, 1);
  const adm2 = (await q('select admin_id from salas where id=$1', [sala])).rows[0].admin_id;
  assert.notEqual(adm2, adm1, 'papéis invertidos depois do 1×1');
  const item = (await q(`select i.estacao_id from salas s join ciclo_itens i on i.ciclo_id = s.ciclo_ativo_id where s.id=$1`, [sala])).rows;
  assert.equal(item.length, 1);
  assert.equal(item[0].estacao_id, (await q('select estacoes[1] e from ciclos_randomicos where sala_id=$1', [sala])).rows[0].e, 'a MESMA estação roda de novo');
  const plano = (await api('GET', `/api/salas/${sala}/randomico`, adm2)).corpo;
  assert.equal(plano.total, 1); assert.equal(plano.fase, 1);
  assert.equal((await api('GET', `/api/salas/${sala}/randomico`, mel)).status, 403);
  // segunda volta e conclusão
  const ciclo2 = (await q('select ciclo_ativo_id c from salas where id=$1', [sala])).rows[0].c;
  const ex2 = (await api('POST', `/api/ciclos/${ciclo2}/execucoes`, adm2, {})).corpo.execucao_id;
  await api('POST', `/api/execucoes/${ex2}/finalizar`, adm2, { marcas: {} });
  const fim = await api('POST', `/api/salas/${sala}/randomico/seguir`, adm2, {});
  assert.equal(fim.corpo.concluido, true);
  assert.equal((await api('GET', `/api/salas/${sala}/randomico`, adm2)).corpo.concluido, true);
  // sair da fila
  assert.equal((await api('DELETE', '/api/randomico', kai)).status, 200);
  assert.equal((await api('GET', '/api/randomico/estado', kai)).corpo.estado, 'ocioso');
  // Mel entra e pareia com ninguém (Kai saiu, Jo/Lia estão numa sala): aguardando
  assert.equal((await api('POST', '/api/randomico/entrar', mel, {})).corpo.estado, 'aguardando');
});

test('trilha guiada: só minutos/dias (padrão todos os dias), recupera a configuração e preenche o tempo com estações sorteadas', async () => {
  const [nat, ola, pri] = [await uid('Nat'), await uid('Ola'), await uid('Pri')];
  await q(`update estacoes set status='rascunho'`); await q(`delete from chamados`);
  for (const t of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']) await est(t, 'cirurgia', 10);
  assert.equal((await api('GET', '/api/trilha', nat)).corpo.configurada, false);
  assert.equal((await api('PUT', '/api/trilha', nat, { minutos_dia: 3 })).status, 400);
  assert.equal((await api('PUT', '/api/trilha', nat, { minutos_dia: 60, dias: [9] })).status, 400);
  const t = (await api('PUT', '/api/trilha', nat, { minutos_dia: 60 })).corpo;
  assert.deepEqual(t.dias, [0, 1, 2, 3, 4, 5, 6], 'sem escolha, todos os dias'); assert.equal(t.dia_ativo, true); assert.equal(t.restante, 60);
  assert.equal((await api('PUT', '/api/trilha', ola, { minutos_dia: 40, dias: [] })).corpo.dias.length, 7, 'lista vazia também = todos');
  assert.equal((await api('POST', '/api/trilha/iniciar', pri, {})).corpo.codigo, 'SEM_TRILHA');
  // dia fora da trilha pede confirmação
  const hojeDow = (await api('GET', '/api/trilha', nat)).corpo; void hojeDow;
  const dow = Number((await q(`select extract(dow from (now() at time zone 'America/Sao_Paulo'))::int d`)).rows[0].d);
  await api('PUT', '/api/trilha', pri, { minutos_dia: 30, dias: [(dow + 3) % 7] });
  const fora = await api('POST', '/api/trilha/iniciar', pri, {}); assert.equal(fora.status, 409); assert.equal(fora.corpo.codigo, 'HOJE_NAO_E_DIA');
  assert.equal((await api('POST', '/api/trilha/iniciar', pri, { forcar: true })).status, 201);
  await api('DELETE', '/api/randomico', pri);
  // Nat (60 min) + Ola (40 min): o orçamento é o menor (40); cada estação de 10 min vale 2×10 → 2 estações
  assert.equal((await api('POST', '/api/trilha/iniciar', nat, {})).corpo.estado, 'aguardando');
  const r = (await api('POST', '/api/trilha/iniciar', ola, {})).corpo;
  assert.equal(r.estado, 'pareado');
  const plano = (await api('GET', `/api/salas/${r.sala_id}/randomico`, ola)).corpo;
  assert.equal(plano.origem, 'trilha'); assert.equal(plano.total, 2); assert.equal(plano.minutos_previstos, 40);
  // metas cumpridas: executa de fato → "restante" cai
  await q(`insert into ciclos (sala_id, admin_id, candidato_id, estado) select sala_id, $2, $3, 'encerrado' from ciclos_randomicos where sala_id=$1`, [r.sala_id, nat, ola]);
  const cic = (await q(`select id from ciclos where estado='encerrado' order by criado_em desc limit 1`)).rows[0].id;
  const it = (await q(`insert into ciclo_itens (ciclo_id, estacao_id, posicao) select $1, id, 1 from estacoes limit 1 returning id`, [cic])).rows[0].id;
  await q(`insert into execucoes (sala_id, ciclo_id, item_id, estado, avaliador_id, candidato_id, iniciada_em, finalizada_em, nota) values ($1,$2,$3,'finalizada',$4,$5, now() - interval '25 minutes', now(), 5)`, [r.sala_id, cic, it, nat, ola]);
  assert.equal((await api('GET', '/api/trilha', ola)).corpo.restante, 15, '40 min − 25 min feitos hoje');
  await api('PUT', '/api/trilha', ola, { minutos_dia: 20 });
  assert.equal((await api('POST', '/api/trilha/iniciar', ola, {})).corpo.codigo, 'META_CUMPRIDA');
  assert.equal((await api('POST', '/api/trilha/modo', ola, { modo: 'plataforma' })).status, 200);
  assert.equal((await api('GET', '/api/trilha', ola)).corpo.ultimo_modo, 'plataforma');
});
