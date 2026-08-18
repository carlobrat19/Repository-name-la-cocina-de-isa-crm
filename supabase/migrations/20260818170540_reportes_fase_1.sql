-- Reportes fase 1: lecturas analíticas para el módulo interno y Power BI futuro.
-- Las vistas conservan security_invoker para respetar las políticas RLS existentes.

create policy "modulo reportes ingredientes consulta"
on public.ingredientes for select to authenticated
using (private.tiene_modulo_crm('reportes'));

create policy "modulo reportes compras ingredientes consulta"
on public.compras_ingredientes for select to authenticated
using (private.tiene_modulo_crm('reportes'));

create schema if not exists bi;
revoke all on schema bi from public;

create or replace view bi.pedidos
with (security_invoker = true)
as
select
  p.id as pedido_id,
  p.codigo,
  coalesce(p.fecha_pedido, p.fecha_creacion::date) as fecha_pedido,
  p.fecha_creacion,
  p.fecha_entrega,
  p.estado,
  p.canal_origen,
  p.vendedor,
  p.cliente_id,
  coalesce(c.nombre, p.cliente) as cliente_nombre,
  c.nit as cliente_nit,
  p.subtotal_productos,
  p.costo_envio,
  p.total,
  p.saldo_pendiente,
  p.pago_estado,
  p.forma_pago
from public.pedidos p
left join public.clientes c on c.id = p.cliente_id;

create or replace view bi.detalle_pedidos
with (security_invoker = true)
as
select
  d.id as detalle_id,
  d.pedido_id,
  p.fecha_creacion::date as fecha_pedido,
  p.estado as estado_pedido,
  p.canal_origen,
  d.producto_id,
  producto.nombre as producto_nombre,
  producto.categoria as producto_categoria,
  d.cantidad,
  d.precio as precio_unitario,
  round(d.cantidad * d.precio, 2) as venta_linea,
  producto.costo as costo_unitario_referencia_actual,
  round(d.cantidad * coalesce(producto.costo, 0), 2) as costo_estimado_actual,
  round((d.cantidad * d.precio) - (d.cantidad * coalesce(producto.costo, 0)), 2) as margen_estimado_actual
from public.pedido_detalle d
join public.pedidos p on p.id = d.pedido_id
left join public.productos producto on producto.id = d.producto_id;

create or replace view bi.pagos
with (security_invoker = true)
as
select
  pago.id as pago_id,
  pago.fecha,
  pago.created_at,
  pago.pedido_id,
  pedido.codigo as pedido_codigo,
  pago.cliente_id,
  cliente.nombre as cliente_nombre,
  pago.monto,
  pago.metodo,
  pago.referencia
from public.pagos pago
left join public.pedidos pedido on pedido.id = pago.pedido_id
left join public.clientes cliente on cliente.id = pago.cliente_id;

create or replace view bi.facturas_fel
with (security_invoker = true)
as
select
  f.id as factura_id,
  f.emitida_at,
  f.created_at,
  f.pedido_id,
  p.codigo as pedido_codigo,
  f.cliente_id,
  c.nombre as cliente_nombre,
  c.nit as cliente_nit,
  f.estado,
  f.serie,
  f.numero,
  f.uuid_fel,
  f.total,
  f.proveedor_fel,
  f.error_fel
from public.facturas f
left join public.pedidos p on p.id = f.pedido_id
left join public.clientes c on c.id = f.cliente_id;

revoke all on all tables in schema bi from public, anon;
grant usage on schema bi to authenticated;
grant select on all tables in schema bi to authenticated;

comment on schema bi is 'Vistas analíticas de solo lectura para Power BI. Cree un usuario de base de datos de solo lectura y otorgue acceso únicamente a este esquema antes de conectarlo.';
comment on view bi.detalle_pedidos is 'Los costos y márgenes son estimados usando el costo actual del producto, no el costo histórico al momento de venta.';
