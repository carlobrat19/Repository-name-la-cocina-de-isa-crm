"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Producto = { id: string; nombre: string; categoria: string | null; precio_venta: number | string; costo: number | string | null };
type Ingrediente = { id: string; nombre: string; unidad_base: "g" | "ml" | "unidad"; costo_referencia: number | string; stock_actual: number | string; activo: boolean };
type LineaReceta = { ingrediente_id: string; cantidad: number };
type RecetaCargada = { id: string; rendimiento: number | string; unidad_rendimiento: string; merma_pct: number | string; margen_pct: number | string; iva_pct: number | string; recargo_carta_pct: number | string; receta_ingredientes: LineaReceta[] };

const dinero = (valor: number) => `Q${valor.toFixed(2)}`;

export default function RecetasPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [modoProducto, setModoProducto] = useState<"existente" | "nuevo">("existente");
  const [productoId, setProductoId] = useState("");
  const [nombreProductoNuevo, setNombreProductoNuevo] = useState("");
  const [categoriaProductoNueva, setCategoriaProductoNueva] = useState("");
  const [precioVentaNuevo, setPrecioVentaNuevo] = useState("");
  const [rendimiento, setRendimiento] = useState("1");
  const [unidadRendimiento, setUnidadRendimiento] = useState("unidad");
  const [merma, setMerma] = useState("0");
  const [margen, setMargen] = useState("35");
  const [iva, setIva] = useState("12");
  const [recargo, setRecargo] = useState("0");
  const [lineas, setLineas] = useState<LineaReceta[]>([]);
  const [ingredienteSeleccionado, setIngredienteSeleccionado] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cargandoReceta, setCargandoReceta] = useState(false);
  const [ingredienteCompra, setIngredienteCompra] = useState("");
  const [cantidadCompra, setCantidadCompra] = useState("");
  const [costoCompra, setCostoCompra] = useState("");
  const [notaCompra, setNotaCompra] = useState("");
  const [registrandoCompra, setRegistrandoCompra] = useState(false);

  const cargarBase = async () => {
    const [productosRespuesta, ingredientesRespuesta] = await Promise.all([
      supabase.from("productos").select("id,nombre,categoria,precio_venta,costo").eq("estado", "Activo").order("nombre"),
      supabase.from("ingredientes").select("id,nombre,unidad_base,costo_referencia,stock_actual,activo").eq("activo", true).order("nombre"),
    ]);
    if (productosRespuesta.error) console.error(productosRespuesta.error);
    if (ingredientesRespuesta.error) console.error(ingredientesRespuesta.error);
    setProductos((productosRespuesta.data || []) as Producto[]);
    setIngredientes((ingredientesRespuesta.data || []) as Ingrediente[]);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void cargarBase(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const cargarReceta = async (id: string) => {
    setProductoId(id);
    setLineas([]);
    if (!id) return;
    setCargandoReceta(true);
    const { data, error } = await supabase
      .from("recetas_estandar")
      .select("id,rendimiento,unidad_rendimiento,merma_pct,margen_pct,iva_pct,recargo_carta_pct,receta_ingredientes(ingrediente_id,cantidad)")
      .eq("producto_id", id)
      .maybeSingle();
    setCargandoReceta(false);
    if (error) { console.error(error); alert("No se pudo cargar la receta."); return; }
    if (!data) {
      setRendimiento("1"); setUnidadRendimiento("unidad"); setMerma("0"); setMargen("35"); setIva("12"); setRecargo("0");
      return;
    }
    const receta = data as unknown as RecetaCargada;
    setRendimiento(String(receta.rendimiento));
    setUnidadRendimiento(receta.unidad_rendimiento || "unidad");
    setMerma(String(Number(receta.merma_pct) * 100));
    setMargen(String(Number(receta.margen_pct) * 100));
    setIva(String(Number(receta.iva_pct) * 100));
    setRecargo(String(Number(receta.recargo_carta_pct) * 100));
    setLineas((receta.receta_ingredientes || []).map((linea) => ({ ingrediente_id: linea.ingrediente_id, cantidad: Number(linea.cantidad) })));
  };

  const agregarLinea = () => {
    const cantidadNumerica = Number(cantidad);
    if (!ingredienteSeleccionado || !cantidadNumerica || cantidadNumerica <= 0) { alert("Selecciona un ingrediente e ingresa una cantidad válida."); return; }
    if (lineas.some((linea) => linea.ingrediente_id === ingredienteSeleccionado)) { alert("Ese ingrediente ya está en la receta. Ajusta su cantidad en la lista."); return; }
    setLineas([...lineas, { ingrediente_id: ingredienteSeleccionado, cantidad: cantidadNumerica }]);
    setIngredienteSeleccionado(""); setCantidad("");
  };

  const detalleLineas = useMemo(() => lineas.map((linea) => ({ ...linea, ingrediente: ingredientes.find((ingrediente) => ingrediente.id === linea.ingrediente_id) })).filter((linea) => linea.ingrediente), [lineas, ingredientes]);
  const costoBase = detalleLineas.reduce((total, linea) => total + linea.cantidad * Number(linea.ingrediente?.costo_referencia || 0), 0);
  const costoConMerma = costoBase * (1 + Number(merma || 0) / 100);
  const precioSugerido = costoConMerma * (1 + Number(margen || 0) / 100) * (1 + Number(iva || 0) / 100) * (1 + Number(recargo || 0) / 100);
  const productoActual = productos.find((producto) => producto.id === productoId);

  const guardarReceta = async () => {
    if ((!productoId && modoProducto === "existente") || (modoProducto === "nuevo" && (!nombreProductoNuevo.trim() || !precioVentaNuevo)) || !Number(rendimiento) || Number(rendimiento) <= 0 || !lineas.length) { alert("Define el producto, su precio final, el rendimiento y al menos un ingrediente."); return; }
    setGuardando(true);
    let productoParaReceta = productoId;
    if (modoProducto === "nuevo") {
      const { data: productoNuevo, error: productoError } = await supabase.from("productos").insert({ nombre: nombreProductoNuevo.trim(), categoria: categoriaProductoNueva.trim() || null, precio_venta: Number(precioVentaNuevo), costo: costoConMerma, estado: "Activo" }).select("id").single();
      if (productoError || !productoNuevo) { console.error(productoError); setGuardando(false); alert("No se pudo crear el producto para esta receta."); return; }
      productoParaReceta = productoNuevo.id;
      setProductoId(productoNuevo.id);
    }
    const { data: receta, error: recetaError } = await supabase
      .from("recetas_estandar")
      .upsert({ producto_id: productoParaReceta, rendimiento: Number(rendimiento), unidad_rendimiento: unidadRendimiento, merma_pct: Number(merma || 0) / 100, margen_pct: Number(margen || 0) / 100, iva_pct: Number(iva || 0) / 100, recargo_carta_pct: Number(recargo || 0) / 100, activa: true }, { onConflict: "producto_id" })
      .select("id")
      .single();
    if (recetaError || !receta) { console.error(recetaError); setGuardando(false); alert("No se pudo guardar la receta."); return; }
    const { error: borrarError } = await supabase.from("receta_ingredientes").delete().eq("receta_id", receta.id);
    if (borrarError) { console.error(borrarError); setGuardando(false); alert("No se pudo actualizar el detalle de ingredientes."); return; }
    const { error: detalleError } = await supabase.from("receta_ingredientes").insert(lineas.map((linea) => ({ receta_id: receta.id, ingrediente_id: linea.ingrediente_id, cantidad: linea.cantidad })));
    const { error: costoError } = await supabase.from("productos").update({ costo: costoConMerma }).eq("id", productoParaReceta);
    setGuardando(false);
    if (detalleError || costoError) { console.error(detalleError || costoError); alert("La receta se guardó parcialmente. Vuelve a intentar para terminar de sincronizarla."); return; }
    alert("Receta guardada y costo del producto actualizado.");
    await cargarBase();
  };

  const registrarCompra = async () => {
    if (!ingredienteCompra || !Number(cantidadCompra) || Number(cantidadCompra) <= 0 || costoCompra === "" || Number(costoCompra) < 0) { alert("Selecciona un ingrediente e ingresa cantidad y costo unitario válidos."); return; }
    setRegistrandoCompra(true);
    const { error } = await supabase.rpc("registrar_compra_ingrediente", { p_ingrediente_id: ingredienteCompra, p_cantidad: Number(cantidadCompra), p_costo_unitario: Number(costoCompra), p_nota: notaCompra.trim() || null });
    setRegistrandoCompra(false);
    if (error) { console.error(error); alert("No se pudo registrar la compra."); return; }
    alert("Compra registrada. Inventario y costo promedio actualizados.");
    setIngredienteCompra(""); setCantidadCompra(""); setCostoCompra(""); setNotaCompra("");
    await cargarBase();
  };

  return <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl">
    <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-orange-600">Costos y producción</p><h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Recetas estándar</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Conecta cada producto a sus ingredientes. El sistema calcula el costo de receta, la merma y un precio sugerido; el precio final de venta lo decides tú.</p></div><Link href="/productos" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-orange-400 hover:text-orange-700">← Volver a productos</Link></header>
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_370px]">
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-500">Receta del producto</p><h2 className="mt-2 text-2xl font-black text-slate-950">Crea o edita una receta</h2></div><div className="space-y-6 p-6">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-orange-700">¿Cómo quieres comenzar?</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setModoProducto("nuevo")} className={`rounded-xl px-4 py-2 text-sm font-bold ${modoProducto === "nuevo" ? "bg-orange-500 text-white" : "bg-white text-slate-700"}`}>Crear producto desde esta receta</button><button type="button" onClick={() => setModoProducto("existente")} className={`rounded-xl px-4 py-2 text-sm font-bold ${modoProducto === "existente" ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}>Usar producto existente</button></div></div>
        {modoProducto === "nuevo" ? <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700 md:col-span-2">Nombre del nuevo producto<input value={nombreProductoNuevo} onChange={(event) => setNombreProductoNuevo(event.target.value)} placeholder="Ej. Pan de banano con nuez" className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500" /></label><label className="text-sm font-bold text-slate-700">Categoría o marca<input value={categoriaProductoNueva} onChange={(event) => setCategoriaProductoNueva(event.target.value)} placeholder="La Cocina de Isa" className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500" /></label><label className="text-sm font-bold text-slate-700">Precio final de venta (Q)<input type="number" min="0" step="0.01" value={precioVentaNuevo} onChange={(event) => setPrecioVentaNuevo(event.target.value)} placeholder="0.00" className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500" /></label><p className="md:col-span-2 text-xs text-slate-500">Al guardar la receta, se creará este producto y se conectará automáticamente con su costo calculado.</p></div> : <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Producto existente<select value={productoId} onChange={(event) => void cargarReceta(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-medium outline-none focus:border-orange-500"><option value="">Selecciona el producto</option>{productos.map((producto) => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}</select></label><div className="rounded-xl bg-slate-950 p-4 text-white"><p className="text-xs text-slate-300">Precio final actual</p><p className="mt-1 text-2xl font-black">{productoActual ? dinero(Number(productoActual.precio_venta)) : "—"}</p><p className="mt-1 text-xs text-slate-400">Se conserva al actualizar la receta.</p></div></div>}
        {cargandoReceta && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">Cargando receta…</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-bold text-slate-700">Rendimiento<input type="number" min="0.001" step="0.001" value={rendimiento} onChange={(event) => setRendimiento(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500" /></label><label className="text-sm font-bold text-slate-700">Unidad de rendimiento<input value={unidadRendimiento} onChange={(event) => setUnidadRendimiento(event.target.value)} placeholder="Ej. pan, porción, unidad" className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500" /></label><label className="text-sm font-bold text-slate-700">Merma (%)<input type="number" min="0" step="0.01" value={merma} onChange={(event) => setMerma(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500" /></label><label className="text-sm font-bold text-slate-700">Margen (%)<input type="number" min="0" step="0.01" value={margen} onChange={(event) => setMargen(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500" /></label><label className="text-sm font-bold text-slate-700">IVA (%)<input type="number" min="0" step="0.01" value={iva} onChange={(event) => setIva(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500" /></label><label className="text-sm font-bold text-slate-700">Recargo / carta (%)<input type="number" min="0" step="0.01" value={recargo} onChange={(event) => setRecargo(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500" /></label></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-950">Ingredientes de la receta</p><div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_auto]"><select value={ingredienteSeleccionado} onChange={(event) => setIngredienteSeleccionado(event.target.value)} className="rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-orange-500"><option value="">Selecciona un ingrediente</option>{ingredientes.map((ingrediente) => <option key={ingrediente.id} value={ingrediente.id}>{ingrediente.nombre} · {ingrediente.unidad_base} · {dinero(Number(ingrediente.costo_referencia))}/{ingrediente.unidad_base}</option>)}</select><input type="number" min="0.001" step="0.001" placeholder="Cantidad" value={cantidad} onChange={(event) => setCantidad(event.target.value)} className="rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500"/><button type="button" onClick={agregarLinea} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600">Agregar</button></div>
          <div className="mt-4 overflow-x-auto rounded-xl bg-white"><table className="w-full min-w-[590px] text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Ingrediente</th><th className="p-3">Cantidad</th><th className="p-3">Costo unitario</th><th className="p-3 text-right">Subtotal</th><th className="p-3"></th></tr></thead><tbody>{detalleLineas.map((linea) => <tr key={linea.ingrediente_id} className="border-t border-slate-100"><td className="p-3 font-bold text-slate-900">{linea.ingrediente?.nombre}</td><td className="p-3"><input aria-label={`Cantidad de ${linea.ingrediente?.nombre}`} type="number" min="0.001" step="0.001" value={linea.cantidad} onChange={(event) => setLineas(lineas.map((actual) => actual.ingrediente_id === linea.ingrediente_id ? { ...actual, cantidad: Number(event.target.value) } : actual))} className="w-24 rounded-lg border border-slate-200 p-2" /> <span className="text-slate-500">{linea.ingrediente?.unidad_base}</span></td><td className="p-3">{dinero(Number(linea.ingrediente?.costo_referencia || 0))}</td><td className="p-3 text-right font-black text-slate-900">{dinero(linea.cantidad * Number(linea.ingrediente?.costo_referencia || 0))}</td><td className="p-3 text-right"><button type="button" onClick={() => setLineas(lineas.filter((actual) => actual.ingrediente_id !== linea.ingrediente_id))} className="text-xs font-bold text-rose-600">Quitar</button></td></tr>)}{!detalleLineas.length && <tr><td colSpan={5} className="p-7 text-center text-slate-500">Agrega los ingredientes y sus cantidades para crear la receta.</td></tr>}</tbody></table></div>
        </div>
        <button type="button" disabled={guardando} onClick={() => void guardarReceta()} className="w-full rounded-xl bg-orange-500 p-4 font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">{guardando ? "Guardando receta…" : "Guardar receta y actualizar costo"}</button>
      </div></section>
      <aside className="space-y-7"><section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm"><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-400">Resultado automático</p><h2 className="mt-2 text-2xl font-black">Costo de {productoActual?.nombre || "la receta"}</h2><div className="mt-6 space-y-3"><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Ingredientes</p><p className="mt-1 text-2xl font-black">{dinero(costoBase)}</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Con merma</p><p className="mt-1 text-2xl font-black">{dinero(costoConMerma)}</p></div><div className="rounded-2xl bg-orange-500 p-4"><p className="text-xs text-orange-100">Precio sugerido</p><p className="mt-1 text-2xl font-black">{dinero(precioSugerido)}</p></div></div><p className="mt-5 text-xs leading-5 text-slate-400">Al guardar, el costo con merma se sincroniza al producto. No modifica tu precio final de venta.</p></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-500">Base de costos</p><h2 className="mt-2 text-xl font-black text-slate-950">Ingredientes</h2><p className="mt-2 text-sm leading-5 text-slate-600">Administra costos por gramo, mililitro o unidad, existencias y el historial de ajustes desde un módulo dedicado.</p><Link href="/ingredientes" className="mt-5 block w-full rounded-xl border border-slate-300 p-3 text-center text-sm font-bold text-slate-800 transition hover:border-orange-500 hover:text-orange-700">Gestionar ingredientes e inventario</Link></section>
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Gastos e inventario</p><h2 className="mt-2 text-xl font-black text-slate-950">Registrar compra</h2><p className="mt-2 text-xs leading-5 text-slate-600">Suma existencias y recalcula el costo promedio que usan las recetas.</p><div className="mt-5 space-y-3"><select value={ingredienteCompra} onChange={(event) => setIngredienteCompra(event.target.value)} className="w-full rounded-xl border border-emerald-200 bg-white p-3"><option value="">Selecciona el ingrediente comprado</option>{ingredientes.map((ingrediente) => <option key={ingrediente.id} value={ingrediente.id}>{ingrediente.nombre} · stock: {Number(ingrediente.stock_actual)} {ingrediente.unidad_base}</option>)}</select><div className="grid grid-cols-2 gap-3"><input type="number" min="0.001" step="0.001" value={cantidadCompra} onChange={(event) => setCantidadCompra(event.target.value)} placeholder="Cantidad comprada" className="rounded-xl border border-emerald-200 p-3"/><input type="number" min="0" step="0.0001" value={costoCompra} onChange={(event) => setCostoCompra(event.target.value)} placeholder="Costo por unidad" className="rounded-xl border border-emerald-200 p-3"/></div><input value={notaCompra} onChange={(event) => setNotaCompra(event.target.value)} placeholder="Proveedor o nota (opcional)" className="w-full rounded-xl border border-emerald-200 p-3"/><button type="button" disabled={registrandoCompra} onClick={() => void registrarCompra()} className="w-full rounded-xl bg-emerald-600 p-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">{registrandoCompra ? "Registrando compra…" : "Registrar gasto y existencias"}</button></div></section>
      </aside>
    </div>
  </div></main>;
}
