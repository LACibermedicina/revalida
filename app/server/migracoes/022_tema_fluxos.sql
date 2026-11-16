-- Fluxograma da conduta de um tema (gerado pela IA uma vez e reaproveitado). estacao_id = contexto de uma estação (opcional).
create table if not exists tema_fluxos (
  id          uuid primary key default gen_random_uuid(),
  tema_id     uuid not null references temas(id) on delete cascade,
  estacao_id  uuid references estacoes(id) on delete cascade,
  titulo      text not null default '',
  passos      jsonb not null,
  criado_em   timestamptz not null default now()
);
create unique index if not exists ux_tema_fluxos on tema_fluxos (tema_id, coalesce(estacao_id, '00000000-0000-0000-0000-000000000000'::uuid));
