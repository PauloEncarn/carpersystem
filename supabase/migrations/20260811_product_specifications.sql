create table if not exists public.configuracoes_produto (
  id uuid primary key default gen_random_uuid(),
  linha_id text not null,
  produto text not null,
  rg_codigo text not null,
  parametros jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now(),
  unique (linha_id, produto)
);

alter table public.configuracoes_produto enable row level security;

drop policy if exists "configuracoes_produto_leitura" on public.configuracoes_produto;
create policy "configuracoes_produto_leitura"
on public.configuracoes_produto for select
to anon, authenticated
using (true);

drop policy if exists "configuracoes_produto_escrita" on public.configuracoes_produto;
create policy "configuracoes_produto_escrita"
on public.configuracoes_produto for all
to anon, authenticated
using (true)
with check (true);

create index if not exists configuracoes_produto_linha_produto_idx
on public.configuracoes_produto (linha_id, produto);
