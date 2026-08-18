alter table public.perfiles_crm add column if not exists acceso_hasta timestamptz;
alter table public.invitaciones_crm add column if not exists acceso_hasta timestamptz;

create table if not exists public.auditoria_usuarios_crm (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  usuario_id uuid references auth.users(id) on delete set null,
  accion text not null,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auditoria_usuarios_crm_created_at_idx on public.auditoria_usuarios_crm (created_at desc);
create index if not exists auditoria_usuarios_crm_usuario_idx on public.auditoria_usuarios_crm (usuario_id, created_at desc);
alter table public.auditoria_usuarios_crm enable row level security;
revoke all on public.auditoria_usuarios_crm from anon;
grant select, insert on public.auditoria_usuarios_crm to authenticated;
create policy "administrador consulta auditoria usuarios" on public.auditoria_usuarios_crm for select to authenticated
using (private.tiene_rol_crm(array['Administrador']));
create policy "administrador registra auditoria usuarios" on public.auditoria_usuarios_crm for insert to authenticated
with check (private.tiene_rol_crm(array['Administrador']) and actor_id = (select auth.uid()));

create or replace function private.tiene_rol_crm(roles_permitidos text[])
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.perfiles_crm
    where id = (select auth.uid())
      and activo = true
      and (acceso_hasta is null or acceso_hasta > now())
      and rol = any(roles_permitidos)
  );
$$;
revoke all on function private.tiene_rol_crm(text[]) from public, anon;
grant execute on function private.tiene_rol_crm(text[]) to authenticated;

create or replace function private.tiene_modulo_crm(modulo_solicitado text)
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.tiene_rol_crm(array['Administrador']) or exists (
    select 1 from public.permisos_usuario_crm permiso
    join public.perfiles_crm perfil on perfil.id = permiso.user_id
    where permiso.user_id = (select auth.uid())
      and perfil.activo = true
      and (perfil.acceso_hasta is null or perfil.acceso_hasta > now())
      and permiso.modulo = modulo_solicitado
  );
$$;
revoke all on function private.tiene_modulo_crm(text) from public, anon;
grant execute on function private.tiene_modulo_crm(text) to authenticated;

create or replace function private.crear_perfil_crm()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare invitacion public.invitaciones_crm%rowtype;
begin
  if lower(new.email) = 'carlobrat@gmail.com' then
    insert into public.perfiles_crm (id, email, nombre, rol, activo)
    values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'nombre', new.raw_user_meta_data ->> 'full_name'), 'Administrador', true)
    on conflict (id) do nothing;
    return new;
  end if;
  select * into invitacion from public.invitaciones_crm where lower(email) = lower(new.email) and activo = true and activado_at is null;
  if not found then raise exception 'Esta cuenta debe ser creada y autorizada primero por el administrador del CRM.'; end if;
  insert into public.perfiles_crm (id, email, nombre, rol, activo, acceso_hasta)
  values (new.id, lower(new.email), coalesce(invitacion.nombre, new.raw_user_meta_data ->> 'nombre', new.raw_user_meta_data ->> 'full_name'), invitacion.rol, true, invitacion.acceso_hasta);
  insert into public.permisos_usuario_crm (user_id, modulo)
  select new.id, modulo from unnest(invitacion.modulos) as modulo on conflict (user_id, modulo) do nothing;
  update public.invitaciones_crm set activado_at = now() where id = invitacion.id;
  return new;
end;
$$;
revoke all on function private.crear_perfil_crm() from public, anon, authenticated;
