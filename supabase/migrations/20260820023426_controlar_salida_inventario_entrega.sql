create or replace function private.cambiar_estado_pedido_seguro(p_pedido_id uuid, p_estado text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_pedido public.pedidos;
  v_linea record;
  v_producto public.productos;
begin
  if v_usuario is null or not (private.tiene_modulo_crm('pedidos') or private.tiene_modulo_crm('produccion')) then
    raise exception 'No autorizado para actualizar pedidos';
  end if;
  if p_estado not in ('Pendiente','Producción','Empaquetado','En Ruta','Entregado','Cancelado') then
    raise exception 'Estado de pedido inválido';
  end if;
  select * into v_pedido from public.pedidos where id=p_pedido_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_pedido.estado='Cancelado' then raise exception 'Un pedido cancelado no puede avanzar'; end if;
  if p_estado='Entregado' and v_pedido.estado <> 'Entregado' then
    for v_linea in select producto_id,cantidad,costo from public.pedido_detalle where pedido_id=v_pedido.id loop
      select * into v_producto from public.productos where id=v_linea.producto_id for update;
      if not found then raise exception 'Producto no disponible'; end if;
      if coalesce(v_producto.stock,0) < v_linea.cantidad then
        raise exception 'Inventario insuficiente para %: hay %, se necesitan %', v_producto.nombre, v_producto.stock, v_linea.cantidad;
      end if;
      insert into public.movimientos_inventario(producto_id,pedido_id,tipo,cantidad,costo_unitario,motivo)
      values(v_producto.id,v_pedido.id,'Salida',-v_linea.cantidad,coalesce(v_linea.costo,v_producto.costo,0),'Entrega ' || coalesce(v_pedido.codigo,''));
    end loop;
  end if;
  update public.pedidos set estado=p_estado where id=v_pedido.id;
  return jsonb_build_object('pedido_id',v_pedido.id,'estado',p_estado);
end;
$$;
create or replace function public.cambiar_estado_pedido_seguro(uuid,text)
returns jsonb language sql security invoker set search_path=public,private as $$ select private.cambiar_estado_pedido_seguro($1,$2); $$;
revoke all on function public.cambiar_estado_pedido_seguro(uuid,text) from public,anon;
grant execute on function public.cambiar_estado_pedido_seguro(uuid,text) to authenticated;
revoke all on function private.cambiar_estado_pedido_seguro(uuid,text) from public,anon;

-- La entrega no se puede registrar directamente desde el formulario inicial;
-- debe pasar por producción/inventario para mantener existencias confiables.
create or replace function private.validar_estado_inicial_pedido()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if tg_op = 'INSERT' and new.estado='Entregado' and coalesce(new.tipo_documento,'') <> 'Pedido POS' then
    raise exception 'Un pedido nuevo no puede iniciar como Entregado';
  end if;
  return new;
end; $$;
drop trigger if exists pedidos_valida_estado_inicial on public.pedidos;
create trigger pedidos_valida_estado_inicial before insert on public.pedidos for each row execute function private.validar_estado_inicial_pedido();
