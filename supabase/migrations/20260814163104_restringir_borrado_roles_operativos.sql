-- Operational roles can work their records but cannot delete them.
-- The administrator keeps the existing full-access policy.
drop policy if exists "ventas clientes crm" on public.clientes;
drop policy if exists "ventas direcciones crm" on public.cliente_direcciones;
drop policy if exists "ventas pedidos crm" on public.pedidos;
drop policy if exists "ventas detalle crm" on public.pedido_detalle;
drop policy if exists "ventas pagos crm" on public.pagos;
drop policy if exists "produccion inventario crm" on public.movimientos_inventario;
drop policy if exists "caja pagos crm" on public.pagos;
drop policy if exists "caja movimientos crm" on public.movimientos_caja;

do $$
declare
  tabla text;
  etiqueta text;
begin
  foreach tabla in array array['clientes', 'cliente_direcciones', 'pedidos', 'pedido_detalle', 'pagos'] loop
    etiqueta := 'ventas ' || tabla || ' crm';
    execute format('create policy %I on public.%I for select to authenticated using (private.tiene_rol_crm(array[''Ventas'']))', etiqueta || ' lectura', tabla);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.tiene_rol_crm(array[''Ventas'']))', etiqueta || ' alta', tabla);
    execute format('create policy %I on public.%I for update to authenticated using (private.tiene_rol_crm(array[''Ventas''])) with check (private.tiene_rol_crm(array[''Ventas'']))', etiqueta || ' actualiza', tabla);
  end loop;

  foreach tabla in array array['movimientos_inventario'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.tiene_rol_crm(array[U&''Producci\\00F3n'']))', 'produccion inventario lectura crm', tabla);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.tiene_rol_crm(array[U&''Producci\\00F3n'']))', 'produccion inventario alta crm', tabla);
    execute format('create policy %I on public.%I for update to authenticated using (private.tiene_rol_crm(array[U&''Producci\\00F3n''])) with check (private.tiene_rol_crm(array[U&''Producci\\00F3n'']))', 'produccion inventario actualiza crm', tabla);
  end loop;

  foreach tabla in array array['pagos', 'movimientos_caja'] loop
    etiqueta := 'caja ' || tabla || ' crm';
    execute format('create policy %I on public.%I for select to authenticated using (private.tiene_rol_crm(array[''Caja'']))', etiqueta || ' lectura', tabla);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.tiene_rol_crm(array[''Caja'']))', etiqueta || ' alta', tabla);
    execute format('create policy %I on public.%I for update to authenticated using (private.tiene_rol_crm(array[''Caja''])) with check (private.tiene_rol_crm(array[''Caja'']))', etiqueta || ' actualiza', tabla);
  end loop;
end;
$$;
