-- Datos de entrega y costo manual de envío por pedido.
alter table public.pedidos
  add column if not exists subtotal_productos numeric(12,2) not null default 0,
  add column if not exists costo_envio numeric(12,2) not null default 0 check (costo_envio >= 0),
  add column if not exists municipio_entrega text,
  add column if not exists zona_entrega text;
