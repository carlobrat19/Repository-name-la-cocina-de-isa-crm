-- Un pedido cancelado se conserva para auditoría, pero ya no representa una
-- producción ni una cuenta por cobrar. Esta normalización aplica tanto a
-- cancelaciones nuevas como a las que se registraron antes de este ajuste.
create or replace function private.normalizar_pedido_cancelado()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if lower(coalesce(new.estado, '')) in ('cancelado', 'anulado')
     and lower(coalesce(old.estado, '')) not in ('cancelado', 'anulado') then
    new.saldo_pendiente := 0;
    new.pago_estado := 'Anulado';
    new.estado_pago := 'Anulado';
  end if;

  return new;
end;
$$;

drop trigger if exists pedidos_normaliza_cancelacion on public.pedidos;
create trigger pedidos_normaliza_cancelacion
before update of estado on public.pedidos
for each row execute function private.normalizar_pedido_cancelado();

update public.pedidos
set saldo_pendiente = 0,
    pago_estado = 'Anulado',
    estado_pago = 'Anulado'
where lower(coalesce(estado, '')) in ('cancelado', 'anulado')
  and (
    coalesce(saldo_pendiente, 0) <> 0
    or coalesce(pago_estado, '') <> 'Anulado'
    or coalesce(estado_pago, '') <> 'Anulado'
  );
