"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ChefHat,
  MapPin,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

type Pedido = {
  id: string;
  codigo?: string | null;
  cliente?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  fecha_pedido?: string | null;
  fecha_entrega?: string | null;
  estado?: string | null;
  pago_estado?: string | null;
  forma_pago?: string | null;
  vendedor?: string | null;
  requiere_envio?: boolean | null;
  total?: number | string | null;
};

type Detalle = {
  pedido_id: string;
  producto_id?: string | null;
  cantidad?: number | null;
  precio?: number | string | null;
};

type Producto = { id: string; nombre?: string | null };

const ESTADOS = ["Pendiente", "Producción", "Empaquetado", "En Ruta", "Entregado"];
const PAGOS = ["Pendiente", "Pagado"];

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value?: number | string | null) {
  return `Q${Number(value || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusClass(status?: string | null) {
  const classes: Record<string, string> = {
    Pendiente: "bg-amber-50 text-amber-700 ring-amber-200",
    Producción: "bg-blue-50 text-blue-700 ring-blue-200",
    Empaquetado: "bg-violet-50 text-violet-700 ring-violet-200",
    "En Ruta": "bg-sky-50 text-sky-700 ring-sky-200",
    Entregado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return classes[status || ""] || "bg-slate-100 text-slate-600 ring-slate-200";
}

export default function ListaPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [detalles, setDetalles] = useState<Detalle[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [pago, setPago] = useState("Todos");
  const [vendedor, setVendedor] = useState("Todos");
  const [envio, setEnvio] = useState("Todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  async function cargarPedidos() {
    setLoading(true);
    const [pedidosResult, detallesResult, productosResult] = await Promise.all([
      supabase.from("pedidos").select("*").order("numero_pedido", { ascending: false }),
      supabase.from("pedido_detalle").select("*"),
      supabase.from("productos").select("id, nombre"),
    ]);

    if (pedidosResult.error || detallesResult.error || productosResult.error) {
      console.error(pedidosResult.error || detallesResult.error || productosResult.error);
    }
    setPedidos((pedidosResult.data || []) as Pedido[]);
    setDetalles((detallesResult.data || []) as Detalle[]);
    setProductos((productosResult.data || []) as Producto[]);
    setLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void cargarPedidos(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const productosPorId = useMemo(() => new Map(productos.map((producto) => [producto.id, producto.nombre || "Producto"])), [productos]);
  const detallesPorPedido = useMemo(() => {
    const agrupados = new Map<string, Detalle[]>();
    detalles.forEach((detalle) => agrupados.set(detalle.pedido_id, [...(agrupados.get(detalle.pedido_id) || []), detalle]));
    return agrupados;
  }, [detalles]);

  const vendedores = useMemo(
    () => [...new Set(pedidos.map((pedido) => pedido.vendedor).filter((nombre): nombre is string => Boolean(nombre)))].sort(),
    [pedidos],
  );

  const pedidosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pedidos.filter((pedido) => {
      const coincideTexto = !texto || [pedido.codigo, pedido.cliente, pedido.telefono, pedido.direccion]
        .some((valor) => valor?.toLowerCase().includes(texto));
      const coincideEstado = estado === "Todos" || pedido.estado === estado;
      const coincidePago = pago === "Todos" || pedido.pago_estado === pago;
      const coincideVendedor = vendedor === "Todos" || pedido.vendedor === vendedor;
      const coincideEnvio = envio === "Todos" || (envio === "Con envío" ? pedido.requiere_envio : !pedido.requiere_envio);
      const fecha = pedido.fecha_entrega || pedido.fecha_pedido || "";
      return coincideTexto && coincideEstado && coincidePago && coincideVendedor && coincideEnvio && (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
    });
  }, [pedidos, busqueda, estado, pago, vendedor, envio, desde, hasta]);

  const resumen = useMemo(() => {
    const total = pedidosFiltrados.reduce((acumulado, pedido) => acumulado + Number(pedido.total || 0), 0);
    return {
      total,
      pendientes: pedidosFiltrados.filter((pedido) => pedido.estado !== "Entregado").length,
      porCobrar: pedidosFiltrados.filter((pedido) => pedido.pago_estado !== "Pagado").reduce((acumulado, pedido) => acumulado + Number(pedido.total || 0), 0),
      entregas: pedidosFiltrados.filter((pedido) => pedido.requiere_envio).length,
    };
  }, [pedidosFiltrados]);

  const hayFiltros = Boolean(busqueda || estado !== "Todos" || pago !== "Todos" || vendedor !== "Todos" || envio !== "Todos" || desde || hasta);
  const limpiarFiltros = () => { setBusqueda(""); setEstado("Todos"); setPago("Todos"); setVendedor("Todos"); setEnvio("Todos"); setDesde(""); setHasta(""); };
  const filtrarPeriodo = (dias: number) => {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - dias);
    setDesde(inicio.toISOString().slice(0, 10));
    setHasta(hoy.toISOString().slice(0, 10));
  };

  return (
    <main className="min-h-screen bg-[#f7f7f8] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Operación comercial</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Pedidos</h1>
            <p className="mt-1 text-sm text-slate-500">Controla ventas, entregas, pagos y producción desde una sola vista.</p>
          </div>
          <Link href="/pedidos" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:bg-orange-600">
            <Plus className="h-4 w-4" /> Nuevo pedido
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Pedidos visibles", `${pedidosFiltrados.length}`, PackageCheck, "text-slate-900 bg-white"],
            ["Total de ventas", formatMoney(resumen.total), CircleDollarSign, "text-emerald-700 bg-emerald-50"],
            ["Pendientes de gestión", `${resumen.pendientes}`, ChefHat, "text-amber-700 bg-amber-50"],
            ["Pendiente de cobro", formatMoney(resumen.porCobrar), Truck, "text-sky-700 bg-sky-50"],
          ].map(([label, value, Icon, tone]) => {
            const CardIcon = Icon as typeof PackageCheck;
            return <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-500">{label as string}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value as string}</p></div><div className={`rounded-xl p-2.5 ${tone as string}`}><CardIcon className="h-5 w-5" /></div></div></div>;
          })}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><div className="rounded-lg bg-orange-50 p-2 text-orange-600"><SlidersHorizontal className="h-4 w-4" /></div><div><h2 className="text-sm font-bold text-slate-900">Filtros inteligentes</h2><p className="text-xs text-slate-500">Combina criterios para encontrar cualquier pedido.</p></div></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => filtrarPeriodo(0)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-orange-300 hover:text-orange-700">Hoy</button>
              <button onClick={() => filtrarPeriodo(6)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-orange-300 hover:text-orange-700">7 días</button>
              <button onClick={() => filtrarPeriodo(29)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-orange-300 hover:text-orange-700">30 días</button>
              {hayFiltros && <button onClick={limpiarFiltros} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"><X className="h-3.5 w-3.5" /> Limpiar</button>}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="relative xl:col-span-2"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por cliente, código, teléfono o dirección" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100" /></label>
            <select value={estado} onChange={(event) => setEstado(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-orange-400"><option>Todos</option>{ESTADOS.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={pago} onChange={(event) => setPago(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-orange-400"><option>Todos</option>{PAGOS.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={vendedor} onChange={(event) => setVendedor(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-orange-400"><option>Todos los vendedores</option>{vendedores.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={envio} onChange={(event) => setEnvio(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-orange-400"><option>Todos los envíos</option><option>Con envío</option><option>Sin envío</option></select>
            <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} aria-label="Entrega desde" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-orange-400" /></label>
            <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} aria-label="Entrega hasta" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-orange-400" /></label>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Resultados</h2><p className="text-xs text-slate-500">{pedidosFiltrados.length} pedido{pedidosFiltrados.length === 1 ? "" : "s"} encontrado{pedidosFiltrados.length === 1 ? "" : "s"}</p></div><button onClick={() => void cargarPedidos()} disabled={loading} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-orange-600 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button></div>
          {loading ? <div className="p-12 text-center text-sm text-slate-500">Cargando pedidos…</div> : pedidosFiltrados.length === 0 ? <div className="p-12 text-center"><PackageCheck className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">No encontramos pedidos con estos filtros.</p><button onClick={limpiarFiltros} className="mt-3 text-sm font-bold text-orange-600">Limpiar filtros</button></div> : <div className="divide-y divide-slate-100">{pedidosFiltrados.map((pedido) => {
            const items = detallesPorPedido.get(pedido.id) || [];
            return <article key={pedido.id} className="group grid gap-4 px-5 py-5 transition hover:bg-orange-50/30 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-600">{pedido.codigo || "SIN CÓDIGO"}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusClass(pedido.estado)}`}>{pedido.estado || "Sin estado"}</span>{pedido.pago_estado === "Pagado" ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">Pagado</span> : <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200">Pendiente de pago</span>}</div><div className="mt-3 flex items-start gap-3"><div className="rounded-xl bg-orange-100 p-2 text-orange-700"><UserRound className="h-4 w-4" /></div><div className="min-w-0"><h3 className="truncate text-base font-black text-slate-950">{pedido.cliente || "Cliente sin nombre"}</h3><p className="mt-0.5 text-sm text-slate-500">{pedido.telefono || "Sin teléfono"}</p>{pedido.direccion && <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 text-orange-500" />{pedido.direccion}</p>}</div></div></div><div className="grid grid-cols-2 gap-x-5 gap-y-3 border-y border-slate-100 py-3 text-sm lg:border-y-0 lg:py-0"><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Entrega</p><p className="mt-1 font-semibold text-slate-700">{formatDate(pedido.fecha_entrega)}</p></div><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Vendedor</p><p className="mt-1 font-semibold text-slate-700">{pedido.vendedor || "Sin asignar"}</p></div><div className="col-span-2"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Productos</p><p className="mt-1 truncate text-sm text-slate-600">{items.length ? items.map((item) => `${item.cantidad || 0}× ${productosPorId.get(item.producto_id || "") || "Producto"}`).join(" · ") : "Sin productos registrados"}</p></div></div><div className="flex items-center justify-between gap-4 lg:flex-col lg:items-end"><div className="text-right"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total</p><p className="mt-1 text-xl font-black text-emerald-600">{formatMoney(pedido.total)}</p><p className="mt-1 text-xs text-slate-500">{pedido.requiere_envio ? "Con envío" : "Recoger en tienda"}</p></div><Link href={`/pedidos/${pedido.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition group-hover:border-orange-300 group-hover:text-orange-700">Ver pedido <ChevronRight className="h-3.5 w-3.5" /></Link></div></article>;
          })}</div>}
        </section>
      </div>
    </main>
  );
}
