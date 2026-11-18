-- Compra directa de un ingrediente: proveedor, fecha, categoría y cuenta
-- quedan estructurados, sin crear una factura ni un segundo gasto.
alter table public.compras_ingredientes
  add column if not exists proveedor_id uuid references public.proveedores_compra(id) on delete restrict,
  add column if not exists fecha_compra date,
  add column if not exists categoria_compra text not null default 'Materia prima',
  add column if not exists cuenta_id uuid references public.cuentas_financieras(id) on delete restrict;

create index if not exists compras_ingredientes_proveedor_id_idx
  on public.compras_ingredientes (proveedor_id, fecha_compra desc);
create index if not exists compras_ingredientes_cuenta_id_idx
  on public.compras_ingredientes (cuenta_id);

create or replace function public.registrar_movimiento_compra_caja()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_cuenta_id uuid;
begin
  if new.tipo = 'compra' then
    v_cuenta_id := coalesce(new.cuenta_id, public.cuenta_financiera_por_texto(new.cuenta_pago, new.metodo_pago));
    insert into public.movimientos_caja
      (tipo, categoria, descripcion, monto, fecha, cuenta, cuenta_id, origen, origen_id, metodo_pago, creado_por)
    values
      ('Gasto', coalesce(new.categoria_compra, 'Materia prima'),
       'Compra de ' || coalesce((select nombre from public.ingredientes where id = new.ingrediente_id), 'ingrediente') ||
       coalesce(' · ' || (select nombre from public.proveedores_compra where id = new.proveedor_id), '') ||
       coalesce(' · ' || nullif(btrim(new.nota), ''), ''),
       new.total, coalesce(new.fecha_compra, new.created_at::date),
       coalesce((select nombre from public.cuentas_financieras where id = v_cuenta_id), new.cuenta_pago),
       v_cuenta_id, 'compra_ingrediente', new.id, new.metodo_pago, (select auth.uid()))
    on conflict (origen, origen_id) where origen_id is not null do nothing;
  end if;
  return new;
end;
$$;

create function public.registrar_compra_ingrediente_detallada(
  p_ingrediente_id uuid,
  p_cantidad numeric,
  p_total numeric,
  p_proveedor_id uuid,
  p_fecha_compra date,
  p_categoria text,
  p_nota text,
  p_metodo_pago text,
  p_cuenta_id uuid
)
returns uuid language plpgsql security invoker set search_path = public, private as $$
declare
  v_ingrediente public.ingredientes;
  v_cuenta public.cuentas_financieras;
  v_compra_id uuid;
  v_costo_unitario numeric(12,6);
begin
  if (select auth.uid()) is null or
     not (select private.tiene_modulo_crm('productos')) or
     not (select private.tiene_modulo_crm('flujo_caja')) then
    raise exception 'No autorizado para registrar compras y gastos';
  end if;
  if p_cantidad is null or p_cantidad <= 0 or p_total is null or p_total <= 0 or
     p_fecha_compra is null or p_proveedor_id is null or p_cuenta_id is null or
     nullif(btrim(p_metodo_pago), '') is null then
    raise exception 'Completa proveedor, fecha, ingrediente, cantidad, total, cuenta y medio de pago';
  end if;
  if p_categoria is null or p_categoria not in ('Materia prima', 'Empaques', 'Limpieza e higiene', 'Utensilios de cocina', 'Otros gastos') then
    raise exception 'Tipo de compra no válido';
  end if;
  if not exists (select 1 from public.proveedores_compra where id = p_proveedor_id) then
    raise exception 'Proveedor no encontrado';
  end if;
  select * into v_cuenta from public.cuentas_financieras where id = p_cuenta_id and activa;
  if not found then raise exception 'Selecciona una cuenta activa'; end if;
  select * into v_ingrediente from public.ingredientes where id = p_ingrediente_id and activo for update;
  if not found then raise exception 'Ingrediente no encontrado o inactivo'; end if;
  v_costo_unitario := round(p_total / p_cantidad, 6);
  update public.ingredientes
  set stock_actual = v_ingrediente.stock_actual + p_cantidad,
      costo_referencia = case when v_ingrediente.stock_actual + p_cantidad > 0 then
        ((v_ingrediente.stock_actual * v_ingrediente.costo_referencia) + p_total) /
        (v_ingrediente.stock_actual + p_cantidad)
      else v_ingrediente.costo_referencia end,
      updated_at = now()
  where id = p_ingrediente_id;
  insert into public.compras_ingredientes
    (ingrediente_id, tipo, cantidad, costo_unitario, total, nota, creado_por,
     metodo_pago, cuenta_pago, cuenta_id, proveedor_id, fecha_compra, categoria_compra)
  values
    (p_ingrediente_id, 'compra', p_cantidad, v_costo_unitario, p_total,
     nullif(btrim(p_nota), ''), (select auth.uid()), p_metodo_pago,
     v_cuenta.nombre, p_cuenta_id, p_proveedor_id, p_fecha_compra, p_categoria)
  returning id into v_compra_id;
  return v_compra_id;
end;
$$;

revoke all on function public.registrar_compra_ingrediente_detallada(uuid,numeric,numeric,uuid,date,text,text,text,uuid) from public, anon;
grant execute on function public.registrar_compra_ingrediente_detallada(uuid,numeric,numeric,uuid,date,text,text,text,uuid) to authenticated;
