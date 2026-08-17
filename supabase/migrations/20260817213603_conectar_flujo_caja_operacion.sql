alter table public.movimientos_caja
  add column if not exists origen text not null default 'manual',
  add column if not exists origen_id uuid,
  add column if not exists metodo_pago text,
  add column if not exists creado_por uuid references auth.users(id),
  add column if not exists created_at timestamptz not null default now();

alter table public.compras_ingredientes
  add column if not exists metodo_pago text not null default 'Efectivo',
  add column if not exists cuenta_pago text not null default 'Caja';

create unique index if not exists movimientos_caja_origen_unico_idx
  on public.movimientos_caja (origen, origen_id)
  where origen_id is not null;

create index if not exists movimientos_caja_fecha_idx
  on public.movimientos_caja (fecha desc);

create or replace function public.registrar_movimiento_pago_caja()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.movimientos_caja (tipo, categoria, descripcion, monto, fecha, cuenta, pedido_id, origen, origen_id, metodo_pago, creado_por)
  values (
    'Ingreso', 'Cobro de pedido',
    coalesce((select codigo from public.pedidos where id = new.pedido_id), 'Pago') || coalesce(' · ' || new.referencia, ''),
    new.monto, coalesce(new.fecha, current_date),
    case when lower(coalesce(new.metodo, '')) like '%efectivo%' then 'Caja'
         when lower(coalesce(new.metodo, '')) like '%tarjeta%' or lower(coalesce(new.metodo, '')) like '%pos%' then 'Tarjeta / POS'
         when lower(coalesce(new.metodo, '')) like '%crédito%' then 'Tarjeta de crédito'
         else 'Banco' end,
    new.pedido_id, 'pago', new.id, new.metodo, (select auth.uid())
  ) on conflict (origen, origen_id) where origen_id is not null do nothing;
  return new;
end;
$$;

create or replace function public.registrar_movimiento_compra_caja()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tipo = 'compra' then
    insert into public.movimientos_caja (tipo, categoria, descripcion, monto, fecha, cuenta, origen, origen_id, metodo_pago, creado_por)
    values (
      'Gasto', 'Materia prima',
      'Compra de ' || coalesce((select nombre from public.ingredientes where id = new.ingrediente_id), 'ingrediente') || coalesce(' · ' || new.nota, ''),
      new.total, new.created_at::date, new.cuenta_pago, 'compra_ingrediente', new.id, new.metodo_pago, (select auth.uid())
    ) on conflict (origen, origen_id) where origen_id is not null do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists pagos_registran_caja on public.pagos;
create trigger pagos_registran_caja after insert on public.pagos
for each row execute function public.registrar_movimiento_pago_caja();

drop trigger if exists compras_registran_caja on public.compras_ingredientes;
create trigger compras_registran_caja after insert on public.compras_ingredientes
for each row execute function public.registrar_movimiento_compra_caja();

create or replace function public.registrar_compra_ingrediente(
  p_ingrediente_id uuid,
  p_cantidad numeric,
  p_costo_unitario numeric,
  p_nota text default null,
  p_metodo_pago text default 'Efectivo',
  p_cuenta_pago text default 'Caja'
)
returns public.ingredientes
language plpgsql
security invoker
set search_path = public, private
as $$
declare ingrediente_actual public.ingredientes; ingrediente_actualizado public.ingredientes;
begin
  if (select auth.uid()) is null or not private.tiene_modulo_crm('productos') then raise exception 'No autorizado para registrar compras de ingredientes'; end if;
  if p_cantidad is null or p_cantidad <= 0 or p_costo_unitario is null or p_costo_unitario < 0 then raise exception 'Cantidad y costo unitario deben ser válidos'; end if;
  select * into ingrediente_actual from public.ingredientes where id = p_ingrediente_id for update;
  if not found then raise exception 'Ingrediente no encontrado'; end if;
  update public.ingredientes set stock_actual = ingrediente_actual.stock_actual + p_cantidad, costo_referencia = ((ingrediente_actual.stock_actual * ingrediente_actual.costo_referencia) + (p_cantidad * p_costo_unitario)) / (ingrediente_actual.stock_actual + p_cantidad), updated_at = now() where id = p_ingrediente_id returning * into ingrediente_actualizado;
  insert into public.compras_ingredientes (ingrediente_id, tipo, cantidad, costo_unitario, total, nota, creado_por, metodo_pago, cuenta_pago)
  values (p_ingrediente_id, 'compra', p_cantidad, p_costo_unitario, round(p_cantidad * p_costo_unitario, 2), p_nota, (select auth.uid()), coalesce(nullif(trim(p_metodo_pago), ''), 'Efectivo'), coalesce(nullif(trim(p_cuenta_pago), ''), 'Caja'));
  return ingrediente_actualizado;
end;
$$;

revoke all on function public.registrar_compra_ingrediente(uuid, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.registrar_compra_ingrediente(uuid, numeric, numeric, text, text, text) to authenticated;
