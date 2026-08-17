-- Auditoría de pedidos: el creador se obtiene de la sesión autenticada.
-- No se permite modificarlo posteriormente desde el CRM.
alter table public.pedidos
  add column if not exists creado_por uuid references auth.users(id) on delete set null,
  add column if not exists creado_por_nombre text;

create or replace function private.registrar_creador_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'No se puede crear un pedido sin una sesión autenticada.';
    end if;

    new.creado_por := auth.uid();
    select coalesce(nombre, email)
      into new.creado_por_nombre
      from public.perfiles_crm
      where id = new.creado_por;
    new.creado_por_nombre := coalesce(new.creado_por_nombre, 'Usuario autorizado');
  else
    new.creado_por := old.creado_por;
    new.creado_por_nombre := old.creado_por_nombre;
  end if;

  return new;
end;
$$;

revoke all on function private.registrar_creador_pedido() from public, anon, authenticated;

drop trigger if exists pedidos_registrar_creador on public.pedidos;
create trigger pedidos_registrar_creador
  before insert or update on public.pedidos
  for each row execute function private.registrar_creador_pedido();
