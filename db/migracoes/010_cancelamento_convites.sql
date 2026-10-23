-- 010: cancelamento de estação (não conta como feita e não gera feedback), candidato que abandona vira observador,
-- convites a usuários online, presença, dificuldade da estação e complexidade do tema. Idempotente.
alter table estacoes add column if not exists dificuldade text check (dificuldade in ('básica','intermediária','avançada'));
alter table temas    add column if not exists complexidade int check (complexidade between 1 and 3);
alter table usuarios add column if not exists visto_em timestamptz;
alter table execucoes add column if not exists cancelada_por uuid references usuarios(id);
alter table execucoes add column if not exists cancelada_em  timestamptz;
alter table execucoes add column if not exists cancelada_motivo text check (cancelada_motivo in ('avaliador','candidato','administrador'));

create table if not exists convites_sala (
  id            uuid primary key default gen_random_uuid(),
  sala_id       uuid not null references salas(id) on delete cascade,
  convidante_id uuid not null references usuarios(id),
  convidado_id  uuid not null references usuarios(id),
  estado        text not null default 'pendente' check (estado in ('pendente','aceita','recusada','cancelada','expirada')),
  papel_aceito  text check (papel_aceito in ('observador','candidato')),
  criado_em     timestamptz not null default now(),
  decidido_em   timestamptz
);
create unique index if not exists uq_convite_pendente on convites_sala(sala_id, convidado_id) where estado = 'pendente';
create index if not exists ix_convites_convidado on convites_sala(convidado_id, estado);

-- Cancela a estação em andamento ou pausada. Não finaliza: sem nota, sem contagem em "estações feitas", sem feedback;
-- a transcrição é apagada e a estação continua disponível para ser refeita.
create or replace function rv_execucao_cancelar(p_execucao uuid, p_ator uuid, p_liberar_candidato boolean default false) returns jsonb language plpgsql as $$
declare sala uuid; s salas; e execucoes; motivo text; v int;
begin
  select sala_id into sala from execucoes where id = p_execucao;
  if sala is null then perform _rv_erro('EXECUCAO_INEXISTENTE'); end if;
  s := _rv_trava_sala(sala);
  select * into e from execucoes where id = p_execucao;
  if e.estado not in ('em_andamento','pausada') then perform _rv_erro('EXECUCAO_INATIVA'); end if;
  if p_ator = e.candidato_id then motivo := 'candidato';
  elsif p_ator = s.admin_id then motivo := 'administrador';
  elsif p_ator = e.avaliador_id then motivo := 'avaliador';
  else perform _rv_erro('NAO_PERMITIDO'); end if;
  update execucoes set estado = 'abandonada', cancelada_por = p_ator, cancelada_em = now(), cancelada_motivo = motivo,
         nota = null, checklist = '{}'::jsonb, versao = versao + 1 where id = p_execucao;
  delete from analises_transcricao where execucao_id = p_execucao;
  delete from transcricoes where execucao_id = p_execucao;
  delete from execucao_materiais where execucao_id = p_execucao;
  if motivo = 'candidato' or p_liberar_candidato then
    update sala_participantes set papel = 'observador' where sala_id = sala and usuario_id = e.candidato_id and papel = 'candidato' and saiu_em is null;
    update ciclos set candidato_id = null, versao = versao + 1 where id = e.ciclo_id and candidato_id = e.candidato_id;
  end if;
  update paused_cycles set execucao_id = null where execucao_id = p_execucao;
  v := _rv_toque(sala, 'estacao_cancelada', p_ator, e.candidato_id,
                 jsonb_build_object('motivo', motivo, 'candidato_liberado', (motivo = 'candidato' or p_liberar_candidato)), e.ciclo_id, p_execucao);
  return jsonb_build_object('execucao_id', p_execucao, 'motivo', motivo, 'versao', v);
end $$;

-- O candidato sai do papel por escolha própria e passa a observador (cancela a estação em andamento, se houver).
create or replace function rv_candidato_abandonar(p_sala uuid, p_usuario uuid) returns jsonb language plpgsql as $$
declare s salas; e execucoes; v int;
begin
  s := _rv_trava_sala(p_sala);
  if not exists (select 1 from sala_participantes where sala_id = p_sala and usuario_id = p_usuario and papel = 'candidato' and saiu_em is null) then
    perform _rv_erro('NAO_E_CANDIDATO');
  end if;
  select * into e from execucoes where sala_id = p_sala and candidato_id = p_usuario and estado in ('em_andamento','pausada') order by iniciada_em desc limit 1;
  if e.id is not null then perform rv_execucao_cancelar(e.id, p_usuario, true);
  else
    update sala_participantes set papel = 'observador' where sala_id = p_sala and usuario_id = p_usuario;
    update ciclos set candidato_id = null, versao = versao + 1 where id = s.ciclo_ativo_id and candidato_id = p_usuario;
  end if;
  v := _rv_toque(p_sala, 'candidato_abandonou', p_usuario, null, null, s.ciclo_ativo_id, e.id);
  return jsonb_build_object('papel', 'observador', 'versao', v);
end $$;

-- Quem avalia (admin ou avaliador delegado) convida um usuário online.
create or replace function rv_convite_criar(p_sala uuid, p_ator uuid, p_convidado uuid) returns jsonb language plpgsql as $$
declare s salas; cid uuid; v int;
begin
  s := _rv_trava_sala(p_sala);
  if s.estado = 'encerrada' then perform _rv_erro('SALA_ENCERRADA'); end if;
  if p_ator <> s.admin_id and not exists (select 1 from sala_participantes where sala_id = p_sala and usuario_id = p_ator and e_avaliador and saiu_em is null) then
    perform _rv_erro('NAO_PERMITIDO');
  end if;
  if p_convidado = p_ator or _rv_presente(p_sala, p_convidado) then perform _rv_erro('JA_NA_SALA'); end if;
  begin
    insert into convites_sala (sala_id, convidante_id, convidado_id) values (p_sala, p_ator, p_convidado) returning id into cid;
  exception when unique_violation then perform _rv_erro('CONVITE_PENDENTE'); end;
  v := _rv_toque(p_sala, 'convite_enviado', p_ator, p_convidado, jsonb_build_object('convite', cid), s.ciclo_ativo_id, null);
  return jsonb_build_object('convite_id', cid, 'versao', v);
end $$;

-- O convidado aceita como observador ou candidato (ou recusa). Candidato só se a vaga estiver livre.
create or replace function rv_convite_responder(p_convite uuid, p_usuario uuid, p_aceitar boolean, p_papel text default 'observador') returns jsonb language plpgsql as $$
declare sala uuid; s salas; cv convites_sala; v int; em_andamento boolean;
begin
  select sala_id into sala from convites_sala where id = p_convite;
  if sala is null then perform _rv_erro('CONVITE_INEXISTENTE'); end if;
  s := _rv_trava_sala(sala);
  select * into cv from convites_sala where id = p_convite;
  if cv.convidado_id <> p_usuario then perform _rv_erro('NAO_PERMITIDO'); end if;
  if cv.estado <> 'pendente' then perform _rv_erro('CONVITE_INATIVO'); end if;
  if not p_aceitar then
    update convites_sala set estado = 'recusada', decidido_em = now() where id = p_convite;
    v := _rv_toque(sala, 'convite_recusado', p_usuario, cv.convidante_id, null, s.ciclo_ativo_id, null);
    return jsonb_build_object('estado', 'recusada', 'versao', v);
  end if;
  if s.estado = 'encerrada' then
    update convites_sala set estado = 'expirada', decidido_em = now() where id = p_convite;
    perform _rv_erro('SALA_ENCERRADA');
  end if;
  if p_papel not in ('observador','candidato') then perform _rv_erro('PAPEL_INVALIDO'); end if;
  if p_papel = 'candidato' then
    if exists (select 1 from sala_participantes where sala_id = sala and papel = 'candidato' and saiu_em is null and usuario_id <> p_usuario) then
      perform _rv_erro('CANDIDATO_OCUPADO');
    end if;
    perform _rv_dar_papel(sala, p_usuario, 'candidato', false);
    select exists (select 1 from execucoes where sala_id = sala and estado = 'em_andamento') into em_andamento;
    if s.ciclo_ativo_id is not null and not em_andamento then update ciclos set candidato_id = p_usuario, versao = versao + 1 where id = s.ciclo_ativo_id; end if;
  else
    perform _rv_dar_papel(sala, p_usuario, 'observador', false);
  end if;
  update convites_sala set estado = 'aceita', papel_aceito = p_papel, decidido_em = now() where id = p_convite;
  v := _rv_toque(sala, 'convite_aceito', p_usuario, cv.convidante_id, jsonb_build_object('papel', p_papel), s.ciclo_ativo_id, null);
  return jsonb_build_object('estado', 'aceita', 'sala_id', sala, 'papel', p_papel, 'versao', v);
end $$;

create or replace function rv_convite_cancelar(p_convite uuid, p_usuario uuid) returns void language plpgsql as $$
declare sala uuid; s salas;
begin
  select sala_id into sala from convites_sala where id = p_convite;
  if sala is null then perform _rv_erro('CONVITE_INEXISTENTE'); end if;
  s := _rv_trava_sala(sala);
  update convites_sala set estado = 'cancelada', decidido_em = now()
    where id = p_convite and estado = 'pendente' and (convidante_id = p_usuario or s.admin_id = p_usuario);
  if not found then perform _rv_erro('CONVITE_INATIVO'); end if;
  perform _rv_toque(sala, 'convite_cancelado', p_usuario, null, null, s.ciclo_ativo_id, null);
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

  select e_avaliador into av from sala_participantes where sala_id = p_sala and usuario_id = p_usuario and saiu_em is null;
  if meu = 'admin' or av then
    select coalesce(jsonb_agg(jsonb_build_object('id', cv.id, 'convidado_id', cv.convidado_id, 'nome', u.nome, 'criado_em', cv.criado_em) order by cv.criado_em), '[]')
      into conv from convites_sala cv join usuarios u on u.id = cv.convidado_id where cv.sala_id = p_sala and cv.estado = 'pendente';
  end if;
  return jsonb_build_object(
    'sala', jsonb_build_object('id', s.id, 'admin_id', s.admin_id, 'canal_video', s.canal_video, 'audio_observadores', s.audio_observadores, 'versao', s.versao),
    'meu_papel', meu,
    'ciclo', case when s.ciclo_ativo_id is null then null else jsonb_build_object('id', c.id, 'admin_id', c.admin_id, 'candidato_id', c.candidato_id, 'origem_id', c.origem_id) end,
    'execucao', exe, 'fila', fila, 'participantes', parts, 'ciclos_pausados', pausados, 'solicitacoes', pend, 'convites', conv);
end $$;
