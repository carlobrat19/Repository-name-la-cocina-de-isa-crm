-- Solo el administrador puede borrar elementos vacíos. Los que tengan historial
-- se desactivan para preservar trazabilidad contable, inventario y ventas.
create or replace function private.eliminar_sucursal_segura(p_sucursal_id uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_caja_id uuid;
begin
  if (select auth.uid()) is null or not private.es_administrador_crm() then raise exception 'Solo el administrador puede eliminar sucursales'; end if;
  select caja_efectivo_id into v_caja_id from public.sucursales where id = p_sucursal_id for update;
  if not found then raise exception 'Sucursal no encontrada'; end if;
  if exists (select 1 from public.turnos_caja_pos where sucursal_id=p_sucursal_id)
     or exists (select 1 from public.ventas_pos where sucursal_id=p_sucursal_id)
     or exists (select 1 from public.movimientos_inventario_sucursal where sucursal_id=p_sucursal_id)
     or exists (select 1 from public.lotes_produccion where sucursal_id=p_sucursal_id)
     or exists (select 1 from public.inventario_sucursal_productos where sucursal_id=p_sucursal_id and existencia <> 0)
     or exists (select 1 from public.movimientos_caja where cuenta_id=v_caja_id or cuenta_destino_id=v_caja_id) then
    raise exception 'No se puede eliminar una sucursal con historial, turnos, ventas o existencias. Desactívala para conservar la trazabilidad.';
  end if;
  update public.sucursales set caja_efectivo_id = null where id=p_sucursal_id;
  delete from public.cuentas_financieras where id=v_caja_id;
  delete from public.sucursales where id=p_sucursal_id;
end; $$;

create or replace function public.eliminar_sucursal_segura(p_sucursal_id uuid)
returns void language sql security definer set search_path = public, private as $$ select private.eliminar_sucursal_segura(p_sucursal_id); $$;
revoke all on function private.eliminar_sucursal_segura(uuid) from public, anon;
revoke all on function public.eliminar_sucursal_segura(uuid) from public, anon;
grant execute on function public.eliminar_sucursal_segura(uuid) to authenticated;

create or replace function private.eliminar_cuenta_financiera_segura(p_cuenta_id uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_sucursal_id uuid;
begin
  if (select auth.uid()) is null or not private.es_administrador_crm() then raise exception 'Solo el administrador puede eliminar cuentas'; end if;
  select sucursal_id into v_sucursal_id from public.cuentas_financieras where id=p_cuenta_id for update;
  if not found then raise exception 'Cuenta no encontrada'; end if;
  if v_sucursal_id is not null then raise exception 'Esta es la caja física de una sucursal. Elimina o desactiva la sucursal desde Sucursales.'; end if;
  if exists (select 1 from public.movimientos_caja where cuenta_id=p_cuenta_id or cuenta_destino_id=p_cuenta_id)
     or exists (select 1 from public.turnos_caja_pos where cuenta_id=p_cuenta_id) then
    raise exception 'No se puede eliminar una cuenta con movimientos. Desactívala para conservar el historial.';
  end if;
  delete from public.cuentas_financieras where id=p_cuenta_id;
end; $$;

create or replace function public.eliminar_cuenta_financiera_segura(p_cuenta_id uuid)
returns void language sql security definer set search_path = public, private as $$ select private.eliminar_cuenta_financiera_segura(p_cuenta_id); $$;
revoke all on function private.eliminar_cuenta_financiera_segura(uuid) from public, anon;
revoke all on function public.eliminar_cuenta_financiera_segura(uuid) from public, anon;
grant execute on function public.eliminar_cuenta_financiera_segura(uuid) to authenticated;
