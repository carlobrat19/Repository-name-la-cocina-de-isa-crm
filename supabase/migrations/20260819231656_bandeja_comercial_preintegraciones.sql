-- Base interna para la atención omnicanal antes de conectar Meta, correo o e-commerce.
-- No almacena secretos de proveedores ni envía comunicaciones reales.
alter table public.conversaciones
  add column if not exists responsable_id uuid references auth.users(id) on delete set null,
  add column if not exists creado_por uuid references auth.users(id) on delete set null,
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists prioridad text not null default 'Normal'
    check (prioridad in ('Baja', 'Normal', 'Alta', 'Urgente')),
  add column if not exists proxima_accion_at timestamptz;

alter table public.leads
  add column if not exists responsable_id uuid references auth.users(id) on delete set null,
  add column if not exists creado_por uuid references auth.users(id) on delete set null,
  add column if not exists ultima_actividad_at timestamptz not null default now(),
  add column if not exists valor_estimado numeric(12,2) not null default 0;

alter table public.mensajes
  add column if not exists creado_por uuid references auth.users(id) on delete set null,
  add column if not exists estado_envio text not null default 'Interno'
    check (estado_envio in ('Interno', 'Pendiente', 'Enviado', 'Entregado', 'Leído', 'Fallido'));

alter table public.pedidos
  add column if not exists conversacion_id uuid references public.conversaciones(id) on delete set null,
  add column if not exists responsable_id uuid references auth.users(id) on delete set null;

alter table public.cotizaciones
  add column if not exists conversacion_id uuid references public.conversaciones(id) on delete set null,
  add column if not exists responsable_id uuid references auth.users(id) on delete set null,
  add column if not exists creado_por uuid references auth.users(id) on delete set null;

create table if not exists public.actividades_comerciales (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid references public.conversaciones(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  pedido_id uuid references public.pedidos(id) on delete set null,
  tipo text not null check (tipo in ('Nota', 'Llamada', 'Seguimiento', 'Cotización', 'Pedido', 'Cambio de etapa')),
  detalle text not null,
  creado_por uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (conversacion_id is not null or lead_id is not null or cliente_id is not null or pedido_id is not null)
);

create table if not exists public.notificaciones_cliente (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  conversacion_id uuid references public.conversaciones(id) on delete set null,
  canal text not null check (canal in ('WhatsApp', 'Correo', 'Web')),
  evento text not null check (evento in ('Confirmación', 'Pago', 'Producción', 'Empaquetado', 'En ruta', 'Entregado', 'Manual')),
  destino text,
  contenido text not null,
  estado text not null default 'Borrador' check (estado in ('Borrador', 'Pendiente', 'Enviado', 'Fallido')),
  proveedor_id text,
  error_proveedor text,
  creado_por uuid references auth.users(id) on delete set null,
  enviado_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists conversaciones_responsable_actualizacion_idx on public.conversaciones(responsable_id, ultimo_mensaje_at desc);
create index if not exists leads_responsable_estado_idx on public.leads(responsable_id, estado, ultima_actividad_at desc);
create index if not exists pedidos_conversacion_idx on public.pedidos(conversacion_id);
create index if not exists pedidos_responsable_idx on public.pedidos(responsable_id, fecha_creacion desc);
create index if not exists actividades_conversacion_fecha_idx on public.actividades_comerciales(conversacion_id, created_at desc);
create index if not exists notificaciones_pedido_estado_idx on public.notificaciones_cliente(pedido_id, estado, created_at desc);

alter table public.actividades_comerciales enable row level security;
alter table public.notificaciones_cliente enable row level security;
revoke all on public.actividades_comerciales, public.notificaciones_cliente from anon;
grant select, insert, update on public.actividades_comerciales, public.notificaciones_cliente to authenticated;

create policy "conversaciones actividades lectura" on public.actividades_comerciales for select to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')));
create policy "conversaciones actividades alta" on public.actividades_comerciales for insert to authenticated
  with check ((select private.tiene_modulo_crm('conversaciones')) and creado_por = (select auth.uid()));
create policy "conversaciones actividades actualiza" on public.actividades_comerciales for update to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')))
  with check ((select private.tiene_modulo_crm('conversaciones')));
create policy "conversaciones notificaciones lectura" on public.notificaciones_cliente for select to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')));
create policy "conversaciones notificaciones alta" on public.notificaciones_cliente for insert to authenticated
  with check ((select private.tiene_modulo_crm('conversaciones')));
create policy "conversaciones notificaciones actualiza" on public.notificaciones_cliente for update to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')))
  with check ((select private.tiene_modulo_crm('conversaciones')));

-- Permitir cotizaciones desde la bandeja comercial sin abrir privilegios a anónimos.
grant select, insert, update on public.cotizaciones, public.cotizacion_detalle to authenticated;
create policy "conversaciones cotizaciones lectura" on public.cotizaciones for select to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')));
create policy "conversaciones cotizaciones alta" on public.cotizaciones for insert to authenticated
  with check ((select private.tiene_modulo_crm('conversaciones')));
create policy "conversaciones cotizaciones actualiza" on public.cotizaciones for update to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')))
  with check ((select private.tiene_modulo_crm('conversaciones')));
create policy "conversaciones cotizacion detalle lectura" on public.cotizacion_detalle for select to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')));
create policy "conversaciones cotizacion detalle alta" on public.cotizacion_detalle for insert to authenticated
  with check ((select private.tiene_modulo_crm('conversaciones')));
create policy "conversaciones cotizacion detalle actualiza" on public.cotizacion_detalle for update to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')))
  with check ((select private.tiene_modulo_crm('conversaciones')));

-- Toda conversación creada desde el CRM queda atribuida a la sesión actual.
create or replace function private.registrar_creador_conversacion()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then raise exception 'Se requiere una sesión para crear una conversación'; end if;
    new.creado_por := auth.uid();
    new.responsable_id := coalesce(new.responsable_id, auth.uid());
  else
    new.creado_por := old.creado_por;
  end if;
  return new;
end; $$;
revoke all on function private.registrar_creador_conversacion() from public, anon, authenticated;
drop trigger if exists conversaciones_registrar_creador on public.conversaciones;
create trigger conversaciones_registrar_creador before insert or update on public.conversaciones
for each row execute function private.registrar_creador_conversacion();
