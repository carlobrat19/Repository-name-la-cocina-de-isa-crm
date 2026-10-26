-- Una compra anterior ya afectó caja; su factura solo puede servir de respaldo.
-- Un ingreso de inventario nacido de factura no se puede desvincular sin reversión.
create or replace function public.validar_pago_factura_compra()
returns trigger language plpgsql security invoker set search_path = public, private as $$
declare
  v_total numeric(14,2);
  v_pagado numeric(14,2);
begin
  if (select auth.uid()) is null or not (select private.tiene_modulo_crm('flujo_caja')) then
    raise exception 'No autorizado para pagar facturas';
  end if;
  select total into v_total from public.facturas_compra where id = new.factura_id for update;
  if not found then raise exception 'Factura no encontrada'; end if;
  if exists (
    select 1 from public.facturas_compra_lineas linea
    join public.compras_ingredientes compra on compra.id = linea.compra_ingrediente_id
    where linea.factura_id = new.factura_id and compra.tipo = 'compra'
  ) then
    raise exception 'Esta factura respalda una compra ya registrada en caja; no se puede pagar dos veces';
  end if;
  if not exists (select 1 from public.cuentas_financieras where id = new.cuenta_id and activa) then
    raise exception 'Selecciona una cuenta activa';
  end if;
  select coalesce(sum(monto), 0) into v_pagado
  from public.pagos_facturas_compra where factura_id = new.factura_id;
  if new.monto > v_total - v_pagado then
    raise exception 'El abono supera el saldo pendiente de la factura';
  end if;
  return new;
end;
$$;

create or replace function public.validar_vinculo_factura_compra()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.compra_ingrediente_id is not null
     and exists (select 1 from public.compras_ingredientes compra
                 where compra.id = old.compra_ingrediente_id and compra.tipo = 'ingreso_factura')
     and (new.compra_ingrediente_id is distinct from old.compra_ingrediente_id
          or new.ingrediente_id is distinct from old.ingrediente_id
          or new.cantidad_base is distinct from old.cantidad_base) then
    raise exception 'El inventario de esta línea ya fue ingresado; no se puede desvincular ni cambiar su cantidad';
  end if;
  if new.compra_ingrediente_id is not null and not exists (
    select 1 from public.compras_ingredientes compra
    where compra.id = new.compra_ingrediente_id
      and compra.tipo in ('compra', 'ingreso_factura')
      and compra.ingrediente_id = new.ingrediente_id
  ) then
    raise exception 'La compra o el ingreso de inventario no corresponde al ingrediente';
  end if;
  if new.compra_ingrediente_id is not null
     and exists (select 1 from public.compras_ingredientes compra
                 where compra.id = new.compra_ingrediente_id and compra.tipo = 'compra')
     and exists (select 1 from public.pagos_facturas_compra pago
                 where pago.factura_id = new.factura_id) then
    raise exception 'Esta factura ya tiene pagos en caja; no se puede enlazar a una compra pagada anteriormente';
  end if;
  return new;
end;
$$;
