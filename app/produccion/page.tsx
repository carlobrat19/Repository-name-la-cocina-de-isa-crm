"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const ETAPAS = ["Pendiente", "Producción", "Empaquetado", "En Ruta", "Entregado"] as const;
type Etapa = (typeof ETAPAS)[number];
type Pedido = { id: string; codigo: string | null; cliente: string | null; estado: string | null; vendedor: string | null; fecha_pedido: string | null; fecha_entrega: string | null; observaciones: string | null };
type Detalle = { pedido_id: string; producto_id: string | null; cantidad: number | string | null };
type Producto = { id: string; nombre: string; categoria: string | null };

const color: Record<Etapa, string> = { Pendiente: "bg-amber-50 text-amber-800", Producción: "bg-blue-50 text-blue-800", Empaquetado: "bg-violet-50 text-violet-800", "En Ruta": "bg-orange-50 text-orange-800", Entregado: "bg-emerald-50 text-emerald-800" };
const estadoPedido = (valor: string | null): Etapa => ETAPAS.includes(valor as Etapa) ? valor as Etapa : "Pendiente";

export default function ProduccionPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [detalles, setDetalles] = useState<Detalle[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [vista, setVista] = useState<"pedidos" | "productos">("pedidos");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [vendedorFiltro, setVendedorFiltro] = useState("Todos");
  const [fechaPedidoInicio, setFechaPedidoInicio] = useState("");
  const [fechaPedidoFin, setFechaPedidoFin] = useState("");
  const [fechaEntregaInicio, setFechaEntregaInicio] = useState("");
  const [fechaEntregaFin, setFechaEntregaFin] = useState("");
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);

  async function cargar() {
    setCargando(true); setErrorCarga("");
    const [pedidosRespuesta, detallesRespuesta, productosRespuesta] = await Promise.all([
      supabase.from("pedidos").select("id,codigo,cliente,estado,vendedor,fecha_pedido,fecha_entrega,observaciones").order("fecha_entrega", { ascending: true }).limit(250),
      supabase.from("pedido_detalle").select("pedido_id,producto_id,cantidad"),
      supabase.from("productos").select("id,nombre,categoria"),
    ]);
    if (pedidosRespuesta.error || detallesRespuesta.error || productosRespuesta.error) { const error = pedidosRespuesta.error || detallesRespuesta.error || productosRespuesta.error; console.error(error); setErrorCarga("No se pudo actualizar el panel. Revisa tu conexión e inténtalo de nuevo."); setCargando(false); return; }
    setPedidos((pedidosRespuesta.data || []) as Pedido[]);
    setDetalles((detallesRespuesta.data || []) as Detalle[]);
    setProductos((productosRespuesta.data || []) as Producto[]);
    setUltimaActualizacion(new Date().toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })); setCargando(false);
  }

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, []);

  async function cambiarEstado(pedido: Pedido, nuevoEstado: Etapa) {
    if (nuevoEstado === pedido.estado) return;
    setActualizando(pedido.id);
    const { error } = await supabase.from("pedidos").update({ estado: nuevoEstado }).eq("id", pedido.id);
    setActualizando(null);
    if (error) { alert("No se pudo cambiar la etapa."); console.error(error); return; }
    await cargar();
  }

  const productosPorId = useMemo(() => new Map(productos.map((producto) => [producto.id, producto])), [productos]);
  const vendedores = useMemo(() => Array.from(new Set(pedidos.map((pedido) => pedido.vendedor).filter(Boolean))) as string[], [pedidos]);
  const pedidosFiltrados = useMemo(() => pedidos.filter((pedido) => {
    const texto = `${pedido.codigo || ""} ${pedido.cliente || ""} ${pedido.vendedor || ""}`.toLowerCase();
    const fechaPedido = pedido.fecha_pedido || ""; const fechaEntrega = pedido.fecha_entrega || "";
    return texto.includes(busqueda.toLowerCase()) && (estadoFiltro === "Todos" || pedido.estado === estadoFiltro) && (vendedorFiltro === "Todos" || pedido.vendedor === vendedorFiltro) && (!fechaPedidoInicio || fechaPedido >= fechaPedidoInicio) && (!fechaPedidoFin || fechaPedido <= fechaPedidoFin) && (!fechaEntregaInicio || fechaEntrega >= fechaEntregaInicio) && (!fechaEntregaFin || fechaEntrega <= fechaEntregaFin);
  }), [pedidos, busqueda, estadoFiltro, vendedorFiltro, fechaPedidoInicio, fechaPedidoFin, fechaEntregaInicio, fechaEntregaFin]);
  const itemsPedido = (pedidoId: string) => detalles.filter((detalle) => detalle.pedido_id === pedidoId);
  const metricas = useMemo(() => Object.fromEntries(ETAPAS.map((estado) => [estado, pedidosFiltrados.filter((pedido) => estadoPedido(pedido.estado) === estado).length])) as Record<Etapa, number>, [pedidosFiltrados]);
  const resumenProductos = useMemo(() => {
    const resumen = new Map<string, { producto?: Producto; total: number; porEtapa: Record<Etapa, number> }>();
    pedidosFiltrados.forEach((pedido) => detalles.filter((detalle) => detalle.pedido_id === pedido.id).forEach((detalle) => {
      const clave = detalle.producto_id || "eliminado";
      const actual = resumen.get(clave) || { producto: detalle.producto_id ? productosPorId.get(detalle.producto_id) : undefined, total: 0, porEtapa: { Pendiente: 0, Producción: 0, Empaquetado: 0, "En Ruta": 0, Entregado: 0 } };
      const cantidad = Number(detalle.cantidad || 0); actual.total += cantidad; actual.porEtapa[estadoPedido(pedido.estado)] += cantidad; resumen.set(clave, actual);
    }));
    return Array.from(resumen.values()).sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados, detalles, productosPorId]);
  const limpiar = () => { setBusqueda(""); setEstadoFiltro("Todos"); setVendedorFiltro("Todos"); setFechaPedidoInicio(""); setFechaPedidoFin(""); setFechaEntregaInicio(""); setFechaEntregaFin(""); };

  return <main className="min-h-screen bg-slate-100 px-4 py-7 sm:px-7 lg:px-10"><div className="mx-auto max-w-[1600px]">
    <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-orange-600">Operación de cocina</p><h1 className="mt-2 text-4xl font-black text-slate-950">Panel de producción</h1><p className="mt-2 text-sm text-slate-600">Visualiza cada pedido, actualiza sus etapas y calcula los productos que la cocina debe preparar.</p>{ultimaActualizacion && <p className="mt-2 text-xs font-semibold text-slate-400">Actualizado a las {ultimaActualizacion}</p>}</div><div className="flex gap-3"><Link href="/pedidos/lista" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold">Ver pedidos</Link><button disabled={cargando} onClick={() => void cargar()} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{cargando ? "Actualizando…" : "Actualizar"}</button></div></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{ETAPAS.map((estado) => <button key={estado} onClick={() => setEstadoFiltro(estado)} className={`rounded-2xl p-4 text-left ${color[estado]}`}><p className="text-xs font-bold uppercase">{estado}</p><p className="mt-2 text-3xl font-black">{metricas[estado]}</p><p className="mt-1 text-xs">{estado === "Producción" ? "en cocina ahora" : "pedidos"}</p></button>)}</section>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 xl:flex-row"><div className="inline-flex rounded-xl bg-slate-100 p-1"><button onClick={() => setVista("pedidos")} className={`rounded-lg px-4 py-2 text-sm font-bold ${vista === "pedidos" ? "bg-slate-950 text-white" : "text-slate-600"}`}>Por pedidos</button><button onClick={() => setVista("productos")} className={`rounded-lg px-4 py-2 text-sm font-bold ${vista === "productos" ? "bg-slate-950 text-white" : "text-slate-600"}`}>Por productos</button></div><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Código, cliente o responsable" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"/><select value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option>Todos</option>{ETAPAS.map((estado) => <option key={estado}>{estado}</option>)}</select><select value={vendedorFiltro} onChange={(event) => setVendedorFiltro(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option>Todos</option>{vendedores.map((vendedor) => <option key={vendedor}>{vendedor}</option>)}</select><button onClick={limpiar} className="text-sm font-bold text-slate-500 underline">Limpiar</button></div><div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4"><label className="text-xs font-bold text-slate-500">Toma del pedido — desde<input type="date" value={fechaPedidoInicio} onChange={(event) => setFechaPedidoInicio(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"/></label><label className="text-xs font-bold text-slate-500">Toma del pedido — hasta<input type="date" value={fechaPedidoFin} onChange={(event) => setFechaPedidoFin(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"/></label><label className="text-xs font-bold text-slate-500">Entrega — desde<input type="date" value={fechaEntregaInicio} onChange={(event) => setFechaEntregaInicio(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"/></label><label className="text-xs font-bold text-slate-500">Entrega — hasta<input type="date" value={fechaEntregaFin} onChange={(event) => setFechaEntregaFin(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"/></label></div>{errorCarga && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{errorCarga}</p>}</section>
    {vista === "pedidos" ? <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-5">{ETAPAS.map((estado) => <div key={estado} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className={`p-4 ${color[estado]}`}><p className="font-black">{estado}</p><p className="text-xs">{metricas[estado]} pedidos</p></div><div className="max-h-[680px] space-y-3 overflow-y-auto p-3">{pedidosFiltrados.filter((pedido) => estadoPedido(pedido.estado) === estado).map((pedido) => <article key={pedido.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-2"><div><p className="font-mono text-[11px] font-bold text-orange-600">{pedido.codigo || "SIN CÓDIGO"}</p><h2 className="mt-1 font-black">{pedido.cliente || "Cliente sin nombre"}</h2><p className="mt-1 text-xs text-slate-500">Entrega: {pedido.fecha_entrega || "Sin fecha"} · {pedido.vendedor || "Sin responsable"}</p></div><Link href={`/pedidos/${pedido.id}`} className="text-xs font-bold text-orange-600">Ver</Link></div><div className="mt-4 space-y-1">{itemsPedido(pedido.id).map((item, index) => <p key={`${item.producto_id}-${index}`} className="text-sm font-semibold text-slate-700">{Number(item.cantidad)}× {productosPorId.get(item.producto_id || "")?.nombre || "Producto"}</p>)}</div><div className="mt-4 flex gap-1">{ETAPAS.map((paso, indice) => <span key={paso} className={`h-1.5 flex-1 rounded-full ${indice <= ETAPAS.indexOf(estadoPedido(pedido.estado)) ? "bg-orange-500" : "bg-slate-200"}`}/>)}</div><select value={estadoPedido(pedido.estado)} disabled={actualizando === pedido.id} onChange={(event) => void cambiarEstado(pedido, event.target.value as Etapa)} className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"><option value="Pendiente">Pendiente</option><option value="Producción">En producción</option><option value="Empaquetado">Empaquetado</option><option value="En Ruta">En ruta</option><option value="Entregado">Entregado</option></select>{pedido.observaciones && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Nota: {pedido.observaciones}</p>}</article>)}{!pedidosFiltrados.some((pedido) => estadoPedido(pedido.estado) === estado) && <p className="p-6 text-center text-sm text-slate-500">No hay pedidos en esta etapa.</p>}</div></div>)}</section> : <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-500">Plan de trabajo</p><h2 className="mt-2 text-2xl font-black">Productos requeridos por etapa</h2><p className="mt-1 text-sm text-slate-500">Totales consolidados de los pedidos filtrados.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Producto</th><th className="p-4">Categoría</th>{ETAPAS.map((estado) => <th key={estado} className="p-4 text-right">{estado}</th>)}<th className="p-4 text-right">Total</th></tr></thead><tbody>{resumenProductos.map((fila, index) => <tr key={fila.producto?.id || index} className="border-t border-slate-100"><td className="p-4 font-black">{fila.producto?.nombre || "Producto eliminado"}</td><td className="p-4 text-slate-500">{fila.producto?.categoria || "—"}</td>{ETAPAS.map((estado) => <td key={estado} className="p-4 text-right font-bold">{fila.porEtapa[estado] || "—"}</td>)}<td className="p-4 text-right text-lg font-black text-orange-600">{fila.total}</td></tr>)}{!resumenProductos.length && <tr><td colSpan={8} className="p-12 text-center text-slate-500">No hay productos para los filtros seleccionados.</td></tr>}</tbody></table></div></section>}
  </div></main>;
}
