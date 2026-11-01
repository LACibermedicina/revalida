-- 007: cartas da estação liberadas durante a execução, transcrição da fala do candidato, análise do PEP pela transcrição,
-- revisão da nota e cartões de revisão ligados à estação. Idempotente.
create table if not exists execucao_materiais (
  execucao_id uuid not null references execucoes(id) on delete cascade,
  material_id uuid not null references estacao_materiais(id) on delete cascade,
  liberado_por uuid references usuarios(id),
  liberado_em timestamptz not null default now(),
  primary key (execucao_id, material_id)
);

-- Segmentos da fala do candidato. Só entram enquanto a execução está em andamento (a regra fica na rota e no gatilho abaixo).
create table if not exists transcricoes (
  id          uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references execucoes(id) on delete cascade,
  ordem       int  not null,
  texto       text not null check (length(texto) between 1 and 2000),
  inicio_ms   int,
  fonte       text not null default 'navegador' check (fonte in ('navegador','ia')),
  criado_em   timestamptz not null default now(),
  unique (execucao_id, ordem)
);
create or replace function rv_transcricao_so_em_andamento() returns trigger language plpgsql as $$
begin
  -- for share: se a finalização está acontecendo agora, espera e enxerga o estado já gravado (nada entra depois de encerrar)
  if coalesce((select estado from execucoes where id = new.execucao_id for share), '') <> 'em_andamento' then
    perform _rv_erro('TRANSCRICAO_ENCERRADA');
  end if;
  return new;
end $$;
drop trigger if exists tg_transcricao_so_em_andamento on transcricoes;
create trigger tg_transcricao_so_em_andamento before insert on transcricoes for each row execute function rv_transcricao_so_em_andamento();

-- Análise do PEP a partir da transcrição: uma ao vivo (sugestão ao avaliador) e uma final (depois do encerramento).
create table if not exists analises_transcricao (
  execucao_id uuid not null references execucoes(id) on delete cascade,
  final       boolean not null default false,
  fonte       text not null check (fonte in ('ia','heuristica')),
  itens       jsonb not null default '[]'::jsonb,
  resumo      jsonb not null default '{}'::jsonb,
  segmentos   int not null default 0,
  gerada_em   timestamptz not null default now(),
  primary key (execucao_id, final)
);

alter table execucoes add column if not exists nota_original numeric(6,2);
alter table execucoes add column if not exists revisada_em   timestamptz;
alter table execucoes add column if not exists revisada_por  uuid references usuarios(id);

alter table cartoes add column if not exists estacao_id  uuid references estacoes(id) on delete set null;
alter table cartoes add column if not exists pep_item_id uuid references pep_itens(id) on delete set null;
alter table cartoes drop constraint if exists cartoes_origem_check;
alter table cartoes add constraint cartoes_origem_check check (origem in ('ia','manual','pep'));
create index if not exists ix_cartoes_estacao on cartoes(estacao_id) where estacao_id is not null;
