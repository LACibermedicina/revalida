-- 017 · salas abertas (sem dono), expiração por vazio, chat, retomada automática, inversão por candidato/chefe
alter table salas add column if not exists nome text not null default '';
alter table salas add column if not exists expira_vazia_horas int not null default 24 check (expira_vazia_horas between 1 and 720);
alter table salas add column if not exists vazia_desde timestamptz;
alter table execucoes add column if not exists pausada_em timestamptz;
alter table execucoes add column if not exists pausa_seg int not null default 0;
create index if not exists ix_salas_abertas on salas (estado, vazia_desde);

create table if not exists sala_mensagens (
  id         bigserial primary key,
  sala_id    uuid not null references salas(id) on delete cascade,
  autor_id   uuid not null references usuarios(id),
  texto      text not null check (length(texto) between 1 and 1000),
  em         timestamptz not null default now()
);
create index if not exists ix_sala_mensagens on sala_mensagens (sala_id, id);

-- sala vazia: marca quando ficou vazia e limpa quando alguém entra
create or replace function _rv_sala_vazia_marcar() returns trigger language plpgsql as $$
begin
  update salas set vazia_desde = case
      when exists (select 1 from sala_participantes where sala_id = new.sala_id and saiu_em is null) then null
      else coalesce(vazia_desde, now()) end
    where id = new.sala_id;
  return null;
end $$;
drop trigger if exists tg_sala_vazia on sala_participantes;
create trigger tg_sala_vazia after insert or update of saiu_em on sala_participantes
  for each row execute function _rv_sala_vazia_marcar();

-- a execução pausada guarda desde quando, para o relógio não contar o tempo parado
create or replace function _rv_pausar_ciclo(p_ciclo uuid, p_motivo text, p_snapshot jsonb) returns void language plpgsql as $$
declare c ciclos; e execucoes;
begin
  select * into c from ciclos where id = p_ciclo;
  select * into e from execucoes where ciclo_id = p_ciclo and estado = 'em_andamento';
  if e.id is not null then update execucoes set estado = 'pausada', pausada_em = now() where id = e.id; end if;
  update ciclos set estado = 'pausado', motivo_pausa = p_motivo, pausado_em = now(), versao = versao + 1 where id = p_ciclo;
  insert into paused_cycles (ciclo_id, execucao_id, snapshot, proximo_item_id, retomavel_por)
    values (p_ciclo, e.id, coalesce(p_snapshot, '{}'::jsonb), _rv_proximo_item(p_ciclo),
            array_remove(array[c.admin_id, c.candidato_id], null))
  on conflict (ciclo_id) do update
    set execucao_id = excluded.execucao_id, snapshot = excluded.snapshot, proximo_item_id = excluded.proximo_item_id,
        retomavel_por = excluded.retomavel_por, pausado_em = now();
  update salas set ciclo_ativo_id = null where id = c.sala_id and ciclo_ativo_id = p_ciclo;
end $$;

-- criar a sala: aberta, com nome e prazo de vazio; quem cria não ganha propriedade (só começa como chefe)
drop function if exists rv_sala_criar(uuid);
create or replace function rv_sala_criar(p_usuario uuid, p_nome text default null, p_horas int default 24) returns uuid language plpgsql as $$
declare sid uuid; n text := left(btrim(coalesce(p_nome, '')), 60);
begin
  if p_horas is null or p_horas < 1 or p_horas > 720 then perform _rv_erro('PRAZO_INVALIDO'); end if;
  if n = '' then n := 'Sala ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'); end if;
  insert into salas (dono_id, admin_id, nome, expira_vazia_horas) values (p_usuario, p_usuario, n, p_horas) returning salas.id into sid;
  insert into sala_participantes (sala_id, usuario_id, papel, e_avaliador) values (sid, p_usuario, 'admin', true);
  perform _rv_toque(sid, 'sala_criada', p_usuario, null, jsonb_build_object('nome', n), null, null);
  return sid;
end $$;

-- nome e prazo: o chefe atual, quem criou a sala ou um administrador do sistema
create or replace function rv_sala_configurar(p_sala uuid, p_ator uuid, p_nome text, p_horas int, p_sistema boolean default false) returns int language plpgsql as $$
declare s salas; n text := left(btrim(coalesce(p_nome, '')), 60);
begin
  s := _rv_trava_sala(p_sala);
  if not (p_sistema or p_ator = s.admin_id or p_ator = s.dono_id) then perform _rv_erro('NAO_PERMITIDO'); end if;
  if p_horas is not null and (p_horas < 1 or p_horas > 720) then perform _rv_erro('PRAZO_INVALIDO'); end if;
  update salas set nome = case when n = '' then nome else n end, expira_vazia_horas = coalesce(p_horas, expira_vazia_horas) where id = p_sala;
  return _rv_toque(p_sala, 'sala_configurada', p_ator, null, jsonb_build_object('nome', n, 'horas', p_horas), s.ciclo_ativo_id, null);
end $$;

-- desfaz as salas vazias além do prazo (o histórico das estações feitas continua)
create or replace function rv_salas_expirar() returns uuid[] language plpgsql as $$
declare r uuid[];
begin
  with x as (
    update salas set estado = 'encerrada'
     where estado = 'aberta' and vazia_desde is not null and vazia_desde < now() - make_interval(hours => expira_vazia_horas)
       and not exists (select 1 from sala_participantes sp where sp.sala_id = salas.id and sp.saiu_em is null)
    returning id)
  select coalesce(array_agg(id), '{}') into r from x;
  insert into sala_eventos (sala_id, tipo) select unnest(r), 'sala_expirada';
  return r;
end $$;

-- painel de salas abertas (qualquer usuário vê e entra)
create or replace function rv_salas_abertas(p_usuario uuid) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'nome', s.nome, 'criada_em', s.criada_em, 'vazia_desde', s.vazia_desde,
      'expira_em', case when s.vazia_desde is null then null else s.vazia_desde + make_interval(hours => s.expira_vazia_horas) end,
      'expira_vazia_horas', s.expira_vazia_horas,
      'chefe', (select u.nome from usuarios u where u.id = s.admin_id),
      'candidato', (select u.nome from sala_participantes sp join usuarios u on u.id = sp.usuario_id where sp.sala_id = s.id and sp.papel = 'candidato' and sp.saiu_em is null),
      'pessoas', (select count(*) from sala_participantes sp where sp.sala_id = s.id and sp.saiu_em is null),
      'em_estacao', exists (select 1 from execucoes e where e.sala_id = s.id and e.estado = 'em_andamento'),
      'pausada', exists (select 1 from execucoes e where e.sala_id = s.id and e.estado = 'pausada'),
      'estou_na_sala', _rv_presente(s.id, p_usuario)
    ) order by (s.vazia_desde is null) desc, s.criada_em desc), '[]'::jsonb)
  from salas s
  where s.estado = 'aberta'
    and not exists (select 1 from salas_ia si where si.sala_id = s.id)
    and not exists (select 1 from sala_participantes sp where sp.sala_id = s.id and sp.saiu_em is null and rv_bloqueados(sp.usuario_id, p_usuario))
$$;

-- sair: se quem sai é o chefe ou o candidato e há estação rodando, ela pausa NA HORA (retoma sozinha quando os dois voltarem)
create or replace function rv_sala_sair(p_sala uuid, p_usuario uuid) returns int language plpgsql as $$
declare s salas; c ciclos;
begin
  s := _rv_trava_sala(p_sala);
  update sala_participantes set saiu_em = now(), e_avaliador = false where sala_id = p_sala and usuario_id = p_usuario and saiu_em is null;
  if s.ciclo_ativo_id is not null then
    select * into c from ciclos where id = s.ciclo_ativo_id;
    if p_usuario in (c.admin_id, c.candidato_id) and exists (select 1 from execucoes where ciclo_id = c.id and estado = 'em_andamento') then
      perform _rv_pausar_ciclo(c.id, 'saida', '{}'::jsonb);
      perform _rv_toque(p_sala, 'ciclo_pausado', null, null, jsonb_build_object('motivo', 'saida'), c.id, null);
    end if;
  end if;
  return _rv_toque(p_sala, 'saiu', p_usuario, null, null, s.ciclo_ativo_id, null);
end $$;

-- a retomada devolve o tempo parado ao relógio
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
  if pc.execucao_id is not null then
    update execucoes set estado = 'em_andamento',
           pausa_seg = pausa_seg + greatest(0, floor(extract(epoch from now() - coalesce(pausada_em, now())))::int), pausada_em = null
     where id = pc.execucao_id;
  end if;
  delete from paused_cycles where ciclo_id = p_ciclo;
  v := _rv_toque(sala, 'ciclo_retomado', p_usuario, null, jsonb_build_object('execucao', pc.execucao_id), p_ciclo, pc.execucao_id);
  return jsonb_build_object('ciclo_id', p_ciclo, 'execucao_id', pc.execucao_id, 'snapshot', pc.snapshot, 'proximo_item_id', pc.proximo_item_id, 'versao', v);
end $$;

-- retoma o ciclo pausado por saída assim que os dois (chefe e candidato) estiverem de volta; devolve null se nada a retomar
create or replace function rv_sala_retomar_auto(p_sala uuid, p_usuario uuid) returns jsonb language plpgsql as $$
declare cid uuid; ok boolean;
begin
  select pc.ciclo_id into cid from paused_cycles pc join ciclos c on c.id = pc.ciclo_id
   where c.sala_id = p_sala and c.motivo_pausa = 'saida' and p_usuario = any(pc.retomavel_por)
   order by pc.pausado_em desc limit 1;
  if cid is null then return null; end if;
  if exists (select 1 from salas where id = p_sala and ciclo_ativo_id is not null) then return null; end if;
  select _rv_presente(p_sala, c.admin_id) and (c.candidato_id is null or _rv_presente(p_sala, c.candidato_id)) into ok from ciclos c where c.id = cid;
  if not ok then return null; end if;
  return rv_ciclo_retomar(cid, p_usuario);
end $$;

-- sem o chefe por perto (e sem estação recente parada à espera dele), um participante assume a chefia
create or replace function rv_sala_assumir_chefe(p_sala uuid, p_usuario uuid) returns int language plpgsql as $$
declare s salas;
begin
  s := _rv_trava_sala(p_sala);
  if not _rv_presente(p_sala, p_usuario) then perform _rv_erro('NAO_ESTA_NA_SALA'); end if;
  if s.admin_id = p_usuario then perform _rv_erro('JA_E_CHEFE'); end if;
  if _rv_presente(p_sala, s.admin_id) then perform _rv_erro('CHEFE_PRESENTE'); end if;
  if s.ciclo_ativo_id is not null or exists (select 1 from execucoes where sala_id = p_sala and estado = 'em_andamento') then perform _rv_erro('CHEFE_PRESENTE'); end if;
  if exists (select 1 from ciclos c where c.sala_id = p_sala and c.estado = 'pausado' and c.motivo_pausa = 'saida' and c.pausado_em > now() - interval '10 minutes') then
    perform _rv_erro('AGUARDE_CHEFE');
  end if;
  if exists (select 1 from sala_participantes where sala_id = p_sala and usuario_id = p_usuario and papel = 'candidato') then perform _rv_erro('CANDIDATO_NAO_AVALIA'); end if;
  update sala_participantes set papel = 'observador', e_avaliador = false where sala_id = p_sala and (papel = 'admin' or e_avaliador);
  perform _rv_dar_papel(p_sala, p_usuario, 'admin', true);
  update salas set admin_id = p_usuario where id = p_sala;
  return _rv_toque(p_sala, 'chefe_assumido', p_usuario, s.admin_id, null, null, null);
end $$;

-- chat interno: o candidato não envia durante a estação (a tela dele só mostra a estação)
create or replace function rv_chat_enviar(p_sala uuid, p_usuario uuid, p_texto text) returns bigint language plpgsql as $$
declare t text := btrim(coalesce(p_texto, '')); mid bigint; meu text;
begin
  if length(t) < 1 or length(t) > 1000 then perform _rv_erro('MENSAGEM_INVALIDA'); end if;
  select papel into meu from sala_participantes where sala_id = p_sala and usuario_id = p_usuario and saiu_em is null;
  if meu is null then perform _rv_erro('NAO_ESTA_NA_SALA'); end if;
  if meu = 'candidato' and exists (select 1 from execucoes where sala_id = p_sala and estado = 'em_andamento') then perform _rv_erro('CHAT_BLOQUEADO'); end if;
  insert into sala_mensagens (sala_id, autor_id, texto) values (p_sala, p_usuario, t) returning id into mid;
  return mid;
end $$;

create or replace function rv_chat_listar(p_sala uuid, p_usuario uuid, p_apos bigint default 0) returns jsonb language plpgsql stable as $$
begin
  if not _rv_presente(p_sala, p_usuario) then perform _rv_erro('NAO_ESTA_NA_SALA'); end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
    select m.id, m.autor_id, u.nome, m.texto, m.em from sala_mensagens m join usuarios u on u.id = m.autor_id
     where m.sala_id = p_sala and m.id > coalesce(p_apos, 0) order by m.id desc limit 200) x);
end $$;

create or replace function rv_ciclo_proximo(p_ciclo uuid, p_ator uuid, p_acao text, p_snapshot jsonb default '{}'::jsonb) returns jsonb language plpgsql as $$
declare sala uuid; s salas; c ciclos; novo uuid; velho_admin uuid; velho_cand uuid; ultimo uuid; v int;
begin
  select sala_id into sala from ciclos where id = p_ciclo;
  if sala is null then perform _rv_erro('CICLO_INEXISTENTE'); end if;
  s := _rv_trava_sala(sala);
  select * into c from ciclos where id = p_ciclo;
  if s.admin_id <> p_ator and not (p_acao = 'inverter' and c.candidato_id = p_ator) then perform _rv_erro('NAO_ADMIN'); end if;
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

create or replace function rv_sala_estado(p_sala uuid, p_usuario uuid) returns jsonb language plpgsql stable as $$
declare s salas; meu text; c ciclos; fila jsonb := '[]'; parts jsonb; pausados jsonb; pend jsonb; exe jsonb := null; conv jsonb := '[]'; av boolean;
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
      left join lateral (select e.estado from execucoes e where e.item_id = i.id and e.estado <> 'abandonada'
                         order by case e.estado when 'em_andamento' then 0 when 'finalizada' then 1 when 'pausada' then 2 else 3 end limit 1) x on true
      where i.ciclo_id = c.id and (meu = 'admin' or x.estado in ('em_andamento','finalizada','pausada') or i.liberada_ao_candidato);
    select jsonb_build_object('id', e.id, 'item_id', e.item_id, 'titulo', t.titulo, 'iniciada_em', e.iniciada_em,
             'avaliador_id', e.avaliador_id, 'candidato_id', e.candidato_id, 'pausa_seg', e.pausa_seg)
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

  select e_avaliador into av from sala_participantes where sala_id = p_sala and usuario_id = p_usuario and saiu_em is null;
  if meu = 'admin' or av then
    select coalesce(jsonb_agg(jsonb_build_object('id', cv.id, 'convidado_id', cv.convidado_id, 'nome', u.nome, 'criado_em', cv.criado_em) order by cv.criado_em), '[]')
      into conv from convites_sala cv join usuarios u on u.id = cv.convidado_id where cv.sala_id = p_sala and cv.estado = 'pendente';
  end if;
  return jsonb_build_object(
    'sala', jsonb_build_object('id', s.id, 'nome', s.nome, 'expira_vazia_horas', s.expira_vazia_horas, 'admin_id', s.admin_id, 'canal_video', s.canal_video, 'audio_observadores', s.audio_observadores, 'versao', s.versao),
    'meu_papel', meu,
    'ciclo', case when s.ciclo_ativo_id is null then null else jsonb_build_object('id', c.id, 'admin_id', c.admin_id, 'candidato_id', c.candidato_id, 'origem_id', c.origem_id) end,
    'execucao', exe, 'fila', fila, 'participantes', parts, 'ciclos_pausados', pausados, 'solicitacoes', pend, 'convites', conv);
end $$;
