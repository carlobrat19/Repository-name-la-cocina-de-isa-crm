-- Keep delivery location data structured for operational filters and reports.
alter table public.pedidos
  add column if not exists departamento_entrega text;
