-- Las funciones de autorización no deben estar expuestas como RPC público.
create schema if not exists private;
revoke all on schema private from public;

alter function public.crear_perfil_crm() set schema private;
alter function public.tiene_rol_crm(text[]) set schema private;

revoke all on function private.crear_perfil_crm() from public, anon, authenticated;
revoke all on function private.tiene_rol_crm(text[]) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.tiene_rol_crm(text[]) to authenticated;
