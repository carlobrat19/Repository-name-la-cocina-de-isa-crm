"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Printer, RefreshCw, Search, Truck } from "lucide-react";
import { useCrmAuth } from "@/components/auth/AuthGate";
import { supabase } from "@/lib/supabase";

type Detalle = { cantidad: number | string | null; productos: { nombre: string | null } | null };
type Pedido = {
  id: string; codigo: string | null; cliente: string | null; telefono: string | null;
  direccion: string | null; departamento_entrega: string | null; municipio_entrega: string | null;
  zona_entrega: string | null; fecha_entrega: string | null;
  observaciones: string | null; estado: string | null; pago_estado: string | null;
  total: number | string | null; costo_envio: number | string | null;
  saldo_pendiente: number | string | null; entrega_mensajero: boolean | null;
  pedido_detalle: Detalle[] | null;
};

const dinero = (valor: number | string | null) => `Q ${Number(valor || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const texto = (valor: string | null) => valor?.trim() || "Sin registrar";
const normalizar = (valor: string | null) => (valor || "").trim().toLocaleLowerCase("es-GT");
const comparar = (a: string | null, b: string | null) => texto(a).localeCompare(texto(b), "es-GT", { numeric: true, sensitivity: "base" });
const hoyGuatemala = () => {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const parte = (tipo: string) => partes.find((item) => item.type === tipo)?.value || "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
};
const fechaHumana = (fecha: string) => new Intl.DateTimeFormat("es-GT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${fecha}T12:00:00`));
const sumarDias = (fecha: string, dias: number) => { const valor = new Date(`${fecha}T12:00:00Z`); valor.setUTCDate(valor.getUTCDate() + dias); return valor.toISOString().slice(0, 10); };
const input = "min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100";

export default function MensajeriaPage() {
  const { listo, puedeVer } = useCrmAuth();
  const autorizado = listo && puedeVer("pedidos");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipo, setTipo] = useState("Mensajería externa");
  const [estado, setEstado] = useState("Por entregar");
  const [departamento, setDepartamento] = useState("Todos");
  const [municipio, setMunicipio] = useState("Todos");
  const [zona, setZona] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("Municipio, zona y cliente");
  const [paginaSeleccionada, setPaginaSeleccionada] = useState({ filtro: "", numero: 1 });

  async function cargar() {
    setCargando(true); setError("");
    const acumulados: Pedido[] = [];
    const paginaTamano = 500;
    for (let pagina = 0; ; pagina += 1) {
      const { data, error: consultaError } = await supabase.from("pedidos")
        .select("id,codigo,cliente,telefono,direccion,departamento_entrega,municipio_entrega,zona_entrega,fecha_entrega,observaciones,estado,pago_estado,total,costo_envio,saldo_pendiente,entrega_mensajero,pedido_detalle(cantidad,productos(nombre))")
        .eq("requiere_envio", true)
        .order("fecha_entrega", { ascending: true })
        .order("id", { ascending: true })
        .range(pagina * paginaTamano, (pagina + 1) * paginaTamano - 1);
      if (consultaError) { console.error(consultaError); setError("No se pudieron cargar los envíos. Intenta actualizar."); setCargando(false); return; }
      acumulados.push(...((data || []) as unknown as Pedido[]));
      if (!data || data.length < paginaTamano) break;
    }
    setPedidos(acumulados); setCargando(false);
  }

  useEffect(() => { if (!autorizado) return; const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, [autorizado]);

  const activos = useMemo(() => pedidos.filter((pedido) => !["cancelado", "anulado"].includes(normalizar(pedido.estado))), [pedidos]);
  const opciones = (campo: "departamento_entrega" | "municipio_entrega" | "zona_entrega", base: Pedido[]) => Array.from(new Set(base.map((pedido) => pedido[campo]?.trim()).filter((valor): valor is string => Boolean(valor)))).sort((a, b) => a.localeCompare(b, "es-GT", { numeric: true, sensitivity: "base" }));
  const base = useMemo(() => activos.filter((pedido) => (!desde || (pedido.fecha_entrega || "") >= desde) && (!hasta || (pedido.fecha_entrega || "") <= hasta) && (tipo === "Todas" || (tipo === "Mensajería externa" ? pedido.entrega_mensajero : !pedido.entrega_mensajero)) && (estado === "Todos" || (estado === "Por entregar" ? normalizar(pedido.estado) !== "entregado" : normalizar(pedido.estado) === "entregado"))), [activos, desde, hasta, tipo, estado]);
  const departamentos = opciones("departamento_entrega", base);
  const municipios = opciones("municipio_entrega", base.filter((pedido) => departamento === "Todos" || pedido.departamento_entrega === departamento));
  const zonas = opciones("zona_entrega", base.filter((pedido) => (departamento === "Todos" || pedido.departamento_entrega === departamento) && (municipio === "Todos" || pedido.municipio_entrega === municipio)));
  const visibles = useMemo(() => base.filter((pedido) => {
    const coincide = !busqueda.trim() || [pedido.codigo, pedido.cliente, pedido.telefono, pedido.direccion, pedido.departamento_entrega, pedido.municipio_entrega, pedido.zona_entrega, pedido.observaciones, ...(pedido.pedido_detalle || []).map((item) => item.productos?.nombre)].some((valor) => normalizar(valor || null).includes(normalizar(busqueda)));
    return coincide && (departamento === "Todos" || pedido.departamento_entrega === departamento) && (municipio === "Todos" || pedido.municipio_entrega === municipio) && (zona === "Todas" || pedido.zona_entrega === zona);
  }).sort((a, b) => {
    if (orden === "Cliente A–Z") return comparar(a.cliente, b.cliente);
    if (orden === "Departamento, municipio y zona") return comparar(a.departamento_entrega, b.departamento_entrega) || comparar(a.municipio_entrega, b.municipio_entrega) || comparar(a.zona_entrega, b.zona_entrega) || comparar(a.cliente, b.cliente);
    if (orden === "Zona y cliente") return comparar(a.zona_entrega, b.zona_entrega) || comparar(a.cliente, b.cliente);
    return comparar(a.municipio_entrega, b.municipio_entrega) || comparar(a.zona_entrega, b.zona_entrega) || comparar(a.cliente, b.cliente);
  }), [base, busqueda, departamento, municipio, zona, orden]);
  const resumen = useMemo(() => ({ pedidos: visibles.length, unidades: visibles.reduce((total, pedido) => total + (pedido.pedido_detalle || []).reduce((suma, item) => suma + Number(item.cantidad || 0), 0), 0), porCobrar: visibles.reduce((total, pedido) => total + Math.max(0, Number(pedido.saldo_pendiente ?? (pedido.pago_estado === "Pagado" ? 0 : pedido.total || 0))), 0), envios: visibles.reduce((total, pedido) => total + Number(pedido.costo_envio || 0), 0) }), [visibles]);
  const claveFiltro = JSON.stringify([desde, hasta, tipo, estado, departamento, municipio, zona, busqueda, orden]);
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / 10));
  const pagina = paginaSeleccionada.filtro === claveFiltro ? Math.min(paginaSeleccionada.numero, totalPaginas) : 1;
  const pedidosPagina = visibles.slice((pagina - 1) * 10, pagina * 10);
  const totalPagina = pedidosPagina.reduce((total, pedido) => total + Number(pedido.total || 0), 0);
  const envioPagina = pedidosPagina.reduce((total, pedido) => total + Number(pedido.costo_envio || 0), 0);
  const periodo = desde && hasta && desde === hasta ? fechaHumana(desde) : desde && hasta ? `${fechaHumana(desde)} — ${fechaHumana(hasta)}` : desde ? `desde ${fechaHumana(desde)}` : hasta ? `hasta ${fechaHumana(hasta)}` : "todas las fechas";

  if (!listo) return <p className="p-8 text-sm text-slate-500">Cargando…</p>;
  if (!autorizado) return <div className="p-8"><h1 className="text-2xl font-black">Mensajería y envíos</h1><p className="mt-2 text-slate-600">Necesitas acceso a Pedidos para consultar las entregas.</p></div>;

  return <div className="mensajeria-print min-h-screen bg-[#f1f5f9] px-4 py-8 sm:px-7 lg:px-10">
    <div className="mx-auto max-w-[1700px]">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.24em] text-orange-600">Cocina y entregas</p><h1 className="mt-2 text-4xl font-black text-slate-950">Mensajería y envíos</h1><p className="mt-2 text-sm text-slate-600">Organiza las rutas y prepara una hoja clara para cada entrega.</p></div><div className="flex gap-2 print:hidden"><button onClick={() => void cargar()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300"><RefreshCw size={16}/>Actualizar</button><button onClick={() => window.print()} disabled={cargando || !visibles.length} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"><Printer size={16}/>Imprimir hoja</button></div></header>
      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-orange-50 text-orange-600"><CalendarDays size={18}/></span><div><h2 className="text-sm font-black text-slate-950">Planificar entregas</h2><p className="text-xs text-slate-500">Selecciona un día o un rango de fechas.</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { const hoy = hoyGuatemala(); setDesde(hoy); setHasta(hoy); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-orange-300 hover:text-orange-700">Hoy</button><button type="button" onClick={() => { const hoy = hoyGuatemala(); setDesde(hoy); setHasta(sumarDias(hoy, 6)); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-orange-300 hover:text-orange-700">Próximos 7 días</button><button type="button" onClick={() => { setDesde(""); setHasta(""); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-orange-300 hover:text-orange-700">Todas las fechas</button></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <label className="text-xs font-bold text-slate-600">Entrega desde<input type="date" value={desde} max={hasta || undefined} onChange={(e) => { setDesde(e.target.value); if (hasta && e.target.value && e.target.value > hasta) setHasta(e.target.value); }} className={`${input} mt-1.5`}/></label>
        <label className="text-xs font-bold text-slate-600">Entrega hasta<input type="date" value={hasta} min={desde || undefined} onChange={(e) => { setHasta(e.target.value); if (desde && e.target.value && e.target.value < desde) setDesde(e.target.value); }} className={`${input} mt-1.5`}/></label>
        <label className="text-xs font-bold text-slate-600">Tipo de entrega<select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${input} mt-1.5`}>{["Mensajería externa", "Nuestro equipo", "Todas"].map((valor) => <option key={valor}>{valor}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Estado<select value={estado} onChange={(e) => setEstado(e.target.value)} className={`${input} mt-1.5`}>{["Por entregar", "Entregado", "Todos"].map((valor) => <option key={valor}>{valor}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Departamento<select value={departamento} onChange={(e) => { setDepartamento(e.target.value); setMunicipio("Todos"); setZona("Todas"); }} className={`${input} mt-1.5`}><option>Todos</option>{departamentos.map((valor) => <option key={valor}>{valor}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Municipio<select value={municipio} onChange={(e) => { setMunicipio(e.target.value); setZona("Todas"); }} className={`${input} mt-1.5`}><option>Todos</option>{municipios.map((valor) => <option key={valor}>{valor}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Zona<select value={zona} onChange={(e) => setZona(e.target.value)} className={`${input} mt-1.5`}><option>Todas</option>{zonas.map((valor) => <option key={valor}>{valor}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2 lg:col-span-3">Buscar pedido<div className="relative mt-1.5"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Cliente, código, teléfono, dirección o producto" className={`${input} pl-9`}/></div></label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2 lg:col-span-3">Ordenar por<select value={orden} onChange={(e) => setOrden(e.target.value)} className={`${input} mt-1.5`}>{["Municipio, zona y cliente", "Departamento, municipio y zona", "Zona y cliente", "Cliente A–Z"].map((valor) => <option key={valor}>{valor}</option>)}</select></label>
        </div>
      </section>
      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">{[["Pedidos", resumen.pedidos, "border-l-orange-500 text-orange-700"], ["Unidades", resumen.unidades, "border-l-slate-950 text-slate-950"], ["Por cobrar", dinero(resumen.porCobrar), "border-l-rose-500 text-rose-700"], ["Envío cobrado", dinero(resumen.envios), "border-l-emerald-500 text-emerald-700"]].map(([etiqueta, valor, estilo]) => <div key={etiqueta} className={`rounded-2xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm ${estilo}`}><p className="text-xs font-bold uppercase text-slate-500">{etiqueta}</p><p className="mt-1 text-2xl font-black">{valor}</p></div>)}</section>
      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:mt-0 print:rounded-none print:border-0 print:shadow-none"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-5 print:px-0"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Hoja para reparto</p><h2 className="mt-1 text-xl font-black text-slate-950">Entregas · {periodo}</h2><p className="text-xs text-slate-500">{tipo} · {estado} · {resumen.pedidos} pedidos · página {pagina} de {totalPaginas} · {pedidosPagina.length} en esta hoja</p></div><span className="grid size-11 place-items-center rounded-xl bg-orange-50 text-orange-600 print:hidden"><Truck size={22}/></span></div>
        {error && <p role="alert" className="p-6 text-sm font-semibold text-rose-700">{error}</p>}
        {cargando ? <p className="p-8 text-sm text-slate-500">Cargando entregas…</p> : !visibles.length ? <p className="p-8 text-sm text-slate-500">No hay envíos con estos filtros. Prueba otro rango de fechas, estado o tipo de entrega.</p> : <>
          <div className="overflow-x-auto"><table className="w-full min-w-[1450px] border-collapse text-left text-xs print:min-w-0">
            <thead className="bg-slate-100 text-[11px] font-bold uppercase text-slate-600"><tr>{["# / pedido", "Fecha", "Cliente / teléfono", "Dirección", "Departamento", "Municipio", "Zona", "Observaciones", "Productos", "Pago / por cobrar", "Total pedido", "Envío"].map((titulo) => <th key={titulo} scope="col" className="border-b border-slate-200 px-3 py-3 align-top">{titulo}</th>)}</tr></thead>
            <tbody>{pedidosPagina.map((pedido, indice) => <tr key={pedido.id} className="border-b border-slate-100 align-top even:bg-slate-50/60 hover:bg-orange-50/40">
              <td className="px-3 py-3 font-bold text-slate-700">{(pagina - 1) * 10 + indice + 1}<br/><Link href={`/pedidos/${pedido.id}`} className="font-mono text-[11px] text-orange-700 underline print:no-underline">{texto(pedido.codigo)}</Link></td>
              <td className="whitespace-nowrap px-3 py-3 text-slate-600">{pedido.fecha_entrega ? new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short" }).format(new Date(`${pedido.fecha_entrega.slice(0, 10)}T12:00:00`)) : "Sin fecha"}</td>
              <td className="px-3 py-3"><b className="text-slate-950">{texto(pedido.cliente)}</b><br/><span className="text-slate-600">{texto(pedido.telefono)}</span></td>
              <td className="max-w-48 px-3 py-3">{texto(pedido.direccion)}</td><td className="px-3 py-3">{texto(pedido.departamento_entrega)}</td><td className="px-3 py-3 font-semibold">{texto(pedido.municipio_entrega)}</td><td className="px-3 py-3">{texto(pedido.zona_entrega)}</td>
              <td className="max-w-52 whitespace-pre-wrap px-3 py-3">{texto(pedido.observaciones)}</td>
              <td className="max-w-56 px-3 py-3">{(pedido.pedido_detalle || []).length ? pedido.pedido_detalle?.map((item, itemIndice) => <div key={itemIndice}>{Number(item.cantidad || 0)}× {item.productos?.nombre || "Producto eliminado"}</div>) : "Sin detalle"}</td>
              <td className="px-3 py-3"><span className={pedido.pago_estado === "Pagado" ? "font-bold text-emerald-700" : "font-bold text-rose-700"}>{texto(pedido.pago_estado)}</span><br/><span className="text-slate-500">Saldo: {dinero(pedido.saldo_pendiente ?? (pedido.pago_estado === "Pagado" ? 0 : pedido.total))}</span></td>
              <td className="whitespace-nowrap px-3 py-3 font-bold">{dinero(pedido.total)}</td><td className="whitespace-nowrap px-3 py-3">{dinero(pedido.costo_envio)}</td>
            </tr>)}</tbody>
            <tfoot className="bg-orange-50 font-black"><tr><td colSpan={10} className="px-3 py-3">Total de esta página · {pedidosPagina.length} pedidos</td><td className="px-3 py-3">{dinero(totalPagina)}</td><td className="px-3 py-3">{dinero(envioPagina)}</td></tr></tfoot>
          </table></div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 print:hidden"><p className="text-sm text-slate-600">Mostrando <b>{(pagina - 1) * 10 + 1}–{(pagina - 1) * 10 + pedidosPagina.length}</b> de <b>{resumen.pedidos}</b> pedidos</p><nav aria-label="Páginas de entregas" className="flex items-center gap-2"><button type="button" disabled={pagina === 1} onClick={() => setPaginaSeleccionada({ filtro: claveFiltro, numero: pagina - 1 })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">Anterior</button><label className="text-xs font-semibold text-slate-600">Página <select aria-label="Seleccionar página" value={pagina} onChange={(e) => setPaginaSeleccionada({ filtro: claveFiltro, numero: Number(e.target.value) })} className="ml-1 rounded-lg border border-slate-200 bg-white px-2 py-2 font-bold text-slate-800">{Array.from({ length: totalPaginas }, (_, indice) => <option key={indice + 1} value={indice + 1}>{indice + 1}</option>)}</select> de {totalPaginas}</label><button type="button" disabled={pagina === totalPaginas} onClick={() => setPaginaSeleccionada({ filtro: claveFiltro, numero: pagina + 1 })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">Siguiente</button></nav></div>
          <p className="px-5 py-3 text-xs text-slate-500 print:px-0">Se imprime únicamente la página visible (máximo 10 pedidos). El total incluye envío; «por cobrar» es el saldo pendiente registrado.</p>
        </>}
      </section>
    </div>
  </div>;
}
