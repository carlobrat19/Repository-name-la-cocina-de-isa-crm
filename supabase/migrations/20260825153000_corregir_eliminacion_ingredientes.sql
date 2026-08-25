-- Permite eliminar únicamente ingredientes sin historial operativo, para
-- conservar la trazabilidad de compras y gastos ya registrados.
create or replace function public.eliminar_ingrediente_seguro(p_ingrediente_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if (select auth.uid()) is null
     or not private.tiene_modulo_crm('ingredientes') then
    raise exception 'No autorizado para eliminar ingredientes';
  end if;

  if exists (
    select 1 from public.receta_ingredientes
    where ingrediente_id = p_ingrediente_id
  ) then
    raise exception 'No puedes eliminar este ingrediente porque está usado en una receta. Retíralo de la receta primero.';
  end if;

  if exists (
    select 1 from public.compras_ingredientes
    where ingrediente_id = p_ingrediente_id
  ) then
    raise exception 'No puedes eliminar este ingrediente porque tiene compras o movimientos registrados. Desactívalo para conservar el historial.';
  end if;

  delete from public.ingredientes
  where id = p_ingrediente_id;

  if not found then
    raise exception 'Ingrediente no encontrado';
  end if;
end;
$$;

revoke all on function public.eliminar_ingrediente_seguro(uuid) from public, anon;
grant execute on function public.eliminar_ingrediente_seguro(uuid) to authenticated;
