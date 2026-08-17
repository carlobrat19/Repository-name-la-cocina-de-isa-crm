create table if not exists public.ingredientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  unidad_base text not null check (unidad_base in ('g', 'ml', 'unidad')),
  costo_referencia numeric(12,6) not null default 0 check (costo_referencia >= 0),
  stock_actual numeric(14,3) not null default 0,
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recetas_estandar (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null unique references public.productos(id) on delete cascade,
  rendimiento numeric(12,3) not null check (rendimiento > 0),
  unidad_rendimiento text not null default 'unidad',
  merma_pct numeric(6,4) not null default 0 check (merma_pct >= 0),
  margen_pct numeric(6,4) not null default 0 check (margen_pct >= 0),
  iva_pct numeric(6,4) not null default 0.12 check (iva_pct >= 0),
  recargo_carta_pct numeric(6,4) not null default 0 check (recargo_carta_pct >= 0),
  activa boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receta_ingredientes (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas_estandar(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id) on delete restrict,
  cantidad numeric(14,3) not null check (cantidad > 0),
  unique(receta_id, ingrediente_id)
);

create index if not exists receta_ingredientes_receta_idx on public.receta_ingredientes(receta_id);
create index if not exists receta_ingredientes_ingrediente_idx on public.receta_ingredientes(ingrediente_id);

alter table public.ingredientes enable row level security;
alter table public.recetas_estandar enable row level security;
alter table public.receta_ingredientes enable row level security;
revoke all on public.ingredientes, public.recetas_estandar, public.receta_ingredientes from anon;
grant select, insert, update, delete on public.ingredientes, public.recetas_estandar, public.receta_ingredientes to authenticated;

create policy "modulo productos ingredientes lectura" on public.ingredientes for select to authenticated using (private.tiene_modulo_crm('productos'));
create policy "modulo productos ingredientes alta" on public.ingredientes for insert to authenticated with check (private.tiene_modulo_crm('productos'));
create policy "modulo productos ingredientes actualiza" on public.ingredientes for update to authenticated using (private.tiene_modulo_crm('productos')) with check (private.tiene_modulo_crm('productos'));
create policy "modulo productos recetas lectura" on public.recetas_estandar for select to authenticated using (private.tiene_modulo_crm('productos'));
create policy "modulo productos recetas alta" on public.recetas_estandar for insert to authenticated with check (private.tiene_modulo_crm('productos'));
create policy "modulo productos recetas actualiza" on public.recetas_estandar for update to authenticated using (private.tiene_modulo_crm('productos')) with check (private.tiene_modulo_crm('productos'));
create policy "modulo productos receta detalle lectura" on public.receta_ingredientes for select to authenticated using (private.tiene_modulo_crm('productos'));
create policy "modulo productos receta detalle alta" on public.receta_ingredientes for insert to authenticated with check (private.tiene_modulo_crm('productos'));
create policy "modulo productos receta detalle actualiza" on public.receta_ingredientes for update to authenticated using (private.tiene_modulo_crm('productos')) with check (private.tiene_modulo_crm('productos'));

insert into public.ingredientes (nombre, unidad_base, costo_referencia, notas) values
  ('Harina', 'g', 3.48 / 453.59237, 'Costo importado: Q3.48 por libra'),
  ('Bicarbonato', 'g', 7 / 453.59237, 'Costo importado: Q7.00 por libra'),
  ('Sal', 'g', 2 / 453.59237, 'Costo importado: Q2.00 por libra'),
  ('Azúcar', 'g', 4.01 / 453.59237, 'Costo importado: Q4.01 por libra'),
  ('Huevos', 'unidad', 1.6, 'Costo importado por unidad'),
  ('Aceite vegetal', 'g', 11.33 / 453.59237, 'Costo importado: Q11.33 por libra'),
  ('Leche agria', 'g', 5.8 / 453.59237, 'Costo importado: Q5.80 por libra'),
  ('Puré de banano', 'unidad', 1.25, 'Costo importado por unidad; se actualizará con compras reales'),
  ('Canela', 'g', 160.9 / 453.59237, 'Costo importado: Q160.90 por libra'),
  ('Vainilla', 'g', 10.2 / 453.59237, 'Costo importado: Q10.20 por libra'),
  ('Limón', 'unidad', 1, 'Costo importado por unidad')
on conflict (nombre) do nothing;

insert into public.recetas_estandar (producto_id, rendimiento, unidad_rendimiento, merma_pct, margen_pct, iva_pct, recargo_carta_pct, notas)
select id, 1, 'pan', 0.20, 0.35, 0.12, 0.68, 'Importada de Receta Estándar Intecap - Pan de Banano (02/02/2026).'
from public.productos where nombre = 'PAN DE BANANO'
on conflict (producto_id) do update set rendimiento = excluded.rendimiento, unidad_rendimiento = excluded.unidad_rendimiento, merma_pct = excluded.merma_pct, margen_pct = excluded.margen_pct, iva_pct = excluded.iva_pct, recargo_carta_pct = excluded.recargo_carta_pct, notas = excluded.notas, updated_at = now();

insert into public.receta_ingredientes (receta_id, ingrediente_id, cantidad)
select receta.id, ingrediente.id, datos.cantidad
from public.recetas_estandar receta
join public.productos producto on producto.id = receta.producto_id and producto.nombre = 'PAN DE BANANO'
join (values
  ('Harina', 0.41 * 453.59237), ('Bicarbonato', 0.01 * 453.59237), ('Sal', 0.003 * 453.59237),
  ('Azúcar', 0.44 * 453.59237), ('Huevos', 2::numeric), ('Aceite vegetal', 0.36 * 453.59237),
  ('Leche agria', 0.09 * 453.59237), ('Puré de banano', 5::numeric), ('Canela', 0.003 * 453.59237),
  ('Vainilla', 0.01 * 453.59237), ('Limón', 0.15::numeric)
) as datos(nombre, cantidad) on true
join public.ingredientes ingrediente on ingrediente.nombre = datos.nombre
on conflict (receta_id, ingrediente_id) do update set cantidad = excluded.cantidad;
