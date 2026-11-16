-- Cartão próprio para o exame físico (sinais vitais e achados por sistema, inclusive quando normais).
alter table estacao_materiais drop constraint if exists estacao_materiais_tipo_check;
alter table estacao_materiais add constraint estacao_materiais_tipo_check
  check (tipo in ('laboratorial','imagem','biopsia','laudo','exame_fisico','outro'));
