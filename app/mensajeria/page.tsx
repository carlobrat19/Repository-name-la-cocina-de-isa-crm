"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Printer, RefreshCw, Truck } from "lucide-react";
import { useCrmAuth } from "@/components/auth/AuthGate";
import { supabase } from "@/lib/supabase";

type Detalle = { cantidad: number | string | null; productos: { nombre: string | null } | null };
type Pedido = {
  id: string; codigo: string | null; cliente: string | null; telefono: string | null;
  direccion: string | null; departamento_entrega: string | null; municipio_entrega: string | null;
  zona_entrega: string | null; fecha_entrega: string | null; hora_entrega: string | null;
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
const input = "min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100";

export default function MensajeriaPage() {
  const { listo, puedeVer } = useCrmAuth();
  const autorizado = listo && puedeVer("pedidos");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [fecha, setFecha] = useState(hoyGuatemala);
  const [tipo, setTipo] = useState("Mensajería externa");
  const [estado, setEstado] = useState("Por entregar");
  const [departamento, setDepartamento] = useState("Todos");
  const [municipio, setMunicipio] = useState("Todos");
  const [zona, setZona] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("Municipio, zona y cliente");

  async function cargar() {
    setCargando(true); setError("");
    const acumulados: Pedido[] = [];
    const paginaTamano = 500;
    for (let pagina = 0; ; pagina += 1) {
      const { data, error: consultaError } = await supabase.from("pedidos")
        .select("id,codigo,cliente,telefono,direccion,departamento_entrega,municipio_entrega,zona_entrega,fecha_entrega,hora_entrega,observaciones,estado,pago_estado,total,costo_envio,saldo_pendiente,entrega_mensajero,pedido_detalle(cantidad,productos(nombre))")
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
  const fechas = useMemo(() => Array.from(new Set(activos.map((pedido) => pedido.fecha_entrega?.slice(0, 10)).filter((valor): valor is string => Boolean(valor)))).sort(), [activos]);
  const opciones = (campo: "departamento_entrega" | "municipio_entrega" | "zona_entrega", base: Pedido[]) => Array.from(new Set(base.map((pedido) => pedido[campo]?.trim()).filter((valor): valor is string => Boolean(valor)))).sort((a, b) => a.localeCompare(b, "es-GT", { numeric: true, sensitivity: "base" }));
  const base = useMemo(() => activos.filter((pedido) => (!fecha || pedido.fecha_entrega?.slice(0, 10) === fecha) && (tipo === "Todas" || (tipo === "Mensajería externa" ? pedido.entrega_mensajero : !pedido.entrega_mensajero)) && (estado === "Todos" || (estado === "Por entregar" ? normalizar(pedido.estado) !== "entregado" : normalizar(pedido.estado) === "entregado"))), [activos, fecha, tipo, estado]);
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

  if (!listo) return <p className="p-8 text-sm text-slate-500">Cargando…</p>;
  if (!autorizado) return <div className="p-8"><h1 className="text-2xl font-black">Mensajería y envíos</h1><p className="mt-2 text-slate-600">Necesitas acceso a Pedidos para consultar las entregas.</p></div>;

  return <div className="mensajeria-print min-h-screen bg-slate-50 px-4 py-8 sm:px-7 lg:px-10">
    <div className="mx-auto max-w-[1700px]">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.24em] text-orange-600">Cocina y entregas</p><h1 className="mt-2 text-4xl font-black text-slate-950">Mensajería y envíos</h1><p className="mt-2 text-sm text-slate-600">Hoja de entregas para el mensajero, con datos actuales de los pedidos.</p></div><div className="flex gap-2 print:hidden"><button onClick={() => void cargar()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"><RefreshCw size={16}/>Actualizar</button><button onClick={() => window.print()} disabled={cargando || !visibles.length} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Printer size={16}/>Imprimir hoja</button></div></header>
      <section className="mt-7 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 print:hidden">
        <label className="text-xs font-bold text-slate-600">Fecha de entrega<select value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${input} mt-1.5`}><option value="">Todas las fechas</option>{fecha && !fechas.includes(fecha) && <option value={fecha}>{fecha}</option>}{fechas.map((valor) => <option key={valor} value={valor}>{fechaHumana(valor)}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Tipo de entrega<select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${input} mt-1.5`}>{["Mensajería externa", "Nuestro equipo", "Todas"].map((valor) => <option key={valor}>{valor}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Estado<select value={estado} onChange={(e) => setEstado(e.target.value)} className={`${input} mt-1.5`}>{["Por entregar", "Entregado", "Todos"].map((valor) => <option key={valor}>{valor}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Departamento<select value={departamento} onChange={(e) => { setDepartamento(e.target.value); setMunicipio("Todos"); setZona("Todas"); }} className={`${input} mt-1.5`}><option>Todos</option>{departamentos.map((valor) => <option key={valor}>{valor}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Municipio<select value={municipio} onChange={(e) => { setMunicipio(e.target.value); setZona("Todas"); }} className={`${input} mt-1.5`}><option>Todos</option>{municipios.map((valor) => <option key={valor}>{valor}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Zona<select value={zona} onChange={(e) => setZona(e.target.value)} className={`${input} mt-1.5`}><option>Todas</option>{zonas.map((valor) => <option key={valor}>{valor}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2 lg:col-span-3">Buscar cliente, pedido, dirección o producto<input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, código, teléfono, producto…" className={`${input} mt-1.5`}/></label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2 lg:col-span-3">Ordenar por<select value={orden} onChange={(e) => setOrden(e.target.value)} className={`${input} mt-1.5`}>{["Municipio, zona y cliente", "Departamento, municipio y zona", "Zona y cliente", "Cliente A–Z"].map((valor) => <option key={valor}>{valor}</option>)}</select></label>
      </section>
      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">{[["Pedidos", resumen.pedidos], ["Unidades", resumen.unidades], ["Por cobrar", dinero(resumen.porCobrar)], ["Envío cobrado", dinero(resumen.envios)]].map(([etiqueta, valor]) => <div key={etiqueta} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">{etiqueta}</p><p className="mt-1 text-2xl font-black text-slate-950">{valor}</p></div>)}</section>
      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:mt-0 print:rounded-none print:border-0 print:shadow-none"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-5 print:px-0"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Hoja para reparto</p><h2 className="mt-1 text-xl font-black text-slate-950">Entregas {fecha ? `· ${fechaHumana(fecha)}` : "· todas las fechas"}</h2><p className="text-xs text-slate-500">{tipo} · {estado} · {resumen.pedidos} pedidos · {resumen.unidades} unidades</p></div><Truck className="text-orange-500 print:hidden" size={28}/></div>
        {error && <p role="alert" className="p-6 text-sm font-semibold text-rose-700">{error}</p>}
        {cargando ? <p className="p-8 text-sm text-slate-500">Cargando entregas…</p> : !visibles.length ? <p className="p-8 text-sm text-slate-500">No hay envíos con estos filtros. Elige otra fecha, estado o tipo de entrega.</p> : <><div className="overflow-x-auto"><table className="w-full min-w-[1450px] border-collapse text-left text-xs print:min-w-0"><thead className="bg-slate-100 text-[11px] font-bold uppercase text-slate-600"><tr>{["# / pedido", "Cliente / teléfono", "Dirección", "Departamento", "Municipio", "Zona", "Horario / observaciones", "Productos", "Pago / por cobrar", "Total pedido", "Envío"].map((titulo) => <th key={titulo} className="border-b border-slate-200 px-3 py-3 align-top">{titulo}</th>)}</tr></thead><tbody>{visibles.map((pedido, indice) => <tr key={pedido.id} className="border-b border-slate-100 align-top even:bg-slate-50/60"><td className="px-3 py-3 font-bold text-slate-700">{indice + 1}<br/><Link href={`/pedidos/${pedido.id}`} className="font-mono text-[11px] text-orange-700 underline print:no-underline">{texto(pedido.codigo)}</Link></td><td className="px-3 py-3"><b>{texto(pedido.cliente)}</b><br/><span className="text-slate-600">{texto(pedido.telefono)}</span></td><td className="max-w-48 px-3 py-3">{texto(pedido.direccion)}</td><td className="px-3 py-3">{texto(pedido.departamento_entrega)}</td><td className="px-3 py-3 font-semibold">{texto(pedido.municipio_entrega)}</td><td className="px-3 py-3">{texto(pedido.zona_entrega)}</td><td className="max-w-52 px-3 py-3">{pedido.hora_entrega && <p className="font-bold">{pedido.hora_entrega}</p>}<p className="whitespace-pre-wrap">{texto(pedido.observaciones)}</p></td><td className="max-w-56 px-3 py-3">{(pedido.pedido_detalle || []).length ? pedido.pedido_detalle?.map((item, itemIndice) => <div key={itemIndice}>{Number(item.cantidad || 0)}× {item.productos?.nombre || "Producto eliminado"}</div>) : "Sin detalle"}</td><td className="px-3 py-3"><span className={pedido.pago_estado === "Pagado" ? "font-bold text-emerald-700" : "font-bold text-rose-700"}>{texto(pedido.pago_estado)}</span><br/><span className="text-slate-500">Saldo: {dinero(pedido.saldo_pendiente ?? (pedido.pago_estado === "Pagado" ? 0 : pedido.total))}</span></td><td className="px-3 py-3 font-bold">{dinero(pedido.total)}</td><td className="px-3 py-3">{dinero(pedido.costo_envio)}</td></tr>)}</tbody><tfoot className="bg-orange-50 font-black"><tr><td colSpan={9} className="px-3 py-3">Total · {resumen.pedidos} pedidos</td><td className="px-3 py-3">{dinero(visibles.reduce((suma, pedido) => suma + Number(pedido.total || 0), 0))}</td><td className="px-3 py-3">{dinero(resumen.envios)}</td></tr></tfoot></table></div><p className="px-5 py-3 text-xs text-slate-500 print:px-0">El total del pedido incluye el envío; «por cobrar» muestra el saldo pendiente registrado. Las observaciones se muestran tal como fueron guardadas en el pedido.</p></>}
      </section>
    </div>
  </div>;
}
