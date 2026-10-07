-- Permite retirar pedidos creados por error sin dejar cobros ni operaciones huérfanas.
-- La copia privada permite recuperación administrativa si hubo una equivocación.
create table if not exists private.pedidos_eliminados_crm (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null,
  codigo text not null,
  datos jsonb not null,
  eliminado_por uuid not null,
  eliminado_at timestamptz not null default now()
);

revoke all on private.pedidos_eliminados_crm from public, anon, authenticated;

create or replace function public.eliminar_pedido_erroneo_seguro(
  p_pedido_id uuid,
  p_codigo_confirmacion text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null or not private.tiene_modulo_crm('pedidos') then
    raise exception 'No tienes permiso para gestionar pedidos';
  end if;

  select * into v_pedido
  from public.pedidos
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'El pedido ya no existe';
  end if;
  if v_pedido.codigo is null or trim(coalesce(p_codigo_confirmacion, '')) <> v_pedido.codigo then
    raise exception 'El código de confirmación no coincide';
  end if;
  if lower(trim(coalesce(v_pedido.estado, ''))) not in ('pendiente', 'cancelado', 'anulado') then
    raise exception 'Solo se pueden eliminar pedidos pendientes o cancelados sin actividad posterior';
  end if;
  if exists (select 1 from public.pagos where pedido_id = p_pedido_id)
    or exists (select 1 from public.movimientos_caja where pedido_id = p_pedido_id)
    or exists (select 1 from public.facturas where pedido_id = p_pedido_id)
    or exists (select 1 from public.ventas_pos where pedido_id = p_pedido_id)
    or exists (select 1 from public.produccion_pedidos where pedido_id = p_pedido_id)
    or exists (select 1 from public.combo_consumos_pedido where pedido_id = p_pedido_id)
    or exists (select 1 from public.movimientos_inventario where pedido_id = p_pedido_id)
    or exists (select 1 from public.notificaciones_cliente where pedido_id = p_pedido_id)
    or exists (select 1 from public.actividades_comerciales where pedido_id = p_pedido_id)
    or exists (select 1 from public.cotizaciones where convertido_pedido_id = p_pedido_id)
  then
    raise exception 'No se puede eliminar: el pedido tiene pagos, factura, producción, inventario u otra actividad vinculada. Cancélalo o corrige los registros antes.';
  end if;

  insert into private.pedidos_eliminados_crm (pedido_id, codigo, datos, eliminado_por)
  values (
    v_pedido.id,
    v_pedido.codigo,
    jsonb_build_object(
      'pedido', to_jsonb(v_pedido),
      'detalle', coalesce((select jsonb_agg(to_jsonb(d)) from public.pedido_detalle d where d.pedido_id = p_pedido_id), '[]'::jsonb),
      'historial', coalesce((select jsonb_agg(to_jsonb(h)) from public.historial_estados_pedido h where h.pedido_id = p_pedido_id), '[]'::jsonb)
    ),
    v_usuario
  );

  delete from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'No se pudo eliminar el pedido';
  end if;
end;
$$;

revoke all on function public.eliminar_pedido_erroneo_seguro(uuid, text) from public, anon;
grant execute on function public.eliminar_pedido_erroneo_seguro(uuid, text) to authenticated;
