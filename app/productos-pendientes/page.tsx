"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const ETAPAS = ["Pendiente", "Producción", "Empaquetado", "En Ruta", "Entregado"] as const;
type Etapa = (typeof ETAPAS)[number];
type Detalle = { producto_id: string | null; cantidad: number | string | null; productos: { nombre: string | null; categoria: string | null } | null };
type Pedido = { id: string; codigo: string | null; cliente_id: string | null; cliente: string | null; fecha_entrega: string | null; estado: string | null; vendedor: string | null; requiere_envio: boolean | null; entrega_mensajero: boolean | null; pedido_detalle: Detalle[] | null };
type Resumen = { clave: string; nombre: string; categoria: string | null; total: number; porEtapa: Record<Etapa, number>; proximaEntrega: string | null; pedidos: number };
type ResumenDiario = { clave: string; nombre: string; categoria: string | null; porFecha: Record<string, number>; total: number };
type ClienteDiario = { clave: string; nombre: string; pedidos: Pedido[]; productos: Map<string, { nombre: string; cantidad: number }>; unidades: number };
type DiaEntrega = { fecha: string; pedidos: Pedido[]; clientes: ClienteDiario[]; unidades: number };
const estilo: Record<Etapa, string> = { Pendiente: "border-amber-200 bg-amber-50 text-amber-800", Producción: "border-blue-200 bg-blue-50 text-blue-800", Empaquetado: "border-violet-200 bg-violet-50 text-violet-800", "En Ruta": "border-orange-200 bg-orange-50 text-orange-800", Entregado: "border-emerald-200 bg-emerald-50 text-emerald-800" };
const estadoPedido = (estado: string | null): Etapa => ETAPAS.includes(estado as Etapa) ? estado as Etapa : "Pendiente";
const fechaHumana = (fecha: string | null) => fecha ? new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${fecha}T12:00:00`)) : "Sin fecha";
const fechaCorta = (fecha: string) => fecha === "Sin fecha" ? fecha : new Intl.DateTimeFormat("es-GT", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${fecha}T12:00:00`));
const hoyGuatemala = () => {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value || "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
};
const claveProducto = (detalle: Detalle) => detalle.producto_id || `sin-id:${detalle.productos?.nombre || "Producto eliminado"}`;
const detallesVisibles = (pedido: Pedido, productoFiltro: string) => (pedido.pedido_detalle || []).filter((detalle) => productoFiltro === "Todos" || detalle.producto_id === productoFiltro);
const fechaPedido = (pedido: Pedido) => pedido.fecha_entrega?.slice(0, 10) || "Sin fecha";

export default function ProductosPendientesPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]); const [cargando, setCargando] = useState(true); const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState(""); const [fechaInicio, setFechaInicio] = useState(""); const [fechaFin, setFechaFin] = useState("");
  const [estado, setEstado] = useState<Etapa | "Todos">("Pendiente"); const [vendedor, setVendedor] = useState("Todos"); const [envio, setEnvio] = useState("Todos"); const [tipoEntrega, setTipoEntrega] = useState("Todos"); const [productoFiltro, setProductoFiltro] = useState("Todos");
  const [vistaResumen, setVistaResumen] = useState<"producto" | "dia">("producto"); const [vistaDiaria, setVistaDiaria] = useState<"producto" | "cliente">("producto");

  async function cargar() {
    setCargando(true); setError("");
    const todos: Pedido[] = [];
    const tamanoPagina = 500;
    for (let pagina = 0; ; pagina += 1) {
      const { data, error: consultaError } = await supabase.from("pedidos")
        .select("id,codigo,cliente_id,cliente,fecha_entrega,estado,vendedor,requiere_envio,entrega_mensajero,pedido_detalle(producto_id,cantidad,productos(nombre,categoria))")
        .order("fecha_entrega", { ascending: true }).order("id", { ascending: true })
        .range(pagina * tamanoPagina, (pagina + 1) * tamanoPagina - 1);
      if (consultaError) { console.error(consultaError); setError("No se pudo cargar la planificación. Intenta actualizar."); setCargando(false); return; }
      todos.push(...((data || []) as unknown as Pedido[]));
      if (!data || data.length < tamanoPagina) break;
    }
    setPedidos(todos); setCargando(false);
  }
  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, []);

  const pedidosOperativos = useMemo(() => pedidos.filter((pedido) => !["Cancelado", "Anulado"].includes(pedido.estado || "")), [pedidos]);
  const vendedores = useMemo(() => Array.from(new Set(pedidosOperativos.map((pedido) => pedido.vendedor).filter(Boolean))).sort() as string[], [pedidosOperativos]);
  const opcionesProductos = useMemo(() => {
    const opciones = new Map<string, string>();
    pedidosOperativos.forEach((pedido) => (pedido.pedido_detalle || []).forEach((detalle) => {
      if (detalle.producto_id) opciones.set(detalle.producto_id, detalle.productos?.nombre || "Producto sin nombre");
    }));
    return Array.from(opciones, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [pedidosOperativos]);
  const filtrados = useMemo(() => pedidosOperativos.filter((pedido) => {
    const texto = `${pedido.codigo || ""} ${pedido.cliente || ""} ${pedido.vendedor || ""} ${(pedido.pedido_detalle || []).map((item) => item.productos?.nombre || "").join(" ")}`.toLowerCase();
    const coincideTipoEntrega = tipoEntrega === "Todos" || (tipoEntrega === "Mensajería externa" ? pedido.requiere_envio && pedido.entrega_mensajero : tipoEntrega === "Nuestro equipo" ? pedido.requiere_envio && !pedido.entrega_mensajero : !pedido.requiere_envio);
    return texto.includes(busqueda.trim().toLowerCase()) && (productoFiltro === "Todos" || detallesVisibles(pedido, productoFiltro).length > 0) && (estado === "Todos" || estadoPedido(pedido.estado) === estado) && (vendedor === "Todos" || pedido.vendedor === vendedor) && (envio === "Todos" || (envio === "Con envío" ? pedido.requiere_envio : !pedido.requiere_envio)) && coincideTipoEntrega && (!fechaInicio || (pedido.fecha_entrega || "") >= fechaInicio) && (!fechaFin || (pedido.fecha_entrega || "") <= fechaFin);
  }), [pedidosOperativos, busqueda, productoFiltro, estado, vendedor, envio, tipoEntrega, fechaInicio, fechaFin]);
  const metricas = useMemo(() => Object.fromEntries(ETAPAS.map((etapa) => [etapa, pedidosOperativos.filter((pedido) => estadoPedido(pedido.estado) === etapa).length])) as Record<Etapa, number>, [pedidosOperativos]);
  const productos = useMemo(() => {
    const resumen = new Map<string, Resumen & { idsPedidos: Set<string> }>();
    filtrados.forEach((pedido) => detallesVisibles(pedido, productoFiltro).forEach((detalle) => {
      const clave = claveProducto(detalle); const nombre = detalle.productos?.nombre || "Producto eliminado";
      const actual = resumen.get(clave) || { clave, nombre, categoria: detalle.productos?.categoria || null, total: 0, porEtapa: { Pendiente: 0, Producción: 0, Empaquetado: 0, "En Ruta": 0, Entregado: 0 }, proximaEntrega: pedido.fecha_entrega, pedidos: 0, idsPedidos: new Set<string>() };
      const cantidad = Number(detalle.cantidad || 0); const etapa = estadoPedido(pedido.estado); actual.total += cantidad; actual.porEtapa[etapa] += cantidad; actual.idsPedidos.add(pedido.id);
      if (pedido.fecha_entrega && (!actual.proximaEntrega || pedido.fecha_entrega < actual.proximaEntrega)) actual.proximaEntrega = pedido.fecha_entrega; resumen.set(clave, actual);
    }));
    return Array.from(resumen.values()).map(({ idsPedidos, ...producto }) => ({ ...producto, pedidos: idsPedidos.size })).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  }, [filtrados, productoFiltro]);
  const productosPorDia = useMemo(() => {
    const resumen = new Map<string, ResumenDiario>();
    filtrados.forEach((pedido) => detallesVisibles(pedido, productoFiltro).forEach((detalle) => {
      const clave = claveProducto(detalle); const fecha = fechaPedido(pedido); const cantidad = Number(detalle.cantidad || 0);
      const actual = resumen.get(clave) || { clave, nombre: detalle.productos?.nombre || "Producto eliminado", categoria: detalle.productos?.categoria || null, porFecha: {}, total: 0 };
      actual.porFecha[fecha] = (actual.porFecha[fecha] || 0) + cantidad; actual.total += cantidad; resumen.set(clave, actual);
    }));
    return Array.from(resumen.values()).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));
  }, [filtrados, productoFiltro]);
  const diasEntrega = useMemo(() => {
    const dias = new Map<string, { fecha: string; pedidos: Pedido[]; clientes: Map<string, ClienteDiario>; unidades: number }>();
    filtrados.forEach((pedido) => {
      const detalles = detallesVisibles(pedido, productoFiltro); if (!detalles.length) return;
      const fecha = fechaPedido(pedido); const dia = dias.get(fecha) || { fecha, pedidos: [], clientes: new Map<string, ClienteDiario>(), unidades: 0 };
      const claveCliente = pedido.cliente_id || pedido.cliente?.trim().toLocaleLowerCase("es") || `pedido:${pedido.id}`;
      const cliente = dia.clientes.get(claveCliente) || { clave: claveCliente, nombre: pedido.cliente || "Cliente sin nombre", pedidos: [], productos: new Map<string, { nombre: string; cantidad: number }>(), unidades: 0 };
      dia.pedidos.push(pedido); cliente.pedidos.push(pedido);
      detalles.forEach((detalle) => {
        const clave = claveProducto(detalle); const cantidad = Number(detalle.cantidad || 0);
        const producto = cliente.productos.get(clave) || { nombre: detalle.productos?.nombre || "Producto eliminado", cantidad: 0 };
        producto.cantidad += cantidad; cliente.productos.set(clave, producto); cliente.unidades += cantidad; dia.unidades += cantidad;
      });
      dia.clientes.set(claveCliente, cliente); dias.set(fecha, dia);
    });
    return Array.from(dias.values()).sort((a, b) => a.fecha === b.fecha ? 0 : a.fecha === "Sin fecha" ? 1 : b.fecha === "Sin fecha" ? -1 : a.fecha.localeCompare(b.fecha)).map((dia): DiaEntrega => ({ ...dia, clientes: Array.from(dia.clientes.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")) }));
  }, [filtrados, productoFiltro]);
  const unidades = productos.reduce((total, producto) => total + producto.total, 0); const hoy = hoyGuatemala(); const entregasHoy = filtrados.filter((pedido) => fechaPedido(pedido) === hoy).length; const pedidosMensajeria = filtrados.filter((pedido) => pedido.requiere_envio && pedido.entrega_mensajero).length;
  const limpiar = () => { setBusqueda(""); setFechaInicio(""); setFechaFin(""); setEstado("Pendiente"); setVendedor("Todos"); setEnvio("Todos"); setTipoEntrega("Todos"); setProductoFiltro("Todos"); };

  return <main className="min-h-screen bg-slate-100 px-4 py-7 sm:px-7 lg:px-10"><div className="mx-auto max-w-[1600px]">
    <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-orange-600">Planificación de cocina</p><h1 className="mt-2 text-4xl font-black text-slate-950">Productos pendientes</h1><p className="mt-2 text-sm text-slate-600">Consolida cantidades por producto, prioridad de entrega y estado operativo.</p></div><div className="flex gap-3"><Link href="/produccion" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800">Ver producción</Link><button onClick={() => void cargar()} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Actualizar</button></div></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{ETAPAS.map((etapa) => <button key={etapa} onClick={() => setEstado(etapa)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${estilo[etapa]} ${estado === etapa ? "ring-2 ring-slate-950 ring-offset-2" : ""}`}><p className="text-xs font-bold uppercase">{etapa}</p><p className="mt-2 text-3xl font-black">{metricas[etapa]}</p><p className="mt-1 text-xs">pedidos</p></button>)}</section>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar producto, pedido o cliente" aria-label="Buscar producto, pedido o cliente" className="min-w-0 rounded-xl border border-slate-200 px-4 py-3 text-sm sm:col-span-2"/>
        <input type="date" value={fechaInicio} onChange={(event) => setFechaInicio(event.target.value)} aria-label="Fecha de entrega desde" className="min-w-0 rounded-xl border border-slate-200 px-3 py-3 text-sm"/>
        <input type="date" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} aria-label="Fecha de entrega hasta" className="min-w-0 rounded-xl border border-slate-200 px-3 py-3 text-sm"/>
        <select value={productoFiltro} onChange={(event) => setProductoFiltro(event.target.value)} aria-label="Filtrar por producto" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="Todos">Todos los productos</option>{opcionesProductos.map((producto) => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}</select>
        <select value={estado} onChange={(event) => setEstado(event.target.value as Etapa | "Todos")} aria-label="Filtrar por estado" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="Todos">Todos los estados</option>{ETAPAS.map((etapa) => <option key={etapa}>{etapa}</option>)}</select>
        <select value={vendedor} onChange={(event) => setVendedor(event.target.value)} aria-label="Filtrar por vendedor" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="Todos">Todos los vendedores</option>{vendedores.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}</select>
        <select value={envio} onChange={(event) => setEnvio(event.target.value)} aria-label="Filtrar por envío" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option>Todos</option><option>Con envío</option><option>Sin envío</option></select>
        <select value={tipoEntrega} onChange={(event) => setTipoEntrega(event.target.value)} aria-label="Filtrar por tipo de entrega" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="Todos">Todas las entregas</option><option>Mensajería externa</option><option>Nuestro equipo</option><option>Recoger en tienda</option></select>
        <button onClick={limpiar} className="px-2 text-sm font-bold text-slate-500 underline">Limpiar</button>
      </div>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-4"><div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Unidades a preparar</p><p className="mt-2 text-3xl font-black">{unidades}</p><p className="mt-1 text-sm text-slate-400">Según los filtros activos</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Productos distintos</p><p className="mt-2 text-3xl font-black text-slate-950">{productos.length}</p><p className="mt-1 text-sm text-slate-500">Para organizar la mise en place</p></div><div className="rounded-2xl border border-orange-200 bg-orange-50 p-5"><p className="text-xs font-bold uppercase tracking-wider text-orange-700">Entregas para hoy</p><p className="mt-2 text-3xl font-black text-orange-700">{entregasHoy}</p><p className="mt-1 text-sm text-orange-700">Dentro de los pedidos filtrados</p></div><div className="rounded-2xl border border-violet-200 bg-violet-50 p-5"><p className="text-xs font-bold uppercase tracking-wider text-violet-700">Por mensajería</p><p className="mt-2 text-3xl font-black text-violet-700">{pedidosMensajeria}</p><p className="mt-1 text-sm text-violet-700">Pedidos filtrados para mensajero</p></div></section>
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Resumen de preparación</p><h2 className="mt-2 text-2xl font-black text-slate-950">Qué debe preparar la cocina</h2><p className="mt-1 text-sm text-slate-500">{filtrados.length} pedidos · {unidades} unidades según los filtros</p></div>
        <div className="flex flex-wrap gap-2" aria-label="Vistas del resumen de preparación">
          <button type="button" onClick={() => setVistaResumen("producto")} aria-pressed={vistaResumen === "producto"} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${vistaResumen === "producto" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Por producto</button>
          <button type="button" onClick={() => setVistaResumen("dia")} aria-pressed={vistaResumen === "dia"} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${vistaResumen === "dia" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Por día de entrega</button>
        </div>
      </div>
      {vistaResumen === "producto" ? <div className="max-h-[38rem] overflow-auto overscroll-contain"><table className="w-full min-w-[1050px] text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="p-4">Producto</th><th className="p-4 text-center">Pedidos</th>{ETAPAS.map((etapa) => <th key={etapa} className="p-4 text-right">{etapa}</th>)}<th className="p-4 text-right">Total</th><th className="p-4">Próxima entrega</th></tr></thead><tbody>{cargando && <tr><td colSpan={10} className="p-12 text-center text-slate-500">Cargando planificación…</td></tr>}{!cargando && productos.map((producto) => <tr key={producto.clave} className="border-t border-slate-100 hover:bg-slate-50"><td className="p-4"><p className="font-black text-slate-950">{producto.nombre}</p><p className="mt-1 text-xs text-slate-500">{producto.categoria || "Sin categoría"}</p></td><td className="p-4 text-center font-bold">{producto.pedidos}</td>{ETAPAS.map((etapa) => <td key={etapa} className="p-4 text-right font-bold">{producto.porEtapa[etapa] || "—"}</td>)}<td className="p-4 text-right text-lg font-black text-orange-600">{producto.total}</td><td className="p-4 font-semibold text-slate-700">{fechaHumana(producto.proximaEntrega)}</td></tr>)}{!cargando && !productos.length && <tr><td colSpan={10} className="p-12 text-center text-slate-500">No hay productos que coincidan con estos filtros.</td></tr>}</tbody></table></div> : <div className="p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">Planifica las entregas futuras y revisa también las fechas vencidas o sin asignar.</p><div className="flex gap-2"><button type="button" onClick={() => setVistaDiaria("producto")} aria-pressed={vistaDiaria === "producto"} className={`rounded-lg px-3 py-2 text-xs font-bold ${vistaDiaria === "producto" ? "bg-orange-100 text-orange-800" : "border border-slate-200 text-slate-600"}`}>Productos × fechas</button><button type="button" onClick={() => setVistaDiaria("cliente")} aria-pressed={vistaDiaria === "cliente"} className={`rounded-lg px-3 py-2 text-xs font-bold ${vistaDiaria === "cliente" ? "bg-orange-100 text-orange-800" : "border border-slate-200 text-slate-600"}`}>Entregas por cliente</button></div></div>
        {vistaDiaria === "producto" ? <div role="region" aria-label="Unidades por producto y día de entrega" tabIndex={0} className="max-h-[36rem] overflow-auto overscroll-contain rounded-2xl border border-slate-200 focus:outline-2 focus:outline-offset-2 focus:outline-orange-500">
          <table className="w-full min-w-[680px] text-sm"><thead className="sticky top-0 z-20 bg-emerald-50 text-slate-700"><tr><th className="sticky left-0 z-30 min-w-[220px] bg-emerald-50 px-4 py-3 text-left">Producto</th>{diasEntrega.map((dia) => <th key={dia.fecha} className="min-w-[110px] px-3 py-3 text-center"><span className="block font-bold capitalize">{fechaCorta(dia.fecha)}</span><span className="text-[11px] font-medium text-slate-500">{dia.unidades} unidades</span></th>)}<th className="min-w-[100px] bg-emerald-100 px-4 py-3 text-right">Total</th></tr></thead><tbody>{cargando && <tr><td colSpan={diasEntrega.length + 2} className="p-10 text-center text-slate-500">Cargando planificación…</td></tr>}{!cargando && productosPorDia.map((producto) => <tr key={producto.clave} className="border-t border-slate-100 hover:bg-orange-50/40"><th scope="row" className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-bold text-slate-900"><span className="block">{producto.nombre}</span><span className="text-xs font-normal text-slate-500">{producto.categoria || "Sin categoría"}</span></th>{diasEntrega.map((dia) => <td key={dia.fecha} className="px-3 py-3 text-center font-semibold text-slate-700">{producto.porFecha[dia.fecha] || <span className="text-slate-300">—</span>}</td>)}<td className="bg-emerald-50 px-4 py-3 text-right font-black text-emerald-800">{producto.total}</td></tr>)}{!cargando && !productosPorDia.length && <tr><td colSpan={diasEntrega.length + 2} className="p-10 text-center text-slate-500">No hay productos para las fechas y filtros seleccionados.</td></tr>}</tbody><tfoot className="bg-slate-50 font-black text-slate-900"><tr><th className="sticky left-0 bg-slate-50 px-4 py-3 text-left">Total por día</th>{diasEntrega.map((dia) => <td key={dia.fecha} className="px-3 py-3 text-center">{dia.unidades}</td>)}<td className="px-4 py-3 text-right text-orange-700">{unidades}</td></tr></tfoot></table>
        </div> : <div className="max-h-[42rem] space-y-5 overflow-y-auto overscroll-contain pr-1">{cargando && <p className="py-10 text-center text-sm text-slate-500">Cargando entregas…</p>}{!cargando && diasEntrega.map((dia) => <article key={dia.fecha} className="overflow-hidden rounded-2xl border border-slate-200"><div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3"><h3 className="font-black capitalize text-slate-950">{dia.fecha === "Sin fecha" ? "Sin fecha de entrega · revisar" : fechaHumana(dia.fecha)}</h3><span className="text-xs font-bold text-orange-700">{dia.pedidos.length} pedidos · {dia.unidades} unidades</span></div><div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">{dia.clientes.map((cliente) => <div key={cliente.clave} className="rounded-xl border border-slate-100 bg-white p-4"><div className="flex items-start justify-between gap-2"><h4 className="font-black text-slate-900">{cliente.nombre}</h4><span className="shrink-0 rounded-full bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700">{cliente.unidades} u.</span></div><div className="mt-3 space-y-1">{Array.from(cliente.productos, ([clave, producto]) => <p key={clave} className="text-sm text-slate-700"><b>{producto.cantidad}×</b> {producto.nombre}</p>)}</div><div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{cliente.pedidos.map((pedido) => <Link key={pedido.id} href={`/pedidos/${pedido.id}`} className="text-xs font-bold text-orange-700 underline-offset-2 hover:underline">{pedido.codigo || "Ver pedido"}</Link>)}</div></div>)}</div></article>)}{!cargando && !diasEntrega.length && <p className="py-10 text-center text-sm text-slate-500">No hay entregas para los filtros seleccionados.</p>}</div>}
      </div>}
      {error && <p className="m-5 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
    </section>
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Detalle operativo</p><h2 className="mt-2 text-2xl font-black text-slate-950">Pedidos que componen el resumen</h2></div><div className="max-h-[38rem] divide-y divide-slate-100 overflow-y-auto overscroll-contain">{filtrados.map((pedido) => <Link key={pedido.id} href={`/pedidos/${pedido.id}`} className="flex flex-col gap-3 p-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-xs font-bold text-orange-600">{pedido.codigo || "SIN CÓDIGO"}</p><p className="mt-1 font-black text-slate-950">{pedido.cliente || "Cliente sin nombre"}</p><p className="mt-1 text-sm text-slate-500">{detallesVisibles(pedido, productoFiltro).map((detalle) => `${Number(detalle.cantidad || 0)}× ${detalle.productos?.nombre || "Producto"}`).join(" · ") || "Sin productos registrados"}</p></div><div className="flex flex-wrap items-center gap-4"><p className="text-sm font-semibold text-slate-600">Entrega: {fechaHumana(pedido.fecha_entrega)}</p><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{pedido.requiere_envio ? (pedido.entrega_mensajero ? "Mensajería externa" : "Nuestro equipo") : "Recoger en tienda"}</span><span className={`rounded-full border px-3 py-1 text-xs font-bold ${estilo[estadoPedido(pedido.estado)]}`}>{estadoPedido(pedido.estado)}</span></div></Link>)}{!cargando && !filtrados.length && <p className="p-10 text-center text-sm text-slate-500">No hay pedidos para mostrar.</p>}</div></section>
  </div></main>;
}
