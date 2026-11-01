-- 004: salas persistentes, ciclos de estações, papéis dinâmicos, pausa/retomada.
-- Idempotente: roda em banco novo (já incluída em schema.sql) ou existente.
-- As transições rodam em FUNÇÕES plpgsql: cada chamada é uma transação atômica que trava a linha da sala,
-- então vale com vários processos da API. Erros de regra saem como exceção com SQLSTATE 'RV001' e mensagem = código.

create table if not exists salas (
  id                 uuid primary key default gen_random_uuid(),
  dono_id            uuid not null references usuarios(id),
  admin_id           uuid not null references usuarios(id),
  canal_video        text not null unique default ('sala-' || gen_random_uuid()::text),
  ciclo_ativo_id     uuid,
  estado             text not null default 'aberta' check (estado in ('aberta','encerrada')),
  audio_observadores boolean not null default false,
  versao             int not null default 0,
  criada_em          timestamptz not null default now()
);

create table if not exists ciclos (
  id           uuid primary key default gen_random_uuid(),
  sala_id      uuid not null references salas(id) on delete cascade,
  admin_id     uuid not null references usuarios(id),
  candidato_id uuid references usuarios(id),
  estado       text not null check (estado in ('ativo','pausado','encerrado','concluido')),
  origem_id    uuid references ciclos(id),
  motivo_pausa text check (motivo_pausa in ('manual','transferencia','inversao','saida')),
  versao       int not null default 0,
  criado_em    timestamptz not null default now(),
  pausado_em   timestamptz
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'salas_ciclo_ativo_fk') then
    alter table salas add constraint salas_ciclo_ativo_fk foreign key (ciclo_ativo_id) references ciclos(id);
  end if;
end $$;
create unique index if not exists uq_ciclo_ativo_por_sala on ciclos(sala_id) where estado = 'ativo';

create table if not exists ciclo_itens (
  id                    uuid primary key default gen_random_uuid(),
  ciclo_id              uuid not null references ciclos(id) on delete cascade,
  estacao_id            uuid not null references estacoes(id),
  posicao               int not null,
  liberada_ao_candidato boolean not null default false,
  grupo                 text,
  unique (ciclo_id, posicao)
);

create table if not exists execucoes (
  id            uuid primary key default gen_random_uuid(),
  sala_id       uuid not null references salas(id) on delete cascade,
  ciclo_id      uuid not null references ciclos(id) on delete cascade,
  item_id       uuid not null references ciclo_itens(id) on delete cascade,
  estado        text not null check (estado in ('em_andamento','pausada','finalizada','abandonada')),
  avaliador_id  uuid not null references usuarios(id),
  candidato_id  uuid not null references usuarios(id),
  iniciada_em   timestamptz not null default now(),
  finalizada_em timestamptz,
  nota          numeric(6,2),
  checklist     jsonb not null default '{}'::jsonb,
  versao        int not null default 0
);
create unique index if not exists uq_execucao_andamento on execucoes(sala_id) where estado = 'em_andamento';

create table if not exists sala_participantes (
  sala_id           uuid not null references salas(id) on delete cascade,
  usuario_id        uuid not null references usuarios(id),
  papel             text not null check (papel in ('admin','candidato','observador')),
  e_avaliador       boolean not null default false,
  video_pausado_por uuid references usuarios(id),
  entrou_em         timestamptz not null default now(),
  saiu_em           timestamptz,
  primary key (sala_id, usuario_id)
);
create unique index if not exists uq_sala_um_admin     on sala_participantes(sala_id) where papel = 'admin'     and saiu_em is null;
create unique index if not exists uq_sala_um_candidato on sala_participantes(sala_id) where papel = 'candidato' and saiu_em is null;
create unique index if not exists uq_sala_um_avaliador on sala_participantes(sala_id) where e_avaliador         and saiu_em is null;

create table if not exists solicitacoes_papel (
  id             uuid primary key default gen_random_uuid(),
  sala_id        uuid not null references salas(id) on delete cascade,
  solicitante_id uuid not null references usuarios(id),
  papel_pedido   text not null check (papel_pedido in ('admin','candidato')),
  estado         text not null default 'pendente' check (estado in ('pendente','aceita','recusada','cancelada','expirada')),
  criada_em      timestamptz not null default now(),
  decidida_em    timestamptz
);
create unique index if not exists uq_sala_pedido_pendente on solicitacoes_papel(sala_id, solicitante_id) where estado = 'pendente';

create table if not exists paused_cycles (
  ciclo_id        uuid primary key references ciclos(id) on delete cascade,
  execucao_id     uuid references execucoes(id),
  snapshot        jsonb not null default '{}'::jsonb,
  proximo_item_id uuid references ciclo_itens(id),
  retomavel_por   uuid[] not null,
  pausado_em      timestamptz not null default now()
);

create table if not exists sala_eventos (
  id           bigserial primary key,
  sala_id      uuid not null references salas(id) on delete cascade,
  ciclo_id     uuid, execucao_id uuid,
  tipo         text not null,
  ator_id      uuid, alvo_id uuid,
  dados        jsonb,
  em           timestamptz not null default now()
);
create index if not exists ix_sala_eventos_sala on sala_eventos(sala_id, id);

create table if not exists usuario_estacao (
  usuario_id      uuid not null references usuarios(id),
  estacao_id      uuid not null references estacoes(id),
  vezes_realizada int not null default 0,
  melhor_nota     numeric(6,2),
  ultima_em       timestamptz,
  primary key (usuario_id, estacao_id)
);

/* ======================= funções internas ======================= */

create or replace function _rv_erro(p_codigo text) returns void language plpgsql as $$
begin raise exception '%', p_codigo using errcode = 'RV001'; end $$;

create or replace function _rv_trava_sala(p_sala uuid) returns salas language plpgsql as $$
declare s salas;
begin
  select * into s from salas where id = p_sala for update;
  if not found then perform _rv_erro('SALA_INEXISTENTE'); end if;
  return s;
end $$;

-- sobe a versão da sala e registra o evento; devolve a versão nova
create or replace function _rv_toque(p_sala uuid, p_tipo text, p_ator uuid, p_alvo uuid, p_dados jsonb, p_ciclo uuid, p_exec uuid)
returns int language plpgsql as $$
declare v int;
begin
  update salas set versao = versao + 1 where id = p_sala returning versao into v;
  insert into sala_eventos (sala_id, ciclo_id, execucao_id, tipo, ator_id, alvo_id, dados)
    values (p_sala, p_ciclo, p_exec, p_tipo, p_ator, p_alvo, p_dados);
  return v;
end $$;

create or replace function _rv_presente(p_sala uuid, p_usuario uuid) returns boolean language sql stable as $$
  select exists (select 1 from sala_participantes where sala_id = p_sala and usuario_id = p_usuario and saiu_em is null)
$$;

create or replace function _rv_proximo_item(p_ciclo uuid) returns uuid language sql stable as $$
  select i.id from ciclo_itens i
  where i.ciclo_id = p_ciclo
    and not exists (select 1 from execucoes e where e.item_id = i.id and e.estado = 'finalizada')
  order by i.posicao limit 1
$$;

-- Pausa o ciclo e (se houver) a execução em andamento, guardando o ponto de retomada.
create or replace function _rv_pausar_ciclo(p_ciclo uuid, p_motivo text, p_snapshot jsonb) returns void language plpgsql as $$
declare c ciclos; e execucoes;
begin
  select * into c from ciclos where id = p_ciclo;
  select * into e from execucoes where ciclo_id = p_ciclo and estado = 'em_andamento';
  if e.id is not null then update execucoes set estado = 'pausada' where id = e.id; end if;
  update ciclos set estado = 'pausado', motivo_pausa = p_motivo, pausado_em = now(), versao = versao + 1 where id = p_ciclo;
  insert into paused_cycles (ciclo_id, execucao_id, snapshot, proximo_item_id, retomavel_por)
    values (p_ciclo, e.id, coalesce(p_snapshot, '{}'::jsonb), _rv_proximo_item(p_ciclo),
            array_remove(array[c.admin_id, c.candidato_id], null))
  on conflict (ciclo_id) do update
    set execucao_id = excluded.execucao_id, snapshot = excluded.snapshot, proximo_item_id = excluded.proximo_item_id,
        retomavel_por = excluded.retomavel_por, pausado_em = now();
  update salas set ciclo_ativo_id = null where id = c.sala_id and ciclo_ativo_id = p_ciclo;
end $$;

-- Define o papel de alguém (quem ocupava a vaga vira observador antes, para respeitar as unicidades).
create or replace function _rv_dar_papel(p_sala uuid, p_usuario uuid, p_papel text, p_avaliador boolean) returns void language plpgsql as $$
begin
  if p_papel in ('admin','candidato') then
    update sala_participantes set papel = 'observador', e_avaliador = false
      where sala_id = p_sala and papel = p_papel and saiu_em is null and usuario_id <> p_usuario;
  end if;
  if p_avaliador then
    update sala_participantes set e_avaliador = false where sala_id = p_sala and e_avaliador and usuario_id <> p_usuario;
  end if;
  insert into sala_participantes (sala_id, usuario_id, papel, e_avaliador)
    values (p_sala, p_usuario, p_papel, p_avaliador)
  on conflict (sala_id, usuario_id) do update
    set papel = excluded.papel, e_avaliador = excluded.e_avaliador, saiu_em = null;
end $$;

/* ======================= sala ======================= */

create or replace function rv_sala_criar(p_usuario uuid) returns uuid language plpgsql as $$
declare sid uuid;
begin
  insert into salas (dono_id, admin_id) values (p_usuario, p_usuario) returning salas.id into sid;
  insert into sala_participantes (sala_id, usuario_id, papel, e_avaliador) values (sid, p_usuario, 'admin', true);
  perform _rv_toque(sid, 'sala_criada', p_usuario, null, null, null, null);
  return sid;
end $$;

create or replace function rv_sala_entrar(p_sala uuid, p_usuario uuid) returns jsonb language plpgsql as $$
declare s salas; c ciclos; v_papel text; av boolean := false; v int;
begin
  s := _rv_trava_sala(p_sala);
  if s.estado = 'encerrada' then perform _rv_erro('SALA_ENCERRADA'); end if;
  if _rv_presente(p_sala, p_usuario) then
    select sp.papel into v_papel from sala_participantes sp where sala_id = p_sala and usuario_id = p_usuario;
    return jsonb_build_object('papel', v_papel, 'versao', s.versao);
  end if;
  v_papel := 'observador';
  if p_usuario = s.admin_id then
    v_papel := 'admin';
    av := not exists (select 1 from sala_participantes where sala_id = p_sala and e_avaliador and saiu_em is null);
  elsif s.ciclo_ativo_id is not null then
    select * into c from ciclos where id = s.ciclo_ativo_id;
    if c.candidato_id = p_usuario
       and not exists (select 1 from sala_participantes where sala_id = p_sala and papel = 'candidato' and saiu_em is null) then
      v_papel := 'candidato';
    end if;
  end if;
  perform _rv_dar_papel(p_sala, p_usuario, v_papel, av);
  v := _rv_toque(p_sala, 'entrou', p_usuario, null, jsonb_build_object('papel', v_papel), s.ciclo_ativo_id, null);
  return jsonb_build_object('papel', v_papel, 'versao', v);
end $$;

create or replace function rv_sala_sair(p_sala uuid, p_usuario uuid) returns int language plpgsql as $$
declare s salas;
begin
  s := _rv_trava_sala(p_sala);
  update sala_participantes set saiu_em = now(), e_avaliador = false where sala_id = p_sala and usuario_id = p_usuario and saiu_em is null;
  return _rv_toque(p_sala, 'saiu', p_usuario, null, null, s.ciclo_ativo_id, null);
end $$;

-- Chamada pelo servidor após o tempo de graça: se admin ou candidato do ciclo ativo continuam fora, pausa tudo.
create or replace function rv_sala_pausar_por_saida(p_sala uuid) returns boolean language plpgsql as $$
declare s salas; c ciclos;
begin
  s := _rv_trava_sala(p_sala);
  if s.ciclo_ativo_id is null then return false; end if;
  select * into c from ciclos where id = s.ciclo_ativo_id;
  if _rv_presente(p_sala, c.admin_id) and (c.candidato_id is null or _rv_presente(p_sala, c.candidato_id)) then return false; end if;
  perform _rv_pausar_ciclo(c.id, 'saida', '{}'::jsonb);
  perform _rv_toque(p_sala, 'ciclo_pausado', null, null, jsonb_build_object('motivo', 'saida'), c.id, null);
  return true;
end $$;

create or replace function rv_avaliador_delegar(p_sala uuid, p_ator uuid, p_alvo uuid) returns int language plpgsql as $$
declare s salas; c ciclos;
begin
  s := _rv_trava_sala(p_sala);
  if s.admin_id <> p_ator then perform _rv_erro('NAO_ADMIN'); end if;
  if not _rv_presente(p_sala, p_alvo) then perform _rv_erro('PARTICIPANTE_AUSENTE'); end if;
  if exists (select 1 from sala_participantes where sala_id = p_sala and usuario_id = p_alvo and papel = 'candidato') then
    perform _rv_erro('CANDIDATO_NAO_AVALIA');
  end if;
  if exists (select 1 from execucoes where sala_id = p_sala and estado = 'em_andamento') then perform _rv_erro('EXECUCAO_EM_ANDAMENTO'); end if;
  update sala_participantes set e_avaliador = false where sala_id = p_sala and e_avaliador;
  update sala_participantes set e_avaliador = true where sala_id = p_sala and usuario_id = p_alvo;
  return _rv_toque(p_sala, 'avaliador_delegado', p_ator, p_alvo, null, s.ciclo_ativo_id, null);
end $$;

create or replace function rv_candidato_definir(p_sala uuid, p_ator uuid, p_alvo uuid) returns int language plpgsql as $$
declare s salas;
begin
  s := _rv_trava_sala(p_sala);
  if s.admin_id <> p_ator then perform _rv_erro('NAO_ADMIN'); end if;
  if p_alvo = s.admin_id or not _rv_presente(p_sala, p_alvo) then perform _rv_erro('PARTICIPANTE_INVALIDO'); end if;
  if exists (select 1 from execucoes where sala_id = p_sala and estado = 'em_andamento') then perform _rv_erro('EXECUCAO_EM_ANDAMENTO'); end if;
  perform _rv_dar_papel(p_sala, p_alvo, 'candidato', false);
  if s.ciclo_ativo_id is not null then update ciclos set candidato_id = p_alvo, versao = versao + 1 where id = s.ciclo_ativo_id; end if;
  return _rv_toque(p_sala, 'candidato_definido', p_ator, p_alvo, null, s.ciclo_ativo_id, null);
end $$;

create or replace function rv_video_pausar(p_sala uuid, p_ator uuid, p_alvo uuid, p_pausado boolean) returns int language plpgsql as $$
declare s salas;
begin
  s := _rv_trava_sala(p_sala);
  if s.admin_id <> p_ator then perform _rv_erro('NAO_ADMIN'); end if;
  if not _rv_presente(p_sala, p_alvo) then perform _rv_erro('PARTICIPANTE_AUSENTE'); end if;
  update sala_participantes set video_pausado_por = case when p_pausado then p_ator else null end
    where sala_id = p_sala and usuario_id = p_alvo;
  return _rv_toque(p_sala, case when p_pausado then 'video_pausado' else 'video_liberado' end, p_ator, p_alvo, null, s.ciclo_ativo_id, null);
end $$;

/* ======================= ciclos e fila ======================= */

create or replace function rv_ciclo_criar(p_sala uuid, p_ator uuid, p_estacoes uuid[], p_grupo text default null) returns uuid language plpgsql as $$
declare s salas; cid uuid; cand uuid;
begin
  s := _rv_trava_sala(p_sala);
  if s.admin_id <> p_ator then perform _rv_erro('NAO_ADMIN'); end if;
  if s.ciclo_ativo_id is not null then perform _rv_erro('CICLO_ATIVO'); end if;
  if p_estacoes is null or cardinality(p_estacoes) = 0 then perform _rv_erro('FILA_VAZIA'); end if;
  if (select count(*) from estacoes where id = any(p_estacoes)) <> (select count(distinct x) from unnest(p_estacoes) x) then
    perform _rv_erro('ESTACAO_INEXISTENTE');
  end if;
  select usuario_id into cand from sala_participantes where sala_id = p_sala and papel = 'candidato' and saiu_em is null;
  insert into ciclos (sala_id, admin_id, candidato_id, estado) values (p_sala, s.admin_id, cand, 'ativo') returning id into cid;
  insert into ciclo_itens (ciclo_id, estacao_id, posicao, grupo)
    select cid, x.e, x.n, p_grupo from unnest(p_estacoes) with ordinality as x(e, n);
  update salas set ciclo_ativo_id = cid where id = p_sala;
  perform _rv_toque(p_sala, 'ciclo_criado', p_ator, null, jsonb_build_object('itens', cardinality(p_estacoes)), cid, null);
  return cid;
end $$;

create or replace function rv_ciclo_itens_adicionar(p_ciclo uuid, p_ator uuid, p_estacoes uuid[], p_grupo text default null) returns int language plpgsql as $$
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
  select coalesce(max(posicao), 0) into base from ciclo_itens where ciclo_id = p_ciclo;
  insert into ciclo_itens (ciclo_id, estacao_id, posicao, grupo)
    select p_ciclo, x.e, base + x.n, p_grupo from unnest(p_estacoes) with ordinality as x(e, n);
  return _rv_toque(sala, 'itens_adicionados', p_ator, null, jsonb_build_object('itens', cardinality(p_estacoes), 'grupo', p_grupo), p_ciclo, null);
end $$;

create or replace function rv_item_liberar(p_ciclo uuid, p_item uuid, p_ator uuid, p_liberar boolean) returns int language plpgsql as $$
declare sala uuid; s salas;
begin
  select sala_id into sala from ciclos where id = p_ciclo;
  if sala is null then perform _rv_erro('CICLO_INEXISTENTE'); end if;
  s := _rv_trava_sala(sala);
  if s.admin_id <> p_ator then perform _rv_erro('NAO_ADMIN'); end if;
  update ciclo_itens set liberada_ao_candidato = p_liberar where id = p_item and ciclo_id = p_ciclo;
  if not found then perform _rv_erro('ITEM_INVALIDO'); end if;
  return _rv_toque(sala, 'item_liberado', p_ator, null, jsonb_build_object('item', p_item, 'liberada', p_liberar), p_ciclo, null);
end $$;

/* ======================= execução ======================= */

create or replace function rv_execucao_iniciar(p_ciclo uuid, p_ator uuid, p_item uuid default null) returns jsonb language plpgsql as $$
declare sala uuid; s salas; c ciclos; item uuid; aval uuid; eid uuid; v int;
begin
  select sala_id into sala from ciclos where id = p_ciclo;
  if sala is null then perform _rv_erro('CICLO_INEXISTENTE'); end if;
  s := _rv_trava_sala(sala);
  select * into c from ciclos where id = p_ciclo;
  if s.admin_id <> p_ator then perform _rv_erro('NAO_ADMIN'); end if;
  if c.estado <> 'ativo' then perform _rv_erro('CICLO_INATIVO'); end if;
  if c.candidato_id is null or not _rv_presente(sala, c.candidato_id) then perform _rv_erro('SEM_CANDIDATO'); end if;
  if exists (select 1 from execucoes where sala_id = sala and estado = 'em_andamento') then perform _rv_erro('EXECUCAO_EM_ANDAMENTO'); end if;
  item := coalesce(p_item, _rv_proximo_item(p_ciclo));
  if item is null then perform _rv_erro('FILA_VAZIA'); end if;
  if not exists (select 1 from ciclo_itens where id = item and ciclo_id = p_ciclo) then perform _rv_erro('ITEM_INVALIDO'); end if;
  select usuario_id into aval from sala_participantes where sala_id = sala and e_avaliador and saiu_em is null;
  begin
    insert into execucoes (sala_id, ciclo_id, item_id, estado, avaliador_id, candidato_id)
      values (sala, p_ciclo, item, 'em_andamento', coalesce(aval, p_ator), c.candidato_id) returning id into eid;
  exception when unique_violation then
    perform _rv_erro('EXECUCAO_EM_ANDAMENTO');
  end;
  v := _rv_toque(sala, 'estacao_iniciada', p_ator, c.candidato_id, jsonb_build_object('item', item), p_ciclo, eid);
  return jsonb_build_object('execucao_id', eid, 'item_id', item, 'versao', v);
end $$;

create or replace function rv_execucao_finalizar(p_execucao uuid, p_ator uuid, p_nota numeric default null, p_checklist jsonb default '{}'::jsonb) returns jsonb language plpgsql as $$
declare sala uuid; s salas; e execucoes; est uuid; vezes int; v int;
begin
  select sala_id into sala from execucoes where id = p_execucao;
  if sala is null then perform _rv_erro('EXECUCAO_INEXISTENTE'); end if;
  s := _rv_trava_sala(sala);
  select * into e from execucoes where id = p_execucao;
  if e.estado <> 'em_andamento' then perform _rv_erro('EXECUCAO_INATIVA'); end if;
  if p_ator <> s.admin_id and p_ator <> e.avaliador_id then perform _rv_erro('NAO_PERMITIDO'); end if;
  update execucoes set estado = 'finalizada', finalizada_em = now(), nota = p_nota, checklist = coalesce(p_checklist, '{}'::jsonb), versao = versao + 1
    where id = p_execucao;
  select estacao_id into est from ciclo_itens where id = e.item_id;
  insert into usuario_estacao (usuario_id, estacao_id, vezes_realizada, melhor_nota, ultima_em)
    values (e.candidato_id, est, 1, p_nota, now())
  on conflict (usuario_id, estacao_id) do update
    set vezes_realizada = usuario_estacao.vezes_realizada + 1,
        melhor_nota = greatest(usuario_estacao.melhor_nota, excluded.melhor_nota), ultima_em = now()
  returning usuario_estacao.vezes_realizada into vezes;
  v := _rv_toque(sala, 'estacao_finalizada', p_ator, e.candidato_id, jsonb_build_object('nota', p_nota), e.ciclo_id, p_execucao);
  return jsonb_build_object('execucao_id', p_execucao, 'vezes_realizada', vezes, 'versao', v);
end $$;

-- p_acao: encerrar | manter | avancar | inverter. Só depois de finalizar (nenhuma execução em andamento).
create or replace function rv_ciclo_proximo(p_ciclo uuid, p_ator uuid, p_acao text, p_snapshot jsonb default '{}'::jsonb) returns jsonb language plpgsql as $$
declare sala uuid; s salas; c ciclos; novo uuid; velho_admin uuid; velho_cand uuid; ultimo uuid; v int;
begin
  select sala_id into sala from ciclos where id = p_ciclo;
  if sala is null then perform _rv_erro('CICLO_INEXISTENTE'); end if;
  s := _rv_trava_sala(sala);
  select * into c from ciclos where id = p_ciclo;
  if s.admin_id <> p_ator then perform _rv_erro('NAO_ADMIN'); end if;
  if c.estado <> 'ativo' then perform _rv_erro('CICLO_INATIVO'); end if;
  if p_acao not in ('encerrar','manter','avancar','inverter') then perform _rv_erro('ACAO_INVALIDA'); end if;
  if exists (select 1 from execucoes where sala_id = sala and estado = 'em_andamento') then perform _rv_erro('EXECUCAO_EM_ANDAMENTO'); end if;

  if p_acao = 'encerrar' then
    perform _rv_pausar_ciclo(p_ciclo, 'manual', p_snapshot);
    v := _rv_toque(sala, 'ciclo_pausado', p_ator, null, jsonb_build_object('motivo', 'manual'), p_ciclo, null);
    return jsonb_build_object('ciclo_id', p_ciclo, 'estado', 'pausado', 'versao', v);
  elsif p_acao = 'manter' then
    -- repetir a última estação finalizada
    select i.id into ultimo from execucoes e join ciclo_itens i on i.id = e.item_id
      where e.ciclo_id = p_ciclo and e.estado = 'finalizada' order by e.finalizada_em desc limit 1;
    v := _rv_toque(sala, 'ciclo_mantido', p_ator, null, null, p_ciclo, null);
    return jsonb_build_object('ciclo_id', p_ciclo, 'proximo_item_id', coalesce(ultimo, _rv_proximo_item(p_ciclo)), 'versao', v);
  elsif p_acao = 'avancar' then
    v := _rv_toque(sala, 'ciclo_avancou', p_ator, null, null, p_ciclo, null);
    return jsonb_build_object('ciclo_id', p_ciclo, 'proximo_item_id', _rv_proximo_item(p_ciclo), 'versao', v);
  end if;

  -- inverter: o candidato vira admin e o admin vira candidato, em um ciclo novo
  velho_admin := s.admin_id; velho_cand := c.candidato_id;
  if velho_cand is null or not _rv_presente(sala, velho_cand) then perform _rv_erro('SEM_CANDIDATO'); end if;
  perform _rv_pausar_ciclo(p_ciclo, 'inversao', p_snapshot);
  update sala_participantes set papel = 'observador', e_avaliador = false where sala_id = sala and (papel in ('admin','candidato') or e_avaliador);
  perform _rv_dar_papel(sala, velho_cand, 'admin', true);
  perform _rv_dar_papel(sala, velho_admin, 'candidato', false);
  update salas set admin_id = velho_cand where id = sala;
  insert into ciclos (sala_id, admin_id, candidato_id, estado, origem_id) values (sala, velho_cand, velho_admin, 'ativo', p_ciclo) returning id into novo;
  update salas set ciclo_ativo_id = novo where id = sala;
  v := _rv_toque(sala, 'papeis_invertidos', p_ator, velho_cand, jsonb_build_object('ciclo_pausado', p_ciclo, 'ciclo_novo', novo), novo, null);
  return jsonb_build_object('ciclo_id', novo, 'ciclo_pausado_id', p_ciclo, 'estado', 'ativo', 'versao', v);
end $$;

/* ======================= pedidos de papel ======================= */

create or replace function rv_solicitar_papel(p_sala uuid, p_usuario uuid, p_papel text) returns jsonb language plpgsql as $$
declare s salas; sid uuid; meu text; v int;
begin
  s := _rv_trava_sala(p_sala);
  if p_papel not in ('admin','candidato') then perform _rv_erro('PAPEL_INVALIDO'); end if;
  select papel into meu from sala_participantes where sala_id = p_sala and usuario_id = p_usuario and saiu_em is null;
  if meu is null then perform _rv_erro('NAO_ESTA_NA_SALA'); end if;
  if meu <> 'observador' then perform _rv_erro('NAO_E_OBSERVADOR'); end if;
  begin
    insert into solicitacoes_papel (sala_id, solicitante_id, papel_pedido) values (p_sala, p_usuario, p_papel) returning id into sid;
  exception when unique_violation then
    perform _rv_erro('PEDIDO_PENDENTE');
  end;
  v := _rv_toque(p_sala, 'papel_solicitado', p_usuario, s.admin_id, jsonb_build_object('papel', p_papel, 'solicitacao', sid), s.ciclo_ativo_id, null);
  return jsonb_build_object('solicitacao_id', sid, 'versao', v);
end $$;

create or replace function rv_solicitacao_cancelar(p_solicitacao uuid, p_usuario uuid) returns void language plpgsql as $$
declare sala uuid;
begin
  select sala_id into sala from solicitacoes_papel where id = p_solicitacao;
  if sala is null then perform _rv_erro('SOLICITACAO_INEXISTENTE'); end if;
  perform _rv_trava_sala(sala);
  update solicitacoes_papel set estado = 'cancelada', decidida_em = now()
    where id = p_solicitacao and solicitante_id = p_usuario and estado = 'pendente';
  if not found then perform _rv_erro('SOLICITACAO_INATIVA'); end if;
  perform _rv_toque(sala, 'solicitacao_cancelada', p_usuario, null, null, null, null);
end $$;

-- Aceitar = transferir: pausa execução e ciclo atuais (snapshot), troca o papel e abre um ciclo novo.
create or replace function rv_solicitacao_decidir(p_solicitacao uuid, p_ator uuid, p_aceitar boolean, p_snapshot jsonb default '{}'::jsonb) returns jsonb language plpgsql as $$
declare sala uuid; s salas; r solicitacoes_papel; c ciclos; novo uuid; v int; cand uuid; adm uuid; velho uuid;
begin
  select sala_id into sala from solicitacoes_papel where id = p_solicitacao;
  if sala is null then perform _rv_erro('SOLICITACAO_INEXISTENTE'); end if;
  s := _rv_trava_sala(sala);
  select * into r from solicitacoes_papel where id = p_solicitacao;
  if s.admin_id <> p_ator then perform _rv_erro('NAO_ADMIN'); end if;
  if r.estado <> 'pendente' then perform _rv_erro('SOLICITACAO_INATIVA'); end if;

  if not p_aceitar then
    update solicitacoes_papel set estado = 'recusada', decidida_em = now() where id = p_solicitacao;
    v := _rv_toque(sala, 'papel_recusado', p_ator, r.solicitante_id, jsonb_build_object('papel', r.papel_pedido), s.ciclo_ativo_id, null);
    return jsonb_build_object('estado', 'recusada', 'versao', v);
  end if;

  if not exists (select 1 from sala_participantes where sala_id = sala and usuario_id = r.solicitante_id and papel = 'observador' and saiu_em is null) then
    update solicitacoes_papel set estado = 'expirada', decidida_em = now() where id = p_solicitacao;
    v := _rv_toque(sala, 'papel_expirado', p_ator, r.solicitante_id, null, s.ciclo_ativo_id, null);
    return jsonb_build_object('estado', 'expirada', 'versao', v);
  end if;

  cand := null; adm := s.admin_id; velho := null;
  if s.ciclo_ativo_id is not null then
    select * into c from ciclos where id = s.ciclo_ativo_id;
    cand := c.candidato_id;
    perform _rv_pausar_ciclo(c.id, 'transferencia', p_snapshot);
  end if;

  if r.papel_pedido = 'candidato' then
    velho := cand;
    perform _rv_dar_papel(sala, r.solicitante_id, 'candidato', false);
    cand := r.solicitante_id;
  else
    velho := s.admin_id;
    update sala_participantes set papel = 'observador', e_avaliador = false where sala_id = sala and (papel = 'admin' or e_avaliador);
    perform _rv_dar_papel(sala, r.solicitante_id, 'admin', true);
    update salas set admin_id = r.solicitante_id where id = sala;
    adm := r.solicitante_id;
  end if;

  update solicitacoes_papel set estado = 'aceita', decidida_em = now() where id = p_solicitacao;
  update solicitacoes_papel set estado = 'recusada', decidida_em = now()
    where sala_id = sala and estado = 'pendente' and papel_pedido = r.papel_pedido and id <> p_solicitacao;

  novo := null;
  if s.ciclo_ativo_id is not null then
    insert into ciclos (sala_id, admin_id, candidato_id, estado, origem_id) values (sala, adm, cand, 'ativo', c.id) returning id into novo;
    update salas set ciclo_ativo_id = novo where id = sala;
  end if;
  v := _rv_toque(sala, 'papel_transferido', p_ator, r.solicitante_id,
                 jsonb_build_object('papel', r.papel_pedido, 'anterior', velho, 'ciclo_pausado', c.id, 'ciclo_novo', novo), coalesce(novo, c.id), null);
  return jsonb_build_object('estado', 'aceita', 'ciclo_id', novo, 'ciclo_pausado_id', c.id, 'versao', v);
end $$;

-- Volta a um ciclo pausado (admin ou candidato daquele ciclo). Exige que não haja ciclo ativo na sala.
create or replace function rv_ciclo_retomar(p_ciclo uuid, p_usuario uuid) returns jsonb language plpgsql as $$
declare sala uuid; s salas; c ciclos; pc paused_cycles; v int;
begin
  select sala_id into sala from ciclos where id = p_ciclo;
  if sala is null then perform _rv_erro('CICLO_INEXISTENTE'); end if;
  s := _rv_trava_sala(sala);
  select * into c from ciclos where id = p_ciclo;
  select * into pc from paused_cycles where ciclo_id = p_ciclo;
  if c.estado <> 'pausado' or pc.ciclo_id is null then perform _rv_erro('CICLO_NAO_PAUSADO'); end if;
  if not (p_usuario = any(pc.retomavel_por)) then perform _rv_erro('NAO_PERMITIDO'); end if;
  if s.ciclo_ativo_id is not null then perform _rv_erro('CICLO_ATIVO'); end if;
  if not _rv_presente(sala, c.admin_id) or (c.candidato_id is not null and not _rv_presente(sala, c.candidato_id)) then
    perform _rv_erro('PARTICIPANTE_AUSENTE');
  end if;
  update sala_participantes set papel = 'observador', e_avaliador = false where sala_id = sala and (papel in ('admin','candidato') or e_avaliador);
  perform _rv_dar_papel(sala, c.admin_id, 'admin', true);
  if c.candidato_id is not null then perform _rv_dar_papel(sala, c.candidato_id, 'candidato', false); end if;
  update salas set admin_id = c.admin_id, ciclo_ativo_id = p_ciclo where id = sala;
  update ciclos set estado = 'ativo', motivo_pausa = null, pausado_em = null, versao = versao + 1 where id = p_ciclo;
  if pc.execucao_id is not null then update execucoes set estado = 'em_andamento' where id = pc.execucao_id; end if;
  delete from paused_cycles where ciclo_id = p_ciclo;
  v := _rv_toque(sala, 'ciclo_retomado', p_usuario, null, jsonb_build_object('execucao', pc.execucao_id), p_ciclo, pc.execucao_id);
  return jsonb_build_object('ciclo_id', p_ciclo, 'execucao_id', pc.execucao_id, 'snapshot', pc.snapshot, 'proximo_item_id', pc.proximo_item_id, 'versao', v);
end $$;

/* ======================= estado filtrado por papel ======================= */

-- A regra de visibilidade fica AQUI: só o admin vê a fila inteira; os demais veem apenas estações
-- já feitas, pausadas, em andamento ou liberadas explicitamente. Nada de título, posição ou contagem das futuras.
create or replace function rv_sala_estado(p_sala uuid, p_usuario uuid) returns jsonb language plpgsql stable as $$
declare s salas; meu text; c ciclos; fila jsonb := '[]'; parts jsonb; pausados jsonb; pend jsonb; exe jsonb := null;
begin
  select * into s from salas where id = p_sala;
  if not found then perform _rv_erro('SALA_INEXISTENTE'); end if;
  select papel into meu from sala_participantes where sala_id = p_sala and usuario_id = p_usuario and saiu_em is null;
  if meu is null then perform _rv_erro('NAO_ESTA_NA_SALA'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('usuario_id', sp.usuario_id, 'nome', u.nome, 'papel', sp.papel,
           'e_avaliador', sp.e_avaliador, 'video_pausado', sp.video_pausado_por is not null) order by sp.entrou_em), '[]')
    into parts
    from sala_participantes sp join usuarios u on u.id = sp.usuario_id where sp.sala_id = p_sala and sp.saiu_em is null;

  if s.ciclo_ativo_id is not null then
    select * into c from ciclos where id = s.ciclo_ativo_id;
    select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'posicao', i.posicao, 'estacao_id', i.estacao_id, 'titulo', t.titulo,
             'estado', coalesce(x.estado, 'pendente'), 'liberada', i.liberada_ao_candidato, 'grupo', i.grupo) order by i.posicao), '[]')
      into fila
      from ciclo_itens i join estacoes t on t.id = i.estacao_id
      left join lateral (select e.estado from execucoes e where e.item_id = i.id
                         order by case e.estado when 'em_andamento' then 0 when 'finalizada' then 1 when 'pausada' then 2 else 3 end limit 1) x on true
      where i.ciclo_id = c.id and (meu = 'admin' or x.estado in ('em_andamento','finalizada','pausada') or i.liberada_ao_candidato);
    select jsonb_build_object('id', e.id, 'item_id', e.item_id, 'titulo', t.titulo, 'iniciada_em', e.iniciada_em,
             'avaliador_id', e.avaliador_id, 'candidato_id', e.candidato_id)
      into exe from execucoes e join ciclo_itens i on i.id = e.item_id join estacoes t on t.id = i.estacao_id
      where e.sala_id = p_sala and e.estado = 'em_andamento';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('ciclo_id', pc.ciclo_id, 'motivo', cc.motivo_pausa, 'pausado_em', pc.pausado_em,
           'execucao_pausada', pc.execucao_id is not null, 'admin_id', cc.admin_id, 'candidato_id', cc.candidato_id) order by pc.pausado_em desc), '[]')
    into pausados
    from paused_cycles pc join ciclos cc on cc.id = pc.ciclo_id
    where cc.sala_id = p_sala and p_usuario = any(pc.retomavel_por);

  select coalesce(jsonb_agg(jsonb_build_object('id', sp.id, 'solicitante_id', sp.solicitante_id, 'nome', u.nome, 'papel', sp.papel_pedido, 'criada_em', sp.criada_em) order by sp.criada_em), '[]')
    into pend
    from solicitacoes_papel sp join usuarios u on u.id = sp.solicitante_id
    where sp.sala_id = p_sala and sp.estado = 'pendente' and (meu = 'admin' or sp.solicitante_id = p_usuario);

  return jsonb_build_object(
    'sala', jsonb_build_object('id', s.id, 'admin_id', s.admin_id, 'canal_video', s.canal_video, 'audio_observadores', s.audio_observadores, 'versao', s.versao),
    'meu_papel', meu,
    'ciclo', case when s.ciclo_ativo_id is null then null else jsonb_build_object('id', c.id, 'admin_id', c.admin_id, 'candidato_id', c.candidato_id, 'origem_id', c.origem_id) end,
    'execucao', exe, 'fila', fila, 'participantes', parts, 'ciclos_pausados', pausados, 'solicitacoes', pend);
end $$;
