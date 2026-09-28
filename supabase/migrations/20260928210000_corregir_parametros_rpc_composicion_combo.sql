-- PostgREST resuelve RPC por nombre de argumento. La envoltura anterior
-- declaraba solo tipos (uuid, jsonb, jsonb), por eso p_combo_id no existia
-- en la cache de funciones y el formulario recibia PGRST202/404.
alter function public.guardar_composicion_combo(uuid, jsonb, jsonb)
  rename to guardar_composicion_combo_legacy;

create function public.guardar_composicion_combo(
  p_combo_id uuid,
  p_productos jsonb,
  p_ingredientes jsonb
) returns void language sql security invoker set search_path = public, private as $$
  select private.guardar_composicion_combo(p_combo_id, p_productos, p_ingredientes);
$$;

revoke all on function public.guardar_composicion_combo(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_composicion_combo(uuid, jsonb, jsonb) to authenticated;
drop function public.guardar_composicion_combo_legacy(uuid, jsonb, jsonb);

notify pgrst, 'reload schema';
