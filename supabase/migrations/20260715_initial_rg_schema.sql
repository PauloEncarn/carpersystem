-- Sistema RG Qualidade Cicopal
-- Execute este arquivo no SQL Editor do Supabase.
-- A politica abaixo libera CRUD para anon/authenticated para prototipo em tablet.
-- Antes de producao, troque as policies por regras com login/perfil.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.operadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  turno text,
  codigo_pin text unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.linhas (
  id text primary key,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rgs (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null,
  revisao text not null default '00',
  descricao text,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rg_linhas (
  id uuid primary key default gen_random_uuid(),
  rg_id uuid not null references public.rgs(id) on delete cascade,
  linha_id text not null references public.linhas(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (rg_id, linha_id)
);

create table if not exists public.processos (
  id uuid primary key default gen_random_uuid(),
  rg_id uuid not null references public.rgs(id) on delete cascade,
  codigo text not null,
  nome text not null,
  tipo text not null,
  frequencia text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rg_id, codigo)
);

create table if not exists public.listas_valores (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  valores jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.indices (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null,
  unidade text,
  secao_default text not null default 'Geral',
  layout_default text not null default 'third',
  obrigatorio boolean not null default true,
  default_mode text not null default 'manual',
  default_tag text,
  lista_valores_id uuid references public.listas_valores(id) on delete set null,
  usar_regras_por_linha boolean not null default false,
  regras_por_linha jsonb not null default '{}'::jsonb,
  subindices jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processo_indices (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos(id) on delete cascade,
  indice_id uuid not null references public.indices(id) on delete restrict,
  secao text not null,
  ordem integer not null default 0,
  layout text not null default 'third',
  obrigatorio boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (processo_id, indice_id, secao)
);

create table if not exists public.nc_tipos (
  id uuid primary key default gen_random_uuid(),
  rg_id uuid references public.rgs(id) on delete cascade,
  processo_id uuid references public.processos(id) on delete cascade,
  nome text not null,
  secao text not null default 'Nao conformidades',
  ativo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nc_tipo_indices (
  id uuid primary key default gen_random_uuid(),
  nc_tipo_id uuid not null references public.nc_tipos(id) on delete cascade,
  indice_id uuid not null references public.indices(id) on delete restrict,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  unique (nc_tipo_id, indice_id)
);

create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  linha_id text not null references public.linhas(id) on delete restrict,
  data_producao date not null,
  produto text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (linha_id, data_producao)
);

create table if not exists public.registros (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  lote_id uuid not null references public.lotes(id) on delete cascade,
  rg_id uuid not null references public.rgs(id) on delete restrict,
  processo_id uuid not null references public.processos(id) on delete restrict,
  operador_id uuid references public.operadores(id) on delete set null,
  turno text,
  motivo text,
  status text not null default 'rascunho',
  data_registro timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preenchimentos (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.registros(id) on delete cascade,
  processo_id uuid not null references public.processos(id) on delete restrict,
  operador_id uuid references public.operadores(id) on delete set null,
  contexto_tipo text not null default 'registro',
  horario time,
  batelada_numero integer,
  valores jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho',
  preenchido_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nao_conformidades (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes(id) on delete cascade,
  registro_id uuid not null references public.registros(id) on delete cascade,
  preenchimento_id uuid references public.preenchimentos(id) on delete cascade,
  processo_id uuid not null references public.processos(id) on delete restrict,
  indice_id uuid references public.indices(id) on delete set null,
  nc_tipo_id uuid references public.nc_tipos(id) on delete set null,
  horario time,
  status text not null default 'aberta',
  produto_afetado text,
  quantidade_impacto text,
  descricao text,
  causa text,
  acao_corretiva text,
  disposicao_imediata text,
  disposicao_final text,
  foto_path text,
  criado_por uuid references public.operadores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid references public.registros(id) on delete cascade,
  preenchimento_id uuid references public.preenchimentos(id) on delete cascade,
  papel text not null,
  operador_id uuid references public.operadores(id) on delete set null,
  nome text not null,
  assinatura_data text,
  assinatura_path text,
  assinado_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.fotos (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid references public.registros(id) on delete cascade,
  preenchimento_id uuid references public.preenchimentos(id) on delete cascade,
  nao_conformidade_id uuid references public.nao_conformidades(id) on delete cascade,
  path text not null,
  legenda text,
  capturado_por uuid references public.operadores(id) on delete set null,
  capturado_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_rg_linhas_linha on public.rg_linhas (linha_id);
create index if not exists idx_processos_rg on public.processos (rg_id);
create index if not exists idx_indices_tipo on public.indices (tipo);
create index if not exists idx_processo_indices_processo on public.processo_indices (processo_id, ordem);
create index if not exists idx_lotes_linha_data on public.lotes (linha_id, data_producao);
create index if not exists idx_registros_lote on public.registros (lote_id);
create index if not exists idx_registros_processo on public.registros (processo_id);
create index if not exists idx_preenchimentos_registro on public.preenchimentos (registro_id);
create index if not exists idx_preenchimentos_horario on public.preenchimentos (horario);
create index if not exists idx_ncs_lote on public.nao_conformidades (lote_id);
create index if not exists idx_ncs_registro on public.nao_conformidades (registro_id);
create index if not exists idx_ncs_processo on public.nao_conformidades (processo_id);
create index if not exists idx_assinaturas_registro on public.assinaturas (registro_id);
create index if not exists idx_fotos_registro on public.fotos (registro_id);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'operadores',
    'linhas',
    'rgs',
    'rg_linhas',
    'processos',
    'listas_valores',
    'indices',
    'processo_indices',
    'nc_tipos',
    'nc_tipo_indices',
    'lotes',
    'registros',
    'preenchimentos',
    'nao_conformidades',
    'assinaturas',
    'fotos'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists public_crud on public.%I', tbl);
    execute format('create policy public_crud on public.%I for all to anon, authenticated using (true) with check (true)', tbl);
  end loop;
end $$;

drop trigger if exists set_updated_at_operadores on public.operadores;
create trigger set_updated_at_operadores before update on public.operadores
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_linhas on public.linhas;
create trigger set_updated_at_linhas before update on public.linhas
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_rgs on public.rgs;
create trigger set_updated_at_rgs before update on public.rgs
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_processos on public.processos;
create trigger set_updated_at_processos before update on public.processos
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_indices on public.indices;
create trigger set_updated_at_indices before update on public.indices
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_lotes on public.lotes;
create trigger set_updated_at_lotes before update on public.lotes
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_registros on public.registros;
create trigger set_updated_at_registros before update on public.registros
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_preenchimentos on public.preenchimentos;
create trigger set_updated_at_preenchimentos before update on public.preenchimentos
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_ncs on public.nao_conformidades;
create trigger set_updated_at_ncs before update on public.nao_conformidades
for each row execute function public.set_updated_at();

insert into public.linhas (id, nome)
values
  ('PUR', 'PURURUCA'),
  ('SAL', 'SALGADINHO'),
  ('ROS', 'ROSCA')
on conflict (id) do update set nome = excluded.nome;

insert into public.rgs (id, codigo, titulo, revisao, descricao)
values
  ('00000000-0000-0000-0000-000000000003', 'RG.PRD.BA.003', 'Controle de Batelada do Milho', '00', 'Controle por batelada do milho'),
  ('00000000-0000-0000-0000-000000000004', 'RG.PRD.BA.004', 'Parametros de Processo Extrusados - Linha Clextral', '02', 'Parametros hora em hora da extrusora Clextral'),
  ('00000000-0000-0000-0000-000000000005', 'RG.QUA.005', 'Controle de Liberacao de Produto', '02', 'Higienizacao, produto, processo e registros fotograficos')
on conflict (codigo) do update
set titulo = excluded.titulo,
    revisao = excluded.revisao,
    descricao = excluded.descricao;

insert into public.rg_linhas (rg_id, linha_id)
values
  ('00000000-0000-0000-0000-000000000003', 'SAL'),
  ('00000000-0000-0000-0000-000000000004', 'SAL'),
  ('00000000-0000-0000-0000-000000000005', 'PUR')
on conflict (rg_id, linha_id) do nothing;

insert into public.processos (id, rg_id, codigo, nome, tipo, frequencia, ordem)
values
  ('00000000-0000-0000-0000-000000003001', '00000000-0000-0000-0000-000000000003', 'BAT', 'Controle de Batelada do Milho', 'batelada_milho', 'Por batelada', 1),
  ('00000000-0000-0000-0000-000000004001', '00000000-0000-0000-0000-000000000004', 'EXT', 'Parametros Extrusora Clextral', 'extrusora_clextral', 'Hora em hora', 1),
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000000005', 'HIG', 'Higienizacao', 'higienizacao', 'Por setup', 1),
  ('00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000000005', 'LIBP', 'Liberacao do Produto', 'produto_liberacao', 'Por horario liberado', 2),
  ('00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000000005', 'AVP', 'Avaliacao do Produto', 'produto_avaliacao', 'Hora em hora', 3),
  ('00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000000005', 'RGP', 'RG - Processo', 'processo', 'Hora em hora', 4),
  ('00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000000005', 'REGF', 'Registro Fotografico', 'fotografico', 'Hora em hora', 5)
on conflict (rg_id, codigo) do update
set nome = excluded.nome,
    tipo = excluded.tipo,
    frequencia = excluded.frequencia,
    ordem = excluded.ordem;

insert into public.listas_valores (codigo, nome, valores)
values
  ('marca_extrusados', 'Marca extrusados', '["MIC", "MIK", "ANE"]'::jsonb),
  ('formato_clextral', 'Formato Clextral', '["CX", "ZZ", "ANE", "CON"]'::jsonb),
  ('sabor_extrusados', 'Sabor extrusados', '["QJ", "RQ", "CB", "PZ", "PR", "CM", "GL", "CR"]'::jsonb),
  ('disposicao_imediata', 'Disposicao imediata', '["Bloqueado", "Descarte"]'::jsonb)
on conflict (codigo) do update
set nome = excluded.nome,
    valores = excluded.valores;

insert into storage.buckets (id, name, public)
values
  ('rg-fotos', 'rg-fotos', false),
  ('rg-assinaturas', 'rg-assinaturas', false)
on conflict (id) do nothing;

drop policy if exists rg_storage_crud on storage.objects;
create policy rg_storage_crud
on storage.objects
for all
to anon, authenticated
using (bucket_id in ('rg-fotos', 'rg-assinaturas'))
with check (bucket_id in ('rg-fotos', 'rg-assinaturas'));
