-- Execucao industrial complementar vinculada ao ciclo de producao.
create table if not exists public.producao_subprocessos (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ciclos_producao(id) on delete restrict,
  codigo text not null,
  nome text not null,
  ordem integer not null,
  status text not null default 'nao_iniciado'
    check (status in ('nao_iniciado','operando','pausado','parado','finalizado')),
  equipamento text,
  iniciado_em timestamptz,
  encerrado_em timestamptz,
  estado_iniciado_em timestamptz not null default now(),
  iniciado_por uuid references public.operadores(id) on delete set null,
  atualizado_por uuid references public.operadores(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  versao integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ciclo_id, codigo)
);

create table if not exists public.subprocesso_eventos (
  id uuid primary key default gen_random_uuid(),
  subprocesso_id uuid not null references public.producao_subprocessos(id) on delete cascade,
  tipo text not null,
  status_anterior text,
  status_novo text,
  motivo text,
  ocorrido_em timestamptz not null default now(),
  operador_id uuid references public.operadores(id) on delete set null,
  dados jsonb not null default '{}'::jsonb
);

create table if not exists public.subprocesso_registros (
  id uuid primary key default gen_random_uuid(),
  subprocesso_id uuid not null references public.producao_subprocessos(id) on delete restrict,
  ciclo_id uuid not null references public.ciclos_producao(id) on delete restrict,
  chave_slot text not null,
  horario_referencia timestamptz not null,
  valores jsonb not null default '{}'::jsonb,
  operador_id uuid references public.operadores(id) on delete set null,
  preenchido_em timestamptz not null default now(),
  versao integer not null default 1,
  unique (subprocesso_id, chave_slot)
);

create index if not exists producao_subprocessos_ciclo_idx on public.producao_subprocessos(ciclo_id, ordem);
create index if not exists subprocesso_eventos_processo_idx on public.subprocesso_eventos(subprocesso_id, ocorrido_em desc);
create index if not exists subprocesso_registros_ciclo_idx on public.subprocesso_registros(ciclo_id, horario_referencia desc);

alter table public.producao_subprocessos enable row level security;
alter table public.subprocesso_eventos enable row level security;
alter table public.subprocesso_registros enable row level security;

drop policy if exists production_subprocess_crud on public.producao_subprocessos;
create policy production_subprocess_crud on public.producao_subprocessos for all to anon, authenticated using (true) with check (true);
drop policy if exists production_subprocess_event_crud on public.subprocesso_eventos;
create policy production_subprocess_event_crud on public.subprocesso_eventos for all to anon, authenticated using (true) with check (true);
drop policy if exists production_subprocess_record_crud on public.subprocesso_registros;
create policy production_subprocess_record_crud on public.subprocesso_registros for all to anon, authenticated using (true) with check (true);

create or replace function public.alterar_estado_subprocesso(
  p_subprocesso_id uuid,
  p_versao_esperada integer,
  p_status text,
  p_motivo text,
  p_operador_id uuid
) returns public.producao_subprocessos
language plpgsql security invoker as $$
declare atual public.producao_subprocessos; resultado public.producao_subprocessos; instante timestamptz := now();
begin
  select * into atual from public.producao_subprocessos where id = p_subprocesso_id;
  if atual.id is null then raise exception 'Subprocesso nao encontrado.'; end if;
  update public.producao_subprocessos set
    status = p_status,
    iniciado_em = case when p_status = 'operando' then coalesce(iniciado_em, instante) else iniciado_em end,
    encerrado_em = case when p_status = 'finalizado' then instante else encerrado_em end,
    estado_iniciado_em = instante,
    iniciado_por = case when iniciado_em is null and p_status = 'operando' then p_operador_id else iniciado_por end,
    atualizado_por = p_operador_id, versao = versao + 1, updated_at = instante
  where id = p_subprocesso_id and versao = p_versao_esperada returning * into resultado;
  if resultado.id is null then
    raise exception 'CONFLICT: subprocesso alterado por outro usuario. Atualize a tela.' using errcode = '40001';
  end if;
  insert into public.subprocesso_eventos(subprocesso_id,tipo,status_anterior,status_novo,motivo,ocorrido_em,operador_id)
  values (resultado.id,'mudanca_estado',atual.status,p_status,p_motivo,instante,p_operador_id);
  return resultado;
end; $$;

grant execute on function public.alterar_estado_subprocesso(uuid,integer,text,text,uuid) to anon, authenticated;

create or replace function public.encerrar_subprocessos_ciclo(p_ciclo_id uuid, p_operador_id uuid)
returns void language plpgsql security invoker as $$
declare item record; instante timestamptz := now();
begin
  for item in select * from public.producao_subprocessos where ciclo_id = p_ciclo_id and status <> 'finalizado'
  loop
    update public.producao_subprocessos set status='finalizado', encerrado_em=instante,
      estado_iniciado_em=instante, atualizado_por=p_operador_id, versao=versao+1, updated_at=instante where id=item.id;
    insert into public.subprocesso_eventos(subprocesso_id,tipo,status_anterior,status_novo,motivo,ocorrido_em,operador_id)
    values(item.id,'encerramento_producao',item.status,'finalizado','Encerramento da produção principal',instante,p_operador_id);
  end loop;
end; $$;
grant execute on function public.encerrar_subprocessos_ciclo(uuid,uuid) to anon, authenticated;
