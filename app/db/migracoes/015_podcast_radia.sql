-- 015 · podcast, playlists e rádio. Idempotente.
create table if not exists podcast_playlists (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  titulo        text not null,
  prompt        text not null default '',           -- detalhamento/customização da playlist inteira
  publica       boolean not null default false,     -- liga o feed público (link específico para apps de podcast)
  token_publico text unique,
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create index if not exists ix_podcast_pl_usuario on podcast_playlists(usuario_id, criada_em desc);

create table if not exists podcast_itens (
  id           uuid primary key default gen_random_uuid(),
  playlist_id  uuid not null references podcast_playlists(id) on delete cascade,
  posicao      int not null default 0,
  tipo         text not null default 'tema' check (tipo in ('tema','revisao_cards')),
  tema_id      uuid references temas(id) on delete set null,
  titulo       text not null,
  topico       text not null default '',            -- tópico específico dentro do tema
  prompt       text not null default '',            -- detalhamento/customização deste item
  minutos      int not null default 5 check (minutos between 1 and 20),
  roteiro      text not null default '',            -- transcrição em linguagem natural (é o texto falado)
  status       text not null default 'pendente' check (status in ('pendente','roteiro','pronto','erro')),
  erro         text not null default '',
  audio_arquivo text,                               -- nome do arquivo em PODCAST_DIR (nulo = sem áudio gerado)
  audio_mime   text,
  audio_bytes  int,
  duracao_s    int not null default 0,              -- estimada pelo texto (≈150 palavras/min)
  publico      boolean not null default false,      -- entra na playlist do programa radIA.m3d
  publicado_em timestamptz,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists ix_podcast_itens_pl on podcast_itens(playlist_id, posicao);
create index if not exists ix_podcast_itens_publico on podcast_itens(publicado_em desc) where publico;

create table if not exists podcast_posicoes (
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  item_id       uuid not null references podcast_itens(id) on delete cascade,
  posicao_s     double precision not null default 0,
  concluido     boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, item_id)
);

-- credencial do feed privado (uma por usuário; só o hash fica no banco; renovar revoga a anterior)
create table if not exists podcast_tokens (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  token_hash text not null unique,
  criado_em  timestamptz not null default now()
);

-- pool de exportação para a rádio: espera ser sincronizado; listagem na ordem do pedido
create table if not exists radia_pool (
  id             uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references usuarios(id) on delete cascade,
  titulo         text not null,
  pacote         jsonb not null,                    -- manifesto + roteiros (+ áudio em base64 quando houver e couber)
  itens          int not null default 0,
  status         text not null default 'pendente' check (status in ('pendente','sincronizado','erro')),
  tentativas     int not null default 0,
  erro           text not null default '',
  solicitado_em  timestamptz not null default now(),
  sincronizado_em timestamptz
);
create index if not exists ix_radia_pool_status on radia_pool(status, solicitado_em);
create index if not exists ix_radia_pool_user on radia_pool(solicitante_id, solicitado_em desc);
