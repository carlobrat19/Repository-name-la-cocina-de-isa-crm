"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, CircleDollarSign, Download, FileCheck2, ReceiptText, RefreshCw, TrendingUp, UsersRound } from "lucide-react";
import * as XLSX from "xlsx";

import { moneda } from "@/lib/crm";
import { supabase } from "@/lib/supabase";

type Pedido = { id: string; codigo: string | null; total: number | string | null; saldo_pendiente: number | string | null; estado: string | null; vendedor: string | null; canal_origen: string | null; cliente_id: string | null; fecha_creacion: string; fecha_pedido: string | null };
type Pago = { monto: number | string | null; fecha: string | null; metodo: string | null };
type Cliente = { id: string; nombre: string; created_at: string };
type ProductoDetalle = { pedido_id: string; cantidad: number | string | null; precio: number | string | null; productos: { nombre: string | null; categoria: string | null; costo: number | string | null } | null };
type Ingrediente = { nombre: string; stock_actual: number | string | null; costo_referencia: number | string | null; unidad_base: string };
type Factura = { estado: string | null; total: number | string | null; emitida_at: string | null; created_at: string };

const numero = (valor: number | string | null | undefined) => Number(valor || 0);
const fechaLocal = (valor: string | null | undefined) => valor ? valor.slice(0, 10) : "";
const esFacturaEmitida = (estado: string | null) => /emitida|facturada|certificada/i.test(estado || "");
const enRango = (valor: string | null | undefined, desde: string, hasta: string) => {
  const fecha = fechaLocal(valor);
  return Boolean(fecha) && (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
};
const diasDesde = (valor: string | null | undefined) => {
  const fecha = fechaLocal(valor);
  if (!fecha) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(`${fecha}T12:00:00`).getTime()) / 86_400_000));
};

export default function ReportesPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]); const [pagos, setPagos] = useState<Pago[]>([]); const [clientes, setClientes] = useState<Cliente[]>([]);
  const [detalles, setDetalles] = useState<ProductoDetalle[]>([]); const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]); const [facturas, setFacturas] = useState<Factura[]>([]);
  const [desde, setDesde] = useState(""); const [hasta, setHasta] = useState(""); const [canal, setCanal] = useState("Todos"); const [estado, setEstado] = useState("Todos");
  const [cargando, setCargando] = useState(true); const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    const [pedidosRes, pagosRes, clientesRes, detallesRes, ingredientesRes, facturasRes] = await Promise.all([
      supabase.from("pedidos").select("id,codigo,total,saldo_pendiente,estado,vendedor,canal_origen,cliente_id,fecha_creacion,fecha_pedido").order("fecha_creacion", { ascending: false }).limit(2000),
      supabase.from("pagos").select("monto,fecha,metodo").order("fecha", { ascending: false }).limit(2000),
      supabase.from("clientes").select("id,nombre,created_at").order("created_at", { ascending: false }).limit(2000),
      supabase.from("pedido_detalle").select("pedido_id,cantidad,precio,productos(nombre,categoria,costo)").limit(5000),
      supabase.from("ingredientes").select("nombre,stock_actual,costo_referencia,unidad_base").eq("activo", true).order("nombre"),
      supabase.from("facturas").select("estado,total,emitida_at,created_at").order("created_at", { ascending: false }).limit(2000),
    ]);
    const problema = pedidosRes.error || pagosRes.error || clientesRes.error || detallesRes.error || ingredientesRes.error || facturasRes.error;
    if (problema) setError(`No se pudieron cargar todos los reportes: ${problema.message}`);
    setPedidos((pedidosRes.data || []) as Pedido[]); setPagos((pagosRes.data || []) as Pago[]); setClientes((clientesRes.data || []) as Cliente[]);
    setDetalles((detallesRes.data || []) as unknown as ProductoDetalle[]); setIngredientes((ingredientesRes.data || []) as Ingrediente[]); setFacturas((facturasRes.data || []) as Factura[]); setCargando(false);
  }, []);

  useEffect(() => { const temporizador = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(temporizador); }, [cargar]);

  const canales = useMemo(() => Array.from(new Set(pedidos.map((pedido) => pedido.canal_origen || "Manual"))).sort(), [pedidos]);
  const estados = useMemo(() => Array.from(new Set(pedidos.map((pedido) => pedido.estado || "Sin estado"))).sort(), [pedidos]);
  const pedidosFiltrados = useMemo(() => pedidos.filter((pedido) => enRango(pedido.fecha_pedido || pedido.fecha_creacion, desde, hasta) && (canal === "Todos" || (pedido.canal_origen || "Manual") === canal) && (estado === "Todos" || (pedido.estado || "Sin estado") === estado)), [pedidos, desde, hasta, canal, estado]);
  const idsPedidos = useMemo(() => new Set(pedidosFiltrados.map((pedido) => pedido.id)), [pedidosFiltrados]);
  const detallesFiltrados = useMemo(() => detalles.filter((detalle) => idsPedidos.has(detalle.pedido_id)), [detalles, idsPedidos]);
  const totalVendido = pedidosFiltrados.reduce((suma, pedido) => suma + numero(pedido.total), 0);
  const saldoPendiente = pedidosFiltrados.reduce((suma, pedido) => suma + numero(pedido.saldo_pendiente), 0);
  const cobrado = pagos.filter((pago) => enRango(pago.fecha, desde, hasta)).reduce((suma, pago) => suma + numero(pago.monto), 0);
  const clientesConCompra = new Set(pedidosFiltrados.map((pedido) => pedido.cliente_id).filter(Boolean)).size;
  const costoEstimado = detallesFiltrados.reduce((suma, detalle) => suma + numero(detalle.cantidad) * numero(detalle.productos?.costo), 0);
  const margenEstimado = totalVendido - costoEstimado;
  const ticketPromedio = pedidosFiltrados.length ? totalVendido / pedidosFiltrados.length : 0;
  const productosResumen = useMemo(() => Object.values(detallesFiltrados.reduce<Record<string, { producto: string; categoria: string; cantidad: number; venta: number; costo: number }>>((acumulado, detalle) => {
    const producto = detalle.productos?.nombre || "Producto sin nombre"; const clave = `${producto}::${detalle.productos?.categoria || "Sin categoría"}`;
    const actual = acumulado[clave] || { producto, categoria: detalle.productos?.categoria || "Sin categoría", cantidad: 0, venta: 0, costo: 0 };
    actual.cantidad += numero(detalle.cantidad); actual.venta += numero(detalle.cantidad) * numero(detalle.precio); actual.costo += numero(detalle.cantidad) * numero(detalle.productos?.costo); acumulado[clave] = actual; return acumulado;
  }, {})).sort((a, b) => b.venta - a.venta).slice(0, 8), [detallesFiltrados]);
  const porCanal = useMemo(() => Object.entries(pedidosFiltrados.reduce<Record<string, number>>((acumulado, pedido) => { const clave = pedido.canal_origen || "Manual"; acumulado[clave] = (acumulado[clave] || 0) + numero(pedido.total); return acumulado; }, {})).sort((a, b) => b[1] - a[1]), [pedidosFiltrados]);
  const porEstado = useMemo(() => Object.entries(pedidosFiltrados.reduce<Record<string, number>>((acumulado, pedido) => { const clave = pedido.estado || "Sin estado"; acumulado[clave] = (acumulado[clave] || 0) + 1; return acumulado; }, {})).sort((a, b) => b[1] - a[1]), [pedidosFiltrados]);
  const antiguedad = useMemo(() => pedidos.filter((pedido) => numero(pedido.saldo_pendiente) > 0).reduce<Record<string, number>>((acumulado, pedido) => { const dias = diasDesde(pedido.fecha_pedido || pedido.fecha_creacion); const tramo = dias <= 30 ? "0–30 días" : dias <= 60 ? "31–60 días" : dias <= 90 ? "61–90 días" : "+90 días"; acumulado[tramo] = (acumulado[tramo] || 0) + numero(pedido.saldo_pendiente); return acumulado; }, { "0–30 días": 0, "31–60 días": 0, "61–90 días": 0, "+90 días": 0 }), [pedidos]);
  const clientesNuevos = clientes.filter((cliente) => enRango(cliente.created_at, desde, hasta)).length;
  const clientesRecurrentes = Array.from(new Set(pedidosFiltrados.map((pedido) => pedido.cliente_id).filter(Boolean))).filter((id) => pedidosFiltrados.filter((pedido) => pedido.cliente_id === id).length > 1).length;
  const ingredientesSinStock = ingredientes.filter((ingrediente) => numero(ingrediente.stock_actual) <= 0); const valorInventario = ingredientes.reduce((suma, ingrediente) => suma + numero(ingrediente.stock_actual) * numero(ingrediente.costo_referencia), 0);
  const facturasRango = facturas.filter((factura) => enRango(factura.emitida_at || factura.created_at, desde, hasta)); const felEmitido = facturasRango.filter((factura) => esFacturaEmitida(factura.estado));

  function exportarExcel() {
    const resumen = [
      { indicador: "Ventas registradas", valor: totalVendido }, { indicador: "Pedidos", valor: pedidosFiltrados.length }, { indicador: "Ticket promedio", valor: ticketPromedio }, { indicador: "Cobrado", valor: cobrado }, { indicador: "Saldo por cobrar", valor: saldoPendiente }, { indicador: "Margen estimado (costo actual)", valor: margenEstimado }, { indicador: "Clientes con compra", valor: clientesConCompra }, { indicador: "Facturas FEL emitidas", valor: felEmitido.length },
    ];
    const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), "Resumen");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(productosResumen), "Productos");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(pedidosFiltrados.map((pedido) => ({ codigo: pedido.codigo, fecha: fechaLocal(pedido.fecha_pedido || pedido.fecha_creacion), cliente_id: pedido.cliente_id, estado: pedido.estado, canal: pedido.canal_origen, total: numero(pedido.total), saldo_pendiente: numero(pedido.saldo_pendiente) }))), "Pedidos");
    XLSX.writeFile(libro, `reporte-la-cocina-de-isa-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const Barra = ({ etiqueta, valor, maximo = totalVendido, formato = moneda }: { etiqueta: string; valor: number; maximo?: number; formato?: (valor: number) => string }) => <div><div className="mb-1 flex justify-between gap-4 text-sm"><span className="font-semibold text-slate-700">{etiqueta}</span><span className="font-black text-slate-950">{formato(valor)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500" style={{ width: `${maximo ? Math.max(3, Math.min(100, valor / maximo * 100)) : 0}%` }} /></div></div>;

  return <main className="min-h-screen bg-slate-100 px-4 py-7 sm:px-7 lg:px-10"><div className="mx-auto max-w-[1600px]">
    <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-orange-600">Inteligencia comercial</p><h1 className="mt-2 text-4xl font-black text-slate-950">Reportes y control</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Ventas, clientes, cobranza, rentabilidad, inventario y FEL en un solo lugar. El margen usa el costo actual de cada producto como estimación.</p></div><div className="flex gap-3"><button onClick={exportarExcel} disabled={cargando} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-60"><Download size={17}/> Excel</button><button onClick={() => void cargar()} disabled={cargando} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"><RefreshCw size={17} className={cargando ? "animate-spin" : ""}/>{cargando ? "Actualizando…" : "Actualizar"}</button></div></header>
    {error && <p className="mb-5 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 lg:grid-cols-[180px_180px_1fr_1fr_auto]"><input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} aria-label="Fecha desde" className="rounded-xl border border-slate-200 px-3 py-3 text-sm"/><input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} aria-label="Fecha hasta" className="rounded-xl border border-slate-200 px-3 py-3 text-sm"/><select value={canal} onChange={(event) => setCanal(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm"><option>Todos</option>{canales.map((item) => <option key={item}>{item}</option>)}</select><select value={estado} onChange={(event) => setEstado(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm"><option>Todos</option>{estados.map((item) => <option key={item}>{item}</option>)}</select><button onClick={() => { setDesde(""); setHasta(""); setCanal("Todos"); setEstado("Todos"); }} className="text-sm font-bold text-slate-500 underline">Limpiar</button></div></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Ventas", moneda(totalVendido), `${pedidosFiltrados.length} pedidos`, BarChart3, "bg-blue-50 text-blue-800"], ["Cobrado", moneda(cobrado), "Pagos del período", CircleDollarSign, "bg-emerald-50 text-emerald-800"], ["Por cobrar", moneda(saldoPendiente), "Saldos del período", ReceiptText, "bg-amber-50 text-amber-800"], ["Margen estimado", moneda(margenEstimado), `${totalVendido ? (margenEstimado / totalVendido * 100).toFixed(1) : "0.0"}% sobre ventas`, TrendingUp, "bg-violet-50 text-violet-800"],
      ["Ticket promedio", moneda(ticketPromedio), "Valor promedio por pedido", BarChart3, "bg-cyan-50 text-cyan-800"], ["Clientes con compra", clientesConCompra, `${clientesRecurrentes} recurrentes · ${clientesNuevos} nuevos`, UsersRound, "bg-fuchsia-50 text-fuchsia-800"], ["Inventario actual", moneda(valorInventario), `${ingredientesSinStock.length} ingredientes sin stock`, Boxes, "bg-orange-50 text-orange-800"], ["FEL emitido", moneda(felEmitido.reduce((suma, factura) => suma + numero(factura.total), 0)), `${felEmitido.length} documentos emitidos`, FileCheck2, "bg-teal-50 text-teal-800"],
    ].map(([titulo, valor, detalle, Icono, colores]) => { const Icon = Icono as typeof BarChart3; return <article key={titulo as string} className={`rounded-2xl border border-white p-5 shadow-sm ${colores as string}`}><Icon size={20}/><p className="mt-4 text-xs font-bold uppercase tracking-wide opacity-70">{titulo as string}</p><p className="mt-2 text-2xl font-black">{valor as string | number}</p><p className="mt-1 text-sm opacity-80">{detalle as string}</p></article>; })}</section>
    <section className="mt-6 grid gap-6 xl:grid-cols-2"><article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Ventas por canal</h2><p className="mt-1 text-sm text-slate-500">Origen de los pedidos dentro del rango seleccionado.</p><div className="mt-6 space-y-4">{porCanal.map(([item, valor]) => <Barra key={item} etiqueta={item} valor={valor}/>) || null}{!porCanal.length && <p className="text-sm text-slate-500">Todavía no hay ventas con estos filtros.</p>}</div></article><article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Pedidos por estado</h2><p className="mt-1 text-sm text-slate-500">Control comercial y operativo.</p><div className="mt-6 space-y-4">{porEstado.map(([item, valor]) => <Barra key={item} etiqueta={item} valor={valor} maximo={Math.max(1, ...porEstado.map(([, cantidad]) => cantidad))} formato={(cantidad) => `${cantidad} pedidos`}/>) || null}{!porEstado.length && <p className="text-sm text-slate-500">No hay pedidos con estos filtros.</p>}</div></article>
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Antigüedad de saldos por cobrar</h2><p className="mt-1 text-sm text-slate-500">Calculada desde la fecha del pedido. No depende de los filtros para no ocultar deudas antiguas.</p><div className="mt-6 space-y-4">{Object.entries(antiguedad).map(([item, valor]) => <Barra key={item} etiqueta={item} valor={valor} maximo={Math.max(1, ...Object.values(antiguedad))}/>)}</div></article><article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Productos más vendidos</h2><p className="mt-1 text-sm text-slate-500">Ventas y margen estimado usando el costo actual del producto.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-500"><tr><th className="pb-3">Producto</th><th className="pb-3 text-right">Cantidad</th><th className="pb-3 text-right">Ventas</th><th className="pb-3 text-right">Margen est.</th></tr></thead><tbody>{productosResumen.map((producto) => <tr key={`${producto.producto}-${producto.categoria}`} className="border-b border-slate-100 last:border-0"><td className="py-3"><p className="font-bold text-slate-900">{producto.producto}</p><p className="text-xs text-slate-500">{producto.categoria}</p></td><td className="py-3 text-right">{producto.cantidad}</td><td className="py-3 text-right font-bold">{moneda(producto.venta)}</td><td className="py-3 text-right font-bold text-emerald-700">{moneda(producto.venta - producto.costo)}</td></tr>)}{!productosResumen.length && <tr><td colSpan={4} className="py-8 text-center text-slate-500">No hay líneas de pedido con estos filtros.</td></tr>}</tbody></table></div></article>
    </section>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Notas para tomar decisiones</h2><div className="mt-4 grid gap-4 md:grid-cols-3"><p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><b>Rentabilidad:</b> Q{margenEstimado.toFixed(2)} es una estimación con el costo actual. Para margen histórico exacto guardaremos el costo al crear cada pedido.</p><p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><b>FEL e impuestos:</b> este tablero controla importes y documentos emitidos; el libro de IVA requerirá guardar base gravada, IVA, exentos, anulaciones y notas de crédito.</p><p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><b>Power BI:</b> la migración crea vistas de solo lectura en el esquema <code>bi</code> para conectar un usuario de base de datos exclusivo para análisis.</p></div></section>
  </div></main>;
}
