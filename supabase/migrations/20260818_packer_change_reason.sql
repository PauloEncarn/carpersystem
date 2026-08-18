alter table public.empacotamento_configuracoes
  add column if not exists motivo_alteracao text;

comment on column public.empacotamento_configuracoes.motivo_alteracao is
  'Justificativa obrigatória quando a quantidade ou o estado das empacotadoras é alterado durante a produção.';
