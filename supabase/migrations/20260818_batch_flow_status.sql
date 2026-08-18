alter table public.bateladas drop constraint if exists bateladas_status_check;
alter table public.bateladas add constraint bateladas_status_check
  check (status in ('em_preparacao','pronta','em_consumo','consumida','finalizada','interrompida','cancelada','bloqueada'));

alter table public.bateladas
  add column if not exists consumo_iniciado_em timestamptz,
  add column if not exists consumo_iniciado_por uuid references public.operadores(id) on delete set null,
  add column if not exists consumida_em timestamptz,
  add column if not exists consumida_por uuid references public.operadores(id) on delete set null;

create unique index if not exists batelada_em_consumo_por_ciclo_uidx
  on public.bateladas(ciclo_id) where status = 'em_consumo';
