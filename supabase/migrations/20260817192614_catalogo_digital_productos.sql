alter table public.productos
  add column if not exists descripcion text,
  add column if not exists sku text,
  add column if not exists imagen_url text,
  add column if not exists stock_minimo integer not null default 0 check (stock_minimo >= 0),
  add column if not exists disponible_online boolean not null default true,
  add column if not exists publicar_catalogo boolean not null default false,
  add column if not exists tiempo_preparacion_min integer check (tiempo_preparacion_min is null or tiempo_preparacion_min >= 0),
  add column if not exists etiquetas text[] not null default '{}',
  add column if not exists canales_venta text[] not null default '{}';

create unique index if not exists productos_sku_unico_idx
on public.productos (lower(sku))
where sku is not null and btrim(sku) <> '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "modulo productos sube fotos"
on storage.objects for insert to authenticated
with check (bucket_id = 'productos' and (select private.tiene_modulo_crm('productos')));

create policy "modulo productos actualiza fotos"
on storage.objects for update to authenticated
using (bucket_id = 'productos' and (select private.tiene_modulo_crm('productos')))
with check (bucket_id = 'productos' and (select private.tiene_modulo_crm('productos')));

create policy "modulo productos elimina fotos"
on storage.objects for delete to authenticated
using (bucket_id = 'productos' and (select private.tiene_modulo_crm('productos')));
