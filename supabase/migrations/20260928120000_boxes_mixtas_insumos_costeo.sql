-- Una box admite productos y materias primas directas sin crear productos ficticios.
alter table public.productos
  add column if not exists combo_merma_pct numeric(8,4) not null default 0 check (combo_merma_pct >= 0),
  add column if not exists combo_indirectos_pct numeric(8,4) not null default 0 check (combo_indirectos_pct >= 0),
  add column if not exists combo_ganancia_pct numeric(8,4) not null default 0 check (combo_ganancia_pct >= 0),
  add column if not exists combo_comision_pct numeric(8,4) not null default 0 check (combo_comision_pct >= 0 and combo_comision_pct < 1),
  add column if not exists combo_iva_pct numeric(8,4) not null default 0.12 check (combo_iva_pct >= 0);

create table public.combo_ingredientes (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.productos(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id) on delete restrict,
  cantidad numeric(14,3) not null check (cantidad > 0),
  created_at timestamptz not null default now(),
  unique (combo_id, ingrediente_id)
);
create index combo_ingredientes_ingrediente_idx on public.combo_ingredientes(ingrediente_id);
alter table public.combo_ingredientes enable row level security;
revoke all on public.combo_ingredientes from anon;
grant select, insert, update, delete on public.combo_ingredientes to authenticated;
create policy "box insumos consulta" on public.combo_ingredientes for select to authenticated
using (private.tiene_modulo_crm('productos') or private.tiene_modulo_crm('produccion') or private.tiene_modulo_crm('punto_venta'));
create policy "box insumos administra" on public.combo_ingredientes for all to authenticated
using (private.tiene_modulo_crm('productos')) with check (private.tiene_modulo_crm('productos'));
create policy "pos consulta existencias de insumos" on public.ingredientes for select to authenticated
using (private.tiene_modulo_crm('punto_venta'));

create or replace function private.validar_combo_ingrediente()
returns trigger language plpgsql set search_path = public, private as $$
begin
  if not exists (select 1 from public.productos where id = new.combo_id and tipo_producto = 'combo') then
    raise exception 'Solo un producto de tipo Combo / box puede tener insumos directos';
  end if;
  return new;
end;
$$;
create trigger validar_combo_ingrediente before insert or update on public.combo_ingredientes
for each row execute function private.validar_combo_ingrediente();

create or replace function private.guardar_composicion_combo(
  p_combo_id uuid, p_productos jsonb, p_ingredientes jsonb
) returns void language plpgsql security definer set search_path = public, private as $$
declare v_tipo text;
begin
  if (select auth.uid()) is null or not private.tiene_modulo_crm('productos') then
    raise exception 'No autorizado para editar productos';
  end if;
  select tipo_producto into v_tipo from public.productos where id = p_combo_id for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if jsonb_typeof(p_productos) <> 'array' or jsonb_typeof(p_ingredientes) <> 'array' then
    raise exception 'Composición inválida';
  end if;
  if v_tipo <> 'combo' and (jsonb_array_length(p_productos) > 0 or jsonb_array_length(p_ingredientes) > 0) then
    raise exception 'Solo una box puede tener componentes';
  end if;
  delete from public.combo_componentes where combo_id = p_combo_id;
  delete from public.combo_ingredientes where combo_id = p_combo_id;
  insert into public.combo_componentes(combo_id, producto_id, cantidad)
  select p_combo_id, producto_id, cantidad
  from jsonb_to_recordset(p_productos) as item(producto_id uuid, cantidad numeric);
  insert into public.combo_ingredientes(combo_id, ingrediente_id, cantidad)
  select p_combo_id, ingrediente_id, cantidad
  from jsonb_to_recordset(p_ingredientes) as item(ingrediente_id uuid, cantidad numeric);
end;
$$;
revoke all on function private.guardar_composicion_combo(uuid,jsonb,jsonb) from public, anon;
create or replace function public.guardar_composicion_combo(uuid,jsonb,jsonb)
returns void language sql security invoker set search_path = public, private as $$
  select private.guardar_composicion_combo($1,$2,$3);
$$;
revoke all on function public.guardar_composicion_combo(uuid,jsonb,jsonb) from public, anon;
grant execute on function private.guardar_composicion_combo(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.guardar_composicion_combo(uuid,jsonb,jsonb) to authenticated;

-- Bitácora independiente: evita volver a consumir si un pedido regresa a Producción.
create table public.combo_consumos_pedido (
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  origen text not null check (origen in ('produccion', 'pos')),
  ingrediente_id uuid not null references public.ingredientes(id) on delete restrict,
  cantidad numeric(14,3) not null check (cantidad > 0),
  costo_unitario numeric(14,6) not null,
  created_at timestamptz not null default now(),
  primary key (pedido_id, origen, ingrediente_id)
);
alter table public.combo_consumos_pedido enable row level security;
revoke all on public.combo_consumos_pedido from anon, authenticated;
grant select on public.combo_consumos_pedido to authenticated;
create policy "box consumos consulta" on public.combo_consumos_pedido for select to authenticated
using (private.tiene_modulo_crm('produccion') or private.tiene_modulo_crm('pedidos') or private.tiene_modulo_crm('reportes') or private.tiene_modulo_crm('punto_venta'));

create or replace function private.consumir_insumos_directos_box(
  p_pedido_id uuid, p_origen text, p_produccion_id uuid default null, p_producto_id uuid default null, p_cantidad numeric default null
) returns void language plpgsql security definer set search_path = public, private as $$
declare v_insumo record; v_codigo text; v_usuario uuid := (select auth.uid());
begin
  if p_origen not in ('produccion', 'pos') then raise exception 'Origen de consumo inválido'; end if;
  if v_usuario is null or not (
    (p_origen = 'produccion' and (private.tiene_modulo_crm('pedidos') or private.tiene_modulo_crm('produccion')))
    or (p_origen = 'pos' and private.tiene_modulo_crm('punto_venta'))
  ) then raise exception 'No autorizado para consumir insumos de una box'; end if;
  if p_origen = 'produccion' and exists (
    select 1 from public.combo_consumos_pedido where pedido_id = p_pedido_id and origen = 'produccion'
  ) then return; end if;
  select codigo into v_codigo from public.pedidos where id = p_pedido_id;
  for v_insumo in
    with necesarios as (
      select ci.ingrediente_id, sum(ci.cantidad * detalle.cantidad) as cantidad
      from public.pedido_detalle detalle
      join public.combo_ingredientes ci on ci.combo_id = detalle.producto_id
      where p_origen = 'produccion' and detalle.pedido_id = p_pedido_id
      group by ci.ingrediente_id
      union all
      select ci.ingrediente_id, ci.cantidad * p_cantidad
      from public.combo_ingredientes ci
      where p_origen = 'pos' and ci.combo_id = p_producto_id
    )
    , totales as (
      select ingrediente_id, sum(cantidad) as cantidad from necesarios group by ingrediente_id
    )
    select ingrediente.id, ingrediente.nombre, ingrediente.stock_actual, ingrediente.costo_referencia,
           totales.cantidad
    from totales join public.ingredientes ingrediente on ingrediente.id = totales.ingrediente_id
    order by ingrediente.id for update of ingrediente
  loop
    if coalesce(v_insumo.stock_actual, 0) < v_insumo.cantidad then
      raise exception 'Inventario insuficiente de % para la box: necesitas %, hay %',
        v_insumo.nombre, round(v_insumo.cantidad, 3), round(v_insumo.stock_actual, 3);
    end if;
    update public.ingredientes set stock_actual = stock_actual - v_insumo.cantidad, updated_at = now() where id = v_insumo.id;
    insert into public.combo_consumos_pedido(pedido_id, origen, ingrediente_id, cantidad, costo_unitario)
    values (p_pedido_id, p_origen, v_insumo.id, v_insumo.cantidad, v_insumo.costo_referencia)
    on conflict (pedido_id, origen, ingrediente_id) do update
      set cantidad = public.combo_consumos_pedido.cantidad + excluded.cantidad;
    insert into public.compras_ingredientes(ingrediente_id, tipo, cantidad, costo_unitario, total, nota, creado_por)
    values (v_insumo.id, 'consumo_produccion', -v_insumo.cantidad, v_insumo.costo_referencia,
      round(v_insumo.cantidad * v_insumo.costo_referencia, 2),
      'Insumo directo de box ' || coalesce(v_codigo, p_pedido_id::text) || ' · ' || p_origen, v_usuario);
    if p_produccion_id is not null then
      insert into public.produccion_pedido_ingredientes(produccion_pedido_id, ingrediente_id, cantidad, costo_unitario, costo_total)
      values (p_produccion_id, v_insumo.id, v_insumo.cantidad, v_insumo.costo_referencia,
        round(v_insumo.cantidad * v_insumo.costo_referencia, 2))
      on conflict (produccion_pedido_id, ingrediente_id) do update set
        cantidad = public.produccion_pedido_ingredientes.cantidad + excluded.cantidad,
        costo_total = public.produccion_pedido_ingredientes.costo_total + excluded.costo_total;
      update public.produccion_pedidos set costo_total = costo_total + round(v_insumo.cantidad * v_insumo.costo_referencia, 2)
      where id = p_produccion_id;
    end if;
  end loop;
end;
$$;
revoke all on function private.consumir_insumos_directos_box(uuid,text,uuid,uuid,numeric) from public, anon, authenticated;

create or replace function private.consumir_box_al_iniciar_produccion()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare v_produccion_id uuid;
begin
  if new.estado = 'Producción' and old.estado is distinct from 'Producción' then
    select id into v_produccion_id from public.produccion_pedidos where pedido_id = new.id;
    if v_produccion_id is not null then
      perform private.consumir_insumos_directos_box(new.id, 'produccion', v_produccion_id);
    end if;
  end if;
  return new;
end;
$$;
create trigger consumir_box_al_iniciar_produccion after update of estado on public.pedidos
for each row execute function private.consumir_box_al_iniciar_produccion();

-- La venta POS se entrega sin pasar por Producción: consume estos insumos una sola vez al insertar la línea.
create or replace function private.consumir_box_en_pos()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if exists (select 1 from public.pedidos where id = new.pedido_id and canal_origen = 'POS')
     and exists (select 1 from public.combo_ingredientes where combo_id = new.producto_id) then
    perform private.consumir_insumos_directos_box(new.pedido_id, 'pos', null, new.producto_id, new.cantidad);
  end if;
  return new;
end;
$$;
create trigger consumir_box_en_pos after insert on public.pedido_detalle
for each row execute function private.consumir_box_en_pos();

-- La pantalla POS usa esta firma con datos fiscales. Valida inventario de cada
-- producto componente y deja que el trigger anterior consuma insumos directos.
create or replace function private.registrar_venta_pos(
  p_sucursal_id uuid, p_turno_id uuid, p_items jsonb, p_metodo text,
  p_cliente_id uuid default null, p_cliente text default 'Consumidor final',
  p_telefono text default null, p_referencia text default null, p_nit text default null,
  p_razon_social text default null, p_direccion_fiscal text default null
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_usuario uuid := (select auth.uid());
  v_turno public.turnos_caja_pos;
  v_item jsonb;
  v_producto public.productos;
  v_componente record;
  v_inventario public.inventario_sucursal_productos;
  v_cantidad numeric(14,3);
  v_requerida numeric(14,3);
  v_consumos jsonb := '{}'::jsonb;
  v_clave text; v_valor text;
  v_total numeric(14,2) := 0;
  v_pedido_id uuid; v_pago_id uuid; v_venta_id uuid; v_codigo text;
  v_cliente_id uuid := p_cliente_id;
begin
  if v_usuario is null or not private.tiene_modulo_crm('punto_venta')
     or not private.puede_operar_sucursal(p_sucursal_id) then
    raise exception 'No autorizado para esta sucursal';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto';
  end if;
  select * into v_turno from public.turnos_caja_pos
  where id = p_turno_id and sucursal_id = p_sucursal_id and cajero_id = v_usuario and estado = 'abierto'
  for update;
  if not found then raise exception 'Abre tu caja antes de cobrar'; end if;

  if nullif(trim(p_nit), '') is not null or nullif(trim(p_telefono), '') is not null
     or lower(coalesce(trim(p_cliente), '')) <> 'consumidor final' then
    if v_cliente_id is null then
      select id into v_cliente_id from public.clientes
      where (nullif(trim(p_nit), '') is not null and nit = trim(p_nit))
         or (nullif(trim(p_telefono), '') is not null and telefono = trim(p_telefono))
      order by updated_at desc limit 1;
    end if;
    if v_cliente_id is null then
      insert into public.clientes(nombre, telefono, nit, razon_social, direccion, canal_origen)
      values(coalesce(nullif(trim(p_cliente), ''), 'Consumidor final'), nullif(trim(p_telefono), ''),
        nullif(trim(p_nit), ''), nullif(trim(p_razon_social), ''), nullif(trim(p_direccion_fiscal), ''), 'POS')
      returning id into v_cliente_id;
    else
      update public.clientes set
        nombre = coalesce(nullif(trim(p_cliente), ''), nombre),
        telefono = coalesce(nullif(trim(p_telefono), ''), telefono),
        nit = coalesce(nullif(trim(p_nit), ''), nit),
        razon_social = coalesce(nullif(trim(p_razon_social), ''), razon_social),
        direccion = coalesce(nullif(trim(p_direccion_fiscal), ''), direccion), updated_at = now()
      where id = v_cliente_id;
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := coalesce((v_item->>'cantidad')::numeric, 0);
    if v_cantidad <= 0 or v_cantidad <> trunc(v_cantidad) then raise exception 'Cantidad inválida'; end if;
    select p.* into v_producto from public.productos p
    join public.catalogo_sucursal_productos c on c.producto_id = p.id
      and c.sucursal_id = p_sucursal_id and c.disponible
    where p.id = (v_item->>'producto_id')::uuid and p.estado = 'Activo';
    if not found then raise exception 'Producto no habilitado en esta sucursal'; end if;
    v_total := v_total + round(coalesce((select precio_venta from public.catalogo_sucursal_productos
      where sucursal_id = p_sucursal_id and producto_id = v_producto.id), v_producto.precio_venta) * v_cantidad, 2);
    if v_producto.tipo_producto = 'combo' then
      if not exists (select 1 from public.combo_componentes where combo_id = v_producto.id)
         and not exists (select 1 from public.combo_ingredientes where combo_id = v_producto.id) then
        raise exception 'La box % no tiene componentes', v_producto.nombre;
      end if;
      for v_componente in select producto_id, cantidad from public.combo_componentes where combo_id = v_producto.id loop
        v_requerida := v_cantidad * v_componente.cantidad;
        v_consumos := jsonb_set(v_consumos, array[v_componente.producto_id::text],
          to_jsonb(coalesce((v_consumos ->> v_componente.producto_id::text)::numeric, 0) + v_requerida), true);
      end loop;
    else
      v_consumos := jsonb_set(v_consumos, array[v_producto.id::text],
        to_jsonb(coalesce((v_consumos ->> v_producto.id::text)::numeric, 0) + v_cantidad), true);
    end if;
  end loop;

  for v_clave, v_valor in select key, value from jsonb_each_text(v_consumos) loop
    select * into v_inventario from public.inventario_sucursal_productos
    where sucursal_id = p_sucursal_id and producto_id = v_clave::uuid for update;
    if not found or v_inventario.existencia < v_valor::numeric then
      raise exception 'Existencia insuficiente para %', (select nombre from public.productos where id = v_clave::uuid);
    end if;
  end loop;

  v_codigo := 'PV-' || lpad(nextval('public.folio_venta_pos_seq')::text, 6, '0');
  insert into public.pedidos(codigo, cliente_id, cliente, telefono, fecha_pedido, fecha_entrega,
    fecha_creacion, estado, pago_estado, estado_pago, metodo_pago, forma_pago, total,
    subtotal_productos, saldo_pendiente, tipo_documento, canal_origen, requiere_envio, creado_por)
  values(v_codigo, v_cliente_id, coalesce(nullif(trim(p_cliente), ''), 'Consumidor final'),
    nullif(trim(p_telefono), ''), current_date, current_date, now(), 'Entregado', 'Pagado', 'Pagado',
    coalesce(nullif(trim(p_metodo), ''), 'Efectivo'), coalesce(nullif(trim(p_metodo), ''), 'Efectivo'),
    v_total, v_total, 0, 'Pedido POS', 'POS', false, v_usuario)
  returning id into v_pedido_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := (v_item->>'cantidad')::numeric;
    select * into v_producto from public.productos where id = (v_item->>'producto_id')::uuid;
    insert into public.pedido_detalle(pedido_id, producto_id, cantidad, precio, costo)
    values(v_pedido_id, v_producto.id, v_cantidad::integer,
      coalesce((select precio_venta from public.catalogo_sucursal_productos
        where sucursal_id = p_sucursal_id and producto_id = v_producto.id), v_producto.precio_venta), v_producto.costo);
    if v_producto.tipo_producto = 'combo' then
      for v_componente in
        select cc.producto_id, cc.cantidad, p.costo from public.combo_componentes cc
        join public.productos p on p.id = cc.producto_id where cc.combo_id = v_producto.id
      loop
        v_requerida := v_cantidad * v_componente.cantidad;
        update public.inventario_sucursal_productos set existencia = existencia - v_requerida, updated_at = now()
        where sucursal_id = p_sucursal_id and producto_id = v_componente.producto_id;
        insert into public.movimientos_inventario_sucursal
          (sucursal_id, producto_id, tipo, cantidad, costo_unitario, referencia, observaciones, creado_por)
        values(p_sucursal_id, v_componente.producto_id, 'venta_pos', -v_requerida,
          coalesce(v_componente.costo, 0), v_codigo, 'Componente de box: ' || v_producto.nombre, v_usuario);
      end loop;
    else
      update public.inventario_sucursal_productos set existencia = existencia - v_cantidad, updated_at = now()
      where sucursal_id = p_sucursal_id and producto_id = v_producto.id;
      insert into public.movimientos_inventario_sucursal
        (sucursal_id, producto_id, tipo, cantidad, costo_unitario, referencia, creado_por)
      values(p_sucursal_id, v_producto.id, 'venta_pos', -v_cantidad,
        coalesce(v_producto.costo, 0), v_codigo, v_usuario);
    end if;
  end loop;

  insert into public.pagos(pedido_id, cliente_id, monto, metodo, referencia, fecha)
  values(v_pedido_id, v_cliente_id, v_total, coalesce(nullif(trim(p_metodo), ''), 'Efectivo'),
    nullif(trim(p_referencia), ''), current_date) returning id into v_pago_id;
  update public.movimientos_caja set cuenta_id = v_turno.cuenta_id,
    cuenta = (select nombre from public.cuentas_financieras where id = v_turno.cuenta_id), creado_por = v_usuario
  where origen = 'pago' and origen_id = v_pago_id;
  insert into public.ventas_pos(pedido_id, sucursal_id, turno_id, pago_id, cajero_id, total)
  values(v_pedido_id, p_sucursal_id, p_turno_id, v_pago_id, v_usuario, v_total) returning id into v_venta_id;
  return jsonb_build_object('venta_id', v_venta_id, 'pedido_id', v_pedido_id, 'codigo', v_codigo, 'total', v_total);
end;
$$;

-- Al anular POS se devuelven los componentes reales, nunca inventario ficticio del combo.
create or replace function private.anular_venta_pos(p_venta_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_usuario uuid := (select auth.uid());
  v_venta public.ventas_pos;
  v_linea record;
  v_insumo record;
begin
  if v_usuario is null or not private.tiene_modulo_crm('punto_venta') then raise exception 'No autorizado'; end if;
  select * into v_venta from public.ventas_pos where id = p_venta_id for update;
  if not found or v_venta.estado = 'Anulada' then raise exception 'Venta no disponible para anular'; end if;
  if v_venta.cajero_id <> v_usuario and not private.es_administrador_crm() then
    raise exception 'Solo el cajero original o el administrador puede anular';
  end if;
  if trim(coalesce(p_motivo, '')) = '' then raise exception 'Indica el motivo de anulación'; end if;

  for v_linea in
    with componentes as (
      select d.producto_id, d.cantidad::numeric as cantidad
      from public.pedido_detalle d join public.productos p on p.id = d.producto_id
      where d.pedido_id = v_venta.pedido_id and p.tipo_producto <> 'combo'
      union all
      select cc.producto_id, d.cantidad * cc.cantidad
      from public.pedido_detalle d join public.productos p on p.id = d.producto_id
      join public.combo_componentes cc on cc.combo_id = p.id
      where d.pedido_id = v_venta.pedido_id and p.tipo_producto = 'combo'
    )
    select c.producto_id, sum(c.cantidad) as cantidad, coalesce(p.costo, 0) as costo
    from componentes c join public.productos p on p.id = c.producto_id
    group by c.producto_id, p.costo
  loop
    insert into public.inventario_sucursal_productos(sucursal_id, producto_id, existencia)
    values(v_venta.sucursal_id, v_linea.producto_id, v_linea.cantidad)
    on conflict(sucursal_id, producto_id) do update
      set existencia = public.inventario_sucursal_productos.existencia + excluded.existencia, updated_at = now();
    insert into public.movimientos_inventario_sucursal
      (sucursal_id, producto_id, tipo, cantidad, costo_unitario, referencia, observaciones, creado_por)
    values(v_venta.sucursal_id, v_linea.producto_id, 'devolucion', v_linea.cantidad,
      v_linea.costo, 'Anulación POS', p_motivo, v_usuario);
  end loop;

  for v_insumo in
    select * from public.combo_consumos_pedido where pedido_id = v_venta.pedido_id and origen = 'pos'
  loop
    update public.ingredientes set stock_actual = stock_actual + v_insumo.cantidad, updated_at = now()
    where id = v_insumo.ingrediente_id;
    insert into public.compras_ingredientes(ingrediente_id, tipo, cantidad, costo_unitario, total, nota, creado_por)
    values(v_insumo.ingrediente_id, 'ajuste', v_insumo.cantidad, v_insumo.costo_unitario,
      round(v_insumo.cantidad * v_insumo.costo_unitario, 2),
      'Devolución de box por anulación POS ' || v_venta.pedido_id::text || ': ' || p_motivo, v_usuario);
  end loop;

  delete from public.movimientos_caja where origen = 'pago' and origen_id = v_venta.pago_id;
  delete from public.pagos where id = v_venta.pago_id;
  update public.pedidos set estado = 'Anulado', pago_estado = 'Anulado', estado_pago = 'Anulado',
    saldo_pendiente = 0, observaciones = concat_ws(E'\n', observaciones, 'POS anulado: ' || p_motivo)
  where id = v_venta.pedido_id;
  update public.ventas_pos set estado = 'Anulada', anulada_at = now(), anulada_por = v_usuario,
    motivo_anulacion = p_motivo, pago_id = null where id = v_venta.id;
  return jsonb_build_object('ok', true);
end;
$$;
