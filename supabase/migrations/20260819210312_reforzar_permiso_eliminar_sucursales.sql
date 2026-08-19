-- Mantiene la gestión cotidiana por módulo, pero reservar borrar sucursales
-- exclusivamente al administrador evita eliminar trazabilidad por la API.
drop policy if exists "sucursales administracion" on public.sucursales;

create policy "sucursales lectura por modulo"
on public.sucursales for select to authenticated
using (private.tiene_modulo_crm('sucursales'));

create policy "sucursales alta por modulo"
on public.sucursales for insert to authenticated
with check (private.tiene_modulo_crm('sucursales'));

create policy "sucursales edicion por modulo"
on public.sucursales for update to authenticated
using (private.tiene_modulo_crm('sucursales'))
with check (private.tiene_modulo_crm('sucursales'));

create policy "sucursales eliminacion administrador"
on public.sucursales for delete to authenticated
using (private.es_administrador_crm());
