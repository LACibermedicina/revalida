-- 008: catálogo de estações (lista de referência em server/data/catalogo.json) — só o estado de estudo de cada pessoa fica no banco. Idempotente.
create table if not exists catalogo_estudo (
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  codigo        text not null check (length(codigo) between 1 and 20),
  status        text not null default 'nao_estudada' check (status in ('nao_estudada','estudando','dominada')),
  prioridade    int  not null default 0 check (prioridade between 0 and 3),
  observacoes   text not null default '' check (length(observacoes) <= 2000),
  estacao_id    uuid references estacoes(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, codigo)
);
