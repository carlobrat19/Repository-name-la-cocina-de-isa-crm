-- El ingreso físico de inventario desde una factura no implica que esté pagada.
-- Reutiliza el historial de ingredientes y el vínculo único por línea de factura.
alter table public.compras_ingredientes
  drop constraint if exists compras_ingredientes_tipo_check;
alter table public.compras_ingredientes
  add constraint compras_ingredientes_tipo_check
  check (tipo in ('compra', 'ajuste', 'consumo_produccion', 'ingreso_factura'));

create or replace function public.validar_vinculo_factura_compra()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.compra_ingrediente_id is not null and not exists (
    select 1 from public.compras_ingredientes compra
    where compra.id = new.compra_ingrediente_id
      and compra.tipo in ('compra', 'ingreso_factura')
      and compra.ingrediente_id = new.ingrediente_id
  ) then
    raise exception 'La compra o el ingreso de inventario no corresponde al ingrediente';
  end if;
  return new;
end;
$$;

create function public.ingresar_factura_a_inventario(
  p_factura_id uuid,
  p_linea_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_linea public.facturas_compra_lineas;
  v_ingrediente public.ingredientes;
  v_movimiento_id uuid;
  v_ingresadas integer := 0;
begin
  if (select auth.uid()) is null
     or not (select private.tiene_modulo_crm('flujo_caja'))
     or not ((select private.tiene_modulo_crm('productos'))
              or (select private.tiene_modulo_crm('ingredientes'))) then
    raise exception 'No autorizado para ingresar facturas a inventario';
  end if;

  if p_factura_id is null or p_linea_ids is null or cardinality(p_linea_ids) = 0
     or cardinality(p_linea_ids) > 200
     or cardinality(p_linea_ids) <> (select count(distinct id) from unnest(p_linea_ids) as ids(id)) then
    raise exception 'Selecciona entre 1 y 200 líneas distintas';
  end if;

  perform 1 from public.facturas_compra where id = p_factura_id;
  if not found then raise exception 'Factura no encontrada'; end if;

  -- Bloqueo de filas: dos usuarios no pueden sumar la misma línea simultáneamente.
  for v_linea in
    select * from public.facturas_compra_lineas
    where factura_id = p_factura_id and id = any(p_linea_ids)
    order by id for update
  loop
    if v_linea.compra_ingrediente_id is not null then
      raise exception 'Una línea ya fue ingresada o vinculada a una compra';
    end if;
    if v_linea.ingrediente_id is null or v_linea.cantidad_base is null or v_linea.cantidad_base <= 0 then
      raise exception 'Cada línea necesita ingrediente y cantidad base positiva';
    end if;

    select * into v_ingrediente from public.ingredientes
    where id = v_linea.ingrediente_id and activo for update;
    if not found then raise exception 'Ingrediente inexistente o inactivo'; end if;

    update public.ingredientes
    set stock_actual = v_ingrediente.stock_actual + v_linea.cantidad_base,
        costo_referencia = case
          when v_ingrediente.stock_actual + v_linea.cantidad_base > 0 then
            ((v_ingrediente.stock_actual * v_ingrediente.costo_referencia) + v_linea.monto)
              / (v_ingrediente.stock_actual + v_linea.cantidad_base)
          else v_ingrediente.costo_referencia end,
        updated_at = now()
    where id = v_linea.ingrediente_id;

    insert into public.compras_ingredientes
      (ingrediente_id, tipo, cantidad, costo_unitario, total, nota, creado_por)
    values
      (v_linea.ingrediente_id, 'ingreso_factura', v_linea.cantidad_base,
       round(v_linea.monto / v_linea.cantidad_base, 6), v_linea.monto,
       'Ingreso desde factura ' || p_factura_id::text, (select auth.uid()))
    returning id into v_movimiento_id;

    update public.facturas_compra_lineas
    set compra_ingrediente_id = v_movimiento_id
    where id = v_linea.id;
    v_ingresadas := v_ingresadas + 1;
  end loop;

  if v_ingresadas <> cardinality(p_linea_ids) then
    raise exception 'Algunas líneas no pertenecen a esta factura';
  end if;
  return v_ingresadas;
end;
$$;

revoke all on function public.ingresar_factura_a_inventario(uuid, uuid[]) from public, anon;
grant execute on function public.ingresar_factura_a_inventario(uuid, uuid[]) to authenticated;
