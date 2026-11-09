-- 005: estações no padrão INEP (instruções, cenário, materiais sob demanda), rascunhos de IA/importação e conceitos.
-- Idempotente. Rascunho = estacoes.status = 'rascunho' + criado_por.
alter table estacoes add column if not exists instrucoes_candidato text not null default '';
alter table estacoes add column if not exists cenario             text not null default '';
alter table estacoes add column if not exists conceitos           jsonb not null default '[]'::jsonb;
alter table estacoes add column if not exists esquema_versao      int   not null default 1;
alter table estacoes add column if not exists criado_por          uuid references usuarios(id);
alter table estacoes add column if not exists semente             bigint;
alter table estacoes add column if not exists incertos            jsonb not null default '[]'::jsonb;
alter table estacoes add column if not exists atualizado_em       timestamptz not null default now();
do $$ begin
  alter table estacoes drop constraint if exists estacoes_origem_check;
  alter table estacoes add constraint estacoes_origem_check check (origem in ('inep','comunidade','ia','importada','manual'));
end $$;

-- materiais extras liberados sob demanda (exame laboratorial, imagem, biópsia, laudo...)
create table if not exists estacao_materiais (
  id         uuid primary key default gen_random_uuid(),
  estacao_id uuid not null references estacoes(id) on delete cascade,
  ordem      int not null default 0,
  tipo       text not null default 'outro' check (tipo in ('laboratorial','imagem','biopsia','laudo','outro')),
  titulo     text not null,
  conteudo   text not null default '',
  gatilho    text not null default ''
);
create index if not exists ix_estacao_materiais on estacao_materiais(estacao_id, ordem);

-- o que o avaliador já liberou ao candidato em cada sessão
create table if not exists sessao_materiais (
  sessao_id   uuid not null references sessoes(id) on delete cascade,
  material_id uuid not null references estacao_materiais(id) on delete cascade,
  liberado_em timestamptz not null default now(),
  liberado_por uuid references usuarios(id),
  primary key (sessao_id, material_id)
);
