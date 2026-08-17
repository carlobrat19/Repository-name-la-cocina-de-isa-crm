alter table public.cliente_direcciones
  add column if not exists departamento text,
  add column if not exists zona text;

create index if not exists cliente_direcciones_cliente_principal_idx
  on public.cliente_direcciones (cliente_id, principal desc, created_at desc);
