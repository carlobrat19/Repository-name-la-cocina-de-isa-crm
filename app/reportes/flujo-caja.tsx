"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { moneda } from "@/lib/crm";
import { cargarTodasLasPaginas } from "@/lib/cargar-paginas";
import { exportarExcel } from "@/lib/exportar-excel";
import { supabase } from "@/lib/supabase";

type Movimiento = { id: string; tipo: string; fecha: string | null; created_at: string | null; categoria: string | null; descripcion: string | null; monto: number | string; cuenta: string | null; cuenta_id: string | null; cuenta_destino_id: string | null; metodo_pago: string | null; origen: string | null; origen_id: string | null; pedido_id: string | null };
type Cuenta = { id: string; nombre: string };
type Pedido = { id: string; codigo: string | null; cliente: string | null; telefono: string | null };
type LineaPedido = { pedido_id: string; cantidad: number | string | null; precio: number | string | null; productos: { nombre: string | null } | null };
type PagoFactura = { id: string; factura_id: string; referencia: string | null };
type FacturaCompra = { id: string; numero: string | null; proveedor_id: string; fecha: string };
type Proveedor = { id: string; nombre: string; nit: string | null };
type LineaFactura = { factura_id: string; compra_ingrediente_id: string | null; descripcion: string; cantidad: number | string | null; unidad_factura: string | null; monto: number | string; categoria: string | null };
type CompraIngrediente = { id: string; ingrediente_id: string; cantidad: number | string; costo_unitario: number | string; total: number | string };
type Ingrediente = { id: string; nombre: string; unidad_base: string };
type Fila = Movimiento & { pedido: Pedido | null; factura: FacturaCompra | null; proveedor: Proveedor | null; compra: CompraIngrediente | null; ingrediente: Ingrediente | null; referencia: string; cuentaNombre: string; destinoNombre: string };
type Periodo = "Hoy" | "7 días" | "Este mes" | "Todo" | "Personalizado";

const n = (valor: number | string | null | undefined) => Number(valor || 0);
const dia = (fecha: Date) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
const soloFecha = (valor: string | null) => valor?.slice(0, 10) || "";
const clavePeriodo = (valor: string, agrupacion: "mes" | "semana") => {
  if (agrupacion === "mes") return valor.slice(0, 7);
  const fecha = new Date(`${valor}T12:00:00`);
  const lunes = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() - ((fecha.getDay() + 6) % 7));
  return dia(lunes);
};

export default function FlujoCajaReportes() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [lineasPedido, setLineasPedido] = useState<LineaPedido[]>([]);
  const [pagosFactura, setPagosFactura] = useState<PagoFactura[]>([]);
  const [facturas, setFacturas] = useState<FacturaCompra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [lineasFactura, setLineasFactura] = useState<LineaFactura[]>([]);
  const [compras, setCompras] = useState<CompraIngrediente[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("Este mes");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [agrupacion, setAgrupacion] = useState<"mes" | "semana">("semana");
  const [tipo, setTipo] = useState("Todos");
  const [categoria, setCategoria] = useState("Todas");
  const [cuenta, setCuenta] = useState("Todas");
  const [metodo, setMetodo] = useState("Todos");
  const [origen, setOrigen] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [advertencia, setAdvertencia] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true); setError(""); setAdvertencia("");
    const [m, c, p, lp, pf, f, pr, lf, ci, ing] = await Promise.all([
      cargarTodasLasPaginas((inicio, fin) => supabase.from("movimientos_caja").select("id,tipo,fecha,created_at,categoria,descripcion,monto,cuenta,cuenta_id,cuenta_destino_id,metodo_pago,origen,origen_id,pedido_id").order("fecha", { ascending: false }).order("id").range(inicio, fin)),
      cargarTodasLasPaginas((inicio, fin) => supabase.from("cuentas_financieras").select("id,nombre").order("id").range(inicio, fin)),
      cargarTodasLasPaginas((inicio, fin) => supabase.from("pedidos").select("id,codigo,cliente,telefono").order("id").range(inicio, fin)),
      cargarTodasLasPaginas((inicio, fin) => supabase.from("pedido_detalle").select("pedido_id,cantidad,precio,productos(nombre)").order("id").range(inicio, fin)),
      cargarTodasLasPaginas((inicio, fin) => supabase.from("pagos_facturas_compra").select("id,factura_id,referencia").order("id").range(inicio, fin)),
      cargarTodasLasPaginas((inicio, fin) => supabase.from("facturas_compra").select("id,numero,proveedor_id,fecha").order("id").range(inicio, fin)),
      cargarTodasLasPaginas((inicio, fin) => supabase.from("proveedores_compra").select("id,nombre,nit").order("id").range(inicio, fin)),
      cargarTodasLasPaginas((inicio, fin) => supabase.from("facturas_compra_lineas").select("factura_id,compra_ingrediente_id,descripcion,cantidad,unidad_factura,monto,categoria").order("id").range(inicio, fin)),
      cargarTodasLasPaginas((inicio, fin) => supabase.from("compras_ingredientes").select("id,ingrediente_id,cantidad,costo_unitario,total").order("id").range(inicio, fin)),
      cargarTodasLasPaginas((inicio, fin) => supabase.from("ingredientes").select("id,nombre,unidad_base").order("id").range(inicio, fin)),
    ]);
    if (m.error) { setError(`No se pudieron cargar los movimientos: ${m.error.message}`); setCargando(false); return; }
    const adicionales = [c.error, p.error, lp.error, pf.error, f.error, pr.error, lf.error, ci.error, ing.error].filter(Boolean);
    if (adicionales.length) setAdvertencia("Algunos detalles vinculados no están disponibles para tu usuario; revisa el Excel antes de usarlo como respaldo completo.");
    setMovimientos(m.data as Movimiento[]); setCuentas(c.data as Cuenta[]); setPedidos(p.data as Pedido[]);
    setLineasPedido(lp.data as unknown as LineaPedido[]); setPagosFactura(pf.data as PagoFactura[]);
    setFacturas(f.data as FacturaCompra[]); setProveedores(pr.data as Proveedor[]); setLineasFactura(lf.data as LineaFactura[]);
    setCompras(ci.data as CompraIngrediente[]); setIngredientes(ing.data as Ingrediente[]);
    setCargando(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, [cargar]);

  const rango = useMemo(() => {
    const hoy = new Date();
    if (periodo === "Todo") return { inicio: "", fin: "" };
    if (periodo === "Personalizado") return { inicio: desde, fin: hasta };
    const inicio = periodo === "Hoy" ? hoy : periodo === "7 días" ? new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { inicio: dia(inicio), fin: dia(hoy) };
  }, [periodo, desde, hasta]);

  const filas = useMemo(() => {
    const cuentasId = new Map(cuentas.map((item) => [item.id, item]));
    const pedidosId = new Map(pedidos.map((item) => [item.id, item]));
    const pagosId = new Map(pagosFactura.map((item) => [item.id, item]));
    const facturasId = new Map(facturas.map((item) => [item.id, item]));
    const proveedoresId = new Map(proveedores.map((item) => [item.id, item]));
    const comprasId = new Map(compras.map((item) => [item.id, item]));
    const ingredientesId = new Map(ingredientes.map((item) => [item.id, item]));
    const facturaPorCompra = new Map(lineasFactura.filter((item) => item.compra_ingrediente_id).map((item) => [item.compra_ingrediente_id, item.factura_id]));
    return movimientos.map((movimiento): Fila => {
      const pago = movimiento.origen === "factura_compra" ? pagosId.get(movimiento.origen_id || "") : null;
      const facturaId = pago?.factura_id || (movimiento.origen === "compra_ingrediente" ? facturaPorCompra.get(movimiento.origen_id || "") : null);
      const factura = facturaId ? facturasId.get(facturaId) || null : null;
      const compra = movimiento.origen === "compra_ingrediente" ? comprasId.get(movimiento.origen_id || "") || null : null;
      return { ...movimiento, pedido: pedidosId.get(movimiento.pedido_id || "") || null, factura, proveedor: factura ? proveedoresId.get(factura.proveedor_id) || null : null, compra, ingrediente: compra ? ingredientesId.get(compra.ingrediente_id) || null : null, referencia: pago?.referencia || "", cuentaNombre: cuentasId.get(movimiento.cuenta_id || "")?.nombre || movimiento.cuenta || "Sin cuenta", destinoNombre: cuentasId.get(movimiento.cuenta_destino_id || "")?.nombre || "" };
    });
  }, [movimientos, cuentas, pedidos, pagosFactura, facturas, proveedores, lineasFactura, compras, ingredientes]);

  const categorias = useMemo(() => [...new Set(filas.map((item) => item.categoria || "Sin categoría"))].sort(), [filas]);
  const metodos = useMemo(() => [...new Set(filas.map((item) => item.metodo_pago || "Sin medio"))].sort(), [filas]);
  const origenes = useMemo(() => [...new Set(filas.map((item) => item.origen || "manual"))].sort(), [filas]);
  const filtradas = useMemo(() => filas.filter((item) => {
    const fecha = soloFecha(item.fecha);
    const texto = `${item.descripcion || ""} ${item.categoria || ""} ${item.pedido?.codigo || ""} ${item.pedido?.cliente || ""} ${item.factura?.numero || ""} ${item.proveedor?.nombre || ""} ${item.referencia}`.toLocaleLowerCase("es-GT");
    return (!rango.inicio || fecha >= rango.inicio) && (!rango.fin || fecha <= rango.fin)
      && (tipo === "Todos" || item.tipo === tipo) && (categoria === "Todas" || (item.categoria || "Sin categoría") === categoria)
      && (cuenta === "Todas" || item.cuenta_id === cuenta) && (metodo === "Todos" || (item.metodo_pago || "Sin medio") === metodo)
      && (origen === "Todos" || (item.origen || "manual") === origen) && texto.includes(busqueda.trim().toLocaleLowerCase("es-GT"));
  }), [filas, rango, tipo, categoria, cuenta, metodo, origen, busqueda]);

  const resumen = useMemo(() => filtradas.reduce((actual, item) => {
    if (item.tipo === "Ingreso") { actual.ingresos += n(item.monto); actual.cantidadIngresos++; }
    if (item.tipo === "Gasto") { actual.gastos += n(item.monto); actual.cantidadGastos++; }
    if (item.tipo === "Transferencia") actual.transferencias += n(item.monto);
    return actual;
  }, { ingresos: 0, gastos: 0, transferencias: 0, cantidadIngresos: 0, cantidadGastos: 0 }), [filtradas]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, { periodo: string; ingresos: number; gastos: number; neto: number }>();
    for (const item of filtradas) {
      const fecha = soloFecha(item.fecha);
      if (!fecha) continue;
      const clave = clavePeriodo(fecha, agrupacion);
      const actual = mapa.get(clave) || { periodo: clave, ingresos: 0, gastos: 0, neto: 0 };
      if (item.tipo === "Ingreso") actual.ingresos += n(item.monto);
      if (item.tipo === "Gasto") actual.gastos += n(item.monto);
      actual.neto = actual.ingresos - actual.gastos;
      mapa.set(clave, actual);
    }
    return [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [filtradas, agrupacion]);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, { tipo: string; categoria: string; cantidad: number; total: number }>();
    filtradas.filter((item) => item.tipo === "Ingreso" || item.tipo === "Gasto").forEach((item) => {
      const categoria = item.categoria || "Sin categoría";
      const clave = `${item.tipo}\0${categoria}`;
      const actual = mapa.get(clave) || { tipo: item.tipo, categoria, cantidad: 0, total: 0 };
      actual.cantidad++; actual.total += n(item.monto); mapa.set(clave, actual);
    });
    return [...mapa.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || b.total - a.total);
  }, [filtradas]);

  const porMedio = useMemo(() => {
    const mapa = new Map<string, { medio: string; ingresos: number; gastos: number }>();
    filtradas.forEach((item) => {
      const medio = item.metodo_pago || "Sin medio";
      const actual = mapa.get(medio) || { medio, ingresos: 0, gastos: 0 };
      if (item.tipo === "Ingreso") actual.ingresos += n(item.monto);
      if (item.tipo === "Gasto") actual.gastos += n(item.monto);
      mapa.set(medio, actual);
    });
    return [...mapa.values()].sort((a, b) => b.ingresos + b.gastos - a.ingresos - a.gastos);
  }, [filtradas]);

  function descargar() {
    const pedidosIds = new Set(filtradas.map((item) => item.pedido_id).filter(Boolean));
    const facturasIds = new Set(filtradas.map((item) => item.factura?.id).filter(Boolean));
    const facturaPorId = new Map(facturas.map((item) => [item.id, item]));
    const proveedorPorId = new Map(proveedores.map((item) => [item.id, item]));
    const pedidoPorId = new Map(pedidos.map((item) => [item.id, item]));
    exportarExcel("flujo-caja-la-cocina-de-isa", [
      { nombre: "Movimientos", filas: filtradas.map((item) => ({ fecha: soloFecha(item.fecha), hora_registro: item.created_at ? new Date(item.created_at).toLocaleTimeString("es-GT", { timeZone: "America/Guatemala", hour12: false }) : "", tipo: item.tipo, categoria: item.categoria, descripcion: item.descripcion, ingreso_Q: item.tipo === "Ingreso" ? n(item.monto) : 0, gasto_Q: item.tipo === "Gasto" ? n(item.monto) : 0, transferencia_Q: item.tipo === "Transferencia" ? n(item.monto) : 0, cuenta: item.cuentaNombre, cuenta_destino: item.destinoNombre, medio_pago: item.metodo_pago, origen: item.origen, pedido: item.pedido?.codigo || "", cliente: item.pedido?.cliente || "", telefono: item.pedido?.telefono || "", factura: item.factura?.numero || "", proveedor: item.proveedor?.nombre || "", nit_proveedor: item.proveedor?.nit || "", referencia: item.referencia, ingrediente: item.ingrediente?.nombre || "", cantidad_ingrediente: item.compra ? n(item.compra.cantidad) : null, unidad_ingrediente: item.ingrediente?.unidad_base || "", id_movimiento: item.id })) },
      { nombre: "Articulos de facturas", filas: lineasFactura.filter((item) => facturasIds.has(item.factura_id)).map((item) => { const factura = facturaPorId.get(item.factura_id); const proveedor = proveedorPorId.get(factura?.proveedor_id || ""); return { factura: factura?.numero || "", fecha_factura: factura?.fecha || "", proveedor: proveedor?.nombre || "", nit_proveedor: proveedor?.nit || "", articulo: item.descripcion, categoria: item.categoria, cantidad: n(item.cantidad), unidad: item.unidad_factura || "", total_linea_Q: n(item.monto), compra_ingrediente_id: item.compra_ingrediente_id || "" }; }) },
      { nombre: "Articulos de pedidos", filas: lineasPedido.filter((item) => pedidosIds.has(item.pedido_id)).map((item) => { const pedido = pedidoPorId.get(item.pedido_id); return { pedido: pedido?.codigo || "", cliente: pedido?.cliente || "", telefono: pedido?.telefono || "", articulo: item.productos?.nombre || "Producto eliminado", cantidad: n(item.cantidad), precio_unitario_Q: n(item.precio), subtotal_Q: n(item.cantidad) * n(item.precio) }; }) },
      { nombre: "Categorias", filas: porCategoria.map((item) => ({ tipo: item.tipo, categoria: item.categoria, movimientos: item.cantidad, total_Q: item.total, participacion_pct: (item.tipo === "Ingreso" ? resumen.ingresos : resumen.gastos) ? item.total / (item.tipo === "Ingreso" ? resumen.ingresos : resumen.gastos) * 100 : 0 })) },
      { nombre: "Periodos", filas: grupos.map((item) => ({ periodo: item.periodo, agrupacion, ingresos_Q: item.ingresos, gastos_Q: item.gastos, flujo_neto_Q: item.neto })) },
    ]);
  }

  return <div className="space-y-5">
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Reporte de flujo de caja</h2><p className="mt-1 text-sm text-slate-600">Movimientos efectivamente registrados. Las facturas documentadas sin pago no se suman a gastos.</p></div><div className="flex gap-2"><button type="button" onClick={descargar} disabled={cargando || Boolean(error)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-50"><Download size={16}/> Excel</button><button type="button" onClick={() => void cargar()} disabled={cargando} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><RefreshCw size={16}/>{cargando ? "Cargando…" : "Actualizar"}</button></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"><label className="text-xs font-bold">Período<select value={periodo} onChange={(event) => setPeriodo(event.target.value as Periodo)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"><option>Hoy</option><option>7 días</option><option>Este mes</option><option>Todo</option><option>Personalizado</option></select></label><label className="text-xs font-bold">Desde<input type="date" value={periodo === "Personalizado" ? desde : rango.inicio} onChange={(event) => { setDesde(event.target.value); setHasta(rango.fin); setPeriodo("Personalizado"); }} className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"/></label><label className="text-xs font-bold">Hasta<input type="date" value={periodo === "Personalizado" ? hasta : rango.fin} onChange={(event) => { setDesde(rango.inicio); setHasta(event.target.value); setPeriodo("Personalizado"); }} className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"/></label><label className="text-xs font-bold">Tipo<select value={tipo} onChange={(event) => setTipo(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"><option>Todos</option><option>Ingreso</option><option>Gasto</option><option>Transferencia</option></select></label><label className="text-xs font-bold">Categoría<select value={categoria} onChange={(event) => setCategoria(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"><option>Todas</option>{categorias.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold">Cuenta<select value={cuenta} onChange={(event) => setCuenta(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"><option value="Todas">Todas</option>{cuentas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="text-xs font-bold">Medio de pago<select value={metodo} onChange={(event) => setMetodo(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"><option>Todos</option>{metodos.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold">Origen<select value={origen} onChange={(event) => setOrigen(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"><option>Todos</option>{origenes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold sm:col-span-2 lg:col-span-3 xl:col-span-4">Buscar<input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Descripción, cliente, pedido, proveedor o factura" className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"/></label></div>
    </section>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}{advertencia && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{advertencia}</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Ingresos", resumen.ingresos, `${resumen.cantidadIngresos} movimientos`], ["Gastos", resumen.gastos, `${resumen.cantidadGastos} movimientos`], ["Flujo neto", resumen.ingresos - resumen.gastos, "Ingresos menos gastos"], ["Transferencias internas", resumen.transferencias, "No cuentan como ingreso ni gasto"]].map(([titulo, valor, detalle]) => <article key={String(titulo)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">{titulo}</p><p className="mt-2 text-2xl font-black text-slate-950">{moneda(Number(valor))}</p><p className="mt-1 text-xs text-slate-600">{detalle}</p></article>)}</section>
    <section className="grid gap-4 xl:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-2"><h3 className="font-black">Evolución</h3><select aria-label="Agrupar períodos" value={agrupacion} onChange={(event) => setAgrupacion(event.target.value as "mes" | "semana")} className="rounded-lg border border-slate-200 p-2 text-xs"><option value="semana">Semanal</option><option value="mes">Mensual</option></select></div><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th>Período</th><th className="text-right">Ingresos</th><th className="text-right">Gastos</th><th className="text-right">Neto</th></tr></thead><tbody>{grupos.map((item) => <tr key={item.periodo} className="border-t border-slate-100"><td className="py-2">{item.periodo}</td><td className="text-right">{moneda(item.ingresos)}</td><td className="text-right">{moneda(item.gastos)}</td><td className="text-right font-bold">{moneda(item.neto)}</td></tr>)}</tbody></table></div></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black">Participación por categoría</h3><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th>Tipo y categoría</th><th className="text-right">Monto</th><th className="text-right">%</th></tr></thead><tbody>{porCategoria.map((item) => { const base = item.tipo === "Ingreso" ? resumen.ingresos : resumen.gastos; return <tr key={`${item.tipo}-${item.categoria}`} className="border-t border-slate-100"><td className="py-2">{item.tipo} · {item.categoria}</td><td className="text-right">{moneda(item.total)}</td><td className="text-right">{base ? (item.total / base * 100).toFixed(1) : "0.0"}%</td></tr>; })}</tbody></table></div></article></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black">Por medio de pago</h3><div className="mt-3 flex flex-wrap gap-3">{porMedio.map((item) => <div key={item.medio} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold">{item.medio}</p><p>Ingresos {moneda(item.ingresos)} · Gastos {moneda(item.gastos)}</p></div>)}{!porMedio.length && <p className="text-sm text-slate-500">Sin movimientos para estos filtros.</p>}</div></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h3 className="font-black">Movimientos ({filtradas.length})</h3><p className="mt-1 text-xs text-slate-500">La hora corresponde al registro del movimiento; puede diferir de la fecha efectiva del pago.</p></div><div className="max-h-[560px] overflow-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-3">Fecha</th><th className="p-3">Tipo / categoría</th><th className="p-3">Descripción / referencia</th><th className="p-3">Cuenta / medio</th><th className="p-3">Pedido / factura</th><th className="p-3 text-right">Monto</th></tr></thead><tbody>{filtradas.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-3">{soloFecha(item.fecha)}</td><td className="p-3"><b>{item.tipo}</b><br/>{item.categoria || "Sin categoría"}</td><td className="p-3">{item.descripcion || "—"}{item.referencia && <small className="block text-slate-500">{item.referencia}</small>}</td><td className="p-3">{item.cuentaNombre}{item.destinoNombre && ` → ${item.destinoNombre}`}<small className="block text-slate-500">{item.metodo_pago || "Sin medio"}</small></td><td className="p-3">{item.pedido?.codigo || item.factura?.numero || "—"}<small className="block text-slate-500">{item.pedido?.cliente || item.proveedor?.nombre || ""}</small></td><td className={`p-3 text-right font-black ${item.tipo === "Ingreso" ? "text-emerald-700" : item.tipo === "Gasto" ? "text-rose-700" : "text-slate-700"}`}>{item.tipo === "Gasto" ? "−" : item.tipo === "Ingreso" ? "+" : ""}{moneda(n(item.monto))}</td></tr>)}{!filtradas.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No hay movimientos para estos filtros.</td></tr>}</tbody></table></div></section>
    <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-950"><b>Indicadores financieros:</b> este reporte muestra flujo neto de caja, no utilidad contable. ROI, ROA y ROE requieren inversión, activos, patrimonio y utilidad neta confiables; todavía no se calculan con los datos actuales del CRM.</p>
  </div>;
}
