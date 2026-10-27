-- Permite cambiar entre recogida, reparto propio y mensajería al editar un pedido.
create or replace function private.editar_pedido_y_detalle_seguro(p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_usuario uuid := (select auth.uid()); v_pedido public.pedidos;
  v_subtotal numeric(14,2); v_total numeric(14,2); v_pagado numeric(14,2);
  v_actualizar_lineas boolean := coalesce(jsonb_typeof(p_datos->'lineas') = 'array',false);
  v_linea jsonb; v_producto public.productos; v_cantidad integer;
  v_requiere_envio boolean; v_entrega_mensajero boolean;
  v_direccion text; v_departamento text; v_municipio text; v_zona text;
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
  v_requiere_envio := coalesce(nullif(p_datos->>'requiere_envio','')::boolean,v_pedido.requiere_envio,false);
  v_entrega_mensajero := v_requiere_envio and coalesce(nullif(p_datos->>'entrega_mensajero','')::boolean,v_pedido.entrega_mensajero,false);
  v_direccion := nullif(trim(coalesce(p_datos->>'direccion',v_pedido.direccion)),'');
  v_departamento := nullif(trim(coalesce(p_datos->>'departamento_entrega',v_pedido.departamento_entrega)),'');
  v_municipio := nullif(trim(coalesce(p_datos->>'municipio_entrega',v_pedido.municipio_entrega)),'');
  v_zona := nullif(trim(coalesce(p_datos->>'zona_entrega',v_pedido.zona_entrega)),'');
  if v_requiere_envio and (v_direccion is null or v_departamento is null or v_municipio is null or v_zona is null) then
    raise exception 'Completa dirección, departamento, municipio y zona de entrega';
  end if;
  v_envio_tarifa := case when v_requiere_envio then coalesce(nullif(p_datos->>'envio_tarifa','')::numeric,nullif(p_datos->>'costo_envio','')::numeric,v_pedido.envio_tarifa,0) else 0 end;
  v_envio_gratis := v_requiere_envio and coalesce(nullif(p_datos->>'envio_gratis','')::boolean,v_pedido.envio_gratis,false);
  v_costo_envio_real := case when not v_requiere_envio then null when p_datos ? 'costo_envio_real' then nullif(p_datos->>'costo_envio_real','')::numeric else v_pedido.costo_envio_real end;
  v_descuento_tipo := coalesce(nullif(p_datos->>'descuento_tipo',''),v_pedido.descuento_tipo,'Monto');
  v_descuento_valor := coalesce(nullif(p_datos->>'descuento_valor','')::numeric,v_pedido.descuento_valor,0);
  if v_envio_tarifa < 0 or v_costo_envio_real < 0 or v_descuento_valor < 0 or v_descuento_tipo not in ('Monto','Porcentaje') or (v_descuento_tipo='Porcentaje' and v_descuento_valor>100) then raise exception 'Importes de promoción inválidos'; end if;
  v_costo_envio := case when v_requiere_envio and not v_envio_gratis then v_envio_tarifa else 0 end;
  v_descuento := round(case when v_descuento_tipo='Porcentaje' then v_subtotal*v_descuento_valor/100 else v_descuento_valor end,2);
  if v_descuento > v_subtotal then raise exception 'El descuento no puede superar el subtotal de productos'; end if;
  v_total := v_subtotal-v_descuento+v_costo_envio;
  select coalesce(sum(monto),0) into v_pagado from public.pagos where pedido_id=v_pedido.id;
  if v_total < v_pagado then raise exception 'El total no puede ser menor a los pagos ya registrados'; end if;
  update public.pedidos set
    forma_pago=coalesce(nullif(trim(p_datos->>'forma_pago'),''),forma_pago),
    fecha_entrega=coalesce(nullif(p_datos->>'fecha_entrega','')::date,fecha_entrega),
    hora_entrega=coalesce(nullif(trim(p_datos->>'hora_entrega'),''),hora_entrega),
    requiere_envio=v_requiere_envio,
    entrega_mensajero=v_entrega_mensajero,
    direccion=case when v_requiere_envio then v_direccion else null end,
    departamento_entrega=case when v_requiere_envio then v_departamento else null end,
    municipio_entrega=case when v_requiere_envio then v_municipio else null end,
    zona_entrega=case when v_requiere_envio then v_zona else null end,
    observaciones=nullif(trim(coalesce(p_datos->>'observaciones',observaciones)),''),
    vendedor=nullif(trim(coalesce(p_datos->>'vendedor',vendedor)),''),
    canal_origen=coalesce(nullif(trim(p_datos->>'canal_origen'),''),canal_origen,'Manual'),
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
