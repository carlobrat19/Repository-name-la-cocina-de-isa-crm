-- Reactivar una cancelación accidental sin inventar pagos ni volver a consumir inventario.
-- Solo vuelve a Pendiente; las etapas posteriores siguen pasando por
-- cambiar_estado_pedido_seguro, con sus validaciones de producción.
create or replace function public.reactivar_pedido_cancelado(p_pedido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_pedido public.pedidos;
  v_pagado numeric(14,2);
  v_fecha date := (now() at time zone 'America/Guatemala')::date;
  v_pago_estado text;
begin
  if (select auth.uid()) is null
     or not (private.tiene_modulo_crm('pedidos') or private.tiene_modulo_crm('produccion')) then
    raise exception 'No autorizado para reactivar pedidos';
  end if;

  select * into v_pedido
  from public.pedidos
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;
  if v_pedido.estado <> 'Cancelado' then
    raise exception 'Solo se pueden reactivar pedidos cancelados';
  end if;

  select coalesce(sum(monto), 0) into v_pagado
  from public.pagos
  where pedido_id = p_pedido_id;

  v_pago_estado := case
    when v_pagado >= v_pedido.total then 'Pagado'
    when v_pagado > 0 then 'Pago parcial'
    else 'Pendiente'
  end;

  update public.pedidos
  set estado = 'Pendiente',
      fecha_entrega = v_fecha,
      saldo_pendiente = greatest(0, v_pedido.total - v_pagado),
      pago_estado = v_pago_estado,
      estado_pago = v_pago_estado
  where id = p_pedido_id;

  return jsonb_build_object(
    'pedido_id', p_pedido_id,
    'estado', 'Pendiente',
    'fecha_entrega', v_fecha,
    'pago_estado', v_pago_estado,
    'pagado', v_pagado,
    'saldo_pendiente', greatest(0, v_pedido.total - v_pagado)
  );
end;
$$;

revoke all on function public.reactivar_pedido_cancelado(uuid) from public, anon;
grant execute on function public.reactivar_pedido_cancelado(uuid) to authenticated;
