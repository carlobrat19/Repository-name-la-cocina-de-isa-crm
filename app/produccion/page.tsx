"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const ETAPAS = ["Pendiente", "Producción", "Empaquetado", "En Ruta", "Entregado"] as const;
type Etapa = (typeof ETAPAS)[number];
type Pedido = { id: string; codigo: string | null; cliente: string | null; estado: string | null; vendedor: string | null; fecha_pedido: string | null; fecha_entrega: string | null; observaciones: string | null; requiere_envio: boolean | null; entrega_mensajero: boolean | null };
type Detalle = { pedido_id: string; producto_id: string | null; cantidad: number | string | null };
type Producto = { id: string; nombre: string; categoria: string | null; tipo_producto?: "preparado" | "reventa" | "combo" };
type ComponenteCombo = { combo_id: string; producto_id: string; cantidad: number | string };
type Avance = { pedido_id: string; producto_id: string; cantidad_preparada: number | string };
type Tanda = { clave: string; producto: Producto | undefined; fecha: string; pedidos: { pedido: Pedido; cantidad: number }[]; unidades: number };

const color: Record<Etapa, string> = { Pendiente: "bg-amber-50 text-amber-800", Producción: "bg-blue-50 text-blue-800", Empaquetado: "bg-violet-50 text-violet-800", "En Ruta": "bg-orange-50 text-orange-800", Entregado: "bg-emerald-50 text-emerald-800" };
const estadoPedido = (valor: string | null): Etapa => ETAPAS.includes(valor as Etapa) ? valor as Etapa : "Pendiente";
async function cargarPaginado(tabla: string, columnas: string, ordenarPor: string[]) {
  const filas: Record<string, unknown>[] = [];
  const tamano = 500;
  for (let pagina = 0; ; pagina += 1) {
    let consulta = supabase.from(tabla).select(columnas);
    for (const columna of ordenarPor) consulta = consulta.order(columna, { ascending: true });
    consulta = consulta.range(pagina * tamano, (pagina + 1) * tamano - 1);
    const { data, error } = await consulta;
    if (error) throw error;
    filas.push(...((data || []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < tamano) return filas;
  }
}

export default function ProduccionPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [detalles, setDetalles] = useState<Detalle[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [componentesCombo, setComponentesCombo] = useState<ComponenteCombo[]>([]);
  const [avances, setAvances] = useState<Avance[]>([]);
  const [cantidadesEditadas, setCantidadesEditadas] = useState<Record<string, string>>({});
  const [vista, setVista] = useState<"tandas" | "pedidos" | "productos">("tandas");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [procesandoTanda, setProcesandoTanda] = useState(false);
  const [resultadoTanda, setResultadoTanda] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [vendedorFiltro, setVendedorFiltro] = useState("Todos");
  const [tipoEntregaFiltro, setTipoEntregaFiltro] = useState("Todos");
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
    try {
      const [pedidosData, detallesData, productosData, componentesData, avancesData] = await Promise.all([
        cargarPaginado("pedidos", "id,codigo,cliente,estado,vendedor,fecha_pedido,fecha_entrega,observaciones,requiere_envio,entrega_mensajero", ["fecha_entrega", "id"]),
        cargarPaginado("pedido_detalle", "pedido_id,producto_id,cantidad", ["id"]),
        cargarPaginado("productos", "id,nombre,categoria,tipo_producto", ["id"]),
        cargarPaginado("combo_componentes", "combo_id,producto_id,cantidad", ["combo_id", "producto_id"]),
        cargarPaginado("avance_preparacion_pedido", "pedido_id,producto_id,cantidad_preparada", ["pedido_id", "producto_id"]),
      ]);
      setPedidos(pedidosData as Pedido[]);
      setDetalles(detallesData as Detalle[]);
      setProductos(productosData as Producto[]);
      setComponentesCombo(componentesData as ComponenteCombo[]);
      setAvances(avancesData as Avance[]);
      setUltimaActualizacion(new Date().toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" }));
    } catch (error) {
      console.error(error);
      setErrorCarga("No se pudo actualizar el panel. Revisa tu conexión e inténtalo de nuevo.");
    } finally { setCargando(false); }
  }

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, []);

  async function cambiarEstado(pedido: Pedido, nuevoEstado: Etapa) {
    if (nuevoEstado === pedido.estado) return;
    setActualizando(pedido.id);
    const { error } = await supabase.rpc("cambiar_estado_pedido_seguro", {
      p_pedido_id: pedido.id,
      p_estado: nuevoEstado,
    });
    setActualizando(null);
    if (error) { alert(`No se pudo cambiar la etapa: ${error.message}`); console.error(error); return; }
    await cargar();
  }

  const productosPorId = useMemo(() => new Map(productos.map((producto) => [producto.id, producto])), [productos]);
  const pedidosOperativos = useMemo(() => pedidos.filter((pedido) => !["Cancelado", "Anulado"].includes(pedido.estado || "")), [pedidos]);
  const vendedores = useMemo(() => Array.from(new Set(pedidosOperativos.map((pedido) => pedido.vendedor).filter(Boolean))) as string[], [pedidosOperativos]);
  const pedidosFiltrados = useMemo(() => pedidosOperativos.filter((pedido) => {
    const texto = `${pedido.codigo || ""} ${pedido.cliente || ""} ${pedido.vendedor || ""}`.toLowerCase();
    const fechaPedido = pedido.fecha_pedido || ""; const fechaEntrega = pedido.fecha_entrega || "";
    const coincideEntrega = tipoEntregaFiltro === "Todos" || (tipoEntregaFiltro === "Mensajería externa" ? pedido.requiere_envio && pedido.entrega_mensajero : tipoEntregaFiltro === "Nuestro equipo" ? pedido.requiere_envio && !pedido.entrega_mensajero : !pedido.requiere_envio);
    return texto.includes(busqueda.toLowerCase()) && (estadoFiltro === "Todos" || pedido.estado === estadoFiltro) && (vendedorFiltro === "Todos" || pedido.vendedor === vendedorFiltro) && coincideEntrega && (!fechaPedidoInicio || fechaPedido >= fechaPedidoInicio) && (!fechaPedidoFin || fechaPedido <= fechaPedidoFin) && (!fechaEntregaInicio || fechaEntrega >= fechaEntregaInicio) && (!fechaEntregaFin || fechaEntrega <= fechaEntregaFin);
  }), [pedidosOperativos, busqueda, estadoFiltro, vendedorFiltro, tipoEntregaFiltro, fechaPedidoInicio, fechaPedidoFin, fechaEntregaInicio, fechaEntregaFin]);
  const itemsPedido = (pedidoId: string) => detalles.filter((detalle) => detalle.pedido_id === pedidoId);
  const metricas = useMemo(() => Object.fromEntries(ETAPAS.map((estado) => [estado, pedidosFiltrados.filter((pedido) => estadoPedido(pedido.estado) === estado).length])) as Record<Etapa, number>, [pedidosFiltrados]);
  const resumenProductos = useMemo(() => {
    const resumen = new Map<string, { producto?: Producto; total: number; porEtapa: Record<Etapa, number> }>();
    pedidosFiltrados.forEach((pedido) => detalles.filter((detalle) => detalle.pedido_id === pedido.id).forEach((detalle) => {
      const producto = detalle.producto_id ? productosPorId.get(detalle.producto_id) : undefined;
      const cantidad = Number(detalle.cantidad || 0);
      const componentes = producto?.tipo_producto === "combo" ? componentesCombo.filter((componente) => componente.combo_id === producto.id) : [];
      const requeridos = componentes.length ? componentes.map((componente) => ({ productoId: componente.producto_id, cantidad: cantidad * Number(componente.cantidad) })) : [{ productoId: detalle.producto_id || "eliminado", cantidad }];
      requeridos.forEach((requerido) => { const actual = resumen.get(requerido.productoId) || { producto: requerido.productoId === "eliminado" ? undefined : productosPorId.get(requerido.productoId), total: 0, porEtapa: { Pendiente: 0, Producción: 0, Empaquetado: 0, "En Ruta": 0, Entregado: 0 } }; actual.total += requerido.cantidad; actual.porEtapa[estadoPedido(pedido.estado)] += requerido.cantidad; resumen.set(requerido.productoId, actual); });
    }));
    return Array.from(resumen.values()).sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados, detalles, productosPorId, componentesCombo]);
  const tandas = useMemo(() => {
    const grupos = new Map<string, Tanda>();
    const componentesPorCombo = new Map<string, ComponenteCombo[]>();
    componentesCombo.forEach((componente) => componentesPorCombo.set(componente.combo_id, [...(componentesPorCombo.get(componente.combo_id) || []), componente]));
    const detallePorPedido = new Map<string, Detalle[]>();
    detalles.forEach((detalle) => detallePorPedido.set(detalle.pedido_id, [...(detallePorPedido.get(detalle.pedido_id) || []), detalle]));
    pedidosFiltrados.filter((pedido) => ["Pendiente", "Producción"].includes(estadoPedido(pedido.estado))).forEach((pedido) => {
      const cantidades = new Map<string, number>();
      (detallePorPedido.get(pedido.id) || []).forEach((detalle) => {
        const producto = detalle.producto_id ? productosPorId.get(detalle.producto_id) : undefined;
        if (!producto) return;
        const cantidad = Number(detalle.cantidad || 0);
        const componentes = producto.tipo_producto === "combo" ? componentesPorCombo.get(producto.id) || [] : [];
        const requeridos = componentes.length ? componentes.map((componente) => ({ id: componente.producto_id, cantidad: cantidad * Number(componente.cantidad) })) : [{ id: producto.id, cantidad }];
        requeridos.forEach((requerido) => { if (Number.isFinite(requerido.cantidad) && requerido.cantidad > 0) cantidades.set(requerido.id, (cantidades.get(requerido.id) || 0) + requerido.cantidad); });
      });
      cantidades.forEach((cantidad, productoId) => {
        const fecha = pedido.fecha_entrega || "Sin fecha";
        const clave = `${fecha}:${productoId}`;
        const actual = grupos.get(clave) || { clave, producto: productosPorId.get(productoId), fecha, pedidos: [], unidades: 0 };
        actual.pedidos.push({ pedido, cantidad });
        actual.unidades += cantidad;
        grupos.set(clave, actual);
      });
    });
    return Array.from(grupos.values()).sort((a, b) => a.fecha.localeCompare(b.fecha) || b.unidades - a.unidades);
  }, [pedidosFiltrados, detalles, productosPorId, componentesCombo]);
  const claveSeleccion = (tanda: Tanda, pedidoId: string) => `${tanda.clave}:${pedidoId}`;
  const avancePorPedidoProducto = useMemo(() => new Map(avances.map((avance) => [`${avance.pedido_id}:${avance.producto_id}`, Number(avance.cantidad_preparada)])), [avances]);
  const requeridosPorPedido = useMemo(() => {
    const resultado = new Map<string, Map<string, number>>();
    detalles.forEach((detalle) => {
      if (!detalle.producto_id) return;
      const producto = productosPorId.get(detalle.producto_id);
      if (!producto) return;
      const componentes = producto.tipo_producto === "combo" ? componentesCombo.filter((componente) => componente.combo_id === producto.id) : [];
      const lineas = componentes.length ? componentes.map((componente) => ({ id: componente.producto_id, cantidad: Number(detalle.cantidad) * Number(componente.cantidad) })) : [{ id: producto.id, cantidad: Number(detalle.cantidad) }];
      const porProducto = resultado.get(detalle.pedido_id) || new Map<string, number>();
      lineas.forEach((linea) => porProducto.set(linea.id, (porProducto.get(linea.id) || 0) + linea.cantidad));
      resultado.set(detalle.pedido_id, porProducto);
    });
    return resultado;
  }, [detalles, productosPorId, componentesCombo]);
  const listoParaEmpacar = (pedidoId: string) => {
    const requeridos = requeridosPorPedido.get(pedidoId);
    return Boolean(requeridos?.size && Array.from(requeridos.entries()).every(([productoId, cantidad]) => (avancePorPedidoProducto.get(`${pedidoId}:${productoId}`) || 0) >= cantidad));
  };
  const alternarSeleccion = (id: string) => setSeleccion((actual) => actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id]);
  const alternarTodaTanda = (tanda: Tanda) => setSeleccion((actual) => {
    const claves = tanda.pedidos.map(({ pedido }) => claveSeleccion(tanda, pedido.id));
    const todasSeleccionadas = claves.every((clave) => actual.includes(clave));
    return todasSeleccionadas
      ? actual.filter((clave) => !claves.includes(clave))
      : Array.from(new Set([...actual, ...claves]));
  });
  async function iniciarTanda(tanda: Tanda) {
    const elegidos = tanda.pedidos.map(({ pedido }) => pedido).filter((pedido) => pedido.estado === "Pendiente" && seleccion.includes(claveSeleccion(tanda, pedido.id)));
    if (!elegidos.length || procesandoTanda) return;
    const unidades = tanda.pedidos.filter(({ pedido }) => seleccion.includes(claveSeleccion(tanda, pedido.id))).reduce((total, item) => total + item.cantidad, 0);
    if (!window.confirm(`Iniciar producción de ${elegidos.length} pedido(s) con ${unidades} unidad(es) de ${tanda.producto?.nombre || "este producto"}? Se descontarán los ingredientes de TODOS los productos de cada pedido según la receta actual.`)) return;
    setProcesandoTanda(true); setResultadoTanda("");
    let completados = 0;
    for (const pedido of elegidos) {
      const { error } = await supabase.rpc("cambiar_estado_pedido_seguro", { p_pedido_id: pedido.id, p_estado: "Producción" });
      if (error) { setResultadoTanda(`${completados} pedido(s) iniciados. Se detuvo en ${pedido.codigo || pedido.cliente || "un pedido"}: ${error.message}. Los anteriores sí quedaron registrados; revisa antes de reintentar.`); break; }
      completados += 1;
    }
    if (completados === elegidos.length) setResultadoTanda(`${completados} pedido(s) iniciados. Se respetó el control de inventario existente por pedido.`);
    setSeleccion((actual) => actual.filter((id) => !elegidos.some((pedido) => id === claveSeleccion(tanda, pedido.id))));
    setProcesandoTanda(false);
    await cargar();
  }
  async function completarTanda(tanda: Tanda) {
    if (!tanda.producto || procesandoTanda) return;
    const elegidos = tanda.pedidos.filter(({ pedido, cantidad }) => pedido.estado === "Producción" && seleccion.includes(claveSeleccion(tanda, pedido.id)) && (avancePorPedidoProducto.get(`${pedido.id}:${tanda.producto?.id}`) || 0) < cantidad);
    if (!elegidos.length) return;
    setProcesandoTanda(true); setResultadoTanda("");
    let completados = 0;
    for (const { pedido, cantidad } of elegidos) {
      const { error } = await supabase.rpc("guardar_avance_preparacion", { p_pedido_id: pedido.id, p_producto_id: tanda.producto.id, p_cantidad: cantidad });
      if (error) { setResultadoTanda(`${completados} pedido(s) marcados. Se detuvo en ${pedido.codigo || pedido.cliente || "un pedido"}: ${error.message}.`); break; }
      completados += 1;
    }
    if (completados === elegidos.length) setResultadoTanda(`${completados} pedido(s) con ${tanda.producto.nombre} preparados. Este avance no vuelve a descontar ingredientes.`);
    setSeleccion((actual) => actual.filter((id) => !elegidos.some(({ pedido }) => id === claveSeleccion(tanda, pedido.id))));
    setProcesandoTanda(false);
    await cargar();
  }
  async function guardarCantidadPreparada(tanda: Tanda, pedido: Pedido, cantidadRequerida: number) {
    if (!tanda.producto || procesandoTanda) return;
    const clave = `${pedido.id}:${tanda.producto.id}`;
    const cantidad = Number(cantidadesEditadas[clave] ?? avancePorPedidoProducto.get(clave) ?? 0);
    if (!Number.isFinite(cantidad) || cantidad < 0 || cantidad > cantidadRequerida) {
      setResultadoTanda(`Indica una cantidad entre 0 y ${cantidadRequerida} para ${pedido.codigo || pedido.cliente || "el pedido"}.`);
      return;
    }
    setProcesandoTanda(true); setResultadoTanda("");
    const { error } = await supabase.rpc("guardar_avance_preparacion", { p_pedido_id: pedido.id, p_producto_id: tanda.producto.id, p_cantidad: cantidad });
    setProcesandoTanda(false);
    if (error) { setResultadoTanda(`No se pudo guardar el avance: ${error.message}`); return; }
    setCantidadesEditadas((actual) => { const nuevo = { ...actual }; delete nuevo[clave]; return nuevo; });
    await cargar();
  }
  const limpiar = () => { setBusqueda(""); setEstadoFiltro("Todos"); setVendedorFiltro("Todos"); setTipoEntregaFiltro("Todos"); setFechaPedidoInicio(""); setFechaPedidoFin(""); setFechaEntregaInicio(""); setFechaEntregaFin(""); };

  const pedidosMensajeria = pedidosFiltrados.filter((pedido) => pedido.requiere_envio && pedido.entrega_mensajero).length;

  return <main className="min-h-screen bg-slate-100 px-4 py-7 sm:px-7 lg:px-10"><div className="mx-auto max-w-[1600px]">
    <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-orange-600">Operación de cocina</p><h1 className="mt-2 text-4xl font-black text-slate-950">Panel de producción</h1><p className="mt-2 text-sm text-slate-600">Visualiza cada pedido, actualiza sus etapas y calcula los productos que la cocina debe preparar.</p>{ultimaActualizacion && <p className="mt-2 text-xs font-semibold text-slate-400">Actualizado a las {ultimaActualizacion}</p>}</div><div className="flex gap-3"><Link href="/pedidos/lista" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold">Ver pedidos</Link><button disabled={cargando} onClick={() => void cargar()} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{cargando ? "Actualizando…" : "Actualizar"}</button></div></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{ETAPAS.map((estado) => <button key={estado} onClick={() => setEstadoFiltro(estado)} className={`rounded-2xl p-4 text-left ${color[estado]}`}><p className="text-xs font-bold uppercase">{estado}</p><p className="mt-2 text-3xl font-black">{metricas[estado]}</p><p className="mt-1 text-xs">{estado === "Producción" ? "en cocina ahora" : "pedidos"}</p></button>)}<div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-800"><p className="text-xs font-bold uppercase">Mensajería</p><p className="mt-2 text-3xl font-black">{pedidosMensajeria}</p><p className="mt-1 text-xs">pedidos filtrados</p></div></section>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 xl:flex-row"><div className="inline-flex rounded-xl bg-slate-100 p-1"><button onClick={() => setVista("tandas")} className={`rounded-lg px-4 py-2 text-sm font-bold ${vista === "tandas" ? "bg-slate-950 text-white" : "text-slate-600"}`}>Tandas</button><button onClick={() => setVista("pedidos")} className={`rounded-lg px-4 py-2 text-sm font-bold ${vista === "pedidos" ? "bg-slate-950 text-white" : "text-slate-600"}`}>Por pedidos</button><button onClick={() => setVista("productos")} className={`rounded-lg px-4 py-2 text-sm font-bold ${vista === "productos" ? "bg-slate-950 text-white" : "text-slate-600"}`}>Por productos</button></div><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Código, cliente o responsable" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"/><select value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option>Todos</option>{ETAPAS.map((estado) => <option key={estado}>{estado}</option>)}</select><select value={vendedorFiltro} onChange={(event) => setVendedorFiltro(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option>Todos</option>{vendedores.map((vendedor) => <option key={vendedor}>{vendedor}</option>)}</select><select value={tipoEntregaFiltro} onChange={(event) => setTipoEntregaFiltro(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="Todos">Todas las entregas</option><option>Mensajería externa</option><option>Nuestro equipo</option><option>Recoger en tienda</option></select><button onClick={limpiar} className="text-sm font-bold text-slate-500 underline">Limpiar</button></div><div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4"><label className="text-xs font-bold text-slate-500">Toma del pedido — desde<input type="date" value={fechaPedidoInicio} onChange={(event) => setFechaPedidoInicio(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"/></label><label className="text-xs font-bold text-slate-500">Toma del pedido — hasta<input type="date" value={fechaPedidoFin} onChange={(event) => setFechaPedidoFin(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"/></label><label className="text-xs font-bold text-slate-500">Entrega — desde<input type="date" value={fechaEntregaInicio} onChange={(event) => setFechaEntregaInicio(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"/></label><label className="text-xs font-bold text-slate-500">Entrega — hasta<input type="date" value={fechaEntregaFin} onChange={(event) => setFechaEntregaFin(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"/></label></div>{errorCarga && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{errorCarga}</p>}</section>
    {resultadoTanda && <p role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">{resultadoTanda}</p>}
    {vista === "tandas" && <section className="mt-6 space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Preparación por producto y fecha.</strong> Inicia pedidos con la misma operación segura de siempre; luego marca las unidades listas. El avance no vuelve a descontar ingredientes. Las unidades sobrantes aún no se registran aquí como inventario.
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{tandas.map((tanda) => {
        const elegidos = tanda.pedidos.filter(({ pedido }) => seleccion.includes(claveSeleccion(tanda, pedido.id)));
        const todosSeleccionados = elegidos.length === tanda.pedidos.length;
        const pendientesElegidos = elegidos.filter(({ pedido }) => pedido.estado === "Pendiente");
        const produccionElegidos = elegidos.filter(({ pedido, cantidad }) => pedido.estado === "Producción" && (avancePorPedidoProducto.get(`${pedido.id}:${tanda.producto?.id}`) || 0) < cantidad);
        const unidadesElegidas = elegidos.reduce((total, item) => total + item.cantidad, 0);
        const unidadesListas = tanda.pedidos.reduce((total, { pedido, cantidad }) => total + Math.min(cantidad, avancePorPedidoProducto.get(`${pedido.id}:${tanda.producto?.id}`) || 0), 0);
        return <article key={tanda.clave} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 p-5">
            <div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Entrega {tanda.fecha}</p><h2 className="mt-1 text-lg font-black text-slate-950">{tanda.producto?.nombre || "Producto eliminado"}</h2><p className="text-sm text-slate-600">{tanda.pedidos.length} pedidos · {unidadesListas} de {tanda.unidades} unidades listas</p></div>
            <div className="flex items-center gap-2"><button type="button" onClick={() => alternarTodaTanda(tanda)} disabled={procesandoTanda} aria-pressed={todosSeleccionados} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 disabled:opacity-40">{todosSeleccionados ? "Quitar selección" : "Seleccionar todos"}</button><span className="rounded-xl bg-orange-100 px-3 py-2 text-lg font-black text-orange-700">{tanda.unidades}</span></div>
          </div>
          <div className="max-h-[380px] divide-y divide-slate-100 overflow-y-auto">{tanda.pedidos.map(({ pedido, cantidad }) => {
            const preparadas = Math.min(cantidad, avancePorPedidoProducto.get(`${pedido.id}:${tanda.producto?.id}`) || 0);
            return <div key={pedido.id} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-orange-50">
              <input type="checkbox" aria-label={`Seleccionar ${pedido.codigo || pedido.cliente || "pedido"}`} checked={seleccion.includes(claveSeleccion(tanda, pedido.id))} onChange={() => alternarSeleccion(claveSeleccion(tanda, pedido.id))} disabled={procesandoTanda} className="h-4 w-4 accent-orange-600"/>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-950">{pedido.codigo || "Sin código"} · {pedido.cliente || "Sin cliente"}</span><span className="text-xs text-slate-500">{pedido.vendedor || "Sin responsable"} · {pedido.estado}</span></span>
              <span className="whitespace-nowrap text-sm font-black text-orange-700">{preparadas}/{cantidad} uds.</span>
              {pedido.estado === "Producción" && <div className="flex items-center gap-1"><input type="number" min="0" max={cantidad} step="1" aria-label={`Unidades preparadas de ${tanda.producto?.nombre || "producto"} para ${pedido.codigo || "pedido"}`} value={cantidadesEditadas[`${pedido.id}:${tanda.producto?.id}`] ?? String(preparadas)} onChange={(event) => setCantidadesEditadas((actual) => ({ ...actual, [`${pedido.id}:${tanda.producto?.id}`]: event.target.value }))} className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"/><button type="button" disabled={procesandoTanda} onClick={() => void guardarCantidadPreparada(tanda, pedido, cantidad)} className="rounded-lg border border-orange-300 px-2 py-1.5 text-xs font-bold text-orange-700 disabled:opacity-40">Guardar</button></div>}
              {pedido.estado === "Producción" && listoParaEmpacar(pedido.id) && <button type="button" disabled={actualizando === pedido.id || procesandoTanda} onClick={() => void cambiarEstado(pedido, "Empaquetado")} className="rounded-lg bg-violet-100 px-2 py-1.5 text-xs font-bold text-violet-800 disabled:opacity-40">Empaquetar</button>}
              <Link href={`/pedidos/${pedido.id}`} className="text-xs font-bold text-blue-700 underline">Ver</Link>
            </div>;
          })}</div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
            <span className="text-sm font-semibold text-slate-600">Seleccionados: {elegidos.length} pedidos · {unidadesElegidas} uds.</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void iniciarTanda(tanda)} disabled={!pendientesElegidos.length || procesandoTanda} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Iniciar producción ({pendientesElegidos.length})</button>
              <button type="button" onClick={() => void completarTanda(tanda)} disabled={!produccionElegidos.length || procesandoTanda} className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Marcar preparados ({produccionElegidos.length})</button>
            </div>
          </div>
        </article>;
      })}</div>
      {!tandas.length && <p className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500">No hay productos pendientes o en producción con estos filtros.</p>}
    </section>}
    {vista === "pedidos" ? <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-5">{ETAPAS.map((estado) => <div key={estado} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className={`p-4 ${color[estado]}`}><p className="font-black">{estado}</p><p className="text-xs">{metricas[estado]} pedidos</p></div><div className="max-h-[680px] space-y-3 overflow-y-auto p-3">{pedidosFiltrados.filter((pedido) => estadoPedido(pedido.estado) === estado).map((pedido) => <article key={pedido.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-2"><div><p className="font-mono text-[11px] font-bold text-orange-600">{pedido.codigo || "SIN CÓDIGO"}</p><h2 className="mt-1 font-black">{pedido.cliente || "Cliente sin nombre"}</h2><p className="mt-1 text-xs text-slate-500">Entrega: {pedido.fecha_entrega || "Sin fecha"} · {pedido.vendedor || "Sin responsable"}</p><p className="mt-1 text-xs font-bold text-violet-700">{pedido.requiere_envio ? (pedido.entrega_mensajero ? "Mensajería externa" : "Entrega por nuestro equipo") : "Recoger en tienda"}</p></div><Link href={`/pedidos/${pedido.id}`} className="text-xs font-bold text-orange-600">Ver</Link></div><div className="mt-4 space-y-1">{itemsPedido(pedido.id).map((item, index) => <p key={`${item.producto_id}-${index}`} className="text-sm font-semibold text-slate-700">{Number(item.cantidad)}× {productosPorId.get(item.producto_id || "")?.nombre || "Producto"}</p>)}</div><div className="mt-4 flex gap-1">{ETAPAS.map((paso, indice) => <span key={paso} className={`h-1.5 flex-1 rounded-full ${indice <= ETAPAS.indexOf(estadoPedido(pedido.estado)) ? "bg-orange-500" : "bg-slate-200"}`}/>)}</div><select value={estadoPedido(pedido.estado)} disabled={actualizando === pedido.id} onChange={(event) => void cambiarEstado(pedido, event.target.value as Etapa)} className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"><option value="Pendiente">Pendiente</option><option value="Producción">En producción</option><option value="Empaquetado">Empaquetado</option><option value="En Ruta">En ruta</option><option value="Entregado">Entregado</option></select>{pedido.observaciones && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Nota: {pedido.observaciones}</p>}</article>)}{!pedidosFiltrados.some((pedido) => estadoPedido(pedido.estado) === estado) && <p className="p-6 text-center text-sm text-slate-500">No hay pedidos en esta etapa.</p>}</div></div>)}</section> : vista === "productos" ? <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-500">Plan de trabajo</p><h2 className="mt-2 text-2xl font-black">Productos requeridos por etapa</h2><p className="mt-1 text-sm text-slate-500">Totales consolidados de los pedidos filtrados.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Producto</th><th className="p-4">Categoría</th>{ETAPAS.map((estado) => <th key={estado} className="p-4 text-right">{estado}</th>)}<th className="p-4 text-right">Total</th></tr></thead><tbody>{resumenProductos.map((fila, index) => <tr key={fila.producto?.id || index} className="border-t border-slate-100"><td className="p-4 font-black">{fila.producto?.nombre || "Producto eliminado"}</td><td className="p-4 text-slate-500">{fila.producto?.categoria || "—"}</td>{ETAPAS.map((estado) => <td key={estado} className="p-4 text-right font-bold">{fila.porEtapa[estado] || "—"}</td>)}<td className="p-4 text-right text-lg font-black text-orange-600">{fila.total}</td></tr>)}{!resumenProductos.length && <tr><td colSpan={8} className="p-12 text-center text-slate-500">No hay productos para los filtros seleccionados.</td></tr>}</tbody></table></div></section> : null}
  </div></main>;
}
