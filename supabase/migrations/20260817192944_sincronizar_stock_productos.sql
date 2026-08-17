create or replace function public.sincronizar_stock_producto_desde_movimiento()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.productos
  set stock = greatest(0, coalesce(stock, 0) + new.cantidad::integer)
  where id = new.producto_id;
  return new;
end;
$$;

drop trigger if exists movimientos_inventario_sincroniza_stock on public.movimientos_inventario;
create trigger movimientos_inventario_sincroniza_stock
after insert on public.movimientos_inventario
for each row execute function public.sincronizar_stock_producto_desde_movimiento();
