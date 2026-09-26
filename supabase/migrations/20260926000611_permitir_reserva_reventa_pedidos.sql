-- Al iniciar Producción, los artículos de reventa se reservan en cocina.
-- La función cambiar_estado_pedido_seguro ya emite este tipo de movimiento;
-- permitirlo mantiene trazabilidad sin omitir el control de existencias.
alter table public.movimientos_inventario_sucursal
  drop constraint movimientos_inventario_sucursal_tipo_check;

alter table public.movimientos_inventario_sucursal
  add constraint movimientos_inventario_sucursal_tipo_check
  check (tipo in (
    'produccion', 'transferencia_entrada', 'transferencia_salida',
    'venta_pos', 'ajuste', 'merma', 'devolucion', 'pedido_reserva'
  ));
