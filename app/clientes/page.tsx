"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, Search, Users } from "lucide-react";

import { Cliente, CANALES, moneda } from "@/lib/crm";
import { supabase } from "@/lib/supabase";

const initialForm = { nombre: "", telefono: "", email: "", nit: "", razon_social: "", canal_origen: "Manual", notas: "" };

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [form, setForm] = useState(initialForm);
  const [buscar, setBuscar] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
    if (error) alert(`No se pudo cargar clientes: ${error.message}`);
    setClientes((data || []) as Cliente[]);
    setLoading(false);
  }, []);

  // La consulta remota actualiza estado al resolverse, no durante el render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void cargar(); }, [cargar]);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("clientes").insert({ ...form, nombre: form.nombre.trim() });
    setSaving(false);
    if (error) return alert(`No se pudo guardar: ${error.message}`);
    setForm(initialForm);
    await cargar();
  }

  const filtrados = clientes.filter((cliente) => `${cliente.nombre} ${cliente.telefono || ""} ${cliente.email || ""}`.toLowerCase().includes(buscar.toLowerCase()));

  return <section className="space-y-8 p-6 md:p-10">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-sm font-bold uppercase tracking-[.2em] text-blue-600">CRM comercial</p><h1 className="text-4xl font-black">Clientes</h1><p className="mt-2 text-gray-500">Una ficha única para ventas, conversaciones, direcciones y facturación.</p></div>
      <div className="rounded-2xl bg-blue-600 px-5 py-4 text-white"><p className="text-sm opacity-80">Clientes registrados</p><p className="text-2xl font-black">{clientes.length}</p></div>
    </header>
    <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
      <form onSubmit={guardar} className="h-fit space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="flex items-center gap-2 text-xl font-black"><Plus size={20}/> Nuevo cliente</h2>
        <input required placeholder="Nombre o razón comercial *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full rounded-xl border p-3" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><input placeholder="WhatsApp / teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="rounded-xl border p-3" /><input type="email" placeholder="Correo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl border p-3" /></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><input placeholder="NIT" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} className="rounded-xl border p-3" /><input placeholder="Razón social para FEL" value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} className="rounded-xl border p-3" /></div>
        <select value={form.canal_origen} onChange={(e) => setForm({ ...form, canal_origen: e.target.value })} className="w-full rounded-xl border p-3">{CANALES.map((canal) => <option key={canal}>{canal}</option>)}</select>
        <textarea placeholder="Notas internas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="min-h-24 w-full rounded-xl border p-3" />
        <button disabled={saving} className="w-full rounded-xl bg-gray-950 p-3 font-bold text-white disabled:opacity-50">{saving ? "Guardando…" : "Crear cliente"}</button>
      </form>
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="border-b p-5"><label className="flex items-center gap-2 rounded-xl bg-gray-50 px-3"><Search size={18} className="text-gray-400"/><input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, teléfono o correo" className="w-full border-0 bg-transparent p-3 outline-none"/></label></div>
        {loading ? <p className="p-8 text-gray-500">Cargando clientes…</p> : <div className="divide-y">{filtrados.map((cliente) => <article key={cliente.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black">{cliente.nombre}</h2><p className="text-sm text-gray-500">{cliente.telefono || "Sin teléfono"}{cliente.email ? ` · ${cliente.email}` : ""}</p><p className="mt-1 text-xs font-semibold text-blue-600">{cliente.canal_origen} {cliente.nit ? `· NIT ${cliente.nit}` : ""}</p></div><div className="text-left sm:text-right"><p className="text-xs text-gray-500">Saldo pendiente</p><p className="font-black text-amber-600">{moneda(cliente.saldo)}</p></div></article>)}{!filtrados.length && <div className="grid place-items-center gap-2 p-12 text-gray-500"><Users/><p>No hay clientes que coincidan.</p></div>}</div>}
      </div>
    </div>
  </section>;
}
