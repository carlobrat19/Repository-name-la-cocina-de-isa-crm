-- Separate permissions for catalog, recipes, and ingredient inventory.
alter table public.permisos_usuario_crm
  drop constraint if exists permisos_usuario_crm_modulo_check;

alter table public.permisos_usuario_crm
  add constraint permisos_usuario_crm_modulo_check check (modulo in (
    'dashboard', 'pedidos', 'clientes', 'conversaciones', 'productos',
    'recetas_costos', 'ingredientes', 'produccion', 'pendientes',
    'cobros_fel', 'flujo_caja', 'reportes', 'integraciones'
  ));

-- Recipes need to read the catalog and manage their own recipe data.
create policy "modulo recetas productos lectura" on public.productos for select to authenticated
using (private.tiene_modulo_crm('recetas_costos'));
create policy "modulo recetas productos actualiza" on public.productos for update to authenticated
using (private.tiene_modulo_crm('recetas_costos')) with check (private.tiene_modulo_crm('recetas_costos'));
create policy "modulo recetas ingredientes lectura" on public.ingredientes for select to authenticated
using (private.tiene_modulo_crm('recetas_costos'));
create policy "modulo recetas recetas lectura" on public.recetas_estandar for select to authenticated
using (private.tiene_modulo_crm('recetas_costos'));
create policy "modulo recetas recetas alta" on public.recetas_estandar for insert to authenticated
with check (private.tiene_modulo_crm('recetas_costos'));
create policy "modulo recetas recetas actualiza" on public.recetas_estandar for update to authenticated
using (private.tiene_modulo_crm('recetas_costos')) with check (private.tiene_modulo_crm('recetas_costos'));
create policy "modulo recetas detalle lectura" on public.receta_ingredientes for select to authenticated
using (private.tiene_modulo_crm('recetas_costos'));
create policy "modulo recetas detalle alta" on public.receta_ingredientes for insert to authenticated
with check (private.tiene_modulo_crm('recetas_costos'));
create policy "modulo recetas detalle actualiza" on public.receta_ingredientes for update to authenticated
using (private.tiene_modulo_crm('recetas_costos')) with check (private.tiene_modulo_crm('recetas_costos'));
create policy "modulo recetas detalle elimina" on public.receta_ingredientes for delete to authenticated
using (private.tiene_modulo_crm('recetas_costos'));

-- Inventory staff may manage raw ingredients and see their purchase history.
create policy "modulo ingredientes lectura" on public.ingredientes for select to authenticated
using (private.tiene_modulo_crm('ingredientes'));
create policy "modulo ingredientes alta" on public.ingredientes for insert to authenticated
with check (private.tiene_modulo_crm('ingredientes'));
create policy "modulo ingredientes actualiza" on public.ingredientes for update to authenticated
using (private.tiene_modulo_crm('ingredientes')) with check (private.tiene_modulo_crm('ingredientes'));
create policy "modulo ingredientes compras lectura" on public.compras_ingredientes for select to authenticated
using (private.tiene_modulo_crm('ingredientes'));
create policy "modulo ingredientes compras alta" on public.compras_ingredientes for insert to authenticated
with check (private.tiene_modulo_crm('ingredientes'));

create or replace function public.ajustar_ingrediente(
  p_ingrediente_id uuid,
  p_nombre text,
  p_unidad_base text,
  p_stock_final numeric,
  p_costo_referencia numeric,
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
  diferencia numeric;
begin
  if (select auth.uid()) is null or not (private.tiene_modulo_crm('productos') or private.tiene_modulo_crm('ingredientes')) then
    raise exception 'No autorizado para ajustar ingredientes';
  end if;
  if coalesce(trim(p_nombre), '') = '' or p_unidad_base not in ('g', 'ml', 'unidad') or p_stock_final is null or p_stock_final < 0 or p_costo_referencia is null or p_costo_referencia < 0 then
    raise exception 'Datos de ingrediente no válidos';
  end if;
  select * into ingrediente_actual from public.ingredientes where id = p_ingrediente_id for update;
  if not found then raise exception 'Ingrediente no encontrado'; end if;
  diferencia := p_stock_final - ingrediente_actual.stock_actual;
  update public.ingredientes set nombre = trim(p_nombre), unidad_base = p_unidad_base, stock_actual = p_stock_final, costo_referencia = p_costo_referencia, updated_at = now() where id = p_ingrediente_id returning * into ingrediente_actualizado;
  if diferencia <> 0 or p_costo_referencia is distinct from ingrediente_actual.costo_referencia then
    insert into public.compras_ingredientes (ingrediente_id, tipo, cantidad, costo_unitario, total, nota, creado_por)
    values (p_ingrediente_id, 'ajuste', diferencia, p_costo_referencia, round(abs(diferencia) * p_costo_referencia, 2), coalesce(nullif(trim(p_nota), ''), 'Ajuste manual de costo o existencias'), (select auth.uid()));
  end if;
  return ingrediente_actualizado;
end;
$$;

revoke all on function public.ajustar_ingrediente(uuid, text, text, numeric, numeric, text) from public, anon;
grant execute on function public.ajustar_ingrediente(uuid, text, text, numeric, numeric, text) to authenticated;
