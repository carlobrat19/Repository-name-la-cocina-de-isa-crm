create table public.compras_ingredientes (
  id uuid primary key default gen_random_uuid(),
  ingrediente_id uuid not null references public.ingredientes(id) on delete restrict,
  tipo text not null check (tipo in ('compra', 'ajuste', 'consumo_produccion')),
  cantidad numeric(14,3) not null check (cantidad <> 0),
  costo_unitario numeric(12,6) not null default 0 check (costo_unitario >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  nota text,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index compras_ingredientes_ingrediente_created_idx
on public.compras_ingredientes (ingrediente_id, created_at desc);

alter table public.compras_ingredientes enable row level security;
revoke all on public.compras_ingredientes from anon;
grant select, insert on public.compras_ingredientes to authenticated;

create policy "modulo productos movimientos lectura"
on public.compras_ingredientes for select to authenticated
using (private.tiene_modulo_crm('productos'));

create policy "modulo productos movimientos alta"
on public.compras_ingredientes for insert to authenticated
with check (private.tiene_modulo_crm('productos') and creado_por = (select auth.uid()));

create or replace function public.registrar_compra_ingrediente(
  p_ingrediente_id uuid,
  p_cantidad numeric,
  p_costo_unitario numeric,
  p_nota text default null
)
returns public.ingredientes
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  ingrediente_actual public.ingredientes;
  ingrediente_actualizado public.ingredientes;
begin
  if (select auth.uid()) is null or not private.tiene_modulo_crm('productos') then
    raise exception 'No autorizado para registrar compras de ingredientes';
  end if;

  if p_cantidad is null or p_cantidad <= 0 or p_costo_unitario is null or p_costo_unitario < 0 then
    raise exception 'Cantidad y costo unitario deben ser válidos';
  end if;

  select * into ingrediente_actual from public.ingredientes where id = p_ingrediente_id for update;
  if not found then
    raise exception 'Ingrediente no encontrado';
  end if;

  update public.ingredientes
  set stock_actual = ingrediente_actual.stock_actual + p_cantidad,
      costo_referencia = ((ingrediente_actual.stock_actual * ingrediente_actual.costo_referencia) + (p_cantidad * p_costo_unitario)) / (ingrediente_actual.stock_actual + p_cantidad),
      updated_at = now()
  where id = p_ingrediente_id
  returning * into ingrediente_actualizado;

  insert into public.compras_ingredientes (ingrediente_id, tipo, cantidad, costo_unitario, total, nota, creado_por)
  values (p_ingrediente_id, 'compra', p_cantidad, p_costo_unitario, round(p_cantidad * p_costo_unitario, 2), p_nota, (select auth.uid()));

  return ingrediente_actualizado;
end;
$$;

revoke all on function public.registrar_compra_ingrediente(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.registrar_compra_ingrediente(uuid, numeric, numeric, text) to authenticated;
