-- 006: estudo — modelo da estação no padrão INEP (síntese, objetivos, critério do PEP), temas e mapa de relações,
-- diretrizes de referência (texto que a administração cadastra), lacunas por categoria, cartões com repetição espaçada e resumos.
-- Idempotente.
alter table pep_itens add column if not exists criterio text not null default '';
alter table estacoes add column if not exists sintese           text  not null default '';
alter table estacoes add column if not exists objetivos         jsonb not null default '[]'::jsonb;
alter table estacoes add column if not exists perfil_paciente   text  not null default '';
alter table estacoes add column if not exists diagnostico_alvo  text  not null default '';

create table if not exists temas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  nome_norm  text not null unique,
  area       text check (area in ('clinica_medica','cirurgia','ginecologia_obstetricia','pediatria','mfc')),
  relevancia int not null default 3 check (relevancia between 1 and 5),
  descricao  text not null default '',
  origem     text not null default 'estacao' check (origem in ('base','estacao','ia','manual')),
  criado_em  timestamptz not null default now()
);

create table if not exists tema_relacoes (
  de     uuid not null references temas(id) on delete cascade,
  para   uuid not null references temas(id) on delete cascade,
  tipo   text not null default 'relacionado' check (tipo in ('relacionado','pre_requisito','diagnostico_diferencial','complicacao','conduta')),
  peso   numeric(3,2) not null default 0.5 check (peso between 0 and 1),
  motivo text not null default '',
  origem text not null default 'estacao' check (origem in ('estacao','ia','manual')),
  primary key (de, para, tipo),
  check (de <> para)
);
create index if not exists ix_tema_relacoes_para on tema_relacoes(para);

create table if not exists estacao_temas (
  estacao_id uuid not null references estacoes(id) on delete cascade,
  tema_id    uuid not null references temas(id) on delete cascade,
  primary key (estacao_id, tema_id)
);
create index if not exists ix_estacao_temas_tema on estacao_temas(tema_id);

-- Texto de diretrizes/protocolos (ex.: PCDT, cadernos de atenção básica do Ministério da Saúde) colado pela administração.
-- A IA só trata como norma o que está aqui; sem diretriz, o conteúdo sai marcado "sem diretriz de referência".
create table if not exists diretrizes (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  fonte      text not null default '',
  url        text,
  area       text check (area in ('clinica_medica','cirurgia','ginecologia_obstetricia','pediatria','mfc')),
  texto      text not null,
  criado_por uuid references usuarios(id),
  criado_em  timestamptz not null default now()
);

-- Lacunas do caderno de erros: o comportamento que faltou numa execução (e não "revisar tema X").
create table if not exists lacunas (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  execucao_id uuid not null references execucoes(id) on delete cascade,
  estacao_id  uuid not null references estacoes(id) on delete cascade,
  pep_item_id uuid references pep_itens(id) on delete set null,
  categoria   text not null check (categoria in ('conhecimento','sequencia','comunicacao','tempo')),
  erro_tipo   text check (erro_tipo in ('leitura_comandos','instabilidade','anamnese_sem_direcao','nao_verbalizar','consentimento_privacidade',
                'exame_generico','exame_sem_interpretar','diagnostico_sem_conduta','medicacao_incompleta','excesso_fala','sem_orientacao_final','sem_cronometro')),
  descricao   text not null default '',
  criada_em   timestamptz not null default now()
);
create unique index if not exists uq_lacuna_item on lacunas(usuario_id, execucao_id, pep_item_id) where pep_item_id is not null;
create index if not exists ix_lacunas_usuario on lacunas(usuario_id, criada_em desc);

create table if not exists cartoes (
  id          uuid primary key default gen_random_uuid(),
  tema_id     uuid not null references temas(id) on delete cascade,
  serie       int not null default 1,
  frente      text not null,
  verso       text not null,
  origem      text not null default 'ia' check (origem in ('ia','manual')),
  diretriz_id uuid references diretrizes(id) on delete set null,
  criado_por  uuid references usuarios(id),
  criado_em   timestamptz not null default now()
);
create index if not exists ix_cartoes_tema on cartoes(tema_id, serie);

create table if not exists cartao_progresso (
  usuario_id     uuid not null references usuarios(id) on delete cascade,
  cartao_id      uuid not null references cartoes(id) on delete cascade,
  facilidade     numeric(4,2) not null default 2.5,
  intervalo_dias int not null default 0,
  repeticoes     int not null default 0,
  proximo_em     timestamptz not null default now(),
  ultima_em      timestamptz,
  acertos        int not null default 0,
  erros          int not null default 0,
  primary key (usuario_id, cartao_id)
);
create index if not exists ix_cartao_prog_prox on cartao_progresso(usuario_id, proximo_em);

create table if not exists resumos (
  id          uuid primary key default gen_random_uuid(),
  tema_id     uuid not null references temas(id) on delete cascade,
  foco        text not null default '',
  titulo      text not null,
  corpo       text not null,
  diretriz_id uuid references diretrizes(id) on delete set null,
  origem      text not null default 'ia' check (origem in ('ia','manual')),
  criado_por  uuid references usuarios(id),
  criado_em   timestamptz not null default now()
);
create index if not exists ix_resumos_tema on resumos(tema_id);
