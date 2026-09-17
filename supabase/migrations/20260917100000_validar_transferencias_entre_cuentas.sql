-- Una transferencia siempre debe tener origen y destino distintos. De esta
-- forma el movimiento reduce una cuenta y aumenta otra sin afectar ingresos
-- ni gastos del negocio.
alter table public.movimientos_caja
  drop constraint if exists movimientos_caja_transferencia_cuentas_distintas;

alter table public.movimientos_caja
  add constraint movimientos_caja_transferencia_cuentas_distintas
  check (
    cuenta_destino_id is null
    or (cuenta_id is not null and cuenta_id is distinct from cuenta_destino_id)
  );
