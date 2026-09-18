create unique index if not exists clientes_telefono_normalizado_unico
  on public.clientes ((regexp_replace(coalesce(telefono, ''), '\\D', '', 'g')))
  where regexp_replace(coalesce(telefono, ''), '\\D', '', 'g') <> '';

create or replace function public.buscar_clientes_referencia(p_nombre text default '', p_telefono text default '')
returns table (id uuid, nombre text, telefono text, email text, nit text, razon_social text, direccion text, coincidencia text)
language sql
stable
security invoker
set search_path = public
as $$
  with consulta as (
    select lower(trim(coalesce(p_nombre, ''))) as nombre,
      regexp_replace(coalesce(p_telefono, ''), '\\D', '', 'g') as telefono
  )
  select c.id, c.nombre, c.telefono, c.email, c.nit, c.razon_social, c.direccion,
    case
      when q.telefono <> '' and regexp_replace(coalesce(c.telefono, ''), '\\D', '', 'g') = q.telefono then 'Mismo teléfono'
      when q.nombre <> '' and lower(trim(c.nombre)) = q.nombre then 'Mismo nombre'
      when q.telefono <> '' and regexp_replace(coalesce(c.telefono, ''), '\\D', '', 'g') like '%' || q.telefono || '%' then 'Teléfono similar'
      else 'Nombre similar'
    end
  from public.clientes c cross join consulta q
  where (q.nombre <> '' and lower(trim(c.nombre)) like '%' || q.nombre || '%')
    or (q.telefono <> '' and regexp_replace(coalesce(c.telefono, ''), '\\D', '', 'g') like '%' || q.telefono || '%')
  order by
    case when q.telefono <> '' and regexp_replace(coalesce(c.telefono, ''), '\\D', '', 'g') = q.telefono then 0 else 1 end,
    case when q.nombre <> '' and lower(trim(c.nombre)) = q.nombre then 0 else 1 end,
    c.updated_at desc
  limit 8;
$$;

revoke all on function public.buscar_clientes_referencia(text, text) from public;
grant execute on function public.buscar_clientes_referencia(text, text) to authenticated;
