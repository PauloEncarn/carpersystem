alter table public.ciclo_nao_conformidades
  add column if not exists contexto_tipo text,
  add column if not exists item text,
  add column if not exists aberta_em timestamptz not null default now(),
  add column if not exists resolvida_em timestamptz,
  add column if not exists resolvida_por uuid references public.operadores(id) on delete set null,
  add column if not exists resolucao text,
  add column if not exists foto_antes text,
  add column if not exists foto_depois text;

create table if not exists public.ciclo_pausas (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ciclos_producao(id) on delete restrict,
  motivo text not null,
  iniciada_em timestamptz not null default now(),
  encerrada_em timestamptz,
  iniciada_por uuid references public.operadores(id) on delete set null,
  encerrada_por uuid references public.operadores(id) on delete set null,
  foto_antes text,
  foto_depois text,
  observacao_retomada text,
  created_at timestamptz not null default now()
);

alter table public.ciclo_pausas enable row level security;
drop policy if exists ciclo_pausas_read on public.ciclo_pausas;
create policy ciclo_pausas_read on public.ciclo_pausas for select to anon, authenticated using (true);
drop policy if exists ciclo_pausas_write on public.ciclo_pausas;
create policy ciclo_pausas_write on public.ciclo_pausas for all to anon, authenticated using (true) with check (true);
drop policy if exists cycle_nc_update on public.ciclo_nao_conformidades;
create policy cycle_nc_update on public.ciclo_nao_conformidades for update to anon, authenticated using (true) with check (true);

create index if not exists idx_ciclo_pausas_ciclo on public.ciclo_pausas(ciclo_id, iniciada_em desc);
create index if not exists idx_ciclo_ncs_abertas on public.ciclo_nao_conformidades(ciclo_id, resolvida_em) where resolvida_em is null;
