alter table public.automacao_lotes
  add column if not exists motivo_encerramento text,
  add column if not exists problema_encerramento text;

comment on column public.automacao_lotes.motivo_encerramento is 'finalizado, problema ou outro';
comment on column public.automacao_lotes.problema_encerramento is 'Descrição informada ao encerrar ou trocar o lote.';
