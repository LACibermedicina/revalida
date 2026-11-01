-- 013 · segurança social (bloqueio/denúncia), chamados à comunidade, ciclo randômico e trilha guiada. Idempotente.

alter table usuarios add column if not exists suspenso_ate timestamptz;

-- Bloqueio: uma linha = "a bloqueou b". A regra vale nos DOIS sentidos (função rv_bloqueados).
create table if not exists bloqueios (
  bloqueador_id uuid not null references usuarios(id) on delete cascade,
  bloqueado_id  uuid not null references usuarios(id) on delete cascade,
  origem        text not null default 'manual' check (origem in ('manual','denuncia')),
  criado_em     timestamptz not null default now(),
  primary key (bloqueador_id, bloqueado_id),
  check (bloqueador_id <> bloqueado_id)
);
create index if not exists ix_bloqueios_bloqueado on bloqueios(bloqueado_id);

create or replace function rv_bloqueados(a uuid, b uuid) returns boolean language sql stable as $$
  select exists (select 1 from bloqueios where (bloqueador_id = a and bloqueado_id = b) or (bloqueador_id = b and bloqueado_id = a))
$$;

-- Denúncia: notifica o denunciado e o administrador; o denunciado responde; o admin decide.
-- Padrão: só os dois deixam de se relacionar (bloqueio mútuo). Suspensão semanal só se o admin decidir.
create table if not exists denuncias (
  id             uuid primary key default gen_random_uuid(),
  denunciante_id uuid not null references usuarios(id) on delete cascade,
  denunciado_id  uuid not null references usuarios(id) on delete cascade,
  sala_id        uuid references salas(id) on delete set null,
  motivo         text not null check (motivo in ('assedio','conduta','conteudo','fraude','outro')),
  detalhe        text not null default '' check (length(detalhe) <= 2000),
  estado         text not null default 'aberta' check (estado in ('aberta','respondida','resolvida','suspensa','arquivada')),
  resposta       text check (length(resposta) <= 2000),
  respondida_em  timestamptz,
  decisao        text check (decisao in ('manter_bloqueio','suspender','arquivar')),
  decisao_nota   text check (length(decisao_nota) <= 1000),
  decidida_por   uuid references usuarios(id),
  decidida_em    timestamptz,
  criada_em      timestamptz not null default now(),
  check (denunciante_id <> denunciado_id)
);
create index if not exists ix_denuncias_estado on denuncias(estado, criada_em desc);
create index if not exists ix_denuncias_denunciado on denuncias(denunciado_id);

create table if not exists suspensoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  denuncia_id uuid references denuncias(id) on delete set null,
  inicio      timestamptz not null default now(),
  fim         timestamptz not null,
  revogada_em timestamptz,
  criada_por  uuid references usuarios(id)
);
create index if not exists ix_suspensoes_usuario on suspensoes(usuario_id, fim desc);

create table if not exists notificacoes (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo       text not null,
  dados      jsonb not null default '{}'::jsonb,
  lida_em    timestamptz,
  criada_em  timestamptz not null default now()
);
create index if not exists ix_notif_usuario on notificacoes(usuario_id, lida_em, criada_em desc);

-- Chamados: 'randomico' = disponibilidade na fila; 'comunidade' = chamado público (qualquer um pode incluir o autor).
create table if not exists chamados (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo       text not null check (tipo in ('randomico','comunidade')),
  origem     text not null default 'plataforma' check (origem in ('plataforma','trilha')),
  area       text check (area in ('clinica_medica','cirurgia','ginecologia_obstetricia','pediatria','mfc')),
  estacoes   uuid[],
  minutos    int check (minutos between 5 and 600),
  mensagem   text not null default '' check (length(mensagem) <= 300),
  estado     text not null default 'aberto' check (estado in ('aberto','atendido','cancelado','expirado')),
  sala_id    uuid references salas(id) on delete set null,
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null default (now() + interval '30 minutes')
);
create unique index if not exists uq_chamado_aberto on chamados(usuario_id) where estado = 'aberto';
create index if not exists ix_chamados_fila on chamados(tipo, estado, criado_em);

-- Plano de um ciclo randômico: estações sorteadas, em sequência; cada uma é feita 2x (papéis invertidos).
create table if not exists ciclos_randomicos (
  sala_id   uuid primary key references salas(id) on delete cascade,
  estacoes  uuid[] not null,
  indice    int not null default 0,
  fase      int not null default 0 check (fase in (0,1)),
  origem    text not null default 'plataforma' check (origem in ('plataforma','trilha','comunidade')),
  estado    text not null default 'ativo' check (estado in ('ativo','concluido')),
  criado_em timestamptz not null default now()
);

-- Trilha guiada: só tempo diário e (opcionalmente) dias; padrão = todos os dias (0=domingo … 6=sábado).
create table if not exists trilhas (
  usuario_id     uuid primary key references usuarios(id) on delete cascade,
  minutos_dia    int not null check (minutos_dia between 10 and 600),
  dias           int[] not null default '{0,1,2,3,4,5,6}' check (dias <@ array[0,1,2,3,4,5,6]),
  ultimo_modo    text not null default 'trilha' check (ultimo_modo in ('trilha','plataforma')),
  atualizada_em  timestamptz not null default now()
);

-- Bloqueio vale na entrada da sala e no convite (nos dois sentidos).
create or replace function rv_sala_entrar(p_sala uuid, p_usuario uuid) returns jsonb language plpgsql as $$
declare s salas; c ciclos; v_papel text; av boolean := false; v int;
begin
  s := _rv_trava_sala(p_sala);
  if s.estado = 'encerrada' then perform _rv_erro('SALA_ENCERRADA'); end if;
  if _rv_presente(p_sala, p_usuario) then
    select sp.papel into v_papel from sala_participantes sp where sala_id = p_sala and usuario_id = p_usuario;
    return jsonb_build_object('papel', v_papel, 'versao', s.versao);
  end if;
  if exists (select 1 from sala_participantes sp where sp.sala_id = p_sala and sp.saiu_em is null and rv_bloqueados(sp.usuario_id, p_usuario)) then
    perform _rv_erro('BLOQUEADO');
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

create or replace function rv_convite_criar(p_sala uuid, p_ator uuid, p_convidado uuid) returns jsonb language plpgsql as $$
declare s salas; cid uuid; v int;
begin
  s := _rv_trava_sala(p_sala);
  if s.estado = 'encerrada' then perform _rv_erro('SALA_ENCERRADA'); end if;
  if p_ator <> s.admin_id and not exists (select 1 from sala_participantes where sala_id = p_sala and usuario_id = p_ator and e_avaliador and saiu_em is null) then
    perform _rv_erro('NAO_PERMITIDO');
  end if;
  if p_convidado = p_ator or _rv_presente(p_sala, p_convidado) then perform _rv_erro('JA_NA_SALA'); end if;
  if exists (select 1 from sala_participantes sp where sp.sala_id = p_sala and sp.saiu_em is null and rv_bloqueados(sp.usuario_id, p_convidado)) then
    perform _rv_erro('BLOQUEADO');
  end if;
  begin
    insert into convites_sala (sala_id, convidante_id, convidado_id) values (p_sala, p_ator, p_convidado) returning id into cid;
  exception when unique_violation then perform _rv_erro('CONVITE_PENDENTE'); end;
  v := _rv_toque(p_sala, 'convite_enviado', p_ator, p_convidado, jsonb_build_object('convite', cid), s.ciclo_ativo_id, null);
  return jsonb_build_object('convite_id', cid, 'versao', v);
end $$;
