-- DEMONSTRAÇÃO ATIVA · Rosca Leite.
-- Inicia uma produção completa, com dados operacionais e de qualidade já preenchidos.
-- A produção permanece aberta para acompanhamento no sistema.

begin;

-- Garante que exista somente uma produção ativa na linha Rosca.
update public.ciclos_producao
set status = 'encerrado', encerrado_em = now(), producao_encerrada_em = now(), updated_at = now()
where linha_id = 'ROS' and encerrado_em is null;

with dados as (
  select md5('demo-rosca-monitor-' || current_date::text)::uuid as ciclo_id,
         now() - interval '9 hours' as inicio
)
insert into public.ciclos_producao(
  id, linha_id, rg_id, produto, motivo_inicio, status, iniciado_por, iniciado_em,
  etapa_iniciada_em, producao_iniciada_em, metadata, created_at, updated_at
)
select ciclo_id, 'ROS', '00000000-0000-0000-0000-000000000303', 'Rosca Leite',
  'Acompanhamento demonstrativo', 'produzindo', '00000000-0000-0000-0000-000000000201',
  inicio, inicio, inicio + interval '40 minutes',
  jsonb_build_object('demo', true, 'monitoramento', true, 'productionCode', 'DEMO-ROSCA-ATIVA-' || to_char(current_date,'YYYYMMDD')),
  inicio, now()
from dados
on conflict(id) do update set status = excluded.status, encerrado_em = null,
  producao_encerrada_em = null, updated_at = excluded.updated_at, metadata = excluded.metadata;

with dados as (select md5('demo-rosca-monitor-' || current_date::text)::uuid ciclo_id)
insert into public.higienizacao_rodadas(
  id,ciclo_id,numero,status,dados_operacao,dados_qualidade,executada_por,inspecionada_por,
  execucao_iniciada_em,enviada_inspecao_em,inspecao_iniciada_em,inspecao_encerrada_em,created_at
)
select md5('demo-rosca-monitor-higiene-' || current_date::text)::uuid,ciclo_id,1,'aprovada',
  jsonb_build_object('resultado','C','secoes',jsonb_build_array('AUTOMAÇÃO','CORTE A FIO','MASSEIRA','FORNO','SAÍDA DO FORNO','EMPACOTAMENTO / ENCAIXOTAMENTO')),
  jsonb_build_object('resultado','C','observacao','Higienização aprovada para a produção demonstrativa.'),
  '00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000205',
  now()-interval '9 hours',now()-interval '8 hours 40 minutes',now()-interval '8 hours 35 minutes',now()-interval '8 hours 25 minutes',now()-interval '9 hours'
from dados
on conflict(ciclo_id,numero) do update set status=excluded.status,dados_operacao=excluded.dados_operacao,dados_qualidade=excluded.dados_qualidade;

with dados as (select md5('demo-rosca-monitor-' || current_date::text)::uuid ciclo_id),
processos(codigo,nome,ordem,equipamento,status) as (values
  ('automacao','Automação',1,'Refinador','finalizado'),('masseira','Masseira',2,'Masseira','finalizado'),
  ('corte_fio','Corte a fio',3,'Cortadora','operando'),('forno','Forno',4,'Forno · 7 zonas','operando'),
  ('empacotamento','Empacotamento',5,'4 empacotadoras','operando'),('encaixotamento','Encaixotamento',6,'4 encaixotadeiras','operando')
)
insert into public.producao_subprocessos(id,ciclo_id,codigo,nome,ordem,status,equipamento,iniciado_em,estado_iniciado_em,metadata,created_at,updated_at)
select md5('demo-rosca-monitor-processo-'||p.codigo||current_date::text)::uuid,d.ciclo_id,p.codigo,p.nome,p.ordem,p.status,p.equipamento,
  now()-interval '8 hours',now()-interval '8 hours',jsonb_build_object('demo',true),now()-interval '8 hours',now()
from dados d cross join processos p
on conflict(ciclo_id,codigo) do update set status=excluded.status,encerrado_em=null,updated_at=excluded.updated_at;

-- Insumos e bateladas já realizados, com a terceira massa em consumo.
with dados as (select md5('demo-rosca-monitor-' || current_date::text)::uuid ciclo_id)
insert into public.automacao_lotes(id,ciclo_id,insumo_id,lote_fornecedor,fornecedor,validade,iniciado_em,operador_id,created_at)
select md5('demo-rosca-monitor-insumo-'||i.codigo||current_date::text)::uuid,d.ciclo_id,i.id,
  case when i.codigo='FARINHA' then 'FAR-MON-'||to_char(current_date,'DDMM') else 'ACU-MON-'||to_char(current_date,'DDMM') end,
  'Fornecedor demonstração',current_date + interval '180 days',now()-interval '8 hours','00000000-0000-0000-0000-000000000201',now()-interval '8 hours'
from dados d join public.insumos i on i.codigo in ('FARINHA','ACUCAR')
on conflict(id) do update set encerrado_em=null,lote_fornecedor=excluded.lote_fornecedor;

with dados as (select md5('demo-rosca-monitor-' || current_date::text)::uuid ciclo_id),
receita as (select id from public.receitas where lower(produto)='rosca leite' and ativa order by versao desc limit 1),
batches(numero,status,inicio,fim) as (values
 (1,'enviada_tombador',now()-interval '8 hours',now()-interval '5 hours'),
 (2,'enviada_tombador',now()-interval '5 hours',now()-interval '2 hours'),
 (3,'em_consumo',now()-interval '2 hours',null::timestamptz)
)
insert into public.bateladas(id,ciclo_id,receita_id,numero,status,iniciada_em,pronta_em,enviada_tombador_em,consumo_iniciado_em,consumida_em,iniciada_por,pronta_por,enviada_tombador_por,consumida_por,observacao,created_at)
select md5('demo-rosca-monitor-batelada-'||b.numero||current_date::text)::uuid,d.ciclo_id,r.id,b.numero,b.status,b.inicio,b.inicio+interval '25 minutes',b.inicio+interval '40 minutes',b.inicio+interval '40 minutes',b.fim,
 '00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000201','Batelada demonstrativa',b.inicio
from dados d cross join receita r cross join batches b
on conflict(ciclo_id,numero) do update set status=excluded.status,consumo_iniciado_em=excluded.consumo_iniciado_em,consumida_em=excluded.consumida_em;

with dados as (select md5('demo-rosca-monitor-' || current_date::text)::uuid ciclo_id),
receita as (select id from public.receitas where lower(produto)='rosca leite' and ativa order by versao desc limit 1)
insert into public.batelada_insumos(id,batelada_id,insumo_id,automacao_lote_id,lote_fornecedor,fornecedor,validade,quantidade_prevista,quantidade_utilizada,unidade,origem,registrado_em,operador_id)
select md5('demo-rosca-monitor-batelada-insumo-'||b.numero||'-'||i.codigo||current_date::text)::uuid,b.id,i.id,
  case when i.codigo in ('FARINHA','ACUCAR') then md5('demo-rosca-monitor-insumo-'||i.codigo||current_date::text)::uuid else null end,
  i.codigo||'-MON-'||to_char(current_date,'DDMM'),'Fornecedor demonstração',current_date+interval '180 days',ri.quantidade,ri.quantidade,ri.unidade,i.origem,b.iniciada_em,'00000000-0000-0000-0000-000000000201'
from dados d join public.bateladas b on b.ciclo_id=d.ciclo_id cross join receita r
join public.receita_insumos ri on ri.receita_id=r.id join public.insumos i on i.id=ri.insumo_id
on conflict(batelada_id,insumo_id,lote_fornecedor) do update set quantidade_utilizada=excluded.quantidade_utilizada;

-- Registros de qualidade: liberação inicial e controles hora a hora completos.
insert into public.lotes(id,codigo,linha_id,data_producao,produto,metadata)
values (md5('demo-rosca-monitor-lote-'||current_date::text)::uuid,'DEMO-ROSCA-ATIVA-'||to_char(current_date,'YYYYMMDD'),'ROS',current_date,'Rosca Leite',jsonb_build_object('demo',true,'monitoramento',true))
on conflict(linha_id,data_producao) do update set produto=excluded.produto,metadata=excluded.metadata;

with tipos(process_id,tipo,codigo) as (values
 ('00000000-0000-0000-0000-000000303001'::uuid,'higienizacao','HIG'),
 ('00000000-0000-0000-0000-000000303002'::uuid,'produto_liberacao','LIBP'),
 ('00000000-0000-0000-0000-000000303002'::uuid,'controle_liberacao','CTRLIB'),
 ('00000000-0000-0000-0000-000000303003'::uuid,'produto_avaliacao','AVP'),
 ('00000000-0000-0000-0000-000000303004'::uuid,'processo','RGP'),
 ('00000000-0000-0000-0000-000000303005'::uuid,'fotografico','REGF')
)
insert into public.registros(id,codigo,lote_id,rg_id,processo_id,operador_id,turno,motivo,status,data_registro,metadata)
select md5('demo-rosca-monitor-registro-'||t.tipo||current_date::text)::uuid,
  'DEMO-ROSCA-ATIVA-'||to_char(current_date,'YYYYMMDD')||'-'||t.codigo,
 (select id from public.lotes where linha_id='ROS' and data_producao=current_date),'00000000-0000-0000-0000-000000000303',t.process_id,'00000000-0000-0000-0000-000000000205','A','Monitoramento','concluido',now(),jsonb_build_object('demo',true)
from tipos t
on conflict(id) do update set codigo=excluded.codigo,status=excluded.status,metadata=excluded.metadata,data_registro=excluded.data_registro;

with dados as (select md5('demo-rosca-monitor-' || current_date::text)::uuid ciclo_id)
insert into public.preenchimentos(id,registro_id,processo_id,operador_id,contexto_tipo,horario,valores,status,preenchido_em,ciclo_id,chave_slot)
select md5('demo-rosca-monitor-higienizacao-'||current_date::text)::uuid,
  md5('demo-rosca-monitor-registro-higienizacao'||current_date::text)::uuid,
  '00000000-0000-0000-0000-000000303001','00000000-0000-0000-0000-000000000201','higienizacao',
  (now()-interval '8 hours 25 minutes')::time,
  jsonb_build_object('resultado','C','observacao','Higienização aprovada para início da produção.'),
  'concluido',now()-interval '8 hours 25 minutes',ciclo_id,'higienizacao:ciclo'
from dados
on conflict(id) do update set valores=excluded.valores,status=excluded.status,preenchido_em=excluded.preenchido_em;

with dados as (select md5('demo-rosca-monitor-' || current_date::text)::uuid ciclo_id)
insert into public.preenchimentos(id,registro_id,processo_id,operador_id,contexto_tipo,horario,valores,status,preenchido_em,ciclo_id,chave_slot)
select md5('demo-rosca-monitor-liberacao-'||current_date::text)::uuid,
  md5('demo-rosca-monitor-registro-produto_liberacao'||current_date::text)::uuid,
  '00000000-0000-0000-0000-000000303002','00000000-0000-0000-0000-000000000205','produto_liberacao',
  (now()-interval '8 hours')::time,
  jsonb_build_object('resultado','C','observacao','Produto liberado pela Qualidade para início da produção.'),
  'concluido',now()-interval '8 hours',ciclo_id,'produto_liberacao:inicial'
from dados
on conflict(id) do update set valores=excluded.valores,status=excluded.status,preenchido_em=excluded.preenchido_em;

with dados as (select md5('demo-rosca-monitor-' || current_date::text)::uuid ciclo_id),
slots as (select date_trunc('hour',now())-make_interval(hours => h) ts,h from generate_series(0,8) h),
tipos(process_id,tipo) as (values
 ('00000000-0000-0000-0000-000000303002'::uuid,'controle_liberacao'),('00000000-0000-0000-0000-000000303003'::uuid,'produto_avaliacao'),
 ('00000000-0000-0000-0000-000000303004'::uuid,'processo')
)
insert into public.preenchimentos(id,registro_id,processo_id,operador_id,contexto_tipo,horario,valores,status,preenchido_em,ciclo_id,chave_slot)
select md5('demo-rosca-monitor-'||t.tipo||'-'||s.h||current_date::text)::uuid,md5('demo-rosca-monitor-registro-'||t.tipo||current_date::text)::uuid,t.process_id,
 '00000000-0000-0000-0000-000000000205',t.tipo,s.ts::time,
 case t.tipo
  when 'controle_liberacao' then jsonb_build_object('maquinas',jsonb_build_array(jsonb_build_object('maquina',1,'aspecto_visual_cor','C','sabor','C','textura','C','dimensional','C'),jsonb_build_object('maquina',2,'aspecto_visual_cor','C','sabor','C','textura','C','dimensional','C'),jsonb_build_object('maquina',3,'aspecto_visual_cor','C','sabor','C','textura','C','dimensional','C'),jsonb_build_object('maquina',4,'aspecto_visual_cor','C','sabor','C','textura','C','dimensional','C')))
  when 'produto_avaliacao' then jsonb_build_object('apontamentos',jsonb_build_array(jsonb_build_object('item','% UMIDADE PRODUTO FINAL','resultado',3.2,'unidade','%'),jsonb_build_object('item','pH BISCOITO','resultado',6.7,'unidade','pH'),jsonb_build_object('item','TEMPERATURA DE ENVASE (ºC)','resultado',32,'unidade','ºC'),jsonb_build_object('item','BRIX AÇÚCAR INVERTIDO (°Bx)','resultado',74,'unidade','°Bx')))
  else jsonb_build_object('avaliacoes',jsonb_build_array(jsonb_build_object('item','Controle do processo','resultado','C')))
 end,
 'concluido',s.ts+interval '8 minutes',d.ciclo_id,t.tipo||':'||to_char(s.ts,'YYYYMMDDHH24')
from dados d cross join slots s cross join tipos t
on conflict(id) do update set valores=excluded.valores,status=excluded.status,preenchido_em=excluded.preenchido_em;

-- Registro fotográfico separado para manter a carga simples e auditável.
with dados as (select md5('demo-rosca-monitor-' || current_date::text)::uuid ciclo_id),
slots as (select date_trunc('hour',now())-make_interval(hours => h) ts,h from generate_series(0,8) h)
insert into public.preenchimentos(id,registro_id,processo_id,operador_id,contexto_tipo,horario,valores,status,preenchido_em,ciclo_id,chave_slot)
select md5('demo-rosca-monitor-foto-'||s.h||current_date::text)::uuid,
  md5('demo-rosca-monitor-registro-fotografico'||current_date::text)::uuid,
  '00000000-0000-0000-0000-000000303005','00000000-0000-0000-0000-000000000205','fotografico',s.ts::time,
  jsonb_build_object('fotografias',jsonb_build_array(jsonb_build_object(
    'horario',to_char(s.ts,'HH24:MI'),'nome','rosca-monitor-'||to_char(s.ts,'HH24MI')||'.jpg','tipo','image/jpeg',
    'imagem','/images/fabrica-isometrica-cicopal.png','rastreabilidades',jsonb_build_array(
      jsonb_build_object('lote','D'||to_char(current_date,'DDMM')||'01','maquina','01','data_producao',to_char(current_date,'DD/MM/YYYY'),'validade',to_char(current_date+interval '8 months','DD/MM/YYYY'),'horario',to_char(s.ts,'HH24:MI'),'turno','A'),
      jsonb_build_object('lote','D'||to_char(current_date,'DDMM')||'02','maquina','02','data_producao',to_char(current_date,'DD/MM/YYYY'),'validade',to_char(current_date+interval '8 months','DD/MM/YYYY'),'horario',to_char(s.ts,'HH24:MI'),'turno','A')
    )
  ))),'concluido',s.ts+interval '8 minutes',d.ciclo_id,'fotografico:'||to_char(s.ts,'YYYYMMDDHH24')
from dados d cross join slots s
on conflict(id) do update set valores=excluded.valores,status=excluded.status,preenchido_em=excluded.preenchido_em;

with dados as (select md5('demo-rosca-monitor-' || current_date::text)::uuid ciclo_id),
slots as (select date_trunc('hour',now())-make_interval(hours => h) ts,h from generate_series(0,8) h),
processos(codigo) as (values ('corte_fio'),('forno'),('empacotamento'),('encaixotamento'))
insert into public.subprocesso_registros(id,subprocesso_id,ciclo_id,chave_slot,horario_referencia,horario_previsto,tipo,janela_indice,janela_inicio,janela_fim,valores,status_prazo,preenchido_em)
select md5('demo-rosca-monitor-apontamento-'||p.codigo||'-'||s.h||current_date::text)::uuid,sp.id,d.ciclo_id,'monitor:'||to_char(s.ts,'YYYYMMDDHH24'),s.ts,s.ts,'horario',s.h,s.ts,s.ts+interval '1 hour',
 case p.codigo when 'corte_fio' then jsonb_build_object('peso_lado_operacional',90,'peso_lado_nao_operacional',89,'velocidade_linha_kg_h',670)
 when 'forno' then jsonb_build_object('zona_1_setpoint',180,'zona_1_real',180,'zona_2_setpoint',185,'zona_2_real',185,'zona_3_setpoint',190,'zona_3_real',190,'zona_4_setpoint',195,'zona_4_real',195,'zona_5_setpoint',190,'zona_5_real',190,'zona_6_setpoint',185,'zona_6_real',185,'zona_7_setpoint',175,'zona_7_real',175)
 when 'empacotamento' then jsonb_build_object('maq_1_pacotes_min',49,'maq_1_sobrepeso',1.8,'maq_2_pacotes_min',45,'maq_2_sobrepeso',2.0,'maq_3_pacotes_min',42,'maq_3_sobrepeso',2.2,'maq_4_pacotes_min',40,'maq_4_sobrepeso',2.1)
 else jsonb_build_object('maq_1_caixas_min',4,'maq_2_caixas_min',4,'maq_3_caixas_min',3,'maq_4_caixas_min',3) end,
 'no_prazo',s.ts+interval '9 minutes'
from dados d join public.producao_subprocessos sp on sp.ciclo_id=d.ciclo_id join processos p on p.codigo=sp.codigo cross join slots s
on conflict(subprocesso_id,chave_slot) do update set valores=excluded.valores,preenchido_em=excluded.preenchido_em;

with dados as (select md5('demo-rosca-monitor-' || current_date::text)::uuid ciclo_id)
insert into public.eventos_ciclo(id,ciclo_id,tipo,descricao,operador_id,ocorrido_em,dados)
select md5('demo-rosca-monitor-evento-'||current_date::text)::uuid,ciclo_id,'producao_iniciada','Produção demonstrativa iniciada e mantida em andamento','00000000-0000-0000-0000-000000000201',now()-interval '8 hours',jsonb_build_object('demo',true)
from dados
on conflict(id) do update set ocorrido_em=excluded.ocorrido_em,descricao=excluded.descricao;

commit;
