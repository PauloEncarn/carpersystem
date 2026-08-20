-- DADOS FICTÍCIOS: semana de 10 a 14/08/2026.
-- Requer as migrations 20260813 e 20260814. Seguro para reexecução.
create table if not exists public._seed_demo_cycles_20260814(day date primary key, product text, previous_product text);
truncate table public._seed_demo_cycles_20260814;
insert into public._seed_demo_cycles_20260814 values
 ('2026-08-10','Rosca Leite',null),('2026-08-11','Rosca Coco','Rosca Leite'),
 ('2026-08-12','Rosca Chocolate','Rosca Coco'),('2026-08-13','Rosca Leite','Rosca Chocolate'),
 ('2026-08-14','Rosca Coco','Rosca Leite');

insert into public.ciclos_producao(id,linha_id,rg_id,produto,produto_anterior,motivo_inicio,status,iniciado_em,etapa_iniciada_em,producao_iniciada_em,producao_encerrada_em,encerrado_em,metadata,created_at,updated_at)
select md5('demo-cycle-'||day)::uuid,'ROS','00000000-0000-0000-0000-000000000303',product,previous_product,
 case when previous_product is null then 'Início semanal' else 'Troca de produto' end,'encerrado',
 day+time '05:35',day+time '05:35',day+time '06:00',day+time '14:00',day+time '14:00',
 jsonb_build_object('demo',true,'productionCode','DEMO-'||upper(replace(product,'Rosca ',''))||'-'||to_char(day,'DDMMYYYY')),
 day+time '05:35',day+time '14:00' from public._seed_demo_cycles_20260814
on conflict(id) do update set produto=excluded.produto,metadata=excluded.metadata;

with processes(code,name,ord,equipment) as (values
 ('automacao','Automação',1,'Refinador'),('masseira','Masseira',2,'Masseira'),('corte_fio','Corte a fio',3,'Cortadora'),
 ('forno','Forno',4,'Forno · 7 zonas'),('detector_metal','Detecção de metais',5,'Detector'),
 ('empacotamento','Empacotamento',6,'4 empacotadoras'),('encaixotamento','Encaixotamento',7,'Final da linha'))
insert into public.producao_subprocessos(id,ciclo_id,codigo,nome,ordem,status,equipamento,iniciado_em,encerrado_em,estado_iniciado_em,metadata,created_at,updated_at)
select md5('demo-process-'||d.day||'-'||p.code)::uuid,md5('demo-cycle-'||d.day)::uuid,p.code,p.name,p.ord,'finalizado',p.equipment,d.day+time '06:00',d.day+time '14:00',d.day+time '14:00','{"demo":true}',d.day+time '06:00',d.day+time '14:00'
from public._seed_demo_cycles_20260814 d cross join processes p on conflict(ciclo_id,codigo) do nothing;

-- Automação: Farinha E Açúcar são registrados juntos para cada produção.
insert into public.automacao_lotes(id,ciclo_id,insumo_id,lote_fornecedor,fornecedor,validade,iniciado_em,encerrado_em,created_at)
select md5('demo-lot-'||d.day||'-'||i.codigo)::uuid,md5('demo-cycle-'||d.day)::uuid,i.id,
 case i.codigo when 'FARINHA' then 'FAR-'||to_char(d.day,'DDMM')||'-A' else 'ACU-'||to_char(d.day,'DDMM')||'-B' end,
 case i.codigo when 'FARINHA' then 'Moinho Modelo' else 'Usina Modelo' end,
 d.day+case i.codigo when 'FARINHA' then 120 else 180 end,d.day+time '05:45',d.day+time '14:00',d.day+time '05:45'
from public._seed_demo_cycles_20260814 d join public.insumos i on i.codigo in ('FARINHA','ACUCAR')
on conflict(id) do update set lote_fornecedor=excluded.lote_fornecedor,validade=excluded.validade;

insert into public.bateladas(id,ciclo_id,receita_id,numero,status,iniciada_em,finalizada_em,observacao,created_at)
select md5('demo-batch-'||d.day)::uuid,md5('demo-cycle-'||d.day)::uuid,r.id,1,'finalizada',d.day+time '05:50',d.day+time '06:12','Batelada fictícia de demonstração',d.day+time '05:50'
from public._seed_demo_cycles_20260814 d join public.receitas r on r.produto=d.product and r.versao=1
on conflict(id) do update set observacao=excluded.observacao;

insert into public.batelada_insumos(id,batelada_id,insumo_id,automacao_lote_id,lote_fornecedor,fornecedor,validade,quantidade_prevista,quantidade_utilizada,unidade,origem,registrado_em)
select md5('demo-batch-input-'||d.day||'-'||i.codigo)::uuid,md5('demo-batch-'||d.day)::uuid,i.id,
 case when i.origem='automacao' then md5('demo-lot-'||d.day||'-'||i.codigo)::uuid end,
 case when i.codigo='FARINHA' then 'FAR-'||to_char(d.day,'DDMM')||'-A' when i.codigo='ACUCAR' then 'ACU-'||to_char(d.day,'DDMM')||'-B' else left(i.codigo,3)||'-'||to_char(d.day,'DDMM')||'-01' end,
 case when i.origem='automacao' then case i.codigo when 'FARINHA' then 'Moinho Modelo' else 'Usina Modelo' end else 'Estoque interno' end,
 d.day+180,ri.quantidade,ri.quantidade*(0.98+(extract(day from d.day)::integer%3)*0.01),ri.unidade,i.origem,d.day+time '05:55'
from public._seed_demo_cycles_20260814 d join public.receitas r on r.produto=d.product and r.versao=1 join public.receita_insumos ri on ri.receita_id=r.id join public.insumos i on i.id=ri.insumo_id
on conflict(id) do update set quantidade_utilizada=excluded.quantidade_utilizada;

insert into public.empacotamento_configuracoes(id,ciclo_id,maquina,ativa,gramatura,pacotes_por_caixa,vigente_desde,vigente_ate)
select md5('demo-packer-'||d.day||'-'||m)::uuid,md5('demo-cycle-'||d.day)::uuid,m,m<=3,
 case when m=1 then 90 when m in (2,3) then 600 end,case when m=1 then 40 when m in (2,3) then 12 end,d.day+time '06:00',d.day+time '14:00'
from public._seed_demo_cycles_20260814 d cross join generate_series(1,4) m on conflict(id) do nothing;

-- Três horários por dia. horario_previsto é a referência; preenchido_em simula atrasos reais.
with hourly as (select d.*,h from public._seed_demo_cycles_20260814 d cross join generate_series(7,13,3) h), proc as (
 select * from (values ('corte_fio'),('forno'),('detector_metal'),('empacotamento'),('encaixotamento')) x(code))
insert into public.subprocesso_registros(id,subprocesso_id,ciclo_id,chave_slot,horario_referencia,horario_previsto,tipo,janela_indice,janela_inicio,janela_fim,valores,batelada_id,status_prazo,preenchido_em)
select md5('demo-record-'||x.day||'-'||p.code||'-'||x.h)::uuid,md5('demo-process-'||x.day||'-'||p.code)::uuid,md5('demo-cycle-'||x.day)::uuid,
 'demo:'||x.h,x.day+make_interval(hours=>x.h),x.day+make_interval(hours=>x.h),'horario',(x.h-7)/3,x.day+make_interval(hours=>x.h),x.day+make_interval(hours=>x.h+1),
 case p.code
  when 'corte_fio' then jsonb_build_object('peso_10_lado_operacional',90.2,'peso_10_lado_nao_operacional',89.7,'umidade',4.2+(x.h%3)*0.2,'cortes_hora',7200+(x.h*35))
  when 'forno' then jsonb_build_object('velocidade_esteira',18+(x.h%2),'velocidade_linha',20+(x.h%2),'umidade',3.8+(x.h%3)*0.3,'zona_1_setpoint',180,'zona_1_real',179+(x.h%3),'zona_2_setpoint',185,'zona_2_real',184+(x.h%2),'zona_3_setpoint',190,'zona_3_real',189,'zona_4_setpoint',195,'zona_4_real',194+(x.h%2),'zona_5_setpoint',190,'zona_5_real',191,'zona_6_setpoint',185,'zona_6_real',184,'zona_7_setpoint',175,'zona_7_real',176)
  when 'detector_metal' then jsonb_build_object('ferroso','C','nao_ferroso','C','inox','C')
  when 'empacotamento' then jsonb_build_object('maq_1_velocidade_esteira',22,'maq_1_pacotes_min',48+(x.h%3),'maq_1_sobrepeso',1.8,'maq_2_velocidade_esteira',19,'maq_2_pacotes_min',24+(x.h%2),'maq_2_sobrepeso',3.2,'maq_3_velocidade_esteira',19,'maq_3_pacotes_min',23+(x.h%2),'maq_3_sobrepeso',3.0,'maq_4_velocidade_esteira',0,'maq_4_pacotes_min',0,'maq_4_sobrepeso',0)
  else jsonb_build_object('caixas_min',1.85+(x.h%3)*0.05) end,
 md5('demo-batch-'||x.day)::uuid,case when x.h=10 then 'atrasado' else 'no_prazo' end,
 x.day+make_interval(hours=>x.h,mins=>case when x.h=10 then 74 else 12 end)
from hourly x cross join proc p
on conflict(id) do update set valores=excluded.valores,horario_previsto=excluded.horario_previsto,status_prazo=excluded.status_prazo,preenchido_em=excluded.preenchido_em;

insert into public.producao_interrupcoes(id,ciclo_id,subprocesso_origem_id,classificacao,motivo,iniciada_em,encerrada_em,observacao_retomada,created_at)
values(md5('demo-stop-2026-08-12')::uuid,md5('demo-cycle-2026-08-12')::uuid,md5('demo-process-2026-08-12-forno')::uuid,'parada','Defeito identificado na esteira do forno','2026-08-12 09:18-03','2026-08-12 09:42-03','Manutenção corrigiu o acionamento','2026-08-12 09:18-03')
on conflict(id) do update set motivo=excluded.motivo;

insert into public.ciclo_nao_conformidades(id,ciclo_id,produto,quantidade,descricao,causa,acao_tomada,interrompeu_producao,status,registrada_em,metadata)
values(md5('demo-nc-2026-08-13')::uuid,md5('demo-cycle-2026-08-13')::uuid,'Rosca Leite','12 pacotes','Umidade acima da faixa fictícia','Ajuste de temperatura do forno','Produto segregado e parâmetros ajustados',false,'resolvida','2026-08-13 10:18-03','{"demo":true,"contexto":"forno"}')
on conflict(id) do update set descricao=excluded.descricao;
drop table if exists public._seed_demo_cycles_20260814;
