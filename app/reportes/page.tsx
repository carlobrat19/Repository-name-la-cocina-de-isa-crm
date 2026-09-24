"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, CircleDollarSign, Download, FileCheck2, ReceiptText, RefreshCw, TrendingUp, UsersRound } from "lucide-react";
import * as XLSX from "xlsx";

import { moneda } from "@/lib/crm";
import { supabase } from "@/lib/supabase";
import TendenciasReportes from "./tendencias";

type Pedido = { id: string; codigo: string | null; total: number | string | null; saldo_pendiente: number | string | null; estado: string | null; vendedor: string | null; canal_origen: string | null; cliente_id: string | null; fecha_creacion: string; fecha_pedido: string | null; requiere_envio: boolean | null; entrega_mensajero: boolean | null; costo_envio: number | string | null };
type Pago = { pedido_id: string | null; monto: number | string | null; fecha: string | null; metodo: string | null };
type Cliente = { id: string; nombre: string; created_at: string };
type ProductoDetalle = { pedido_id: string; producto_id: string | null; cantidad: number | string | null; precio: number | string | null; costo: number | string | null; productos: { nombre: string | null; categoria: string | null } | null };
type Receta = { producto_id: string | null; rendimiento: number | string | null; iva_pct: number | string | null; comision_canal_pct: number | string | null; receta_ingredientes: { cantidad: number | string | null; ingredientes: { costo_referencia: number | string | null } | null }[] };
type Ingrediente = { nombre: string; stock_actual: number | string | null; costo_referencia: number | string | null; unidad_base: string };
type Factura = { estado: string | null; total: number | string | null; emitida_at: string | null; created_at: string };

const numero = (valor: number | string | null | undefined) => Number(valor || 0);
const fechaLocal = (valor: string | null | undefined) => valor ? valor.slice(0, 10) : "";
const esFacturaEmitida = (estado: string | null) => /emitida|facturada|certificada/i.test(estado || "");
const esAnulado = (estado: string | null) => /cancelado|anulado/i.test(estado || "");
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
  const [vista, setVista] = useState<"resumen" | "tendencias">("resumen");
  const [pedidos, setPedidos] = useState<Pedido[]>([]); const [pagos, setPagos] = useState<Pago[]>([]); const [clientes, setClientes] = useState<Cliente[]>([]);
  const [detalles, setDetalles] = useState<ProductoDetalle[]>([]); const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]); const [facturas, setFacturas] = useState<Factura[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [desde, setDesde] = useState(""); const [hasta, setHasta] = useState(""); const [canal, setCanal] = useState("Todos"); const [estado, setEstado] = useState("Todos"); const [tipoEntrega, setTipoEntrega] = useState("Todos");
  const [cargando, setCargando] = useState(true); const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    const [pedidosRes, pagosRes, clientesRes, detallesRes, ingredientesRes, facturasRes, recetasRes] = await Promise.all([
      supabase.from("pedidos").select("id,codigo,total,saldo_pendiente,estado,vendedor,canal_origen,cliente_id,fecha_creacion,fecha_pedido,requiere_envio,entrega_mensajero,costo_envio").order("fecha_creacion", { ascending: false }).limit(2000),
      supabase.from("pagos").select("pedido_id,monto,fecha,metodo").order("fecha", { ascending: false }).limit(2000),
      supabase.from("clientes").select("id,nombre,created_at").order("created_at", { ascending: false }).limit(2000),
      supabase.from("pedido_detalle").select("pedido_id,producto_id,cantidad,precio,costo,productos(nombre,categoria)").limit(5000),
      supabase.from("ingredientes").select("nombre,stock_actual,costo_referencia,unidad_base").eq("activo", true).order("nombre"),
      supabase.from("facturas").select("estado,total,emitida_at,created_at").order("created_at", { ascending: false }).limit(2000),
      supabase.from("recetas_estandar").select("producto_id,rendimiento,iva_pct,comision_canal_pct,receta_ingredientes(cantidad,ingredientes(costo_referencia))").eq("activa", true),
    ]);
    const problema = pedidosRes.error || pagosRes.error || clientesRes.error || detallesRes.error || ingredientesRes.error || facturasRes.error || recetasRes.error;
    if (problema) setError(`No se pudieron cargar todos los reportes: ${problema.message}`);
    setPedidos((pedidosRes.data || []) as Pedido[]); setPagos((pagosRes.data || []) as Pago[]); setClientes((clientesRes.data || []) as Cliente[]);
    setDetalles((detallesRes.data || []) as unknown as ProductoDetalle[]); setIngredientes((ingredientesRes.data || []) as Ingrediente[]); setFacturas((facturasRes.data || []) as Factura[]); setRecetas((recetasRes.data || []) as unknown as Receta[]); setCargando(false);
  }, []);

  useEffect(() => { const temporizador = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(temporizador); }, [cargar]);

  const pedidosValidos = useMemo(() => pedidos.filter((pedido) => !esAnulado(pedido.estado)), [pedidos]);
  const canales = useMemo(() => Array.from(new Set(pedidosValidos.map((pedido) => pedido.canal_origen || "Manual"))).sort(), [pedidosValidos]);
  const estados = useMemo(() => Array.from(new Set(pedidosValidos.map((pedido) => pedido.estado || "Sin estado"))).sort(), [pedidosValidos]);
  const pedidosFiltrados = useMemo(() => pedidosValidos.filter((pedido) => { const coincideEntrega = tipoEntrega === "Todos" || (tipoEntrega === "Mensajería externa" ? pedido.requiere_envio && pedido.entrega_mensajero : tipoEntrega === "Nuestro equipo" ? pedido.requiere_envio && !pedido.entrega_mensajero : !pedido.requiere_envio); return enRango(pedido.fecha_pedido || pedido.fecha_creacion, desde, hasta) && (canal === "Todos" || (pedido.canal_origen || "Manual") === canal) && (estado === "Todos" || (pedido.estado || "Sin estado") === estado) && coincideEntrega; }), [pedidosValidos, desde, hasta, canal, estado, tipoEntrega]);
  const idsPedidos = useMemo(() => new Set(pedidosFiltrados.map((pedido) => pedido.id)), [pedidosFiltrados]);
  const detallesFiltrados = useMemo(() => detalles.filter((detalle) => idsPedidos.has(detalle.pedido_id)), [detalles, idsPedidos]);
  const totalVendido = pedidosFiltrados.reduce((suma, pedido) => suma + numero(pedido.total), 0);
  const saldoPendiente = pedidosFiltrados.reduce((suma, pedido) => suma + numero(pedido.saldo_pendiente), 0);
  const cobrado = pagos.filter((pago) => Boolean(pago.pedido_id) && idsPedidos.has(pago.pedido_id as string) && enRango(pago.fecha, desde, hasta)).reduce((suma, pago) => suma + numero(pago.monto), 0);
  const clientesConCompra = new Set(pedidosFiltrados.map((pedido) => pedido.cliente_id).filter(Boolean)).size;
  const ventasProductos = detallesFiltrados.reduce((suma, detalle) => suma + numero(detalle.cantidad) * numero(detalle.precio), 0);
  const costoHistorico = detallesFiltrados.reduce((suma, detalle) => suma + numero(detalle.cantidad) * numero(detalle.costo), 0);
  const margenBruto = ventasProductos - costoHistorico;
  const margenesConReceta = useMemo(() => {
    const recetasPorProducto = new Map(recetas.filter((receta) => receta.producto_id).map((receta) => [receta.producto_id, receta]));
    return detallesFiltrados.reduce((totales, detalle) => {
      const receta = recetasPorProducto.get(detalle.producto_id);
      if (!receta) return totales;
      const cantidad = numero(detalle.cantidad);
      const ventaSinIva = cantidad * numero(detalle.precio) / (1 + numero(receta.iva_pct));
      const comision = ventaSinIva * numero(receta.comision_canal_pct);
      const costoIngredientes = receta.receta_ingredientes.reduce((total, linea) => total + numero(linea.cantidad) * numero(linea.ingredientes?.costo_referencia), 0) / Math.max(0.001, numero(receta.rendimiento));
      totales.ventaSinIva += ventaSinIva;
      totales.costoProduccion += cantidad * numero(detalle.costo);
      totales.costoIngredientes += cantidad * costoIngredientes;
      totales.comision += comision;
      totales.lineas += 1;
      return totales;
    }, { ventaSinIva: 0, costoProduccion: 0, costoIngredientes: 0, comision: 0, lineas: 0 });
  }, [detallesFiltrados, recetas]);
  const gananciaCostoCompleto = margenesConReceta.ventaSinIva - margenesConReceta.comision - margenesConReceta.costoProduccion;
  const gananciaIngredientes = margenesConReceta.ventaSinIva - margenesConReceta.comision - margenesConReceta.costoIngredientes;
  const porcentajeMargen = (ganancia: number) => margenesConReceta.ventaSinIva ? `${(ganancia / margenesConReceta.ventaSinIva * 100).toFixed(1)}%` : "—";
  const ticketPromedio = pedidosFiltrados.length ? totalVendido / pedidosFiltrados.length : 0;
  const pedidosMensajeria = pedidosFiltrados.filter((pedido) => pedido.requiere_envio && pedido.entrega_mensajero);
  const envioCobradoMensajeria = pedidosMensajeria.reduce((suma, pedido) => suma + numero(pedido.costo_envio), 0);
  const productosResumen = useMemo(() => Object.values(detallesFiltrados.reduce<Record<string, { clave: string; producto: string; categoria: string; cantidad: number; venta: number; costo: number }>>((acumulado, detalle) => {
    const producto = detalle.productos?.nombre || "Producto sin nombre"; const clave = detalle.producto_id || `${producto}::${detalle.productos?.categoria || "Sin categoría"}`;
    const actual = acumulado[clave] || { clave, producto, categoria: detalle.productos?.categoria || "Sin categoría", cantidad: 0, venta: 0, costo: 0 };
    actual.cantidad += numero(detalle.cantidad); actual.venta += numero(detalle.cantidad) * numero(detalle.precio); actual.costo += numero(detalle.cantidad) * numero(detalle.costo); acumulado[clave] = actual; return acumulado;
  }, {})).sort((a, b) => b.venta - a.venta), [detallesFiltrados]);
  const productoMasGanador = useMemo(() => productosResumen.reduce<(typeof productosResumen)[number] | null>((mejor, producto) => !mejor || producto.venta - producto.costo > mejor.venta - mejor.costo ? producto : mejor, null), [productosResumen]);
  const responsablesResumen = useMemo(() => Object.values(pedidosFiltrados.reduce<Record<string, { nombre: string; pedidos: number; ventas: number }>>((acumulado, pedido) => {
    const nombre = pedido.vendedor?.trim() || "Sin responsable";
    const clave = nombre.toLocaleLowerCase("es");
    const actual = acumulado[clave] || { nombre, pedidos: 0, ventas: 0 };
    actual.pedidos += 1; actual.ventas += numero(pedido.total); acumulado[clave] = actual; return acumulado;
  }, {})).sort((a, b) => b.pedidos - a.pedidos || b.ventas - a.ventas), [pedidosFiltrados]);
  const porCanal = useMemo(() => Object.entries(pedidosFiltrados.reduce<Record<string, number>>((acumulado, pedido) => { const clave = pedido.canal_origen || "Manual"; acumulado[clave] = (acumulado[clave] || 0) + numero(pedido.total); return acumulado; }, {})).sort((a, b) => b[1] - a[1]), [pedidosFiltrados]);
  const porEstado = useMemo(() => Object.entries(pedidosFiltrados.reduce<Record<string, number>>((acumulado, pedido) => { const clave = pedido.estado || "Sin estado"; acumulado[clave] = (acumulado[clave] || 0) + 1; return acumulado; }, {})).sort((a, b) => b[1] - a[1]), [pedidosFiltrados]);
  const antiguedad = useMemo(() => pedidosValidos.filter((pedido) => numero(pedido.saldo_pendiente) > 0).reduce<Record<string, number>>((acumulado, pedido) => { const dias = diasDesde(pedido.fecha_pedido || pedido.fecha_creacion); const tramo = dias <= 30 ? "0–30 días" : dias <= 60 ? "31–60 días" : dias <= 90 ? "61–90 días" : "+90 días"; acumulado[tramo] = (acumulado[tramo] || 0) + numero(pedido.saldo_pendiente); return acumulado; }, { "0–30 días": 0, "31–60 días": 0, "61–90 días": 0, "+90 días": 0 }), [pedidosValidos]);
  const clientesNuevos = clientes.filter((cliente) => enRango(cliente.created_at, desde, hasta)).length;
  const clientesRecurrentes = Array.from(new Set(pedidosFiltrados.map((pedido) => pedido.cliente_id).filter(Boolean))).filter((id) => pedidosFiltrados.filter((pedido) => pedido.cliente_id === id).length > 1).length;
  const ingredientesSinStock = ingredientes.filter((ingrediente) => numero(ingrediente.stock_actual) <= 0); const valorInventario = ingredientes.reduce((suma, ingrediente) => suma + numero(ingrediente.stock_actual) * numero(ingrediente.costo_referencia), 0);
  const facturasRango = facturas.filter((factura) => enRango(factura.emitida_at || factura.created_at, desde, hasta)); const felEmitido = facturasRango.filter((factura) => esFacturaEmitida(factura.estado));

  function exportarExcel() {
    const resumen = [
      { indicador: "Ventas registradas", valor: totalVendido }, { indicador: "Pedidos", valor: pedidosFiltrados.length }, { indicador: "Pedidos por mensajería", valor: pedidosMensajeria.length }, { indicador: "Envío cobrado por mensajería", valor: envioCobradoMensajeria }, { indicador: "Ticket promedio", valor: ticketPromedio }, { indicador: "Cobrado", valor: cobrado }, { indicador: "Saldo por cobrar", valor: saldoPendiente }, { indicador: "Margen bruto estimado (costo histórico)", valor: margenBruto }, { indicador: "Ganancia estimada tras costo completo, IVA y comisión", valor: gananciaCostoCompleto }, { indicador: "Margen sobre costo completo (%)", valor: margenesConReceta.ventaSinIva ? gananciaCostoCompleto / margenesConReceta.ventaSinIva * 100 : null }, { indicador: "Ganancia estimada tras ingredientes, IVA y comisión", valor: gananciaIngredientes }, { indicador: "Margen sobre ingredientes (%)", valor: margenesConReceta.ventaSinIva ? gananciaIngredientes / margenesConReceta.ventaSinIva * 100 : null }, { indicador: "Líneas con receta para márgenes", valor: margenesConReceta.lineas }, { indicador: "Clientes con compra", valor: clientesConCompra }, { indicador: "Facturas FEL emitidas", valor: felEmitido.length },
    ];
    const libro = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), "Resumen");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(productosResumen), "Productos");
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(pedidosFiltrados.map((pedido) => ({ codigo: pedido.codigo, fecha: fechaLocal(pedido.fecha_pedido || pedido.fecha_creacion), cliente_id: pedido.cliente_id, estado: pedido.estado, canal: pedido.canal_origen, tipo_entrega: pedido.requiere_envio ? (pedido.entrega_mensajero ? "Mensajería externa" : "Nuestro equipo") : "Recoger en tienda", costo_envio: numero(pedido.costo_envio), total: numero(pedido.total), saldo_pendiente: numero(pedido.saldo_pendiente) }))), "Pedidos");
    XLSX.writeFile(libro, `reporte-la-cocina-de-isa-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const Barra = ({ etiqueta, valor, maximo = totalVendido, formato = moneda }: { etiqueta: string; valor: number; maximo?: number; formato?: (valor: number) => string }) => <div><div className="mb-1 flex justify-between gap-4 text-sm"><span className="font-semibold text-slate-700">{etiqueta}</span><span className="font-black text-slate-950">{formato(valor)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500" style={{ width: `${maximo ? Math.max(3, Math.min(100, valor / maximo * 100)) : 0}%` }} /></div></div>;

  return <main className="min-h-screen bg-slate-100 px-4 py-7 sm:px-7 lg:px-10"><div className="mx-auto max-w-[1600px]">
    <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-orange-600">Inteligencia comercial</p><h1 className="mt-2 text-4xl font-black text-slate-950">Reportes y control</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">{vista === "resumen" ? "Ventas, clientes, cobranza, rentabilidad, inventario y FEL en un solo lugar. Los pedidos cancelados no se incluyen. Compara el margen bruto histórico con las estimaciones basadas en recetas actuales." : "Analiza la evolución mensual de pedidos y flujo de caja, con un desglose de ingresos y gastos por categoría."}</p></div>{vista === "resumen" && <div className="flex gap-3"><button onClick={exportarExcel} disabled={cargando} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-60"><Download size={17}/> Excel</button><button onClick={() => void cargar()} disabled={cargando} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"><RefreshCw size={17} className={cargando ? "animate-spin" : ""}/>{cargando ? "Actualizando…" : "Actualizar"}</button></div>}</header>
    <nav aria-label="Vistas de reportes" className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><button type="button" onClick={() => setVista("resumen")} aria-current={vista === "resumen" ? "page" : undefined} className={`rounded-xl px-5 py-3 text-sm font-bold ${vista === "resumen" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Resumen actual</button><button type="button" onClick={() => setVista("tendencias")} aria-current={vista === "tendencias" ? "page" : undefined} className={`rounded-xl px-5 py-3 text-sm font-bold ${vista === "tendencias" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Tendencias anuales</button></nav>
    {vista === "tendencias" ? <TendenciasReportes/> : <>
    {error && <p className="mb-5 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 lg:grid-cols-[180px_180px_1fr_1fr_1fr_auto]"><input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} aria-label="Fecha desde" className="rounded-xl border border-slate-200 px-3 py-3 text-sm"/><input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} aria-label="Fecha hasta" className="rounded-xl border border-slate-200 px-3 py-3 text-sm"/><select value={canal} onChange={(event) => setCanal(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm"><option>Todos</option>{canales.map((item) => <option key={item}>{item}</option>)}</select><select value={estado} onChange={(event) => setEstado(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm"><option>Todos</option>{estados.map((item) => <option key={item}>{item}</option>)}</select><select value={tipoEntrega} onChange={(event) => setTipoEntrega(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm"><option value="Todos">Todas las entregas</option><option>Mensajería externa</option><option>Nuestro equipo</option><option>Recoger en tienda</option></select><button onClick={() => { setDesde(""); setHasta(""); setCanal("Todos"); setEstado("Todos"); setTipoEntrega("Todos"); }} className="text-sm font-bold text-slate-500 underline">Limpiar</button></div></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Ventas", moneda(totalVendido), `${pedidosFiltrados.length} pedidos`, BarChart3, "bg-blue-50 text-blue-800"], ["Cobrado", moneda(cobrado), "Pagos del período", CircleDollarSign, "bg-emerald-50 text-emerald-800"], ["Por cobrar", moneda(saldoPendiente), "Saldos del período", ReceiptText, "bg-amber-50 text-amber-800"], ["Margen bruto estimado", moneda(margenBruto), `${ventasProductos ? (margenBruto / ventasProductos * 100).toFixed(1) : "0.0"}% · ventas de productos menos costo guardado`, TrendingUp, "bg-violet-50 text-violet-800"],
      ["Ganancia sobre costo completo", margenesConReceta.lineas ? moneda(gananciaCostoCompleto) : "Sin datos", `${porcentajeMargen(gananciaCostoCompleto)} · tras IVA, comisión y costo de producción`, TrendingUp, "bg-emerald-50 text-emerald-800"], ["Ganancia sobre ingredientes", margenesConReceta.lineas ? moneda(gananciaIngredientes) : "Sin datos", `${porcentajeMargen(gananciaIngredientes)} · tras IVA, comisión e ingredientes`, TrendingUp, "bg-teal-50 text-teal-800"],
      ["Ticket promedio", moneda(ticketPromedio), "Valor promedio por pedido", BarChart3, "bg-cyan-50 text-cyan-800"], ["Clientes con compra", clientesConCompra, `${clientesRecurrentes} recurrentes · ${clientesNuevos} nuevos`, UsersRound, "bg-fuchsia-50 text-fuchsia-800"], ["Inventario actual", moneda(valorInventario), `${ingredientesSinStock.length} ingredientes sin stock`, Boxes, "bg-orange-50 text-orange-800"], ["FEL emitido", moneda(felEmitido.reduce((suma, factura) => suma + numero(factura.total), 0)), `${felEmitido.length} documentos emitidos`, FileCheck2, "bg-teal-50 text-teal-800"],
      ["Pedidos por mensajería", pedidosMensajeria.length, "Entrega externa dentro del rango", ReceiptText, "bg-violet-50 text-violet-800"], ["Envío cobrado", moneda(envioCobradoMensajeria), "Solo pedidos por mensajería", CircleDollarSign, "bg-indigo-50 text-indigo-800"],
    ].map(([titulo, valor, detalle, Icono, colores]) => { const Icon = Icono as typeof BarChart3; return <article key={titulo as string} className={`rounded-2xl border border-white p-5 shadow-sm ${colores as string}`}><Icon size={20}/><p className="mt-4 text-xs font-bold uppercase tracking-wide opacity-70">{titulo as string}</p><p className="mt-2 text-2xl font-black">{valor as string | number}</p><p className="mt-1 text-sm opacity-80">{detalle as string}</p></article>; })}</section>
    <p className="mt-3 text-xs text-slate-600">Las dos ganancias nuevas cubren {margenesConReceta.lineas} de {detallesFiltrados.length} líneas de pedido con receta activa. Usan el precio y costo de producción guardados en la venta, pero IVA, comisión e ingredientes de la receta actual; son estimaciones, no utilidad neta contable.</p>
    <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Líderes del período filtrado">
      <article className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Responsable con más pedidos</p>
        <p className="mt-2 text-xl font-black text-slate-950">{responsablesResumen[0]?.nombre || "Sin datos"}</p>
        <p className="mt-1 text-sm text-slate-700">{responsablesResumen[0] ? `${responsablesResumen[0].pedidos} pedidos · ${moneda(responsablesResumen[0].ventas)} en ventas` : "No hay pedidos con estos filtros."}</p>
        <p className="mt-2 text-xs text-slate-500">Cuenta pedidos no cancelados según los filtros. Los pedidos sin vendedor se agrupan como «Sin responsable».</p>
      </article>
      <article className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Producto con mayor ganancia bruta</p>
        <p className="mt-2 text-xl font-black text-slate-950">{productoMasGanador?.producto || "Sin datos"}</p>
        <p className="mt-1 text-sm text-slate-700">{productoMasGanador ? `${moneda(productoMasGanador.venta - productoMasGanador.costo)} de ganancia · ${productoMasGanador.cantidad} unidades` : "No hay productos vendidos con estos filtros."}</p>
        <p className="mt-2 text-xs text-slate-500">Ventas menos costo de producción guardado; no descuenta IVA, comisión ni envío.</p>
      </article>
    </section>
    <section className="mt-6 grid gap-6 xl:grid-cols-2"><article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Ventas por canal</h2><p className="mt-1 text-sm text-slate-500">Origen de los pedidos dentro del rango seleccionado.</p><div className="mt-6 space-y-4">{porCanal.map(([item, valor]) => <Barra key={item} etiqueta={item} valor={valor}/>) || null}{!porCanal.length && <p className="text-sm text-slate-500">Todavía no hay ventas con estos filtros.</p>}</div></article><article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Pedidos por estado</h2><p className="mt-1 text-sm text-slate-500">Control comercial y operativo. Los cancelados y anulados no se incluyen en las cifras financieras.</p><div className="mt-6 space-y-4">{porEstado.map(([item, valor]) => <Barra key={item} etiqueta={item} valor={valor} maximo={Math.max(1, ...porEstado.map(([, cantidad]) => cantidad))} formato={(cantidad) => `${cantidad} pedidos`}/>) || null}{!porEstado.length && <p className="text-sm text-slate-500">No hay pedidos con estos filtros.</p>}</div></article>
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Antigüedad de saldos por cobrar</h2><p className="mt-1 text-sm text-slate-500">Calculada desde la fecha del pedido. No depende de los filtros para no ocultar deudas antiguas.</p><div className="mt-6 space-y-4">{Object.entries(antiguedad).map(([item, valor]) => <Barra key={item} etiqueta={item} valor={valor} maximo={Math.max(1, ...Object.values(antiguedad))}/>)}</div></article>
      <article className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">Productos más vendidos</h2>
        <p className="mt-1 text-sm text-slate-500">{productosResumen.length} productos vendidos con estos filtros, ordenados por ventas. Ganancia bruta con el costo guardado al crear cada pedido.</p>
        <div role="region" aria-label="Lista desplazable de productos vendidos" tabIndex={0} className="mt-5 max-h-[34rem] overflow-auto overscroll-contain rounded-xl border border-slate-100 focus:outline-2 focus:outline-offset-2 focus:outline-orange-500">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 z-10 bg-white text-left text-xs uppercase text-slate-500 shadow-[0_1px_0_#e2e8f0]"><tr><th className="px-3 py-3">Producto</th><th className="px-3 py-3 text-right">Cantidad</th><th className="px-3 py-3 text-right">Ventas</th><th className="px-3 py-3 text-right">Ganancia bruta</th></tr></thead>
            <tbody>{productosResumen.map((producto) => <tr key={producto.clave} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3"><p className="font-bold text-slate-900">{producto.producto}</p><p className="text-xs text-slate-500">{producto.categoria}</p></td><td className="px-3 py-3 text-right">{producto.cantidad}</td><td className="px-3 py-3 text-right font-bold">{moneda(producto.venta)}</td><td className="px-3 py-3 text-right font-bold text-emerald-700">{moneda(producto.venta - producto.costo)}</td></tr>)}{!productosResumen.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">No hay líneas de pedido con estos filtros.</td></tr>}</tbody>
          </table>
        </div>
      </article>
    </section>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Notas para tomar decisiones</h2><div className="mt-4 grid gap-4 md:grid-cols-3"><p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><b>Margen bruto estimado:</b> {moneda(margenBruto)} = venta de productos menos costo de producción guardado al registrar cada pedido. No resta IVA, comisiones ni contempla envío.</p><p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><b>Ganancias comparables:</b> costo completo resta el costo de producción histórico, IVA y comisión estimados. La vista de ingredientes reemplaza ese costo por los insumos de la receta actual; no representa utilidad neta.</p><p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><b>Precisión histórica:</b> para calcular utilidad neta real por venta faltará guardar IVA, comisión y costo real de mensajería en cada pedido. FEL y el libro de IVA requieren control fiscal aparte.</p></div></section>
    </>}
  </div></main>;
}
