-- Reinicio definitivo de catálogo solicitado por la administración. No toca
-- usuarios, permisos, sucursales ni cuentas financieras.
delete from public.catalogo_sucursal_productos;
delete from public.inventario_sucursal_productos;
delete from public.movimientos_inventario_sucursal;
delete from public.movimientos_inventario;
delete from public.lotes_produccion;
delete from public.receta_ingredientes;
delete from public.recetas_estandar;
delete from public.compras_ingredientes;
delete from public.ingredientes;
delete from public.productos;

-- Costo adicional por receta: empaques, gas, mano de obra directa u otros
-- costos variables del lote. Se suma antes de calcular costo por porción.
alter table public.recetas_estandar
  add column if not exists costos_adicionales numeric(14,2) not null default 0 check (costos_adicionales >= 0);

create or replace function private.eliminar_ingrediente_seguro(p_ingrediente_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if (select auth.uid()) is null or not private.tiene_modulo_crm('ingredientes') then
    raise exception 'No autorizado para eliminar ingredientes';
  end if;
  if exists (select 1 from public.receta_ingredientes where ingrediente_id = p_ingrediente_id) then
    raise exception 'No puedes eliminar este ingrediente porque está usado en una receta. Retíralo de la receta primero.';
  end if;
  delete from public.compras_ingredientes where ingrediente_id = p_ingrediente_id;
  delete from public.ingredientes where id = p_ingrediente_id;
  if not found then raise exception 'Ingrediente no encontrado'; end if;
end;
$$;
create or replace function public.eliminar_ingrediente_seguro(uuid)
returns void language sql security invoker set search_path = public, private as $$
  select private.eliminar_ingrediente_seguro($1);
$$;
revoke all on function public.eliminar_ingrediente_seguro(uuid) from public, anon;
grant execute on function public.eliminar_ingrediente_seguro(uuid) to authenticated;
revoke all on function private.eliminar_ingrediente_seguro(uuid) from public, anon;
