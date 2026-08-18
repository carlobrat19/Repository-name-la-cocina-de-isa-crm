create table public.cuentas_financieras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null check (tipo in ('Caja', 'Banco', 'POS', 'Tarjeta de crédito', 'Billetera digital')),
  saldo_inicial numeric(14,2) not null default 0,
  fecha_saldo_inicial date not null default current_date,
  activa boolean not null default true,
  notas text,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cuentas_financieras enable row level security;
revoke all on public.cuentas_financieras from anon;
grant select, insert, update on public.cuentas_financieras to authenticated;

create policy "modulo flujo cuentas lectura" on public.cuentas_financieras for select to authenticated
using (private.tiene_modulo_crm('flujo_caja'));
create policy "modulo flujo cuentas alta" on public.cuentas_financieras for insert to authenticated
with check (private.tiene_modulo_crm('flujo_caja') and creado_por = (select auth.uid()));
create policy "modulo flujo cuentas edicion" on public.cuentas_financieras for update to authenticated
using (private.tiene_modulo_crm('flujo_caja')) with check (private.tiene_modulo_crm('flujo_caja'));

insert into public.cuentas_financieras (nombre, tipo, creado_por) values
  ('Caja', 'Caja', null),
  ('Banco principal', 'Banco', null),
  ('POS / tarjetas por cobrar', 'POS', null),
  ('Tarjeta de crédito', 'Tarjeta de crédito', null)
on conflict (nombre) do nothing;

alter table public.movimientos_caja
  add column if not exists cuenta_id uuid references public.cuentas_financieras(id) on delete set null,
  add column if not exists cuenta_destino_id uuid references public.cuentas_financieras(id) on delete set null;

create index if not exists movimientos_caja_cuenta_idx on public.movimientos_caja (cuenta_id, fecha desc);

update public.movimientos_caja movimiento
set cuenta_id = cuenta.id
from public.cuentas_financieras cuenta
where movimiento.cuenta_id is null and (
  (movimiento.cuenta = 'Caja' and cuenta.nombre = 'Caja') or
  (movimiento.cuenta = 'Banco' and cuenta.nombre = 'Banco principal') or
  (movimiento.cuenta = 'Tarjeta / POS' and cuenta.nombre = 'POS / tarjetas por cobrar') or
  (movimiento.cuenta = 'Tarjeta de crédito' and cuenta.nombre = 'Tarjeta de crédito')
);

create or replace function public.cuenta_financiera_por_texto(p_nombre text, p_metodo text default null)
returns uuid language sql stable set search_path = public as $$
  select id from public.cuentas_financieras
  where activa and (
    nombre = p_nombre or
    (lower(coalesce(p_metodo, '')) like '%efectivo%' and tipo = 'Caja') or
    (lower(coalesce(p_metodo, '')) like '%tarjeta%' and tipo = 'POS') or
    (lower(coalesce(p_metodo, '')) like '%pos%' and tipo = 'POS') or
    (lower(coalesce(p_metodo, '')) like '%crédito%' and tipo = 'Tarjeta de crédito') or
    (lower(coalesce(p_metodo, '')) like '%transferencia%' and tipo = 'Banco')
  ) order by case when nombre = p_nombre then 0 else 1 end, created_at limit 1;
$$;

create or replace function public.registrar_movimiento_pago_caja()
returns trigger language plpgsql set search_path = public as $$
declare v_cuenta_id uuid;
begin
  select public.cuenta_financiera_por_texto(null, new.metodo) into v_cuenta_id;
  insert into public.movimientos_caja (tipo, categoria, descripcion, monto, fecha, cuenta, cuenta_id, pedido_id, origen, origen_id, metodo_pago, creado_por)
  values ('Ingreso', 'Cobro de pedido', coalesce((select codigo from public.pedidos where id = new.pedido_id), 'Pago') || coalesce(' · ' || new.referencia, ''), new.monto, coalesce(new.fecha, current_date), coalesce((select nombre from public.cuentas_financieras where id = v_cuenta_id), 'Banco principal'), v_cuenta_id, new.pedido_id, 'pago', new.id, new.metodo, (select auth.uid()))
  on conflict (origen, origen_id) where origen_id is not null do nothing;
  return new;
end;
$$;

create or replace function public.registrar_movimiento_compra_caja()
returns trigger language plpgsql set search_path = public as $$
declare v_cuenta_id uuid;
begin
  if new.tipo = 'compra' then
    select public.cuenta_financiera_por_texto(new.cuenta_pago, new.metodo_pago) into v_cuenta_id;
    insert into public.movimientos_caja (tipo, categoria, descripcion, monto, fecha, cuenta, cuenta_id, origen, origen_id, metodo_pago, creado_por)
    values ('Gasto', 'Materia prima', 'Compra de ' || coalesce((select nombre from public.ingredientes where id = new.ingrediente_id), 'ingrediente') || coalesce(' · ' || new.nota, ''), new.total, new.created_at::date, coalesce((select nombre from public.cuentas_financieras where id = v_cuenta_id), new.cuenta_pago), v_cuenta_id, 'compra_ingrediente', new.id, new.metodo_pago, (select auth.uid()))
    on conflict (origen, origen_id) where origen_id is not null do nothing;
  end if;
  return new;
end;
$$;
