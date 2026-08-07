-- Perfil operacional direcionado ao preenchimento do dia atual.
insert into public.perfis (id, codigo, nome, descricao, permissoes)
values (
  '00000000-0000-0000-0000-000000000105',
  'tecnico',
  'Técnico',
  'Preenche os registros operacionais sempre na data atual, sem acesso ao calendário.',
  '["operacao:acessar", "operacao:dia_atual", "registro:criar", "registro:editar", "nc:criar", "foto:criar", "assinatura:criar"]'::jsonb
)
on conflict (codigo) do update
set nome = excluded.nome,
    descricao = excluded.descricao,
    permissoes = excluded.permissoes,
    ativo = true;

insert into public.operadores (id, nome, turno, codigo_pin, matricula)
values ('00000000-0000-0000-0000-000000000205', 'Técnico Demo', 'A', '4444', 'TEC-001')
on conflict (codigo_pin) do update
set nome = excluded.nome, turno = excluded.turno, matricula = excluded.matricula, ativo = true;

insert into public.operador_perfis (operador_id, perfil_id, principal)
values ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000105', true)
on conflict (operador_id, perfil_id) do update set principal = excluded.principal;

-- O identificador do ciclo, produto anterior/novo e instante do evento devem ser
-- persistidos em registros.metadata para reconstruir a linha do tempo do RG 003.
