-- Un pedido preparado no debe depender del inventario de producto terminado.
-- Al iniciar Producción se consumen sus materias primas y se conserva una
-- trazabilidad propia del pedido. Los lotes para surtir sucursales siguen
-- usando registrar_lote_produccion y su inventario por sucursal.
create table if not exists public.produccion_pedidos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.pedidos(id) on delete restrict,
  sucursal_id uuid not null references public.sucursales(id) on delete restrict,
  costo_total numeric(14,2) not null default 0,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.produccion_pedido_ingredientes (
  id uuid primary key default gen_random_uuid(),
  produccion_pedido_id uuid not null references public.produccion_pedidos(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id) on delete restrict,
  cantidad numeric(14,3) not null check (cantidad > 0),
  costo_unitario numeric(14,4) not null default 0,
  costo_total numeric(14,2) not null default 0,
  unique (produccion_pedido_id, ingrediente_id)
);

alter table public.produccion_pedidos enable row level security;
alter table public.produccion_pedido_ingredientes enable row level security;
revoke all on public.produccion_pedidos, public.produccion_pedido_ingredientes from anon;
grant select on public.produccion_pedidos, public.produccion_pedido_ingredientes to authenticated;

create policy "produccion pedidos consulta"
on public.produccion_pedidos for select to authenticated
using (
  private.tiene_modulo_crm('produccion')
  or private.tiene_modulo_crm('pedidos')
  or private.tiene_modulo_crm('reportes')
);

create policy "produccion pedido ingredientes consulta"
on public.produccion_pedido_ingredientes for select to authenticated
using (
  exists (
    select 1
    from public.produccion_pedidos produccion
    where produccion.id = produccion_pedido_ingredientes.produccion_pedido_id
      and (
        private.tiene_modulo_crm('produccion')
        or private.tiene_modulo_crm('pedidos')
        or private.tiene_modulo_crm('reportes')
      )
  )
);

create index if not exists produccion_pedidos_fecha_idx
  on public.produccion_pedidos(created_at desc);

create or replace function private.cambiar_estado_pedido_seguro(
  p_pedido_id uuid,
  p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_pedido public.pedidos;
  v_cocina_id uuid;
  v_produccion_id uuid;
  v_linea record;
  v_insumo record;
  v_inventario public.inventario_sucursal_productos;
  v_costo_total numeric(14,2) := 0;
  v_requiere_preparacion boolean := false;
  v_sin_receta text;
begin
  if v_usuario is null
     or not (private.tiene_modulo_crm('pedidos') or private.tiene_modulo_crm('produccion')) then
    raise exception 'No autorizado para actualizar pedidos';
  end if;

  if p_estado not in ('Pendiente', 'Producción', 'Empaquetado', 'En Ruta', 'Entregado', 'Cancelado') then
    raise exception 'Estado de pedido inválido';
  end if;

  select * into v_pedido
  from public.pedidos
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if v_pedido.estado = 'Cancelado' then
    raise exception 'Un pedido cancelado no puede avanzar';
  end if;

  -- Se identifica si el pedido contiene producto preparado, un combo o
  -- reventa que debe reservarse en cocina antes de empacar o entregar.
  select exists (
    select 1
    from public.pedido_detalle detalle
    join public.productos producto on producto.id = detalle.producto_id
    where detalle.pedido_id = v_pedido.id
  ) into v_requiere_preparacion;

  if p_estado = 'Producción' and v_pedido.estado <> 'Producción'
     and not exists (select 1 from public.produccion_pedidos where pedido_id = v_pedido.id) then
    select id into v_cocina_id
    from public.sucursales
    where tipo = 'cocina' and activa
    order by nombre
    limit 1;

    if v_cocina_id is null then
      raise exception 'No hay una cocina central activa para iniciar la producción';
    end if;

    -- Un producto preparado debe tener una receta. Los combos se expanden
    -- a sus componentes para consumir la receta de cada producto preparado.
    with requeridos as (
      select detalle.producto_id, detalle.cantidad::numeric as cantidad
      from public.pedido_detalle detalle
      join public.productos producto on producto.id = detalle.producto_id
      where detalle.pedido_id = v_pedido.id
        and coalesce(producto.tipo_producto, 'preparado') <> 'combo'
      union all
      select componente.producto_id, (detalle.cantidad * componente.cantidad)::numeric
      from public.pedido_detalle detalle
      join public.productos combo on combo.id = detalle.producto_id
      join public.combo_componentes componente on componente.combo_id = combo.id
      where detalle.pedido_id = v_pedido.id
        and coalesce(combo.tipo_producto, 'preparado') = 'combo'
    )
    select string_agg(distinct producto.nombre, ', ')
      into v_sin_receta
    from requeridos requerido
    join public.productos producto on producto.id = requerido.producto_id
    left join public.recetas_estandar receta
      on receta.producto_id = producto.id and receta.activa
    where coalesce(producto.tipo_producto, 'preparado') = 'preparado'
      and receta.id is null;

    if v_sin_receta is not null then
      raise exception 'Falta una receta estándar activa para: %', v_sin_receta;
    end if;

    -- Primero valida todos los ingredientes requeridos para no hacer un
    -- descuento parcial si uno de ellos no alcanza.
    for v_insumo in
      with requeridos as (
        select detalle.producto_id, detalle.cantidad::numeric as cantidad
        from public.pedido_detalle detalle
        join public.productos producto on producto.id = detalle.producto_id
        where detalle.pedido_id = v_pedido.id
          and coalesce(producto.tipo_producto, 'preparado') <> 'combo'
        union all
        select componente.producto_id, (detalle.cantidad * componente.cantidad)::numeric
        from public.pedido_detalle detalle
        join public.productos combo on combo.id = detalle.producto_id
        join public.combo_componentes componente on componente.combo_id = combo.id
        where detalle.pedido_id = v_pedido.id
          and coalesce(combo.tipo_producto, 'preparado') = 'combo'
      ), insumos as (
        select detalle_receta.ingrediente_id,
               sum(detalle_receta.cantidad * (requerido.cantidad / receta.rendimiento)) as necesario
        from requeridos requerido
        join public.productos producto on producto.id = requerido.producto_id
        join public.recetas_estandar receta
          on receta.producto_id = producto.id and receta.activa
        join public.receta_ingredientes detalle_receta on detalle_receta.receta_id = receta.id
        where coalesce(producto.tipo_producto, 'preparado') = 'preparado'
        group by detalle_receta.ingrediente_id
      )
      select ingrediente.id as ingrediente_id, ingrediente.nombre, ingrediente.stock_actual,
             ingrediente.costo_referencia, insumos.necesario
      from insumos
      join public.ingredientes ingrediente on ingrediente.id = insumos.ingrediente_id
      order by ingrediente.id
      for update of ingrediente
    loop
      if coalesce(v_insumo.stock_actual, 0) < v_insumo.necesario then
        raise exception 'Inventario insuficiente de %: necesitas %, hay %',
          v_insumo.nombre, round(v_insumo.necesario, 3), round(v_insumo.stock_actual, 3);
      end if;
      v_costo_total := v_costo_total + (v_insumo.necesario * v_insumo.costo_referencia);
    end loop;

    -- La reventa no usa receta: se reserva del inventario de cocina.
    for v_linea in
      with requeridos as (
        select detalle.producto_id, detalle.cantidad::numeric as cantidad
        from public.pedido_detalle detalle
        join public.productos producto on producto.id = detalle.producto_id
        where detalle.pedido_id = v_pedido.id
          and coalesce(producto.tipo_producto, 'preparado') <> 'combo'
        union all
        select componente.producto_id, (detalle.cantidad * componente.cantidad)::numeric
        from public.pedido_detalle detalle
        join public.productos combo on combo.id = detalle.producto_id
        join public.combo_componentes componente on componente.combo_id = combo.id
        where detalle.pedido_id = v_pedido.id
          and coalesce(combo.tipo_producto, 'preparado') = 'combo'
      )
      select requerido.producto_id, producto.nombre, sum(requerido.cantidad) as cantidad,
             coalesce(producto.costo, 0) as costo
      from requeridos requerido
      join public.productos producto on producto.id = requerido.producto_id
      where coalesce(producto.tipo_producto, 'preparado') = 'reventa'
      group by requerido.producto_id, producto.nombre, producto.costo
    loop
      select * into v_inventario
      from public.inventario_sucursal_productos
      where sucursal_id = v_cocina_id and producto_id = v_linea.producto_id
      for update;

      if not found or coalesce(v_inventario.existencia, 0) < v_linea.cantidad then
        raise exception 'Inventario insuficiente en cocina para %: se necesitan %',
          v_linea.nombre, v_linea.cantidad;
      end if;
      v_costo_total := v_costo_total + (v_linea.cantidad * v_linea.costo);
    end loop;

    insert into public.produccion_pedidos(pedido_id, sucursal_id, costo_total, creado_por)
    values (v_pedido.id, v_cocina_id, round(v_costo_total, 2), v_usuario)
    returning id into v_produccion_id;

    for v_insumo in
      with requeridos as (
        select detalle.producto_id, detalle.cantidad::numeric as cantidad
        from public.pedido_detalle detalle
        join public.productos producto on producto.id = detalle.producto_id
        where detalle.pedido_id = v_pedido.id
          and coalesce(producto.tipo_producto, 'preparado') <> 'combo'
        union all
        select componente.producto_id, (detalle.cantidad * componente.cantidad)::numeric
        from public.pedido_detalle detalle
        join public.productos combo on combo.id = detalle.producto_id
        join public.combo_componentes componente on componente.combo_id = combo.id
        where detalle.pedido_id = v_pedido.id
          and coalesce(combo.tipo_producto, 'preparado') = 'combo'
      ), insumos as (
        select detalle_receta.ingrediente_id,
               sum(detalle_receta.cantidad * (requerido.cantidad / receta.rendimiento)) as necesario
        from requeridos requerido
        join public.productos producto on producto.id = requerido.producto_id
        join public.recetas_estandar receta
          on receta.producto_id = producto.id and receta.activa
        join public.receta_ingredientes detalle_receta on detalle_receta.receta_id = receta.id
        where coalesce(producto.tipo_producto, 'preparado') = 'preparado'
        group by detalle_receta.ingrediente_id
      )
      select ingrediente.id as ingrediente_id, ingrediente.costo_referencia, insumos.necesario
      from insumos
      join public.ingredientes ingrediente on ingrediente.id = insumos.ingrediente_id
      order by ingrediente.id
      for update of ingrediente
    loop
      update public.ingredientes
      set stock_actual = stock_actual - v_insumo.necesario,
          updated_at = now()
      where id = v_insumo.ingrediente_id;

      insert into public.produccion_pedido_ingredientes(
        produccion_pedido_id, ingrediente_id, cantidad, costo_unitario, costo_total
      ) values (
        v_produccion_id, v_insumo.ingrediente_id, v_insumo.necesario,
        v_insumo.costo_referencia, round(v_insumo.necesario * v_insumo.costo_referencia, 2)
      );

      insert into public.compras_ingredientes(
        ingrediente_id, tipo, cantidad, costo_unitario, total, nota, creado_por
      ) values (
        v_insumo.ingrediente_id, 'consumo_produccion', -v_insumo.necesario,
        v_insumo.costo_referencia, round(v_insumo.necesario * v_insumo.costo_referencia, 2),
        'Producción para pedido ' || coalesce(v_pedido.codigo, v_pedido.id::text), v_usuario
      );
    end loop;

    for v_linea in
      with requeridos as (
        select detalle.producto_id, detalle.cantidad::numeric as cantidad
        from public.pedido_detalle detalle
        join public.productos producto on producto.id = detalle.producto_id
        where detalle.pedido_id = v_pedido.id
          and coalesce(producto.tipo_producto, 'preparado') <> 'combo'
        union all
        select componente.producto_id, (detalle.cantidad * componente.cantidad)::numeric
        from public.pedido_detalle detalle
        join public.productos combo on combo.id = detalle.producto_id
        join public.combo_componentes componente on componente.combo_id = combo.id
        where detalle.pedido_id = v_pedido.id
          and coalesce(combo.tipo_producto, 'preparado') = 'combo'
      )
      select requerido.producto_id, producto.nombre, sum(requerido.cantidad) as cantidad,
             coalesce(producto.costo, 0) as costo
      from requeridos requerido
      join public.productos producto on producto.id = requerido.producto_id
      where coalesce(producto.tipo_producto, 'preparado') = 'reventa'
      group by requerido.producto_id, producto.nombre, producto.costo
    loop
      update public.inventario_sucursal_productos
      set existencia = existencia - v_linea.cantidad, updated_at = now()
      where sucursal_id = v_cocina_id and producto_id = v_linea.producto_id;

      insert into public.movimientos_inventario_sucursal(
        sucursal_id, producto_id, tipo, cantidad, costo_unitario, referencia, observaciones, creado_por
      ) values (
        v_cocina_id, v_linea.producto_id, 'pedido_reserva', -v_linea.cantidad,
        v_linea.costo, coalesce(v_pedido.codigo, v_pedido.id::text),
        'Reservado para pedido al iniciar producción', v_usuario
      );
    end loop;
  end if;

  -- No se debe saltar Producción: así toda salida queda trazable.
  if p_estado in ('Empaquetado', 'En Ruta', 'Entregado')
     and v_requiere_preparacion
     and not exists (select 1 from public.produccion_pedidos where pedido_id = v_pedido.id) then
    raise exception 'Primero cambia el pedido a Producción para descontar ingredientes o reservar existencias';
  end if;

  update public.pedidos
  set estado = p_estado
  where id = v_pedido.id;

  return jsonb_build_object('pedido_id', v_pedido.id, 'estado', p_estado);
end;
$$;

revoke all on function private.cambiar_estado_pedido_seguro(uuid, text) from public, anon;
grant execute on function private.cambiar_estado_pedido_seguro(uuid, text) to authenticated;
