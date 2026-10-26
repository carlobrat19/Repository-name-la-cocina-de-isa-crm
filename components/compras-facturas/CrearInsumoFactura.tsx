"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type InsumoFactura = { id: string; nombre: string; unidad_base: "g" | "ml" | "unidad" };

export default function CrearInsumoFactura({ descripcion, existentes, alCrear }: {
  descripcion: string;
  existentes: InsumoFactura[];
  alCrear: (insumo: InsumoFactura) => Promise<void> | void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState<InsumoFactura["unidad_base"]>("unidad");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function crear() {
    const nombreFinal = nombre.trim();
    setError("");
    if (!nombreFinal) { setError("Escribe el nombre del insumo."); return; }
    if (existentes.some((item) => item.nombre.trim().toLocaleLowerCase("es-GT") === nombreFinal.toLocaleLowerCase("es-GT"))) {
      setError("Ese insumo ya existe. Selecciónalo en la lista para no duplicarlo.");
      return;
    }
    setGuardando(true);
    const { data, error: guardarError } = await supabase.from("ingredientes").insert({
      nombre: nombreFinal,
      unidad_base: unidad,
      stock_actual: 0,
      costo_referencia: 0,
      notas: `Creado al revisar artículo de factura: ${descripcion.trim()}`,
    }).select("id,nombre,unidad_base").single();
    if (guardarError || !data) {
      setError(guardarError?.code === "23505" ? "Ese insumo ya existe. Actualiza el catálogo y selecciónalo." : guardarError?.message || "No se pudo crear el insumo.");
      setGuardando(false);
      return;
    }
    try {
      await alCrear(data as InsumoFactura);
      setAbierto(false);
      setNombre("");
    } catch {
      setError("El insumo se creó, pero no se pudo actualizar esta vista. Recarga y vincúlalo desde la lista.");
    }
    setGuardando(false);
  }

  return <div className="mt-2 text-xs">
    <button type="button" onClick={() => { setAbierto((actual) => !actual); setError(""); if (!nombre) setNombre(descripcion.trim()); }} className="font-bold text-orange-700 underline">
      {abierto ? "Cancelar nuevo insumo" : "+ Crear insumo nuevo"}
    </button>
    {abierto && <div className="mt-2 grid gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
      <label className="font-bold">Nombre en el catálogo<input aria-label="Nombre del nuevo insumo" value={nombre} onChange={(event) => setNombre(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 font-normal"/></label>
      <label className="font-bold">Unidad base<select aria-label="Unidad base del nuevo insumo" value={unidad} onChange={(event) => setUnidad(event.target.value as InsumoFactura["unidad_base"])} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 font-normal"><option value="unidad">Unidad</option><option value="g">Gramos</option><option value="ml">Mililitros</option></select></label>
      <button type="button" disabled={guardando} onClick={() => void crear()} className="self-end rounded-lg bg-orange-500 px-3 py-2 font-bold text-white disabled:opacity-50">{guardando ? "Creando…" : "Crear y vincular"}</button>
      <p className="text-slate-600 sm:col-span-3">Se crea con existencias y costo en cero. Indica después la cantidad comprada en la unidad elegida; no se registra una compra ni un pago automáticamente.</p>
      {error && <p role="alert" className="text-rose-700 sm:col-span-3">{error}</p>}
    </div>}
  </div>;
}
