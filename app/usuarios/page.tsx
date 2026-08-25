"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Clock3,
  History,
  KeyRound,
  MailPlus,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { ModuloCrm, RolCrm, useCrmAuth } from "@/components/auth/AuthGate";
import { supabase } from "@/lib/supabase";

type Perfil = {
  id: string;
  email: string;
  nombre: string | null;
  rol: RolCrm;
  activo: boolean;
  acceso_hasta: string | null;
  created_at: string;
};
type Invitacion = {
  id: string;
  email: string;
  nombre: string | null;
  rol: RolCrm;
  modulos: ModuloCrm[];
  activado_at: string | null;
  acceso_hasta: string | null;
};
type Auditoria = {
  id: string;
  usuario_id: string | null;
  accion: string;
  detalle: Record<string, string> | null;
  created_at: string;
};
type SucursalAsignable = { id: string; nombre: string };

const roles: RolCrm[] = [
  "Socio / Propietario",
  "Gerencia operativa",
  "Ventas",
  "Producción",
  "Reparto",
  "Caja",
  "Contador",
  "Sin acceso",
];
const etiquetaRol: Record<RolCrm, string> = {
  Administrador: "Administrador principal",
  "Socio / Propietario": "Socio / Propietario",
  "Gerencia operativa": "Gerencia operativa",
  Ventas: "Ventas",
  Producción: "Producción",
  Reparto: "Reparto",
  Caja: "Caja",
  Contador: "Contador",
  "Sin acceso": "Sin acceso",
};
const modulos: { id: ModuloCrm; label: string; detalle: string }[] = [
  { id: "inicio", label: "Inicio", detalle: "Portada y accesos rápidos" },
  { id: "dashboard", label: "Resumen", detalle: "Indicadores principales" },
  { id: "pedidos", label: "Pedidos", detalle: "Crear y gestionar ventas" },
  { id: "clientes", label: "Clientes", detalle: "Fichas y direcciones" },
  { id: "conversaciones", label: "Conversaciones", detalle: "WhatsApp y Meta" },
  {
    id: "productos",
    label: "Productos y catálogo",
    detalle: "Fotos, precios y canales",
  },
  {
    id: "recetas_costos",
    label: "Recetas y costos",
    detalle: "Receta estándar y rentabilidad",
  },
  {
    id: "ingredientes",
    label: "Ingredientes",
    detalle: "Inventario de materias primas",
  },
  { id: "produccion", label: "Producción", detalle: "Preparación de pedidos" },
  { id: "pendientes", label: "Pendientes", detalle: "Productos por preparar" },
  {
    id: "punto_venta",
    label: "Punto de venta",
    detalle: "Caja, cobros y ventas de sucursal",
  },
  {
    id: "sucursales",
    label: "Sucursales e inventario",
    detalle: "Traslados, existencias y puntos de venta",
  },
  { id: "cobros_fel", label: "Cobros y FEL", detalle: "Pagos y facturación" },
  {
    id: "flujo_caja",
    label: "Flujo de caja",
    detalle: "Cuentas y movimientos",
  },
  { id: "reportes", label: "Reportes", detalle: "Resultados y métricas" },
  {
    id: "integraciones",
    label: "Integraciones",
    detalle: "Conexiones externas",
  },
];
const plantillas: Record<
  Exclude<RolCrm, "Administrador" | "Sin acceso">,
  ModuloCrm[]
> = {
  "Socio / Propietario": [
    "inicio",
    "dashboard",
    "pedidos",
    "clientes",
    "conversaciones",
    "productos",
    "recetas_costos",
    "ingredientes",
    "produccion",
    "pendientes",
    "punto_venta",
    "sucursales",
    "cobros_fel",
    "flujo_caja",
    "reportes",
  ],
  "Gerencia operativa": [
    "inicio",
    "dashboard",
    "pedidos",
    "clientes",
    "conversaciones",
    "productos",
    "recetas_costos",
    "ingredientes",
    "produccion",
    "pendientes",
    "punto_venta",
    "sucursales",
    "reportes",
  ],
  Ventas: [
    "inicio",
    "dashboard",
    "pedidos",
    "clientes",
    "conversaciones",
    "productos",
    "punto_venta",
  ],
  Producción: [
    "inicio",
    "dashboard",
    "productos",
    "recetas_costos",
    "ingredientes",
    "produccion",
    "pendientes",
    "sucursales",
  ],
  Reparto: ["inicio", "dashboard", "pedidos"],
  Caja: [
    "inicio",
    "dashboard",
    "pedidos",
    "clientes",
    "punto_venta",
    "cobros_fel",
    "flujo_caja",
  ],
  Contador: [
    "inicio",
    "dashboard",
    "clientes",
    "cobros_fel",
    "flujo_caja",
    "reportes",
  ],
};
const fecha = (valor: string | null) =>
  valor
    ? new Intl.DateTimeFormat("es-GT", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(valor))
    : "Sin vencimiento";
const entradaFecha = (valor: string | null) =>
  valor ? new Date(valor).toISOString().slice(0, 16) : "";

export default function UsuariosPage() {
  const { id: administradorId, rol: rolActual } = useCrmAuth();
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [permisos, setPermisos] = useState<Record<string, ModuloCrm[]>>({});
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);
  const [sucursales, setSucursales] = useState<SucursalAsignable[]>([]);
  const [asignaciones, setAsignaciones] = useState<Record<string, string[]>>(
    {},
  );
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<RolCrm>("Ventas");
  const [seleccion, setSeleccion] = useState<ModuloCrm[]>(plantillas.Ventas);
  const [accesoHasta, setAccesoHasta] = useState("");
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [perfilAbierto, setPerfilAbierto] = useState<string | null>(null);

  async function cargar() {
    const [a, b, c, d, e, f] = await Promise.all([
      supabase
        .from("perfiles_crm")
        .select("id,email,nombre,rol,activo,acceso_hasta,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("invitaciones_crm")
        .select("id,email,nombre,rol,modulos,activado_at,acceso_hasta")
        .order("creado_at", { ascending: false }),
      supabase.from("permisos_usuario_crm").select("user_id,modulo"),
      supabase
        .from("auditoria_usuarios_crm")
        .select("id,usuario_id,accion,detalle,created_at")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("sucursales")
        .select("id,nombre")
        .eq("activa", true)
        .order("nombre"),
      supabase
        .from("usuarios_sucursales")
        .select("usuario_id,sucursal_id")
        .eq("activa", true),
    ]);
    const error =
      a.error || b.error || c.error || d.error || e.error || f.error;
    if (error)
      setMensaje(`No se pudo cargar la administración: ${error.message}`);
    setPerfiles((a.data ?? []) as Perfil[]);
    setInvitaciones((b.data ?? []) as Invitacion[]);
    setAuditoria((d.data ?? []) as Auditoria[]);
    const agrupados: Record<string, ModuloCrm[]> = {};
    (c.data ?? []).forEach((item) => {
      (agrupados[item.user_id] ??= []).push(item.modulo as ModuloCrm);
    });
    setPermisos(agrupados);
    setSucursales((e.data ?? []) as SucursalAsignable[]);
    const porUsuario: Record<string, string[]> = {};
    (f.data ?? []).forEach((item) => {
      (porUsuario[item.usuario_id] ??= []).push(item.sucursal_id);
    });
    setAsignaciones(porUsuario);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const nombres = useMemo(
    () =>
      new Map(
        perfiles.map((perfil) => [perfil.id, perfil.nombre || perfil.email]),
      ),
    [perfiles],
  );
  const alternar = (lista: ModuloCrm[], modulo: ModuloCrm) =>
    lista.includes(modulo)
      ? lista.filter((item) => item !== modulo)
      : [...lista, modulo];
  const aplicarRol = (nuevo: RolCrm) => {
    setRol(nuevo);
    if (nuevo !== "Sin acceso")
      setSeleccion(plantillas[nuevo as keyof typeof plantillas] ?? seleccion);
    else setSeleccion([]);
  };
  async function registrar(
    accion: string,
    usuarioId: string | null,
    detalle: Record<string, string>,
  ) {
    if (administradorId)
      await supabase.from("auditoria_usuarios_crm").insert({
        actor_id: administradorId,
        usuario_id: usuarioId,
        accion,
        detalle,
      });
  }

  async function crear(event: FormEvent) {
    event.preventDefault();
    setGuardando("nuevo");
    const { error } = await supabase.from("invitaciones_crm").insert({
      email: email.trim().toLowerCase(),
      nombre: nombre.trim() || null,
      rol,
      modulos: seleccion,
      creado_por: administradorId,
      acceso_hasta: accesoHasta ? new Date(accesoHasta).toISOString() : null,
    });
    setGuardando(null);
    if (error) {
      setMensaje(error.message);
      return;
    }
    await registrar("Autorizó una cuenta", null, {
      email,
      rol,
      modulos: String(seleccion.length),
      vence: accesoHasta || "Sin vencimiento",
    });
    setNombre("");
    setEmail("");
    aplicarRol("Ventas");
    setAccesoHasta("");
    setMensaje("Cuenta autorizada. La persona ya puede activar su acceso.");
    await cargar();
  }
  async function actualizarPerfil(
    perfil: Perfil,
    cambios: Partial<Pick<Perfil, "rol" | "activo" | "acceso_hasta">>,
  ) {
    setGuardando(perfil.id);
    const { error } = await supabase
      .from("perfiles_crm")
      .update(cambios)
      .eq("id", perfil.id);
    setGuardando(null);
    if (error) {
      setMensaje(error.message);
      return;
    }
    await registrar(
      "Actualizó acceso",
      perfil.id,
      Object.fromEntries(
        Object.entries(cambios).map(([clave, valor]) => [
          clave,
          String(valor ?? "Sin vencimiento"),
        ]),
      ),
    );
    await cargar();
  }
  async function actualizarModulos(perfil: Perfil, nuevos: ModuloCrm[]) {
    setGuardando(perfil.id);
    const actuales = permisos[perfil.id] ?? [];
    const borrar = actuales.filter((item) => !nuevos.includes(item));
    const agregar = nuevos.filter((item) => !actuales.includes(item));
    const resultados = await Promise.all([
      borrar.length
        ? supabase
            .from("permisos_usuario_crm")
            .delete()
            .eq("user_id", perfil.id)
            .in("modulo", borrar)
        : Promise.resolve({ error: null }),
      agregar.length
        ? supabase
            .from("permisos_usuario_crm")
            .insert(agregar.map((modulo) => ({ user_id: perfil.id, modulo })))
        : Promise.resolve({ error: null }),
    ]);
    setGuardando(null);
    const error = resultados.find((resultado) => resultado.error)?.error;
    if (error) {
      setMensaje(error.message);
      return;
    }
    await registrar("Actualizó módulos", perfil.id, {
      modulos: nuevos.join(", ") || "Sin módulos",
    });
    setPermisos({ ...permisos, [perfil.id]: nuevos });
  }
  async function actualizarSucursales(perfil: Perfil, nuevas: string[]) {
    setGuardando(perfil.id);
    const actuales = asignaciones[perfil.id] ?? [];
    const borrar = actuales.filter((id) => !nuevas.includes(id));
    const agregar = nuevas.filter((id) => !actuales.includes(id));
    const resultados = await Promise.all([
      borrar.length
        ? supabase
            .from("usuarios_sucursales")
            .delete()
            .eq("usuario_id", perfil.id)
            .in("sucursal_id", borrar)
        : Promise.resolve({ error: null }),
      agregar.length
        ? supabase.from("usuarios_sucursales").insert(
            agregar.map((sucursal_id) => ({
              usuario_id: perfil.id,
              sucursal_id,
            })),
          )
        : Promise.resolve({ error: null }),
    ]);
    setGuardando(null);
    const error = resultados.find((resultado) => resultado.error)?.error;
    if (error) {
      setMensaje(error.message);
      return;
    }
    setAsignaciones({ ...asignaciones, [perfil.id]: nuevas });
    await registrar("Actualizó sucursales asignadas", perfil.id, {
      sucursales: nuevas.length ? nuevas.join(",") : "Sin sucursal",
    });
  }
  async function restablecer(perfil: Perfil) {
    setGuardando(`reset-${perfil.id}`);
    const { error } = await supabase.auth.resetPasswordForEmail(perfil.email, {
      redirectTo: `${window.location.origin}/restablecer-contrasena`,
    });
    setGuardando(null);
    if (error) {
      setMensaje(error.message);
      return;
    }
    await registrar("Envió restablecimiento de contraseña", perfil.id, {
      email: perfil.email,
    });
    setMensaje(`Se envió un correo seguro a ${perfil.email}.`);
    await cargar();
  }
  async function eliminarCuenta(perfil: Perfil) {
    if (
      !window.confirm(
        `¿Eliminar definitivamente a ${perfil.email}? Solo se permitirá si no tiene pedidos, movimientos ni otra actividad registrada.`,
      )
    )
      return;
    setGuardando(`eliminar-${perfil.id}`);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const respuesta = await fetch(`/api/admin/usuarios/${perfil.id}`, {
      method: "DELETE",
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    });
    const resultado = (await respuesta.json()) as { error?: string };
    setGuardando(null);
    if (!respuesta.ok) {
      setMensaje(resultado.error || "No se pudo eliminar la cuenta.");
      return;
    }
    setMensaje("Cuenta eliminada definitivamente.");
    await cargar();
  }
  async function eliminarInvitacion(invitacion: Invitacion) {
    if (
      !window.confirm(
        `¿Eliminar la autorización pendiente para ${invitacion.email}?`,
      )
    )
      return;
    setGuardando(`invitacion-${invitacion.id}`);
    const { error } = await supabase
      .from("invitaciones_crm")
      .delete()
      .eq("id", invitacion.id);
    setGuardando(null);
    if (error) {
      setMensaje(error.message);
      return;
    }
    await registrar("Eliminó una autorización pendiente", null, {
      email: invitacion.email,
    });
    setMensaje("Autorización pendiente eliminada.");
    await cargar();
  }

  if (rolActual !== "Administrador")
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-center text-slate-500">
        Solo el Administrador puede gestionar usuarios.
      </main>
    );
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-orange-600">
            Administración privada
          </p>
          <h1 className="mt-1 text-3xl font-black">Usuarios y permisos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Solo tú autorizas cuentas, módulos, vencimientos y
            restablecimientos.
          </p>
        </header>
        {mensaje && (
          <p className="mb-5 rounded-xl bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800">
            {mensaje}
          </p>
        )}
        <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <form
            onSubmit={crear}
            className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <MailPlus className="text-orange-600" />
              <div>
                <h2 className="font-bold">Autorizar nueva cuenta</h2>
                <p className="text-xs text-slate-500">
                  Nadie puede registrarse sin tu aprobación.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <input
                required
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Nombre de la persona"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="correo@empresa.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <select
                aria-label="Perfil de acceso"
                value={rol}
                onChange={(event) => aplicarRol(event.target.value as RolCrm)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
              >
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {etiquetaRol[item]}
                  </option>
                ))}
              </select>
              <label className="block text-sm font-bold">
                Vence el acceso (opcional)
                <input
                  type="datetime-local"
                  value={accesoHasta}
                  onChange={(event) => setAccesoHasta(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-between">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">
                Módulos permitidos
              </p>
              <button
                type="button"
                onClick={() => setSeleccion(modulos.map((modulo) => modulo.id))}
                className="text-xs font-bold text-orange-600"
              >
                Todos
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {modulos.map((modulo) => (
                <label
                  key={modulo.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 p-2.5"
                >
                  <input
                    type="checkbox"
                    checked={seleccion.includes(modulo.id)}
                    onChange={() =>
                      setSeleccion(alternar(seleccion, modulo.id))
                    }
                    className="size-4 accent-orange-500"
                  />
                  <span>
                    <b className="block text-sm">{modulo.label}</b>
                    <small className="text-xs text-slate-500">
                      {modulo.detalle}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <button
              disabled={guardando === "nuevo"}
              className="mt-5 w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white"
            >
              {guardando === "nuevo" ? "Autorizando…" : "Autorizar cuenta"}
            </button>
          </form>
          <div className="space-y-6">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <UsersRound className="text-orange-600" />
                <div>
                  <h2 className="font-bold">Equipo activo</h2>
                  <p className="text-xs text-slate-500">
                    Controla estado, módulos y vigencia de cada persona.
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {perfiles.map((perfil) => {
                  const principal = perfil.email === "carlobrat@gmail.com";
                  const permitidos = permisos[perfil.id] ?? [];
                  return (
                    <article key={perfil.id} className="p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                          <UserRound className="h-9 w-9 rounded-xl bg-slate-100 p-2 text-slate-500" />
                          <div>
                            <p className="font-bold">
                              {perfil.nombre || "Sin nombre"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {perfil.email} ·{" "}
                              {principal
                                ? "Administrador principal"
                                : perfil.activo
                                  ? "Activo"
                                  : "Desactivado"}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                              <Clock3 size={12} />
                              {fecha(perfil.acceso_hasta)}
                            </p>
                          </div>
                        </div>
                        {!principal && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setPerfilAbierto((actual) =>
                                  actual === perfil.id ? null : perfil.id,
                                )
                              }
                              aria-expanded={perfilAbierto === perfil.id}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                            >
                              {perfilAbierto === perfil.id
                                ? "Ocultar opciones"
                                : "Ver opciones"}
                              <ChevronDown
                                className={`ml-1 inline h-3.5 w-3.5 transition-transform ${
                                  perfilAbierto === perfil.id
                                    ? "rotate-180"
                                    : ""
                                }`}
                              />
                            </button>
                            <select
                              aria-label={`Perfil de ${perfil.nombre || perfil.email}`}
                              value={perfil.rol}
                              onChange={(event) =>
                                void actualizarPerfil(perfil, {
                                  rol: event.target.value as RolCrm,
                                })
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            >
                              {roles.map((item) => (
                                <option key={item} value={item}>
                                  {etiquetaRol[item]}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() =>
                                void actualizarPerfil(perfil, {
                                  activo: !perfil.activo,
                                })
                              }
                              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold"
                            >
                              {perfil.activo ? "Desactivar" : "Activar"}
                            </button>
                            <button
                              disabled={guardando === `reset-${perfil.id}`}
                              onClick={() => void restablecer(perfil)}
                              className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700"
                            >
                              <KeyRound className="mr-1 inline h-3.5 w-3.5" />
                              Restablecer
                            </button>
                            <button
                              disabled={guardando === `eliminar-${perfil.id}`}
                              onClick={() => void eliminarCuenta(perfil)}
                              className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                      {!principal && perfilAbierto === perfil.id && (
                        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                          <details
                            open
                            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                          >
                            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-600">
                              Acceso temporal
                            </summary>
                            <input
                              type="datetime-local"
                              defaultValue={entradaFecha(perfil.acceso_hasta)}
                              onBlur={(event) => {
                                const valor = event.target.value
                                  ? new Date(event.target.value).toISOString()
                                  : null;
                                if (valor !== perfil.acceso_hasta)
                                  void actualizarPerfil(perfil, {
                                    acceso_hasta: valor,
                                  });
                              }}
                              className="mt-3 block w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                            />
                          </details>
                          <details
                            open
                            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                          >
                            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-600">
                              Módulos permitidos · {permitidos.length} de{" "}
                              {modulos.length}
                            </summary>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              {modulos.map((modulo) => (
                                <label
                                  key={modulo.id}
                                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    disabled={guardando === perfil.id}
                                    checked={permitidos.includes(modulo.id)}
                                    onChange={() =>
                                      void actualizarModulos(
                                        perfil,
                                        alternar(permitidos, modulo.id),
                                      )
                                    }
                                    className="size-4 accent-orange-500"
                                  />
                                  {modulo.label}
                                </label>
                              ))}
                            </div>
                          </details>
                          <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-600">
                              Sucursales POS ·{" "}
                              {(asignaciones[perfil.id] ?? []).length} asignadas
                            </summary>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {sucursales.map((sucursal) => (
                                <label
                                  key={sucursal.id}
                                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    disabled={guardando === perfil.id}
                                    checked={(
                                      asignaciones[perfil.id] ?? []
                                    ).includes(sucursal.id)}
                                    onChange={() => {
                                      const actuales =
                                        asignaciones[perfil.id] ?? [];
                                      void actualizarSucursales(
                                        perfil,
                                        actuales.includes(sucursal.id)
                                          ? actuales.filter(
                                              (id) => id !== sucursal.id,
                                            )
                                          : [...actuales, sucursal.id],
                                      );
                                    }}
                                    className="size-4 accent-orange-500"
                                  />
                                  {sucursal.nombre}
                                </label>
                              ))}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              Sin asignación, el usuario no puede abrir caja ni
                              vender en ninguna sucursal.
                            </p>
                          </details>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
            <section className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-orange-600" />
                  <div>
                    <h2 className="font-bold">Autorizaciones pendientes</h2>
                    <p className="text-xs text-slate-500">
                      Esperando activación.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {invitaciones
                    .filter((item) => !item.activado_at)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
                      >
                        <span>
                          <b className="block text-sm">
                            {item.nombre || item.email}
                          </b>
                          <small className="text-xs text-slate-500">
                            {item.email} · {item.modulos.length} módulos ·{" "}
                            {fecha(item.acceso_hasta)}
                          </small>
                        </span>
                        <button
                          disabled={guardando === `invitacion-${item.id}`}
                          onClick={() => void eliminarInvitacion(item)}
                          className="text-xs font-bold text-rose-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  {!invitaciones.some((item) => !item.activado_at) && (
                    <p className="text-sm text-slate-500">
                      No hay autorizaciones pendientes.
                    </p>
                  )}
                </div>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <History className="text-orange-600" />
                  <div>
                    <h2 className="font-bold">Bitácora</h2>
                    <p className="text-xs text-slate-500">
                      Últimas acciones administrativas.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {auditoria.map((item) => (
                    <div key={item.id} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-sm font-bold">{item.accion}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.usuario_id
                          ? nombres.get(item.usuario_id) || "Usuario"
                          : item.detalle?.email || "Cuenta"}{" "}
                        · {fecha(item.created_at)}
                      </p>
                    </div>
                  ))}
                  {!auditoria.length && (
                    <p className="text-sm text-slate-500">
                      Aún no hay acciones registradas.
                    </p>
                  )}
                </div>
              </article>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
