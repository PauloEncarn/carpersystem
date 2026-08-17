-- Faz a view respeitar as permissões e políticas RLS do usuário que consulta.
-- Corrige o alerta do Supabase Security Advisor sobre SECURITY DEFINER.

alter view if exists public.vw_relatorio_ciclos
set (security_invoker = true);

grant select on public.vw_relatorio_ciclos to anon, authenticated;
