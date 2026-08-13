-- La Cocina de Isa: CRM comercial, conversaciones e integraciones.
-- Ejecute este archivo desde Supabase SQL Editor antes de usar los módulos nuevos.

create table if not exists public.vendedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text unique,
  email text,
  nit text,
  razon_social text,
  canal_origen text not null default 'Manual',
  estado text not null default 'Activo',
  saldo numeric(12,2) not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- La instalación original ya incluía una tabla clientes básica. Estas columnas
-- la convierten en una ficha CRM sin eliminar su dirección ni sus registros.
alter table public.clientes add column if not exists email text;
alter table public.clientes add column if not exists nit text;
alter table public.clientes add column if not exists razon_social text;
alter table public.clientes add column if not exists canal_origen text not null default 'Manual';
alter table public.clientes add column if not exists estado text not null default 'Activo';
alter table public.clientes add column if not exists saldo numeric(12,2) not null default 0;
alter table public.clientes add column if not exists notas text;
alter table public.clientes add column if not exists updated_at timestamptz not null default now();
create unique index if not exists clientes_telefono_unico_idx on public.clientes(telefono) where telefono is not null;

create table if not exists public.cliente_direcciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  etiqueta text not null default 'Principal',
  direccion text not null,
  municipio text,
  referencia text,
  principal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color text not null default '#2563eb'
);

create table if not exists public.cliente_etiquetas (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  etiqueta_id uuid not null references public.etiquetas(id) on delete cascade,
  primary key (cliente_id, etiqueta_id)
);

alter table public.pedidos add column if not exists cliente_id uuid references public.clientes(id) on delete set null;
alter table public.pedidos add column if not exists vendedor_id uuid references public.vendedores(id) on delete set null;
alter table public.pedidos add column if not exists saldo_pendiente numeric(12,2) not null default 0;
alter table public.pedidos add column if not exists tipo_documento text not null default 'Pedido';
alter table public.pedidos add column if not exists canal_origen text not null default 'Manual';
alter table public.pedidos add column if not exists fecha_creacion timestamptz not null default now();

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  cliente_id uuid references public.clientes(id) on delete set null,
  vendedor_id uuid references public.vendedores(id) on delete set null,
  estado text not null default 'Borrador',
  total numeric(12,2) not null default 0,
  vence_el date,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists public.cotizacion_detalle (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  descripcion text not null,
  cantidad numeric(12,2) not null default 1,
  precio numeric(12,2) not null default 0
);

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  monto numeric(12,2) not null check (monto > 0),
  metodo text not null default 'Efectivo',
  referencia text,
  fecha date not null default current_date,
  creado_por uuid references public.vendedores(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  tipo text not null check (tipo in ('Entrada', 'Salida', 'Ajuste')),
  cantidad numeric(12,2) not null,
  costo_unitario numeric(12,2),
  pedido_id uuid references public.pedidos(id) on delete set null,
  motivo text,
  created_at timestamptz not null default now()
);

create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  proveedor_fel text not null,
  estado text not null default 'Borrador',
  serie text,
  numero text,
  uuid_fel text,
  total numeric(12,2) not null default 0,
  error_fel text,
  emitida_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.conversaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  vendedor_id uuid references public.vendedores(id) on delete set null,
  canal text not null check (canal in ('WhatsApp', 'Instagram', 'Facebook', 'Web')),
  contacto_externo_id text,
  ultimo_mensaje text,
  ultimo_mensaje_at timestamptz,
  estado text not null default 'Abierta',
  created_at timestamptz not null default now(),
  unique(canal, contacto_externo_id)
);

create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  direccion text not null check (direccion in ('Entrante', 'Saliente')),
  contenido text,
  tipo text not null default 'text',
  proveedor_mensaje_id text unique,
  enviado_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.plantillas_mensaje (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  canal text not null default 'WhatsApp',
  contenido text not null,
  aprobada boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  telefono text,
  email text,
  canal text not null,
  campana text,
  estado text not null default 'Nuevo',
  vendedor_id uuid references public.vendedores(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null,
  tipo text,
  payload jsonb not null,
  procesado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists clientes_telefono_idx on public.clientes(telefono);
create index if not exists pedidos_cliente_idx on public.pedidos(cliente_id);
create index if not exists pagos_pedido_idx on public.pagos(pedido_id);
create index if not exists conversaciones_actualizacion_idx on public.conversaciones(ultimo_mensaje_at desc);

-- Seguridad: este proyecto aún no implementa Supabase Auth. Antes de producción,
-- active RLS y agregue políticas por usuario/rol para TODAS estas tablas. No active
-- RLS sin dichas políticas, ya que bloquearía el CRM actual que usa el cliente anónimo.
