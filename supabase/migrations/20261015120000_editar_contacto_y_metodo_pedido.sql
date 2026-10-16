-- Edita el pedido y la ficha del cliente vinculado en una sola transacción.
-- Los pagos registrados conservan su método histórico.
create or replace function private.editar_pedido_con_cliente_seguro(p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_pedido public.pedidos;
  v_cliente text := nullif(trim(p_datos->>'cliente'), '');
  v_telefono text := nullif(trim(p_datos->>'telefono'), '');
  v_metodo text := nullif(trim(p_datos->>'forma_pago'), '');
  v_resultado jsonb;
begin
  if (select auth.uid()) is null or not private.tiene_modulo_crm('pedidos') then
    raise exception 'No autorizado para editar pedidos';
  end if;

  select * into v_pedido from public.pedidos
  where id = nullif(p_datos->>'pedido_id', '')::uuid for update;
  if not found then raise exception 'Pedido no disponible'; end if;
  if v_cliente is null then raise exception 'El nombre del cliente es obligatorio'; end if;
  if v_metodo not in ('Efectivo', 'Transferencia', 'Tarjeta', 'Link de pago', 'POS')
     and v_metodo is distinct from v_pedido.forma_pago then
    raise exception 'Método de pago no válido';
  end if;

  -- La función existente valida estado, facturación, productos y saldos.
  v_resultado := private.editar_pedido_y_detalle_seguro(p_datos);

  if v_pedido.cliente_id is null
     and (v_cliente is distinct from v_pedido.cliente or v_telefono is distinct from v_pedido.telefono) then
    raise exception 'Este pedido no tiene un cliente vinculado; no se puede sincronizar su nombre o teléfono';
  end if;

  if v_pedido.cliente_id is not null then
    update public.clientes set
      nombre = v_cliente,
      telefono = v_telefono,
      email = case when p_datos ? 'correo_fiscal' then nullif(trim(p_datos->>'correo_fiscal'), '') else email end,
      nit = case when p_datos ? 'nit' then nullif(trim(p_datos->>'nit'), '') else nit end,
      razon_social = case when p_datos ? 'razon_social' then nullif(trim(p_datos->>'razon_social'), '') else razon_social end,
      direccion = case when p_datos ? 'direccion_fiscal' then nullif(trim(p_datos->>'direccion_fiscal'), '') else direccion end,
      updated_at = now()
    where id = v_pedido.cliente_id;
    if not found then raise exception 'No se encontró la ficha del cliente vinculado'; end if;
  end if;

  update public.pedidos set
    cliente = v_cliente,
    telefono = v_telefono,
    forma_pago = coalesce(v_metodo, forma_pago),
    metodo_pago = coalesce(v_metodo, metodo_pago)
  where id = v_pedido.id;

  return v_resultado;
end;
$$;

create or replace function public.editar_pedido_con_cliente_seguro(p_datos jsonb)
returns jsonb language sql security invoker set search_path = public, private as $$
  select private.editar_pedido_con_cliente_seguro(p_datos);
$$;

revoke all on function public.editar_pedido_con_cliente_seguro(jsonb) from public, anon;
revoke all on function private.editar_pedido_con_cliente_seguro(jsonb) from public, anon;
grant execute on function public.editar_pedido_con_cliente_seguro(jsonb) to authenticated;
grant execute on function private.editar_pedido_con_cliente_seguro(jsonb) to authenticated;
