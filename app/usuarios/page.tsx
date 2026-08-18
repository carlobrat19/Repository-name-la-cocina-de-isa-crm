"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, MailPlus, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { ModuloCrm, RolCrm, useCrmAuth } from "@/components/auth/AuthGate";
import { supabase } from "@/lib/supabase";

type Perfil = { id: string; email: string; nombre: string | null; rol: RolCrm; activo: boolean; created_at: string };
type Invitacion = { id: string; email: string; nombre: string | null; rol: RolCrm; activo: boolean; modulos: ModuloCrm[]; activado_at: string | null };

const roles: RolCrm[] = ["Ventas", "Producción", "Reparto", "Caja", "Sin acceso"];
const modulos: { id: ModuloCrm; label: string; detalle: string }[] = [
  { id: "dashboard", label: "Resumen", detalle: "Indicadores principales" }, { id: "pedidos", label: "Pedidos", detalle: "Crear y gestionar ventas" },
  { id: "clientes", label: "Clientes", detalle: "Ficha, direcciones y etiquetas" }, { id: "conversaciones", label: "Conversaciones", detalle: "WhatsApp, Meta y respuestas" },
  { id: "productos", label: "Productos y catálogo", detalle: "Catálogo, fotos, precios y canales" }, { id: "recetas_costos", label: "Recetas y costos", detalle: "Recetas estándar y costo por producto" },
  { id: "ingredientes", label: "Ingredientes", detalle: "Inventario y costos de materias primas" }, { id: "produccion", label: "Producción", detalle: "Preparación de pedidos" },
  { id: "pendientes", label: "Pendientes", detalle: "Control de productos" }, { id: "cobros_fel", label: "Cobros y FEL", detalle: "Pagos y facturación" },
  { id: "flujo_caja", label: "Flujo de caja", detalle: "Movimientos de efectivo" }, { id: "reportes", label: "Reportes", detalle: "Resultados y métricas" },
  { id: "integraciones", label: "Integraciones", detalle: "Configuraciones externas" },
];

export default function UsuariosPage() {
  const { id: administradorId, rol: rolActual } = useCrmAuth();
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [permisos, setPermisos] = useState<Record<string, ModuloCrm[]>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [nombre, setNombre] = useState(""); const [email, setEmail] = useState(""); const [rol, setRol] = useState<RolCrm>("Ventas"); const [seleccion, setSeleccion] = useState<ModuloCrm[]>(["pedidos", "clientes"]);
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    setCargando(true);
    const [perfilesRespuesta, invitacionesRespuesta, permisosRespuesta] = await Promise.all([
      supabase.from("perfiles_crm").select("*").order("created_at", { ascending: false }),
      supabase.from("invitaciones_crm").select("*").order("creado_at", { ascending: false }),
      supabase.from("permisos_usuario_crm").select("user_id, modulo"),
    ]);
    if (perfilesRespuesta.error || invitacionesRespuesta.error || permisosRespuesta.error) setMensaje("No se pudo cargar la administración de usuarios.");
    setPerfiles((perfilesRespuesta.data ?? []) as Perfil[]); setInvitaciones((invitacionesRespuesta.data ?? []) as Invitacion[]);
    const agrupados: Record<string, ModuloCrm[]> = {};
    (permisosRespuesta.data ?? []).forEach((permiso) => { (agrupados[permiso.user_id] ??= []).push(permiso.modulo as ModuloCrm); });
    setPermisos(agrupados); setCargando(false);
  }

  useEffect(() => { const timeout = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timeout); }, []);
  function alternar(lista: ModuloCrm[], modulo: ModuloCrm) { return lista.includes(modulo) ? lista.filter((item) => item !== modulo) : [...lista, modulo]; }

  async function crearInvitacion(event: FormEvent) {
    event.preventDefault(); setMensaje(""); setGuardando("nueva");
    const { error } = await supabase.from("invitaciones_crm").insert({ email: email.trim().toLowerCase(), nombre: nombre.trim() || null, rol, modulos: seleccion, creado_por: administradorId });
    setGuardando(null);
    if (error) { setMensaje(`No se pudo preparar la cuenta: ${error.message}`); return; }
    setNombre(""); setEmail(""); setRol("Ventas"); setSeleccion(["pedidos", "clientes"]); setMensaje("Cuenta autorizada. La persona ya puede activar su acceso con ese correo."); await cargar();
  }

  async function actualizarPerfil(perfil: Perfil, cambios: Partial<Pick<Perfil, "rol" | "activo">>) {
    setGuardando(perfil.id); const { error } = await supabase.from("perfiles_crm").update(cambios).eq("id", perfil.id); setGuardando(null);
    if (error) { setMensaje(`No se pudo actualizar: ${error.message}`); return; } setPerfiles((actuales) => actuales.map((actual) => actual.id === perfil.id ? { ...actual, ...cambios } : actual));
  }

  async function actualizarModulos(perfil: Perfil, nuevos: ModuloCrm[]) {
    setGuardando(perfil.id); const actuales = permisos[perfil.id] ?? [];
    const borrar = actuales.filter((modulo) => !nuevos.includes(modulo)); const agregar = nuevos.filter((modulo) => !actuales.includes(modulo));
    const operaciones = [
      borrar.length ? supabase.from("permisos_usuario_crm").delete().eq("user_id", perfil.id).in("modulo", borrar) : Promise.resolve({ error: null }),
      agregar.length ? supabase.from("permisos_usuario_crm").insert(agregar.map((modulo) => ({ user_id: perfil.id, modulo }))) : Promise.resolve({ error: null }),
    ];
    const resultados = await Promise.all(operaciones); setGuardando(null);
    const error = resultados.find((resultado) => resultado.error)?.error; if (error) { setMensaje(`No se pudieron guardar módulos: ${error.message}`); return; }
    setPermisos((actualesPermisos) => ({ ...actualesPermisos, [perfil.id]: nuevos }));
  }

  if (rolActual !== "Administrador") return <main className="min-h-screen bg-[#f7f7f8] p-10 text-center text-slate-500">Solo el Administrador puede gestionar usuarios.</main>;
  return <main className="min-h-screen bg-[#f7f7f8] px-4 py-6 sm:px-6 lg:px-10 lg:py-9"><div className="mx-auto max-w-6xl"><header className="mb-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-600">Administración privada</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Usuarios y permisos</h1><p className="mt-1 text-sm text-slate-500">Solo tú puedes autorizar cuentas y decidir módulo por módulo qué verá cada persona.</p></header>{mensaje && <p className="mb-5 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800">{mensaje}</p>}<section className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]"><form onSubmit={crearInvitacion} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-orange-50 p-2 text-orange-600"><MailPlus className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-950">Autorizar nueva cuenta</h2><p className="text-xs text-slate-500">Nadie puede registrarse sin esta aprobación.</p></div></div><div className="mt-5 space-y-3"><input required value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Nombre de la persona" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@empresa.com" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400" /><select value={rol} onChange={(event) => setRol(event.target.value as RolCrm)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-orange-400">{roles.map((opcion) => <option key={opcion}>{opcion}</option>)}</select></div><p className="mt-5 text-xs font-bold uppercase tracking-[.14em] text-slate-500">Módulos permitidos</p><div className="mt-3 grid gap-2">{modulos.map((modulo) => <label key={modulo.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 p-2.5 hover:bg-slate-50"><input type="checkbox" checked={seleccion.includes(modulo.id)} onChange={() => setSeleccion((actual) => alternar(actual, modulo.id))} className="size-4 accent-orange-500" /><span><b className="block text-sm text-slate-800">{modulo.label}</b><small className="text-xs text-slate-500">{modulo.detalle}</small></span></label>)}</div><button disabled={guardando === "nueva"} className="mt-5 w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">{guardando === "nueva" ? "Autorizando…" : "Autorizar cuenta"}</button></form><div className="space-y-6"><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><div className="rounded-xl bg-orange-50 p-2 text-orange-600"><UsersRound className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-900">Equipo activo</h2><p className="text-xs text-slate-500">El cambio de módulos se guarda al marcar cada casilla.</p></div></div>{cargando ? <div className="p-10 text-center text-sm text-slate-500">Cargando usuarios…</div> : <div className="divide-y divide-slate-100">{perfiles.map((perfil) => <article key={perfil.id} className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-slate-100 p-2 text-slate-500"><UserRound className="h-4 w-4" /></div><div><p className="text-sm font-bold text-slate-900">{perfil.nombre || "Sin nombre"}</p><p className="text-xs text-slate-500">{perfil.email}</p></div></div>{perfil.email === "carlobrat@gmail.com" ? <span className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">Administrador principal</span> : <div className="flex gap-2"><select disabled={guardando === perfil.id} value={perfil.rol} onChange={(event) => void actualizarPerfil(perfil, { rol: event.target.value as RolCrm })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"><option>Ventas</option><option>Producción</option><option>Reparto</option><option>Caja</option><option>Sin acceso</option></select><button disabled={guardando === perfil.id} onClick={() => void actualizarPerfil(perfil, { activo: !perfil.activo })} className={`rounded-xl px-3 py-2 text-xs font-bold ${perfil.activo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{perfil.activo ? "Activo" : "Desactivado"}</button></div>}</div>{perfil.email !== "carlobrat@gmail.com" && <div className="mt-4 grid gap-2 sm:grid-cols-2">{modulos.map((modulo) => { const permitidos = permisos[perfil.id] ?? []; return <label key={modulo.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"><input type="checkbox" disabled={guardando === perfil.id} checked={permitidos.includes(modulo.id)} onChange={() => void actualizarModulos(perfil, alternar(permitidos, modulo.id))} className="size-4 accent-orange-500" />{modulo.label}</label>; })}</div>}</article>)}</div>}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-orange-600" /><div><h2 className="font-bold text-slate-900">Cuentas autorizadas pendientes</h2><p className="text-xs text-slate-500">Estas personas aún deben activar su acceso desde la pantalla de inicio.</p></div></div><div className="mt-4 space-y-2">{invitaciones.filter((invitacion) => !invitacion.activado_at).length === 0 ? <p className="text-sm text-slate-500">No hay autorizaciones pendientes.</p> : invitaciones.filter((invitacion) => !invitacion.activado_at).map((invitacion) => <div key={invitacion.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span><b className="block text-sm text-slate-800">{invitacion.nombre || invitacion.email}</b><small className="text-xs text-slate-500">{invitacion.email} · {invitacion.modulos.length} módulos</small></span><Check className="h-4 w-4 text-emerald-600" /></div>)}</div></section></div></section></div></main>;
}
