-- 014 · prática solo com IA. Idempotente.
create table if not exists praticas_solo (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  estacao_id  uuid not null references estacoes(id) on delete cascade,
  tema        text not null,
  area        text not null,
  dificuldade text not null check (dificuldade in ('facil','medio','dificil')),
  tempo_min   int  not null,
  itens       int  not null,
  motivo      text not null default '',
  criado_em   timestamptz not null default now()
);
create index if not exists praticas_solo_usuario_idx on praticas_solo (usuario_id, criado_em desc);
create index if not exists praticas_solo_estacao_idx on praticas_solo (estacao_id);
