-- 009: bibliografia: tipo da fonte (ministério, OMS, sociedade) e marca "especificada pela administração" (tem prioridade na análise). Idempotente.
alter table diretrizes add column if not exists categoria text not null default 'outra' check (categoria in ('ministerio','oms','sociedade','outra'));
alter table diretrizes add column if not exists obrigatoria boolean not null default false;
