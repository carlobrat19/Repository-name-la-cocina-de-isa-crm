create policy "modulo productos receta detalle elimina"
on public.receta_ingredientes
for delete
to authenticated
using (private.tiene_modulo_crm('productos'));
