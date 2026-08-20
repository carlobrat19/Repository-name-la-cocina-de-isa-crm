-- Los wrappers públicos no necesitan elevar privilegios: las operaciones
-- privilegiadas permanecen únicamente en el esquema private y validan al
-- administrador autenticado antes de eliminar.
alter function public.eliminar_sucursal_segura(uuid) security invoker;
alter function public.eliminar_cuenta_financiera_segura(uuid) security invoker;
revoke all on function public.eliminar_sucursal_segura(uuid) from public, anon;
revoke all on function public.eliminar_cuenta_financiera_segura(uuid) from public, anon;
grant execute on function public.eliminar_sucursal_segura(uuid) to authenticated;
grant execute on function public.eliminar_cuenta_financiera_segura(uuid) to authenticated;
