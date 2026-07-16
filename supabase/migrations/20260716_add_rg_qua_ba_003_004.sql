-- Adiciona RGs de liberacao de produto Milho e Rosca.
-- Execute no SQL Editor depois das migrations anteriores.

insert into public.rgs (id, codigo, titulo, revisao, descricao)
values
  ('00000000-0000-0000-0000-000000000304', 'RG.QUA.BA.004', 'Controle de Liberacao de Produto - Milho', '03', 'Higienizacao, produto, processo, fotos e NCs para milho'),
  ('00000000-0000-0000-0000-000000000303', 'RG.QUA.BA.003', 'Controle de Liberacao de Produto - Rosca', '03', 'Higienizacao, produto, processo, fotos e NCs para rosca')
on conflict (codigo) do update
set titulo = excluded.titulo,
    revisao = excluded.revisao,
    descricao = excluded.descricao,
    ativo = true;

insert into public.rg_linhas (rg_id, linha_id)
values
  ('00000000-0000-0000-0000-000000000304', 'SAL'),
  ('00000000-0000-0000-0000-000000000303', 'ROS')
on conflict (rg_id, linha_id) do nothing;

insert into public.processos (id, rg_id, codigo, nome, tipo, frequencia, ordem)
values
  ('00000000-0000-0000-0000-000000304001', '00000000-0000-0000-0000-000000000304', 'HIG', 'Higienizacao', 'higienizacao', 'Por setup', 1),
  ('00000000-0000-0000-0000-000000304002', '00000000-0000-0000-0000-000000000304', 'LIBP', 'Liberacao do Produto', 'produto_liberacao', 'Por horario liberado', 2),
  ('00000000-0000-0000-0000-000000304003', '00000000-0000-0000-0000-000000000304', 'AVP', 'Avaliacao do Produto', 'produto_avaliacao', 'Hora em hora', 3),
  ('00000000-0000-0000-0000-000000304004', '00000000-0000-0000-0000-000000000304', 'RGP', 'RG - Processo', 'processo', 'Hora em hora', 4),
  ('00000000-0000-0000-0000-000000304005', '00000000-0000-0000-0000-000000000304', 'REGF', 'Registro Fotografico', 'fotografico', 'Hora em hora', 5),
  ('00000000-0000-0000-0000-000000303001', '00000000-0000-0000-0000-000000000303', 'HIG', 'Higienizacao', 'higienizacao', 'Por setup', 1),
  ('00000000-0000-0000-0000-000000303002', '00000000-0000-0000-0000-000000000303', 'LIBP', 'Liberacao do Produto', 'produto_liberacao', 'Por horario liberado', 2),
  ('00000000-0000-0000-0000-000000303003', '00000000-0000-0000-0000-000000000303', 'AVP', 'Avaliacao do Produto', 'produto_avaliacao', 'Hora em hora', 3),
  ('00000000-0000-0000-0000-000000303004', '00000000-0000-0000-0000-000000000303', 'RGP', 'RG - Processo', 'processo', 'Hora em hora', 4),
  ('00000000-0000-0000-0000-000000303005', '00000000-0000-0000-0000-000000000303', 'REGF', 'Registro Fotografico', 'fotografico', 'Hora em hora', 5)
on conflict (rg_id, codigo) do update
set nome = excluded.nome,
    tipo = excluded.tipo,
    frequencia = excluded.frequencia,
    ordem = excluded.ordem,
    ativo = true;
