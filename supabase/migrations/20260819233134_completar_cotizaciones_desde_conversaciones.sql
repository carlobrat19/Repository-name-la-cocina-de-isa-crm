alter table public.cotizaciones
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists costo_envio numeric(12,2) not null default 0,
  add column if not exists descuento numeric(12,2) not null default 0,
  add column if not exists vence_el date,
  add column if not exists convertido_pedido_id uuid references public.pedidos(id) on delete set null;

create index if not exists cotizaciones_conversacion_estado_idx
  on public.cotizaciones(conversacion_id, estado, created_at desc);

create policy "conversaciones cotizacion detalle elimina" on public.cotizacion_detalle for delete to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')));
