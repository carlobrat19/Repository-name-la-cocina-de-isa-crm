"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { moneda } from "@/lib/crm";
import { supabase } from "@/lib/supabase";
import CrearInsumoFactura from "@/components/compras-facturas/CrearInsumoFactura";

type Proveedor = { id: string; nombre: string; nit: string | null };
type Ingrediente = { id: string; nombre: string; unidad_base: "g" | "ml" | "unidad" };
type Cuenta = { id: string; nombre: string; tipo: string; activa: boolean };
type Compra = { id: string; ingrediente_id: string; proveedor_id: string | null; fecha_compra: string | null; categoria_compra: string; cantidad: number; total: number; cuenta_pago: string; metodo_pago: string; nota: string | null };

const categorias = ["Materia prima", "Empaques", "Limpieza e higiene", "Utensilios de cocina", "Otros gastos"];
const metodos = ["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta de crédito", "POS", "Otro"];
const tiposPorMetodo: Record<string, string[]> = {
  Efectivo: ["Caja"], Transferencia: ["Banco", "Billetera digital"],
  "Tarjeta débito": ["Banco"], "Tarjeta de crédito": ["Tarjeta de crédito"],
  POS: ["POS", "Banco"], Otro: ["Caja", "Banco", "Billetera digital", "POS", "Tarjeta de crédito"],
};

export default function CompraDirecta({ usuarioId, proveedores, ingredientes, cuentas, alGuardar }: {
  usuarioId: string | null;
  proveedores: Proveedor[];
  ingredientes: Ingrediente[];
  cuentas: Cuenta[];
  alGuardar: () => Promise<void>;
}) {
  const [proveedorId, setProveedorId] = useState("");
  const [nuevoProveedor, setNuevoProveedor] = useState(false);
  const [nombreProveedor, setNombreProveedor] = useState("");
  const [nitProveedor, setNitProveedor] = useState("");
  const [contactoProveedor, setContactoProveedor] = useState("");
  const [telefonoProveedor, setTelefonoProveedor] = useState("");
  const [correoProveedor, setCorreoProveedor] = useState("");
  const [fechaCompra, setFechaCompra] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [categoria, setCategoria] = useState("Materia prima");
  const [ingredienteId, setIngredienteId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [total, setTotal] = useState("");
  const [metodo, setMetodo] = useState("Efectivo");
  const [cuentaId, setCuentaId] = useState("");
  const [nota, setNota] = useState("");
  const [historial, setHistorial] = useState<Compra[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const ingrediente = ingredientes.find((item) => item.id === ingredienteId);
  const cuentasDisponibles = useMemo(() => cuentas.filter((item) => item.activa && tiposPorMetodo[metodo]?.includes(item.tipo)), [cuentas, metodo]);

  async function cargarHistorial() {
    const { data, error: consultaError } = await supabase.from("compras_ingredientes")
      .select("id,ingrediente_id,proveedor_id,fecha_compra,categoria_compra,cantidad,total,cuenta_pago,metodo_pago,nota")
      .eq("tipo", "compra").not("proveedor_id", "is", null)
      .order("fecha_compra", { ascending: false }).limit(100);
    if (consultaError) { setError(`No se pudo cargar el historial de compras: ${consultaError.message}`); return; }
    setHistorial((data || []) as Compra[]);
  }
  useEffect(() => { const timer = window.setTimeout(() => void cargarHistorial(), 0); return () => window.clearTimeout(timer); }, []);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setAviso("");
    const cantidadNumero = Number(cantidad); const totalNumero = Number(total);
    if (!usuarioId || !ingredienteId || !fechaCompra || !cuentaId || !Number.isFinite(cantidadNumero) || cantidadNumero <= 0 || !Number.isFinite(totalNumero) || totalNumero <= 0 || (!proveedorId && !nuevoProveedor)) {
      setError("Completa proveedor, fecha, ingrediente, cantidad, total y cuenta."); return;
    }
    if (nuevoProveedor && !nombreProveedor.trim()) { setError("Escribe el nombre del proveedor nuevo."); return; }
    if (!window.confirm("¿Registrar esta compra, sumar existencias y crear el gasto en caja? No lo repitas si ya ingresaste la misma compra desde una factura.")) return;
    setGuardando(true);
    try {
      let proveedorFinalId = proveedorId;
      if (nuevoProveedor) {
        const { data: creado, error: proveedorError } = await supabase.from("proveedores_compra")
          .insert({ nombre: nombreProveedor.trim(), nit: nitProveedor.trim() || null, contacto: contactoProveedor.trim() || null, telefono: telefonoProveedor.trim() || null, correo: correoProveedor.trim() || null, creado_por: usuarioId })
          .select("id").single();
        if (proveedorError) throw proveedorError;
        proveedorFinalId = creado.id;
        setProveedorId(creado.id); setNuevoProveedor(false);
        await alGuardar();
      }
      const { error: compraError } = await supabase.rpc("registrar_compra_ingrediente_detallada", {
        p_ingrediente_id: ingredienteId, p_cantidad: cantidadNumero, p_total: totalNumero,
        p_proveedor_id: proveedorFinalId, p_fecha_compra: fechaCompra, p_categoria: categoria,
        p_nota: nota.trim() || null, p_metodo_pago: metodo, p_cuenta_id: cuentaId,
      });
      if (compraError) throw compraError;
      setCantidad(""); setTotal(""); setNota("");
      setAviso("Compra registrada: inventario y gasto actualizados una sola vez. Si tienes factura, puedes documentarla y vincular esta compra sin volverla a pagar.");
      await Promise.all([alGuardar(), cargarHistorial()]);
    } catch (guardarError) {
      setError(`No se pudo registrar la compra: ${guardarError instanceof Error ? guardarError.message : "error desconocido"}`);
    } finally { setGuardando(false); }
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Registrar compra directa</h2>
      <p className="mt-1 text-sm text-slate-600">Para compras de ingredientes sin factura cargada. Suma existencias y registra un gasto; si ya ingresaste la factura y su pago, usa la pestaña Facturas para vincularla y evita duplicarla.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {aviso && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}
      <form onSubmit={guardar} className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-bold">Proveedor<select required={!nuevoProveedor} disabled={nuevoProveedor} value={proveedorId} onChange={(event) => setProveedorId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3"><option value="">Seleccionar proveedor</option>{proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}{item.nit ? ` · ${item.nit}` : ""}</option>)}</select></label>
          <label className="text-sm font-bold">Fecha de compra<input required type="date" value={fechaCompra} onChange={(event) => setFechaCompra(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label>
          <label className="text-sm font-bold">Tipo de compra<select value={categoria} onChange={(event) => setCategoria(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3">{categorias.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm font-bold">Ingrediente / insumo<select required value={ingredienteId} onChange={(event) => setIngredienteId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3"><option value="">Seleccionar</option>{ingredientes.map((item) => <option key={item.id} value={item.id}>{item.nombre} ({item.unidad_base})</option>)}</select></label>
          <label className="text-sm font-bold">Cantidad base {ingrediente ? `(${ingrediente.unidad_base})` : ""}<input required type="number" min="0.001" step="0.001" value={cantidad} onChange={(event) => setCantidad(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label>
          <label className="text-sm font-bold">Total pagado (Q)<input required type="number" min="0.01" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label>
          <label className="text-sm font-bold">Medio de pago<select value={metodo} onChange={(event) => { setMetodo(event.target.value); setCuentaId(""); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3">{metodos.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm font-bold">Cuenta que paga<select required value={cuentaId} onChange={(event) => setCuentaId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3"><option value="">Seleccionar cuenta</option>{cuentasDisponibles.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        </div>
        <CrearInsumoFactura descripcion="" existentes={ingredientes} notaCreacion="Creado desde Compras directas" alCrear={async (nuevo) => { setIngredienteId(nuevo.id); await alGuardar(); }}/>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={nuevoProveedor} onChange={(event) => { setNuevoProveedor(event.target.checked); setProveedorId(""); }}/> Proveedor nuevo</label>
        {nuevoProveedor && <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><label className="text-sm font-bold">Nombre del proveedor<input required value={nombreProveedor} onChange={(event) => setNombreProveedor(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><label className="text-sm font-bold">NIT (si lo tienes)<input value={nitProveedor} onChange={(event) => setNitProveedor(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><label className="text-sm font-bold">Contacto<input value={contactoProveedor} onChange={(event) => setContactoProveedor(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><label className="text-sm font-bold">Teléfono<input type="tel" value={telefonoProveedor} onChange={(event) => setTelefonoProveedor(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><label className="text-sm font-bold sm:col-span-2">Correo<input type="email" value={correoProveedor} onChange={(event) => setCorreoProveedor(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label></div>}
        <label className="block text-sm font-bold">Nota opcional<input value={nota} onChange={(event) => setNota(event.target.value)} placeholder="Ej. compra en mercado para fiambre" className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-sm"><span>Costo por {ingrediente?.unidad_base || "unidad"}: <b>{cantidad && total ? moneda(Number(total) / Number(cantidad)) : "Q0.00"}</b></span><button disabled={guardando || !cuentasDisponibles.length} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{guardando ? "Registrando…" : "Registrar compra y existencias"}</button></div>
      </form>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Compras directas recientes</h2><p className="mt-1 text-xs text-slate-500">Solo compras registradas desde esta pestaña; las compras anteriores siguen en su historial original.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Fecha</th><th className="p-3">Proveedor</th><th className="p-3">Tipo</th><th className="p-3">Ingrediente</th><th className="p-3">Cantidad</th><th className="p-3">Pago</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{historial.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-3">{item.fecha_compra || "—"}</td><td className="p-3">{proveedores.find((proveedor) => proveedor.id === item.proveedor_id)?.nombre || "—"}</td><td className="p-3">{item.categoria_compra}</td><td className="p-3">{ingredientes.find((ingrediente) => ingrediente.id === item.ingrediente_id)?.nombre || "Ingrediente"}</td><td className="p-3">{item.cantidad} {ingredientes.find((ingrediente) => ingrediente.id === item.ingrediente_id)?.unidad_base || ""}</td><td className="p-3">{item.cuenta_pago} · {item.metodo_pago}</td><td className="p-3 text-right font-bold">{moneda(Number(item.total))}</td></tr>)}{!historial.length && <tr><td colSpan={7} className="p-5 text-center text-slate-500">Aún no hay compras directas registradas.</td></tr>}</tbody></table></div></section>
  </div>;
}
