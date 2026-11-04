// Feedback gráfico geral do desempenho: agrega, por pessoa, as estações em que foi candidata, por modalidade (sala, ciclo randômico,
// trilha, chamado da comunidade) e pelos BLOCOS GENERALIZADOS do PEP (preparação, anamnese, exame físico…). Tudo calculado no servidor
// sobre o checklist gravado no fim de cada estação; filtros: área, período (de/até ou atalhos) e modalidade.
import { rota } from './seguranca.js';

export const BLOCOS = [
  { id: 'preparacao', rotulo: 'Preparação e biossegurança', re: /(lav|higien|luva|apresent|identific|paciente.*(cham|confirm)|biosseg|consentimento|ambiente|prepar)/ },
  { id: 'anamnese', rotulo: 'Anamnese', re: /(anamnes|queixa|hda|historia|antecedente|habito|medicac.*(uso|em uso)|alergia|pergunt|investig|sintoma)/ },
  { id: 'exame_fisico', rotulo: 'Exame físico', re: /(exame fisico|inspecao|palpac|ausculta|percuss|sinais vitais|pressao arterial|aferi|manobra|examin)/ },
  { id: 'hipotese', rotulo: 'Raciocínio e hipótese diagnóstica', re: /(hipotese|diagnostic|raciocin|diferencial|classific|estratific)/ },
  { id: 'exames', rotulo: 'Exames complementares', re: /(exame|solicit|laborator|imagem|eletrocardiograma|ecg|radiograf|tomograf|ultrassom|hemograma)/ },
  { id: 'conduta', rotulo: 'Conduta e tratamento', re: /(conduta|trata|prescri|medicamento|dose|terapeut|tratament|analges|antibiot|procediment|cirurg)/ },
  { id: 'comunicacao', rotulo: 'Comunicação e empatia', re: /(comunic|empatia|linguagem|escuta|acolh|explic|orienta.*paciente|sigilo|etic|respeit|postura|vinculo)/ },
  { id: 'desfecho', rotulo: 'Orientações finais e desfecho', re: /(encaminh|retorno|alta|internac|seguimento|notificac|orientac|prevenc|desfecho|fechamento|plano)/ },
];
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Classifica um item do PEP num bloco geral: primeiro pela seção (título do bloco no PEP), depois pela descrição; sem pista → "outros". */
export function classificar(secao, descricao) {
  const s = semAcento(secao); const d = semAcento(descricao);
  for (const b of BLOCOS) if (b.re.test(s)) return b.id;
  for (const b of BLOCOS) if (b.re.test(d)) return b.id;
  return 'outros';
}
export const MODALIDADES = ['sala', 'randomico', 'trilha', 'comunidade', 'solo'];
const AREAS = ['clinica_medica', 'cirurgia', 'ginecologia_obstetricia', 'pediatria', 'mfc'];
const DIA = 86400e3;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) && !Number.isNaN(Date.parse(v)) ? v : null);

export function registrarDesempenho(app, { q, autenticar }) {
  const consulta = (papel) => `select * from (select e.id, e.finalizada_em, e.iniciada_em, e.nota::float8 nota, e.checklist, t.area, t.titulo,
          case when exists (select 1 from salas_ia si where si.sala_id = e.sala_id) then 'solo'
               when exists (select 1 from praticas_solo ps where ps.estacao_id = i.estacao_id and ps.usuario_id = e.candidato_id) then 'solo'
               when exists (select 1 from ciclos_randomicos r where r.sala_id = e.sala_id and r.origem = 'trilha') then 'trilha'
               when exists (select 1 from ciclos_randomicos r where r.sala_id = e.sala_id) then 'randomico'
               when exists (select 1 from ciclo_itens x where x.ciclo_id = e.ciclo_id and x.grupo = 'Chamado') then 'comunidade'
               else 'sala' end modalidade,
          (select coalesce(sum(p.pontos_total), 0)::float8 from pep_itens p where p.estacao_id = i.estacao_id) maximo
        from execucoes e join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id
        where ${papel} and e.estado = 'finalizada'
          and ($2::text is null or t.area = $2) and ($3::date is null or e.finalizada_em >= $3::date) and ($4::date is null or e.finalizada_em < $4::date + 1)) x
       where ($5::text is null or x.modalidade = $5) order by x.finalizada_em asc limit 500`;

  app.get('/api/desempenho', autenticar, rota(async (req, res) => {
    const u = req.usuario.id;
    const area = AREAS.includes(req.query?.area) ? req.query.area : null;
    const modalidade = MODALIDADES.includes(req.query?.modalidade) ? req.query.modalidade : null;
    let de = data(req.query?.de); let ate = data(req.query?.ate);
    const dias = Number(req.query?.periodo);
    if ([7, 30, 90, 365].includes(dias)) { de = new Date(Date.now() - dias * DIA).toISOString().slice(0, 10); ate = null; }
    const args = [u, area, de, ate, modalidade];
    const feitas = (await q(consulta('e.candidato_id = $1 and e.nota is not null'), args)).rows;
    const avaliadas = (await q(consulta('e.avaliador_id = $1 and e.candidato_id <> $1'), args)).rows;

    const ordem = [...BLOCOS.map((b) => b.id), 'outros'];
    const rot = Object.fromEntries([...BLOCOS.map((b) => [b.id, b.rotulo]), ['outros', 'Outros itens']]);
    const blocos = new Map(ordem.map((id) => [id, { obtido: 0, maximo: 0, itens: 0, criticos_falhos: 0 }]));
    const acum = () => ({ obtido: 0, maximo: 0, n: 0 });
    const porArea = new Map(); const semanas = new Map(); const porMod = new Map(MODALIDADES.map((m) => [m, { ...acum(), aval: 0 }]));
    const tot = acum(); let minutos = 0; let criticos = 0;
    for (const l of feitas) {
      const itens = l.checklist?.itens ?? [];
      // aproveitamento da estação: pelo checklist gravado (o mesmo que alimenta os blocos); sem ele, nota ÷ máximo do PEP
      const ob = itens.length ? itens.reduce((s, i) => s + (Number(i.pontos) || 0), 0) : l.nota;
      const mx = itens.length ? itens.reduce((s, i) => s + (Number(i.pontos_total) || 0), 0) : l.maximo;
      const soma = (a) => { a.obtido += ob; a.maximo += mx; a.n++; };
      soma(tot); soma(porMod.get(l.modalidade));
      if (!porArea.has(l.area)) porArea.set(l.area, acum()); soma(porArea.get(l.area));
      const d = new Date(l.finalizada_em); const ini = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10);
      if (!semanas.has(ini)) semanas.set(ini, acum()); soma(semanas.get(ini));
      minutos += Math.max(0, (new Date(l.finalizada_em) - new Date(l.iniciada_em)) / 60000);
      for (const it of itens) {
        const b = blocos.get(classificar(it.secao, it.descricao));
        b.obtido += Number(it.pontos) || 0; b.maximo += Number(it.pontos_total) || 0; b.itens++;
        if (it.critico && it.resultado !== 'sim') { b.criticos_falhos++; criticos++; }
      }
    }
    for (const l of avaliadas) porMod.get(l.modalidade).aval++;
    const r1 = (n) => Math.round(n * 100) / 100;
    const por_bloco = ordem.map((id) => { const b = blocos.get(id); return { bloco: id, rotulo: rot[id], obtido: r1(b.obtido), maximo: r1(b.maximo), percentual: pct(b.obtido, b.maximo), itens: b.itens, criticos_falhos: b.criticos_falhos }; })
      .filter((b) => b.itens > 0 || b.bloco !== 'outros');
    res.json({
      filtros: { area, modalidade, de, ate },
      resumo: { estacoes: feitas.length, percentual: pct(tot.obtido, tot.maximo), minutos: Math.round(minutos), avaliadas: avaliadas.length, criticos_falhos: criticos },
      por_bloco,
      pontos_fracos: por_bloco.filter((b) => b.itens > 0 && b.percentual !== null && b.percentual < 60).sort((a, b) => a.percentual - b.percentual).slice(0, 3).map((b) => b.bloco),
      por_modalidade: MODALIDADES.map((m) => ({ modalidade: m, como_candidato: porMod.get(m).n, como_avaliador: porMod.get(m).aval, percentual: pct(porMod.get(m).obtido, porMod.get(m).maximo) })),
      por_area: [...porArea].map(([a, x]) => ({ area: a, estacoes: x.n, percentual: pct(x.obtido, x.maximo) })),
      evolucao: [...semanas].map(([semana, x]) => ({ semana, estacoes: x.n, percentual: pct(x.obtido, x.maximo) })),
    });
  }));
}
