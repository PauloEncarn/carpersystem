-- Ciclos contínuos e trilha de eventos do RG.QUA.BA.003.
create table if not exists public.ciclos_producao (
  id uuid primary key default gen_random_uuid(),
  linha_id text not null references public.linhas(id) on delete restrict,
  rg_id uuid not null references public.rgs(id) on delete restrict,
  produto text not null,
  produto_anterior text,
  motivo_inicio text not null,
  status text not null default 'higienizacao' check (status in ('higienizacao', 'aguardando_liberacao', 'produzindo', 'bloqueado', 'encerrado')),
  iniciado_por uuid references public.operadores(id) on delete set null,
  iniciado_em timestamptz not null default now(),
  etapa_iniciada_em timestamptz not null default now(),
  encerrado_em timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_ciclo_ativo_por_linha on public.ciclos_producao (linha_id) where encerrado_em is null;
create index if not exists idx_ciclos_linha_inicio on public.ciclos_producao (linha_id, iniciado_em desc);

create table if not exists public.eventos_ciclo (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ciclos_producao(id) on delete restrict,
  tipo text not null,
  descricao text not null,
  operador_id uuid references public.operadores(id) on delete set null,
  ocorrido_em timestamptz not null default now(),
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_eventos_ciclo_ocorrido on public.eventos_ciclo (ciclo_id, ocorrido_em desc);

create table if not exists public.ciclo_nao_conformidades (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ciclos_producao(id) on delete restrict,
  operador_id uuid references public.operadores(id) on delete set null,
  produto text not null,
  quantidade text not null,
  descricao text not null,
  causa text not null,
  acao_tomada text not null,
  interrompeu_producao boolean not null default false,
  status text not null default 'aberta',
  registrada_em timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_ciclo_ncs_ciclo on public.ciclo_nao_conformidades (ciclo_id, registrada_em desc);

alter table public.nao_conformidades add column if not exists codigo_origem text unique;

drop trigger if exists set_updated_at_ciclos_producao on public.ciclos_producao;
create trigger set_updated_at_ciclos_producao before update on public.ciclos_producao
for each row execute function public.set_updated_at();

alter table public.ciclos_producao enable row level security;
alter table public.eventos_ciclo enable row level security;
alter table public.ciclo_nao_conformidades enable row level security;

drop policy if exists cycle_read on public.ciclos_producao;
create policy cycle_read on public.ciclos_producao for select to anon, authenticated using (true);
drop policy if exists cycle_write on public.ciclos_producao;
create policy cycle_write on public.ciclos_producao for insert to anon, authenticated with check (true);
drop policy if exists cycle_update on public.ciclos_producao;
create policy cycle_update on public.ciclos_producao for update to anon, authenticated using (true) with check (true);

drop policy if exists cycle_event_read on public.eventos_ciclo;
create policy cycle_event_read on public.eventos_ciclo for select to anon, authenticated using (true);
drop policy if exists cycle_event_insert on public.eventos_ciclo;
create policy cycle_event_insert on public.eventos_ciclo for insert to anon, authenticated with check (true);

drop policy if exists cycle_nc_read on public.ciclo_nao_conformidades;
create policy cycle_nc_read on public.ciclo_nao_conformidades for select to anon, authenticated using (true);
drop policy if exists cycle_nc_insert on public.ciclo_nao_conformidades;
create policy cycle_nc_insert on public.ciclo_nao_conformidades for insert to anon, authenticated with check (true);
drop policy if exists cycle_nc_update on public.ciclo_nao_conformidades;
create policy cycle_nc_update on public.ciclo_nao_conformidades for update to authenticated using (true) with check (true);

create or replace function public.iniciar_ciclo_rg003(p_linha_id text, p_produto text, p_motivo text, p_operador_id uuid)
returns public.ciclos_producao
language plpgsql
security invoker
as $$
declare
  anterior public.ciclos_producao;
  novo public.ciclos_producao;
begin
  select * into anterior from public.ciclos_producao where linha_id = p_linha_id and encerrado_em is null for update;
  if anterior.id is not null then
    update public.ciclos_producao set status = 'encerrado', encerrado_em = now() where id = anterior.id;
    insert into public.eventos_ciclo (ciclo_id, tipo, descricao, operador_id, dados)
    values (anterior.id, 'ciclo_encerrado', 'Ciclo encerrado por troca de produto', p_operador_id, jsonb_build_object('proximo_produto', p_produto));
  end if;
  insert into public.ciclos_producao (linha_id, rg_id, produto, produto_anterior, motivo_inicio, status, iniciado_por)
  values (p_linha_id, '00000000-0000-0000-0000-000000000303', p_produto, anterior.produto, p_motivo, 'higienizacao', p_operador_id)
  returning * into novo;
  insert into public.eventos_ciclo (ciclo_id, tipo, descricao, operador_id, dados)
  values (novo.id, 'higienizacao_iniciada', 'Higienização iniciada', p_operador_id, jsonb_build_object('produto', p_produto, 'produto_anterior', anterior.produto, 'motivo', p_motivo));
  return novo;
end;
$$;

grant execute on function public.iniciar_ciclo_rg003(text, text, text, uuid) to anon, authenticated;
