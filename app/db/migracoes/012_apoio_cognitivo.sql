-- O chefe da sala pode desligar o apoio cognitivo (grafo da conduta) para simular a prova sem ajuda. Padrão: ligado.
alter table salas add column if not exists apoio_cognitivo boolean not null default true;
