-- LIMPEZA TOTAL DOS DADOS OPERACIONAIS.
-- Preserva usuários, perfis, linhas, RGs, processos, receitas, insumos,
-- produtos, parâmetros e demais configurações do sistema.
-- Execute sozinho no SQL Editor, sem outra migration rodando em paralelo.

begin;
set local lock_timeout = '20s';
set local statement_timeout = '2min';

do $$
declare
  candidates text[] := array[
    'public.subprocesso_retificacoes',
    'public.subprocesso_registros',
    'public.subprocesso_eventos',
    'public.producao_interrupcoes',
    'public.deteccao_metal_testes',
    'public.empacotamento_configuracoes',
    'public.batelada_insumos',
    'public.bateladas',
    'public.automacao_lotes',
    'public.producao_subprocessos',
    'public.higienizacao_rodadas',
    'public.ciclo_turnos',
    'public.ciclo_pausas',
    'public.ciclo_nao_conformidades',
    'public.eventos_ciclo',
    'public.fotos',
    'public.assinaturas',
    'public.nao_conformidades',
    'public.preenchimentos',
    'public.registros',
    'public.lotes',
    'public.hourly_email_dispatches',
    'public.ciclos_producao'
  ];
  existing_tables text;
begin
  select string_agg(item, ', ')
    into existing_tables
  from unnest(candidates) item
  where to_regclass(item) is not null;

  if existing_tables is not null then
    execute 'truncate table ' || existing_tables || ' restart identity';
  end if;
end $$;

commit;

select
  (select count(*) from public.ciclos_producao) as producoes,
  (select count(*) from public.registros) as registros,
  (select count(*) from public.preenchimentos) as preenchimentos,
  (select count(*) from public.ciclo_nao_conformidades) as ncs;
