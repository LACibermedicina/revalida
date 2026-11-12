-- 019 · mesa (shell estilo macOS): estado por usuário (favoritos, notas rápidas, dock) e mensagens diretas entre colegas. Idempotente.
create table if not exists mesa_usuario (
  usuario_id    uuid primary key references usuarios(id) on delete cascade,
  estado        jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
create table if not exists mensagens_diretas (
  id        uuid primary key default gen_random_uuid(),
  de_id     uuid not null references usuarios(id) on delete cascade,
  para_id   uuid not null references usuarios(id) on delete cascade,
  texto     text not null check (length(texto) between 1 and 1000),
  lida_em   timestamptz,
  criada_em timestamptz not null default now(),
  check (de_id <> para_id)
);
create index if not exists ix_msg_para on mensagens_diretas(para_id, lida_em, criada_em desc);
create index if not exists ix_msg_par  on mensagens_diretas(de_id, para_id, criada_em desc);
