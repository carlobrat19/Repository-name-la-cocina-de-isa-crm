-- El avance operativo no descuenta ingredientes. El único descuento para
-- pedidos sigue ocurriendo en cambiar_estado_pedido_seguro al entrar a Producción.
create table public.avance_preparacion_pedido (
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  cantidad_preparada numeric(14,3) not null default 0 check (cantidad_preparada >= 0),
  actualizado_por uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (pedido_id, producto_id)
);

create index avance_preparacion_producto_idx on public.avance_preparacion_pedido(producto_id);
alter table public.avance_preparacion_pedido enable row level security;
revoke all on public.avance_preparacion_pedido from public, anon, authenticated;
grant select on public.avance_preparacion_pedido to authenticated;
create policy "avance preparacion lectura" on public.avance_preparacion_pedido
  for select to authenticated
  using (private.tiene_modulo_crm('produccion') or private.tiene_modulo_crm('pedidos'));

create or replace function private.guardar_avance_preparacion(
  p_pedido_id uuid, p_producto_id uuid, p_cantidad numeric
) returns jsonb
language plpgsql security definer set search_path = public, private
as $$
declare
  v_pedido public.pedidos;
  v_requerida numeric;
begin
  if (select auth.uid()) is null or not private.tiene_modulo_crm('produccion') then
    raise exception 'No autorizado para registrar preparación';
  end if;
  if p_cantidad is null or p_cantidad < 0 then
    raise exception 'La cantidad preparada no puede ser negativa';
  end if;
  select * into v_pedido from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_pedido.estado <> 'Producción' then
    raise exception 'El pedido debe estar en Producción para registrar unidades preparadas';
  end if;

  with requeridos as (
    select d.producto_id, d.cantidad::numeric as cantidad
    from public.pedido_detalle d
    join public.productos p on p.id = d.producto_id
    where d.pedido_id = p_pedido_id and coalesce(p.tipo_producto, 'preparado') <> 'combo'
    union all
    select c.producto_id, (d.cantidad * c.cantidad)::numeric
    from public.pedido_detalle d
    join public.productos p on p.id = d.producto_id
    join public.combo_componentes c on c.combo_id = p.id
    where d.pedido_id = p_pedido_id and coalesce(p.tipo_producto, 'preparado') = 'combo'
  )
  select sum(cantidad) into v_requerida from requeridos where producto_id = p_producto_id;
  if v_requerida is null then raise exception 'Este producto no pertenece al pedido'; end if;
  if p_cantidad > v_requerida then
    raise exception 'No puedes marcar más de % unidades preparadas', v_requerida;
  end if;

  insert into public.avance_preparacion_pedido(pedido_id, producto_id, cantidad_preparada, actualizado_por)
  values (p_pedido_id, p_producto_id, p_cantidad, (select auth.uid()))
  on conflict (pedido_id, producto_id) do update set
    cantidad_preparada = excluded.cantidad_preparada,
    actualizado_por = excluded.actualizado_por,
    updated_at = now();
  return jsonb_build_object('pedido_id', p_pedido_id, 'producto_id', p_producto_id,
    'cantidad_preparada', p_cantidad, 'cantidad_requerida', v_requerida);
end;
$$;

create or replace function public.guardar_avance_preparacion(
  p_pedido_id uuid, p_producto_id uuid, p_cantidad numeric
) returns jsonb language sql security invoker set search_path = public, private
as $$ select private.guardar_avance_preparacion($1, $2, $3); $$;

revoke all on function private.guardar_avance_preparacion(uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.guardar_avance_preparacion(uuid, uuid, numeric) from public, anon;
grant execute on function private.guardar_avance_preparacion(uuid, uuid, numeric) to authenticated;
grant execute on function public.guardar_avance_preparacion(uuid, uuid, numeric) to authenticated;
