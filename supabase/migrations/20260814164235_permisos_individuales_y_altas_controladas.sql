-- Administrators approve each account before it can sign up and choose modules individually.
create table if not exists public.invitaciones_crm (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nombre text,
  rol text not null default 'Sin acceso' check (rol in ('Administrador', 'Ventas', U&'Producci\00F3n', 'Reparto', 'Caja', 'Sin acceso')),
  activo boolean not null default true,
  modulos text[] not null default '{}',
  creado_por uuid references auth.users(id),
  creado_at timestamptz not null default now(),
  activado_at timestamptz
);

create table if not exists public.permisos_usuario_crm (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null check (modulo in ('dashboard', 'pedidos', 'clientes', 'conversaciones', 'productos', 'produccion', 'pendientes', 'cobros_fel', 'flujo_caja', 'reportes', 'integraciones')),
  creado_at timestamptz not null default now(),
  unique (user_id, modulo)
);

alter table public.invitaciones_crm enable row level security;
alter table public.permisos_usuario_crm enable row level security;
revoke all on table public.invitaciones_crm from anon;
revoke all on table public.permisos_usuario_crm from anon;
grant select, insert, update, delete on table public.invitaciones_crm to authenticated;
grant select, insert, update, delete on table public.permisos_usuario_crm to authenticated;

create policy "administrador gestiona invitaciones crm" on public.invitaciones_crm
  for all to authenticated
  using (private.tiene_rol_crm(array['Administrador']))
  with check (private.tiene_rol_crm(array['Administrador']));
create policy "usuario consulta permisos propios crm" on public.permisos_usuario_crm
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "administrador gestiona permisos crm" on public.permisos_usuario_crm
  for all to authenticated
  using (private.tiene_rol_crm(array['Administrador']))
  with check (private.tiene_rol_crm(array['Administrador']));

create or replace function private.tiene_modulo_crm(modulo_solicitado text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.tiene_rol_crm(array['Administrador'])
    or exists (
      select 1 from public.permisos_usuario_crm
      where user_id = (select auth.uid())
        and modulo = modulo_solicitado
    );
$$;
revoke all on function private.tiene_modulo_crm(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.tiene_modulo_crm(text) to authenticated;

-- Block public self-registration. A staff member can only activate an email
-- that was first approved by the administrator in the CRM.
create or replace function private.crear_perfil_crm()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  invitacion public.invitaciones_crm%rowtype;
begin
  if lower(new.email) = 'carlobrat@gmail.com' then
    insert into public.perfiles_crm (id, email, nombre, rol, activo)
    values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'nombre', new.raw_user_meta_data ->> 'full_name'), 'Administrador', true)
    on conflict (id) do nothing;
    return new;
  end if;

  select * into invitacion
  from public.invitaciones_crm
  where lower(email) = lower(new.email)
    and activo = true
    and activado_at is null;

  if not found then
    raise exception 'Esta cuenta debe ser creada y autorizada primero por el administrador del CRM.';
  end if;

  insert into public.perfiles_crm (id, email, nombre, rol, activo)
  values (new.id, lower(new.email), coalesce(invitacion.nombre, new.raw_user_meta_data ->> 'nombre', new.raw_user_meta_data ->> 'full_name'), invitacion.rol, true);

  insert into public.permisos_usuario_crm (user_id, modulo)
  select new.id, modulo from unnest(invitacion.modulos) as modulo
  on conflict (user_id, modulo) do nothing;

  update public.invitaciones_crm set activado_at = now() where id = invitacion.id;
  return new;
end;
$$;

-- Remove role-wide access. The policies below are checked for every request.
do $$
declare registro record;
begin
  for registro in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename not in ('perfiles_crm', 'invitaciones_crm', 'permisos_usuario_crm')
      and policyname <> 'administrador total crm'
  loop
    execute format('drop policy if exists %I on %I.%I', registro.policyname, registro.schemaname, registro.tablename);
  end loop;
end;
$$;

do $$
declare
  tabla text;
  modulo text;
begin
  -- Write policies for operational modules.
  for modulo, tabla in
    select * from (values
      ('pedidos', 'pedidos'), ('pedidos', 'pedido_detalle'), ('pedidos', 'clientes'), ('pedidos', 'cliente_direcciones'), ('pedidos', 'productos'), ('pedidos', 'pagos'),
      ('clientes', 'clientes'), ('clientes', 'cliente_direcciones'), ('clientes', 'etiquetas'), ('clientes', 'cliente_etiquetas'),
      ('conversaciones', 'conversaciones'), ('conversaciones', 'mensajes'), ('conversaciones', 'plantillas_mensaje'), ('conversaciones', 'leads'),
      ('productos', 'productos'), ('productos', 'movimientos_inventario'),
      ('produccion', 'pedidos'), ('produccion', 'pedido_detalle'), ('produccion', 'productos'), ('produccion', 'movimientos_inventario'),
      ('cobros_fel', 'pedidos'), ('cobros_fel', 'clientes'), ('cobros_fel', 'pagos'), ('cobros_fel', 'facturas'), ('cobros_fel', 'movimientos_caja'),
      ('flujo_caja', 'pedidos'), ('flujo_caja', 'clientes'), ('flujo_caja', 'pagos'), ('flujo_caja', 'movimientos_caja'),
      ('integraciones', 'integration_events')
    ) as permisos(modulo, tabla)
  loop
    execute format('create policy %I on public.%I for select to authenticated using (private.tiene_modulo_crm(%L))', 'modulo ' || modulo || ' lectura', tabla, modulo);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.tiene_modulo_crm(%L))', 'modulo ' || modulo || ' alta', tabla, modulo);
    execute format('create policy %I on public.%I for update to authenticated using (private.tiene_modulo_crm(%L)) with check (private.tiene_modulo_crm(%L))', 'modulo ' || modulo || ' actualiza', tabla, modulo, modulo);
  end loop;

  -- Modules that are read-only by design.
  for modulo, tabla in
    select * from (values
      ('dashboard', 'pedidos'), ('dashboard', 'clientes'), ('dashboard', 'productos'), ('dashboard', 'pagos'),
      ('pendientes', 'pedidos'), ('pendientes', 'pedido_detalle'), ('pendientes', 'productos'),
      ('reportes', 'pedidos'), ('reportes', 'pedido_detalle'), ('reportes', 'clientes'), ('reportes', 'productos'), ('reportes', 'pagos'), ('reportes', 'facturas'), ('reportes', 'movimientos_caja')
    ) as consultas(modulo, tabla)
  loop
    execute format('create policy %I on public.%I for select to authenticated using (private.tiene_modulo_crm(%L))', 'modulo ' || modulo || ' consulta', tabla, modulo);
  end loop;
end;
$$;
