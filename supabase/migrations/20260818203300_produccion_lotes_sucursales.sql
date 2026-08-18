create table public.lotes_produccion (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales(id) on delete restrict,
  producto_id uuid not null references public.productos(id) on delete restrict,
  receta_id uuid not null references public.recetas_estandar(id) on delete restrict,
  cantidad_producida numeric(14,3) not null check (cantidad_producida > 0),
  costo_total numeric(14,2) not null default 0,
  costo_unitario numeric(14,4) not null default 0,
  observaciones text,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index lotes_produccion_sucursal_fecha_idx on public.lotes_produccion (sucursal_id, created_at desc);
alter table public.lotes_produccion enable row level security;
revoke all on public.lotes_produccion from anon;
grant select on public.lotes_produccion to authenticated;
create policy "produccion lotes consulta" on public.lotes_produccion for select to authenticated
using (private.tiene_modulo_crm('produccion') or private.tiene_modulo_crm('sucursales') or private.tiene_modulo_crm('punto_venta') or private.tiene_modulo_crm('reportes'));

create or replace function private.registrar_lote_produccion(
  p_sucursal_id uuid, p_producto_id uuid, p_cantidad numeric, p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_receta public.recetas_estandar;
  v_sucursal public.sucursales;
  v_linea record;
  v_multiplicador numeric(14,6);
  v_necesario numeric(14,3);
  v_costo_total numeric(14,2) := 0;
  v_lote_id uuid;
  v_costo_unitario numeric(14,4);
begin
  if v_usuario is null or not (private.tiene_modulo_crm('produccion') or private.tiene_modulo_crm('sucursales')) then
    raise exception 'No autorizado para registrar producción';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad producida debe ser mayor que cero'; end if;
  select * into v_sucursal from public.sucursales where id = p_sucursal_id and tipo = 'cocina' and activa;
  if not found then raise exception 'Selecciona una cocina activa para producir'; end if;
  select * into v_receta from public.recetas_estandar where producto_id = p_producto_id and activa for update;
  if not found then raise exception 'Este producto no tiene una receta estándar activa'; end if;
  v_multiplicador := p_cantidad / v_receta.rendimiento;
  for v_linea in
    select detalle.cantidad, ingrediente.id as ingrediente_id, ingrediente.nombre, ingrediente.stock_actual, ingrediente.costo_referencia
    from public.receta_ingredientes detalle
    join public.ingredientes ingrediente on ingrediente.id = detalle.ingrediente_id
    where detalle.receta_id = v_receta.id
    for update of ingrediente
  loop
    v_necesario := v_linea.cantidad * v_multiplicador;
    if v_linea.stock_actual < v_necesario then
      raise exception 'Inventario insuficiente de %: necesitas %, hay %', v_linea.nombre, round(v_necesario, 3), round(v_linea.stock_actual, 3);
    end if;
    v_costo_total := v_costo_total + (v_necesario * v_linea.costo_referencia);
  end loop;
  v_costo_total := round(v_costo_total, 2);
  v_costo_unitario := round(v_costo_total / p_cantidad, 4);
  for v_linea in
    select detalle.cantidad, ingrediente.id as ingrediente_id, ingrediente.stock_actual, ingrediente.costo_referencia
    from public.receta_ingredientes detalle
    join public.ingredientes ingrediente on ingrediente.id = detalle.ingrediente_id
    where detalle.receta_id = v_receta.id
    for update of ingrediente
  loop
    v_necesario := v_linea.cantidad * v_multiplicador;
    update public.ingredientes set stock_actual = stock_actual - v_necesario, updated_at = now() where id = v_linea.ingrediente_id;
    insert into public.compras_ingredientes (ingrediente_id, tipo, cantidad, costo_unitario, total, nota, creado_por)
    values (v_linea.ingrediente_id, 'consumo_produccion', -v_necesario, v_linea.costo_referencia, round(v_necesario * v_linea.costo_referencia, 2), 'Consumo de producción', v_usuario);
  end loop;
  insert into public.inventario_sucursal_productos (sucursal_id, producto_id, existencia)
  values (p_sucursal_id, p_producto_id, p_cantidad)
  on conflict (sucursal_id, producto_id) do update set existencia = public.inventario_sucursal_productos.existencia + excluded.existencia, updated_at = now();
  insert into public.movimientos_inventario_sucursal (sucursal_id, producto_id, tipo, cantidad, costo_unitario, referencia, observaciones, creado_por)
  values (p_sucursal_id, p_producto_id, 'produccion', p_cantidad, v_costo_unitario, 'Lote de producción', p_observaciones, v_usuario);
  insert into public.movimientos_inventario (producto_id, tipo, cantidad, costo_unitario, motivo)
  values (p_producto_id, 'Entrada', p_cantidad, v_costo_unitario, 'Producción de lote');
  update public.productos set costo = v_costo_unitario where id = p_producto_id;
  insert into public.lotes_produccion (sucursal_id, producto_id, receta_id, cantidad_producida, costo_total, costo_unitario, observaciones, creado_por)
  values (p_sucursal_id, p_producto_id, v_receta.id, p_cantidad, v_costo_total, v_costo_unitario, p_observaciones, v_usuario)
  returning id into v_lote_id;
  return jsonb_build_object('lote_id', v_lote_id, 'cantidad', p_cantidad, 'costo_total', v_costo_total, 'costo_unitario', v_costo_unitario);
end;
$$;

create or replace function public.registrar_lote_produccion(p_sucursal_id uuid, p_producto_id uuid, p_cantidad numeric, p_observaciones text default null)
returns jsonb language sql security invoker set search_path = public, private as $$
  select private.registrar_lote_produccion(p_sucursal_id, p_producto_id, p_cantidad, p_observaciones);
$$;
revoke all on function public.registrar_lote_produccion(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.registrar_lote_produccion(uuid, uuid, numeric, text) to authenticated;
revoke all on function private.registrar_lote_produccion(uuid, uuid, numeric, text) from public, anon;
grant execute on function private.registrar_lote_produccion(uuid, uuid, numeric, text) to authenticated;
