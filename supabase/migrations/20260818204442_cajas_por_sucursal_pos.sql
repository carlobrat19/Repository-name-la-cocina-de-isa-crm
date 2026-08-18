-- Una caja física pertenece a una sucursal. Banco, POS de tarjetas y tarjetas
-- de crédito siguen siendo cuentas centrales, no cajas que se abren por local.
alter table public.cuentas_financieras
  add column if not exists sucursal_id uuid references public.sucursales(id) on delete restrict;

alter table public.sucursales
  add column if not exists caja_efectivo_id uuid references public.cuentas_financieras(id) on delete restrict;

create unique index if not exists cuentas_caja_por_sucursal_unica_idx
  on public.cuentas_financieras (sucursal_id)
  where sucursal_id is not null and tipo = 'Caja';

insert into public.cuentas_financieras (nombre, tipo, sucursal_id, notas)
select 'Caja · ' || sucursal.nombre, 'Caja', sucursal.id, 'Caja física de la sucursal'
from public.sucursales sucursal
where not exists (
  select 1 from public.cuentas_financieras cuenta
  where cuenta.sucursal_id = sucursal.id and cuenta.tipo = 'Caja'
);

update public.sucursales sucursal
set caja_efectivo_id = cuenta.id
from public.cuentas_financieras cuenta
where cuenta.sucursal_id = sucursal.id
  and cuenta.tipo = 'Caja'
  and sucursal.caja_efectivo_id is null;

create or replace function private.crear_caja_de_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare v_cuenta_id uuid;
begin
  insert into public.cuentas_financieras (nombre, tipo, sucursal_id, notas)
  values ('Caja · ' || new.nombre, 'Caja', new.id, 'Caja física de la sucursal')
  returning id into v_cuenta_id;
  update public.sucursales set caja_efectivo_id = v_cuenta_id where id = new.id;
  return new;
end;
$$;
revoke all on function private.crear_caja_de_sucursal() from public, anon;

drop trigger if exists sucursales_crean_caja on public.sucursales;
create trigger sucursales_crean_caja
after insert on public.sucursales
for each row execute function private.crear_caja_de_sucursal();

create or replace function private.asignar_cuenta_cobro_pos()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare v_metodo text; v_cuenta_id uuid; v_cuenta_nombre text;
begin
  select lower(coalesce(pago.metodo, '')), turno.cuenta_id
  into v_metodo, v_cuenta_id
  from public.pagos pago
  join public.turnos_caja_pos turno on turno.id = new.turno_id
  where pago.id = new.pago_id;
  if v_metodo not like '%efectivo%' then
    select id, nombre into v_cuenta_id, v_cuenta_nombre
    from public.cuentas_financieras
    where activa and sucursal_id is null and (
      (v_metodo like '%tarjeta%' or v_metodo like '%pos%') and tipo = 'POS'
      or (v_metodo like '%transferencia%' and tipo = 'Banco')
      or (v_metodo like '%link%' and tipo = 'Banco')
    )
    order by created_at
    limit 1;
  end if;
  if v_cuenta_id is not null then
    select nombre into v_cuenta_nombre from public.cuentas_financieras where id = v_cuenta_id;
    update public.movimientos_caja
    set cuenta_id = v_cuenta_id, cuenta = v_cuenta_nombre
    where origen = 'pago' and origen_id = new.pago_id;
  end if;
  return new;
end;
$$;
revoke all on function private.asignar_cuenta_cobro_pos() from public, anon;

drop trigger if exists ventas_pos_asignan_cuenta_cobro on public.ventas_pos;
create trigger ventas_pos_asignan_cuenta_cobro
after insert on public.ventas_pos
for each row execute function private.asignar_cuenta_cobro_pos();
