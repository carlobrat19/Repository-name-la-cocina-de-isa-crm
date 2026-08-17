alter table public.compras_ingredientes
  drop constraint if exists compras_ingredientes_cantidad_check;

alter table public.compras_ingredientes
  add constraint compras_ingredientes_cantidad_check check (cantidad <> 0 or tipo = 'ajuste');

create or replace function public.ajustar_ingrediente(
  p_ingrediente_id uuid,
  p_nombre text,
  p_unidad_base text,
  p_stock_final numeric,
  p_costo_referencia numeric,
  p_nota text default null
)
returns public.ingredientes
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  ingrediente_actual public.ingredientes;
  ingrediente_actualizado public.ingredientes;
  diferencia numeric;
begin
  if (select auth.uid()) is null or not private.tiene_modulo_crm('productos') then
    raise exception 'No autorizado para ajustar ingredientes';
  end if;

  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El nombre es obligatorio';
  end if;

  if p_unidad_base not in ('g', 'ml', 'unidad') then
    raise exception 'Unidad base no válida';
  end if;

  if p_stock_final is null or p_stock_final < 0 or p_costo_referencia is null or p_costo_referencia < 0 then
    raise exception 'Existencias y costo deben ser valores válidos';
  end if;

  select * into ingrediente_actual
  from public.ingredientes
  where id = p_ingrediente_id
  for update;

  if not found then
    raise exception 'Ingrediente no encontrado';
  end if;

  diferencia := p_stock_final - ingrediente_actual.stock_actual;

  update public.ingredientes
  set nombre = trim(p_nombre),
      unidad_base = p_unidad_base,
      stock_actual = p_stock_final,
      costo_referencia = p_costo_referencia,
      updated_at = now()
  where id = p_ingrediente_id
  returning * into ingrediente_actualizado;

  if diferencia <> 0 or p_costo_referencia is distinct from ingrediente_actual.costo_referencia then
    insert into public.compras_ingredientes (ingrediente_id, tipo, cantidad, costo_unitario, total, nota, creado_por)
    values (
      p_ingrediente_id,
      'ajuste',
      diferencia,
      p_costo_referencia,
      round(abs(diferencia) * p_costo_referencia, 2),
      coalesce(nullif(trim(p_nota), ''), 'Ajuste manual de costo o existencias'),
      (select auth.uid())
    );
  end if;

  return ingrediente_actualizado;
end;
$$;

revoke all on function public.ajustar_ingrediente(uuid, text, text, numeric, numeric, text) from public, anon;
grant execute on function public.ajustar_ingrediente(uuid, text, text, numeric, numeric, text) to authenticated;
