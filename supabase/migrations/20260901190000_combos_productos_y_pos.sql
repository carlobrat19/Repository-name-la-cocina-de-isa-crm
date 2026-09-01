-- Combos y boxes: se venden como un producto, pero consumen existencias de
-- sus componentes. No se duplica una receta ni se crea inventario ficticio.

alter table public.productos
  add column if not exists tipo_producto text not null default 'preparado'
    check (tipo_producto in ('preparado', 'reventa', 'combo')),
  add column if not exists costo_adicional_combo numeric(14,4) not null default 0
    check (costo_adicional_combo >= 0);

create table if not exists public.combo_componentes (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.productos(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  cantidad numeric(14,3) not null check (cantidad > 0),
  created_at timestamptz not null default now(),
  unique (combo_id, producto_id),
  check (combo_id <> producto_id)
);

create index if not exists combo_componentes_combo_idx on public.combo_componentes(combo_id);
create index if not exists combo_componentes_producto_idx on public.combo_componentes(producto_id);

create or replace function private.validar_componente_combo()
returns trigger language plpgsql set search_path = public, private as $$
declare v_tipo text;
begin
  select tipo_producto into v_tipo from public.productos where id = new.combo_id;
  if v_tipo is distinct from 'combo' then
    raise exception 'El producto principal debe ser de tipo Combo / box';
  end if;
  select tipo_producto into v_tipo from public.productos where id = new.producto_id;
  if v_tipo = 'combo' then
    raise exception 'Un combo no puede incluir otro combo';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_componente_combo on public.combo_componentes;
create trigger validar_componente_combo
before insert or update on public.combo_componentes
for each row execute function private.validar_componente_combo();

alter table public.combo_componentes enable row level security;
revoke all on public.combo_componentes from anon;
grant select, insert, update, delete on public.combo_componentes to authenticated;

create policy "combo componentes consulta" on public.combo_componentes for select to authenticated
using (
  private.tiene_modulo_crm('productos')
  or private.tiene_modulo_crm('recetas_costos')
  or private.tiene_modulo_crm('punto_venta')
  or private.tiene_modulo_crm('produccion')
  or private.tiene_modulo_crm('sucursales')
);
create policy "combo componentes administra catalogo" on public.combo_componentes for all to authenticated
using (private.tiene_modulo_crm('productos'))
with check (private.tiene_modulo_crm('productos'));

-- Sustituye el cobro POS: para un combo valida y descuenta cada producto
-- incluido. El detalle conserva el nombre de la box vendida para reportes.
create or replace function private.registrar_venta_pos(
  p_sucursal_id uuid, p_turno_id uuid, p_items jsonb, p_metodo text,
  p_cliente_id uuid default null, p_cliente text default 'Consumidor final',
  p_telefono text default null, p_referencia text default null
)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_usuario uuid := (select auth.uid());
  v_turno public.turnos_caja_pos;
  v_item jsonb; v_producto public.productos; v_componente record;
  v_inventario public.inventario_sucursal_productos;
  v_cantidad numeric(14,3); v_requerida numeric(14,3);
  v_consumos jsonb := '{}'::jsonb;
  v_clave text; v_valor text;
  v_total numeric(14,2) := 0; v_pedido_id uuid; v_pago_id uuid; v_venta_id uuid; v_codigo text;
begin
  if v_usuario is null or not private.tiene_modulo_crm('punto_venta') then raise exception 'No autorizado para registrar ventas de punto de venta'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Agrega al menos un producto al cobro'; end if;
  select * into v_turno from public.turnos_caja_pos where id = p_turno_id and sucursal_id = p_sucursal_id and cajero_id = v_usuario and estado = 'abierto' for update;
  if not found then raise exception 'Abre tu caja antes de cobrar en esta sucursal'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := coalesce((v_item->>'cantidad')::numeric, 0);
    if v_cantidad <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;
    select * into v_producto from public.productos where id = (v_item->>'producto_id')::uuid and estado = 'Activo';
    if not found then raise exception 'Uno de los productos ya no está disponible'; end if;
    v_total := v_total + round(v_producto.precio_venta * v_cantidad, 2);
    if v_producto.tipo_producto = 'combo' then
      if not exists (select 1 from public.combo_componentes where combo_id = v_producto.id) then raise exception 'El combo % no tiene componentes configurados', v_producto.nombre; end if;
      for v_componente in select producto_id, cantidad from public.combo_componentes where combo_id = v_producto.id loop
        v_requerida := v_cantidad * v_componente.cantidad;
        v_consumos := jsonb_set(v_consumos, array[v_componente.producto_id::text], to_jsonb(coalesce((v_consumos ->> v_componente.producto_id::text)::numeric, 0) + v_requerida), true);
      end loop;
    else
      v_consumos := jsonb_set(v_consumos, array[v_producto.id::text], to_jsonb(coalesce((v_consumos ->> v_producto.id::text)::numeric, 0) + v_cantidad), true);
    end if;
  end loop;

  for v_clave, v_valor in select key, value from jsonb_each_text(v_consumos) loop
    select * into v_inventario from public.inventario_sucursal_productos where sucursal_id = p_sucursal_id and producto_id = v_clave::uuid for update;
    if not found or v_inventario.existencia < v_valor::numeric then
      raise exception 'Existencia insuficiente para %', (select nombre from public.productos where id = v_clave::uuid);
    end if;
  end loop;

  v_codigo := 'PV-' || lpad(nextval('public.folio_venta_pos_seq')::text, 6, '0');
  insert into public.pedidos (codigo, cliente_id, cliente, telefono, fecha_pedido, fecha_entrega, fecha_creacion, estado, pago_estado, estado_pago, metodo_pago, forma_pago, total, subtotal_productos, saldo_pendiente, tipo_documento, canal_origen, requiere_envio, creado_por)
  values (v_codigo, p_cliente_id, coalesce(nullif(trim(p_cliente), ''), 'Consumidor final'), nullif(trim(p_telefono), ''), current_date, current_date, now(), 'Entregado', 'Pagado', 'Pagado', coalesce(nullif(trim(p_metodo), ''), 'Efectivo'), coalesce(nullif(trim(p_metodo), ''), 'Efectivo'), v_total, v_total, 0, 'Pedido POS', 'POS', false, v_usuario) returning id into v_pedido_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := (v_item->>'cantidad')::numeric;
    select * into v_producto from public.productos where id = (v_item->>'producto_id')::uuid;
    insert into public.pedido_detalle (pedido_id, producto_id, cantidad, precio, costo) values (v_pedido_id, v_producto.id, v_cantidad::integer, v_producto.precio_venta, v_producto.costo);
    if v_producto.tipo_producto = 'combo' then
      for v_componente in select cc.producto_id, cc.cantidad, p.costo, p.nombre from public.combo_componentes cc join public.productos p on p.id = cc.producto_id where cc.combo_id = v_producto.id loop
        v_requerida := v_cantidad * v_componente.cantidad;
        update public.inventario_sucursal_productos set existencia = existencia - v_requerida, updated_at = now() where sucursal_id = p_sucursal_id and producto_id = v_componente.producto_id;
        insert into public.movimientos_inventario_sucursal (sucursal_id, producto_id, tipo, cantidad, costo_unitario, referencia, observaciones, creado_por)
        values (p_sucursal_id, v_componente.producto_id, 'venta_pos', -v_requerida, coalesce(v_componente.costo, 0), v_codigo, 'Componente de combo: ' || v_producto.nombre, v_usuario);
      end loop;
    else
      update public.inventario_sucursal_productos set existencia = existencia - v_cantidad, updated_at = now() where sucursal_id = p_sucursal_id and producto_id = v_producto.id;
      insert into public.movimientos_inventario_sucursal (sucursal_id, producto_id, tipo, cantidad, costo_unitario, referencia, creado_por)
      values (p_sucursal_id, v_producto.id, 'venta_pos', -v_cantidad, coalesce(v_producto.costo, 0), v_codigo, null, v_usuario);
    end if;
  end loop;
  insert into public.pagos (pedido_id, cliente_id, monto, metodo, referencia, fecha) values (v_pedido_id, p_cliente_id, v_total, coalesce(nullif(trim(p_metodo), ''), 'Efectivo'), nullif(trim(p_referencia), ''), current_date) returning id into v_pago_id;
  update public.movimientos_caja movimiento set cuenta_id = v_turno.cuenta_id, cuenta = (select nombre from public.cuentas_financieras where id = v_turno.cuenta_id), creado_por = v_usuario where movimiento.origen = 'pago' and movimiento.origen_id = v_pago_id;
  insert into public.ventas_pos (pedido_id, sucursal_id, turno_id, pago_id, cajero_id, total) values (v_pedido_id, p_sucursal_id, p_turno_id, v_pago_id, v_usuario, v_total) returning id into v_venta_id;
  return jsonb_build_object('venta_id', v_venta_id, 'pedido_id', v_pedido_id, 'codigo', v_codigo, 'total', v_total);
end;
$$;

revoke all on function private.registrar_venta_pos(uuid, uuid, jsonb, text, uuid, text, text, text) from public, anon;
grant execute on function private.registrar_venta_pos(uuid, uuid, jsonb, text, uuid, text, text, text) to authenticated;
