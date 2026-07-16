-- Perfis, login por PIN para tablet e policies mais segmentadas.
-- Execute este arquivo no SQL Editor depois de 20260715_initial_rg_schema.sql.
--
-- Observacao importante:
-- O login por PIN abaixo e adequado para prototipo/chao de fabrica controlado.
-- Em producao, preferir Supabase Auth ou RPC security definer para nao expor PIN.

create table if not exists public.perfis (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  descricao text,
  permissoes jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operadores
  add column if not exists matricula text unique,
  add column if not exists auth_user_id uuid,
  add column if not exists ultimo_login_em timestamptz;

create table if not exists public.operador_perfis (
  id uuid primary key default gen_random_uuid(),
  operador_id uuid not null references public.operadores(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  principal boolean not null default false,
  created_at timestamptz not null default now(),
  unique (operador_id, perfil_id)
);

drop trigger if exists set_updated_at_perfis on public.perfis;
create trigger set_updated_at_perfis before update on public.perfis
for each row execute function public.set_updated_at();

insert into public.perfis (id, codigo, nome, descricao, permissoes)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'operador',
    'Operador',
    'Preenche registros, fotos e ocorrencias operacionais.',
    '["operacao:acessar", "registro:criar", "registro:editar", "nc:criar", "foto:criar", "assinatura:criar"]'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'qualidade',
    'Qualidade',
    'Consulta registros, trata NCs e assina validacoes.',
    '["operacao:acessar", "registro:criar", "registro:editar", "registro:validar", "nc:criar", "nc:tratar", "assinatura:criar"]'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'configurador',
    'Configurador',
    'Cria e altera RGs, processos, indices, listas e tipos de NC.',
    '["operacao:acessar", "configurador:acessar", "rg:criar", "rg:editar", "processo:editar", "indice:editar", "nc_tipo:editar"]'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000104',
    'admin',
    'Administrador',
    'Acesso total ao sistema.',
    '["operacao:acessar", "configurador:acessar", "admin:acessar", "usuario:editar", "rg:criar", "rg:editar", "processo:editar", "indice:editar", "nc_tipo:editar"]'::jsonb
  )
on conflict (codigo) do update
set nome = excluded.nome,
    descricao = excluded.descricao,
    permissoes = excluded.permissoes,
    ativo = true;

insert into public.operadores (id, nome, turno, codigo_pin, matricula)
values
  ('00000000-0000-0000-0000-000000000201', 'Operador Demo', 'A', '1111', 'OP-001'),
  ('00000000-0000-0000-0000-000000000202', 'Qualidade Demo', 'B', '2222', 'QUA-001'),
  ('00000000-0000-0000-0000-000000000203', 'Configurador Demo', 'ADM', '3333', 'CFG-001'),
  ('00000000-0000-0000-0000-000000000204', 'Administrador Demo', 'ADM', '9999', 'ADM-001')
on conflict (codigo_pin) do update
set nome = excluded.nome,
    turno = excluded.turno,
    matricula = excluded.matricula,
    ativo = true;

insert into public.operador_perfis (operador_id, perfil_id, principal)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', true),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102', true),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000103', true),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000104', true)
on conflict (operador_id, perfil_id) do update
set principal = excluded.principal;

create or replace view public.operadores_login
with (security_invoker = true)
as
select
  o.id,
  o.nome,
  o.turno,
  o.codigo_pin,
  o.matricula,
  o.ativo,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'codigo', p.codigo,
        'nome', p.nome,
        'permissoes', p.permissoes,
        'principal', op.principal
      )
      order by op.principal desc, p.nome
    ) filter (where p.id is not null),
    '[]'::jsonb
  ) as perfis
from public.operadores o
left join public.operador_perfis op on op.operador_id = o.id
left join public.perfis p on p.id = op.perfil_id and p.ativo = true
where o.ativo = true
group by o.id;

grant select on public.operadores_login to anon, authenticated;

alter table public.perfis enable row level security;
alter table public.operador_perfis enable row level security;

drop policy if exists public_crud on public.operadores;
drop policy if exists public_crud on public.linhas;
drop policy if exists public_crud on public.rgs;
drop policy if exists public_crud on public.rg_linhas;
drop policy if exists public_crud on public.processos;
drop policy if exists public_crud on public.listas_valores;
drop policy if exists public_crud on public.indices;
drop policy if exists public_crud on public.processo_indices;
drop policy if exists public_crud on public.nc_tipos;
drop policy if exists public_crud on public.nc_tipo_indices;
drop policy if exists public_crud on public.lotes;
drop policy if exists public_crud on public.registros;
drop policy if exists public_crud on public.preenchimentos;
drop policy if exists public_crud on public.nao_conformidades;
drop policy if exists public_crud on public.assinaturas;
drop policy if exists public_crud on public.fotos;

drop policy if exists perfil_read on public.perfis;
create policy perfil_read on public.perfis for select to anon, authenticated using (ativo = true);

drop policy if exists operador_perfis_read on public.operador_perfis;
create policy operador_perfis_read on public.operador_perfis for select to anon, authenticated using (true);

drop policy if exists operadores_login_read on public.operadores;
create policy operadores_login_read on public.operadores for select to anon, authenticated using (ativo = true);

drop policy if exists operadores_admin_write on public.operadores;
create policy operadores_admin_write on public.operadores for all to authenticated using (true) with check (true);

drop policy if exists config_read on public.linhas;
create policy config_read on public.linhas for select to anon, authenticated using (ativo = true);

drop policy if exists config_read on public.rgs;
create policy config_read on public.rgs for select to anon, authenticated using (ativo = true);

drop policy if exists config_read on public.rg_linhas;
create policy config_read on public.rg_linhas for select to anon, authenticated using (true);

drop policy if exists config_read on public.processos;
create policy config_read on public.processos for select to anon, authenticated using (ativo = true);

drop policy if exists config_read on public.listas_valores;
create policy config_read on public.listas_valores for select to anon, authenticated using (ativo = true);

drop policy if exists config_read on public.indices;
create policy config_read on public.indices for select to anon, authenticated using (true);

drop policy if exists config_read on public.processo_indices;
create policy config_read on public.processo_indices for select to anon, authenticated using (true);

drop policy if exists config_read on public.nc_tipos;
create policy config_read on public.nc_tipos for select to anon, authenticated using (ativo = true);

drop policy if exists config_read on public.nc_tipo_indices;
create policy config_read on public.nc_tipo_indices for select to anon, authenticated using (true);

drop policy if exists config_write on public.linhas;
create policy config_write on public.linhas for all to authenticated using (true) with check (true);

drop policy if exists config_write on public.rgs;
create policy config_write on public.rgs for all to authenticated using (true) with check (true);

drop policy if exists config_write on public.rg_linhas;
create policy config_write on public.rg_linhas for all to authenticated using (true) with check (true);

drop policy if exists config_write on public.processos;
create policy config_write on public.processos for all to authenticated using (true) with check (true);

drop policy if exists config_write on public.listas_valores;
create policy config_write on public.listas_valores for all to authenticated using (true) with check (true);

drop policy if exists config_write on public.indices;
create policy config_write on public.indices for all to authenticated using (true) with check (true);

drop policy if exists config_write on public.processo_indices;
create policy config_write on public.processo_indices for all to authenticated using (true) with check (true);

drop policy if exists config_write on public.nc_tipos;
create policy config_write on public.nc_tipos for all to authenticated using (true) with check (true);

drop policy if exists config_write on public.nc_tipo_indices;
create policy config_write on public.nc_tipo_indices for all to authenticated using (true) with check (true);

drop policy if exists operation_crud on public.lotes;
create policy operation_crud on public.lotes for all to anon, authenticated using (true) with check (true);

drop policy if exists operation_crud on public.registros;
create policy operation_crud on public.registros for all to anon, authenticated using (true) with check (true);

drop policy if exists operation_crud on public.preenchimentos;
create policy operation_crud on public.preenchimentos for all to anon, authenticated using (true) with check (true);

drop policy if exists operation_crud on public.nao_conformidades;
create policy operation_crud on public.nao_conformidades for all to anon, authenticated using (true) with check (true);

drop policy if exists operation_crud on public.assinaturas;
create policy operation_crud on public.assinaturas for all to anon, authenticated using (true) with check (true);

drop policy if exists operation_crud on public.fotos;
create policy operation_crud on public.fotos for all to anon, authenticated using (true) with check (true);
