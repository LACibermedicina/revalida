// Rotas de criação de estações: manual, por IA (prompt), por arquivo (PDF/imagem → rascunho), pacote .rvpack,
// exportação e materiais extras liberados sob demanda durante a sessão.
import crypto from 'node:crypto';
import { idValido, Limitador, rota } from './seguranca.js';
import { ErroIA } from './ia.js';
import { sincronizarTemas, candidatosPorPrioridade, diretrizesDoTema } from './temas.js';
import { AREAS, FORMATO_PACOTE, MAX_ESTACOES_PACOTE, ESQUEMA_VERSAO, avisosDeCoerencia, validarEstacao } from './estacao-esquema.js';

const MIME_OK = { 'application/pdf': [0x25, 0x50, 0x44, 0x46], 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff] };
export const MAX_ARQUIVO_BYTES = 8 * 1024 * 1024;
const ERROS_IA = { IA_NAO_CONFIGURADA: 503, IA_CHAVE_INVALIDA: 502, IA_LIMITE: 429, IA_DEMORA: 504, IA_FALHA: 502, IA_RESPOSTA_INVALIDA: 502, IA_ESQUEMA: 502 };

/** Confere o tipo pelo conteúdo (não pelo nome nem pelo que o navegador disse) e o tamanho. */
export function validarArquivo({ mime, base64 }) {
  if (!(mime in MIME_OK) && mime !== 'image/webp') return 'Formato não aceito. Use PDF, PNG, JPEG ou WEBP.';
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(base64)) return 'Arquivo inválido.';
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_ARQUIVO_BYTES) return 'O arquivo precisa ter até 8 MB.';
  const ok = mime === 'image/webp'
    ? bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP'
    : MIME_OK[mime].every((b, i) => bytes[i] === b);
  return ok ? null : 'O conteúdo do arquivo não corresponde ao formato informado.';
}

export const somaVerificacao = (estacoes) => crypto.createHash('sha256').update(JSON.stringify(estacoes)).digest('hex');
/** Pacote .rvpack = JSON com soma SHA-256 (detecta corrupção; NÃO prova quem criou — por isso quem não é admin entra em revisão). */
export function montarPacote(estacoes, tipo = 'estacoes') {
  return { formato: FORMATO_PACOTE, versao: ESQUEMA_VERSAO, tipo, criado_em: new Date().toISOString(), estacoes, sha256: somaVerificacao(estacoes) };
}

const SQL_FILHOS = (alvo) => `
  ip as (insert into pep_itens (estacao_id, secao, ordem, descricao, criterio, pontos_total, pontos_parcial, critico)
         select ${alvo}, x.secao, x.ordem, x.descricao, coalesce(x.criterio,''), x.pontos_total, x.pontos_parcial, coalesce(x.critico,false)
         from jsonb_to_recordset($PEP::jsonb) as x(secao text, ordem int, descricao text, criterio text, pontos_total numeric, pontos_parcial numeric, critico boolean) returning 1),
  im as (insert into estacao_materiais (estacao_id, ordem, tipo, titulo, conteudo, gatilho)
         select ${alvo}, x.ordem, x.tipo, x.titulo, x.conteudo, x.gatilho
         from jsonb_to_recordset($MAT::jsonb) as x(ordem int, tipo text, titulo text, conteudo text, gatilho text) returning 1)`;

export function registrarEstacoes(app, { q, autenticar, ia, emitir = () => {}, limitador = new Limitador({ max: 8, janelaMs: 3_600_000 }) }) {
  const ehModerador = (u) => ['moderador', 'admin', 'root'].includes(u.papel_app);
  const ehAdmin = (u) => ['admin', 'root'].includes(u.papel_app);
  const ID = (req, res, prox) => (idValido(req.params.id) ? prox() : res.status(400).json({ erro: 'Identificador inválido.' }));

  /** Uma única instrução SQL (CTEs): a estação e seus filhos entram juntos ou não entram. */
  async function inserir({ estacao, origem, status, usuarioId, semente = null, incertos = [] }) {
    const sql = `with e as (
        insert into estacoes (titulo, area, duracao_min, origem, status, script_ator, instrucoes_candidato, cenario, conceitos, esquema_versao, criado_por, semente, incertos, sintese, objetivos, perfil_paciente, diagnostico_alvo)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,${ESQUEMA_VERSAO},$10,$11,$12::jsonb,$15,$16::jsonb,$17,$18) returning id),
      ${SQL_FILHOS('(select id from e)').replace('$PEP', '$13').replace('$MAT', '$14')}
      select id from e`;
    const r = await q(sql, [estacao.titulo, estacao.area, estacao.duracao_min, origem, status, estacao.script_ator, estacao.instrucoes_candidato, estacao.cenario,
      JSON.stringify(estacao.conceitos), usuarioId, semente, JSON.stringify(incertos), JSON.stringify(estacao.pep), JSON.stringify(estacao.materiais),
      estacao.sintese, JSON.stringify(estacao.objetivos), estacao.perfil_paciente, estacao.diagnostico_alvo]);
    await sincronizarTemas(q, r.rows[0].id);
    return r.rows[0].id;
  }
  async function atualizar(id, estacao, incertos) {
    const sql = `with u as (update estacoes set titulo=$2, area=$3, duracao_min=$4, script_ator=$5, instrucoes_candidato=$6, cenario=$7, conceitos=$8::jsonb, incertos=$9::jsonb, sintese=$12, objetivos=$13::jsonb, perfil_paciente=$14, diagnostico_alvo=$15, atualizado_em=now() where id=$1 returning id),
      dp as (delete from pep_itens where estacao_id=$1), dm as (delete from estacao_materiais where estacao_id=$1),
      ${SQL_FILHOS('$1::uuid').replace('$PEP', '$10').replace('$MAT', '$11')}
      select id from u`;
    const r = (await q(sql, [id, estacao.titulo, estacao.area, estacao.duracao_min, estacao.script_ator, estacao.instrucoes_candidato, estacao.cenario,
      JSON.stringify(estacao.conceitos), JSON.stringify(incertos), JSON.stringify(estacao.pep), JSON.stringify(estacao.materiais),
      estacao.sintese, JSON.stringify(estacao.objetivos), estacao.perfil_paciente, estacao.diagnostico_alvo])).rows[0]?.id ?? null;
    if (r) await sincronizarTemas(q, id);
    return r;
  }
  async function carregar(id) {
    const e = (await q('select id,titulo,area,duracao_min,origem,status,script_ator,instrucoes_candidato,cenario,conceitos,incertos,criado_por,semente,atualizado_em,sintese,objetivos,perfil_paciente,diagnostico_alvo from estacoes where id=$1', [id])).rows[0];
    if (!e) return null;
    e.pep = (await q('select secao,ordem,descricao,criterio,pontos_total::float8 pontos_total,pontos_parcial::float8 pontos_parcial,critico from pep_itens where estacao_id=$1 order by ordem', [id])).rows;
    e.materiais = (await q('select id,ordem,tipo,titulo,conteudo,gatilho from estacao_materiais where estacao_id=$1 order by ordem', [id])).rows;
    return e;
  }
  const erroIA = (res, e) => {
    if (e instanceof ErroIA) return res.status(ERROS_IA[e.codigo] ?? 502).json({ erro: e.message, codigo: e.codigo });
    throw e;
  };
  const limite = (req, res) => {
    if (limitador.excedeu(req.usuario.id)) { res.status(429).json({ erro: 'Muitos pedidos à IA. Tente de novo mais tarde.', codigo: 'LIMITE' }); return true; }
    limitador.registrar(req.usuario.id); return false;
  };

  app.get('/api/ia/estado', autenticar, (_req, res) => res.json({ configurado: ia.configurado(), modelo: ia.configurado() ? ia.modelo() : null, ordem: ia.ordem() }));

  // Teste de conexão de cada provedor/chave (só administração). Devolve status e motivo, nunca a chave.
  app.post('/api/ia/testar', autenticar, rota(async (req, res) => {
    if (!ehAdmin(req.usuario)) return res.status(403).json({ erro: 'Só a administração testa a IA.' });
    if (limite(req, res)) return;
    res.json({ resultados: await ia.testar() });
  }));

  app.get('/api/estacoes/minhas', autenticar, rota(async (req, res) => {
    const r = await q(`select id, titulo, area, origem, status, duracao_min, atualizado_em,
        jsonb_array_length(incertos)::int incertos from estacoes where criado_por=$1 order by atualizado_em desc limit 100`, [req.usuario.id]);
    res.json(r.rows);
  }));

  // Conteúdo completo (roteiro e checklist) só para quem criou e para a moderação: senão quem vai ser avaliado leria o gabarito.
  app.get('/api/estacoes/:id', autenticar, ID, rota(async (req, res) => {
    const e = await carregar(req.params.id);
    if (!e || (e.criado_por !== req.usuario.id && !ehModerador(req.usuario))) return res.status(404).json({ erro: 'Estação não encontrada.' });
    res.json({ ...e, avisos: avisosDeCoerencia(validarEstacao(e).estacao) });
  }));

  app.post('/api/estacoes', autenticar, rota(async (req, res) => {
    const v = validarEstacao(req.body, { completa: false });
    if (!v.ok) return res.status(400).json({ erro: 'Estação inválida.', detalhes: v.erros });
    res.status(201).json({ id: await inserir({ estacao: v.estacao, origem: 'manual', status: 'rascunho', usuarioId: req.usuario.id }) });
  }));

  app.put('/api/estacoes/:id', autenticar, ID, rota(async (req, res) => {
    const e = (await q('select criado_por, status from estacoes where id=$1', [req.params.id])).rows[0];
    const dono = e?.criado_por === req.usuario.id;
    if (!e || !(dono || ehAdmin(req.usuario))) return res.status(404).json({ erro: 'Estação não encontrada.' });
    if (dono && !ehAdmin(req.usuario) && e.status !== 'rascunho') return res.status(409).json({ erro: 'Só rascunhos podem ser editados.', codigo: 'NAO_E_RASCUNHO' });
    const v = validarEstacao(req.body, { completa: false });
    if (!v.ok) return res.status(400).json({ erro: 'Estação inválida.', detalhes: v.erros });
    await atualizar(req.params.id, v.estacao, []); // editar = o revisor já viu os campos incertos
    res.json({ ok: true, avisos: avisosDeCoerencia(v.estacao) });
  }));

  app.delete('/api/estacoes/:id', autenticar, ID, rota(async (req, res) => {
    const e = (await q('select criado_por, status from estacoes where id=$1', [req.params.id])).rows[0];
    const dono = e?.criado_por === req.usuario.id;
    if (!e || !(dono || ehAdmin(req.usuario))) return res.status(404).json({ erro: 'Estação não encontrada.' });
    if (e.status === 'aprovada') return res.status(409).json({ erro: 'Estações aprovadas não são apagadas aqui.', codigo: 'APROVADA' });
    await q('delete from estacoes where id=$1', [req.params.id]);
    res.json({ ok: true });
  }));

  // Publicar: valida de forma COMPLETA. Moderação/admin publica direto; os demais vão para a fila de revisão.
  app.post('/api/estacoes/:id/publicar', autenticar, ID, rota(async (req, res) => {
    const e = await carregar(req.params.id);
    const dono = e?.criado_por === req.usuario.id;
    if (!e || !(dono || ehModerador(req.usuario))) return res.status(404).json({ erro: 'Estação não encontrada.' });
    if (e.status === 'aprovada') return res.status(409).json({ erro: 'Esta estação já está aprovada.', codigo: 'JA_APROVADA' });
    const v = validarEstacao(e, { completa: true });
    if (!v.ok) return res.status(400).json({ erro: 'Faltam itens para publicar.', detalhes: v.erros });
    const status = ehModerador(req.usuario) ? 'aprovada' : 'revisao';
    await q('update estacoes set status=$2, atualizado_em=now() where id=$1', [req.params.id, status]);
    res.json({ status });
  }));

  app.post('/api/estacoes/gerar', autenticar, rota(async (req, res) => {
    if (!ia.configurado()) return res.status(503).json({ erro: 'A IA não está configurada neste servidor.', codigo: 'IA_NAO_CONFIGURADA' });
    const b = req.body ?? {};
    if (b.area !== undefined && b.area !== '' && !AREAS.includes(b.area)) return res.status(400).json({ erro: 'Área inválida.' });
    if (limite(req, res)) return;
    try {
      const str = (v) => (typeof v === 'string' ? v : '');
      const subtema = str(b.subtema);
      // base de referência: "relevantes" sorteia pelos temas mais cobrados; "fracos" pelos seus piores desempenhos
      const candidatosTema = !subtema && ['relevantes', 'fracos'].includes(b.prioridade) ? await candidatosPorPrioridade(q, b.prioridade, req.usuario.id) : undefined;
      const r = await ia.gerarEstacao({ area: b.area || undefined, subtema, dificuldade: b.dificuldade, instrucoes: b.instrucoes, candidatosTema,
        cenario: str(b.cenario), perfil: str(b.perfil), queixa: str(b.queixa), diagnostico_alvo: str(b.diagnostico_alvo), objetivos: Array.isArray(b.objetivos) ? b.objetivos.filter((o) => typeof o === 'string') : [],
        diretrizes: await diretrizesDoTema(q, { nome: str(b.diagnostico_alvo) || subtema, area: b.area || undefined }) });
      const id = await inserir({ estacao: r.estacao, origem: 'ia', status: 'rascunho', usuarioId: req.usuario.id, semente: r.sorteio.semente });
      res.status(201).json({ id, estacao: r.estacao, avisos: r.avisos, sorteados: r.sorteio.sorteados, semente: r.sorteio.semente });
    } catch (e) { erroIA(res, e); }
  }));

  // Variação: nova estação (rascunho) a partir de uma existente, mudando só o que o autor pediu. Quem pode ler a base pode variar.
  app.post('/api/estacoes/:id/variar', autenticar, ID, rota(async (req, res) => {
    if (!ia.configurado()) return res.status(503).json({ erro: 'A IA não está configurada neste servidor.', codigo: 'IA_NAO_CONFIGURADA' });
    const base = await carregar(req.params.id);
    if (!base || !(base.criado_por === req.usuario.id || ehModerador(req.usuario) || base.status === 'aprovada')) return res.status(404).json({ erro: 'Estação não encontrada.' });
    if (limite(req, res)) return;
    try {
      const b = req.body ?? {}; const str = (v) => (typeof v === 'string' ? v : '');
      const { id: _i, criado_por: _c, semente: _s, incertos: _n, atualizado_em: _a, status: _st, origem: _o, ...conteudo } = base;
      const r = await ia.variarEstacao({ base: conteudo, mudancas: { perfil: str(b.perfil), cenario: str(b.cenario), diagnostico_alvo: str(b.diagnostico_alvo), dificuldade: str(b.dificuldade), instrucoes: str(b.instrucoes), abordagem: str(b.abordagem),
          foco: Array.isArray(b.foco) ? b.foco.filter((f) => typeof f === 'string').slice(0, 8) : [] },
        diretrizes: await diretrizesDoTema(q, { nome: str(b.diagnostico_alvo) || base.diagnostico_alvo || base.titulo, area: base.area }) });
      const id = await inserir({ estacao: r.estacao, origem: 'ia', status: 'rascunho', usuarioId: req.usuario.id });
      res.status(201).json({ id, estacao: r.estacao, avisos: r.avisos, base_id: base.id });
    } catch (e) { erroIA(res, e); }
  }));

  app.post('/api/estacoes/importar-arquivo', autenticar, rota(async (req, res) => {
    if (!ia.configurado()) return res.status(503).json({ erro: 'A IA não está configurada neste servidor.', codigo: 'IA_NAO_CONFIGURADA' });
    const falha = validarArquivo({ mime: req.body?.mime, base64: req.body?.base64 });
    if (falha) return res.status(400).json({ erro: falha });
    if (limite(req, res)) return;
    try {
      const r = await ia.extrairDeArquivo({ mime: req.body.mime, base64: req.body.base64 });
      const id = await inserir({ estacao: r.estacao, origem: 'importada', status: 'rascunho', usuarioId: req.usuario.id, incertos: r.incertos });
      res.status(201).json({ id, estacao: r.estacao, incertos: r.incertos, avisos: r.avisos });
    } catch (e) { erroIA(res, e); }
  }));

  // Pacote próprio: importa em lote, sem passar pelo painel de revisão. Admin → aprovada; os demais → fila de revisão.
  app.post('/api/estacoes/importar-pacote', autenticar, rota(async (req, res) => {
    const p = req.body?.pacote;
    if (!p || p.formato !== FORMATO_PACOTE || !Array.isArray(p.estacoes)) return res.status(400).json({ erro: 'Arquivo não é um pacote .rvpack.' });
    if (p.versao > ESQUEMA_VERSAO) return res.status(400).json({ erro: 'Pacote de uma versão mais nova. Atualize o app.' });
    if (p.sha256 !== somaVerificacao(p.estacoes)) return res.status(400).json({ erro: 'O pacote está corrompido ou foi alterado (soma de verificação não confere).' });
    if (p.estacoes.length === 0 || p.estacoes.length > MAX_ESTACOES_PACOTE) return res.status(400).json({ erro: `O pacote precisa ter de 1 a ${MAX_ESTACOES_PACOTE} estações.` });
    const status = ehAdmin(req.usuario) ? 'aprovada' : 'revisao';
    const resultado = [];
    for (const [i, bruto] of p.estacoes.entries()) {
      const v = validarEstacao(bruto, { completa: true });
      if (!v.ok) { resultado.push({ posicao: i, titulo: String(bruto?.titulo ?? '').slice(0, 120), ok: false, erros: v.erros.slice(0, 5) }); continue; }
      // pacote que declara trechos incertos (ex.: importado do caderno INEP) entra como rascunho, nunca aprovado direto
      const incertos = Array.isArray(bruto.incertos) ? bruto.incertos.filter((x) => typeof x === 'string').slice(0, 20) : [];
      const id = await inserir({ estacao: v.estacao, origem: 'importada', status: incertos.length ? 'rascunho' : status, usuarioId: req.usuario.id, incertos });
      resultado.push({ posicao: i, titulo: v.estacao.titulo, ok: true, id, incertos });
    }
    res.status(201).json({ status, importadas: resultado.filter((r) => r.ok).length, rejeitadas: resultado.filter((r) => !r.ok).length, resultado });
  }));

  app.post('/api/estacoes/exportar', autenticar, rota(async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_ESTACOES_PACOTE || !ids.every(idValido)) return res.status(400).json({ erro: 'Informe de 1 a 100 estações.' });
    const lista = [];
    for (const id of ids) {
      const e = await carregar(id);
      // exporta o gabarito: só o autor e a moderação
      if (!e || (e.criado_por !== req.usuario.id && !ehModerador(req.usuario))) return res.status(404).json({ erro: 'Estação não encontrada.' });
      lista.push({ titulo: e.titulo, area: e.area, duracao_min: e.duracao_min, instrucoes_candidato: e.instrucoes_candidato, cenario: e.cenario, script_ator: e.script_ator,
        pep: e.pep, materiais: e.materiais.map(({ ordem, tipo, titulo, conteudo, gatilho }) => ({ ordem, tipo, titulo, conteudo, gatilho })), conceitos: e.conceitos });
    }
    res.json(montarPacote(lista));
  }));

  /* ---------- materiais extras sob demanda, durante a sessão ---------- */
  const papelNaSessao = async (sessaoId, usuarioId) => (await q('select papel from sessao_participantes where sessao_id=$1 and usuario_id=$2', [sessaoId, usuarioId])).rows[0]?.papel ?? null;

  app.get('/api/sessoes/:id/materiais', autenticar, ID, rota(async (req, res) => {
    const papel = await papelNaSessao(req.params.id, req.usuario.id);
    if (!papel) return res.status(403).json({ erro: 'Você não está nesta sessão.' });
    const r = await q(`select m.id, m.tipo, m.titulo, m.gatilho, (sm.material_id is not null) liberado,
        case when sm.material_id is not null then m.conteudo end conteudo
      from sessoes s join estacao_materiais m on m.estacao_id = s.estacao_id
      left join sessao_materiais sm on sm.sessao_id = s.id and sm.material_id = m.id
      where s.id = $1 order by m.ordem`, [req.params.id]);
    // quem é avaliado só vê o que já foi liberado; título e gatilho dos demais denunciariam o que existe
    res.json(papel === 'avaliador_ator' ? r.rows : r.rows.filter((m) => m.liberado).map(({ gatilho, ...m }) => m));
  }));

  app.post('/api/sessoes/:id/materiais/:mid/liberar', autenticar, ID, rota(async (req, res) => {
    if (!idValido(req.params.mid)) return res.status(400).json({ erro: 'Identificador inválido.' });
    if ((await papelNaSessao(req.params.id, req.usuario.id)) !== 'avaliador_ator') return res.status(403).json({ erro: 'Só o avaliador libera materiais.' });
    const m = (await q(`select m.id, m.tipo, m.titulo, m.conteudo from estacao_materiais m join sessoes s on s.estacao_id = m.estacao_id where s.id=$1 and m.id=$2`, [req.params.id, req.params.mid])).rows[0];
    if (!m) return res.status(404).json({ erro: 'Material não encontrado.' });
    await q(`insert into sessao_materiais (sessao_id, material_id, liberado_por) values ($1,$2,$3) on conflict do nothing`, [req.params.id, req.params.mid, req.usuario.id]);
    emitir(req.params.id, 'material:liberado', { id: m.id, tipo: m.tipo, titulo: m.titulo, conteudo: m.conteudo, liberado: true });
    res.json({ ok: true });
  }));
}
