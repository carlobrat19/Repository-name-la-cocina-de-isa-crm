-- Punto de venta multi-sucursal: producción consume materias primas, los traslados
-- abastecen el inventario de cada sucursal y el POS descuenta producto terminado.

alter table public.permisos_usuario_crm
  drop constraint if exists permisos_usuario_crm_modulo_check;

alter table public.permisos_usuario_crm
  add constraint permisos_usuario_crm_modulo_check check (modulo in (
    'inicio', 'dashboard', 'pedidos', 'clientes', 'conversaciones', 'productos',
    'recetas_costos', 'ingredientes', 'produccion', 'pendientes', 'cobros_fel',
    'flujo_caja', 'reportes', 'integraciones', 'punto_venta', 'sucursales'
  ));

create table public.sucursales (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  marca text not null,
  tipo text not null check (tipo in ('cocina', 'punto_venta', 'quiosco')),
  direccion text,
  telefono text,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventario_sucursal_productos (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  existencia numeric(14,3) not null default 0 check (existencia >= 0),
  stock_minimo numeric(14,3) not null default 0 check (stock_minimo >= 0),
  updated_at timestamptz not null default now(),
  unique (sucursal_id, producto_id)
);

create table public.movimientos_inventario_sucursal (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales(id) on delete restrict,
  producto_id uuid not null references public.productos(id) on delete restrict,
  tipo text not null check (tipo in ('produccion', 'transferencia_entrada', 'transferencia_salida', 'venta_pos', 'ajuste', 'merma', 'devolucion')),
  cantidad numeric(14,3) not null check (cantidad <> 0),
  costo_unitario numeric(14,4) not null default 0,
  referencia text,
  observaciones text,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.turnos_caja_pos (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales(id) on delete restrict,
  cuenta_id uuid not null references public.cuentas_financieras(id) on delete restrict,
  cajero_id uuid not null references auth.users(id) on delete restrict,
  fondo_inicial numeric(14,2) not null default 0 check (fondo_inicial >= 0),
  efectivo_esperado numeric(14,2),
  efectivo_contado numeric(14,2),
  diferencia numeric(14,2),
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  abierto_at timestamptz not null default now(),
  cerrado_at timestamptz,
  notas_apertura text,
  notas_cierre text
);

create unique index turnos_pos_un_turno_abierto_por_cajero_idx
  on public.turnos_caja_pos (sucursal_id, cajero_id) where estado = 'abierto';

create table public.ventas_pos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.pedidos(id) on delete restrict,
  sucursal_id uuid not null references public.sucursales(id) on delete restrict,
  turno_id uuid not null references public.turnos_caja_pos(id) on delete restrict,
  pago_id uuid references public.pagos(id) on delete set null,
  cajero_id uuid not null references auth.users(id) on delete restrict,
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create sequence public.folio_venta_pos_seq start with 1;

create index inventario_sucursal_producto_idx on public.inventario_sucursal_productos (sucursal_id, producto_id);
create index movimientos_inventario_sucursal_fecha_idx on public.movimientos_inventario_sucursal (sucursal_id, created_at desc);
create index ventas_pos_sucursal_fecha_idx on public.ventas_pos (sucursal_id, created_at desc);

insert into public.sucursales (codigo, nombre, marca, tipo)
values
  ('COCINA-ISA', 'La Cocina de Isa · Cocina central', 'La Cocina de Isa', 'cocina'),
  ('BRASAS-01', 'Brasas Bravas · Punto de venta', 'Brasas Bravas', 'punto_venta')
on conflict (codigo) do nothing;

-- La cocina central inicia con las existencias históricas de productos terminados.
insert into public.inventario_sucursal_productos (sucursal_id, producto_id, existencia)
select sucursal.id, producto.id, greatest(coalesce(producto.stock, 0), 0)
from public.sucursales sucursal
cross join public.productos producto
where sucursal.codigo = 'COCINA-ISA'
on conflict (sucursal_id, producto_id) do nothing;

alter table public.sucursales enable row level security;
alter table public.inventario_sucursal_productos enable row level security;
alter table public.movimientos_inventario_sucursal enable row level security;
alter table public.turnos_caja_pos enable row level security;
alter table public.ventas_pos enable row level security;

revoke all on public.sucursales, public.inventario_sucursal_productos, public.movimientos_inventario_sucursal, public.turnos_caja_pos, public.ventas_pos from anon;
grant select, insert, update on public.sucursales, public.inventario_sucursal_productos, public.movimientos_inventario_sucursal, public.turnos_caja_pos, public.ventas_pos to authenticated;

create policy "pos sucursales consulta" on public.sucursales for select to authenticated
using (private.tiene_modulo_crm('punto_venta') or private.tiene_modulo_crm('sucursales'));
create policy "sucursales administracion" on public.sucursales for all to authenticated
using (private.tiene_modulo_crm('sucursales')) with check (private.tiene_modulo_crm('sucursales'));
create policy "pos inventario consulta" on public.inventario_sucursal_productos for select to authenticated
using (private.tiene_modulo_crm('punto_venta') or private.tiene_modulo_crm('sucursales'));
create policy "pos movimientos consulta" on public.movimientos_inventario_sucursal for select to authenticated
using (private.tiene_modulo_crm('punto_venta') or private.tiene_modulo_crm('sucursales'));
create policy "pos turnos consulta" on public.turnos_caja_pos for select to authenticated
using (private.tiene_modulo_crm('punto_venta') or private.tiene_modulo_crm('sucursales'));
create policy "pos turnos alta propia" on public.turnos_caja_pos for insert to authenticated
with check (private.tiene_modulo_crm('punto_venta') and cajero_id = (select auth.uid()));
create policy "pos turnos cierre propio" on public.turnos_caja_pos for update to authenticated
using (private.tiene_modulo_crm('punto_venta') and cajero_id = (select auth.uid()))
with check (private.tiene_modulo_crm('punto_venta') and cajero_id = (select auth.uid()));
create policy "pos ventas consulta" on public.ventas_pos for select to authenticated
using (private.tiene_modulo_crm('punto_venta') or private.tiene_modulo_crm('reportes') or private.tiene_modulo_crm('sucursales'));

-- El módulo POS necesita leer catálogo y cuenta, pero las mutaciones sensibles
-- pasan por funciones privadas que validan al usuario y se ejecutan en una transacción.
create policy "pos productos consulta" on public.productos for select to authenticated
using (private.tiene_modulo_crm('punto_venta'));
create policy "pos cuentas consulta" on public.cuentas_financieras for select to authenticated
using (private.tiene_modulo_crm('punto_venta'));

create or replace function private.registrar_venta_pos(
  p_sucursal_id uuid,
  p_turno_id uuid,
  p_items jsonb,
  p_metodo text,
  p_cliente_id uuid default null,
  p_cliente text default 'Consumidor final',
  p_telefono text default null,
  p_referencia text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_turno public.turnos_caja_pos;
  v_item jsonb;
  v_producto public.productos;
  v_inventario public.inventario_sucursal_productos;
  v_cantidad numeric(14,3);
  v_total numeric(14,2) := 0;
  v_pedido_id uuid;
  v_pago_id uuid;
  v_venta_id uuid;
  v_codigo text;
begin
  if v_usuario is null or not private.tiene_modulo_crm('punto_venta') then
    raise exception 'No autorizado para registrar ventas de punto de venta';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto al cobro';
  end if;
  select * into v_turno from public.turnos_caja_pos
  where id = p_turno_id and sucursal_id = p_sucursal_id and cajero_id = v_usuario and estado = 'abierto'
  for update;
  if not found then raise exception 'Abre tu caja antes de cobrar en esta sucursal'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_cantidad := coalesce((v_item->>'cantidad')::numeric, 0);
    if v_cantidad <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;
    select * into v_producto from public.productos where id = (v_item->>'producto_id')::uuid and estado = 'Activo';
    if not found then raise exception 'Uno de los productos ya no está disponible'; end if;
    select * into v_inventario from public.inventario_sucursal_productos
    where sucursal_id = p_sucursal_id and producto_id = v_producto.id for update;
    if not found or v_inventario.existencia < v_cantidad then
      raise exception 'Existencia insuficiente para %', v_producto.nombre;
    end if;
    v_total := v_total + round(v_producto.precio_venta * v_cantidad, 2);
  end loop;

  v_codigo := 'PV-' || lpad(nextval('public.folio_venta_pos_seq')::text, 6, '0');
  insert into public.pedidos (codigo, cliente_id, cliente, telefono, fecha_pedido, fecha_entrega, fecha_creacion, estado, pago_estado, estado_pago, metodo_pago, forma_pago, total, subtotal_productos, saldo_pendiente, tipo_documento, canal_origen, requiere_envio, creado_por)
  values (v_codigo, p_cliente_id, coalesce(nullif(trim(p_cliente), ''), 'Consumidor final'), nullif(trim(p_telefono), ''), current_date, current_date, now(), 'Entregado', 'Pagado', 'Pagado', coalesce(nullif(trim(p_metodo), ''), 'Efectivo'), coalesce(nullif(trim(p_metodo), ''), 'Efectivo'), v_total, v_total, 0, 'Pedido POS', 'POS', false, v_usuario)
  returning id into v_pedido_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::numeric;
    select * into v_producto from public.productos where id = (v_item->>'producto_id')::uuid;
    update public.inventario_sucursal_productos
      set existencia = existencia - v_cantidad, updated_at = now()
    where id = (select id from public.inventario_sucursal_productos where sucursal_id = p_sucursal_id and producto_id = v_producto.id for update);
    insert into public.pedido_detalle (pedido_id, producto_id, cantidad, precio, costo)
    values (v_pedido_id, v_producto.id, v_cantidad::integer, v_producto.precio_venta, v_producto.costo);
    insert into public.movimientos_inventario_sucursal (sucursal_id, producto_id, tipo, cantidad, costo_unitario, referencia, creado_por)
    values (p_sucursal_id, v_producto.id, 'venta_pos', -v_cantidad, coalesce(v_producto.costo, 0), v_codigo, v_usuario);
  end loop;

  insert into public.pagos (pedido_id, cliente_id, monto, metodo, referencia, fecha)
  values (v_pedido_id, p_cliente_id, v_total, coalesce(nullif(trim(p_metodo), ''), 'Efectivo'), nullif(trim(p_referencia), ''), current_date)
  returning id into v_pago_id;

  update public.movimientos_caja movimiento
  set cuenta_id = v_turno.cuenta_id,
      cuenta = (select nombre from public.cuentas_financieras where id = v_turno.cuenta_id),
      creado_por = v_usuario
  where movimiento.origen = 'pago' and movimiento.origen_id = v_pago_id;

  insert into public.ventas_pos (pedido_id, sucursal_id, turno_id, pago_id, cajero_id, total)
  values (v_pedido_id, p_sucursal_id, p_turno_id, v_pago_id, v_usuario, v_total)
  returning id into v_venta_id;
  return jsonb_build_object('venta_id', v_venta_id, 'pedido_id', v_pedido_id, 'codigo', v_codigo, 'total', v_total);
end;
$$;

create or replace function public.registrar_venta_pos(
  p_sucursal_id uuid, p_turno_id uuid, p_items jsonb, p_metodo text,
  p_cliente_id uuid default null, p_cliente text default 'Consumidor final',
  p_telefono text default null, p_referencia text default null
)
returns jsonb language sql security invoker set search_path = public, private as $$
  select private.registrar_venta_pos(p_sucursal_id, p_turno_id, p_items, p_metodo, p_cliente_id, p_cliente, p_telefono, p_referencia);
$$;
revoke all on function public.registrar_venta_pos(uuid, uuid, jsonb, text, uuid, text, text, text) from public, anon;
grant execute on function public.registrar_venta_pos(uuid, uuid, jsonb, text, uuid, text, text, text) to authenticated;
revoke all on function private.registrar_venta_pos(uuid, uuid, jsonb, text, uuid, text, text, text) from public, anon;
grant execute on function private.registrar_venta_pos(uuid, uuid, jsonb, text, uuid, text, text, text) to authenticated;

create or replace function private.transferir_inventario_sucursal(
  p_origen uuid, p_destino uuid, p_producto uuid, p_cantidad numeric, p_nota text default null
)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_usuario uuid := (select auth.uid()); v_origen public.inventario_sucursal_productos;
begin
  if v_usuario is null or not private.tiene_modulo_crm('sucursales') then raise exception 'No autorizado para trasladar inventario'; end if;
  if p_origen = p_destino or p_cantidad is null or p_cantidad <= 0 then raise exception 'Selecciona sucursales distintas y una cantidad válida'; end if;
  select * into v_origen from public.inventario_sucursal_productos where sucursal_id = p_origen and producto_id = p_producto for update;
  if not found or v_origen.existencia < p_cantidad then raise exception 'No hay suficiente inventario en el origen'; end if;
  update public.inventario_sucursal_productos set existencia = existencia - p_cantidad, updated_at = now() where id = v_origen.id;
  insert into public.inventario_sucursal_productos (sucursal_id, producto_id, existencia) values (p_destino, p_producto, p_cantidad)
  on conflict (sucursal_id, producto_id) do update set existencia = public.inventario_sucursal_productos.existencia + excluded.existencia, updated_at = now();
  insert into public.movimientos_inventario_sucursal (sucursal_id, producto_id, tipo, cantidad, costo_unitario, referencia, observaciones, creado_por)
  values
    (p_origen, p_producto, 'transferencia_salida', -p_cantidad, 0, 'Traslado', p_nota, v_usuario),
    (p_destino, p_producto, 'transferencia_entrada', p_cantidad, 0, 'Traslado', p_nota, v_usuario);
end;
$$;
create or replace function public.transferir_inventario_sucursal(p_origen uuid, p_destino uuid, p_producto uuid, p_cantidad numeric, p_nota text default null)
returns void language sql security invoker set search_path = public, private as $$ select private.transferir_inventario_sucursal(p_origen, p_destino, p_producto, p_cantidad, p_nota); $$;
revoke all on function public.transferir_inventario_sucursal(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.transferir_inventario_sucursal(uuid, uuid, uuid, numeric, text) to authenticated;
revoke all on function private.transferir_inventario_sucursal(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function private.transferir_inventario_sucursal(uuid, uuid, uuid, numeric, text) to authenticated;

create policy "sucursales reportes inventario" on public.inventario_sucursal_productos for select to authenticated
using (private.tiene_modulo_crm('reportes') or private.tiene_modulo_crm('dashboard'));
create policy "sucursales reportes ventas" on public.ventas_pos for select to authenticated
using (private.tiene_modulo_crm('dashboard'));
