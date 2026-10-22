-- Los comprobantes documentan compras existentes; por sí solos no crean gastos ni stock.
create table public.proveedores_compra (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  nit text,
  contacto text,
  telefono text,
  correo text,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index proveedores_compra_nit_unico_idx
  on public.proveedores_compra (upper(btrim(nit)))
  where nit is not null and btrim(nit) <> '';
create index proveedores_compra_nombre_idx on public.proveedores_compra (nombre);

create table public.facturas_compra (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores_compra(id) on delete restrict,
  numero text,
  fecha date not null,
  total numeric(14,2) not null check (total >= 0),
  impuesto numeric(14,2) not null default 0 check (impuesto >= 0),
  categoria text not null default 'Materia prima',
  origen text not null default 'crm' check (origen in ('crm', 'whatsapp', 'sat')),
  estado text not null default 'En revisión' check (estado in ('En revisión', 'Documentada')),
  comprobante_path text,
  notas text,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index facturas_compra_proveedor_numero_idx
  on public.facturas_compra (proveedor_id, upper(btrim(numero)))
  where numero is not null and btrim(numero) <> '';
create index facturas_compra_fecha_idx on public.facturas_compra (fecha desc);
create index facturas_compra_proveedor_idx on public.facturas_compra (proveedor_id, fecha desc);

create table public.facturas_compra_lineas (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas_compra(id) on delete cascade,
  descripcion text not null check (btrim(descripcion) <> ''),
  categoria text not null default 'Materia prima',
  cantidad numeric(14,3) check (cantidad is null or cantidad > 0),
  unidad_factura text,
  cantidad_base numeric(14,3) check (cantidad_base is null or cantidad_base > 0),
  monto numeric(14,2) not null check (monto >= 0),
  ingrediente_id uuid references public.ingredientes(id) on delete restrict,
  compra_ingrediente_id uuid unique references public.compras_ingredientes(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (compra_ingrediente_id is null or ingrediente_id is not null)
);

create index facturas_compra_lineas_factura_idx on public.facturas_compra_lineas (factura_id);
create index facturas_compra_lineas_ingrediente_idx on public.facturas_compra_lineas (ingrediente_id);

create function public.validar_vinculo_factura_compra()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.compra_ingrediente_id is not null and not exists (
    select 1 from public.compras_ingredientes compra
    where compra.id = new.compra_ingrediente_id
      and compra.tipo = 'compra'
      and compra.ingrediente_id = new.ingrediente_id
  ) then
    raise exception 'La compra vinculada no corresponde al ingrediente';
  end if;
  return new;
end;
$$;
create trigger validar_vinculo_factura_compra
  before insert or update on public.facturas_compra_lineas
  for each row execute function public.validar_vinculo_factura_compra();

create table public.equivalencias_proveedor_ingrediente (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores_compra(id) on delete cascade,
  descripcion text not null check (btrim(descripcion) <> ''),
  ingrediente_id uuid not null references public.ingredientes(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index equivalencias_proveedor_descripcion_idx
  on public.equivalencias_proveedor_ingrediente (proveedor_id, lower(btrim(descripcion)));
create index equivalencias_proveedor_ingrediente_idx
  on public.equivalencias_proveedor_ingrediente (ingrediente_id);

alter table public.proveedores_compra enable row level security;
alter table public.facturas_compra enable row level security;
alter table public.facturas_compra_lineas enable row level security;
alter table public.equivalencias_proveedor_ingrediente enable row level security;

create policy "compras ingredientes consulta facturas" on public.compras_ingredientes
  for select to authenticated using ((select private.tiene_modulo_crm('flujo_caja')));
create policy "ingredientes consulta facturas" on public.ingredientes
  for select to authenticated using ((select private.tiene_modulo_crm('flujo_caja')));

grant select, insert, update on public.proveedores_compra, public.facturas_compra,
  public.facturas_compra_lineas, public.equivalencias_proveedor_ingrediente to authenticated;

create policy "proveedores lectura" on public.proveedores_compra for select to authenticated
  using ((select private.tiene_modulo_crm('flujo_caja')));
create policy "proveedores alta" on public.proveedores_compra for insert to authenticated
  with check ((select private.tiene_modulo_crm('flujo_caja')) and creado_por = (select auth.uid()));
create policy "proveedores edicion" on public.proveedores_compra for update to authenticated
  using ((select private.tiene_modulo_crm('flujo_caja')))
  with check ((select private.tiene_modulo_crm('flujo_caja')));

create policy "facturas compra lectura" on public.facturas_compra for select to authenticated
  using ((select private.tiene_modulo_crm('flujo_caja')));
create policy "facturas compra alta" on public.facturas_compra for insert to authenticated
  with check ((select private.tiene_modulo_crm('flujo_caja')) and creado_por = (select auth.uid()) and origen = 'crm');
create policy "facturas compra edicion" on public.facturas_compra for update to authenticated
  using ((select private.tiene_modulo_crm('flujo_caja')))
  with check ((select private.tiene_modulo_crm('flujo_caja')));

create policy "lineas compra lectura" on public.facturas_compra_lineas for select to authenticated
  using ((select private.tiene_modulo_crm('flujo_caja')));
create policy "lineas compra alta" on public.facturas_compra_lineas for insert to authenticated
  with check ((select private.tiene_modulo_crm('flujo_caja')));
create policy "lineas compra edicion" on public.facturas_compra_lineas for update to authenticated
  using ((select private.tiene_modulo_crm('flujo_caja')))
  with check ((select private.tiene_modulo_crm('flujo_caja')));

create policy "equivalencias lectura" on public.equivalencias_proveedor_ingrediente for select to authenticated
  using ((select private.tiene_modulo_crm('flujo_caja')));
create policy "equivalencias alta" on public.equivalencias_proveedor_ingrediente for insert to authenticated
  with check ((select private.tiene_modulo_crm('flujo_caja')));
create policy "equivalencias edicion" on public.equivalencias_proveedor_ingrediente for update to authenticated
  using ((select private.tiene_modulo_crm('flujo_caja')))
  with check ((select private.tiene_modulo_crm('flujo_caja')));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('facturas-compra', 'facturas-compra', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/xml', 'text/xml'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "facturas compra archivos lectura" on storage.objects for select to authenticated
  using (bucket_id = 'facturas-compra' and (select private.tiene_modulo_crm('flujo_caja')));
create policy "facturas compra archivos alta" on storage.objects for insert to authenticated
  with check (bucket_id = 'facturas-compra' and (select private.tiene_modulo_crm('flujo_caja')));
