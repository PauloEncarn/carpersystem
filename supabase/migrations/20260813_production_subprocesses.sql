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
  tipo text not null default 'horario' check (tipo in ('producao','lote','horario')),
  janela_indice integer not null default 0,
  janela_inicio timestamptz,
  janela_fim timestamptz,
  valores jsonb not null default '{}'::jsonb,
  operador_id uuid references public.operadores(id) on delete set null,
  preenchido_em timestamptz not null default now(),
  versao integer not null default 1,
  unique (subprocesso_id, chave_slot)
);

alter table public.subprocesso_registros add column if not exists tipo text not null default 'horario';
alter table public.subprocesso_registros add column if not exists janela_indice integer not null default 0;
alter table public.subprocesso_registros add column if not exists janela_inicio timestamptz;
alter table public.subprocesso_registros add column if not exists janela_fim timestamptz;
alter table public.subprocesso_registros drop constraint if exists subprocesso_registros_tipo_check;
alter table public.subprocesso_registros add constraint subprocesso_registros_tipo_check check (tipo in ('producao','lote','horario'));
with ordenados as (
  select id, row_number() over (partition by subprocesso_id order by horario_referencia, id) - 1 as novo_indice
  from public.subprocesso_registros
)
update public.subprocesso_registros registro set
  janela_indice=ordenados.novo_indice,
  janela_inicio=coalesce(registro.janela_inicio,registro.horario_referencia),
  janela_fim=coalesce(registro.janela_fim,registro.horario_referencia+interval '60 minutes')
from ordenados where registro.id=ordenados.id and registro.tipo='horario';
create unique index if not exists subprocesso_registros_janela_uidx on public.subprocesso_registros(subprocesso_id, tipo, janela_indice);

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

create or replace function public.registrar_apontamento_subprocesso(p_subprocesso_id uuid, p_ciclo_id uuid, p_valores jsonb, p_operador_id uuid, p_tipo text)
returns public.subprocesso_registros language plpgsql security invoker as $$
declare instante timestamptz:=now(); ancora timestamptz; indice integer; inicio timestamptz; fim timestamptz; resultado public.subprocesso_registros; operador_valido uuid; ultimos_valores jsonb;
begin
  select id into operador_valido from public.operadores where id=p_operador_id;
  perform 1 from public.producao_subprocessos where id=p_subprocesso_id and ciclo_id=p_ciclo_id for update;
  if not found then raise exception 'Subprocesso não pertence a esta produção.'; end if;
  if p_tipo in ('producao','lote') then
    select janela_indice, valores into indice, ultimos_valores from public.subprocesso_registros
      where subprocesso_id=p_subprocesso_id and tipo=p_tipo order by janela_indice desc limit 1;
    if indice is null then indice:=0;
    elsif ultimos_valores is distinct from p_valores then indice:=indice+1;
    end if;
    inicio:=instante; fim:=null;
  else
    -- Uma única régua horária para toda a produção. O primeiro apontamento de
    -- qualquer área ancora Corte, Forno, Empacotamento e Encaixotamento.
    select min(janela_inicio) into ancora from public.subprocesso_registros where ciclo_id=p_ciclo_id and tipo='horario';
    ancora:=coalesce(ancora,instante);
    indice:=greatest(0,floor(extract(epoch from (instante-ancora))/3600)::integer);
    inicio:=ancora+make_interval(hours=>indice); fim:=inicio+interval '60 minutes';
    if exists(select 1 from public.subprocesso_registros where subprocesso_id=p_subprocesso_id and tipo='horario' and janela_indice=indice) then
      raise exception 'Este apontamento horário já foi confirmado e não pode ser alterado.' using errcode='23505';
    end if;
  end if;
  insert into public.subprocesso_registros(subprocesso_id,ciclo_id,chave_slot,horario_referencia,tipo,janela_indice,janela_inicio,janela_fim,valores,operador_id,preenchido_em)
  values(p_subprocesso_id,p_ciclo_id,p_tipo||':'||indice,coalesce(inicio,instante),p_tipo,indice,inicio,fim,p_valores,operador_valido,instante)
  on conflict (subprocesso_id,tipo,janela_indice) do update set valores=excluded.valores,operador_id=excluded.operador_id,preenchido_em=excluded.preenchido_em,versao=public.subprocesso_registros.versao+1
  returning * into resultado;
  return resultado;
end; $$;
grant execute on function public.registrar_apontamento_subprocesso(uuid,uuid,jsonb,uuid,text) to anon, authenticated;

create or replace function public.alterar_estado_subprocesso(
  p_subprocesso_id uuid,
  p_versao_esperada integer,
  p_status text,
  p_motivo text,
  p_operador_id uuid
) returns public.producao_subprocessos
language plpgsql security invoker as $$
declare atual public.producao_subprocessos; resultado public.producao_subprocessos; instante timestamptz := now(); operador_valido uuid;
begin
  select id into operador_valido from public.operadores where id=p_operador_id;
  select * into atual from public.producao_subprocessos where id = p_subprocesso_id;
  if atual.id is null then raise exception 'Subprocesso nao encontrado.'; end if;
  update public.producao_subprocessos set
    status = p_status,
    iniciado_em = case when p_status = 'operando' then coalesce(iniciado_em, instante) else iniciado_em end,
    encerrado_em = case when p_status = 'finalizado' then instante else encerrado_em end,
    estado_iniciado_em = instante,
    iniciado_por = case when iniciado_em is null and p_status = 'operando' then operador_valido else iniciado_por end,
    atualizado_por = operador_valido, versao = versao + 1, updated_at = instante
  where id = p_subprocesso_id and versao = p_versao_esperada returning * into resultado;
  if resultado.id is null then
    raise exception 'CONFLICT: subprocesso alterado por outro usuario. Atualize a tela.' using errcode = '40001';
  end if;
  insert into public.subprocesso_eventos(subprocesso_id,tipo,status_anterior,status_novo,motivo,ocorrido_em,operador_id)
  values (resultado.id,'mudanca_estado',atual.status,p_status,p_motivo,instante,operador_valido);
  return resultado;
end; $$;

grant execute on function public.alterar_estado_subprocesso(uuid,integer,text,text,uuid) to anon, authenticated;

create or replace function public.encerrar_subprocessos_ciclo(p_ciclo_id uuid, p_operador_id uuid)
returns void language plpgsql security invoker as $$
declare item record; instante timestamptz := now(); operador_valido uuid;
begin
  select id into operador_valido from public.operadores where id=p_operador_id;
  for item in select * from public.producao_subprocessos where ciclo_id = p_ciclo_id and status <> 'finalizado'
  loop
    update public.producao_subprocessos set status='finalizado', encerrado_em=instante,
      estado_iniciado_em=instante, atualizado_por=operador_valido, versao=versao+1, updated_at=instante where id=item.id;
    insert into public.subprocesso_eventos(subprocesso_id,tipo,status_anterior,status_novo,motivo,ocorrido_em,operador_id)
    values(item.id,'encerramento_producao',item.status,'finalizado','Encerramento da produção principal',instante,operador_valido);
  end loop;
end; $$;
grant execute on function public.encerrar_subprocessos_ciclo(uuid,uuid) to anon, authenticated;
