"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, MapPin, Pencil, Plus, Search, Users, X } from "lucide-react";
import { CANALES, Cliente, moneda } from "@/lib/crm";
import { supabase } from "@/lib/supabase";

type Direccion = { id: string; etiqueta: string; direccion: string; departamento?: string | null; municipio?: string | null; zona?: string | null; referencia?: string | null; principal: boolean };
type FormCliente = { nombre: string; telefono: string; email: string; nit: string; razon_social: string; canal_origen: string; estado: string; notas: string; direccion: string; departamento: string; municipio: string; zona: string; referencia: string };
const nuevoFormulario: FormCliente = { nombre: "", telefono: "", email: "", nit: "", razon_social: "", canal_origen: "Manual", estado: "Activo", notas: "", direccion: "", departamento: "", municipio: "", zona: "", referencia: "" };
const campo = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [direcciones, setDirecciones] = useState<Record<string, Direccion[]>>({});
  const [form, setForm] = useState<FormCliente>(nuevoFormulario);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const [canalFiltro, setCanalFiltro] = useState("Todos");
  const [estadoFiltro, setEstadoFiltro] = useState("Activos");
  const [fiscalFiltro, setFiscalFiltro] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [clientesRespuesta, direccionesRespuesta] = await Promise.all([
      supabase.from("clientes").select("*").order("created_at", { ascending: false }),
      supabase.from("cliente_direcciones").select("id, cliente_id, etiqueta, direccion, departamento, municipio, zona, referencia, principal").order("principal", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    if (clientesRespuesta.error || direccionesRespuesta.error) alert(`No se pudo cargar: ${(clientesRespuesta.error || direccionesRespuesta.error)?.message}`);
    setClientes((clientesRespuesta.data || []) as Cliente[]);
    const agrupadas: Record<string, Direccion[]> = {};
    for (const direccion of (direccionesRespuesta.data || []) as (Direccion & { cliente_id: string })[]) (agrupadas[direccion.cliente_id] ||= []).push(direccion);
    setDirecciones(agrupadas);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);
  const cambiar = (campoForm: keyof FormCliente, valor: string) => setForm((actual) => ({ ...actual, [campoForm]: valor }));
  function limpiar() { setEditandoId(null); setForm(nuevoFormulario); }
  function editar(cliente: Cliente) {
    const principal = (direcciones[cliente.id] || []).find((direccion) => direccion.principal) || direcciones[cliente.id]?.[0];
    setEditandoId(cliente.id);
    setForm({ nombre: cliente.nombre || "", telefono: cliente.telefono || "", email: cliente.email || "", nit: cliente.nit || "", razon_social: cliente.razon_social || "", canal_origen: cliente.canal_origen || "Manual", estado: (cliente as Cliente & { estado?: string }).estado || "Activo", notas: cliente.notas || "", direccion: principal?.direccion || "", departamento: principal?.departamento || "", municipio: principal?.municipio || "", zona: principal?.zona || "", referencia: principal?.referencia || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form.nombre.trim()) return;
    setSaving(true);
    const datosCliente = { nombre: form.nombre.trim(), telefono: form.telefono.trim() || null, email: form.email.trim() || null, nit: form.nit.trim() || null, razon_social: form.razon_social.trim() || null, canal_origen: form.canal_origen, estado: form.estado, notas: form.notas.trim() || null };
    const respuesta = editandoId ? await supabase.from("clientes").update(datosCliente).eq("id", editandoId).select("id").single() : await supabase.from("clientes").insert(datosCliente).select("id").single();
    if (respuesta.error || !respuesta.data) { setSaving(false); alert(`No se pudo guardar: ${respuesta.error?.message || "Error desconocido"}`); return; }
    const clienteId = respuesta.data.id;
    if (form.direccion.trim()) {
      const direccionActual = (direcciones[clienteId] || []).find((direccion) => direccion.principal) || direcciones[clienteId]?.[0];
      const datosDireccion = { cliente_id: clienteId, etiqueta: "Principal", direccion: form.direccion.trim(), departamento: form.departamento.trim() || null, municipio: form.municipio.trim() || null, zona: form.zona.trim() || null, referencia: form.referencia.trim() || null, principal: true };
      const direccionRespuesta = direccionActual ? await supabase.from("cliente_direcciones").update(datosDireccion).eq("id", direccionActual.id) : await supabase.from("cliente_direcciones").insert(datosDireccion);
      if (direccionRespuesta.error) { setSaving(false); alert(`Cliente guardado, pero no su dirección: ${direccionRespuesta.error.message}`); return; }
    }
    setSaving(false); limpiar(); await cargar();
  }

  const filtrados = useMemo(() => clientes.filter((cliente) => {
    const texto = `${cliente.nombre} ${cliente.telefono || ""} ${cliente.email || ""} ${cliente.nit || ""}`.toLowerCase();
    const estado = (cliente as Cliente & { estado?: string }).estado || "Activo";
    return texto.includes(buscar.toLowerCase()) && (canalFiltro === "Todos" || cliente.canal_origen === canalFiltro) && (estadoFiltro === "Todos" || (estadoFiltro === "Activos" ? estado === "Activo" : estado !== "Activo")) && (fiscalFiltro === "Todos" || (fiscalFiltro === "Con NIT" ? Boolean(cliente.nit) : !cliente.nit));
  }), [clientes, buscar, canalFiltro, estadoFiltro, fiscalFiltro]);

  return <section className="space-y-7 p-6 md:p-10">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">CRM comercial</p><h1 className="mt-1 text-4xl font-black text-slate-950">Clientes</h1><p className="mt-2 text-slate-500">Datos comerciales, facturación y direcciones listas para tomar pedidos.</p></div><div className="rounded-2xl bg-blue-600 px-5 py-4 text-white"><p className="text-sm opacity-80">Clientes registrados</p><p className="text-2xl font-black">{clientes.length}</p></div></header>
    <div className="grid gap-6 xl:grid-cols-[410px_minmax(0,1fr)]">
      <form onSubmit={guardar} className="h-fit space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-black text-slate-950">{editandoId ? <Pencil size={20}/> : <Plus size={20}/>} {editandoId ? "Editar cliente" : "Nuevo cliente"}</h2>{editandoId && <button type="button" onClick={limpiar} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button>}</div>
        <input required placeholder="Nombre o razón comercial *" value={form.nombre} onChange={(e) => cambiar("nombre", e.target.value)} className={campo}/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><input placeholder="WhatsApp / teléfono" value={form.telefono} onChange={(e) => cambiar("telefono", e.target.value)} className={campo}/><input type="email" placeholder="Correo" value={form.email} onChange={(e) => cambiar("email", e.target.value)} className={campo}/></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><input placeholder="NIT" value={form.nit} onChange={(e) => cambiar("nit", e.target.value)} className={campo}/><input placeholder="Razón social para FEL" value={form.razon_social} onChange={(e) => cambiar("razon_social", e.target.value)} className={campo}/></div>
        <div className="grid grid-cols-2 gap-3"><select value={form.canal_origen} onChange={(e) => cambiar("canal_origen", e.target.value)} className={campo}>{CANALES.map((canal) => <option key={canal}>{canal}</option>)}</select><select value={form.estado} onChange={(e) => cambiar("estado", e.target.value)} className={campo}><option>Activo</option><option>Inactivo</option></select></div>
        <div className="border-t border-slate-100 pt-4"><p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><MapPin className="h-4 w-4 text-orange-600"/> Dirección principal</p><textarea placeholder="Dirección completa de entrega" value={form.direccion} onChange={(e) => cambiar("direccion", e.target.value)} className={`${campo} min-h-20 resize-y`}/><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><input placeholder="Departamento" value={form.departamento} onChange={(e) => cambiar("departamento", e.target.value)} className={campo}/><input placeholder="Municipio" value={form.municipio} onChange={(e) => cambiar("municipio", e.target.value)} className={campo}/><input placeholder="Zona" value={form.zona} onChange={(e) => cambiar("zona", e.target.value)} className={campo}/></div><input placeholder="Referencia (opcional)" value={form.referencia} onChange={(e) => cambiar("referencia", e.target.value)} className={`${campo} mt-3`}/></div>
        <textarea placeholder="Notas internas" value={form.notas} onChange={(e) => cambiar("notas", e.target.value)} className={`${campo} min-h-20 resize-y`}/><button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 p-3 font-bold text-white hover:bg-orange-600 disabled:opacity-50"><Check size={17}/>{saving ? "Guardando…" : editandoId ? "Guardar cambios" : "Crear cliente"}</button>
      </form>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="space-y-3 border-b p-5"><label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3"><Search size={18} className="text-slate-400"/><input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, teléfono, correo o NIT" className="w-full border-0 bg-transparent p-3 outline-none"/></label><div className="grid gap-2 sm:grid-cols-3"><select value={canalFiltro} onChange={(e) => setCanalFiltro(e.target.value)} className={campo}><option>Todos</option>{CANALES.map((canal) => <option key={canal}>{canal}</option>)}</select><select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className={campo}><option>Activos</option><option>Inactivos</option><option>Todos</option></select><select value={fiscalFiltro} onChange={(e) => setFiscalFiltro(e.target.value)} className={campo}><option>Todos</option><option>Con NIT</option><option>Sin NIT</option></select></div><p className="text-xs font-semibold text-slate-500">{filtrados.length} cliente{filtrados.length === 1 ? "" : "s"} encontrado{filtrados.length === 1 ? "" : "s"}</p></div>
        {loading ? <p className="p-8 text-slate-500">Cargando clientes…</p> : <div className="divide-y divide-slate-100">{filtrados.map((cliente) => { const principal = (direcciones[cliente.id] || []).find((direccion) => direccion.principal) || direcciones[cliente.id]?.[0]; return <article key={cliente.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-slate-950">{cliente.nombre}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{(cliente as Cliente & { estado?: string }).estado || "Activo"}</span></div><p className="mt-1 text-sm text-slate-500">{cliente.telefono || "Sin teléfono"}{cliente.email ? ` · ${cliente.email}` : ""}</p><p className="mt-1 text-xs font-semibold text-blue-600">{cliente.canal_origen} {cliente.nit ? `· NIT ${cliente.nit}` : "· Sin NIT"}</p>{principal && <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500"/>{principal.direccion}{[principal.departamento, principal.municipio, principal.zona].filter(Boolean).length ? ` · ${[principal.departamento, principal.municipio, principal.zona].filter(Boolean).join(", ")}` : ""}</p>}</div><div className="flex items-center gap-5 lg:text-right"><div><p className="text-xs text-slate-500">Saldo pendiente</p><p className="font-black text-amber-600">{moneda(cliente.saldo)}</p></div><button type="button" onClick={() => editar(cliente)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-orange-300 hover:text-orange-700"><Pencil size={15}/> Editar</button></div></article>; })}{!filtrados.length && <div className="grid place-items-center gap-2 p-12 text-slate-500"><Users/><p>No hay clientes que coincidan con estos filtros.</p></div>}</div>}
      </div>
    </div>
  </section>;
}
