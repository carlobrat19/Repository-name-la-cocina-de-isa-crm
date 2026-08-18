"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Minus, PackageCheck, Plus, RefreshCw, ShoppingCart, Store, X } from "lucide-react";
import { useCrmAuth } from "@/components/auth/AuthGate";
import { supabase } from "@/lib/supabase";

type Sucursal = { id: string; codigo: string; nombre: string; marca: string; tipo: "cocina" | "punto_venta" | "quiosco" };
type Producto = { id: string; nombre: string; categoria: string | null; precio_venta: number; costo: number | null; imagen_url: string | null; estado: string };
type Inventario = { producto_id: string; existencia: number; stock_minimo: number };
type Cuenta = { id: string; nombre: string; tipo: string; activa: boolean };
type Turno = { id: string; sucursal_id: string; cuenta_id: string; fondo_inicial: number; abierto_at: string; estado: "abierto" | "cerrado" };
type Linea = { producto: Producto; cantidad: number; existencia: number };

const moneda = (valor: number) => new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", minimumFractionDigits: 2 }).format(valor);

export default function PuntoVentaPage() {
  const { id: usuarioId } = useCrmAuth();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]); const [sucursalId, setSucursalId] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]); const [inventario, setInventario] = useState<Inventario[]>([]); const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [turno, setTurno] = useState<Turno | null>(null); const [cuentaId, setCuentaId] = useState(""); const [fondo, setFondo] = useState("");
  const [carrito, setCarrito] = useState<Linea[]>([]); const [busqueda, setBusqueda] = useState(""); const [metodo, setMetodo] = useState("Efectivo"); const [cliente, setCliente] = useState("Consumidor final"); const [telefono, setTelefono] = useState(""); const [referencia, setReferencia] = useState("");
  const [cargando, setCargando] = useState(true); const [guardando, setGuardando] = useState(false); const [mensaje, setMensaje] = useState("");

  async function cargar() {
    setCargando(true); setMensaje("");
    const [sucursalRespuesta, productoRespuesta, cuentaRespuesta] = await Promise.all([
      supabase.from("sucursales").select("id,codigo,nombre,marca,tipo").eq("activa", true).order("nombre"),
      supabase.from("productos").select("id,nombre,categoria,precio_venta,costo,imagen_url,estado").eq("estado", "Activo").order("nombre"),
      supabase.from("cuentas_financieras").select("id,nombre,tipo,activa").eq("activa", true).order("nombre"),
    ]);
    const error = sucursalRespuesta.error || productoRespuesta.error || cuentaRespuesta.error;
    if (error) setMensaje(`No se pudo cargar el POS: ${error.message}`);
    const nuevasSucursales = (sucursalRespuesta.data ?? []) as Sucursal[];
    setSucursales(nuevasSucursales); setProductos((productoRespuesta.data ?? []) as Producto[]); setCuentas((cuentaRespuesta.data ?? []) as Cuenta[]);
    setSucursalId((actual) => actual || nuevasSucursales.find((item) => item.tipo !== "cocina")?.id || nuevasSucursales[0]?.id || "");
    setCuentaId((actual) => actual || (cuentaRespuesta.data ?? []).find((item) => item.tipo === "Caja")?.id || (cuentaRespuesta.data ?? [])[0]?.id || "");
    setCargando(false);
  }

  async function cargarSucursal() {
    if (!sucursalId || !usuarioId) return;
    const [inventarioRespuesta, turnoRespuesta] = await Promise.all([
      supabase.from("inventario_sucursal_productos").select("producto_id,existencia,stock_minimo").eq("sucursal_id", sucursalId),
      supabase.from("turnos_caja_pos").select("id,sucursal_id,cuenta_id,fondo_inicial,abierto_at,estado").eq("sucursal_id", sucursalId).eq("cajero_id", usuarioId).eq("estado", "abierto").maybeSingle(),
    ]);
    const error = inventarioRespuesta.error || turnoRespuesta.error;
    if (error) setMensaje(`No se pudo cargar la caja de sucursal: ${error.message}`);
    setInventario((inventarioRespuesta.data ?? []) as Inventario[]); setTurno((turnoRespuesta.data ?? null) as Turno | null); setCarrito([]);
  }

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void cargarSucursal(), 0); return () => window.clearTimeout(timer); }, [sucursalId, usuarioId]);

  const existencias = useMemo(() => new Map(inventario.map((item) => [item.producto_id, Number(item.existencia)])), [inventario]);
  const catalogo = useMemo(() => productos.filter((producto) => {
    const texto = `${producto.nombre} ${producto.categoria ?? ""}`.toLowerCase(); return existencias.get(producto.id) && texto.includes(busqueda.trim().toLowerCase());
  }), [productos, existencias, busqueda]);
  const total = useMemo(() => carrito.reduce((suma, item) => suma + item.producto.precio_venta * item.cantidad, 0), [carrito]);
  const seleccionada = sucursales.find((item) => item.id === sucursalId);

  function agregar(producto: Producto) {
    const existencia = existencias.get(producto.id) ?? 0;
    setCarrito((actual) => {
      const actualItem = actual.find((item) => item.producto.id === producto.id);
      if (actualItem && actualItem.cantidad >= existencia) return actual;
      if (actualItem) return actual.map((item) => item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...actual, { producto, cantidad: 1, existencia }];
    });
  }
  function cambiarCantidad(productoId: string, diferencia: number) { setCarrito((actual) => actual.flatMap((item) => { if (item.producto.id !== productoId) return [item]; const cantidad = item.cantidad + diferencia; return cantidad <= 0 ? [] : [{ ...item, cantidad: Math.min(cantidad, item.existencia) }]; })); }

  async function abrirCaja(event: FormEvent) {
    event.preventDefault(); if (!usuarioId || !sucursalId || !cuentaId) return;
    setGuardando(true); const { error } = await supabase.from("turnos_caja_pos").insert({ sucursal_id: sucursalId, cuenta_id: cuentaId, cajero_id: usuarioId, fondo_inicial: Number(fondo || 0) }); setGuardando(false);
    if (error) { setMensaje(error.message); return; } setFondo(""); setMensaje("Caja abierta. Ya puedes registrar ventas en esta sucursal."); await cargarSucursal();
  }
  async function cobrar() {
    if (!turno || !carrito.length) { setMensaje(!turno ? "Abre tu caja antes de cobrar." : "Agrega al menos un producto."); return; }
    setGuardando(true); setMensaje(""); const { data, error } = await supabase.rpc("registrar_venta_pos", { p_sucursal_id: sucursalId, p_turno_id: turno.id, p_items: carrito.map((item) => ({ producto_id: item.producto.id, cantidad: item.cantidad })), p_metodo: metodo, p_cliente: cliente, p_telefono: telefono || null, p_referencia: referencia || null }); setGuardando(false);
    if (error) { setMensaje(`No se pudo cobrar: ${error.message}`); return; }
    const resultado = data as { codigo?: string; total?: number }; setCarrito([]); setCliente("Consumidor final"); setTelefono(""); setReferencia(""); setMensaje(`Venta ${resultado.codigo ?? "POS"} cobrada por ${moneda(Number(resultado.total ?? total))}. Ya aparece en caja, cobros, reportes y FEL pendiente.`); await cargarSucursal();
  }
  async function cerrarCaja() {
    if (!turno) return; const contado = window.prompt("¿Cuánto efectivo físico hay al cerrar la caja?", "0"); if (contado === null) return; const efectivo = Number(contado); if (!Number.isFinite(efectivo) || efectivo < 0) { setMensaje("Ingresa un monto válido para el cierre."); return; }
    const { data: ventas, error: ventasError } = await supabase.from("ventas_pos").select("total,pagos!inner(metodo)").eq("turno_id", turno.id);
    if (ventasError) { setMensaje(ventasError.message); return; }
    const esperado = Number(turno.fondo_inicial) + (ventas ?? []).filter((venta: { pagos: { metodo: string } | { metodo: string }[] }) => { const pago = Array.isArray(venta.pagos) ? venta.pagos[0] : venta.pagos; return pago?.metodo?.toLowerCase().includes("efectivo"); }).reduce((suma: number, venta: { total: number }) => suma + Number(venta.total), 0);
    const { error } = await supabase.from("turnos_caja_pos").update({ estado: "cerrado", cerrado_at: new Date().toISOString(), efectivo_esperado: esperado, efectivo_contado: efectivo, diferencia: efectivo - esperado }).eq("id", turno.id);
    if (error) { setMensaje(error.message); return; } setMensaje(`Caja cerrada. Esperado: ${moneda(esperado)} · Contado: ${moneda(efectivo)}.`); await cargarSucursal();
  }

  return <main className="min-h-screen bg-slate-100 px-4 py-7 sm:px-7 lg:px-10"><div className="mx-auto max-w-[1700px]">
    <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-orange-600">Venta de mostrador</p><h1 className="mt-2 text-4xl font-black text-slate-950">Punto de venta</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Cobra en sucursal, descuenta producto terminado y registra automáticamente el pago, caja, reportes y documento pendiente de FEL.</p></div><button onClick={() => void cargarSucursal()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"><RefreshCw size={16}/>Actualizar</button></header>
    {mensaje && <p className={`mb-5 rounded-xl p-4 text-sm font-semibold ${mensaje.startsWith("No se") || mensaje.includes("Error") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{mensaje}</p>}
    <section className="mb-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_310px]"><div><label className="text-xs font-bold uppercase tracking-wide text-slate-500">Sucursal de venta</label><select value={sucursalId} onChange={(event) => setSucursalId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">{sucursales.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><p className="mt-3 text-sm text-slate-500">{seleccionada?.marca ?? ""} · El inventario visible pertenece solo a esta sucursal.</p></div><div className={`rounded-2xl p-4 ${turno ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}><p className="text-xs font-bold uppercase">Caja actual</p><p className="mt-2 text-lg font-black">{turno ? "Abierta" : "Sin abrir"}</p><p className="mt-1 text-sm">{turno ? `Fondo inicial: ${moneda(Number(turno.fondo_inicial))}` : "Abre un turno para cobrar."}</p></div></section>
    {!turno ? <form onSubmit={abrirCaja} className="mb-6 rounded-3xl bg-slate-950 p-6 text-white"><div className="grid gap-4 lg:grid-cols-[1fr_260px_auto]"><label className="text-sm font-bold">Cuenta donde entrará el efectivo<select value={cuentaId} onChange={(event) => setCuentaId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm">{cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre} · {cuenta.tipo}</option>)}</select></label><label className="text-sm font-bold">Fondo inicial (Q)<input type="number" min="0" step="0.01" value={fondo} onChange={(event) => setFondo(event.target.value)} placeholder="0.00" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm"/></label><button disabled={guardando || cargando} className="self-end rounded-xl bg-orange-500 px-6 py-3 text-sm font-black disabled:opacity-60">{guardando ? "Abriendo…" : "Abrir caja"}</button></div></form> : <div className="mb-6 flex justify-end"><button onClick={() => void cerrarCaja()} className="rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-700">Cerrar y cuadrar caja</button></div>}
    <section className="grid gap-6 xl:grid-cols-[1fr_420px]"><div className="rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Productos disponibles</h2><p className="mt-1 text-sm text-slate-500">Solo se muestran productos con existencia en esta sucursal.</p></div><PackageCheck className="text-orange-500"/></div><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar producto o categoría" className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"/></div><div className="grid gap-3 p-5 sm:grid-cols-2 2xl:grid-cols-3">{catalogo.map((producto) => <button type="button" key={producto.id} onClick={() => agregar(producto)} disabled={!turno} className="overflow-hidden rounded-2xl border border-slate-200 text-left transition hover:border-orange-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><div className="flex min-h-20 items-center gap-3 bg-slate-50 p-3">{producto.imagen_url ? <img src={producto.imagen_url} alt="" className="size-14 rounded-xl object-cover"/> : <span className="grid size-14 place-items-center rounded-xl bg-orange-100 text-orange-600"><Store size={22}/></span>}<div className="min-w-0"><p className="truncate text-sm font-black">{producto.nombre}</p><p className="mt-1 text-xs text-slate-500">{producto.categoria || "Sin categoría"}</p></div></div><div className="flex items-end justify-between p-3"><span className="text-lg font-black text-emerald-700">{moneda(Number(producto.precio_venta))}</span><span className="text-right text-xs font-bold text-slate-500">{existencias.get(producto.id)}<br/>disponibles</span></div></button>)}{!cargando && !catalogo.length && <p className="col-span-full rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">No hay producto terminado disponible. Abastece esta sucursal desde “Sucursales”.</p>}</div></div>
      <aside className="h-fit overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between bg-slate-950 p-5 text-white"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Cobro actual</p><h2 className="mt-1 text-xl font-black">Carrito</h2></div><ShoppingCart/></div><div className="max-h-[360px] space-y-3 overflow-y-auto p-5">{carrito.map((item) => <article key={item.producto.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><div><p className="text-sm font-black">{item.producto.nombre}</p><p className="mt-1 text-xs text-slate-500">{moneda(Number(item.producto.precio_venta))} c/u</p></div><button type="button" onClick={() => cambiarCantidad(item.producto.id, -item.cantidad)} className="text-slate-400 hover:text-rose-600"><X size={18}/></button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center rounded-lg border border-slate-200 bg-white"><button type="button" onClick={() => cambiarCantidad(item.producto.id, -1)} className="p-2"><Minus size={15}/></button><b className="min-w-9 text-center text-sm">{item.cantidad}</b><button type="button" onClick={() => cambiarCantidad(item.producto.id, 1)} className="p-2"><Plus size={15}/></button></div><b className="text-emerald-700">{moneda(item.producto.precio_venta * item.cantidad)}</b></div></article>)}{!carrito.length && <p className="rounded-xl bg-slate-50 p-7 text-center text-sm text-slate-500">Elige productos para comenzar la venta.</p>}</div><div className="border-t border-slate-100 p-5"><div className="flex justify-between text-lg font-black"><span>Total</span><span className="text-emerald-700">{moneda(total)}</span></div><div className="mt-5 grid gap-3"><input value={cliente} onChange={(event) => setCliente(event.target.value)} placeholder="Cliente / consumidor final" className="rounded-xl border border-slate-200 p-3 text-sm"/><input value={telefono} onChange={(event) => setTelefono(event.target.value)} placeholder="Teléfono (opcional)" className="rounded-xl border border-slate-200 p-3 text-sm"/><select value={metodo} onChange={(event) => setMetodo(event.target.value)} className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>POS</option></select><input value={referencia} onChange={(event) => setReferencia(event.target.value)} placeholder="Referencia / comprobante" className="rounded-xl border border-slate-200 p-3 text-sm"/><button disabled={guardando || !turno || !carrito.length} onClick={() => void cobrar()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 p-4 text-sm font-black text-white disabled:opacity-50"><Banknote size={18}/>{guardando ? "Cobrando…" : `Cobrar ${moneda(total)}`}</button><p className="text-center text-xs text-slate-500"><CreditCard className="mr-1 inline" size={13}/>El pago se registra en Cobros y FEL y en el Flujo de caja.</p></div></div></aside>
    </section>
  </div></main>;
}
