-- 016 · prática solo com paciente IA e registro das participações. Idempotente.
-- A IA atua como ator/avaliador por um usuário de sistema ("Paciente IA"); o usuário real é o candidato da sala.
alter table usuarios add column if not exists sistema boolean not null default false;

-- sala de prática solo com IA: guarda tema e variação temática principal do caso clínico
create table if not exists salas_ia (
  sala_id        uuid primary key references salas(id) on delete cascade,
  usuario_id     uuid not null references usuarios(id) on delete cascade,
  estacao_id     uuid not null references estacoes(id) on delete cascade,
  fonte          text not null default 'banco' check (fonte in ('banco','ia')),
  tema           text not null default '',
  variacao_tema  text not null default '',
  criado_em      timestamptz not null default now()
);
create index if not exists salas_ia_usuario_idx on salas_ia (usuario_id, criado_em desc);

-- conversa com o paciente (o texto do candidato também vai para a transcrição, que alimenta a correção)
create table if not exists paciente_turnos (
  id          uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references execucoes(id) on delete cascade,
  ordem       int  not null,
  autor       text not null check (autor in ('candidato','paciente')),
  texto       text not null check (length(texto) between 1 and 2000),
  criado_em   timestamptz not null default now(),
  unique (execucao_id, ordem)
);

-- estações geradas por IA: de qual variação temática principal o caso clínico foi estendido (e de qual estação, se foi variação)
alter table estacoes add column if not exists variacao_tema text not null default '';
alter table estacoes add column if not exists variacao_de uuid references estacoes(id) on delete set null;
