"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AccesoPage() {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [modoRegistro, setModoRegistro] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(event: FormEvent) {
    event.preventDefault();
    setMensaje(""); setEnviando(true);
    const respuesta = modoRegistro
      ? await supabase.auth.signUp({ email, password, options: { data: { nombre } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setEnviando(false);
    if (respuesta.error) { setMensaje(respuesta.error.message); return; }
    setMensaje(modoRegistro ? "Cuenta creada. Revisa tu correo para confirmar el acceso si Supabase te lo solicita." : "Acceso correcto. Entrando al CRM…");
  }

  return <main className="grid min-h-screen place-items-center bg-slate-950 p-5"><section className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[1fr_1.05fr]"><aside className="hidden bg-orange-600 p-10 text-white lg:block"><div className="grid size-12 place-items-center rounded-2xl bg-white/15 text-xl font-black">I</div><p className="mt-14 text-xs font-bold uppercase tracking-[.22em] text-orange-100">La Cocina de Isa</p><h1 className="mt-3 text-4xl font-black leading-tight">Tu operación, protegida.</h1><p className="mt-4 text-sm leading-6 text-orange-50">Cada persona tendrá acceso únicamente a los módulos que necesita para trabajar.</p><div className="mt-12 flex items-center gap-3 text-sm font-semibold"><ShieldCheck className="h-5 w-5" /> Acceso seguro por rol</div></aside><div className="p-7 sm:p-10"><div className="flex size-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600 lg:hidden"><KeyRound className="h-5 w-5" /></div><p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-orange-600">Acceso al CRM</p><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{modoRegistro ? "Crear cuenta" : "Bienvenido"}</h2><p className="mt-2 text-sm text-slate-500">{modoRegistro ? "Tu administrador asignará el rol y módulos permitidos." : "Ingresa con tu cuenta de trabajo."}</p><form onSubmit={enviar} className="mt-7 space-y-4">{modoRegistro && <label className="block text-sm font-bold text-slate-700">Nombre completo<div className="relative mt-1.5"><UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required value={nombre} onChange={(event) => setNombre(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 outline-none focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100" placeholder="Tu nombre" /></div></label>}<label className="block text-sm font-bold text-slate-700">Correo<div className="relative mt-1.5"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 outline-none focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100" placeholder="correo@empresa.com" /></div></label><label className="block text-sm font-bold text-slate-700">Contraseña<div className="relative mt-1.5"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 outline-none focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100" placeholder="Mínimo 8 caracteres" /></div></label>{mensaje && <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{mensaje}</p>}<button disabled={enviando} className="w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50">{enviando ? "Procesando…" : modoRegistro ? "Crear cuenta" : "Iniciar sesión"}</button></form><button onClick={() => { setModoRegistro(!modoRegistro); setMensaje(""); }} className="mt-5 text-sm font-bold text-orange-600 hover:text-orange-700">{modoRegistro ? "Ya tengo una cuenta" : "Crear mi cuenta"}</button></div></section></main>;
}
