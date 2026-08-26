-- Ficha comercial del cliente y eliminación segura.
alter table public.clientes
  add column if not exists fecha_nacimiento date;

create index if not exists clientes_fecha_nacimiento_idx
  on public.clientes (fecha_nacimiento)
  where fecha_nacimiento is not null;

create or replace function private.eliminar_cliente_seguro(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null or not private.tiene_modulo_crm('clientes') then
    raise exception 'No autorizado para eliminar clientes';
  end if;

  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'Cliente no encontrado';
  end if;

  if exists (select 1 from public.pedidos where cliente_id = p_cliente_id)
    or exists (select 1 from public.pagos where cliente_id = p_cliente_id)
    or exists (select 1 from public.cotizaciones where cliente_id = p_cliente_id)
    or exists (select 1 from public.facturas where cliente_id = p_cliente_id)
    or exists (select 1 from public.conversaciones where cliente_id = p_cliente_id)
    or exists (select 1 from public.leads where cliente_id = p_cliente_id)
    or exists (select 1 from public.actividades_comerciales where cliente_id = p_cliente_id) then
    raise exception 'Este cliente tiene historial comercial. Desactívalo en lugar de eliminarlo para conservar la trazabilidad.';
  end if;

  delete from public.clientes where id = p_cliente_id;
end;
$$;

create or replace function public.eliminar_cliente_seguro(p_cliente_id uuid)
returns void
language sql
security invoker
set search_path = public, private
as $$
  select private.eliminar_cliente_seguro(p_cliente_id);
$$;

revoke all on function private.eliminar_cliente_seguro(uuid) from public, anon, authenticated;
revoke all on function public.eliminar_cliente_seguro(uuid) from public, anon;
grant execute on function public.eliminar_cliente_seguro(uuid) to authenticated;
