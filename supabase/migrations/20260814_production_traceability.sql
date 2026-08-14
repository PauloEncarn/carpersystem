-- Rastreabilidade industrial da Rosca: receitas, lotes, bateladas e auditoria.
create table if not exists public.insumos (
  id uuid primary key default gen_random_uuid(), codigo text not null unique, nome text not null,
  unidade text not null default 'kg', origem text not null default 'masseira', ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.receitas (
  id uuid primary key default gen_random_uuid(), produto text not null, versao integer not null default 1,
  descricao text, ativa boolean not null default true, created_at timestamptz not null default now(), unique(produto,versao)
);
create table if not exists public.receita_insumos (
  id uuid primary key default gen_random_uuid(), receita_id uuid not null references public.receitas(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id), quantidade numeric, unidade text not null default 'kg', obrigatorio boolean not null default true,
  unique(receita_id,insumo_id)
);
create table if not exists public.automacao_lotes (
  id uuid primary key default gen_random_uuid(), ciclo_id uuid not null references public.ciclos_producao(id) on delete restrict,
  insumo_id uuid not null references public.insumos(id), lote_fornecedor text not null, fornecedor text not null,
  validade date not null, iniciado_em timestamptz not null default now(), encerrado_em timestamptz,
  operador_id uuid references public.operadores(id) on delete set null, created_at timestamptz not null default now()
);
create unique index if not exists automacao_lote_vigente_uidx on public.automacao_lotes(ciclo_id,insumo_id) where encerrado_em is null;
create table if not exists public.bateladas (
  id uuid primary key default gen_random_uuid(), ciclo_id uuid not null references public.ciclos_producao(id) on delete restrict,
  receita_id uuid references public.receitas(id), numero integer not null, status text not null default 'em_preparacao'
    check(status in ('em_preparacao','finalizada','interrompida','cancelada','bloqueada')),
  iniciada_em timestamptz not null default now(), finalizada_em timestamptz,
  iniciada_por uuid references public.operadores(id) on delete set null, finalizada_por uuid references public.operadores(id) on delete set null,
  observacao text, created_at timestamptz not null default now(), unique(ciclo_id,numero)
);
create table if not exists public.batelada_insumos (
  id uuid primary key default gen_random_uuid(), batelada_id uuid not null references public.bateladas(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id), automacao_lote_id uuid references public.automacao_lotes(id),
  lote_fornecedor text not null, fornecedor text, validade date, quantidade_prevista numeric, quantidade_utilizada numeric,
  unidade text not null default 'kg', origem text not null check(origem in ('automacao','masseira')),
  registrado_em timestamptz not null default now(), operador_id uuid references public.operadores(id) on delete set null,
  unique(batelada_id,insumo_id,lote_fornecedor)
);
create table if not exists public.empacotamento_configuracoes (
  id uuid primary key default gen_random_uuid(), ciclo_id uuid not null references public.ciclos_producao(id) on delete restrict,
  maquina integer not null check(maquina between 1 and 4), ativa boolean not null default true, gramatura numeric,
  pacotes_por_caixa integer, vigente_desde timestamptz not null default now(), vigente_ate timestamptz,
  operador_id uuid references public.operadores(id) on delete set null, unique(ciclo_id,maquina,vigente_desde)
);
create table if not exists public.deteccao_metal_testes (
  id uuid primary key default gen_random_uuid(), ciclo_id uuid not null references public.ciclos_producao(id) on delete restrict,
  horario_referencia timestamptz not null, ferroso text not null default 'C', nao_ferroso text not null default 'C', inox text not null default 'C',
  resultado text not null default 'C' check(resultado in ('C','NC','NA')), observacao text,
  registrado_em timestamptz not null default now(), operador_id uuid references public.operadores(id) on delete set null,
  unique(ciclo_id,horario_referencia)
);
alter table public.subprocesso_registros add column if not exists horario_previsto timestamptz;
alter table public.subprocesso_registros add column if not exists status_prazo text not null default 'no_prazo';
alter table public.subprocesso_registros add column if not exists batelada_id uuid references public.bateladas(id) on delete set null;
alter table public.subprocesso_registros add column if not exists retificado boolean not null default false;
create unique index if not exists subprocesso_horario_fixo_uidx on public.subprocesso_registros(subprocesso_id,horario_previsto) where tipo='horario';
create table if not exists public.subprocesso_retificacoes (
  id uuid primary key default gen_random_uuid(), registro_id uuid not null references public.subprocesso_registros(id) on delete restrict,
  valores_anteriores jsonb not null, valores_novos jsonb not null, motivo text not null,
  operador_id uuid references public.operadores(id) on delete set null, retificado_em timestamptz not null default now()
);
create table if not exists public.producao_interrupcoes (
  id uuid primary key default gen_random_uuid(), ciclo_id uuid not null references public.ciclos_producao(id) on delete restrict,
  subprocesso_origem_id uuid references public.producao_subprocessos(id), classificacao text not null check(classificacao in ('pausa','parada','bloqueio')),
  motivo text not null, iniciada_em timestamptz not null default now(), encerrada_em timestamptz,
  iniciada_por uuid references public.operadores(id) on delete set null, encerrada_por uuid references public.operadores(id) on delete set null,
  observacao_retomada text, created_at timestamptz not null default now()
);
create unique index if not exists producao_interrupcao_aberta_uidx on public.producao_interrupcoes(ciclo_id) where encerrada_em is null;

insert into public.insumos(codigo,nome,unidade,origem) values
 ('FARINHA','Farinha','kg','automacao'),('ACUCAR','Açúcar','kg','automacao'),('AGUA','Água','L','masseira'),
 ('GORDURA','Gordura','kg','masseira'),('LECITINA','Lecitina','kg','masseira'),('ACUCAR_INVERTIDO','Açúcar invertido','kg','masseira')
on conflict(codigo) do update set nome=excluded.nome,unidade=excluded.unidade,origem=excluded.origem;
insert into public.receitas(produto,versao,descricao) values
 ('Rosca Leite',1,'Receita fictícia inicial'),('Rosca Coco',1,'Receita fictícia inicial'),
 ('Rosca Chocolate',1,'Receita fictícia inicial'),('Rosca Tradicional',1,'Receita fictícia inicial')
on conflict(produto,versao) do nothing;
insert into public.receita_insumos(receita_id,insumo_id,quantidade,unidade)
select r.id,i.id,case i.codigo when 'FARINHA' then 100 when 'ACUCAR' then 25 when 'AGUA' then 30 when 'GORDURA' then 12 when 'LECITINA' then 1 else 5 end,i.unidade
from public.receitas r cross join public.insumos i where r.versao=1
on conflict(receita_id,insumo_id) do nothing;

alter table public.insumos enable row level security; alter table public.receitas enable row level security;
alter table public.receita_insumos enable row level security; alter table public.automacao_lotes enable row level security;
alter table public.bateladas enable row level security; alter table public.batelada_insumos enable row level security;
alter table public.empacotamento_configuracoes enable row level security; alter table public.deteccao_metal_testes enable row level security;
alter table public.subprocesso_retificacoes enable row level security; alter table public.producao_interrupcoes enable row level security;
do $$ declare tabela text; begin foreach tabela in array array['insumos','receitas','receita_insumos','automacao_lotes','bateladas','batelada_insumos','empacotamento_configuracoes','deteccao_metal_testes','subprocesso_retificacoes','producao_interrupcoes'] loop
 execute format('drop policy if exists traceability_crud on public.%I',tabela);
 execute format('create policy traceability_crud on public.%I for all to anon, authenticated using (true) with check (true)',tabela);
end loop; end $$;

create or replace function public.registrar_horario_fixo_subprocesso(p_subprocesso_id uuid,p_ciclo_id uuid,p_horario_previsto timestamptz,p_valores jsonb,p_batelada_id uuid,p_operador_id uuid)
returns public.subprocesso_registros language plpgsql security invoker as $$
declare resultado public.subprocesso_registros; operador_valido uuid; indice integer;
begin
 select id into operador_valido from public.operadores where id=p_operador_id;
 if exists(select 1 from public.subprocesso_registros where subprocesso_id=p_subprocesso_id and tipo='horario' and horario_previsto=p_horario_previsto) then raise exception 'Horário já confirmado. Utilize retificação.' using errcode='23505'; end if;
 select coalesce(max(janela_indice),-1)+1 into indice from public.subprocesso_registros where subprocesso_id=p_subprocesso_id and tipo='horario';
 insert into public.subprocesso_registros(subprocesso_id,ciclo_id,chave_slot,horario_referencia,horario_previsto,tipo,janela_indice,janela_inicio,janela_fim,valores,batelada_id,status_prazo,operador_id,preenchido_em)
 values(p_subprocesso_id,p_ciclo_id,'fixo:'||p_horario_previsto,p_horario_previsto,p_horario_previsto,'horario',indice,p_horario_previsto,p_horario_previsto+interval '1 hour',p_valores,p_batelada_id,case when now()>p_horario_previsto+interval '59 minutes' then 'atrasado' else 'no_prazo' end,operador_valido,now()) returning * into resultado;
 return resultado;
end $$;
grant execute on function public.registrar_horario_fixo_subprocesso(uuid,uuid,timestamptz,jsonb,uuid,uuid) to anon,authenticated;

create or replace function public.retificar_registro_subprocesso(p_registro_id uuid,p_valores jsonb,p_motivo text,p_operador_id uuid)
returns public.subprocesso_registros language plpgsql security invoker as $$
declare atual public.subprocesso_registros; resultado public.subprocesso_registros; operador_valido uuid;
begin
 if length(trim(coalesce(p_motivo,'')))<5 then raise exception 'Informe uma justificativa para a retificação.'; end if;
 select * into atual from public.subprocesso_registros where id=p_registro_id for update;
 select id into operador_valido from public.operadores where id=p_operador_id;
 insert into public.subprocesso_retificacoes(registro_id,valores_anteriores,valores_novos,motivo,operador_id) values(atual.id,atual.valores,p_valores,p_motivo,operador_valido);
 update public.subprocesso_registros set valores=p_valores,retificado=true,versao=versao+1,preenchido_em=now(),operador_id=operador_valido where id=atual.id returning * into resultado;
 return resultado;
end $$;
grant execute on function public.retificar_registro_subprocesso(uuid,jsonb,text,uuid) to anon,authenticated;

create or replace function public.interromper_producao_global(p_ciclo_id uuid,p_subprocesso_origem_id uuid,p_classificacao text,p_motivo text,p_operador_id uuid)
returns public.producao_interrupcoes language plpgsql security invoker as $$
declare resultado public.producao_interrupcoes; operador_valido uuid;
begin
 select id into operador_valido from public.operadores where id=p_operador_id;
 if exists(select 1 from public.producao_interrupcoes where ciclo_id=p_ciclo_id and encerrada_em is null) then raise exception 'A produção já possui uma interrupção aberta.'; end if;
 insert into public.producao_interrupcoes(ciclo_id,subprocesso_origem_id,classificacao,motivo,iniciada_por) values(p_ciclo_id,p_subprocesso_origem_id,p_classificacao,p_motivo,operador_valido) returning * into resultado;
 update public.ciclos_producao set status='bloqueado',updated_at=now() where id=p_ciclo_id;
 update public.producao_subprocessos set status='pausado',estado_iniciado_em=now(),atualizado_por=operador_valido,versao=versao+1,updated_at=now() where ciclo_id=p_ciclo_id and status not in ('finalizado','nao_iniciado');
 return resultado;
end $$;
grant execute on function public.interromper_producao_global(uuid,uuid,text,text,uuid) to anon,authenticated;

create or replace function public.retomar_producao_global(p_ciclo_id uuid,p_observacao text,p_operador_id uuid)
returns public.producao_interrupcoes language plpgsql security invoker as $$
declare resultado public.producao_interrupcoes; operador_valido uuid;
begin
 select id into operador_valido from public.operadores where id=p_operador_id;
 update public.producao_interrupcoes set encerrada_em=now(),encerrada_por=operador_valido,observacao_retomada=p_observacao
 where id=(select id from public.producao_interrupcoes where ciclo_id=p_ciclo_id and encerrada_em is null order by iniciada_em desc limit 1) returning * into resultado;
 if resultado.id is null then raise exception 'Nenhuma interrupção aberta.'; end if;
 update public.ciclos_producao set status='produzindo',updated_at=now() where id=p_ciclo_id;
 update public.producao_subprocessos set status='operando',estado_iniciado_em=now(),atualizado_por=operador_valido,versao=versao+1,updated_at=now() where ciclo_id=p_ciclo_id and status='pausado';
 return resultado;
end $$;
grant execute on function public.retomar_producao_global(uuid,text,uuid) to anon,authenticated;
