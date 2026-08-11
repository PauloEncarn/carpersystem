-- Limpeza pontual dos dados operacionais de teste.
-- Preserva operadores, perfis, linhas, RGs, processos, produtos e configuracoes.
-- Execute este arquivo no SQL Editor do projeto Supabase.

begin;

truncate table
  public.ciclo_pausas,
  public.ciclo_nao_conformidades,
  public.eventos_ciclo,
  public.fotos,
  public.assinaturas,
  public.nao_conformidades,
  public.preenchimentos,
  public.registros,
  public.lotes,
  public.ciclos_producao,
  public.hourly_email_dispatches
restart identity;

commit;

