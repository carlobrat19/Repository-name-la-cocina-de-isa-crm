"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Perfil = { id: string; email: string; nombre: string | null; rol: string; activo: boolean; created_at: string };
const ROLES = ["Administrador", "Ventas", "Producción", "Reparto", "Caja", "Sin acceso"];

export default function UsuariosPage() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const { data, error } = await supabase.from("perfiles_crm").select("*").order("created_at", { ascending: false });
    if (error) console.error(error);
    setPerfiles((data || []) as Perfil[]);
    setCargando(false);
  }

  useEffect(() => { const timeout = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timeout); }, []);

  async function actualizar(perfil: Perfil, cambios: Partial<Pick<Perfil, "rol" | "activo">>) {
    setGuardando(perfil.id);
    const { error } = await supabase.from("perfiles_crm").update(cambios).eq("id", perfil.id);
    if (error) alert(`No se pudo actualizar: ${error.message}`);
    else setPerfiles((actuales) => actuales.map((actual) => actual.id === perfil.id ? { ...actual, ...cambios } : actual));
    setGuardando(null);
  }

  return <main className="min-h-screen bg-[#f7f7f8] px-4 py-6 sm:px-6 lg:px-10 lg:py-9"><div className="mx-auto max-w-5xl"><header className="mb-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-600">Administración</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Usuarios y permisos</h1><p className="mt-1 text-sm text-slate-500">Las cuentas nuevas no ven información hasta que les asignas un rol.</p></header><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><div className="rounded-xl bg-orange-50 p-2 text-orange-600"><UsersRound className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-900">Equipo registrado</h2><p className="text-xs text-slate-500">Control de módulos por rol.</p></div></div>{cargando ? <div className="p-10 text-center text-sm text-slate-500">Cargando usuarios…</div> : perfiles.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Aún no hay cuentas registradas.</div> : <div className="divide-y divide-slate-100">{perfiles.map((perfil) => <div key={perfil.id} className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_190px_auto] md:items-center"><div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-slate-100 p-2 text-slate-500"><UserRound className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{perfil.nombre || "Sin nombre"}</p><p className="truncate text-xs text-slate-500">{perfil.email}</p></div></div><select disabled={guardando === perfil.id} value={perfil.rol} onChange={(event) => void actualizar(perfil, { rol: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-orange-400">{ROLES.map((rol) => <option key={rol}>{rol}</option>)}</select><button disabled={guardando === perfil.id} onClick={() => void actualizar(perfil, { activo: !perfil.activo })} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${perfil.activo ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}><ShieldCheck className="h-4 w-4" />{perfil.activo ? "Activo" : "Desactivado"}</button></div>)}</div>}</section></div></main>;
}
