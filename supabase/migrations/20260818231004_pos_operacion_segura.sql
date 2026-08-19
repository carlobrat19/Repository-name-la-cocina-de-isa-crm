-- Operación segura del POS: sucursales asignadas, catálogo local, arqueo,
-- movimientos de caja, ventas reversables y datos fiscales para FEL.

create table public.usuarios_sucursales (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  sucursal_id uuid not null references public.sucursales(id) on delete cascade,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (usuario_id, sucursal_id)
);

create table public.catalogo_sucursal_productos (
  sucursal_id uuid not null references public.sucursales(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  disponible boolean not null default true,
  precio_venta numeric(14,2),
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (sucursal_id, producto_id)
);

create table public.movimientos_caja_pos (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos_caja_pos(id) on delete restrict,
  sucursal_id uuid not null references public.sucursales(id) on delete restrict,
  tipo text not null check (tipo in ('gasto_menor', 'retiro', 'deposito', 'ingreso_ajuste')),
  monto numeric(14,2) not null check (monto > 0),
  categoria text not null,
  descripcion text not null,
  cuenta_destino_id uuid references public.cuentas_financieras(id) on delete restrict,
  movimiento_caja_id uuid references public.movimientos_caja(id) on delete set null,
  creado_por uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.ventas_pos
  add column if not exists estado text not null default 'Completada' check (estado in ('Completada', 'Anulada')),
  add column if not exists anulada_at timestamptz,
  add column if not exists anulada_por uuid references auth.users(id) on delete set null,
  add column if not exists motivo_anulacion text;

create index usuarios_sucursales_usuario_idx on public.usuarios_sucursales (usuario_id) where activa;
create index catalogo_sucursal_producto_disponible_idx on public.catalogo_sucursal_productos (sucursal_id, producto_id) where disponible;
create index movimientos_caja_pos_turno_idx on public.movimientos_caja_pos (turno_id, created_at desc);
create index ventas_pos_estado_sucursal_idx on public.ventas_pos (sucursal_id, estado, created_at desc);

insert into public.catalogo_sucursal_productos (sucursal_id, producto_id)
select sucursal_id, producto_id from public.inventario_sucursal_productos
on conflict (sucursal_id, producto_id) do nothing;

-- El administrador mantiene visibilidad global; los demás solo ven su local asignado.
create or replace function private.es_administrador_crm()
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.tiene_rol_crm(array['Administrador']);
$$;
revoke all on function private.es_administrador_crm() from public, anon;
grant execute on function private.es_administrador_crm() to authenticated;

create or replace function private.puede_operar_sucursal(p_sucursal_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.es_administrador_crm() or exists (
    select 1 from public.usuarios_sucursales asignacion
    where asignacion.usuario_id = (select auth.uid()) and asignacion.sucursal_id = p_sucursal_id and asignacion.activa
  );
$$;
revoke all on function private.puede_operar_sucursal(uuid) from public, anon;
grant execute on function private.puede_operar_sucursal(uuid) to authenticated;

alter table public.usuarios_sucursales enable row level security;
alter table public.catalogo_sucursal_productos enable row level security;
alter table public.movimientos_caja_pos enable row level security;
revoke all on public.usuarios_sucursales, public.catalogo_sucursal_productos, public.movimientos_caja_pos from anon;
grant select, insert, update, delete on public.usuarios_sucursales, public.catalogo_sucursal_productos to authenticated;
grant select on public.movimientos_caja_pos to authenticated;

create policy "administrador gestiona asignaciones de sucursal" on public.usuarios_sucursales for all to authenticated
using ((select private.es_administrador_crm())) with check ((select private.es_administrador_crm()));
create policy "usuario consulta sus sucursales" on public.usuarios_sucursales for select to authenticated
using (usuario_id = (select auth.uid()));
create policy "administrador gestiona catalogo sucursal" on public.catalogo_sucursal_productos for all to authenticated
using ((select private.es_administrador_crm())) with check ((select private.es_administrador_crm()));
create policy "pos consulta catalogo asignado" on public.catalogo_sucursal_productos for select to authenticated
using ((select private.puede_operar_sucursal(sucursal_id)) and (select private.tiene_modulo_crm('punto_venta')));
create policy "pos consulta sus movimientos caja" on public.movimientos_caja_pos for select to authenticated
using (creado_por = (select auth.uid()) or (select private.es_administrador_crm()));

drop policy if exists "pos sucursales consulta" on public.sucursales;
drop policy if exists "pos inventario consulta" on public.inventario_sucursal_productos;
drop policy if exists "pos movimientos consulta" on public.movimientos_inventario_sucursal;
drop policy if exists "pos turnos consulta" on public.turnos_caja_pos;
drop policy if exists "pos turnos alta propia" on public.turnos_caja_pos;
drop policy if exists "pos turnos cierre propio" on public.turnos_caja_pos;
drop policy if exists "pos ventas consulta" on public.ventas_pos;

create policy "pos sucursales asignadas" on public.sucursales for select to authenticated
using (((select private.tiene_modulo_crm('sucursales')) and (select private.es_administrador_crm())) or ((select private.tiene_modulo_crm('punto_venta')) and (select private.puede_operar_sucursal(id))));
create policy "pos inventario asignado" on public.inventario_sucursal_productos for select to authenticated
using ((select private.tiene_modulo_crm('sucursales')) or ((select private.tiene_modulo_crm('punto_venta')) and (select private.puede_operar_sucursal(sucursal_id))));
create policy "pos movimientos asignados" on public.movimientos_inventario_sucursal for select to authenticated
using ((select private.tiene_modulo_crm('sucursales')) or ((select private.tiene_modulo_crm('punto_venta')) and (select private.puede_operar_sucursal(sucursal_id))));
create policy "pos turnos propios o administrador" on public.turnos_caja_pos for select to authenticated
using (cajero_id = (select auth.uid()) or (select private.es_administrador_crm()));
create policy "pos turnos abre asignado" on public.turnos_caja_pos for insert to authenticated
with check ((select private.tiene_modulo_crm('punto_venta')) and cajero_id = (select auth.uid()) and (select private.puede_operar_sucursal(sucursal_id)));
create policy "pos turnos cierra propio" on public.turnos_caja_pos for update to authenticated
using (cajero_id = (select auth.uid())) with check (cajero_id = (select auth.uid()));
create policy "pos ventas propias o reportes" on public.ventas_pos for select to authenticated
using (cajero_id = (select auth.uid()) or (select private.tiene_modulo_crm('reportes')) or (select private.es_administrador_crm()));

-- Mantiene compatibilidad de permisos de administración y evita que los cajeros
-- editen tablas sensibles desde el cliente.
create or replace function private.registrar_movimiento_caja_pos(
  p_turno_id uuid, p_tipo text, p_monto numeric, p_categoria text, p_descripcion text, p_cuenta_destino_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_usuario uuid := (select auth.uid()); v_turno public.turnos_caja_pos; v_movimiento_id uuid; v_destino public.cuentas_financieras;
begin
  if v_usuario is null or not private.tiene_modulo_crm('punto_venta') then raise exception 'No autorizado'; end if;
  select * into v_turno from public.turnos_caja_pos where id = p_turno_id and cajero_id = v_usuario and estado = 'abierto' for update;
  if not found or not private.puede_operar_sucursal(v_turno.sucursal_id) then raise exception 'No tienes una caja abierta en esta sucursal'; end if;
  if p_tipo not in ('gasto_menor','retiro','deposito','ingreso_ajuste') or coalesce(p_monto,0) <= 0 or trim(coalesce(p_descripcion,'')) = '' then raise exception 'Completa tipo, monto y descripción'; end if;
  if p_tipo = 'deposito' and p_cuenta_destino_id is null then
    select * into v_destino from public.cuentas_financieras where activa and sucursal_id is null and tipo = 'Banco' order by created_at limit 1;
    p_cuenta_destino_id := v_destino.id;
  end if;
  if p_cuenta_destino_id is not null then select * into v_destino from public.cuentas_financieras where id=p_cuenta_destino_id and activa; if not found then raise exception 'Cuenta destino inválida'; end if; end if;
  insert into public.movimientos_caja (tipo,categoria,descripcion,monto,fecha,cuenta,cuenta_id,cuenta_destino_id,origen,metodo_pago,creado_por)
  values (case when p_tipo='gasto_menor' then 'Gasto' when p_tipo='ingreso_ajuste' then 'Ingreso' else 'Transferencia' end, p_categoria, p_descripcion, p_monto, now(), (select nombre from public.cuentas_financieras where id=v_turno.cuenta_id), v_turno.cuenta_id, p_cuenta_destino_id, 'pos_'||p_tipo, 'Efectivo', v_usuario)
  returning id into v_movimiento_id;
  insert into public.movimientos_caja_pos(turno_id,sucursal_id,tipo,monto,categoria,descripcion,cuenta_destino_id,movimiento_caja_id,creado_por)
  values(v_turno.id,v_turno.sucursal_id,p_tipo,p_monto,p_categoria,p_descripcion,p_cuenta_destino_id,v_movimiento_id,v_usuario);
  return jsonb_build_object('id',v_movimiento_id);
end; $$;

create or replace function public.registrar_movimiento_caja_pos(uuid,text,numeric,text,text,uuid default null)
returns jsonb language sql security invoker set search_path=public,private as $$ select private.registrar_movimiento_caja_pos($1,$2,$3,$4,$5,$6); $$;
revoke all on function public.registrar_movimiento_caja_pos(uuid,text,numeric,text,text,uuid) from public, anon;
grant execute on function public.registrar_movimiento_caja_pos(uuid,text,numeric,text,text,uuid) to authenticated;
revoke all on function private.registrar_movimiento_caja_pos(uuid,text,numeric,text,text,uuid) from public, anon;

create or replace function public.resumen_turno_pos(p_turno_id uuid)
returns jsonb language sql security invoker set search_path=public,private as $$
  select jsonb_build_object(
    'efectivo_ventas', coalesce((select sum(v.total) from public.ventas_pos v join public.pagos p on p.id=v.pago_id where v.turno_id=p_turno_id and v.estado='Completada' and lower(p.metodo) like '%efectivo%'),0),
    'salidas', coalesce((select sum(m.monto) from public.movimientos_caja_pos m where m.turno_id=p_turno_id and m.tipo in ('gasto_menor','retiro','deposito')),0),
    'ingresos_ajuste', coalesce((select sum(m.monto) from public.movimientos_caja_pos m where m.turno_id=p_turno_id and m.tipo='ingreso_ajuste'),0)
  );
$$;
revoke all on function public.resumen_turno_pos(uuid) from public, anon;
grant execute on function public.resumen_turno_pos(uuid) to authenticated;

-- Reemplaza la operación POS para validar la sucursal y guardar/actualizar cliente fiscal.
drop function if exists public.registrar_venta_pos(uuid,uuid,jsonb,text,uuid,text,text,text);
drop function if exists private.registrar_venta_pos(uuid,uuid,jsonb,text,uuid,text,text,text);
create or replace function private.registrar_venta_pos(p_sucursal_id uuid,p_turno_id uuid,p_items jsonb,p_metodo text,p_cliente_id uuid default null,p_cliente text default 'Consumidor final',p_telefono text default null,p_referencia text default null,p_nit text default null,p_razon_social text default null,p_direccion_fiscal text default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare v_usuario uuid := (select auth.uid()); v_turno public.turnos_caja_pos; v_item jsonb; v_producto public.productos; v_inventario public.inventario_sucursal_productos; v_cantidad numeric(14,3); v_total numeric(14,2):=0; v_pedido_id uuid; v_pago_id uuid; v_venta_id uuid; v_codigo text; v_cliente_id uuid:=p_cliente_id;
begin
 if v_usuario is null or not private.tiene_modulo_crm('punto_venta') or not private.puede_operar_sucursal(p_sucursal_id) then raise exception 'No autorizado para esta sucursal'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Agrega al menos un producto'; end if;
 select * into v_turno from public.turnos_caja_pos where id=p_turno_id and sucursal_id=p_sucursal_id and cajero_id=v_usuario and estado='abierto' for update; if not found then raise exception 'Abre tu caja antes de cobrar'; end if;
 if coalesce(nullif(trim(p_nit),''),null) is not null or coalesce(nullif(trim(p_telefono),''),null) is not null or lower(coalesce(trim(p_cliente),'')) <> 'consumidor final' then
   if v_cliente_id is null then select id into v_cliente_id from public.clientes where (nullif(trim(p_nit),'') is not null and nit=trim(p_nit)) or (nullif(trim(p_telefono),'') is not null and telefono=trim(p_telefono)) order by updated_at desc limit 1; end if;
   if v_cliente_id is null then insert into public.clientes(nombre,telefono,nit,razon_social,direccion,canal_origen) values(coalesce(nullif(trim(p_cliente),''),'Consumidor final'),nullif(trim(p_telefono),''),nullif(trim(p_nit),''),nullif(trim(p_razon_social),''),nullif(trim(p_direccion_fiscal),''),'POS') returning id into v_cliente_id;
   else update public.clientes set nombre=coalesce(nullif(trim(p_cliente),''),nombre),telefono=coalesce(nullif(trim(p_telefono),''),telefono),nit=coalesce(nullif(trim(p_nit),''),nit),razon_social=coalesce(nullif(trim(p_razon_social),''),razon_social),direccion=coalesce(nullif(trim(p_direccion_fiscal),''),direccion),updated_at=now() where id=v_cliente_id; end if;
 end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
   v_cantidad:=coalesce((v_item->>'cantidad')::numeric,0); if v_cantidad<=0 then raise exception 'Cantidad inválida'; end if;
   select p.* into v_producto from public.productos p join public.catalogo_sucursal_productos c on c.producto_id=p.id and c.sucursal_id=p_sucursal_id and c.disponible where p.id=(v_item->>'producto_id')::uuid and p.estado='Activo'; if not found then raise exception 'Producto no habilitado en esta sucursal'; end if;
   select * into v_inventario from public.inventario_sucursal_productos where sucursal_id=p_sucursal_id and producto_id=v_producto.id for update; if not found or v_inventario.existencia<v_cantidad then raise exception 'Existencia insuficiente para %',v_producto.nombre; end if;
   v_total:=v_total+round(coalesce((select precio_venta from public.catalogo_sucursal_productos where sucursal_id=p_sucursal_id and producto_id=v_producto.id),v_producto.precio_venta)*v_cantidad,2);
 end loop;
 v_codigo:='PV-'||lpad(nextval('public.folio_venta_pos_seq')::text,6,'0');
 insert into public.pedidos(codigo,cliente_id,cliente,telefono,fecha_pedido,fecha_entrega,fecha_creacion,estado,pago_estado,estado_pago,metodo_pago,forma_pago,total,subtotal_productos,saldo_pendiente,tipo_documento,canal_origen,requiere_envio,creado_por) values(v_codigo,v_cliente_id,coalesce(nullif(trim(p_cliente),''),'Consumidor final'),nullif(trim(p_telefono),''),current_date,current_date,now(),'Entregado','Pagado','Pagado',coalesce(nullif(trim(p_metodo),''),'Efectivo'),coalesce(nullif(trim(p_metodo),''),'Efectivo'),v_total,v_total,0,'Pedido POS','POS',false,v_usuario) returning id into v_pedido_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_cantidad:=(v_item->>'cantidad')::numeric; select * into v_producto from public.productos where id=(v_item->>'producto_id')::uuid;
  update public.inventario_sucursal_productos set existencia=existencia-v_cantidad,updated_at=now() where sucursal_id=p_sucursal_id and producto_id=v_producto.id;
  insert into public.pedido_detalle(pedido_id,producto_id,cantidad,precio,costo) values(v_pedido_id,v_producto.id,v_cantidad::integer,coalesce((select precio_venta from public.catalogo_sucursal_productos where sucursal_id=p_sucursal_id and producto_id=v_producto.id),v_producto.precio_venta),v_producto.costo);
  insert into public.movimientos_inventario_sucursal(sucursal_id,producto_id,tipo,cantidad,costo_unitario,referencia,creado_por) values(p_sucursal_id,v_producto.id,'venta_pos',-v_cantidad,coalesce(v_producto.costo,0),v_codigo,v_usuario);
 end loop;
 insert into public.pagos(pedido_id,cliente_id,monto,metodo,referencia,fecha) values(v_pedido_id,v_cliente_id,v_total,coalesce(nullif(trim(p_metodo),''),'Efectivo'),nullif(trim(p_referencia),''),current_date) returning id into v_pago_id;
 update public.movimientos_caja set cuenta_id=v_turno.cuenta_id,cuenta=(select nombre from public.cuentas_financieras where id=v_turno.cuenta_id),creado_por=v_usuario where origen='pago' and origen_id=v_pago_id;
 insert into public.ventas_pos(pedido_id,sucursal_id,turno_id,pago_id,cajero_id,total) values(v_pedido_id,p_sucursal_id,p_turno_id,v_pago_id,v_usuario,v_total) returning id into v_venta_id;
 return jsonb_build_object('venta_id',v_venta_id,'pedido_id',v_pedido_id,'codigo',v_codigo,'total',v_total);
end; $$;
create or replace function public.registrar_venta_pos(uuid,uuid,jsonb,text,uuid,text,text,text,text,text,text)
returns jsonb language sql security invoker set search_path=public,private as $$ select private.registrar_venta_pos($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11); $$;
revoke all on function public.registrar_venta_pos(uuid,uuid,jsonb,text,uuid,text,text,text,text,text,text) from public,anon; grant execute on function public.registrar_venta_pos(uuid,uuid,jsonb,text,uuid,text,text,text,text,text,text) to authenticated;
revoke all on function private.registrar_venta_pos(uuid,uuid,jsonb,text,uuid,text,text,text,text,text,text) from public,anon;

create or replace function private.anular_venta_pos(p_venta_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare v_usuario uuid:=(select auth.uid()); v_venta public.ventas_pos; v_linea record;
begin
 if v_usuario is null or not private.tiene_modulo_crm('punto_venta') then raise exception 'No autorizado'; end if;
 select * into v_venta from public.ventas_pos where id=p_venta_id for update; if not found or v_venta.estado='Anulada' then raise exception 'Venta no disponible para anular'; end if;
 if v_venta.cajero_id<>v_usuario and not private.es_administrador_crm() then raise exception 'Solo el cajero original o el administrador puede anular'; end if;
 if trim(coalesce(p_motivo,''))='' then raise exception 'Indica el motivo de anulación'; end if;
 for v_linea in select producto_id,cantidad,costo from public.pedido_detalle where pedido_id=v_venta.pedido_id loop
  insert into public.inventario_sucursal_productos(sucursal_id,producto_id,existencia) values(v_venta.sucursal_id,v_linea.producto_id,v_linea.cantidad) on conflict(sucursal_id,producto_id) do update set existencia=public.inventario_sucursal_productos.existencia+excluded.existencia,updated_at=now();
  insert into public.movimientos_inventario_sucursal(sucursal_id,producto_id,tipo,cantidad,costo_unitario,referencia,observaciones,creado_por) values(v_venta.sucursal_id,v_linea.producto_id,'devolucion',v_linea.cantidad,coalesce(v_linea.costo,0),'Anulación POS',p_motivo,v_usuario);
 end loop;
 delete from public.movimientos_caja where origen='pago' and origen_id=v_venta.pago_id; delete from public.pagos where id=v_venta.pago_id;
 update public.pedidos set estado='Anulado',pago_estado='Anulado',estado_pago='Anulado',saldo_pendiente=0,observaciones=concat_ws(E'\n',observaciones,'POS anulado: '||p_motivo) where id=v_venta.pedido_id;
 update public.ventas_pos set estado='Anulada',anulada_at=now(),anulada_por=v_usuario,motivo_anulacion=p_motivo,pago_id=null where id=v_venta.id;
 return jsonb_build_object('ok',true);
end; $$;
create or replace function public.anular_venta_pos(uuid,text) returns jsonb language sql security invoker set search_path=public,private as $$ select private.anular_venta_pos($1,$2); $$;
revoke all on function public.anular_venta_pos(uuid,text) from public,anon; grant execute on function public.anular_venta_pos(uuid,text) to authenticated;
revoke all on function private.anular_venta_pos(uuid,text) from public,anon;
