-- Acceso por usuario y roles del CRM.
create table if not exists public.perfiles_crm (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nombre text,
  rol text not null default 'Sin acceso' check (rol in ('Administrador', 'Ventas', 'Producción', 'Reparto', 'Caja', 'Sin acceso')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.crear_perfil_crm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles_crm (id, email, nombre, rol)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'nombre', new.raw_user_meta_data ->> 'full_name'),
    case when lower(new.email) = 'carlobrat@gmail.com' then 'Administrador' else 'Sin acceso' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.crear_perfil_crm() from public;

drop trigger if exists on_auth_user_created_crm on auth.users;
create trigger on_auth_user_created_crm
  after insert on auth.users
  for each row execute procedure public.crear_perfil_crm();

create or replace function public.tiene_rol_crm(roles_permitidos text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles_crm
    where id = (select auth.uid())
      and activo = true
      and rol = any(roles_permitidos)
  );
$$;

revoke all on function public.tiene_rol_crm(text[]) from public;
grant execute on function public.tiene_rol_crm(text[]) to authenticated;

alter table public.perfiles_crm enable row level security;
grant select on public.perfiles_crm to authenticated;

drop policy if exists "perfil propio crm" on public.perfiles_crm;
drop policy if exists "administrador gestiona perfiles crm" on public.perfiles_crm;
create policy "perfil propio crm" on public.perfiles_crm
  for select to authenticated
  using ((select auth.uid()) = id);
create policy "administrador gestiona perfiles crm" on public.perfiles_crm
  for all to authenticated
  using (public.tiene_rol_crm(array['Administrador']))
  with check (public.tiene_rol_crm(array['Administrador']));

-- Todos los datos operativos pasan a RLS. El administrador conserva control total.
do $$
declare tabla text;
begin
  foreach tabla in array array[
    'clientes', 'productos', 'pedidos', 'pedido_detalle', 'movimientos_caja',
    'vendedores', 'cliente_direcciones', 'etiquetas', 'cliente_etiquetas',
    'cotizaciones', 'cotizacion_detalle', 'pagos', 'movimientos_inventario',
    'facturas', 'conversaciones', 'mensajes', 'plantillas_mensaje', 'leads', 'integration_events'
  ] loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format('revoke all on table public.%I from anon', tabla);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', tabla);
    execute format('drop policy if exists "administrador total crm" on public.%I', tabla);
    execute format(
      'create policy "administrador total crm" on public.%I for all to authenticated using (public.tiene_rol_crm(array[''Administrador''])) with check (public.tiene_rol_crm(array[''Administrador'']))',
      tabla
    );
  end loop;
end;
$$;

-- Ventas: clientes, pedidos, líneas y cobros. No puede borrar registros.
create policy "ventas clientes crm" on public.clientes for all to authenticated
  using (public.tiene_rol_crm(array['Ventas'])) with check (public.tiene_rol_crm(array['Ventas']));
create policy "ventas direcciones crm" on public.cliente_direcciones for all to authenticated
  using (public.tiene_rol_crm(array['Ventas'])) with check (public.tiene_rol_crm(array['Ventas']));
create policy "ventas pedidos crm" on public.pedidos for all to authenticated
  using (public.tiene_rol_crm(array['Ventas'])) with check (public.tiene_rol_crm(array['Ventas']));
create policy "ventas detalle crm" on public.pedido_detalle for all to authenticated
  using (public.tiene_rol_crm(array['Ventas'])) with check (public.tiene_rol_crm(array['Ventas']));
create policy "ventas productos lectura crm" on public.productos for select to authenticated
  using (public.tiene_rol_crm(array['Ventas']));
create policy "ventas pagos crm" on public.pagos for all to authenticated
  using (public.tiene_rol_crm(array['Ventas'])) with check (public.tiene_rol_crm(array['Ventas']));

-- Producción y reparto reciben solo sus datos de operación.
create policy "produccion pedidos crm" on public.pedidos for select to authenticated using (public.tiene_rol_crm(array['Producción']));
create policy "produccion actualiza pedidos crm" on public.pedidos for update to authenticated using (public.tiene_rol_crm(array['Producción'])) with check (public.tiene_rol_crm(array['Producción']));
create policy "produccion detalle crm" on public.pedido_detalle for select to authenticated using (public.tiene_rol_crm(array['Producción']));
create policy "produccion productos crm" on public.productos for select to authenticated using (public.tiene_rol_crm(array['Producción']));
create policy "produccion inventario crm" on public.movimientos_inventario for all to authenticated using (public.tiene_rol_crm(array['Producción'])) with check (public.tiene_rol_crm(array['Producción']));
create policy "reparto pedidos crm" on public.pedidos for select to authenticated using (public.tiene_rol_crm(array['Reparto']));
create policy "reparto actualiza pedidos crm" on public.pedidos for update to authenticated using (public.tiene_rol_crm(array['Reparto'])) with check (public.tiene_rol_crm(array['Reparto']));
create policy "reparto detalle crm" on public.pedido_detalle for select to authenticated using (public.tiene_rol_crm(array['Reparto']));
create policy "reparto clientes crm" on public.clientes for select to authenticated using (public.tiene_rol_crm(array['Reparto']));

-- Caja consulta ventas y registra cobros / movimientos de caja.
create policy "caja pedidos crm" on public.pedidos for select to authenticated using (public.tiene_rol_crm(array['Caja']));
create policy "caja clientes crm" on public.clientes for select to authenticated using (public.tiene_rol_crm(array['Caja']));
create policy "caja pagos crm" on public.pagos for all to authenticated using (public.tiene_rol_crm(array['Caja'])) with check (public.tiene_rol_crm(array['Caja']));
create policy "caja movimientos crm" on public.movimientos_caja for all to authenticated using (public.tiene_rol_crm(array['Caja'])) with check (public.tiene_rol_crm(array['Caja']));
