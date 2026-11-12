// Mesa (shell estilo macOS): estado da mesa por usuário (favoritos, notas rápidas, dock) e mensagens diretas entre colegas.
//  • o estado é um JSON pequeno e SANEADO aqui (o cliente não decide formato nem tamanho);
//  • colegas = quem já dividiu uma sala com você e não tem bloqueio com você (bloqueio é bilateral em todo o app);
//  • mensagens só entre colegas, com limite de envio; texto é sempre texto (a interface escapa).
import { idValido, rota, Limitador } from './seguranca.js';

export const TELAS = ['painel', 'ciclos', 'estacoes', 'comunidade', 'solo', 'podcast', 'desempenho', 'estudo', 'conta', 'admin', 'notas', 'mensagens'];
const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const COR = ['amarela', 'verde', 'rosa', 'azul'];
const num = (v, min, max, pad) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : pad; };

/** Devolve o estado limpo (e limitado) ou lança se não for objeto. */
export function sanearEstado(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) throw Object.assign(new Error('Estado inválido.'), { status: 400 });
  const favoritos = (Array.isArray(e.favoritos) ? e.favoritos : []).slice(0, 60).map((f) => {
    const tipo = ['tela', 'estacao', 'tema'].includes(f?.tipo) ? f.tipo : null;
    const ref = txt(f?.ref, 120);
    if (!tipo || !ref || (tipo === 'tela' && !TELAS.includes(ref))) return null;
    return { tipo, ref, rotulo: txt(f?.rotulo, 60) || ref, x: num(f?.x, 0, 4000, 0), y: num(f?.y, 0, 4000, 0) };
  }).filter(Boolean);
  const vistos = new Set();
  const notas = (Array.isArray(e.notas) ? e.notas : []).slice(0, 50).map((n) => {
    const id = txt(n?.id, 40).replace(/[^\w-]/g, '');
    if (!id || vistos.has(id)) return null; vistos.add(id);
    return { id, titulo: txt(n?.titulo, 80), texto: txt(n?.texto, 4000), cor: COR.includes(n?.cor) ? n.cor : 'amarela', fixada: !!n?.fixada, em: num(n?.em, 0, 4102444800000, 0) };
  }).filter(Boolean);
  const dock = (Array.isArray(e.dock) ? e.dock : []).filter((t) => TELAS.includes(t)).slice(0, 14);
  const tema = ['auto', 'claro', 'escuro'].includes(e.tema) ? e.tema : 'auto';
  return { favoritos, notas, dock: [...new Set(dock)], tema };
}

export function registrarMesa(app, { q, autenticar }) {
  const U = (req) => req.usuario.id;
  const validarId = (req, res, prox) => (idValido(req.params.id) ? prox() : res.status(400).json({ erro: 'Identificador inválido.' }));
  const limiteEnvio = new Limitador({ max: 30, janelaMs: 60e3 });
  const livre = (a, b) => `not exists (select 1 from bloqueios b where (b.bloqueador_id = ${a} and b.bloqueado_id = ${b}) or (b.bloqueador_id = ${b} and b.bloqueado_id = ${a}))`;
  const ehColega = async (eu, outro) => (await q(
    `select 1 from sala_participantes a join sala_participantes b on b.sala_id = a.sala_id and b.usuario_id = $2
      join usuarios u on u.id = $2 and (u.suspenso_ate is null or u.suspenso_ate <= now())
      where a.usuario_id = $1 and ${livre('$1::uuid', '$2::uuid')} limit 1`, [eu, outro])).rows.length > 0;

  app.get('/api/mesa', autenticar, rota(async (req, res) => {
    const r = (await q('select estado from mesa_usuario where usuario_id = $1', [U(req)])).rows[0];
    res.json({ estado: r ? r.estado : null });
  }));
  app.put('/api/mesa', autenticar, rota(async (req, res) => {
    let e;
    try { e = sanearEstado(req.body?.estado); } catch (x) { return res.status(400).json({ erro: x.message }); }
    await q(`insert into mesa_usuario (usuario_id, estado) values ($1,$2) on conflict (usuario_id) do update set estado = excluded.estado, atualizado_em = now()`, [U(req), JSON.stringify(e)]);
    res.json({ ok: true, estado: e });
  }));

  app.get('/api/mesa/colegas', autenticar, rota(async (req, res) => {
    const r = await q(
      `select u.id, u.nome, (u.visto_em > now() - interval '90 seconds') as online,
              (select count(*)::int from mensagens_diretas m where m.de_id = u.id and m.para_id = $1 and m.lida_em is null) as nao_lidas,
              (select max(m.criada_em) from mensagens_diretas m where (m.de_id = u.id and m.para_id = $1) or (m.de_id = $1 and m.para_id = u.id)) as ultima
         from usuarios u
        where u.id <> $1 and (u.suspenso_ate is null or u.suspenso_ate <= now())
          and exists (select 1 from sala_participantes a join sala_participantes b on b.sala_id = a.sala_id where a.usuario_id = $1 and b.usuario_id = u.id)
          and ${livre('$1::uuid', 'u.id')}
        order by ultima desc nulls last, u.nome limit 60`, [U(req)]);
    res.json({ colegas: r.rows, nao_lidas: r.rows.reduce((s, c) => s + c.nao_lidas, 0) });
  }));

  app.get('/api/mensagens/:id', autenticar, validarId, rota(async (req, res) => {
    if (!(await ehColega(U(req), req.params.id))) return res.status(403).json({ erro: 'Você só troca mensagens com colegas de sala.' });
    const itens = (await q(
      `select * from (select id, de_id, texto, criada_em from mensagens_diretas
          where (de_id = $1 and para_id = $2) or (de_id = $2 and para_id = $1) order by criada_em desc limit 60) t order by criada_em`, [U(req), req.params.id])).rows;
    await q('update mensagens_diretas set lida_em = now() where para_id = $1 and de_id = $2 and lida_em is null', [U(req), req.params.id]);
    res.json({ itens: itens.map((m) => ({ id: m.id, minha: m.de_id === U(req), texto: m.texto, criada_em: m.criada_em })) });
  }));
  app.post('/api/mensagens/:id', autenticar, validarId, rota(async (req, res) => {
    const texto = txt(req.body?.texto, 1000);
    if (!texto) return res.status(400).json({ erro: 'Escreva a mensagem.' });
    if (limiteEnvio.excedeu(U(req))) return res.status(429).json({ erro: 'Muitas mensagens em pouco tempo. Aguarde um instante.' });
    if (!(await ehColega(U(req), req.params.id))) return res.status(403).json({ erro: 'Você só troca mensagens com colegas de sala.' });
    limiteEnvio.registrar(U(req));
    const m = (await q('insert into mensagens_diretas (de_id, para_id, texto) values ($1,$2,$3) returning id, criada_em', [U(req), req.params.id, texto])).rows[0];
    res.status(201).json({ id: m.id, minha: true, texto, criada_em: m.criada_em });
  }));
}
