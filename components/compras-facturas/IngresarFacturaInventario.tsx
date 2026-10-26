"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { moneda } from "@/lib/crm";

type Linea = { id: string; descripcion: string; categoria: string; cantidad: number | null; unidad_factura: string | null; cantidad_base: number | null; monto: number; ingrediente_id: string | null; compra_ingrediente_id: string | null };
type Ingrediente = { id: string; nombre: string; unidad_base: "g" | "ml" | "unidad" };

export default function IngresarFacturaInventario({ facturaId, lineas, ingredientes, alGuardar }: {
  facturaId: string;
  lineas: Linea[];
  ingredientes: Ingrediente[];
  alGuardar: () => Promise<void>;
}) {
  const disponibles = useMemo(() => lineas.filter((linea) => linea.ingrediente_id && Number(linea.cantidad_base) > 0 && !linea.compra_ingrediente_id), [lineas]);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const ids = disponibles.filter((linea) => seleccionadas.has(linea.id)).map((linea) => linea.id);
  const monto = disponibles.filter((linea) => seleccionadas.has(linea.id)).reduce((total, linea) => total + Number(linea.monto || 0), 0);

  async function ingresar() {
    setError(""); setAviso("");
    if (!ids.length || guardando) return;
    if (!window.confirm(`¿Ingresar ${ids.length} artículos al inventario por ${moneda(monto)}? Esto NO registrará un pago. Verifica antes cantidades y costos; no podrás repetir estas líneas.`)) return;
    setGuardando(true);
    const { data, error: ingresoError } = await supabase.rpc("ingresar_factura_a_inventario", { p_factura_id: facturaId, p_linea_ids: ids });
    setGuardando(false);
    if (ingresoError) { setError(`No se ingresó inventario: ${ingresoError.message}`); return; }
    setSeleccionadas(new Set());
    setAviso(`${data} artículos ingresados a existencias. La factura y la caja siguen sin cambios de pago.`);
    await alGuardar();
  }

  return <section className="border-t border-orange-200 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">Ingresar artículos de esta factura a existencias</h3><p className="mt-1 text-sm text-slate-600">Primero guarda la revisión de arriba. Luego selecciona las líneas correctas y confirma una sola vez; el pago se registra aparte.</p></div><button type="button" onClick={() => setSeleccionadas(new Set(disponibles.map((linea) => linea.id)))} disabled={!disponibles.length} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50">Seleccionar disponibles</button></div>
    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Incluir</th><th className="p-3">Artículo de factura</th><th className="p-3">Insumo</th><th className="p-3">Cantidad base</th><th className="p-3 text-right">Costo</th><th className="p-3">Estado</th></tr></thead><tbody>{lineas.map((linea) => { const insumo = ingredientes.find((item) => item.id === linea.ingrediente_id); const lista = disponibles.some((item) => item.id === linea.id); return <tr key={linea.id} className="border-t border-slate-100"><td className="p-3"><input type="checkbox" aria-label={`Ingresar ${linea.descripcion}`} checked={lista && seleccionadas.has(linea.id)} disabled={!lista || guardando} onChange={(event) => setSeleccionadas((actual) => { const siguiente = new Set(actual); if (event.target.checked) siguiente.add(linea.id); else siguiente.delete(linea.id); return siguiente; })}/></td><td className="p-3 font-semibold">{linea.descripcion}</td><td className="p-3">{insumo?.nombre || "Sin vincular"}</td><td className="p-3">{linea.cantidad_base ?? "—"} {insumo?.unidad_base || ""}</td><td className="p-3 text-right">{moneda(linea.monto)}</td><td className="p-3 text-xs">{linea.compra_ingrediente_id ? "Ya ingresado o vinculado" : lista ? "Disponible" : "Falta insumo o cantidad"}</td></tr>; })}</tbody></table></div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">{ids.length} artículos · {moneda(monto)} de costo documentado</p><button type="button" disabled={!ids.length || guardando} onClick={() => void ingresar()} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{guardando ? "Ingresando…" : "Ingresar seleccionados a existencias"}</button></div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {aviso && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}
  </section>;
}
