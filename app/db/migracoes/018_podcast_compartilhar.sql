-- 018 · podcast: link público por episódio, áudio normalizado e agrupamento de trilhas. Idempotente.
alter table podcast_itens add column if not exists token_publico text;        -- liga o link público do episódio (opt-in; nulo = privado)
alter table podcast_itens add column if not exists compartilhado_em timestamptz;
alter table podcast_itens add column if not exists audio_normalizado boolean not null default false;   -- true = MP3 mono 44,1 kHz 64 kbps CBR com tags ID3 (padrão universal)
create unique index if not exists ux_podcast_itens_token on podcast_itens(token_publico) where token_publico is not null;
create index if not exists ix_podcast_pl_token on podcast_playlists(token_publico) where token_publico is not null;
