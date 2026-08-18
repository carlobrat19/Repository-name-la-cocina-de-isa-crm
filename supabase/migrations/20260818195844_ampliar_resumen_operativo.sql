-- The operational summary is read-only and uses the existing dashboard permission.
create policy "modulo dashboard detalle pedidos consulta" on public.pedido_detalle for select to authenticated
using (private.tiene_modulo_crm('dashboard'));

create policy "modulo dashboard ingredientes consulta" on public.ingredientes for select to authenticated
using (private.tiene_modulo_crm('dashboard'));

create policy "modulo dashboard facturas consulta" on public.facturas for select to authenticated
using (private.tiene_modulo_crm('dashboard'));

create policy "modulo dashboard caja consulta" on public.movimientos_caja for select to authenticated
using (private.tiene_modulo_crm('dashboard'));
