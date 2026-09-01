-- Mantiene separada la comisión variable por canal (POS, marketplace o plataforma)
-- del recargo comercial de carta definido para cada receta.
alter table public.recetas_estandar
  add column if not exists comision_canal_pct numeric(6,4) not null default 0
  check (comision_canal_pct >= 0 and comision_canal_pct < 1);
