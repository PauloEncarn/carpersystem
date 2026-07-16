-- Observacoes configuraveis e operacionais para RGs/processos.
-- Execute depois das migrations anteriores.

alter table public.rgs
  add column if not exists observacoes text;

alter table public.processos
  add column if not exists observacoes text;

alter table public.registros
  add column if not exists observacao_rg text,
  add column if not exists observacao_processo text;

