// Painel inicial: uma única chamada com o que o início mostra (candidato e avaliador). Tudo calculado no servidor, só o que é do usuário.
// Desempenho vem das estações feitas nas salas (execuções finalizadas); as salas antigas por link (avaliações) entram somadas.
import { rota } from './seguranca.js';

const f1 = (n) => Math.round(Number(n) * 10) / 10;

export function registrarPainel(app, { q, autenticar }) {
  app.get('/api/painel', autenticar, rota(async (req, res) => {
    const u = req.usuario.id;
    const feitas = (await q(`select e.id, t.titulo, t.area, e.nota::float8 nota, e.finalizada_em,
        (select coalesce(sum(p.pontos_total), 0)::float8 from pep_itens p where p.estacao_id = i.estacao_id) maximo
      from execucoes e join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id
      where e.candidato_id = $1 and e.estado = 'finalizada' and e.nota is not null order by e.finalizada_em desc limit 200`, [u])).rows;
    const pct = (x) => (x.maximo > 0 ? (x.nota / x.maximo) * 10 : null);
    const validas = feitas.filter((x) => pct(x) !== null);
    const antigas = (await q(`select s.estacao_id, e.area, a.nota::float8 nota, a.nota_max::float8 maximo from avaliacoes a join sessoes s on s.id = a.sessao_id join estacoes e on e.id = s.estacao_id
      where a.candidato_id = $1 and a.finalizada_em is not null and a.nota_max > 0`, [u])).rows;
    const todas = [...validas.map((x) => ({ area: x.area, v: pct(x) })), ...antigas.map((x) => ({ area: x.area, v: (x.nota / x.maximo) * 10 }))];
    const media = todas.length ? todas.reduce((s, x) => s + x.v, 0) / todas.length : 0;
    const porArea = new Map();
    for (const x of todas) { const a = porArea.get(x.area) ?? { soma: 0, n: 0 }; a.soma += x.v; a.n += 1; porArea.set(x.area, a); }

    const cartoes = (await q(`select count(*) filter (where proximo_em <= now())::int vencidos, count(*)::int estudados,
        (select count(*)::int from cartoes c where c.criado_por = $1 and not exists (select 1 from cartao_progresso x where x.cartao_id = c.id and x.usuario_id = $1)) novos
      from cartao_progresso where usuario_id = $1`, [u])).rows[0];

    const salas = (await q(`select s.id, sp.papel, sp.e_avaliador, s.ciclo_ativo_id is not null tem_ciclo,
        (select count(*)::int from sala_participantes x where x.sala_id = s.id and x.saiu_em is null) pessoas,
        (select count(*)::int from ciclo_itens i where i.ciclo_id = s.ciclo_ativo_id) itens,
        (select count(*)::int from execucoes e where e.ciclo_id = s.ciclo_ativo_id and e.estado = 'finalizada') feitos,
        (select t.titulo from execucoes e join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id where e.sala_id = s.id and e.estado = 'em_andamento') ao_vivo
      from sala_participantes sp join salas s on s.id = sp.sala_id
      where sp.usuario_id = $1 and sp.saiu_em is null and s.estado = 'aberta' order by s.criada_em desc limit 12`, [u])).rows;

    const av = (await q(`select count(*) filter (where e.estado = 'finalizada')::int feitas, count(distinct e.candidato_id) filter (where e.estado = 'finalizada')::int candidatos,
        count(*) filter (where e.estado = 'finalizada' and not e.transcricao_liberada and exists (select 1 from transcricoes t where t.execucao_id = e.id))::int sem_liberar
      from execucoes e where e.avaliador_id = $1`, [u])).rows[0];
    const aoVivo = (await q(`select e.id, e.sala_id, t.titulo from execucoes e join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id
      where e.avaliador_id = $1 and e.estado in ('em_andamento','pausada') order by e.iniciada_em desc limit 3`, [u])).rows;
    const recentesAv = (await q(`select e.id, t.titulo, c.nome candidato, e.finalizada_em, e.transcricao_liberada liberada,
        exists (select 1 from transcricoes x where x.execucao_id = e.id) tem_fala
      from execucoes e join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id join usuarios c on c.id = e.candidato_id
      where e.avaliador_id = $1 and e.estado = 'finalizada' order by e.finalizada_em desc limit 5`, [u])).rows;

    const mine = (await q(`select status, count(*)::int n from estacoes where criado_por = $1 group by status`, [u])).rows;
    const disp = (await q(`select count(*)::int n from estacoes where status = 'aprovada'`)).rows[0].n;

    res.json({
      desempenho: { nota_media: f1(media), estacoes: todas.length, por_area: [...porArea].map(([area, a]) => ({ area, nota: f1(a.soma / a.n), estacoes: a.n })) },
      tendencia: validas.slice(0, 10).reverse().map((x) => ({ id: x.id, titulo: x.titulo, percentual: Math.round(pct(x) * 10) })),
      feitas: feitas.slice(0, 6).map((x) => ({ id: x.id, titulo: x.titulo, area: x.area, nota: x.nota, maximo: x.maximo, finalizada_em: x.finalizada_em })),
      revisao: cartoes,
      salas: salas.map((s) => ({ id: s.id, papel: s.papel === 'admin' ? 'admin' : s.e_avaliador ? 'avaliador' : s.papel, pessoas: s.pessoas, itens: s.itens, feitos: s.feitos, ao_vivo: s.ao_vivo })),
      avaliador: { ...av, ao_vivo: aoVivo, recentes: recentesAv.map((r) => ({ ...r, finalizada_em: r.finalizada_em })) },
      estacoes: { disponiveis: disp, minhas: Object.fromEntries(mine.map((m) => [m.status, m.n])) },
    });
  }));
}
