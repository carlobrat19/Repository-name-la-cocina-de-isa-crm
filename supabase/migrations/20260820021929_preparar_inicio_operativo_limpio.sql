-- Inicio operativo limpio: conserva configuración maestra (usuarios, permisos,
-- sucursales, cuentas, productos, ingredientes y recetas) y elimina únicamente
-- la operación de prueba/histórica previa al arranque formal.

create table if not exists private.reinicios_operativos_crm (
  id uuid primary key default gen_random_uuid(),
  ejecutado_at timestamptz not null default now(),
  ejecutado_por uuid references auth.users(id) on delete set null,
  resumen jsonb not null default '{}'::jsonb
);
revoke all on private.reinicios_operativos_crm from public, anon, authenticated;

insert into private.reinicios_operativos_crm (resumen)
select jsonb_build_object(
  'clientes', (select count(*) from public.clientes),
  'pedidos', (select count(*) from public.pedidos),
  'pagos', (select count(*) from public.pagos),
  'cotizaciones', (select count(*) from public.cotizaciones),
  'conversaciones', (select count(*) from public.conversaciones),
  'ventas_pos', (select count(*) from public.ventas_pos)
);

-- Hijos operativos primero; no se eliminan usuarios ni catálogos maestros.
delete from public.notificaciones_cliente;
delete from public.integration_events;
delete from public.actividades_comerciales;
delete from public.mensajes;
delete from public.conversaciones;
delete from public.leads;
delete from public.cotizacion_detalle;
delete from public.cotizaciones;
delete from public.facturas;
delete from public.movimientos_caja_pos;
delete from public.ventas_pos;
delete from public.turnos_caja_pos;
delete from public.movimientos_inventario_sucursal;
delete from public.inventario_sucursal_productos;
delete from public.lotes_produccion;
delete from public.historial_estados_pedido;
delete from public.movimientos_inventario;
delete from public.pagos;
delete from public.pedido_detalle;
delete from public.movimientos_caja;
delete from public.pedidos;
delete from public.compras_ingredientes;
delete from public.cliente_etiquetas;
delete from public.cliente_direcciones;
delete from public.clientes;

-- Inventario y saldos comienzan desde cero: registra compras, producción y
-- saldos iniciales reales antes de realizar la primera venta.
update public.productos set stock = 0;
update public.ingredientes set stock_actual = 0, updated_at = now();
update public.cuentas_financieras
set saldo_inicial = 0, fecha_saldo_inicial = current_date, updated_at = now();

do $$
declare v_secuencia text;
begin
  v_secuencia := pg_get_serial_sequence('public.pedidos', 'numero_pedido');
  if v_secuencia is not null then execute format('alter sequence %s restart with 1', v_secuencia); end if;
  if to_regclass('public.folio_venta_pos_seq') is not null then
    alter sequence public.folio_venta_pos_seq restart with 1;
  end if;
end $$;

-- Direcciones: se preservan como historial del cliente, sin sustituir la
-- principal; la última utilizada se ordena primero al crear un nuevo pedido.
alter table public.cliente_direcciones
  add column if not exists ultima_entrega_at timestamptz,
  add column if not exists veces_usada integer not null default 0 check (veces_usada >= 0);
create index if not exists cliente_direcciones_ultima_entrega_idx
  on public.cliente_direcciones (cliente_id, ultima_entrega_at desc nulls last, principal desc, created_at desc);

-- Operación atómica de pedido: evita clientes, pagos, detalle o inventario a
-- medias cuando una de las escrituras falla.
create or replace function private.registrar_pedido_completo(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_cliente_id uuid := nullif(p_datos->>'cliente_id','')::uuid;
  v_pedido_id uuid;
  v_numero integer;
  v_codigo text;
  v_item jsonb;
  v_producto public.productos;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2);
  v_abono numeric(14,2) := greatest(coalesce((p_datos->>'abono_inicial')::numeric, 0), 0);
  v_costo_envio numeric(14,2) := greatest(coalesce((p_datos->>'costo_envio')::numeric, 0), 0);
  v_requiere_envio boolean := coalesce((p_datos->>'requiere_envio')::boolean, false);
  v_estado_pago text;
  v_direccion_id uuid;
begin
  if v_usuario is null or not private.tiene_modulo_crm('pedidos') then
    raise exception 'No autorizado para registrar pedidos';
  end if;
  if trim(coalesce(p_datos->>'cliente','')) = '' then raise exception 'Ingresa el nombre del cliente'; end if;
  if jsonb_typeof(p_datos->'items') <> 'array' or jsonb_array_length(p_datos->'items') = 0 then raise exception 'Agrega al menos un producto'; end if;
  if v_requiere_envio and (trim(coalesce(p_datos->>'direccion','')) = '' or trim(coalesce(p_datos->>'departamento_entrega','')) = '' or trim(coalesce(p_datos->>'municipio_entrega','')) = '' or trim(coalesce(p_datos->>'zona_entrega','')) = '') then
    raise exception 'Completa dirección, departamento, municipio y zona de entrega';
  end if;

  if v_cliente_id is null then
    select id into v_cliente_id from public.clientes
    where (nullif(trim(p_datos->>'telefono'),'') is not null and telefono = trim(p_datos->>'telefono'))
       or (nullif(trim(p_datos->>'nit'),'') is not null and nit = trim(p_datos->>'nit'))
    order by updated_at desc nulls last limit 1;
  end if;
  if v_cliente_id is null then
    insert into public.clientes(nombre,telefono,email,nit,razon_social,direccion,canal_origen)
    values (trim(p_datos->>'cliente'), nullif(trim(p_datos->>'telefono'),''), nullif(trim(p_datos->>'correo_fiscal'),''), nullif(trim(p_datos->>'nit'),''), nullif(trim(p_datos->>'razon_social'),''), nullif(trim(p_datos->>'direccion_fiscal'),''), coalesce(nullif(trim(p_datos->>'canal_origen'),''),'Manual'))
    returning id into v_cliente_id;
  else
    update public.clientes set nombre=trim(p_datos->>'cliente'), telefono=nullif(trim(p_datos->>'telefono'),''), email=nullif(trim(p_datos->>'correo_fiscal'),''), nit=nullif(trim(p_datos->>'nit'),''), razon_social=nullif(trim(p_datos->>'razon_social'),''), direccion=nullif(trim(p_datos->>'direccion_fiscal'),''), updated_at=now() where id=v_cliente_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_datos->'items') loop
    select * into v_producto from public.productos where id = (v_item->>'id')::uuid and estado = 'Activo';
    if not found then raise exception 'Producto no disponible'; end if;
    if coalesce((v_item->>'cantidad')::numeric,0) <= 0 then raise exception 'Cantidad inválida'; end if;
    v_subtotal := v_subtotal + round(coalesce((v_item->>'precio')::numeric, v_producto.precio_venta) * (v_item->>'cantidad')::numeric, 2);
  end loop;
  v_total := v_subtotal + case when v_requiere_envio then v_costo_envio else 0 end;
  if v_abono > v_total then raise exception 'El abono no puede superar el total'; end if;
  v_estado_pago := case when v_abono >= v_total and v_total > 0 then 'Pagado' when v_abono > 0 then 'Pago parcial' else 'Pendiente' end;

  insert into public.pedidos(cliente_id,cliente,telefono,direccion,fecha_pedido,fecha_entrega,estado,pago_estado,estado_pago,forma_pago,metodo_pago,total,subtotal_productos,costo_envio,departamento_entrega,municipio_entrega,zona_entrega,saldo_pendiente,canal_origen,conversacion_id,responsable_id,observaciones,vendedor,requiere_envio,creado_por,codigo)
  values(v_cliente_id,trim(p_datos->>'cliente'),nullif(trim(p_datos->>'telefono'),''),case when v_requiere_envio then trim(p_datos->>'direccion') else null end,nullif(p_datos->>'fecha_pedido','')::date,nullif(p_datos->>'fecha_entrega','')::date,coalesce(nullif(trim(p_datos->>'estado'),''),'Pendiente'),v_estado_pago,v_estado_pago,coalesce(nullif(trim(p_datos->>'forma_pago'),''),'Efectivo'),coalesce(nullif(trim(p_datos->>'forma_pago'),''),'Efectivo'),v_total,v_subtotal,case when v_requiere_envio then v_costo_envio else 0 end,case when v_requiere_envio then nullif(trim(p_datos->>'departamento_entrega'),'') end,case when v_requiere_envio then nullif(trim(p_datos->>'municipio_entrega'),'') end,case when v_requiere_envio then nullif(trim(p_datos->>'zona_entrega'),'') end,v_total-v_abono,coalesce(nullif(trim(p_datos->>'canal_origen'),''),'Manual'),nullif(p_datos->>'conversacion_id','')::uuid,nullif(p_datos->>'responsable_id','')::uuid,nullif(trim(p_datos->>'observaciones'),''),nullif(trim(p_datos->>'vendedor'),''),v_requiere_envio,v_usuario,'')
  returning id, numero_pedido into v_pedido_id, v_numero;
  v_codigo := 'PED-' || lpad(v_numero::text,4,'0');
  update public.pedidos set codigo=v_codigo where id=v_pedido_id;
  for v_item in select value from jsonb_array_elements(p_datos->'items') loop
    select * into v_producto from public.productos where id=(v_item->>'id')::uuid;
    insert into public.pedido_detalle(pedido_id,producto_id,cantidad,precio,costo)
    values(v_pedido_id,v_producto.id,(v_item->>'cantidad')::numeric,coalesce((v_item->>'precio')::numeric,v_producto.precio_venta),coalesce((v_item->>'costo')::numeric,v_producto.costo,0));
  end loop;
  if v_abono > 0 then insert into public.pagos(pedido_id,cliente_id,monto,metodo,fecha) values(v_pedido_id,v_cliente_id,v_abono,coalesce(nullif(trim(p_datos->>'forma_pago'),''),'Efectivo'),current_date); end if;
  if v_requiere_envio and coalesce((p_datos->>'guardar_direccion')::boolean,true) then
    select id into v_direccion_id from public.cliente_direcciones where cliente_id=v_cliente_id and direccion=trim(p_datos->>'direccion') and coalesce(departamento,'')=coalesce(nullif(trim(p_datos->>'departamento_entrega'),''),'') and coalesce(municipio,'')=coalesce(nullif(trim(p_datos->>'municipio_entrega'),''),'') and coalesce(zona,'')=coalesce(nullif(trim(p_datos->>'zona_entrega'),''),'') order by principal desc, created_at desc limit 1;
    if v_direccion_id is null then
      insert into public.cliente_direcciones(cliente_id,etiqueta,direccion,departamento,municipio,zona,principal,ultima_entrega_at,veces_usada)
      values(v_cliente_id,'Dirección de entrega',trim(p_datos->>'direccion'),nullif(trim(p_datos->>'departamento_entrega'),''),nullif(trim(p_datos->>'municipio_entrega'),''),nullif(trim(p_datos->>'zona_entrega'),''),not exists(select 1 from public.cliente_direcciones where cliente_id=v_cliente_id),now(),1);
    else update public.cliente_direcciones set ultima_entrega_at=now(), veces_usada=veces_usada+1 where id=v_direccion_id; end if;
  end if;
  if nullif(p_datos->>'cotizacion_id','') is not null then update public.cotizaciones set estado='Convertida', convertido_pedido_id=v_pedido_id where id=(p_datos->>'cotizacion_id')::uuid; end if;
  return jsonb_build_object('pedido_id',v_pedido_id,'cliente_id',v_cliente_id,'codigo',v_codigo,'total',v_total,'saldo_pendiente',v_total-v_abono,'pago_estado',v_estado_pago);
end;
$$;
create or replace function public.registrar_pedido_completo(p_datos jsonb) returns jsonb language sql security invoker set search_path=public,private as $$ select private.registrar_pedido_completo(p_datos); $$;
revoke all on function public.registrar_pedido_completo(jsonb) from public, anon;
grant execute on function public.registrar_pedido_completo(jsonb) to authenticated;
revoke all on function private.registrar_pedido_completo(jsonb) from public, anon;

create or replace function private.registrar_abono_pedido(p_pedido_id uuid,p_monto numeric,p_metodo text,p_referencia text default null)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare v_usuario uuid:=(select auth.uid()); v_pedido public.pedidos; v_pagado numeric(14,2);
begin
 if v_usuario is null or not private.tiene_modulo_crm('cobros_fel') then raise exception 'No autorizado para registrar pagos'; end if;
 select * into v_pedido from public.pedidos where id=p_pedido_id and estado <> 'Cancelado' for update; if not found then raise exception 'Pedido no disponible'; end if;
 if coalesce(p_monto,0)<=0 or p_monto>coalesce(v_pedido.saldo_pendiente,v_pedido.total) then raise exception 'Monto de pago inválido'; end if;
 insert into public.pagos(pedido_id,cliente_id,monto,metodo,referencia,fecha) values(v_pedido.id,v_pedido.cliente_id,p_monto,coalesce(nullif(trim(p_metodo),''),'Efectivo'),nullif(trim(p_referencia),''),current_date);
 select coalesce(sum(monto),0) into v_pagado from public.pagos where pedido_id=v_pedido.id;
 update public.pedidos set saldo_pendiente=greatest(0,total-v_pagado), pago_estado=case when v_pagado>=total then 'Pagado' when v_pagado>0 then 'Pago parcial' else 'Pendiente' end, estado_pago=case when v_pagado>=total then 'Pagado' when v_pagado>0 then 'Pago parcial' else 'Pendiente' end where id=v_pedido.id;
 return jsonb_build_object('pagado',v_pagado,'saldo',greatest(0,v_pedido.total-v_pagado));
end; $$;
create or replace function public.registrar_abono_pedido(uuid,numeric,text,text default null) returns jsonb language sql security invoker set search_path=public,private as $$ select private.registrar_abono_pedido($1,$2,$3,$4); $$;
revoke all on function public.registrar_abono_pedido(uuid,numeric,text,text) from public,anon;
grant execute on function public.registrar_abono_pedido(uuid,numeric,text,text) to authenticated;
revoke all on function private.registrar_abono_pedido(uuid,numeric,text,text) from public,anon;

-- Índices de los filtros operativos más usados.
create index if not exists pedidos_fecha_entrega_estado_idx on public.pedidos(fecha_entrega, estado);
create index if not exists pedidos_cliente_fecha_idx on public.pedidos(cliente_id, fecha_pedido desc);
create index if not exists pagos_pedido_fecha_idx on public.pagos(pedido_id, fecha desc);
create index if not exists cotizaciones_cliente_created_idx on public.cotizaciones(cliente_id, created_at desc);
create index if not exists conversaciones_responsable_actualizacion_idx on public.conversaciones(responsable_id, ultimo_mensaje_at desc);
