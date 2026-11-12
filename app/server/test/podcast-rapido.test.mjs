// Podcast direto da estação, trilha, cartões e caderno de erros (conteúdo montado no servidor; com ou sem comentários do desempenho).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { criarApp, criarBanco, criarQ } from './ajuda.mjs';
import { registrarPodcast } from '../src/podcast.js';
import { dividirTexto } from '../src/tts.js';
import { montarRSS, sincronizarPool } from '../src/radia.js';
import { promptRoteiro } from '../src/podcast-ia.js';
import { validarConfig } from '../src/config.js';
import { ErroIA } from '../src/ia.js';

const bd = criarBanco('rv_podrapido');
const q = criarQ(bd.nome);
const { app, chamar } = criarApp();
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rv-podrapido-'));
const valores = { APP_URL: 'https://app.exemplo.com' };
const cfg = { obter: (k) => valores[k] ?? '' };
const ROTEIRO = Array.from({ length: 80 }, (_, i) => `palavra${i}`).join(' ') + '. Fim do episódio.';
const ia = { chamadas: [], falha: null, configurado: () => true, async gerarRoteiro(p) { this.chamadas.push(p); if (this.falha) throw this.falha; return { titulo: `Episódio sobre ${p.tema}`, roteiro: ROTEIRO }; } };
const ttsChamadas = []; let ttsStatus = 200;
const fetchFalso = async (url, init) => {
  const corpo = JSON.parse(init.body);
  if (String(url).includes('tts.exemplo')) {
    ttsChamadas.push({ url, auth: init.headers.authorization, corpo });
    return { ok: ttsStatus === 200, status: ttsStatus, arrayBuffer: async () => new Uint8Array([0xff, 0xfb, 0x90, 0x00, ...Array(60).fill(7)]).buffer };
  }
  radiaChamadas.push({ url, headers: init.headers, corpo });
  return { ok: radiaStatus === 200, status: radiaStatus, arrayBuffer: async () => new ArrayBuffer(0) };
};
const radiaChamadas = []; let radiaStatus = 200;
const autenticar = async (req, _res, prox) => {
  const id = String(req.headers.authorization).split(' ')[1];
  const u = (await q('select id, nome, papel_app from usuarios where id=$1', [id])).rows[0];
  req.usuario = { id, nome: u.nome, papel_app: u.papel_app }; prox();
};
before(() => { registrarPodcast(app, { q, autenticar, ia, cfg, fetchImpl: fetchFalso, dir, intervaloSyncMin: 0 }); });
after(async () => { bd.derrubar(); await fs.rm(dir, { recursive: true, force: true }); });

const uid = async (n, papel = 'usuario') => (await q(`insert into usuarios (nome,email,senha_hash,visto_em,papel_app) values ($1,$2,'x',now(),$3) returning id`, [n, `${n}${Math.random()}@x.com`, papel])).rows[0].id;
const api = (m, u, t, corpo, extra = {}) => chamar(m, u, { token: t, corpo, ...extra });
const ligarTTS = () => { valores.TTS_URL = 'https://tts.exemplo.com/v1'; valores.TTS_CHAVE = 'chave-tts-secreta-123'; valores.TTS_MODELO = 'tts-1'; valores.TTS_VOZ = 'nova'; };
const desligarTTS = () => { delete valores.TTS_URL; delete valores.TTS_CHAVE; };
const novaPlaylist = async (t, titulo = 'Minha playlist', prompt = '') => (await api('POST', '/api/podcast/playlists', t, { titulo, prompt })).corpo;

const novo = async (nome) => (await q(`insert into usuarios (nome,email,senha_hash,visto_em) values ($1,$2,'x',now()) returning id`, [nome, `${nome}${Math.random()}@x.com`])).rows[0].id;
async function cenario(candidato) {
  const avaliador = await novo('Av');
  const est = (await q(`insert into estacoes (titulo, area, status) values ('Dor torácica no PS','clinica_medica','aprovada') returning id`)).rows[0].id;
  await q(`insert into pep_itens (estacao_id, secao, descricao, pontos_total, ordem, critico) values ($1,'Anamnese','Caracteriza a dor torácica',4,1,false), ($1,'Conduta','Solicita ECG em 10 minutos',6,2,true)`, [est]);
  const sala = (await q(`insert into salas (dono_id, admin_id) values ($1,$1) returning id`, [avaliador])).rows[0].id;
  const ciclo = (await q(`insert into ciclos (sala_id, admin_id, candidato_id, estado) values ($1,$2,$3,'encerrado') returning id`, [sala, avaliador, candidato])).rows[0].id;
  const it = (await q(`insert into ciclo_itens (ciclo_id, estacao_id, posicao) values ($1,$2,1) returning id`, [ciclo, est])).rows[0].id;
  const chk = { itens: [{ secao: 'Anamnese', descricao: 'Caracteriza a dor torácica', resultado: 'sim', pontos: 4, pontos_total: 4 }, { secao: 'Conduta', descricao: 'Solicita ECG em 10 minutos', resultado: 'nao', pontos: 0, pontos_total: 6, critico: true }] };
  const ex = (await q(`insert into execucoes (sala_id, ciclo_id, item_id, estado, avaliador_id, candidato_id, finalizada_em, nota, checklist) values ($1,$2,$3,'finalizada',$4,$5, now(), 4, $6::jsonb) returning id`, [sala, ciclo, it, avaliador, candidato, JSON.stringify(chk)])).rows[0].id;
  const pep = (await q(`select id from pep_itens where estacao_id=$1 and critico`, [est])).rows[0].id;
  await q(`insert into lacunas (usuario_id, execucao_id, estacao_id, pep_item_id, categoria, descricao) values ($1,$2,$3,$4,'conhecimento','esqueci o tempo-alvo do ECG')`, [candidato, ex, est, pep]);
  return { est, ex };
}

test('unidade: o prompt separa "com comentários do desempenho" de "só aprofundar"', () => {
  const com = promptRoteiro({ tipo: 'conteudo', modo: 'com_desempenho', titulo: 'X', contexto: 'abc' }).usuario;
  const sem = promptRoteiro({ tipo: 'conteudo', modo: 'aprofundar', titulo: 'X', contexto: 'abc' }).usuario;
  assert.match(com, /comente com acolhimento o desempenho/); assert.match(sem, /NÃO comente desempenho/);
  assert.match(sem, /CONTEÚDO:\nabc/);
});

test('estação sem comentários: só aprofunda, com os elementos técnicos do checklist e sem dados de desempenho', async () => {
  const u = await uid('Ana'); const { est } = await cenario(u); ia.chamadas.length = 0;
  const r = await api('POST', '/api/podcast/rapido', u, { origem: 'estacao', estacao_id: est, modo: 'aprofundar', minutos: 4 });
  assert.equal(r.status, 201); assert.equal(r.corpo.item.modo, 'aprofundar'); assert.equal(r.corpo.item.origem, 'estacao'); assert.equal(r.corpo.item.estacao_id, est);
  assert.match(r.corpo.item.titulo, /Aprofundando a estação: Dor torácica/); assert.equal(r.corpo.playlist.titulo, 'Revisões rápidas');
  const p = ia.chamadas[0]; assert.equal(p.tipo, 'conteudo'); assert.equal(p.modo, 'aprofundar'); assert.match(p.contexto, /Solicita ECG em 10 minutos \(item crítico\)/); assert.doesNotMatch(p.contexto, /DESEMPENHO/);
});

test('estação com comentários: inclui nota, o que fez e não fez, e as lacunas do próprio usuário', async () => {
  const u = await uid('Bia'); const { est, ex } = await cenario(u); ia.chamadas.length = 0;
  const r = await api('POST', '/api/podcast/rapido', u, { origem: 'estacao', estacao_id: est, execucao_id: ex, modo: 'com_desempenho' });
  assert.equal(r.status, 201); assert.equal(r.corpo.item.modo, 'com_desempenho'); assert.match(r.corpo.item.titulo, /^Revisão da estação/);
  const c = ia.chamadas[0].contexto; assert.match(c, /nota 4 de 10 pontos/); assert.match(c, /Caracteriza a dor torácica: fez/); assert.match(c, /Solicita ECG em 10 minutos: não fez \(crítico\)/); assert.match(c, /esqueci o tempo-alvo do ECG/);
  const outro = await uid('Intruso');
  const r2 = await api('POST', '/api/podcast/rapido', outro, { origem: 'estacao', estacao_id: est, execucao_id: ex, modo: 'com_desempenho' });
  assert.equal(r2.status, 404, 'execução de outro usuário não vaza');
});

test('sem execução finalizada, "com comentários" cai para aprofundar e avisa', async () => {
  const u = await uid('Caio'); const est = (await q(`insert into estacoes (titulo, area, status) values ('Cefaleia','clinica_medica','aprovada') returning id`)).rows[0].id;
  const r = await api('POST', '/api/podcast/rapido', u, { origem: 'estacao', estacao_id: est, modo: 'com_desempenho' });
  assert.equal(r.status, 201); assert.equal(r.corpo.item.modo, 'aprofundar'); assert.match(r.corpo.aviso, /ainda não finalizou/);
});

test('cartões, trilha e caderno de erros chegam pré-formatados; playlist "Revisões rápidas" é reaproveitada', async () => {
  const u = await uid('Duda'); const { est } = await cenario(u);
  const tema = (await q(`insert into temas (nome, nome_norm, area) values ('Sepse','sepse','clinica_medica') returning id`)).rows[0].id;
  const [c1] = (await q(`insert into cartoes (tema_id, frente, verso) values ($1,'Qual o tempo do antibiótico?','Na primeira hora.'), ($1,'Qual lactato sugere gravidade?','Acima de 2 mmol/L.') returning id`, [tema])).rows.map((x) => x.id);
  ia.chamadas.length = 0;
  const a = await api('POST', '/api/podcast/rapido', u, { origem: 'cartoes', cartao_ids: [c1] });
  assert.equal(a.status, 201, JSON.stringify(a.corpo)); assert.match(ia.chamadas[0].contexto, /1\. Qual o tempo do antibiótico\? \| Na primeira hora\./); assert.equal(a.corpo.item.tema_id, tema);
  const t = await api('POST', '/api/podcast/rapido', u, { origem: 'trilha', tema_ids: [tema] });
  assert.equal(t.status, 201, JSON.stringify(t.corpo)); assert.match(ia.chamadas[1].contexto, /Tema "Sepse"/); assert.match(ia.chamadas[1].contexto, /Acima de 2 mmol\/L/);
  const e = await api('POST', '/api/podcast/rapido', u, { origem: 'erros' });
  assert.equal(e.status, 201, JSON.stringify(e.corpo)); assert.match(ia.chamadas[2].contexto, /Estação "Dor torácica no PS": não atendeu "Solicita ECG em 10 minutos"/); assert.equal(e.corpo.item.modo, 'com_desempenho');
  assert.equal(a.corpo.playlist.id, t.corpo.playlist.id); assert.equal(t.corpo.playlist.id, e.corpo.playlist.id);
  const lista = (await api('GET', `/api/podcast/playlists/${a.corpo.playlist.id}`, u)).corpo; assert.equal(lista.itens.length, 3);
});

test('validações: origem inválida, caderno vazio, playlist alheia e roteiro refeito mantém o conteúdo', async () => {
  const u = await uid('Edu'); const outro = await uid('Fabi');
  assert.equal((await api('POST', '/api/podcast/rapido', u, { origem: 'xyz' })).status, 400);
  const vazio = await api('POST', '/api/podcast/rapido', u, { origem: 'erros' }); assert.equal(vazio.status, 404); assert.match(vazio.corpo.erro, /caderno de erros/);
  const pl = await novaPlaylist(outro, 'Do outro');
  assert.equal((await api('POST', '/api/podcast/rapido', u, { origem: 'erros', playlist_id: pl.id })).status, 404);
  const { est } = await cenario(u); ia.chamadas.length = 0;
  const r = await api('POST', '/api/podcast/rapido', u, { origem: 'estacao', estacao_id: est, modo: 'aprofundar' });
  const re = await api('POST', `/api/podcast/itens/${r.corpo.item.id}/gerar`, u, { refazer_roteiro: true });
  assert.ok([200, 201].includes(re.status), JSON.stringify(re.corpo)); assert.equal(ia.chamadas.at(-1).modo, 'aprofundar'); assert.match(ia.chamadas.at(-1).contexto, /Elementos técnicos/);
});
