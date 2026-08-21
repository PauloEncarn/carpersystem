-- Registra separadamente quando a massa ficou pronta e quando foi enviada ao tombador.
-- O tempo de preparo operacional é medido de iniciada_em até enviada_tombador_em.
alter table public.bateladas
  add column if not exists pronta_em timestamptz,
  add column if not exists pronta_por uuid references public.operadores(id) on delete set null,
  add column if not exists enviada_tombador_em timestamptz,
  add column if not exists enviada_tombador_por uuid references public.operadores(id) on delete set null;

alter table public.bateladas drop constraint if exists bateladas_status_check;
update public.bateladas set status = 'enviada_tombador' where status in ('consumida','finalizada');
alter table public.bateladas add constraint bateladas_status_check
  check (status in ('em_preparacao','pronta','enviada_tombador','em_consumo','interrompida','cancelada','bloqueada'));

comment on column public.bateladas.pronta_em is
  'Momento em que a massa terminou de ser preparada e passou a aguardar o tombador.';
comment on column public.bateladas.enviada_tombador_em is
  'Momento em que a massa foi efetivamente enviada ao tombador; o preparo termina em pronta_em.';

create index if not exists bateladas_fila_ciclo_idx
  on public.bateladas(ciclo_id, pronta_em)
  where status = 'pronta';

create unique index if not exists bateladas_em_preparacao_por_ciclo_uidx
  on public.bateladas(ciclo_id)
  where status = 'em_preparacao';

create or replace function public.criar_batelada_com_insumos(
  p_ciclo_id uuid,
  p_receita_id uuid,
  p_insumos jsonb,
  p_observacao text,
  p_operador_id uuid
) returns public.bateladas
language plpgsql security invoker as $$
declare resultado public.bateladas; operador_valido uuid; proximo_numero integer; item jsonb;
begin
  perform 1 from public.ciclos_producao where id = p_ciclo_id for update;
  if not found then raise exception 'Produção não encontrada.'; end if;
  if p_receita_id is null or not exists(select 1 from public.receitas where id=p_receita_id and ativa) then
    raise exception 'Receita ativa não encontrada para este produto.';
  end if;
  if jsonb_array_length(coalesce(p_insumos,'[]'::jsonb)) = 0 then
    raise exception 'Informe os insumos da batelada.';
  end if;
  if exists(select 1 from public.bateladas where ciclo_id=p_ciclo_id and status='em_preparacao') then
    raise exception 'Já existe uma massa em preparação.';
  end if;
  select id into operador_valido from public.operadores where id=p_operador_id;
  select coalesce(max(numero),0)+1 into proximo_numero from public.bateladas where ciclo_id=p_ciclo_id;
  insert into public.bateladas(ciclo_id,receita_id,numero,status,iniciada_em,iniciada_por,observacao)
  values(p_ciclo_id,p_receita_id,proximo_numero,'em_preparacao',now(),operador_valido,nullif(trim(coalesce(p_observacao,'')),''))
  returning * into resultado;
  for item in select * from jsonb_array_elements(p_insumos) loop
    if coalesce(item->>'lot','')='' or coalesce(item->>'expiry','')='' or coalesce(item->>'used','')='' then
      raise exception 'Lote, validade e quantidade são obrigatórios para todos os insumos.';
    end if;
    insert into public.batelada_insumos(
      batelada_id,insumo_id,automacao_lote_id,lote_fornecedor,fornecedor,validade,
      quantidade_prevista,quantidade_utilizada,unidade,origem,operador_id
    ) values (
      resultado.id,(item->>'supplyId')::uuid,nullif(item->>'automationLotId','')::uuid,
      item->>'lot',nullif(item->>'supplier',''),(item->>'expiry')::date,
      nullif(item->>'expected','')::numeric,(item->>'used')::numeric,
      coalesce(nullif(item->>'unit',''),'kg'),item->>'origin',operador_valido
    );
  end loop;
  return resultado;
end $$;

create or replace function public.marcar_batelada_pronta(
  p_batelada_id uuid,
  p_operador_id uuid
) returns public.bateladas
language plpgsql security invoker as $$
declare
  atual public.bateladas;
  resultado public.bateladas;
  operador_valido uuid;
begin
  select * into atual from public.bateladas where id = p_batelada_id for update;
  if atual.id is null or atual.status <> 'em_preparacao' then
    raise exception 'A batelada não está em preparação.';
  end if;
  select id into operador_valido from public.operadores where id = p_operador_id;

  if exists (
    select 1 from public.bateladas
    where ciclo_id = atual.ciclo_id and status = 'pronta' and id <> atual.id
  ) and not exists (
    select 1
    from public.subprocesso_eventos problema
    join public.producao_subprocessos processo on processo.id = problema.subprocesso_id
    where processo.ciclo_id = atual.ciclo_id
      and problema.tipo = 'problema_reportado'
      and not exists (
        select 1 from public.subprocesso_eventos resolucao
        where resolucao.subprocesso_id = problema.subprocesso_id
          and resolucao.tipo = 'problema_resolvido'
          and resolucao.dados->>'problema_id' = problema.id::text
      )
  ) then
    raise exception 'Já existe uma massa pré-pronta. Relate o problema operacional antes de formar fila.';
  end if;

  update public.bateladas set
    status = 'pronta', pronta_em = now(), pronta_por = operador_valido
  where id = atual.id returning * into resultado;
  return resultado;
end $$;

create or replace function public.enviar_batelada_tombador(
  p_batelada_id uuid,
  p_ciclo_id uuid,
  p_operador_id uuid
) returns public.bateladas
language plpgsql security invoker as $$
declare
  atual public.bateladas;
  resultado public.bateladas;
  operador_valido uuid;
  instante timestamptz := now();
begin
  select * into atual from public.bateladas
  where id = p_batelada_id and ciclo_id = p_ciclo_id for update;
  if atual.id is null or atual.status <> 'pronta' then
    raise exception 'A massa precisa estar pré-pronta antes de ser enviada ao tombador.';
  end if;
  select id into operador_valido from public.operadores where id = p_operador_id;
  update public.bateladas set
    status = 'enviada_tombador', consumida_em = instante, consumida_por = operador_valido
  where ciclo_id = p_ciclo_id and status = 'em_consumo';
  update public.bateladas set
    status = 'em_consumo', consumo_iniciado_em = instante,
    consumo_iniciado_por = operador_valido,
    enviada_tombador_em = instante, enviada_tombador_por = operador_valido,
    finalizada_em = instante, finalizada_por = operador_valido
  where id = atual.id returning * into resultado;
  return resultado;
end $$;

grant execute on function public.marcar_batelada_pronta(uuid, uuid) to anon, authenticated;
grant execute on function public.enviar_batelada_tombador(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.criar_batelada_com_insumos(uuid, uuid, jsonb, text, uuid) to anon, authenticated;
