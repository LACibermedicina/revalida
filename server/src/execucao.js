// Durante e depois da estação: cartas liberadas ao candidato, transcrição da fala, conferência do PEP pela transcrição,
// painel de análise, revisão da nota e cartões de revisão ligados à estação.
// Regras que não dependem de confiança no navegador: o candidato nunca recebe o gabarito; nada é transcrito depois do
// encerramento (gatilho no banco); sugestão da transcrição nunca vira nota sozinha (quem avalia decide).
import { idValido, Limitador, rota } from './seguranca.js';
import { ErroIA, audioOk } from './ia.js';
import { traduzirErro, calcularNota } from './salas.js';
import { diasParaReteste } from './estudo-logica.js';
import { garantirTema, diretrizesDoTema } from './temas.js';
import { referenciasDaEstacao } from './temas.js';
import { FONTES_GERAIS, agruparPorMinuto, notaAutomatica, analisarHeuristica, cartoesDoPEP, compararComMarcacao, compararSecoes, juntarTranscricao, pontosFortesEFracos, porSecao, sugestoesDeItens } from './analise-transcricao.js';

const ERROS_IA = { IA_NAO_CONFIGURADA: 503, IA_CHAVE_INVALIDA: 502, IA_LIMITE: 429, IA_DEMORA: 504, IA_FALHA: 502, IA_ESQUEMA: 502 };
const MAX_SEGMENTOS = 3000;
const MAX_AUDIO_B64 = 2_000_000;
const limpa = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

export function registrarExecucao(app, { q, autenticar, ia, difundir = async () => {}, relogio = Date.now, intervaloAoVivoMs = 15_000, limitador = new Limitador({ max: 40, janelaMs: 3_600_000 }) }) {
  const ID = (req, res, prox) => (idValido(req.params.id) && (req.params.mid === undefined || idValido(req.params.mid)) ? prox() : res.status(400).json({ erro: 'Identificador inválido.' }));
  const U = (req) => req.usuario.id;
  const ultimaAoVivo = new Map();

  /** Execução + papel de quem pergunta: candidato, avaliador (delegado ou chefe da sala) ou observador presente na sala. */
  async function contexto(execId, usuarioId) {
    const x = (await q(`select e.id, e.estado, e.sala_id, e.avaliador_id, e.candidato_id, e.iniciada_em, e.finalizada_em, e.nota, e.checklist, e.nota_original,
        s.admin_id, i.estacao_id, t.titulo, t.area, t.cenario, t.instrucoes_candidato, t.diagnostico_alvo, t.duracao_min,
        exists (select 1 from sala_participantes sp where sp.sala_id = e.sala_id and sp.usuario_id = $2 and sp.saiu_em is null) presente
      from execucoes e join salas s on s.id = e.sala_id join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id where e.id = $1`, [execId, usuarioId])).rows[0];
    if (!x) return null;
    x.papel = usuarioId === x.candidato_id ? 'candidato' : (usuarioId === x.avaliador_id || usuarioId === x.admin_id) ? 'avaliador' : x.presente ? 'observador' : null;
    return x;
  }
  const naoAchou = (res) => res.status(404).json({ erro: 'Estação não encontrada.', codigo: 'EXECUCAO_INEXISTENTE' });
  const proibido = (res) => res.status(403).json({ erro: 'Você não tem permissão para isso.', codigo: 'NAO_PERMITIDO' });
  const falha = (res, e) => { const t = traduzirErro(e); if (!t) throw e; return res.status(t.status).json({ erro: t.erro, codigo: t.codigo }); };
  const erroIA = (res, e) => { if (e instanceof ErroIA) return res.status(ERROS_IA[e.codigo] ?? 502).json({ erro: e.message, codigo: e.codigo }); throw e; };
  const limite = (req, res) => { if (limitador.excedeu(U(req))) { res.status(429).json({ erro: 'Muitos pedidos à IA. Tente de novo mais tarde.', codigo: 'LIMITE' }); return true; } limitador.registrar(U(req)); return false; };

  /* ---------------- cartas da estação ---------------- */
  // Ao iniciar, descrição e cenário já aparecem para quem não avalia. Materiais: o avaliador vê todos (com o gatilho) e libera;
  // candidato e observadores só recebem o que foi liberado, sem gatilho (o título dos demais denunciaria o que existe).
  app.get('/api/execucoes/:id/cartas', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req));
    if (!x) return naoAchou(res);
    if (!x.papel) return proibido(res);
    const todos = (await q(`select m.id, m.tipo, m.titulo, m.gatilho, m.conteudo, (em.material_id is not null) liberado
        from ciclo_itens i join estacao_materiais m on m.estacao_id = i.estacao_id
        left join execucao_materiais em on em.execucao_id = $1 and em.material_id = m.id
       where i.id = (select item_id from execucoes where id = $1) order by m.ordem`, [x.id])).rows;
    const iniciais = [
      { tipo: 'descricao', titulo: 'Descrição da estação', corpo: x.instrucoes_candidato || '' },
      { tipo: 'cenario', titulo: 'Cenário', corpo: x.cenario || '' },
    ].filter((c) => c.corpo.trim());
    const materiais = x.papel === 'avaliador'
      ? todos.map((m) => ({ id: m.id, tipo: m.tipo, titulo: m.titulo, gatilho: m.gatilho, liberado: m.liberado, conteudo: m.conteudo }))
      : todos.filter((m) => m.liberado).map((m) => ({ id: m.id, tipo: m.tipo, titulo: m.titulo, liberado: true, conteudo: m.conteudo }));
    res.json({ estado: x.estado, papel: x.papel, iniciais, materiais });
  }));

  app.post('/api/execucoes/:id/cartas/:mid/liberar', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req));
    if (!x) return naoAchou(res);
    if (x.papel !== 'avaliador') return proibido(res);
    if (x.estado !== 'em_andamento') return res.status(409).json({ erro: 'A estação não está em andamento.', codigo: 'EXECUCAO_NAO_ANDAMENTO' });
    const m = (await q(`select m.id from estacao_materiais m where m.id = $1 and m.estacao_id = $2`, [req.params.mid, x.estacao_id])).rows[0];
    if (!m) return res.status(404).json({ erro: 'Carta não encontrada nesta estação.' });
    await q('insert into execucao_materiais (execucao_id, material_id, liberado_por) values ($1,$2,$3) on conflict do nothing', [x.id, m.id, U(req)]);
    await difundir(x.sala_id, 'material_liberado', { ator: U(req) });
    res.json({ ok: true });
  }));

  /* ---------------- transcrição ---------------- */
  async function guardarSegmento(execId, texto, inicioMs, fonte) {
    for (let t = 0; t < 3; t++) {
      try {
        const r = await q(`insert into transcricoes (execucao_id, ordem, texto, inicio_ms, fonte)
          select $1, coalesce(max(ordem),0)+1, $2, $3, $4 from transcricoes where execucao_id = $1 returning ordem`, [execId, texto, inicioMs, fonte]);
        return r.rows[0].ordem;
      } catch (e) { if (e?.code === '23505' || /unique|duplicate/i.test(String(e?.message))) continue; throw e; }
    }
    throw new Error('conflito de ordem na transcrição');
  }
  const contar = async (execId) => (await q('select count(*)::int n from transcricoes where execucao_id=$1', [execId])).rows[0].n;

  app.post('/api/execucoes/:id/transcricao', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req));
    if (!x) return naoAchou(res);
    if (x.papel !== 'candidato') return proibido(res);
    const texto = limpa(req.body?.texto, 2000);
    if (!texto) return res.status(400).json({ erro: 'Texto vazio.' });
    const inicio = Number.isInteger(req.body?.inicio_ms) && req.body.inicio_ms >= 0 && req.body.inicio_ms < 4 * 3600_000 ? req.body.inicio_ms : null;
    if (x.estado !== 'em_andamento') return res.status(409).json({ erro: 'A estação já foi encerrada: a transcrição parou.', codigo: 'TRANSCRICAO_ENCERRADA' });
    if ((await contar(x.id)) >= MAX_SEGMENTOS) return res.status(429).json({ erro: 'Limite de trechos da transcrição atingido.', codigo: 'LIMITE' });
    try { res.status(201).json({ ordem: await guardarSegmento(x.id, texto, inicio, 'navegador') }); } catch (e) { falha(res, e); }
  }));

  // Reserva para navegadores sem reconhecimento de voz: o trecho de áudio vai para a IA transcrever (só o Gemini lê áudio).
  app.post('/api/execucoes/:id/audio', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req));
    if (!x) return naoAchou(res);
    if (x.papel !== 'candidato') return proibido(res);
    if (x.estado !== 'em_andamento') return res.status(409).json({ erro: 'A estação já foi encerrada: a transcrição parou.', codigo: 'TRANSCRICAO_ENCERRADA' });
    const { mime, base64 } = req.body ?? {};
    if (!audioOk(mime) || typeof base64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(base64) || base64.length < 100) return res.status(400).json({ erro: 'Áudio inválido.' });
    if (base64.length > MAX_AUDIO_B64) return res.status(413).json({ erro: 'Trecho de áudio grande demais.' });
    if (!ia.configurado()) return res.status(503).json({ erro: 'A IA não está configurada neste servidor.', codigo: 'IA_NAO_CONFIGURADA' });
    if (limite(req, res)) return;
    try {
      const r = await ia.transcreverAudio({ mime, base64 });
      // a IA demorou: a estação pode ter terminado nesse meio-tempo. O gatilho do banco é quem decide.
      if (!r.texto) return res.json({ ordem: null, vazio: true });
      try { res.status(201).json({ ordem: await guardarSegmento(x.id, r.texto, null, 'ia') }); } catch (e) { falha(res, e); }
    } catch (e) { erroIA(res, e); }
  }));

  app.get('/api/execucoes/:id/transcricao', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req));
    if (!x) return naoAchou(res);
    if (x.papel !== 'candidato' && x.papel !== 'avaliador') return proibido(res);
    const segmentos = (await q('select ordem, texto, inicio_ms, fonte from transcricoes where execucao_id=$1 order by ordem', [x.id])).rows;
    res.json({ estado: x.estado, encerrada: x.estado !== 'em_andamento' && x.estado !== 'pausada', segmentos });
  }));

  /* ---------------- conferência do PEP pela transcrição ---------------- */
  const itensDaEstacao = async (estacaoId) => (await q('select id, secao, ordem, descricao, criterio, pontos_total, critico from pep_itens where estacao_id=$1 order by ordem', [estacaoId])).rows
    .map((i) => ({ ...i, pontos_total: Number(i.pontos_total) }));

  /** IA quando há; senão (ou se falhar) a heurística. A resposta diz qual fonte foi usada. */
  async function analisar(x, segmentos) {
    const itens = await itensDaEstacao(x.estacao_id);
    if (segmentos.length === 0) return { fonte: 'heuristica', itens: analisarHeuristica({ itens, segmentos }), resumo: {}, aviso: 'Ainda não há fala transcrita.' };
    const referencias = await referenciasDaEstacao(q, x).catch(() => []);
    const bib = { referencias: referencias.map(({ ref, titulo, fonte, url, categoria, obrigatoria }) => ({ ref, titulo, fonte, url, categoria, obrigatoria })), fontes_gerais: FONTES_GERAIS[x.area] ?? [], sem_referencia: referencias.length === 0 };
    if (ia.configurado()) {
      try {
        const r = await ia.analisarTranscricao({ estacao: x, itens, transcricao: juntarTranscricao(segmentos), referencias });
        return { fonte: 'ia', itens: r.itens, resumo: { ...r.resumo, rebaixados: r.rebaixados, ...bib }, modelo: r.modelo };
      } catch (e) { if (!(e instanceof ErroIA)) throw e; }
    }
    return { fonte: 'heuristica', itens: analisarHeuristica({ itens, segmentos }), resumo: bib, aviso: ia.configurado() ? 'A IA falhou; usei a conferência por palavras.' : 'IA não configurada; usei a conferência por palavras.' };
  }
  async function guardarAnalise(execId, final, a, segmentos) {
    await q(`insert into analises_transcricao (execucao_id, final, fonte, itens, resumo, segmentos) values ($1,$2,$3,$4::jsonb,$5::jsonb,$6)
      on conflict (execucao_id, final) do update set fonte=excluded.fonte, itens=excluded.itens, resumo=excluded.resumo, segmentos=excluded.segmentos, gerada_em=now()`,
    [execId, final, a.fonte, JSON.stringify(a.itens), JSON.stringify(a.resumo ?? {}), segmentos]);
  }

  // Sugestão ao avaliador DURANTE a estação. Nunca vai para o candidato e nunca altera a nota.
  app.post('/api/execucoes/:id/analise-ao-vivo', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req));
    if (!x) return naoAchou(res);
    if (x.papel !== 'avaliador') return proibido(res);
    if (x.estado !== 'em_andamento') return res.status(409).json({ erro: 'A estação não está em andamento.', codigo: 'EXECUCAO_NAO_ANDAMENTO' });
    const ult = ultimaAoVivo.get(x.id) ?? 0;
    if (relogio() - ult < intervaloAoVivoMs) return res.status(429).json({ erro: 'Aguarde alguns segundos entre as análises.', codigo: 'AGUARDE' });
    ultimaAoVivo.set(x.id, relogio());
    const segmentos = (await q('select texto from transcricoes where execucao_id=$1 order by ordem', [x.id])).rows;
    const a = await analisar(x, segmentos);
    await guardarAnalise(x.id, false, a, segmentos.length);
    res.json({ ...a, segmentos: segmentos.length });
  }));

  /** Chamada ao finalizar: a análise final nasce da transcrição completa (que já parou de crescer). */
  const emAnalise = new Map();
  /** Uma só análise final por estação, mesmo que o fim e o painel peçam ao mesmo tempo. */
  function analisarFinal(execId) {
    if (!emAnalise.has(execId)) emAnalise.set(execId, analisarFinalBruta(execId).finally(() => emAnalise.delete(execId)));
    return emAnalise.get(execId);
  }
  async function analisarFinalBruta(execId) {
    const x = await contexto(execId, '00000000-0000-0000-0000-000000000000');
    if (!x || x.estado !== 'finalizada') return null;
    const segmentos = (await q('select texto from transcricoes where execucao_id=$1 order by ordem', [x.id])).rows;
    const a = await analisar(x, segmentos);
    await guardarAnalise(x.id, true, a, segmentos.length);
    ultimaAoVivo.delete(x.id);
    return a;
  }

  /* ---------------- autocorreção ao finalizar ---------------- */
  // Nota que a transcrição sustenta, comparada com a marcação do avaliador. Não altera a nota: adotar é decisão do avaliador (revisao-nota).
  app.get('/api/execucoes/:id/autocorrecao', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req));
    if (!x) return naoAchou(res);
    if (x.papel !== 'candidato' && x.papel !== 'avaliador') return proibido(res);
    if (x.estado !== 'finalizada') return res.status(409).json({ erro: 'A autocorreção acontece quando a estação termina.', codigo: 'EXECUCAO_NAO_FINALIZADA' });
    const an = (await q('select fonte, itens, resumo, gerada_em from analises_transcricao where execucao_id=$1 and final=true', [x.id])).rows[0];
    if (!an) { analisarFinal(x.id).catch(() => {}); return res.status(202).json({ estado: 'processando' }); }
    const nSeg = (await q('select count(*)::int n from transcricoes where execucao_id=$1', [x.id])).rows[0].n;
    const peps = await itensDaEstacao(x.estacao_id);
    const parciais = new Map((await q('select id, pontos_parcial from pep_itens where estacao_id=$1 and pontos_parcial is not null', [x.estacao_id])).rows.map((r) => [r.id, Number(r.pontos_parcial)]));
    const chk = (x.checklist?.itens ?? []).map((i) => ({ id: i.id, secao: i.secao, descricao: i.descricao, critico: Boolean(i.critico), resultado: i.resultado, pontos: Number(i.pontos), pontos_total: Number(i.pontos_total) }));
    const base = chk.length ? chk : peps.map((p) => ({ id: p.id, secao: p.secao, descricao: p.descricao, critico: p.critico, resultado: 'nao', pontos: 0, pontos_total: p.pontos_total }));
    const r = notaAutomatica(base, an.itens ?? [], parciais);
    const nota = x.nota === null ? null : Number(x.nota);
    const semFala = nSeg === 0;
    const divergentes = r.itens.filter((i) => i.divergencia).length;
    const seg = (await q('select t.ordem, t.texto, coalesce(t.inicio_ms, (extract(epoch from (t.criado_em - e.iniciada_em)) * 1000)::int) ms from transcricoes t join execucoes e on e.id = t.execucao_id where t.execucao_id=$1 order by t.ordem', [x.id])).rows;
    res.json({ estado: 'pronta', fonte: an.fonte, gerada_em: an.gerada_em, sem_fala: semFala,
      nota_automatica: semFala ? null : r.nota, nota_avaliador: nota, nota_original: x.nota_original === null ? null : Number(x.nota_original), maximo: r.max,
      percentual_automatico: !semFala && r.max > 0 ? Math.round((r.nota / r.max) * 100) : null,
      itens: r.itens, divergentes, marcas_sugeridas: semFala ? null : r.marcas, por_minuto: agruparPorMinuto(seg, r.itens),
      resumo: an.resumo ?? {}, pode_adotar: x.papel === 'avaliador' && !semFala });
  }));

  /* ---------------- painel de análise (depois da estação) ---------------- */
  const SECOES_HIST = `select item->>'secao' secao, sum((item->>'pontos')::numeric) pontos, sum((item->>'pontos_total')::numeric) maximo, count(distinct e.id)::int estacoes
      from execucoes e, jsonb_array_elements(e.checklist->'itens') item
     where e.candidato_id = $1 and e.estado = 'finalizada' and e.id <> $2 group by 1`;

  app.get('/api/estudo/execucoes/:id/analise', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req));
    if (!x) return naoAchou(res);
    if (x.papel !== 'candidato' && x.papel !== 'avaliador') return proibido(res);
    if (x.estado !== 'finalizada') return res.status(409).json({ erro: 'A análise fica disponível depois que a estação termina.', codigo: 'EXECUCAO_NAO_FINALIZADA' });
    const peps = new Map((await itensDaEstacao(x.estacao_id)).map((i) => [i.id, i]));
    const itensChk = (x.checklist?.itens ?? []).map((i) => ({ id: i.id, secao: i.secao, descricao: i.descricao, critico: Boolean(i.critico), resultado: i.resultado, pontos: Number(i.pontos), pontos_total: Number(i.pontos_total), criterio: peps.get(i.id)?.criterio ?? '' }));
    const segmentos = (await q('select t.ordem, t.texto, t.inicio_ms, t.fonte, coalesce(t.inicio_ms, (extract(epoch from (t.criado_em - e.iniciada_em)) * 1000)::int) ms from transcricoes t join execucoes e on e.id = t.execucao_id where t.execucao_id=$1 order by t.ordem', [x.id])).rows;
    let an = (await q('select fonte, itens, resumo, segmentos, gerada_em from analises_transcricao where execucao_id=$1 and final=true', [x.id])).rows[0];
    if (!an) { const a = await analisarFinal(x.id); an = a && { fonte: a.fonte, itens: a.itens, resumo: a.resumo, segmentos: segmentos.length }; }
    const itens = compararComMarcacao(itensChk, an?.itens ?? []);
    const maximo = itensChk.reduce((s, i) => s + i.pontos_total, 0);
    const nota = x.nota === null ? null : Number(x.nota);
    const secoes = compararSecoes(porSecao(itensChk), (await q(SECOES_HIST, [x.candidato_id, x.id])).rows.map((r) => ({ secao: r.secao, pontos: Number(r.pontos), maximo: Number(r.maximo), estacoes: r.estacoes })));
    const recentes = (await q(`select e.id, t.titulo, t.area, e.nota, e.finalizada_em, i.estacao_id,
        (select coalesce(sum(p.pontos_total),0) from pep_itens p where p.estacao_id = i.estacao_id) maximo
      from execucoes e join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id
      where e.candidato_id = $1 and e.estado = 'finalizada' and e.nota is not null order by e.finalizada_em desc limit 12`, [x.candidato_id])).rows
      .map((r) => ({ id: r.id, titulo: r.titulo, area: r.area, estacao_id: r.estacao_id, em: r.finalizada_em, atual: r.id === x.id, percentual: Number(r.maximo) > 0 ? Math.round((Number(r.nota) / Number(r.maximo)) * 100) : null }));
    const tentativas = recentes.filter((r) => r.estacao_id === x.estacao_id).reverse();
    const mesmaArea = recentes.filter((r) => r.area === x.area && !r.atual && r.percentual !== null);
    const percentual = nota !== null && maximo > 0 ? Math.round((nota / maximo) * 100) : null;
    const fortesFracos = pontosFortesEFracos(secoes);
    const fracosItens = itens.filter((i) => i.resultado !== 'sim').sort((a, b) => (Number(b.critico) - Number(a.critico)) || (b.pontos_total - a.pontos_total));
    const lacunas = (await q('select pep_item_id, categoria, erro_tipo, descricao from lacunas where execucao_id=$1', [x.id])).rows;
    const temas = (await q('select t.id, t.nome from estacao_temas et join temas t on t.id = et.tema_id where et.estacao_id=$1 order by t.relevancia desc, t.nome limit 6', [x.estacao_id])).rows;
    const cartoes = (await q('select count(*)::int n from cartoes where estacao_id=$1 and criado_por=$2', [x.estacao_id, x.candidato_id])).rows[0].n;
    const reteste = percentual === null ? null : new Date(new Date(x.finalizada_em).getTime() + diasParaReteste(percentual / 100) * 86_400_000);
    res.json({
      execucao: { id: x.id, estacao_id: x.estacao_id, titulo: x.titulo, area: x.area, duracao_min: x.duracao_min, finalizada_em: x.finalizada_em,
        duracao_s: Math.round((new Date(x.finalizada_em) - new Date(x.iniciada_em)) / 1000), nota, nota_original: x.nota_original === null ? null : Number(x.nota_original), maximo, percentual },
      meu_papel: x.papel, pode_revisar_nota: x.papel === 'avaliador',
      por_minuto: agruparPorMinuto(segmentos, itens.map((i) => ({ id: i.id, descricao: i.descricao, evidencia: i.sugestao?.evidencia, resultado_fala: i.sugestao && i.sugestao.confiavel !== false ? i.sugestao.resultado : null }))),
      transcricao: { segmentos, analise_fonte: an?.fonte ?? null, analisada_em: an?.gerada_em ?? null, rebaixados: an?.resumo?.rebaixados ?? 0 },
      itens, divergentes: itens.filter((i) => i.divergencia).length,
      secoes, fortes: fortesFracos.fortes, fracos: fortesFracos.fracos,
      resumo: { desempenho: an?.resumo?.desempenho ?? '', referencias: an?.resumo?.referencias ?? [], fontes_gerais: an?.resumo?.fontes_gerais ?? [], sem_referencia: an?.resumo?.sem_referencia ?? null, pontos_fortes: an?.resumo?.pontos_fortes ?? [], pontos_fracos: an?.resumo?.pontos_fracos ?? [], sugestoes: an?.resumo?.sugestoes?.length ? an.resumo.sugestoes : sugestoesDeItens(itensChk) },
      comparacao: { recentes, tentativas, media_area: mesmaArea.length ? Math.round(mesmaArea.reduce((s, r) => s + r.percentual, 0) / mesmaArea.length) : null },
      lacunas, temas, cartoes_da_estacao: cartoes,
      trilha: montarTrilha({ titulo: x.titulo, temas, fracosItens, cartoes, reteste }),
    });
  }));

  function montarTrilha({ titulo, temas, fracosItens, cartoes, reteste }) {
    const alvos = fracosItens.slice(0, 5);
    if (alvos.length === 0) return { alvos: [], passos: [{ tipo: 'reteste', texto: 'Sem lacunas no checklist: volte a esta estação mais tarde para confirmar a consolidação.', em: reteste }] };
    return {
      alvos: alvos.map((i) => ({ id: i.id, secao: i.secao, descricao: i.descricao, critico: i.critico, resultado: i.resultado })),
      passos: [
        { tipo: 'cartoes', texto: `Estudar os cartões de revisão da estação "${titulo}" (${cartoes} já criados).` },
        { tipo: 'resumo', texto: `Ler um resumo específico sobre o ponto mais fraco${temas[0] ? ` em ${temas[0].nome}` : ''}.`, tema_id: temas[0]?.id ?? null, foco: alvos[0].descricao },
        { tipo: 'refazer', texto: 'Refazer a estação agora, sem consultar o checklist: a correção termina com uma nova tentativa.' },
        { tipo: 'variacao', texto: 'Praticar o mesmo conteúdo com outra abordagem (nova estação gerada a partir desta).' },
        { tipo: 'reteste', texto: 'Voltar a esta estação depois do intervalo sugerido.', em: reteste },
      ],
    };
  }

  /* ---------------- revisão da nota ---------------- */
  app.put('/api/execucoes/:id/revisao-nota', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req));
    if (!x) return naoAchou(res);
    if (x.papel !== 'avaliador') return proibido(res);
    if (x.estado !== 'finalizada') return res.status(409).json({ erro: 'Só dá para revisar a nota depois que a estação termina.', codigo: 'EXECUCAO_NAO_FINALIZADA' });
    const c = await calcularNota(q, x.id, req.body?.marcas);
    if (c.erro) return res.status(400).json({ erro: c.erro });
    await q(`update execucoes set nota_original = coalesce(nota_original, nota), nota = $2, checklist = $3::jsonb, revisada_em = now(), revisada_por = $4, versao = versao + 1 where id = $1`,
      [x.id, c.nota, JSON.stringify(c.checklist), U(req)]);
    await q(`update usuario_estacao set melhor_nota = (select max(e.nota) from execucoes e join ciclo_itens i on i.id = e.item_id where e.candidato_id = $1 and i.estacao_id = $2 and e.estado = 'finalizada')
      where usuario_id = $1 and estacao_id = $2`, [x.candidato_id, x.estacao_id]);
    res.json({ nota: c.nota, max: c.max, nota_original: Number(x.nota_original ?? x.nota), criticos_falhos: c.checklist.criticos_falhos });
  }));

  /* ---------------- cartões de revisão da estação ---------------- */
  app.post('/api/estudo/execucoes/:id/cartoes', autenticar, ID, rota(async (req, res) => {
    const x = await contexto(req.params.id, U(req));
    if (!x) return naoAchou(res);
    if (x.papel !== 'candidato') return proibido(res);
    if (x.estado !== 'finalizada') return res.status(409).json({ erro: 'Os cartões saem depois que a estação termina.', codigo: 'EXECUCAO_NAO_FINALIZADA' });
    const todos = req.body?.todos === true;     // a estação inteira: todos os itens do PEP
    const ids = todos ? (await itensDaEstacao(x.estacao_id)).map((i) => i.id).slice(0, 40) : Array.isArray(req.body?.itens) ? [...new Set(req.body.itens.filter(idValido))].slice(0, 20) : [];
    if (ids.length === 0) return res.status(400).json({ erro: 'Escolha ao menos um ponto para revisar.' });
    const modo = req.body?.modo === 'ia' ? 'ia' : 'pep';
    const itens = (await itensDaEstacao(x.estacao_id)).filter((i) => ids.includes(i.id));
    if (itens.length !== ids.length) return res.status(400).json({ erro: 'Há ponto que não pertence a esta estação.' });
    // o cartão fica no tema principal da estação: assim aparece na trilha desse tema e na repetição espaçada
    let tema = (await q('select t.id, t.nome, t.area from estacao_temas et join temas t on t.id = et.tema_id where et.estacao_id=$1 order by t.relevancia desc, t.nome limit 1', [x.estacao_id])).rows[0];
    if (!tema) {
      const tid = await garantirTema(q, x.diagnostico_alvo || x.titulo, { area: x.area, origem: 'estacao' });
      await q('insert into estacao_temas (estacao_id, tema_id) values ($1,$2) on conflict do nothing', [x.estacao_id, tid]);
      tema = (await q('select id, nome, area from temas where id=$1', [tid])).rows[0];
    }
    const serie = (await q('select coalesce(max(serie),0)+1 s from cartoes where tema_id=$1', [tema.id])).rows[0].s;
    let novos; let semDiretriz;
    if (modo === 'ia') {
      if (!ia.configurado()) return res.status(503).json({ erro: 'A IA não está configurada neste servidor.', codigo: 'IA_NAO_CONFIGURADA' });
      if (limite(req, res)) return;
      try {
        const dir = await diretrizesDoTema(q, tema);
        const existentes = (await q('select frente from cartoes where tema_id=$1 order by criado_em desc limit 40', [tema.id])).rows.map((r) => r.frente);
        const r = await ia.gerarCartoes({ tema: tema.nome, area: tema.area, diretrizes: dir, quantidade: Math.min(12, Math.max(3, itens.length * 2)), existentes, lacunas: itens.map((i) => i.descricao) });
        semDiretriz = dir.length === 0;
        novos = r.cartoes.map((c) => ({ ...c, pep_item_id: null, origem: 'ia', diretriz_id: dir[0]?.id ?? null }));
      } catch (e) { return erroIA(res, e); }
    } else {
      const ja = new Set((await q('select pep_item_id from cartoes where estacao_id=$1 and criado_por=$2 and pep_item_id is not null', [x.estacao_id, U(req)])).rows.map((r) => r.pep_item_id));
      novos = cartoesDoPEP({ titulo: x.titulo }, itens.filter((i) => !ja.has(i.id))).map((c) => ({ ...c, origem: 'pep', diretriz_id: null }));
    }
    if (novos.length === 0) return res.json({ serie: null, total: 0, tema_id: tema.id, aviso: 'Esses pontos já têm cartões.' });
    await q(`insert into cartoes (tema_id, serie, frente, verso, origem, diretriz_id, criado_por, estacao_id, pep_item_id)
      select $1, $2, x.frente, x.verso, x.origem, x.diretriz_id, $3, $4, x.pep_item_id from jsonb_to_recordset($5::jsonb) as x(frente text, verso text, origem text, diretriz_id uuid, pep_item_id uuid)`,
    [tema.id, serie, U(req), x.estacao_id, JSON.stringify(novos)]);
    res.status(201).json({ serie, total: novos.length, tema_id: tema.id, tema: tema.nome, sem_diretriz: semDiretriz });
  }));

  return { analisarFinal };
}
