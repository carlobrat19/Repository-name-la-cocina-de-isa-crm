"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { moneda } from "@/lib/crm";
import CrearInsumoFactura from "@/components/compras-facturas/CrearInsumoFactura";

type Factura = { id: string; numero: string | null; categoria: string; total: number };
type Linea = { id: string; descripcion: string; categoria: string; cantidad: number | null; unidad_factura: string | null; cantidad_base: number | null; monto: number; ingrediente_id: string | null; compra_ingrediente_id: string | null };
type Ingrediente = { id: string; nombre: string; unidad_base: "g" | "ml" | "unidad" };
type Compra = { id: string; ingrediente_id: string; cantidad: number; total: number; created_at: string };
type Edicion = { categoria: string; ingredienteId: string; cantidadBase: string; compraId: string };

const categorias = ["Por clasificar", "Materia prima", "Empaques", "Limpieza e higiene", "Mensajería y envíos", "Utensilios de cocina", "Equipo de cocina", "Mobiliario", "Servicios", "Publicidad", "Otros gastos"];

export default function RevisarFactura({ factura, lineas, ingredientes, compras, comprasVinculadas, cerrar, alGuardar }: { factura: Factura; lineas: Linea[]; ingredientes: Ingrediente[]; compras: Compra[]; comprasVinculadas: Set<string | null>; cerrar: () => void; alGuardar: () => Promise<void> }) {
  const [categoria, setCategoria] = useState(factura.categoria);
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>(() => Object.fromEntries(lineas.map((linea) => [linea.id, { categoria: linea.categoria, ingredienteId: linea.ingrediente_id || "", cantidadBase: linea.cantidad_base == null ? "" : String(linea.cantidad_base), compraId: linea.compra_ingrediente_id || "" }])));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  function cambiar(id: string, cambio: Partial<Edicion>) { setEdiciones((actual) => ({ ...actual, [id]: { ...actual[id], ...cambio } })); }

  async function guardar() {
    setError(""); setAviso("");
    if (lineas.some((linea) => {
      const edicion = ediciones[linea.id];
      return (edicion.ingredienteId && (!Number.isFinite(Number(edicion.cantidadBase)) || Number(edicion.cantidadBase) <= 0)) ||
        (edicion.compraId && (!edicion.ingredienteId || compras.find((compra) => compra.id === edicion.compraId)?.ingrediente_id !== edicion.ingredienteId));
    })) { setError("Revisa la cantidad base y que la compra corresponda al ingrediente seleccionado."); return; }
    const vinculaciones = lineas.map((linea) => ediciones[linea.id].compraId).filter(Boolean);
    if (new Set(vinculaciones).size !== vinculaciones.length) { setError("Una compra no puede vincularse a dos líneas de la misma factura."); return; }
    setGuardando(true);
    const { error: facturaError } = await supabase.from("facturas_compra").update({ categoria }).eq("id", factura.id);
    if (facturaError) { setError(`No se pudo actualizar la factura: ${facturaError.message}`); setGuardando(false); return; }
    for (const linea of lineas) {
      const edicion = ediciones[linea.id];
      const { error: lineaError } = await supabase.from("facturas_compra_lineas").update({ categoria: edicion.categoria, ingrediente_id: edicion.ingredienteId || null, cantidad_base: edicion.cantidadBase ? Number(edicion.cantidadBase) : null, compra_ingrediente_id: edicion.compraId || null }).eq("id", linea.id);
      if (lineaError) { setError(`La revisión quedó incompleta en «${linea.descripcion}»: ${lineaError.message}`); setGuardando(false); await alGuardar(); return; }
    }
    setGuardando(false); setAviso("Revisión guardada. Vincular una compra no crea un gasto ni suma inventario de nuevo."); await alGuardar();
  }

  return <section className="border-t border-slate-200 bg-orange-50 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">Revisar factura {factura.numero || "sin número"}</h3><p className="text-sm text-slate-600">Total {moneda(factura.total)} · Vincula solo las compras de ingredientes que ya registraste.</p></div><button type="button" onClick={cerrar} className="text-sm font-bold underline">Cerrar</button></div>
    <label className="mt-4 block max-w-xs text-xs font-bold">Categoría general<select value={categoria} onChange={(event) => setCategoria(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm">{categorias.map((item) => <option key={item}>{item}</option>)}</select></label>
    <div className="mt-4 space-y-3">{lineas.map((linea) => { const edicion = ediciones[linea.id]; const ingrediente = ingredientes.find((item) => item.id === edicion.ingredienteId); const disponibles = compras.filter((compra) => compra.ingrediente_id === edicion.ingredienteId && (!comprasVinculadas.has(compra.id) || compra.id === linea.compra_ingrediente_id)); return <div key={linea.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex justify-between gap-3 text-sm"><b>{linea.descripcion}</b><b>{moneda(linea.monto)}</b></div><p className="mt-1 text-xs text-slate-500">{linea.cantidad ?? "—"} {linea.unidad_factura || ""}</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-bold">Categoría<select value={edicion.categoria} onChange={(event) => cambiar(linea.id, { categoria: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm">{categorias.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold">Ingrediente existente<select value={edicion.ingredienteId} onChange={(event) => cambiar(linea.id, { ingredienteId: event.target.value, compraId: "", cantidadBase: "" })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"><option value="">No vincular</option>{ingredientes.map((item) => <option key={item.id} value={item.id}>{item.nombre} ({item.unidad_base})</option>)}</select></label><label className="text-xs font-bold">Cantidad base {ingrediente ? `(${ingrediente.unidad_base})` : ""}<input type="number" min="0" step="0.001" value={edicion.cantidadBase} onChange={(event) => cambiar(linea.id, { cantidadBase: event.target.value })} disabled={!ingrediente} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm disabled:bg-slate-100"/></label><label className="text-xs font-bold">Compra registrada<select value={edicion.compraId} onChange={(event) => { const compra = compras.find((item) => item.id === event.target.value); cambiar(linea.id, { compraId: event.target.value, cantidadBase: compra ? String(compra.cantidad) : edicion.cantidadBase }); }} disabled={!ingrediente} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm disabled:bg-slate-100"><option value="">Sin vincular</option>{disponibles.map((compra) => <option key={compra.id} value={compra.id}>{new Date(compra.created_at).toLocaleDateString("es-GT")} · {compra.cantidad} {ingrediente?.unidad_base} · {moneda(compra.total)}</option>)}</select></label></div><CrearInsumoFactura descripcion={linea.descripcion} existentes={ingredientes} alCrear={async (nuevo) => { cambiar(linea.id, { ingredienteId: nuevo.id, cantidadBase: "", compraId: "" }); await alGuardar(); }}/></div>; })}</div>
    {!lineas.length && <p className="mt-3 text-sm text-slate-600">Esta factura no tiene líneas registradas.</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-100 p-3 text-sm text-rose-800">{error}</p>}
    {aviso && <p role="status" className="mt-3 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-800">{aviso}</p>}
    <button type="button" disabled={guardando} onClick={() => void guardar()} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar revisión"}</button>
  </section>;
}
