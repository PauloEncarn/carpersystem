-- Ocorrências operacionais com evidência antes/depois e duração calculada pelo banco.
create or replace function public.registrar_problema_subprocesso(
  p_subprocesso_id uuid,
  p_equipamento text,
  p_causa text,
  p_descricao text,
  p_foto_antes text,
  p_operador_id uuid
) returns public.subprocesso_eventos
language plpgsql security invoker as $$
declare resultado public.subprocesso_eventos; operador_valido uuid; instante timestamptz := now();
begin
  if coalesce(trim(p_equipamento), '') = '' or coalesce(trim(p_causa), '') = '' then
    raise exception 'Informe o equipamento e a possível causa.';
  end if;
  if coalesce(trim(p_foto_antes), '') = '' then
    raise exception 'A foto antes do problema é obrigatória.';
  end if;
  perform 1 from public.producao_subprocessos where id = p_subprocesso_id;
  if not found then raise exception 'Subprocesso não encontrado.'; end if;
  select id into operador_valido from public.operadores where id = p_operador_id;
  insert into public.subprocesso_eventos(subprocesso_id,tipo,motivo,ocorrido_em,operador_id,dados)
  values(p_subprocesso_id,'problema_reportado',coalesce(nullif(trim(p_descricao),''),p_causa),instante,operador_valido,
    jsonb_build_object('equipamento',p_equipamento,'causa',p_causa,'descricao',coalesce(p_descricao,''),'foto_antes',p_foto_antes,'aberto_em',instante,'status','aberto'))
  returning * into resultado;
  return resultado;
end $$;

create or replace function public.resolver_problema_subprocesso(
  p_problema_id uuid,
  p_solucao text,
  p_foto_depois text,
  p_operador_id uuid
) returns public.subprocesso_eventos
language plpgsql security invoker as $$
declare problema public.subprocesso_eventos; resultado public.subprocesso_eventos; operador_valido uuid; instante timestamptz := now(); minutos integer;
begin
  if coalesce(trim(p_solucao), '') = '' then raise exception 'Descreva a solução aplicada.'; end if;
  if coalesce(trim(p_foto_depois), '') = '' then raise exception 'A foto depois da solução é obrigatória.'; end if;
  select * into problema from public.subprocesso_eventos where id = p_problema_id and tipo = 'problema_reportado' for update;
  if problema.id is null then raise exception 'Problema operacional não encontrado.'; end if;
  if exists(select 1 from public.subprocesso_eventos where tipo='problema_resolvido' and dados->>'problema_id'=problema.id::text) then
    raise exception 'Este problema já foi resolvido.';
  end if;
  select id into operador_valido from public.operadores where id = p_operador_id;
  minutos := greatest(0, ceil(extract(epoch from (instante - problema.ocorrido_em)) / 60.0)::integer);
  insert into public.subprocesso_eventos(subprocesso_id,tipo,motivo,ocorrido_em,operador_id,dados)
  values(problema.subprocesso_id,'problema_resolvido',trim(p_solucao),instante,operador_valido,
    jsonb_build_object('problema_id',problema.id,'solucao',trim(p_solucao),'foto_depois',p_foto_depois,'resolvido_em',instante,'duracao_minutos',minutos))
  returning * into resultado;
  return resultado;
end $$;

grant execute on function public.registrar_problema_subprocesso(uuid,text,text,text,text,uuid) to anon, authenticated;
grant execute on function public.resolver_problema_subprocesso(uuid,text,text,uuid) to anon, authenticated;
