-- A produção passa a valer a partir do envio da primeira massa ao tombador.
-- Mantém o estado remoto consistente mesmo quando a tela é recarregada em outro dispositivo.
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

  update public.ciclos_producao set
    status = 'produzindo',
    producao_iniciada_em = coalesce(producao_iniciada_em, instante),
    etapa_iniciada_em = instante,
    updated_at = instante
  where id = p_ciclo_id and status in ('pronto', 'aguardando_liberacao');

  return resultado;
end $$;

grant execute on function public.enviar_batelada_tombador(uuid, uuid, uuid) to anon, authenticated;
