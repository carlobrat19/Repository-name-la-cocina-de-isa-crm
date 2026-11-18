import { cargarTodasLasPaginas } from "@/lib/cargar-paginas";
import { exportarExcel } from "@/lib/exportar-excel";
import { supabase } from "@/lib/supabase";

const numero = (valor: number | string | null | undefined) => Number(valor || 0);

export async function exportarFlujoCompleto() {
  const [movimientos, cuentas, pagosFactura, facturas, proveedores, lineasFactura, compras, ingredientes, pedidos, lineasPedido] = await Promise.all([
    cargarTodasLasPaginas((inicio, fin) => supabase.from("movimientos_caja").select("id,tipo,fecha,created_at,categoria,descripcion,monto,cuenta,cuenta_id,cuenta_destino_id,metodo_pago,origen,origen_id,pedido_id").order("fecha").order("created_at").order("id").range(inicio, fin)),
    cargarTodasLasPaginas((inicio, fin) => supabase.from("cuentas_financieras").select("id,nombre,tipo,saldo_inicial,fecha_saldo_inicial,activa,sucursal_id").order("id").range(inicio, fin)),
    cargarTodasLasPaginas((inicio, fin) => supabase.from("pagos_facturas_compra").select("id,factura_id,referencia").order("id").range(inicio, fin)),
    cargarTodasLasPaginas((inicio, fin) => supabase.from("facturas_compra").select("id,numero,fecha,total,impuesto,categoria,estado,proveedor_id,notas").order("id").range(inicio, fin)),
    cargarTodasLasPaginas((inicio, fin) => supabase.from("proveedores_compra").select("id,nombre,nit").order("id").range(inicio, fin)),
    cargarTodasLasPaginas((inicio, fin) => supabase.from("facturas_compra_lineas").select("id,factura_id,compra_ingrediente_id,descripcion,categoria,cantidad,unidad_factura,cantidad_base,monto").order("id").range(inicio, fin)),
    cargarTodasLasPaginas((inicio, fin) => supabase.from("compras_ingredientes").select("id,ingrediente_id,tipo,cantidad,costo_unitario,total,nota,created_at").order("id").range(inicio, fin)),
    cargarTodasLasPaginas((inicio, fin) => supabase.from("ingredientes").select("id,nombre,unidad_base").order("id").range(inicio, fin)),
    cargarTodasLasPaginas((inicio, fin) => supabase.from("pedidos").select("id,codigo,cliente,telefono").order("id").range(inicio, fin)),
    cargarTodasLasPaginas((inicio, fin) => supabase.from("pedido_detalle").select("pedido_id,cantidad,precio,productos(nombre)").order("id").range(inicio, fin)),
  ]);
  const fallo = [movimientos, cuentas, pagosFactura, facturas, proveedores, lineasFactura, compras, ingredientes, pedidos, lineasPedido].find((respuesta) => respuesta.error);
  if (fallo?.error) throw new Error(fallo.error.message);

  const cuentaId = new Map(cuentas.data.map((item) => [item.id, item]));
  const pagoId = new Map(pagosFactura.data.map((item) => [item.id, item]));
  const facturaId = new Map(facturas.data.map((item) => [item.id, item]));
  const proveedorId = new Map(proveedores.data.map((item) => [item.id, item]));
  const lineaPorCompra = new Map(lineasFactura.data.filter((item) => item.compra_ingrediente_id).map((item) => [item.compra_ingrediente_id, item]));
  const compraId = new Map(compras.data.map((item) => [item.id, item]));
  const ingredienteId = new Map(ingredientes.data.map((item) => [item.id, item]));
  const pedidoId = new Map(pedidos.data.map((item) => [item.id, item]));
  const movimientosEnriquecidos = movimientos.data.map((item) => {
    const pago = item.origen === "factura_compra" ? pagoId.get(item.origen_id || "") : undefined;
    const linea = item.origen === "compra_ingrediente" ? lineaPorCompra.get(item.origen_id || "") : undefined;
    const factura = facturaId.get(pago?.factura_id || linea?.factura_id || "");
    const proveedor = proveedorId.get(factura?.proveedor_id || "");
    const compra = item.origen === "compra_ingrediente" ? compraId.get(item.origen_id || "") : undefined;
    const ingrediente = ingredienteId.get(compra?.ingrediente_id || "");
    const pedido = pedidoId.get(item.pedido_id || "");
    return { ...item, pago, factura, proveedor, compra, ingrediente, pedido };
  });
  const estados = cuentas.data.flatMap((cuenta) => {
    let saldo = numero(cuenta.saldo_inicial);
    return movimientosEnriquecidos.filter((item) =>
      (item.cuenta_id === cuenta.id || item.cuenta_destino_id === cuenta.id)
      && (!cuenta.fecha_saldo_inicial || (item.fecha || "").slice(0, 10) >= cuenta.fecha_saldo_inicial),
    ).map((item) => {
      const entrada = item.cuenta_destino_id === cuenta.id || (item.cuenta_id === cuenta.id && item.tipo === "Ingreso") ? numero(item.monto) : 0;
      const salida = item.cuenta_id === cuenta.id && item.tipo !== "Ingreso" ? numero(item.monto) : 0;
      saldo = Math.round((saldo + entrada - salida) * 100) / 100;
      return { id_cuenta: cuenta.id, cuenta: cuenta.nombre, tipo_cuenta: cuenta.tipo, fecha: (item.fecha || "").slice(0, 10), hora_registro: item.created_at ? new Date(item.created_at).toLocaleTimeString("es-GT", { timeZone: "America/Guatemala", hour12: false }) : "", tipo: item.tipo, categoria: item.categoria || "", descripcion: item.descripcion || "", entrada_Q: entrada, salida_Q: salida, saldo_Q: saldo, cuenta_contraparte: cuentaId.get(item.cuenta_id === cuenta.id ? item.cuenta_destino_id || "" : item.cuenta_id || "")?.nombre || "", medio_pago: item.metodo_pago || "", origen: item.origen || "manual", factura: item.factura?.numero || "", proveedor: item.proveedor?.nombre || "", nit_proveedor: item.proveedor?.nit || "", referencia: item.pago?.referencia || "", ingrediente: item.ingrediente?.nombre || "", cantidad_ingrediente: item.compra ? numero(item.compra.cantidad) : null, pedido: item.pedido?.codigo || "", cliente: item.pedido?.cliente || "", id_movimiento: item.id, id_origen: item.origen_id || "" };
    });
  });
  const ultimoSaldo = new Map<string, number>();
  for (const cuenta of cuentas.data) ultimoSaldo.set(cuenta.id, numero(cuenta.saldo_inicial));
  for (const fila of estados) ultimoSaldo.set(fila.id_cuenta, fila.saldo_Q);

  exportarExcel("flujo-caja-completo-la-cocina-de-isa", [
    { nombre: "Cuentas", filas: cuentas.data.map((item) => ({ cuenta: item.nombre, tipo: item.tipo, activa: item.activa, fecha_base: item.fecha_saldo_inicial, saldo_inicial_Q: numero(item.saldo_inicial), saldo_actual_Q: ultimoSaldo.get(item.id) ?? numero(item.saldo_inicial), caja_sucursal: Boolean(item.sucursal_id), id_cuenta: item.id })) },
    { nombre: "Estados por cuenta", filas: estados },
    { nombre: "Todos los movimientos", filas: movimientosEnriquecidos.map((item) => ({ fecha: (item.fecha || "").slice(0, 10), hora_registro: item.created_at ? new Date(item.created_at).toLocaleTimeString("es-GT", { timeZone: "America/Guatemala", hour12: false }) : "", tipo: item.tipo, categoria: item.categoria || "", descripcion: item.descripcion || "", monto_Q: numero(item.monto), cuenta: cuentaId.get(item.cuenta_id || "")?.nombre || item.cuenta || "", cuenta_destino: cuentaId.get(item.cuenta_destino_id || "")?.nombre || "", medio_pago: item.metodo_pago || "", origen: item.origen || "manual", factura: item.factura?.numero || "", proveedor: item.proveedor?.nombre || "", nit_proveedor: item.proveedor?.nit || "", referencia: item.pago?.referencia || "", ingrediente: item.ingrediente?.nombre || "", cantidad_ingrediente: item.compra ? numero(item.compra.cantidad) : null, pedido: item.pedido?.codigo || "", cliente: item.pedido?.cliente || "", telefono: item.pedido?.telefono || "", id_movimiento: item.id, id_origen: item.origen_id || "" })) },
    { nombre: "Facturas de compra", filas: facturas.data.map((item) => ({ numero: item.numero || "", fecha: item.fecha, proveedor: proveedorId.get(item.proveedor_id)?.nombre || "", nit_proveedor: proveedorId.get(item.proveedor_id)?.nit || "", categoria: item.categoria, estado: item.estado, total_Q: numero(item.total), impuesto_Q: numero(item.impuesto), notas: item.notas || "", id_factura: item.id })) },
    { nombre: "Articulos de facturas", filas: lineasFactura.data.map((item) => ({ factura: facturaId.get(item.factura_id)?.numero || "", proveedor: proveedorId.get(facturaId.get(item.factura_id)?.proveedor_id || "")?.nombre || "", articulo: item.descripcion, categoria: item.categoria, cantidad: item.cantidad === null ? null : numero(item.cantidad), unidad: item.unidad_factura || "", cantidad_base: item.cantidad_base === null ? null : numero(item.cantidad_base), total_linea_Q: numero(item.monto), id_compra_ingrediente: item.compra_ingrediente_id || "", id_linea: item.id })) },
    { nombre: "Compras e inventario", filas: compras.data.map((item) => ({ fecha_registro: item.created_at || "", tipo: item.tipo, ingrediente: ingredienteId.get(item.ingrediente_id)?.nombre || "", cantidad: numero(item.cantidad), unidad: ingredienteId.get(item.ingrediente_id)?.unidad_base || "", costo_unitario_Q: numero(item.costo_unitario), total_Q: numero(item.total), nota: item.nota || "", factura: facturaId.get(lineaPorCompra.get(item.id)?.factura_id || "")?.numero || "", id_compra: item.id })) },
    { nombre: "Articulos de pedidos", filas: lineasPedido.data.map((item) => { const producto = Array.isArray(item.productos) ? item.productos[0] : item.productos; return { pedido: pedidoId.get(item.pedido_id)?.codigo || "", cliente: pedidoId.get(item.pedido_id)?.cliente || "", telefono: pedidoId.get(item.pedido_id)?.telefono || "", producto: producto?.nombre || "", cantidad: numero(item.cantidad), precio_unitario_Q: numero(item.precio), subtotal_Q: numero(item.cantidad) * numero(item.precio) }; }) },
  ]);
  return { movimientos: movimientos.data.length, cuentas: cuentas.data.length };
}
