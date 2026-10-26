-- Una factura puede ingresar a inventario antes de recibir pagos.
-- Cada abono crea exactamente un gasto en caja, vinculado a su factura.
create table public.pagos_facturas_compra (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas_compra(id) on delete restrict,
  monto numeric(14,2) not null check (monto > 0),
  fecha date not null default current_date,
  cuenta_id uuid not null references public.cuentas_financieras(id) on delete restrict,
  metodo_pago text not null check (btrim(metodo_pago) <> ''),
  referencia text,
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index pagos_facturas_compra_factura_idx
  on public.pagos_facturas_compra(factura_id, fecha desc);

alter table public.pagos_facturas_compra enable row level security;
revoke all on public.pagos_facturas_compra from anon;
grant select, insert on public.pagos_facturas_compra to authenticated;

create policy "pagos facturas compra lectura" on public.pagos_facturas_compra
  for select to authenticated
  using ((select private.tiene_modulo_crm('flujo_caja')));
create policy "pagos facturas compra alta" on public.pagos_facturas_compra
  for insert to authenticated
  with check ((select private.tiene_modulo_crm('flujo_caja')) and creado_por = (select auth.uid()));

create function public.validar_pago_factura_compra()
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

create function public.registrar_pago_factura_compra_en_caja()
returns trigger language plpgsql security invoker set search_path = public, private as $$
declare
  v_cuenta public.cuentas_financieras;
  v_factura public.facturas_compra;
begin
  select * into v_cuenta from public.cuentas_financieras where id = new.cuenta_id;
  select * into v_factura from public.facturas_compra where id = new.factura_id;
  insert into public.movimientos_caja
    (tipo, categoria, descripcion, monto, fecha, cuenta, cuenta_id,
     origen, origen_id, metodo_pago, creado_por)
  values
    ('Gasto', v_factura.categoria,
     'Factura de compra ' || coalesce(v_factura.numero, 'sin número') || coalesce(' · ' || nullif(btrim(new.referencia), ''), ''),
     new.monto, new.fecha, v_cuenta.nombre, v_cuenta.id,
     'factura_compra', new.id, new.metodo_pago, new.creado_por);
  return new;
end;
$$;

create trigger validar_pago_factura_compra
  before insert on public.pagos_facturas_compra
  for each row execute function public.validar_pago_factura_compra();
create trigger pago_factura_compra_a_caja
  after insert on public.pagos_facturas_compra
  for each row execute function public.registrar_pago_factura_compra_en_caja();
