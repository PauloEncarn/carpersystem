-- CARGA FICTÍCIA · 17/08/2026 a 21/08/2026 (segunda até sexta).
-- Cenários: produção normal, NC, pausa, parada, bloqueio, problemas por subprocesso,
-- registros atrasados, troca de turno e produção ativa hoje.
-- Seguro para reexecução. Não substitui uma produção real ativa.

-- Atores exclusivos da demonstração. A carga não depende dos usuários reais
-- nem das migrations opcionais de login de demonstração.
insert into public.operadores(id,nome,turno,codigo_pin,matricula,ativo)
values
 ('00000000-0000-0000-0000-000000000201','Operador da carga fictícia','A','8101','DEMO-OP-01',true),
 ('00000000-0000-0000-0000-000000000205','Técnico da carga fictícia','A','8501','DEMO-TEC-01',true)
on conflict(id) do update set nome=excluded.nome,turno=excluded.turno,ativo=true;

do $$
declare status_rule text;
begin
  select pg_get_constraintdef(oid) into status_rule
  from pg_constraint
  where conrelid='public.bateladas'::regclass and conname='bateladas_status_check';
  if status_rule is null or position('em_consumo' in status_rule)=0 or position('enviada_tombador' in status_rule)=0 then
    raise exception 'Aplique novamente a migration 20260821_batch_tumbler_timing.sql antes desta carga.';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from public.ciclos_producao
    where linha_id='ROS' and encerrado_em is null
      and coalesce((metadata->>'demo')::boolean,false)=false
  ) then
    raise exception 'Existe uma produção real ativa em ROS. Encerre-a ou use outro ambiente antes de carregar a demonstração.';
  end if;
end $$;

update public.ciclos_producao
set status='encerrado', encerrado_em=coalesce(encerrado_em,now()),
    producao_encerrada_em=coalesce(producao_encerrada_em,now())
where linha_id='ROS' and encerrado_em is null and coalesce((metadata->>'demo')::boolean,false)=true;

create temp table demo_week(day date primary key, product text, previous_product text, cycle_id uuid, active boolean) on commit drop;
insert into demo_week values
 ('2026-08-17','Rosca Leite',null,md5('demo-operational-cycle-2026-08-17')::uuid,false),
 ('2026-08-18','Rosca Coco','Rosca Leite',md5('demo-operational-cycle-2026-08-18')::uuid,false),
 ('2026-08-19','Rosca Chocolate','Rosca Coco',md5('demo-operational-cycle-2026-08-19')::uuid,false),
 ('2026-08-20','Rosca Tradicional','Rosca Chocolate',md5('demo-operational-cycle-2026-08-20')::uuid,false),
 ('2026-08-21','Rosca Chocolate','Rosca Tradicional',md5('demo-operational-cycle-2026-08-21')::uuid,true);

insert into public.ciclos_producao(
 id,linha_id,rg_id,produto,produto_anterior,motivo_inicio,status,iniciado_por,
 iniciado_em,etapa_iniciada_em,producao_iniciada_em,producao_encerrada_em,encerrado_em,metadata,created_at,updated_at
)
select cycle_id,'ROS','00000000-0000-0000-0000-000000000303',product,previous_product,
 case when previous_product is null then 'Início semanal' else 'Troca de produto' end,
 case when active then 'produzindo' else 'encerrado' end,
 '00000000-0000-0000-0000-000000000205',day+time '05:35',day+time '05:35',day+time '06:10',
 case when active then null else day+time '22:50' end,case when active then null else day+time '22:50' end,
 jsonb_build_object('demo',true,'productionCode','DEMO-ROS-'||upper(replace(product,'Rosca ',''))||'-'||to_char(day,'DDMMYYYY'),'responsavelAtual',case when active then 'Supervisor Turno B' else 'Encerrada' end),
 day+time '05:35',case when active then now() else day+time '22:50' end
from demo_week
on conflict(id) do update set status=excluded.status,encerrado_em=excluded.encerrado_em,
 producao_encerrada_em=excluded.producao_encerrada_em,metadata=excluded.metadata,updated_at=excluded.updated_at;

with processes(code,name,ord,equipment) as (values
 ('automacao','Automação',1,'Refinador'),('masseira','Masseira',2,'Masseira'),
 ('corte_fio','Corte a fio',3,'Cortadora'),('forno','Forno',4,'Forno · 7 zonas'),
 ('empacotamento','Empacotamento',5,'4 empacotadoras'),('encaixotamento','Encaixotamento',6,'2 encaixotadeiras'))
insert into public.producao_subprocessos(id,ciclo_id,codigo,nome,ordem,status,equipamento,iniciado_em,encerrado_em,estado_iniciado_em,metadata,created_at,updated_at)
select md5('demo-operational-process-'||d.day||'-'||p.code)::uuid,d.cycle_id,p.code,p.name,p.ord,
 case when d.active then 'operando' else 'finalizado' end,p.equipment,d.day+time '06:10',
 case when d.active then null else d.day+time '22:50' end,
 case when d.active then now() else d.day+time '22:50' end,'{"demo":true}'::jsonb,d.day+time '06:10',case when d.active then now() else d.day+time '22:50' end
from demo_week d cross join processes p
on conflict(ciclo_id,codigo) do update set status=excluded.status,encerrado_em=excluded.encerrado_em,updated_at=excluded.updated_at;

-- Higienização operacional + aprovação da Qualidade. Na quarta houve correção e reinspeção.
insert into public.higienizacao_rodadas(id,ciclo_id,numero,status,dados_operacao,dados_qualidade,executada_por,inspecionada_por,execucao_iniciada_em,enviada_inspecao_em,inspecao_iniciada_em,inspecao_encerrada_em,created_at)
select md5('demo-hygiene-'||day)::uuid,cycle_id,1,'aprovada',
 jsonb_build_object('resultado','C','sem_contato','C','com_contato',case when day='2026-08-19' then 'NC corrigida' else 'C' end),
 jsonb_build_object('resultado','C','observacao',case when day='2026-08-19' then 'Resíduo removido após reinspeção' else 'Higienização liberada' end),
 '00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000205',day+time '05:35',day+time '05:52',day+time '05:55',day+time '06:05',day+time '05:35'
from demo_week on conflict(ciclo_id,numero) do update set status=excluded.status,dados_qualidade=excluded.dados_qualidade;

-- Rastreabilidade da Automação e três bateladas por dia.
insert into public.automacao_lotes(id,ciclo_id,insumo_id,lote_fornecedor,fornecedor,validade,iniciado_em,encerrado_em,operador_id,created_at)
select md5('demo-operational-supply-'||d.day||'-'||i.codigo)::uuid,d.cycle_id,i.id,
 case i.codigo when 'FARINHA' then 'FAR-' else 'ACU-' end||to_char(d.day,'DDMM')||'-01',
 case i.codigo when 'FARINHA' then 'Moinho Demonstração' else 'Usina Demonstração' end,d.day+180,
 d.day+time '05:40',case when d.active then null else d.day+time '22:50' end,'00000000-0000-0000-0000-000000000201',d.day+time '05:40'
from demo_week d join public.insumos i on i.codigo in ('FARINHA','ACUCAR')
on conflict(id) do update set lote_fornecedor=excluded.lote_fornecedor,validade=excluded.validade,encerrado_em=excluded.encerrado_em;

insert into public.bateladas(id,ciclo_id,receita_id,numero,status,iniciada_em,finalizada_em,iniciada_por,finalizada_por,observacao,created_at,pronta_em,enviada_tombador_em)
select md5('demo-operational-batch-'||d.day||'-'||n)::uuid,d.cycle_id,r.id,n,
 case when d.active and n=3 then 'em_consumo' else 'enviada_tombador' end,
 d.day+time '06:10'+make_interval(hours=>(n-1)*5),
 d.day+time '06:18'+make_interval(hours=>(n-1)*5),'00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000201',
 'Receita fictícia · aproximadamente 900 kg',d.day+time '06:10'+make_interval(hours=>(n-1)*5),
 d.day+time '06:18'+make_interval(hours=>(n-1)*5),d.day+time '06:21'+make_interval(hours=>(n-1)*5)
from demo_week d join public.receitas r on lower(r.produto)=lower(d.product) and r.versao=1 cross join generate_series(1,3) n
on conflict(id) do update set status=excluded.status,pronta_em=excluded.pronta_em,enviada_tombador_em=excluded.enviada_tombador_em,observacao=excluded.observacao;

insert into public.batelada_insumos(id,batelada_id,insumo_id,automacao_lote_id,lote_fornecedor,fornecedor,validade,quantidade_prevista,quantidade_utilizada,unidade,origem,registrado_em,operador_id)
select md5('demo-operational-batch-input-'||d.day||'-'||n||'-'||i.codigo)::uuid,
 md5('demo-operational-batch-'||d.day||'-'||n)::uuid,i.id,
 case when i.origem='automacao' then md5('demo-operational-supply-'||d.day||'-'||i.codigo)::uuid end,
 case when i.codigo='FARINHA' then 'FAR-'||to_char(d.day,'DDMM')||'-01' when i.codigo='ACUCAR' then 'ACU-'||to_char(d.day,'DDMM')||'-01' else i.codigo||'-DEMO-01' end,
 case when i.origem='automacao' then 'Fornecedor demonstração' else 'Estoque interno' end,d.day+180,ri.quantidade,ri.quantidade,ri.unidade,i.origem,
 d.day+time '06:12'+make_interval(hours=>(n-1)*5),'00000000-0000-0000-0000-000000000201'
from demo_week d join public.receitas r on lower(r.produto)=lower(d.product) and r.versao=1
join public.receita_insumos ri on ri.receita_id=r.id join public.insumos i on i.id=ri.insumo_id cross join generate_series(1,3) n
on conflict(id) do update set quantidade_utilizada=excluded.quantidade_utilizada,lote_fornecedor=excluded.lote_fornecedor;

-- Lotes e registros-base para os preenchimentos da Qualidade.
insert into public.lotes(id,codigo,linha_id,data_producao,produto,metadata)
select md5('demo-operational-lot-'||day)::uuid,'DEMO-ROS-'||to_char(day,'DDMMYYYY'),'ROS',day,product,'{"demo":true}'::jsonb
from demo_week on conflict(codigo) do update set produto=excluded.produto,metadata=excluded.metadata;

insert into public.registros(id,codigo,lote_id,rg_id,processo_id,operador_id,turno,motivo,status,data_registro,metadata)
select md5('demo-quality-record-'||d.day||'-'||p.tipo)::uuid,'DEMO-'||to_char(d.day,'DDMMYYYY')||'-'||p.codigo,
 md5('demo-operational-lot-'||d.day)::uuid,'00000000-0000-0000-0000-000000000303',p.id,
 '00000000-0000-0000-0000-000000000205','A','Demonstração','concluido',d.day+time '06:15','{"demo":true}'::jsonb
from demo_week d cross join (values
 ('00000000-0000-0000-0000-000000303003'::uuid,'produto_avaliacao','AVP'),
 ('00000000-0000-0000-0000-000000303004'::uuid,'processo','RGP'),
 ('00000000-0000-0000-0000-000000303005'::uuid,'fotografico','REGF')) p(id,tipo,codigo)
on conflict(codigo) do update set status=excluded.status,metadata=excluded.metadata;

-- Qualidade hora a hora, incluindo valores verdes, amarelos e vermelhos.
with slots as (
 select d.*,h from demo_week d cross join generate_series(7,21,2) h
), quality as (
 select * from (values
 ('00000000-0000-0000-0000-000000303003'::uuid,'produto_avaliacao','AVP'),
 ('00000000-0000-0000-0000-000000303004'::uuid,'processo','RGP')) q(process_id,context_type,code)
)
insert into public.preenchimentos(id,registro_id,processo_id,operador_id,contexto_tipo,horario,valores,status,preenchido_em,ciclo_id,chave_slot)
select md5('demo-quality-fill-'||s.day||'-'||q.code||'-'||s.h)::uuid,
 md5('demo-quality-record-'||s.day||'-'||q.context_type)::uuid,q.process_id,'00000000-0000-0000-0000-000000000205',q.context_type,
 make_time(s.h,0,0),
 case when q.context_type='produto_avaliacao' then jsonb_build_object('apontamentos',jsonb_build_array(
   jsonb_build_object('item','Umidade','resultado',case when s.day='2026-08-18' and s.h=11 then 5.2 when s.day='2026-08-20' and s.h=15 then 4.4 else 3.1+((s.h%3)*0.2) end,'unidade','%'),
   jsonb_build_object('item','Peso','resultado',case when s.day='2026-08-19' and s.h=13 then 82 else 90+(s.h%2) end,'unidade','g')))
 else jsonb_build_object('avaliacoes',jsonb_build_array(jsonb_build_object('item','Aspecto do processo','resultado',case when s.day='2026-08-17' and s.h=17 then 'NC' else 'C' end))) end,
 case when (s.day='2026-08-18' and s.h=11) or (s.day='2026-08-19' and s.h=13) or (s.day='2026-08-17' and s.h=17) then 'com_nc' else 'concluido' end,
 s.day+make_interval(hours=>s.h,mins=>case when s.h in (11,17) then 38 else 8 end),s.cycle_id,q.context_type||':'||s.h
from slots s cross join quality q
on conflict(id) do update set valores=excluded.valores,status=excluded.status,preenchido_em=excluded.preenchido_em;

insert into public.preenchimentos(id,registro_id,processo_id,operador_id,contexto_tipo,horario,valores,status,preenchido_em,ciclo_id,chave_slot)
select md5('demo-photo-fill-'||day)::uuid,md5('demo-quality-record-'||day||'-fotografico')::uuid,
 '00000000-0000-0000-0000-000000303005','00000000-0000-0000-0000-000000000205','fotografico',time '12:00',
 jsonb_build_object('fotografias',jsonb_build_array(jsonb_build_object('imagem','/images/fabrica-isometrica-cicopal.png','horario','12:00','observacao','Imagem fictícia da produção'))),
 'concluido',day+time '12:05',cycle_id,'fotografico:12'
from demo_week on conflict(id) do update set valores=excluded.valores,preenchido_em=excluded.preenchido_em;

-- Registros dos subprocessos a cada duas horas. Valores propositalmente variados.
with slots as (select d.*,h from demo_week d cross join generate_series(7,21,2) h),
proc as (select * from (values ('corte_fio'),('forno'),('empacotamento'),('encaixotamento')) p(code))
insert into public.subprocesso_registros(id,subprocesso_id,ciclo_id,chave_slot,horario_referencia,horario_previsto,tipo,janela_indice,janela_inicio,janela_fim,valores,status_prazo,preenchido_em)
select md5('demo-operational-reading-'||s.day||'-'||p.code||'-'||s.h)::uuid,
 md5('demo-operational-process-'||s.day||'-'||p.code)::uuid,s.cycle_id,'demo:'||s.h,s.day+make_interval(hours=>s.h),s.day+make_interval(hours=>s.h),'horario',(s.h-7)/2,s.day+make_interval(hours=>s.h),s.day+make_interval(hours=>s.h+1),
 case p.code
  when 'corte_fio' then jsonb_build_object('peso_10_lado_operacional',89+(s.h%4),'peso_10_lado_nao_operacional',88.5+(s.h%3),'umidade',3.4+(s.h%3)*0.35,'cortes_hora',6900+s.h*38)
  when 'forno' then jsonb_build_object('velocidade_esteira',18+(s.h%2),'velocidade_linha',20+(s.h%2),'umidade',case when s.day='2026-08-18' and s.h=11 then 5.3 else 3.2+(s.h%3)*0.3 end,'zona_1_setpoint',180,'zona_1_real',178+(s.h%4),'zona_2_setpoint',185,'zona_2_real',184+(s.h%3),'zona_3_setpoint',190,'zona_3_real',188+(s.h%4),'zona_4_setpoint',195,'zona_4_real',193+(s.h%3),'zona_5_setpoint',190,'zona_5_real',189+(s.h%2),'zona_6_setpoint',185,'zona_6_real',184+(s.h%2),'zona_7_setpoint',175,'zona_7_real',174+(s.h%3))
  when 'empacotamento' then jsonb_build_object('maq_1_pacotes_min',48+(s.h%4),'maq_1_sobrepeso',1.8,'maq_2_pacotes_min',25+(s.h%3),'maq_2_sobrepeso',2.7,'maq_3_pacotes_min',24+(s.h%2),'maq_3_sobrepeso',3.1,'maq_4_pacotes_min',case when s.h>=17 then 20 else 0 end,'maq_4_sobrepeso',2.4)
  else jsonb_build_object('caixas_min',4.8+(s.h%4)*0.4) end,
 case when s.h in (11,17) then 'atrasado' else 'no_prazo' end,s.day+make_interval(hours=>s.h,mins=>case when s.h in (11,17) then 72 else 9 end)
from slots s cross join proc p
on conflict(id) do update set valores=excluded.valores,status_prazo=excluded.status_prazo,preenchido_em=excluded.preenchido_em;

-- Problema + resolução em todos os subprocessos, distribuídos pela semana.
with scenarios(day,code,cause,start_time,end_time) as (values
 ('2026-08-17'::date,'automacao','Oscilação no refinador',time '08:10',time '08:24'),
 ('2026-08-17'::date,'masseira','Dosagem de água divergente',time '12:05',time '12:17'),
 ('2026-08-18'::date,'corte_fio','Corte irregular no lado operacional',time '10:32',time '10:58'),
 ('2026-08-19'::date,'forno','Temperatura real abaixo do set point na zona 4',time '09:18',time '09:47'),
 ('2026-08-20'::date,'empacotamento','Falha de selagem na máquina 2',time '14:35',time '15:06'),
 ('2026-08-21'::date,'encaixotamento','Acúmulo de pacotes na encaixotadeira 1',time '10:12',time '10:29'))
insert into public.subprocesso_eventos(id,subprocesso_id,tipo,motivo,ocorrido_em,operador_id,dados)
select md5('demo-problem-'||day||'-'||code)::uuid,md5('demo-operational-process-'||day||'-'||code)::uuid,'problema_reportado',cause,day+start_time,
 '00000000-0000-0000-0000-000000000201',jsonb_build_object('demo',true,'causa',cause,'equipamento',code,'foto_antes','/images/fabrica-isometrica-cicopal.png') from scenarios
on conflict(id) do update set motivo=excluded.motivo,dados=excluded.dados;

with scenarios(day,code,solution,end_time,minutes) as (values
 ('2026-08-17'::date,'automacao','Refinador estabilizado',time '08:24',14),('2026-08-17'::date,'masseira','Dosagem corrigida',time '12:17',12),
 ('2026-08-18'::date,'corte_fio','Lâmina ajustada',time '10:58',26),('2026-08-19'::date,'forno','Queimador da zona 4 regulado',time '09:47',29),
 ('2026-08-20'::date,'empacotamento','Mordente da máquina 2 ajustado',time '15:06',31),('2026-08-21'::date,'encaixotamento','Fluxo de caixas normalizado',time '10:29',17))
insert into public.subprocesso_eventos(id,subprocesso_id,tipo,motivo,ocorrido_em,operador_id,dados)
select md5('demo-resolution-'||day||'-'||code)::uuid,md5('demo-operational-process-'||day||'-'||code)::uuid,'problema_resolvido',solution,day+end_time,
 '00000000-0000-0000-0000-000000000201',jsonb_build_object('demo',true,'problema_id',md5('demo-problem-'||day||'-'||code)::uuid,'duracao_minutos',minutes,'foto_depois','/images/fabrica-isometrica-cicopal.png') from scenarios
on conflict(id) do update set motivo=excluded.motivo,dados=excluded.dados;

-- Pausas, parada e bloqueio já resolvidos; hoje houve uma pausa curta e a produção voltou a operar.
with scenarios(day,code,classif,reason,start_time,end_time,resume) as (values
 ('2026-08-17'::date,'masseira','pausa','Troca programada de insumo',time '11:40',time '11:58','Novo lote conferido'),
 ('2026-08-18'::date,'corte_fio','parada','Falha mecânica na cortadora',time '10:32',time '10:58','Manutenção liberou a cortadora'),
 ('2026-08-19'::date,'forno','bloqueio','NC de temperatura na zona 4',time '09:18',time '09:47','Qualidade liberou após ajuste'),
 ('2026-08-20'::date,'empacotamento','parada','Máquina 2 sem selagem',time '14:35',time '15:06','Selagem normalizada'),
 ('2026-08-21'::date,'encaixotamento','pausa','Organização do abastecimento de caixas',time '10:12',time '10:29','Abastecimento regularizado'))
insert into public.producao_interrupcoes(id,ciclo_id,subprocesso_origem_id,classificacao,motivo,iniciada_em,encerrada_em,observacao_retomada,created_at)
select md5('demo-interruption-'||s.day)::uuid,d.cycle_id,md5('demo-operational-process-'||s.day||'-'||s.code)::uuid,s.classif,s.reason,s.day+s.start_time,s.day+s.end_time,s.resume,s.day+s.start_time
from scenarios s join demo_week d on d.day=s.day
on conflict(id) do update set motivo=excluded.motivo,encerrada_em=excluded.encerrada_em,observacao_retomada=excluded.observacao_retomada;

-- NCs com contextos diferentes; a NC de hoje permanece aberta sem pausar a produção.
with scenarios(day,context,qty,description,cause,action,status,event_time) as (values
 ('2026-08-17'::date,'masseira','1 batelada','Dosagem fora da receita','Erro de regulagem','Batelada segregada e dosagem corrigida','resolvida',time '12:05'),
 ('2026-08-18'::date,'corte_fio','18 kg','Peso abaixo da faixa','Corte irregular','Produto segregado e lâmina ajustada','resolvida',time '10:35'),
 ('2026-08-19'::date,'forno','42 kg','Umidade acima da faixa','Zona 4 abaixo do set point','Forno bloqueado até estabilização','resolvida',time '09:20'),
 ('2026-08-20'::date,'empacotamento','26 pacotes','Selagem incompleta','Mordente desalinhado','Pacotes segregados e máquina ajustada','resolvida',time '14:38'),
 ('2026-08-21'::date,'encaixotamento','3 caixas','Divergência na contagem de caixas','Sensor de contagem oscilando','Contagem manual iniciada sem parar a linha','aberta',time '13:22'))
insert into public.ciclo_nao_conformidades(id,ciclo_id,operador_id,produto,quantidade,descricao,causa,acao_tomada,interrompeu_producao,status,registrada_em,metadata)
select md5('demo-operational-nc-'||s.day)::uuid,d.cycle_id,'00000000-0000-0000-0000-000000000205',d.product,s.qty,s.description,s.cause,s.action,s.context in ('forno'),s.status,s.day+s.event_time,jsonb_build_object('demo',true,'contexto',s.context,'foto_antes','/images/fabrica-isometrica-cicopal.png','foto_depois',case when s.status='resolvida' then '/images/fabrica-isometrica-cicopal.png' else null end)
from scenarios s join demo_week d on d.day=s.day
on conflict(id) do update set status=excluded.status,descricao=excluded.descricao,metadata=excluded.metadata;

-- Responsabilidade por turnos A, B e C para análise posterior por supervisor.
insert into public.ciclo_turnos(id,ciclo_id,turno_origem,turno_destino,responsavel_nome,iniciado_em,observacao)
select md5('demo-shift-'||day||'-'||shift)::uuid,cycle_id,
 case shift when 'A' then 'C' when 'B' then 'A' else 'B' end,shift,
 case shift when 'A' then 'Supervisor Turno A' when 'B' then 'Supervisor Turno B' else 'Supervisor Turno C' end,
 day+case shift when 'A' then time '07:00' when 'B' then time '15:00' else time '23:00' end,'Passagem fictícia de responsabilidade'
from demo_week cross join (values('A'),('B'),('C')) shifts(shift)
on conflict(id) do update set responsavel_nome=excluded.responsavel_nome,observacao=excluded.observacao;

-- Confirma explicitamente que o ciclo de hoje permanece ativo após todos os cenários.
update public.ciclos_producao set status='produzindo',encerrado_em=null,producao_encerrada_em=null,updated_at=now()
where id=md5('demo-operational-cycle-2026-08-21')::uuid;
update public.producao_subprocessos set status='operando',encerrado_em=null,estado_iniciado_em=now(),updated_at=now()
where ciclo_id=md5('demo-operational-cycle-2026-08-21')::uuid;
