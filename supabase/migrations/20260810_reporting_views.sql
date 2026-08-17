create or replace view public.vw_relatorio_ciclos
with (security_invoker = true) as
select
  c.id as ciclo_id,
  c.linha_id,
  r.codigo as rg_codigo,
  c.produto,
  c.produto_anterior,
  c.motivo_inicio,
  c.status,
  c.iniciado_em,
  c.producao_iniciada_em,
  c.producao_encerrada_em,
  c.encerrado_em,
  c.iniciado_por as operador_id,
  o.nome as operador_nome,
  c.metadata,
  count(distinct p.id) as total_preenchimentos,
  count(distinct p.id) filter (where p.status = 'com_nc') as preenchimentos_com_nc,
  count(distinct nc.id) as ncs_genericas
from public.ciclos_producao c
join public.rgs r on r.id = c.rg_id
left join public.operadores o on o.id = c.iniciado_por
left join public.preenchimentos p on p.ciclo_id = c.id
left join public.ciclo_nao_conformidades nc on nc.ciclo_id = c.id
group by c.id, r.codigo, o.nome;

grant select on public.vw_relatorio_ciclos to anon, authenticated;
