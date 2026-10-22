-- Mantiene separados el importe cobrado y el costo real del reparto.
alter table public.pedidos
  add column if not exists envio_tarifa numeric(12,2) not null default 0,
  add column if not exists envio_gratis boolean not null default false,
  add column if not exists costo_envio_real numeric(12,2),
  add column if not exists descuento_tipo text not null default 'Monto',
  add column if not exists descuento_valor numeric(12,2) not null default 0;

update public.pedidos set envio_tarifa = costo_envio
where envio_tarifa = 0 and costo_envio > 0;

-- Conserva descuentos históricos (por ejemplo, ventas de mostrador) al editarlos.
update public.pedidos set descuento_valor = descuento
where descuento_valor = 0 and coalesce(descuento, 0) > 0;

alter table public.pedido_detalle
  add column if not exists es_cortesia boolean not null default false;

alter table public.pedidos
  add constraint pedidos_promocion_importes_validos check (
    envio_tarifa >= 0 and (costo_envio_real is null or costo_envio_real >= 0)
    and descuento_valor >= 0 and descuento_tipo in ('Monto', 'Porcentaje')
    and (descuento_tipo <> 'Porcentaje' or descuento_valor <= 100)
  );

create or replace function private.registrar_pedido_completo(p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_usuario uuid := (select auth.uid());
  v_cliente_id uuid := nullif(p_datos->>'cliente_id','')::uuid;
  v_pedido_id uuid; v_numero integer; v_codigo text; v_item jsonb;
  v_producto public.productos; v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2); v_abono numeric(14,2) := coalesce((p_datos->>'abono_inicial')::numeric, 0);
  v_envio_tarifa numeric(14,2) := coalesce((p_datos->>'envio_tarifa')::numeric, (p_datos->>'costo_envio')::numeric, 0);
  v_envio_gratis boolean := coalesce((p_datos->>'envio_gratis')::boolean, false);
  v_costo_envio_real numeric(14,2) := nullif(p_datos->>'costo_envio_real','')::numeric;
  v_costo_envio numeric(14,2);
  v_descuento_tipo text := coalesce(nullif(p_datos->>'descuento_tipo',''), 'Monto');
  v_descuento_valor numeric(14,2) := coalesce((p_datos->>'descuento_valor')::numeric, 0);
  v_descuento numeric(14,2);
  v_requiere_envio boolean := coalesce((p_datos->>'requiere_envio')::boolean, false);
  v_entrega_mensajero boolean := coalesce((p_datos->>'entrega_mensajero')::boolean, false);
  v_estado_pago text; v_direccion_id uuid;
begin
  if v_usuario is null or not private.tiene_modulo_crm('pedidos') then raise exception 'No autorizado para registrar pedidos'; end if;
  if trim(coalesce(p_datos->>'cliente','')) = '' then raise exception 'Ingresa el nombre del cliente'; end if;
  if jsonb_typeof(p_datos->'items') <> 'array' or jsonb_array_length(p_datos->'items') = 0 then raise exception 'Agrega al menos un producto'; end if;
  if v_abono < 0 or v_envio_tarifa < 0 or v_costo_envio_real < 0 or v_descuento_valor < 0 or v_descuento_tipo not in ('Monto','Porcentaje') or (v_descuento_tipo = 'Porcentaje' and v_descuento_valor > 100) then raise exception 'Importes de promoción inválidos'; end if;
  if v_requiere_envio and (trim(coalesce(p_datos->>'direccion','')) = '' or trim(coalesce(p_datos->>'departamento_entrega','')) = '' or trim(coalesce(p_datos->>'municipio_entrega','')) = '' or trim(coalesce(p_datos->>'zona_entrega','')) = '') then raise exception 'Completa dirección, departamento, municipio y zona de entrega'; end if;
  v_entrega_mensajero := v_requiere_envio and v_entrega_mensajero;
  v_envio_gratis := v_requiere_envio and v_envio_gratis;
  v_costo_envio := case when v_requiere_envio and not v_envio_gratis then v_envio_tarifa else 0 end;
  if v_cliente_id is null then select id into v_cliente_id from public.clientes where (nullif(trim(p_datos->>'telefono'),'') is not null and telefono = trim(p_datos->>'telefono')) or (nullif(trim(p_datos->>'nit'),'') is not null and nit = trim(p_datos->>'nit')) order by updated_at desc nulls last limit 1; end if;
  if v_cliente_id is null then insert into public.clientes(nombre,telefono,email,nit,razon_social,direccion,canal_origen) values (trim(p_datos->>'cliente'), nullif(trim(p_datos->>'telefono'),''), nullif(trim(p_datos->>'correo_fiscal'),''), nullif(trim(p_datos->>'nit'),''), nullif(trim(p_datos->>'razon_social'),''), nullif(trim(p_datos->>'direccion_fiscal'),''), coalesce(nullif(trim(p_datos->>'canal_origen'),''),'Manual')) returning id into v_cliente_id; else update public.clientes set nombre=trim(p_datos->>'cliente'), telefono=nullif(trim(p_datos->>'telefono'),''), email=nullif(trim(p_datos->>'correo_fiscal'),''), nit=nullif(trim(p_datos->>'nit'),''), razon_social=nullif(trim(p_datos->>'razon_social'),''), direccion=nullif(trim(p_datos->>'direccion_fiscal'),''), updated_at=now() where id=v_cliente_id; end if;
  for v_item in select value from jsonb_array_elements(p_datos->'items') loop
    select * into v_producto from public.productos where id = (v_item->>'id')::uuid and estado = 'Activo';
    if not found then raise exception 'Producto no disponible'; end if;
    if coalesce((v_item->>'cantidad')::numeric,0) <= 0 then raise exception 'Cantidad inválida'; end if;
    if not coalesce((v_item->>'es_cortesia')::boolean,false) and coalesce((v_item->>'precio')::numeric,v_producto.precio_venta,0) < 0 then raise exception 'Precio de producto inválido'; end if;
    v_subtotal := v_subtotal + round(case when coalesce((v_item->>'es_cortesia')::boolean,false) then 0 else coalesce((v_item->>'precio')::numeric,v_producto.precio_venta) end * (v_item->>'cantidad')::numeric,2);
  end loop;
  v_descuento := round(case when v_descuento_tipo = 'Porcentaje' then v_subtotal * v_descuento_valor / 100 else v_descuento_valor end,2);
  if v_descuento > v_subtotal then raise exception 'El descuento no puede superar el subtotal de productos'; end if;
  v_total := v_subtotal - v_descuento + v_costo_envio;
  if v_abono > v_total then raise exception 'El abono no puede superar el total'; end if;
  v_estado_pago := case when v_abono >= v_total and v_total > 0 then 'Pagado' when v_abono > 0 then 'Pago parcial' else 'Pendiente' end;
  insert into public.pedidos(cliente_id,cliente,telefono,direccion,fecha_pedido,fecha_entrega,estado,pago_estado,estado_pago,forma_pago,metodo_pago,total,subtotal_productos,costo_envio,envio_tarifa,envio_gratis,costo_envio_real,descuento,descuento_tipo,descuento_valor,departamento_entrega,municipio_entrega,zona_entrega,saldo_pendiente,canal_origen,conversacion_id,responsable_id,observaciones,vendedor,requiere_envio,entrega_mensajero,creado_por,codigo)
  values(v_cliente_id,trim(p_datos->>'cliente'),nullif(trim(p_datos->>'telefono'),''),case when v_requiere_envio then trim(p_datos->>'direccion') else null end,nullif(p_datos->>'fecha_pedido','')::date,nullif(p_datos->>'fecha_entrega','')::date,coalesce(nullif(trim(p_datos->>'estado'),''),'Pendiente'),v_estado_pago,v_estado_pago,coalesce(nullif(trim(p_datos->>'forma_pago'),''),'Efectivo'),coalesce(nullif(trim(p_datos->>'forma_pago'),''),'Efectivo'),v_total,v_subtotal,v_costo_envio,case when v_requiere_envio then v_envio_tarifa else 0 end,v_envio_gratis,case when v_requiere_envio then v_costo_envio_real end,v_descuento,v_descuento_tipo,v_descuento_valor,case when v_requiere_envio then nullif(trim(p_datos->>'departamento_entrega'),'') end,case when v_requiere_envio then nullif(trim(p_datos->>'municipio_entrega'),'') end,case when v_requiere_envio then nullif(trim(p_datos->>'zona_entrega'),'') end,v_total-v_abono,coalesce(nullif(trim(p_datos->>'canal_origen'),''),'Manual'),nullif(p_datos->>'conversacion_id','')::uuid,nullif(p_datos->>'responsable_id','')::uuid,nullif(trim(p_datos->>'observaciones'),''),nullif(trim(p_datos->>'vendedor'),''),v_requiere_envio,v_entrega_mensajero,v_usuario,'') returning id, numero_pedido into v_pedido_id,v_numero;
  v_codigo := 'PED-' || lpad(v_numero::text,4,'0'); update public.pedidos set codigo=v_codigo where id=v_pedido_id;
  for v_item in select value from jsonb_array_elements(p_datos->'items') loop
    select * into v_producto from public.productos where id=(v_item->>'id')::uuid;
    insert into public.pedido_detalle(pedido_id,producto_id,cantidad,precio,costo,es_cortesia)
    values(v_pedido_id,v_producto.id,(v_item->>'cantidad')::numeric,case when coalesce((v_item->>'es_cortesia')::boolean,false) then 0 else coalesce((v_item->>'precio')::numeric,v_producto.precio_venta) end,coalesce(v_producto.costo,0),coalesce((v_item->>'es_cortesia')::boolean,false));
  end loop;
  if v_abono > 0 then insert into public.pagos(pedido_id,cliente_id,monto,metodo,fecha) values(v_pedido_id,v_cliente_id,v_abono,coalesce(nullif(trim(p_datos->>'forma_pago'),''),'Efectivo'),current_date); end if;
  if v_requiere_envio and coalesce((p_datos->>'guardar_direccion')::boolean,true) then select id into v_direccion_id from public.cliente_direcciones where cliente_id=v_cliente_id and direccion=trim(p_datos->>'direccion') and coalesce(departamento,'')=coalesce(nullif(trim(p_datos->>'departamento_entrega'),''),'') and coalesce(municipio,'')=coalesce(nullif(trim(p_datos->>'municipio_entrega'),''),'') and coalesce(zona,'')=coalesce(nullif(trim(p_datos->>'zona_entrega'),''),'') order by principal desc, created_at desc limit 1; if v_direccion_id is null then insert into public.cliente_direcciones(cliente_id,etiqueta,direccion,departamento,municipio,zona,principal,ultima_entrega_at,veces_usada) values(v_cliente_id,'Dirección de entrega',trim(p_datos->>'direccion'),nullif(p_datos->>'departamento_entrega',''),nullif(p_datos->>'municipio_entrega',''),nullif(p_datos->>'zona_entrega',''),not exists(select 1 from public.cliente_direcciones where cliente_id=v_cliente_id),now(),1); else update public.cliente_direcciones set ultima_entrega_at=now(), veces_usada=veces_usada+1 where id=v_direccion_id; end if; end if;
  if nullif(p_datos->>'cotizacion_id','') is not null then update public.cotizaciones set estado='Convertida', convertido_pedido_id=v_pedido_id where id=(p_datos->>'cotizacion_id')::uuid; end if;
  return jsonb_build_object('pedido_id',v_pedido_id,'cliente_id',v_cliente_id,'codigo',v_codigo,'total',v_total,'saldo_pendiente',v_total-v_abono,'pago_estado',v_estado_pago);
end;
$$;

create or replace function private.editar_pedido_y_detalle_seguro(p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_usuario uuid := (select auth.uid()); v_pedido public.pedidos;
  v_subtotal numeric(14,2); v_total numeric(14,2); v_pagado numeric(14,2);
  v_actualizar_lineas boolean := coalesce(jsonb_typeof(p_datos->'lineas') = 'array',false);
  v_linea jsonb; v_producto public.productos; v_cantidad integer;
  v_envio_tarifa numeric(14,2); v_envio_gratis boolean; v_costo_envio_real numeric(14,2); v_costo_envio numeric(14,2);
  v_descuento_tipo text; v_descuento_valor numeric(14,2); v_descuento numeric(14,2);
begin
  if v_usuario is null or not private.tiene_modulo_crm('pedidos') then raise exception 'No autorizado para editar pedidos'; end if;
  select * into v_pedido from public.pedidos where id=nullif(p_datos->>'pedido_id','')::uuid for update;
  if not found then raise exception 'Pedido no disponible'; end if;
  if v_pedido.estado = 'Cancelado' then raise exception 'No puedes editar un pedido cancelado'; end if;
  if exists (select 1 from public.facturas where pedido_id=v_pedido.id) then raise exception 'No puedes modificar un pedido que ya tiene una factura FEL'; end if;
  if v_actualizar_lineas then
    if v_pedido.estado <> 'Pendiente' then raise exception 'Los productos solo se pueden modificar mientras el pedido esté Pendiente'; end if;
    if jsonb_array_length(p_datos->'lineas') = 0 then raise exception 'El pedido debe tener al menos un producto'; end if;
    for v_linea in select value from jsonb_array_elements(p_datos->'lineas') loop
      v_cantidad := nullif(v_linea->>'cantidad','')::integer;
      if v_cantidad is null or v_cantidad < 1 then raise exception 'Cada producto debe tener una cantidad de al menos 1'; end if;
      select * into v_producto from public.productos where id=nullif(v_linea->>'producto_id','')::uuid and coalesce(estado,'Activo')='Activo';
      if not found then raise exception 'Uno de los productos seleccionados ya no está disponible'; end if;
    end loop;
    delete from public.pedido_detalle where pedido_id=v_pedido.id;
    insert into public.pedido_detalle(pedido_id,producto_id,cantidad,precio,costo,es_cortesia)
    select v_pedido.id, (value->>'producto_id')::uuid, (value->>'cantidad')::integer,
      case when coalesce((value->>'es_cortesia')::boolean,false) then 0 else producto.precio_venta end,
      producto.costo, coalesce((value->>'es_cortesia')::boolean,false)
    from jsonb_array_elements(p_datos->'lineas') join public.productos producto on producto.id=(value->>'producto_id')::uuid;
    select coalesce(sum(cantidad*precio),0) into v_subtotal from public.pedido_detalle where pedido_id=v_pedido.id;
  else
    v_subtotal := coalesce(v_pedido.subtotal_productos,v_pedido.total-coalesce(v_pedido.costo_envio,0)+coalesce(v_pedido.descuento,0));
  end if;
  v_envio_tarifa := coalesce(nullif(p_datos->>'envio_tarifa','')::numeric,nullif(p_datos->>'costo_envio','')::numeric,v_pedido.envio_tarifa,0);
  v_envio_gratis := coalesce(nullif(p_datos->>'envio_gratis','')::boolean,v_pedido.envio_gratis,false) and coalesce(v_pedido.requiere_envio,false);
  v_costo_envio_real := case when p_datos ? 'costo_envio_real' then nullif(p_datos->>'costo_envio_real','')::numeric else v_pedido.costo_envio_real end;
  v_descuento_tipo := coalesce(nullif(p_datos->>'descuento_tipo',''),v_pedido.descuento_tipo,'Monto');
  v_descuento_valor := coalesce(nullif(p_datos->>'descuento_valor','')::numeric,v_pedido.descuento_valor,0);
  if v_envio_tarifa < 0 or v_costo_envio_real < 0 or v_descuento_valor < 0 or v_descuento_tipo not in ('Monto','Porcentaje') or (v_descuento_tipo='Porcentaje' and v_descuento_valor>100) then raise exception 'Importes de promoción inválidos'; end if;
  v_costo_envio := case when coalesce(v_pedido.requiere_envio,false) and not v_envio_gratis then v_envio_tarifa else 0 end;
  v_descuento := round(case when v_descuento_tipo='Porcentaje' then v_subtotal*v_descuento_valor/100 else v_descuento_valor end,2);
  if v_descuento > v_subtotal then raise exception 'El descuento no puede superar el subtotal de productos'; end if;
  v_total := v_subtotal-v_descuento+v_costo_envio;
  select coalesce(sum(monto),0) into v_pagado from public.pagos where pedido_id=v_pedido.id;
  if v_total < v_pagado then raise exception 'El total no puede ser menor a los pagos ya registrados'; end if;
  update public.pedidos set
    forma_pago=coalesce(nullif(trim(p_datos->>'forma_pago'),''),forma_pago),
    fecha_entrega=coalesce(nullif(p_datos->>'fecha_entrega','')::date,fecha_entrega),
    hora_entrega=coalesce(nullif(trim(p_datos->>'hora_entrega'),''),hora_entrega),
    direccion=nullif(trim(coalesce(p_datos->>'direccion',direccion)),''),
    departamento_entrega=nullif(trim(coalesce(p_datos->>'departamento_entrega',departamento_entrega)),''),
    municipio_entrega=nullif(trim(coalesce(p_datos->>'municipio_entrega',municipio_entrega)),''),
    zona_entrega=nullif(trim(coalesce(p_datos->>'zona_entrega',zona_entrega)),''),
    observaciones=nullif(trim(coalesce(p_datos->>'observaciones',observaciones)),''),
    vendedor=nullif(trim(coalesce(p_datos->>'vendedor',vendedor)),''),
    canal_origen=coalesce(nullif(trim(p_datos->>'canal_origen'),''),canal_origen,'Manual'),
    entrega_mensajero=coalesce(requiere_envio,false) and coalesce(nullif(trim(p_datos->>'entrega_mensajero'),'')::boolean,entrega_mensajero,false),
    subtotal_productos=v_subtotal, costo_envio=v_costo_envio, envio_tarifa=v_envio_tarifa,
    envio_gratis=v_envio_gratis, costo_envio_real=v_costo_envio_real,
    descuento=v_descuento, descuento_tipo=v_descuento_tipo, descuento_valor=v_descuento_valor,
    total=v_total, saldo_pendiente=greatest(0,v_total-v_pagado),
    pago_estado=case when v_pagado >= v_total and v_total > 0 then 'Pagado' when v_pagado > 0 then 'Pago parcial' else 'Pendiente' end,
    estado_pago=case when v_pagado >= v_total and v_total > 0 then 'Pagado' when v_pagado > 0 then 'Pago parcial' else 'Pendiente' end
  where id=v_pedido.id;
  return jsonb_build_object('pedido_id',v_pedido.id,'subtotal',v_subtotal,'total',v_total,'saldo',greatest(0,v_total-v_pagado));
end;
$$;
