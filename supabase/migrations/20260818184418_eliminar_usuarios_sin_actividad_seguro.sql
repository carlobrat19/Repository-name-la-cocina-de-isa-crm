create or replace function public.eliminar_usuario_crm_sin_actividad(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  v_actor_email text;
  v_objetivo_email text;
begin
  select email into v_actor_email from public.perfiles_crm where id = (select auth.uid());
  if lower(coalesce(v_actor_email, '')) <> 'carlobrat@gmail.com' then
    raise exception 'Solo el administrador principal puede eliminar cuentas';
  end if;
  if p_usuario_id = (select auth.uid()) then
    raise exception 'No puedes eliminar tu propia cuenta';
  end if;
  select email into v_objetivo_email from public.perfiles_crm where id = p_usuario_id;
  if v_objetivo_email is null or lower(v_objetivo_email) = 'carlobrat@gmail.com' then
    raise exception 'Cuenta no disponible para eliminar';
  end if;
  if exists (select 1 from public.pedidos where creado_por = p_usuario_id)
    or exists (select 1 from public.movimientos_caja where creado_por = p_usuario_id)
    or exists (select 1 from public.compras_ingredientes where creado_por = p_usuario_id)
    or exists (select 1 from public.historial_estados_pedido where creado_por = p_usuario_id) then
    raise exception 'Esta cuenta tiene actividad registrada. Desactívala para conservar la trazabilidad';
  end if;
  insert into public.auditoria_usuarios_crm (actor_id, usuario_id, accion, detalle)
  values ((select auth.uid()), p_usuario_id, 'Eliminó una cuenta sin actividad', jsonb_build_object('email', v_objetivo_email));
  delete from auth.users where id = p_usuario_id;
end;
$$;

revoke all on function public.eliminar_usuario_crm_sin_actividad(uuid) from public, anon;
grant execute on function public.eliminar_usuario_crm_sin_actividad(uuid) to authenticated;
