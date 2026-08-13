-- Rodadas de execucao, inspecao e reinspecao da higienizacao.
create table if not exists public.higienizacao_rodadas (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ciclos_producao(id) on delete restrict,
  numero integer not null check (numero > 0),
  rodada_anterior_id uuid references public.higienizacao_rodadas(id) on delete restrict,
  status text not null check (status in ('aguardando_qualidade', 'em_inspecao', 'em_correcao', 'aprovada')),
  dados_operacao jsonb not null default '{}'::jsonb,
  dados_qualidade jsonb,
  executada_por uuid references public.operadores(id) on delete set null,
  inspecionada_por uuid references public.operadores(id) on delete set null,
  execucao_iniciada_em timestamptz not null default now(),
  enviada_inspecao_em timestamptz not null default now(),
  inspecao_iniciada_em timestamptz,
  inspecao_encerrada_em timestamptz,
  created_at timestamptz not null default now(),
  versao integer not null default 1,
  unique (ciclo_id, numero)
);

create index if not exists higienizacao_rodadas_ciclo_idx
  on public.higienizacao_rodadas (ciclo_id, numero desc);

alter table public.higienizacao_rodadas enable row level security;
drop policy if exists hygiene_round_read on public.higienizacao_rodadas;
create policy hygiene_round_read on public.higienizacao_rodadas
  for select to anon, authenticated using (true);
drop policy if exists hygiene_round_write on public.higienizacao_rodadas;
create policy hygiene_round_write on public.higienizacao_rodadas
  for all to anon, authenticated using (true) with check (true);

create or replace function public.inspecionar_higienizacao(
  p_rodada_id uuid,
  p_versao_esperada integer,
  p_dados_qualidade jsonb,
  p_status text,
  p_operador_id uuid
)
returns public.higienizacao_rodadas
language plpgsql
security invoker
as $$
declare resultado public.higienizacao_rodadas;
begin
  if p_status not in ('em_correcao', 'aprovada') then
    raise exception 'Status de inspecao invalido.';
  end if;
  update public.higienizacao_rodadas
     set dados_qualidade = p_dados_qualidade,
         status = p_status,
         inspecionada_por = p_operador_id,
         inspecao_iniciada_em = coalesce(inspecao_iniciada_em, now()),
         inspecao_encerrada_em = now(),
         versao = versao + 1
   where id = p_rodada_id
     and versao = p_versao_esperada
     and status in ('aguardando_qualidade', 'em_inspecao')
   returning * into resultado;
  if resultado.id is null then
    raise exception 'CONFLICT: esta rodada foi alterada por outro usuario. Atualize a tela.' using errcode = '40001';
  end if;
  return resultado;
end;
$$;

grant execute on function public.inspecionar_higienizacao(uuid, integer, jsonb, text, uuid)
  to anon, authenticated;

