create policy "modulo recetas productos alta" on public.productos for insert to authenticated
with check (private.tiene_modulo_crm('recetas_costos'));
