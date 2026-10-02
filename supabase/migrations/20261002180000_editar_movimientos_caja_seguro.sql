-- Corrige movimientos manuales y, para los automáticos, sincroniza el origen.
create or replace function private.editar_movimiento_caja_seguro(p_movimiento_id uuid, p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_movimiento public.movimientos_caja%rowtype;
  v_cuenta public.cuentas_financieras%rowtype;
  v_destino public.cuentas_financieras%rowtype;
  v_tipo text;
  v_metodo text;
  v_monto numeric;
  v_fecha date;
  v_destino_id uuid;
begin
  if (select auth.uid()) is null or not private.tiene_modulo_crm('flujo_caja') then
    raise exception 'No autorizado para editar movimientos';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Datos inválidos';
  end if;

  select * into v_movimiento from public.movimientos_caja where id = p_movimiento_id for update;
  if not found then raise exception 'Movimiento no encontrado'; end if;

  select * into v_cuenta from public.cuentas_financieras
  where id = nullif(p_datos->>'cuenta_id', '')::uuid and activa;
  if not found then raise exception 'Selecciona una cuenta activa'; end if;
  v_metodo := nullif(trim(p_datos->>'metodo_pago'), '');
  if v_metodo is null then raise exception 'Selecciona un medio de pago'; end if;

  if coalesce(v_movimiento.origen, 'manual') = 'manual' then
    v_tipo := p_datos->>'tipo';
    if v_tipo not in ('Ingreso', 'Gasto', 'Transferencia') then raise exception 'Tipo inválido'; end if;
    v_monto := nullif(p_datos->>'monto', '')::numeric;
    if v_monto is null or v_monto <= 0 then raise exception 'Monto inválido'; end if;
    v_fecha := nullif(p_datos->>'fecha', '')::date;
    if v_fecha is null then raise exception 'Fecha obligatoria'; end if;
    v_destino_id := nullif(p_datos->>'cuenta_destino_id', '')::uuid;
    if v_tipo = 'Transferencia' then
      select * into v_destino from public.cuentas_financieras where id = v_destino_id and activa;
      if not found or v_destino.id = v_cuenta.id then raise exception 'Selecciona otra cuenta de destino activa'; end if;
    else
      v_destino_id := null;
    end if;
    update public.movimientos_caja set
      tipo = v_tipo,
      categoria = nullif(trim(p_datos->>'categoria'), ''),
      descripcion = nullif(trim(p_datos->>'descripcion'), ''),
      monto = round(v_monto, 2),
      fecha = v_fecha,
      cuenta = v_cuenta.nombre,
      cuenta_id = v_cuenta.id,
      cuenta_destino_id = v_destino_id,
      metodo_pago = v_metodo
    where id = v_movimiento.id;
  elsif v_movimiento.origen = 'pago' then
    if exists (select 1 from public.movimientos_caja_pos where movimiento_caja_id = v_movimiento.id) then
      raise exception 'Los cobros de punto de venta se corrigen desde el cierre de caja';
    end if;
    update public.pagos set metodo = v_metodo where id = v_movimiento.origen_id;
    if not found then raise exception 'No se encontró el cobro original'; end if;
    update public.movimientos_caja set
      cuenta = v_cuenta.nombre, cuenta_id = v_cuenta.id, metodo_pago = v_metodo
    where id = v_movimiento.id;
  elsif v_movimiento.origen = 'compra_ingrediente' then
    update public.compras_ingredientes set metodo_pago = v_metodo, cuenta_pago = v_cuenta.nombre
    where id = v_movimiento.origen_id and tipo = 'compra';
    if not found then raise exception 'No se encontró la compra original'; end if;
    update public.movimientos_caja set
      cuenta = v_cuenta.nombre, cuenta_id = v_cuenta.id, metodo_pago = v_metodo
    where id = v_movimiento.id;
  else
    raise exception 'Este origen no admite edición desde Flujo de caja';
  end if;

  return jsonb_build_object('id', v_movimiento.id, 'origen', coalesce(v_movimiento.origen, 'manual'));
end;
$$;

create or replace function public.editar_movimiento_caja_seguro(p_movimiento_id uuid, p_datos jsonb)
returns jsonb language sql security invoker set search_path = public, private as $$
  select private.editar_movimiento_caja_seguro($1, $2);
$$;

revoke all on function private.editar_movimiento_caja_seguro(uuid, jsonb) from public, anon;
revoke all on function public.editar_movimiento_caja_seguro(uuid, jsonb) from public, anon;
grant execute on function private.editar_movimiento_caja_seguro(uuid, jsonb) to authenticated;
grant execute on function public.editar_movimiento_caja_seguro(uuid, jsonb) to authenticated;
