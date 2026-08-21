-- Passagem de responsabilidade sem encerrar o ciclo produtivo.
create table if not exists public.ciclo_turnos (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ciclos_producao(id) on delete cascade,
  turno_origem text,
  turno_destino text not null check (turno_destino in ('A','B','C')),
  responsavel_id uuid references public.operadores(id) on delete set null,
  responsavel_nome text,
  iniciado_em timestamptz not null default now(),
  observacao text
);
alter table public.ciclo_turnos add column if not exists responsavel_nome text;

create index if not exists ciclo_turnos_ciclo_inicio_idx on public.ciclo_turnos(ciclo_id, iniciado_em desc);
alter table public.ciclo_turnos enable row level security;
drop policy if exists ciclo_turnos_read on public.ciclo_turnos;
create policy ciclo_turnos_read on public.ciclo_turnos for select to anon, authenticated using (true);
drop policy if exists ciclo_turnos_write on public.ciclo_turnos;
create policy ciclo_turnos_write on public.ciclo_turnos for all to anon, authenticated using (true) with check (true);

create or replace function public.registrar_passagem_turno(
  p_ciclo_id uuid, p_operador_id uuid, p_turno_origem text,
  p_turno_destino text, p_responsavel_nome text, p_observacao text default null
) returns public.ciclo_turnos language plpgsql security invoker as $$
declare resultado public.ciclo_turnos; operador_valido uuid;
begin
  if p_turno_destino not in ('A','B','C') then raise exception 'Turno inválido'; end if;
  select id into operador_valido from public.operadores where id=p_operador_id;
  insert into public.ciclo_turnos(ciclo_id,turno_origem,turno_destino,responsavel_id,responsavel_nome,observacao)
  values(p_ciclo_id,p_turno_origem,p_turno_destino,operador_valido,nullif(trim(coalesce(p_responsavel_nome,'')),''),nullif(trim(coalesce(p_observacao,'')),'')) returning * into resultado;
  insert into public.eventos_ciclo(ciclo_id,tipo,descricao,operador_id,dados)
  values(p_ciclo_id,'troca_turno','Responsabilidade transferida para o turno '||p_turno_destino,operador_valido,jsonb_build_object('turno_origem',p_turno_origem,'turno_destino',p_turno_destino,'responsavel_nome',p_responsavel_nome));
  return resultado;
end $$;
grant execute on function public.registrar_passagem_turno(uuid,uuid,text,text,text,text) to anon, authenticated;

insert into public.perfis (codigo,nome,descricao,permissoes)
values ('supervisao','Supervisão','Acompanha qualidade, produção, indicadores e relatórios.', '["operacao:acessar","supervisao:acessar","relatorios:acessar","registro:validar","nc:tratar"]'::jsonb)
on conflict (codigo) do update set nome=excluded.nome,descricao=excluded.descricao,permissoes=excluded.permissoes,ativo=true;
