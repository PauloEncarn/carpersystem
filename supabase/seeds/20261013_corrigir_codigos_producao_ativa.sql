-- Correção de visualização da produção demonstrativa ativa.
-- Execute após 20261013_demo_rosca_em_andamento.sql.

update public.registros
set codigo = 'DEMO-ROSCA-ATIVA-' || to_char(current_date, 'YYYYMMDD') || '-LIBP'
where id = md5('demo-rosca-monitor-registro-produto_liberacao' || current_date::text)::uuid;

update public.registros
set codigo = 'DEMO-ROSCA-ATIVA-' || to_char(current_date, 'YYYYMMDD') || '-CTRLIB'
where id = md5('demo-rosca-monitor-registro-controle_liberacao' || current_date::text)::uuid;

update public.registros
set codigo = 'DEMO-ROSCA-ATIVA-' || to_char(current_date, 'YYYYMMDD') || '-AVP'
where id = md5('demo-rosca-monitor-registro-produto_avaliacao' || current_date::text)::uuid;

update public.registros
set codigo = 'DEMO-ROSCA-ATIVA-' || to_char(current_date, 'YYYYMMDD') || '-RGP'
where id = md5('demo-rosca-monitor-registro-processo' || current_date::text)::uuid;

update public.registros
set codigo = 'DEMO-ROSCA-ATIVA-' || to_char(current_date, 'YYYYMMDD') || '-REGF'
where id = md5('demo-rosca-monitor-registro-fotografico' || current_date::text)::uuid;
