-- CARGA FICTÍCIA · Rosca Leite · 13/10/2026 · turno completo (07h–21h).
-- Uso: execute no SQL Editor do Supabase depois de aplicar todas as migrations.
-- A carga é idempotente e não fecha nem altera uma produção real ativa.

do $$
begin
  if exists (
    select 1 from public.ciclos_producao
    where linha_id = 'ROS' and encerrado_em is null
      and coalesce((metadata->>'demo')::boolean, false) = false
  ) then
    raise exception 'Existe uma produção real ativa na linha ROS. Use um ambiente de teste.';
  end if;
  if not exists (select 1 from public.receitas where lower(produto) = 'rosca leite' and ativa) then
    raise exception 'Cadastre uma receita ativa para Rosca Leite antes de executar esta carga.';
  end if;
end $$;

insert into public.operadores(id,nome,turno,codigo_pin,matricula,ativo)
values
  ('00000000-0000-0000-0000-000000000201','Operador demonstração','A','8101','DEMO-OP-01',true),
  ('00000000-0000-0000-0000-000000000205','Técnico demonstração','A','8501','DEMO-TEC-01',true)
on conflict(id) do update set nome=excluded.nome, turno=excluded.turno, ativo=true;

-- Produção, higienização e subprocessos.
insert into public.ciclos_producao(
  id,linha_id,rg_id,produto,motivo_inicio,status,iniciado_por,iniciado_em,
  etapa_iniciada_em,producao_iniciada_em,producao_encerrada_em,encerrado_em,
  metadata,created_at,updated_at
)
values (
  md5('demo-dia-completo-rosca-2026-10-13')::uuid,'ROS',
  '00000000-0000-0000-0000-000000000303','Rosca Leite','Início semanal','encerrado',
  '00000000-0000-0000-0000-000000000205','2026-10-13 05:30-03','2026-10-13 05:30-03',
  '2026-10-13 06:10-03','2026-10-13 21:45-03','2026-10-13 21:45-03',
  jsonb_build_object('demo',true,'productionCode','DEMO-ROSCA-13102026'),
  '2026-10-13 05:30-03','2026-10-13 21:45-03'
)
on conflict(id) do update set status=excluded.status, producao_encerrada_em=excluded.producao_encerrada_em,
  encerrado_em=excluded.encerrado_em, metadata=excluded.metadata, updated_at=excluded.updated_at;

insert into public.higienizacao_rodadas(
  id,ciclo_id,numero,status,dados_operacao,dados_qualidade,executada_por,inspecionada_por,
  execucao_iniciada_em,enviada_inspecao_em,inspecao_iniciada_em,inspecao_encerrada_em,created_at
)
values (
  md5('demo-dia-completo-higiene')::uuid,md5('demo-dia-completo-rosca-2026-10-13')::uuid,1,'aprovada',
  jsonb_build_object('resultado','C','secoes',jsonb_build_array('AUTOMAÇÃO','CORTE A FIO','MASSEIRA','FORNO','SAÍDA DO FORNO','EMPACOTAMENTO / ENCAIXOTAMENTO')),
  jsonb_build_object('resultado','C','observacao','Higienização aprovada para início da produção.'),
  '00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000205',
  '2026-10-13 05:30-03','2026-10-13 05:52-03','2026-10-13 05:55-03','2026-10-13 06:05-03','2026-10-13 05:30-03'
)
on conflict(ciclo_id,numero) do update set status=excluded.status,dados_operacao=excluded.dados_operacao,dados_qualidade=excluded.dados_qualidade;

with processos(codigo,nome,ordem,equipamento) as (values
  ('automacao','Automação',1,'Refinador'),('masseira','Masseira',2,'Masseira'),
  ('corte_fio','Corte a fio',3,'Cortadora'),('forno','Forno',4,'Forno · 7 zonas'),
  ('empacotamento','Empacotamento',5,'4 empacotadoras'),('encaixotamento','Encaixotamento',6,'2 encaixotadeiras')
)
insert into public.producao_subprocessos(id,ciclo_id,codigo,nome,ordem,status,equipamento,iniciado_em,encerrado_em,estado_iniciado_em,metadata,created_at,updated_at)
select md5('demo-dia-completo-processo-'||codigo)::uuid,md5('demo-dia-completo-rosca-2026-10-13')::uuid,
  codigo,nome,ordem,'finalizado',equipamento,'2026-10-13 06:10-03','2026-10-13 21:45-03','2026-10-13 21:45-03','{"demo":true}'::jsonb,'2026-10-13 06:10-03','2026-10-13 21:45-03'
from processos
on conflict(ciclo_id,codigo) do update set status=excluded.status,encerrado_em=excluded.encerrado_em,updated_at=excluded.updated_at;

-- Lotes de automação e cinco bateladas que cobrem todo o turno.
with ciclo as (select md5('demo-dia-completo-rosca-2026-10-13')::uuid id)
insert into public.automacao_lotes(id,ciclo_id,insumo_id,lote_fornecedor,fornecedor,validade,iniciado_em,encerrado_em,operador_id,created_at)
select md5('demo-dia-completo-insumo-'||i.codigo)::uuid,ciclo.id,i.id,
  case i.codigo when 'FARINHA' then 'FAR-1310-01' else 'ACU-1310-01' end,
  case i.codigo when 'FARINHA' then 'Moinho Demonstração' else 'Usina Demonstração' end,
  date '2027-04-13','2026-10-13 05:45-03','2026-10-13 21:45-03','00000000-0000-0000-0000-000000000201','2026-10-13 05:45-03'
from ciclo join public.insumos i on i.codigo in ('FARINHA','ACUCAR')
on conflict(id) do update set lote_fornecedor=excluded.lote_fornecedor,fornecedor=excluded.fornecedor,validade=excluded.validade,encerrado_em=excluded.encerrado_em;

with receita as (select id from public.receitas where lower(produto)='rosca leite' and ativa order by versao desc limit 1),
bateladas(numero,inicio,fim) as (values
  (1,'2026-10-13 06:10-03'::timestamptz,'2026-10-13 09:10-03'::timestamptz),
  (2,'2026-10-13 09:10-03'::timestamptz,'2026-10-13 12:10-03'::timestamptz),
  (3,'2026-10-13 12:10-03'::timestamptz,'2026-10-13 15:10-03'::timestamptz),
  (4,'2026-10-13 15:10-03'::timestamptz,'2026-10-13 18:10-03'::timestamptz),
  (5,'2026-10-13 18:10-03'::timestamptz,'2026-10-13 21:45-03'::timestamptz)
)
insert into public.bateladas(id,ciclo_id,receita_id,numero,status,iniciada_em,pronta_em,enviada_tombador_em,consumo_iniciado_em,consumida_em,iniciada_por,pronta_por,enviada_tombador_por,consumida_por,observacao,created_at)
select md5('demo-dia-completo-batelada-'||b.numero)::uuid,md5('demo-dia-completo-rosca-2026-10-13')::uuid,r.id,b.numero,'enviada_tombador',
  b.inicio-interval '18 minutes',b.inicio-interval '4 minutes',b.inicio,b.inicio,b.fim,
  '00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000201',
  'Batelada fictícia para visualização','2026-10-13 05:55-03'
from bateladas b cross join receita r
on conflict(id) do update set status=excluded.status,consumo_iniciado_em=excluded.consumo_iniciado_em,consumida_em=excluded.consumida_em;

with receita as (select id from public.receitas where lower(produto)='rosca leite' and ativa order by versao desc limit 1)
insert into public.batelada_insumos(id,batelada_id,insumo_id,automacao_lote_id,lote_fornecedor,fornecedor,validade,quantidade_prevista,quantidade_utilizada,unidade,origem,registrado_em,operador_id)
select md5('demo-dia-completo-batelada-insumo-'||b.numero||'-'||i.codigo)::uuid,md5('demo-dia-completo-batelada-'||b.numero)::uuid,i.id,
  case when i.codigo in ('FARINHA','ACUCAR') then md5('demo-dia-completo-insumo-'||i.codigo)::uuid end,
  case i.codigo when 'FARINHA' then 'FAR-1310-01' when 'ACUCAR' then 'ACU-1310-01' else i.codigo||'-1310-01' end,
  case when i.codigo in ('FARINHA','ACUCAR') then 'Fornecedor demonstração' else 'Estoque interno' end,
  date '2027-04-13',ri.quantidade,ri.quantidade,ri.unidade,i.origem,'2026-10-13 06:00-03','00000000-0000-0000-0000-000000000201'
from generate_series(1,5) b(numero) cross join receita r
join public.receita_insumos ri on ri.receita_id=r.id join public.insumos i on i.id=ri.insumo_id
on conflict(id) do update set lote_fornecedor=excluded.lote_fornecedor,quantidade_utilizada=excluded.quantidade_utilizada;

-- Registros de Qualidade por hora, incluindo Controle, Avaliação, Processo e Foto.
insert into public.lotes(id,codigo,linha_id,data_producao,produto,metadata)
values (md5('demo-dia-completo-lote')::uuid,'DEMO-ROSCA-13102026','ROS',date '2026-10-13','Rosca Leite','{"demo":true}'::jsonb)
on conflict(codigo) do update set produto=excluded.produto,metadata=excluded.metadata;

with tipos(process_id,tipo,codigo) as (values
  ('00000000-0000-0000-0000-000000303003'::uuid,'produto_avaliacao','AVP'),
  ('00000000-0000-0000-0000-000000303004'::uuid,'processo','RGP'),
  ('00000000-0000-0000-0000-000000303005'::uuid,'fotografico','FOTO')
)
insert into public.registros(id,codigo,lote_id,rg_id,processo_id,operador_id,turno,motivo,status,data_registro,metadata)
select md5('demo-dia-completo-registro-'||t.tipo)::uuid,'DEMO-13102026-'||t.codigo,md5('demo-dia-completo-lote')::uuid,
  '00000000-0000-0000-0000-000000000303',t.process_id,'00000000-0000-0000-0000-000000000205','A','Demonstração','concluido','2026-10-13 06:15-03','{"demo":true}'::jsonb
from tipos t
on conflict(codigo) do update set status=excluded.status,metadata=excluded.metadata;

with slots as (select make_timestamptz(2026,10,13,h,0,0,'America/Sao_Paulo') ts,h from generate_series(7,21) h),
tipos(process_id,tipo) as (values
  ('00000000-0000-0000-0000-000000303003'::uuid,'produto_avaliacao'),
  ('00000000-0000-0000-0000-000000303004'::uuid,'processo')
)
insert into public.preenchimentos(id,registro_id,processo_id,operador_id,contexto_tipo,horario,valores,status,preenchido_em,ciclo_id,chave_slot)
select md5('demo-dia-completo-qualidade-'||t.tipo||'-'||s.h)::uuid,md5('demo-dia-completo-registro-'||t.tipo)::uuid,t.process_id,
  '00000000-0000-0000-0000-000000000205',t.tipo,make_time(s.h,0,0),
  case when t.tipo='produto_avaliacao' then jsonb_build_object('apontamentos',jsonb_build_array(
    jsonb_build_object('item','% UMIDADE PRODUTO FINAL','resultado',round((3.0+(s.h%4)*0.15)::numeric,2),'unidade','%'),
    jsonb_build_object('item','pH BISCOITO','resultado',round((6.6+(s.h%3)*0.04)::numeric,2),'unidade','pH'),
    jsonb_build_object('item','TEMPERATURA DE ENVASE (ºC)','resultado',31+(s.h%3),'unidade','ºC'),
    jsonb_build_object('item','BRIX AÇÚCAR INVERTIDO (°Bx)','resultado',74+(s.h%2),'unidade','°Bx')))
  else jsonb_build_object('avaliacoes',jsonb_build_array(jsonb_build_object('item','Controle do processo','resultado','C')))
  end,'concluido',s.ts+interval '8 minutes',md5('demo-dia-completo-rosca-2026-10-13')::uuid,t.tipo||':'||s.h
from slots s cross join tipos t
on conflict(id) do update set valores=excluded.valores,preenchido_em=excluded.preenchido_em,status=excluded.status;

-- Fotos horárias com o lote DddmmNN, quatro máquinas e a batelada exata em consumo.
with slots as (select make_timestamptz(2026,10,13,h,0,0,'America/Sao_Paulo') ts,h from generate_series(7,21) h),
batch_data as (
 select b.id,b.numero,b.consumo_iniciado_em,b.consumida_em,
   jsonb_agg(jsonb_build_object('insumo',i.nome,'lote',bi.lote_fornecedor,'fornecedor',bi.fornecedor,'validade',bi.validade,'quantidade',bi.quantidade_utilizada,'unidade',bi.unidade) order by i.nome) insumos
 from public.bateladas b join public.batelada_insumos bi on bi.batelada_id=b.id join public.insumos i on i.id=bi.insumo_id
 where b.ciclo_id=md5('demo-dia-completo-rosca-2026-10-13')::uuid
 group by b.id,b.numero,b.consumo_iniciado_em,b.consumida_em
), traces as (
 select s.h,s.ts,jsonb_agg(jsonb_build_object(
   'lote','D'||to_char(date '2026-10-13','DDMM')||lpad(m::text,2,'0'),'maquina',lpad(m::text,2,'0'),
   'data_producao','13/10/2026','validade','13/06/2027','horario',to_char(s.ts,'HH24:MI'),'turno',case when s.h<16 then 'A' else 'B' end,
   'responsavel','Técnico demonstração','horario_referencia',to_char(s.ts,'HH24:MI'),
   'bateladas',jsonb_build_array(jsonb_build_object('id',b.id,'numero',b.numero,'consumo_iniciado_em',b.consumo_iniciado_em,'consumida_em',b.consumida_em,'insumos',b.insumos))
 ) order by m) rastreabilidades
 from slots s join batch_data b on s.ts>=b.consumo_iniciado_em and s.ts<b.consumida_em cross join generate_series(1,4) m
 group by s.h,s.ts
)
insert into public.preenchimentos(id,registro_id,processo_id,operador_id,contexto_tipo,horario,valores,status,preenchido_em,ciclo_id,chave_slot)
select md5('demo-dia-completo-foto-'||h)::uuid,md5('demo-dia-completo-registro-fotografico')::uuid,'00000000-0000-0000-0000-000000303005',
 '00000000-0000-0000-0000-000000000205','fotografico',make_time(h,0,0),
 jsonb_build_object('fotografias',jsonb_build_array(jsonb_build_object('horario',to_char(ts,'HH24:MI'),'nome','rosca-'||to_char(ts,'HH24MI')||'.jpg','tipo','image/jpeg','imagem','/images/fabrica-isometrica-cicopal.png','rastreabilidades',rastreabilidades,'rastreabilidade',rastreabilidades->0))),
 'concluido',ts+interval '5 minutes',md5('demo-dia-completo-rosca-2026-10-13')::uuid,'fotografico:'||h
from traces
on conflict(id) do update set valores=excluded.valores,preenchido_em=excluded.preenchido_em;

-- Apontamentos operacionais completos para os gráficos de supervisão.
with slots as (select make_timestamptz(2026,10,13,h,0,0,'America/Sao_Paulo') ts,h from generate_series(7,21) h),
processos(codigo) as (values ('corte_fio'),('forno'),('empacotamento'),('encaixotamento'))
insert into public.subprocesso_registros(id,subprocesso_id,ciclo_id,chave_slot,horario_referencia,horario_previsto,tipo,janela_indice,janela_inicio,janela_fim,valores,status_prazo,preenchido_em)
select md5('demo-dia-completo-apontamento-'||p.codigo||'-'||s.h)::uuid,md5('demo-dia-completo-processo-'||p.codigo)::uuid,
 md5('demo-dia-completo-rosca-2026-10-13')::uuid,'dia:'||s.h,s.ts,s.ts,'horario',s.h-7,s.ts,s.ts+interval '1 hour',
 case p.codigo
  when 'corte_fio' then jsonb_build_object('peso_lado_operacional',89+(s.h%3),'peso_lado_nao_operacional',88+(s.h%4),'velocidade_linha_kg_h',650+(s.h%5)*8)
  when 'forno' then jsonb_build_object('zona_1_setpoint',180,'zona_1_real',179+(s.h%2),'zona_2_setpoint',185,'zona_2_real',184+(s.h%3),'zona_3_setpoint',190,'zona_3_real',189+(s.h%2),'zona_4_setpoint',195,'zona_4_real',194+(s.h%3),'zona_5_setpoint',190,'zona_5_real',189+(s.h%2),'zona_6_setpoint',185,'zona_6_real',184+(s.h%2),'zona_7_setpoint',175,'zona_7_real',174+(s.h%2))
  when 'empacotamento' then jsonb_build_object('maq_1_pacotes_min',48+(s.h%4),'maq_1_sobrepeso',1.8,'maq_2_pacotes_min',43+(s.h%3),'maq_2_sobrepeso',2.1,'maq_3_pacotes_min',40+(s.h%3),'maq_3_sobrepeso',2.5,'maq_4_pacotes_min',38+(s.h%2),'maq_4_sobrepeso',2.2)
  else jsonb_build_object('maq_1_caixas_min',4+(s.h%2),'maq_2_caixas_min',4+(s.h%3),'maq_3_caixas_min',3+(s.h%2),'maq_4_caixas_min',3+(s.h%3)) end,
 'no_prazo',s.ts+interval '9 minutes'
from slots s cross join processos p
on conflict(id) do update set valores=excluded.valores,preenchido_em=excluded.preenchido_em;

-- Uma ocorrência resolvida para alimentar os indicadores de paradas e NCs.
insert into public.producao_interrupcoes(id,ciclo_id,subprocesso_origem_id,classificacao,motivo,iniciada_em,encerrada_em,observacao_retomada,created_at)
values (md5('demo-dia-completo-interrupcao')::uuid,md5('demo-dia-completo-rosca-2026-10-13')::uuid,md5('demo-dia-completo-processo-empacotamento')::uuid,'pausa','Ajuste de selagem na máquina 02','2026-10-13 14:18-03','2026-10-13 14:31-03','Selagem normalizada','2026-10-13 14:18-03')
on conflict(id) do update set encerrada_em=excluded.encerrada_em,observacao_retomada=excluded.observacao_retomada;

insert into public.ciclo_nao_conformidades(id,ciclo_id,operador_id,produto,quantidade,descricao,causa,acao_tomada,interrompeu_producao,status,registrada_em,metadata)
values (md5('demo-dia-completo-nc')::uuid,md5('demo-dia-completo-rosca-2026-10-13')::uuid,'00000000-0000-0000-0000-000000000205','Rosca Leite','12 pacotes','Selagem incompleta','Mordente da máquina 02 desalinhado','Produto segregado e mordente ajustado',false,'resolvida','2026-10-13 14:20-03',jsonb_build_object('demo',true,'contexto','empacotamento'))
on conflict(id) do update set status=excluded.status,acao_tomada=excluded.acao_tomada;

insert into public.eventos_ciclo(id,ciclo_id,tipo,descricao,operador_id,ocorrido_em,dados)
values
 (md5('demo-dia-completo-evento-inicio')::uuid,md5('demo-dia-completo-rosca-2026-10-13')::uuid,'producao_iniciada','Primeira massa enviada ao tombador','00000000-0000-0000-0000-000000000201','2026-10-13 06:10-03','{"demo":true}'::jsonb),
 (md5('demo-dia-completo-evento-fim')::uuid,md5('demo-dia-completo-rosca-2026-10-13')::uuid,'producao_encerrada','Produção do dia encerrada','00000000-0000-0000-0000-000000000205','2026-10-13 21:45-03','{"demo":true}'::jsonb)
on conflict(id) do update set descricao=excluded.descricao,ocorrido_em=excluded.ocorrido_em;
