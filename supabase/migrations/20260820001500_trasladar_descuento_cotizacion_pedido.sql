alter table public.pedidos
  add column if not exists descuento numeric(12,2) not null default 0;

alter table public.pedidos
  drop constraint if exists pedidos_descuento_no_negativo;

alter table public.pedidos
  add constraint pedidos_descuento_no_negativo check (descuento >= 0);
