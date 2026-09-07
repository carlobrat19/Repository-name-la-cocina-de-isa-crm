-- Edición comercial de pedidos antes de iniciar producción.
-- El detalle se reemplaza dentro de una sola operación para conservar totales
-- coherentes y evitar que se modifique inventario ya comprometido.
create or replace function private.editar_pedido_y_detalle_seguro(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_pedido public.pedidos;
  v_subtotal numeric(14,2);
  v_total numeric(14,2);
  v_pagado numeric(14,2);
  v_actualizar_lineas boolean := coalesce(jsonb_typeof(p_datos->'lineas') = 'array', false);
  v_linea jsonb;
  v_producto public.productos;
  v_cantidad integer;
begin
  if v_usuario is null or not private.tiene_modulo_crm('pedidos') then
    raise exception 'No autorizado para editar pedidos';
  end if;

  select * into v_pedido
  from public.pedidos
  where id = nullif(p_datos->>'pedido_id', '')::uuid
  for update;

  if not found then
    raise exception 'Pedido no disponible';
  end if;
  if v_pedido.estado = 'Cancelado' then
    raise exception 'No puedes editar un pedido cancelado';
  end if;
  if exists (select 1 from public.facturas where pedido_id = v_pedido.id) then
    raise exception 'No puedes modificar un pedido que ya tiene una factura FEL';
  end if;

  if v_actualizar_lineas then
    if v_pedido.estado <> 'Pendiente' then
      raise exception 'Los productos solo se pueden modificar mientras el pedido esté Pendiente. Si ya inició producción, crea un ajuste controlado.';
    end if;
    if jsonb_array_length(p_datos->'lineas') = 0 then
      raise exception 'El pedido debe tener al menos un producto';
    end if;

    for v_linea in select value from jsonb_array_elements(p_datos->'lineas') loop
      v_cantidad := nullif(v_linea->>'cantidad', '')::integer;
      if v_cantidad is null or v_cantidad < 1 then
        raise exception 'Cada producto debe tener una cantidad de al menos 1';
      end if;
      select * into v_producto
      from public.productos
      where id = nullif(v_linea->>'producto_id', '')::uuid
        and coalesce(estado, 'Activo') = 'Activo';
      if not found then
        raise exception 'Uno de los productos seleccionados ya no está disponible';
      end if;
    end loop;

    delete from public.pedido_detalle where pedido_id = v_pedido.id;
    insert into public.pedido_detalle(pedido_id, producto_id, cantidad, precio, costo)
    select
      v_pedido.id,
      (value->>'producto_id')::uuid,
      (value->>'cantidad')::integer,
      producto.precio_venta,
      producto.costo
    from jsonb_array_elements(p_datos->'lineas')
    join public.productos producto on producto.id = (value->>'producto_id')::uuid;

    select coalesce(sum(cantidad * precio), 0) into v_subtotal
    from public.pedido_detalle where pedido_id = v_pedido.id;
  else
    v_subtotal := coalesce(v_pedido.subtotal_productos, v_pedido.total - coalesce(v_pedido.costo_envio, 0));
  end if;

  v_total := v_subtotal + greatest(coalesce(nullif(p_datos->>'costo_envio', '')::numeric, v_pedido.costo_envio, 0), 0);
  select coalesce(sum(monto), 0) into v_pagado from public.pagos where pedido_id = v_pedido.id;
  if v_total < v_pagado then
    raise exception 'El total no puede ser menor a los pagos ya registrados';
  end if;

  update public.pedidos set
    forma_pago = coalesce(nullif(trim(p_datos->>'forma_pago'), ''), forma_pago),
    fecha_entrega = coalesce(nullif(p_datos->>'fecha_entrega', '')::date, fecha_entrega),
    hora_entrega = coalesce(nullif(trim(p_datos->>'hora_entrega'), ''), hora_entrega),
    direccion = nullif(trim(coalesce(p_datos->>'direccion', direccion)), ''),
    departamento_entrega = nullif(trim(coalesce(p_datos->>'departamento_entrega', departamento_entrega)), ''),
    municipio_entrega = nullif(trim(coalesce(p_datos->>'municipio_entrega', municipio_entrega)), ''),
    zona_entrega = nullif(trim(coalesce(p_datos->>'zona_entrega', zona_entrega)), ''),
    observaciones = nullif(trim(coalesce(p_datos->>'observaciones', observaciones)), ''),
    vendedor = nullif(trim(coalesce(p_datos->>'vendedor', vendedor)), ''),
    subtotal_productos = v_subtotal,
    costo_envio = greatest(coalesce(nullif(p_datos->>'costo_envio', '')::numeric, costo_envio, 0), 0),
    total = v_total,
    saldo_pendiente = greatest(0, v_total - v_pagado)
  where id = v_pedido.id;

  return jsonb_build_object('pedido_id', v_pedido.id, 'subtotal', v_subtotal, 'total', v_total, 'saldo', greatest(0, v_total - v_pagado));
end;
$$;

create or replace function public.editar_pedido_y_detalle_seguro(p_datos jsonb)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.editar_pedido_y_detalle_seguro(p_datos);
$$;

revoke all on function public.editar_pedido_y_detalle_seguro(jsonb) from public, anon;
revoke all on function private.editar_pedido_y_detalle_seguro(jsonb) from public, anon;
grant execute on function public.editar_pedido_y_detalle_seguro(jsonb) to authenticated;
grant execute on function private.editar_pedido_y_detalle_seguro(jsonb) to authenticated;
