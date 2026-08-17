create table public.historial_estados_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index historial_estados_pedido_pedido_created_idx
on public.historial_estados_pedido (pedido_id, created_at desc);

alter table public.historial_estados_pedido enable row level security;
revoke all on public.historial_estados_pedido from anon;
grant select on public.historial_estados_pedido to authenticated;

create policy "modulo produccion historial lectura"
on public.historial_estados_pedido for select to authenticated
using (private.tiene_modulo_crm('produccion') or private.tiene_modulo_crm('pedidos'));

create or replace function public.registrar_historial_estado_pedido()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historial_estados_pedido (pedido_id, estado_anterior, estado_nuevo, creado_por)
    values (new.id, null, coalesce(new.estado, 'Pendiente'), (select auth.uid()));
  elsif new.estado is distinct from old.estado then
    insert into public.historial_estados_pedido (pedido_id, estado_anterior, estado_nuevo, creado_por)
    values (new.id, old.estado, new.estado, (select auth.uid()));
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_registra_historial_estado on public.pedidos;
create trigger pedidos_registra_historial_estado
after insert or update of estado on public.pedidos
for each row execute function public.registrar_historial_estado_pedido();

insert into public.historial_estados_pedido (pedido_id, estado_anterior, estado_nuevo, creado_por, created_at)
select p.id, null, coalesce(p.estado, 'Pendiente'), null, coalesce(p.fecha_creacion, now())
from public.pedidos p
where not exists (select 1 from public.historial_estados_pedido h where h.pedido_id = p.id);
