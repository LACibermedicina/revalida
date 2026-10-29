-- 011 · duplicidade de estações, repetição de estação na fila e liberação da transcrição ao candidato

alter table estacoes add column if not exists titulo_norm text;
alter table estacoes add column if not exists conteudo_hash text;
create index if not exists ix_estacoes_titulo_norm on estacoes (titulo_norm);
create index if not exists ix_estacoes_conteudo_hash on estacoes (conteudo_hash);

-- o candidato só relê a transcrição depois que o avaliador libera
alter table execucoes add column if not exists transcricao_liberada boolean not null default false;
alter table execucoes add column if not exists transcricao_liberada_em timestamptz;

-- repetir uma estação que já está na fila exige confirmação explícita (p_repetir)
drop function if exists rv_ciclo_itens_adicionar(uuid, uuid, uuid[], text);
create or replace function rv_ciclo_itens_adicionar(p_ciclo uuid, p_ator uuid, p_estacoes uuid[], p_grupo text default null, p_repetir boolean default false) returns int language plpgsql as $$
declare sala uuid; s salas; c ciclos; base int;
begin
  select sala_id into sala from ciclos where id = p_ciclo;
  if sala is null then perform _rv_erro('CICLO_INEXISTENTE'); end if;
  s := _rv_trava_sala(sala);
  select * into c from ciclos where id = p_ciclo;
  if s.admin_id <> p_ator then perform _rv_erro('NAO_ADMIN'); end if;
  if c.estado <> 'ativo' then perform _rv_erro('CICLO_INATIVO'); end if;
  if p_estacoes is null or cardinality(p_estacoes) = 0 then perform _rv_erro('FILA_VAZIA'); end if;
  if (select count(*) from estacoes where id = any(p_estacoes)) <> (select count(distinct x) from unnest(p_estacoes) x) then
    perform _rv_erro('ESTACAO_INEXISTENTE');
  end if;
  if not coalesce(p_repetir, false) and exists (select 1 from ciclo_itens where ciclo_id = p_ciclo and estacao_id = any(p_estacoes)) then
    perform _rv_erro('ESTACAO_NA_FILA');
  end if;
  select coalesce(max(posicao), 0) into base from ciclo_itens where ciclo_id = p_ciclo;
  insert into ciclo_itens (ciclo_id, estacao_id, posicao, grupo)
    select p_ciclo, x.e, base + x.n, p_grupo from unnest(p_estacoes) with ordinality as x(e, n);
  return _rv_toque(sala, 'itens_adicionados', p_ator, null, jsonb_build_object('itens', cardinality(p_estacoes), 'grupo', p_grupo), p_ciclo, null);
end $$;
