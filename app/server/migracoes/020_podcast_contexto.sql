-- Podcast a partir de uma estação, trilha, cartões ou caderno de erros: o conteúdo chega pré-formatado (contexto) e o modo diz
-- se o roteiro comenta o desempenho do usuário ('com_desempenho') ou só aprofunda o estudo ('aprofundar').
alter table podcast_itens drop constraint if exists podcast_itens_tipo_check;
alter table podcast_itens add constraint podcast_itens_tipo_check check (tipo in ('tema','revisao_cards','conteudo'));
alter table podcast_itens add column if not exists contexto text not null default '';
alter table podcast_itens add column if not exists modo     text check (modo in ('com_desempenho','aprofundar'));
alter table podcast_itens add column if not exists origem   text check (origem in ('estacao','trilha','cartoes','erros','tema'));
alter table podcast_itens add column if not exists estacao_id uuid references estacoes(id) on delete set null;
