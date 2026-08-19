"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardPlus,
  MessageCircle,
  Plus,
  Send,
  StickyNote,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Perfil = {
  id: string;
  email: string;
  nombre: string | null;
  activo: boolean;
};
type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  nit: string | null;
};
type Lead = {
  id: string;
  estado: string;
  responsable_id: string | null;
  valor_estimado: number | string;
  ultima_actividad_at: string;
};
type Conversacion = {
  id: string;
  canal: "WhatsApp" | "Instagram" | "Facebook" | "Web";
  ultimo_mensaje: string | null;
  ultimo_mensaje_at: string | null;
  estado: string;
  cliente_id: string | null;
  responsable_id: string | null;
  prioridad: "Baja" | "Normal" | "Alta" | "Urgente";
  proxima_accion_at: string | null;
  lead_id: string | null;
  clientes: Cliente | null;
  leads: Lead | null;
};
type Mensaje = {
  id: string;
  direccion: "Entrante" | "Saliente";
  contenido: string | null;
  enviado_at: string;
  estado_envio: string;
};
type Actividad = {
  id: string;
  tipo: string;
  detalle: string;
  created_at: string;
  creado_por: string;
};
type Producto = {
  id: string;
  nombre: string;
  precio_venta: number | string | null;
};
type Cotizacion = {
  id: string;
  codigo: string;
  estado: string;
  subtotal: number | string;
  costo_envio: number | string;
  descuento: number | string;
  total: number | string;
  vence_el: string | null;
};
type LineaCotizacion = {
  id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad: number | string;
  precio: number | string;
};

const ETAPAS = [
  "Nuevo",
  "Contactado",
  "Calificado",
  "Cotización enviada",
  "Negociación",
  "Ganado",
  "Perdido",
];
const CANALES = ["WhatsApp", "Instagram", "Facebook", "Web"] as const;
const fecha = (valor: string | null) =>
  valor
    ? new Date(valor).toLocaleString("es-GT", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Sin actividad";
const nombrePerfil = (perfil: Perfil) => perfil.nombre?.trim() || perfil.email;

export default function ConversacionesPage() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]),
    [perfiles, setPerfiles] = useState<Perfil[]>([]),
    [seleccionada, setSeleccionada] = useState<Conversacion | null>(null),
    [mensajes, setMensajes] = useState<Mensaje[]>([]),
    [actividades, setActividades] = useState<Actividad[]>([]),
    [usuarioId, setUsuarioId] = useState<string | null>(null),
    [texto, setTexto] = useState(""),
    [nota, setNota] = useState(""),
    [filtro, setFiltro] = useState(""),
    [error, setError] = useState(""),
    [aviso, setAviso] = useState(""),
    [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevo, setNuevo] = useState({
    nombre: "",
    telefono: "",
    canal: "WhatsApp" as (typeof CANALES)[number],
    responsableId: "",
  });
  const [productos, setProductos] = useState<Producto[]>([]),
    [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]),
    [cotizacionActiva, setCotizacionActiva] = useState<Cotizacion | null>(null),
    [lineasCotizacion, setLineasCotizacion] = useState<LineaCotizacion[]>([]),
    [productoCotizacion, setProductoCotizacion] = useState(""),
    [cantidadCotizacion, setCantidadCotizacion] = useState("1"),
    [envioCotizacion, setEnvioCotizacion] = useState("0"),
    [descuentoCotizacion, setDescuentoCotizacion] = useState("0"),
    [venceCotizacion, setVenceCotizacion] = useState("");

  const cargar = useCallback(async () => {
    const [sesion, conversacionesData, perfilesData, productosData] =
      await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("conversaciones")
          .select(
            "id,canal,ultimo_mensaje,ultimo_mensaje_at,estado,cliente_id,responsable_id,prioridad,proxima_accion_at,lead_id,clientes(id,nombre,telefono,email,nit),leads(id,estado,responsable_id,valor_estimado,ultima_actividad_at)",
          )
          .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("perfiles_crm")
          .select("id,email,nombre,activo")
          .eq("activo", true)
          .order("nombre"),
        supabase
          .from("productos")
          .select("id,nombre,precio_venta")
          .eq("estado", "Activo")
          .order("nombre"),
      ]);
    setUsuarioId(sesion.data.user?.id || null);
    if (conversacionesData.error || perfilesData.error || productosData.error) {
      setError(
        (conversacionesData.error || perfilesData.error || productosData.error)
          ?.message || "No se pudo cargar la bandeja.",
      );
      return;
    }
    setConversaciones(
      (conversacionesData.data || []) as unknown as Conversacion[],
    );
    setPerfiles((perfilesData.data || []) as Perfil[]);
    setProductos((productosData.data || []) as Producto[]);
  }, []);
  const cargarDetalle = useCallback(async (conversacion: Conversacion) => {
    const [mensajesData, actividadesData] = await Promise.all([
      supabase
        .from("mensajes")
        .select("id,direccion,contenido,enviado_at,estado_envio")
        .eq("conversacion_id", conversacion.id)
        .order("enviado_at"),
      supabase
        .from("actividades_comerciales")
        .select("id,tipo,detalle,created_at,creado_por")
        .eq("conversacion_id", conversacion.id)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    if (mensajesData.error || actividadesData.error)
      setError(
        (mensajesData.error || actividadesData.error)?.message ||
          "No se pudo cargar el seguimiento.",
      );
    setMensajes((mensajesData.data || []) as Mensaje[]);
    setActividades((actividadesData.data || []) as Actividad[]);
  }, []);
  async function abrirCotizacion(cotizacion: Cotizacion) {
    const { data, error: detalleError } = await supabase
      .from("cotizacion_detalle")
      .select("id,producto_id,descripcion,cantidad,precio")
      .eq("cotizacion_id", cotizacion.id);
    if (detalleError) {
      setError(detalleError.message);
      return;
    }
    setCotizacionActiva(cotizacion);
    setLineasCotizacion((data || []) as LineaCotizacion[]);
    setEnvioCotizacion(String(cotizacion.costo_envio || 0));
    setDescuentoCotizacion(String(cotizacion.descuento || 0));
    setVenceCotizacion(cotizacion.vence_el || "");
  }
  async function cargarCotizaciones(conversacion: Conversacion) {
    const { data, error: cotizacionError } = await supabase
      .from("cotizaciones")
      .select("id,codigo,estado,subtotal,costo_envio,descuento,total,vence_el")
      .eq("conversacion_id", conversacion.id)
      .order("created_at", { ascending: false });
    if (cotizacionError) {
      setError(cotizacionError.message);
      return;
    }
    const lista = (data || []) as Cotizacion[];
    setCotizaciones(lista);
    if (cotizacionActiva) {
      const actual = lista.find((item) => item.id === cotizacionActiva.id);
      if (actual) await abrirCotizacion(actual);
    }
  }
  useEffect(() => {
    void cargar();
  }, [cargar]);
  useEffect(() => {
    if (seleccionada) {
      void cargarDetalle(seleccionada);
      void cargarCotizaciones(seleccionada);
    }
  }, [seleccionada, cargarDetalle]);
  const visibles = useMemo(
    () =>
      conversaciones.filter((item) =>
        `${item.clientes?.nombre || ""} ${item.clientes?.telefono || ""} ${item.canal} ${item.leads?.estado || ""}`
          .toLowerCase()
          .includes(filtro.toLowerCase()),
      ),
    [conversaciones, filtro],
  );
  const responsable = seleccionada
    ? perfiles.find((perfil) => perfil.id === seleccionada.responsable_id)
    : null;
  const cliente = seleccionada?.clientes || null;
  const etapa = seleccionada?.leads?.estado || "Nuevo";
  async function seleccionar(conversacion: Conversacion) {
    setSeleccionada(conversacion);
    setAviso("");
    setNota("");
    await cargarDetalle(conversacion);
  }
  async function registrarActividad(
    tipo: string,
    detalle: string,
    conversacion = seleccionada,
  ) {
    if (!conversacion || !usuarioId) return;
    const { error: actividadError } = await supabase
      .from("actividades_comerciales")
      .insert({
        conversacion_id: conversacion.id,
        lead_id: conversacion.lead_id,
        cliente_id: conversacion.cliente_id,
        tipo,
        detalle,
        creado_por: usuarioId,
      });
    if (actividadError) throw actividadError;
  }
  async function enviar() {
    if (!seleccionada || !texto.trim() || !usuarioId) return;
    setError("");
    const contenido = texto.trim();
    const { error: mensajeError } = await supabase
      .from("mensajes")
      .insert({
        conversacion_id: seleccionada.id,
        direccion: "Saliente",
        contenido,
        creado_por: usuarioId,
        estado_envio: "Interno",
      });
    if (mensajeError) {
      setError(mensajeError.message);
      return;
    }
    const { error: actualizacionError } = await supabase
      .from("conversaciones")
      .update({
        ultimo_mensaje: contenido,
        ultimo_mensaje_at: new Date().toISOString(),
      })
      .eq("id", seleccionada.id);
    if (actualizacionError) {
      setError(actualizacionError.message);
      return;
    }
    await registrarActividad(
      "Seguimiento",
      "Respuesta registrada desde la bandeja.",
    );
    setTexto("");
    await cargar();
    await cargarDetalle(seleccionada);
    setAviso("Respuesta guardada como interna. Se enviará al activar la API.");
  }
  async function guardarNota(event: FormEvent) {
    event.preventDefault();
    if (!nota.trim()) return;
    try {
      await registrarActividad("Nota", nota.trim());
      setNota("");
      if (seleccionada) await cargarDetalle(seleccionada);
      setAviso("Nota de seguimiento guardada.");
    } catch (causa) {
      setError(
        causa instanceof Error ? causa.message : "No se pudo guardar la nota.",
      );
    }
  }
  async function asignarResponsable(responsableId: string) {
    if (!seleccionada) return;
    const { error: conversacionError } = await supabase
      .from("conversaciones")
      .update({ responsable_id: responsableId || null })
      .eq("id", seleccionada.id);
    if (conversacionError) {
      setError(conversacionError.message);
      return;
    }
    if (seleccionada.lead_id)
      await supabase
        .from("leads")
        .update({
          responsable_id: responsableId || null,
          ultima_actividad_at: new Date().toISOString(),
        })
        .eq("id", seleccionada.lead_id);
    const siguiente = {
      ...seleccionada,
      responsable_id: responsableId || null,
      leads: seleccionada.leads
        ? { ...seleccionada.leads, responsable_id: responsableId || null }
        : null,
    };
    setSeleccionada(siguiente);
    await registrarActividad(
      "Seguimiento",
      `Responsable asignado: ${perfiles.find((perfil) => perfil.id === responsableId) ? nombrePerfil(perfiles.find((perfil) => perfil.id === responsableId)!) : "Sin asignar"}.`,
      siguiente,
    );
    await cargar();
    await cargarDetalle(siguiente);
    setAviso("Responsable actualizado.");
  }
  async function cambiarEtapa(estado: string) {
    if (!seleccionada?.lead_id) return;
    const { error: etapaError } = await supabase
      .from("leads")
      .update({ estado, ultima_actividad_at: new Date().toISOString() })
      .eq("id", seleccionada.lead_id);
    if (etapaError) {
      setError(etapaError.message);
      return;
    }
    const siguiente = {
      ...seleccionada,
      leads: seleccionada.leads ? { ...seleccionada.leads, estado } : null,
    };
    setSeleccionada(siguiente);
    await registrarActividad(
      "Cambio de etapa",
      `Etapa comercial: ${estado}.`,
      siguiente,
    );
    await cargar();
    await cargarDetalle(siguiente);
    setAviso("Etapa comercial actualizada.");
  }
  async function crearCotizacion() {
    if (!seleccionada || !usuarioId) return;
    const codigo = `COT-${new Date().toISOString().replace(/\D/g, "").slice(2, 14)}`;
    const { data, error: cotizacionError } = await supabase
      .from("cotizaciones")
      .insert({
        codigo,
        cliente_id: seleccionada.cliente_id,
        conversacion_id: seleccionada.id,
        responsable_id: seleccionada.responsable_id,
        creado_por: usuarioId,
        estado: "Borrador",
        notas: `Generada desde ${seleccionada.canal}.`,
      })
      .select("id,codigo,estado,subtotal,costo_envio,descuento,total,vence_el")
      .single();
    if (cotizacionError || !data) {
      setError(cotizacionError?.message || "No se pudo crear la cotización.");
      return;
    }
    await registrarActividad(
      "Cotización",
      `Cotización ${codigo} creada desde la conversación.`,
    );
    setCotizaciones([data as Cotizacion, ...cotizaciones]);
    await abrirCotizacion(data as Cotizacion);
    setAviso(`Cotización ${codigo} lista para agregar productos.`);
    if (seleccionada) await cargarDetalle(seleccionada);
  }
  async function agregarLineaCotizacion() {
    if (!cotizacionActiva || !productoCotizacion) return;
    const producto = productos.find((item) => item.id === productoCotizacion);
    const cantidad = Number(cantidadCotizacion);
    if (!producto || !Number.isFinite(cantidad) || cantidad <= 0) return;
    const { error: lineaError } = await supabase
      .from("cotizacion_detalle")
      .insert({
        cotizacion_id: cotizacionActiva.id,
        producto_id: producto.id,
        descripcion: producto.nombre,
        cantidad,
        precio: Number(producto.precio_venta || 0),
      });
    if (lineaError) {
      setError(lineaError.message);
      return;
    }
    setProductoCotizacion("");
    setCantidadCotizacion("1");
    await recalcularCotizacion(cotizacionActiva.id);
  }
  async function recalcularCotizacion(cotizacionId: string) {
    const { data, error: lineasError } = await supabase
      .from("cotizacion_detalle")
      .select("id,producto_id,descripcion,cantidad,precio")
      .eq("cotizacion_id", cotizacionId);
    if (lineasError) {
      setError(lineasError.message);
      return;
    }
    const subtotal = (data || []).reduce(
      (total, item) =>
        total + Number(item.cantidad || 0) * Number(item.precio || 0),
      0,
    );
    const envio = Math.max(0, Number(envioCotizacion || 0));
    const descuento = Math.max(0, Number(descuentoCotizacion || 0));
    const total = Math.max(0, subtotal + envio - descuento);
    const { data: actualizada, error: actualizacionError } = await supabase
      .from("cotizaciones")
      .update({
        subtotal,
        costo_envio: envio,
        descuento,
        total,
        vence_el: venceCotizacion || null,
      })
      .eq("id", cotizacionId)
      .select("id,codigo,estado,subtotal,costo_envio,descuento,total,vence_el")
      .single();
    if (actualizacionError || !actualizada) {
      setError(
        actualizacionError?.message || "No se pudo actualizar la cotización.",
      );
      return;
    }
    setLineasCotizacion((data || []) as LineaCotizacion[]);
    setCotizacionActiva(actualizada as Cotizacion);
    setCotizaciones(
      cotizaciones.map((item) =>
        item.id === cotizacionId ? (actualizada as Cotizacion) : item,
      ),
    );
  }
  async function quitarLineaCotizacion(linea: LineaCotizacion) {
    if (!cotizacionActiva) return;
    const { error: borradoError } = await supabase
      .from("cotizacion_detalle")
      .delete()
      .eq("id", linea.id);
    if (borradoError) {
      setError(borradoError.message);
      return;
    }
    await recalcularCotizacion(cotizacionActiva.id);
  }
  async function crearAtencion(event: FormEvent) {
    event.preventDefault();
    if (!nuevo.nombre.trim() || !usuarioId) return;
    setError("");
    let clienteId: string | null = null;
    if (nuevo.telefono.trim()) {
      const existente = await supabase
        .from("clientes")
        .select("id")
        .eq("telefono", nuevo.telefono.trim())
        .maybeSingle();
      if (existente.error) {
        setError(existente.error.message);
        return;
      }
      clienteId = existente.data?.id || null;
    }
    if (!clienteId) {
      const creado = await supabase
        .from("clientes")
        .insert({
          nombre: nuevo.nombre.trim(),
          telefono: nuevo.telefono.trim() || null,
          canal_origen: nuevo.canal,
        })
        .select("id")
        .single();
      if (creado.error) {
        setError(creado.error.message);
        return;
      }
      clienteId = creado.data.id;
    }
    const lead = await supabase
      .from("leads")
      .insert({
        nombre: nuevo.nombre.trim(),
        telefono: nuevo.telefono.trim() || null,
        canal: nuevo.canal,
        estado: "Nuevo",
        cliente_id: clienteId,
        responsable_id: nuevo.responsableId || usuarioId,
        creado_por: usuarioId,
      })
      .select("id,estado,responsable_id,valor_estimado,ultima_actividad_at")
      .single();
    if (lead.error) {
      setError(lead.error.message);
      return;
    }
    const conversacion = await supabase
      .from("conversaciones")
      .insert({
        cliente_id: clienteId,
        lead_id: lead.data.id,
        canal: nuevo.canal,
        responsable_id: nuevo.responsableId || usuarioId,
        estado: "Abierta",
        prioridad: "Normal",
        ultimo_mensaje: "Atención creada manualmente",
        ultimo_mensaje_at: new Date().toISOString(),
      })
      .select(
        "id,canal,ultimo_mensaje,ultimo_mensaje_at,estado,cliente_id,responsable_id,prioridad,proxima_accion_at,lead_id,clientes(id,nombre,telefono,email,nit),leads(id,estado,responsable_id,valor_estimado,ultima_actividad_at)",
      )
      .single();
    if (conversacion.error) {
      setError(conversacion.error.message);
      return;
    }
    const creada = conversacion.data as unknown as Conversacion;
    await registrarActividad(
      "Seguimiento",
      "Prospecto y atención creados manualmente.",
      creada,
    );
    setNuevo({
      nombre: "",
      telefono: "",
      canal: "WhatsApp",
      responsableId: "",
    });
    setNuevoAbierto(false);
    await cargar();
    await seleccionar(creada);
    setAviso("Atención creada y asignada.");
  }

  return (
    <section className="p-6 md:p-10">
      <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.2em] text-green-600">
            Atención comercial
          </p>
          <h1 className="text-4xl font-black text-slate-950">
            Bandeja de conversaciones
          </h1>
          <p className="mt-2 text-slate-500">
            Prospecta, asigna responsables, registra seguimiento y genera
            pedidos antes de conectar Meta.
          </p>
        </div>
        <button
          onClick={() => setNuevoAbierto((valor) => !valor)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-orange-600"
        >
          <Plus size={17} /> Nueva atención
        </button>
      </header>
      {nuevoAbierto && (
        <form
          onSubmit={crearAtencion}
          className="mb-6 grid gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 md:grid-cols-4"
        >
          <input
            required
            value={nuevo.nombre}
            onChange={(event) =>
              setNuevo({ ...nuevo, nombre: event.target.value })
            }
            placeholder="Nombre del prospecto"
            className="rounded-xl border border-orange-100 bg-white px-3 py-2.5 text-sm"
          />
          <input
            value={nuevo.telefono}
            onChange={(event) =>
              setNuevo({ ...nuevo, telefono: event.target.value })
            }
            placeholder="WhatsApp / teléfono"
            className="rounded-xl border border-orange-100 bg-white px-3 py-2.5 text-sm"
          />
          <select
            value={nuevo.canal}
            onChange={(event) =>
              setNuevo({
                ...nuevo,
                canal: event.target.value as (typeof CANALES)[number],
              })
            }
            className="rounded-xl border border-orange-100 bg-white px-3 py-2.5 text-sm"
          >
            {CANALES.map((canal) => (
              <option key={canal}>{canal}</option>
            ))}
          </select>
          <select
            value={nuevo.responsableId}
            onChange={(event) =>
              setNuevo({ ...nuevo, responsableId: event.target.value })
            }
            className="rounded-xl border border-orange-100 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">Asignarme a mí</option>
            {perfiles.map((perfil) => (
              <option key={perfil.id} value={perfil.id}>
                {nombrePerfil(perfil)} · {perfil.email}
              </option>
            ))}
          </select>
          <div className="md:col-span-4">
            <button className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white">
              Crear prospecto y conversación
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}
      {aviso && (
        <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          {aviso}
        </p>
      )}
      <div className="grid min-h-[650px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[340px_minmax(0,1fr)_320px]">
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="border-b p-4">
            <input
              value={filtro}
              onChange={(event) => setFiltro(event.target.value)}
              placeholder="Buscar cliente, canal o etapa"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
            />
            <p className="mt-3 text-xs font-bold text-slate-500">
              {visibles.length} conversación{visibles.length === 1 ? "" : "es"}
            </p>
          </div>
          <div className="max-h-[600px] divide-y overflow-y-auto">
            {visibles.map((item) => (
              <button
                key={item.id}
                onClick={() => void seleccionar(item)}
                className={`w-full p-4 text-left transition hover:bg-orange-50 ${seleccionada?.id === item.id ? "bg-orange-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-bold text-slate-900">
                    {item.clientes?.nombre || "Contacto nuevo"}
                  </p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {item.canal}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {item.ultimo_mensaje || "Sin mensajes"}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-orange-700">
                    {item.leads?.estado || "Nuevo"}
                  </span>
                  <span className="text-slate-400">
                    {fecha(item.ultimo_mensaje_at)}
                  </span>
                </div>
              </button>
            ))}
            {!visibles.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                No hay conversaciones todavía.
              </p>
            )}
          </div>
        </aside>
        <main className="flex min-h-[500px] flex-col">
          {seleccionada ? (
            <>
              <header className="border-b p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex gap-3">
                    <span className="rounded-full bg-green-100 p-2 text-green-700">
                      <UserRound size={19} />
                    </span>
                    <div>
                      <h2 className="font-black text-slate-950">
                        {cliente?.nombre || "Contacto nuevo"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {cliente?.telefono || "Sin teléfono"}{" "}
                        {cliente?.email ? `· ${cliente.email}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-bold text-orange-700">
                        Canal: {seleccionada.canal} · Cliente CRM{" "}
                        {cliente ? "vinculado" : "pendiente"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void crearCotizacion()}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-orange-300"
                    >
                      <ClipboardPlus size={14} /> Cotización
                    </button>
                    <Link
                      href={`/pedidos?clienteId=${seleccionada.cliente_id || ""}&conversacionId=${seleccionada.id}&responsableId=${seleccionada.responsable_id || ""}&canal=${seleccionada.canal}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700"
                    >
                      <Plus size={14} /> Crear pedido
                    </Link>
                  </div>
                </div>
              </header>
              <div className="flex-1 space-y-3 bg-slate-50 p-5">
                {mensajes.map((mensaje) => (
                  <div
                    key={mensaje.id}
                    className={`max-w-[82%] rounded-2xl p-3 text-sm ${mensaje.direccion === "Saliente" ? "ml-auto bg-slate-950 text-white" : "bg-white text-slate-700 shadow-sm"}`}
                  >
                    <p>{mensaje.contenido}</p>
                    <p className="mt-1 text-[10px] opacity-60">
                      {fecha(mensaje.enviado_at)} · {mensaje.estado_envio}
                    </p>
                  </div>
                ))}
                {!mensajes.length && (
                  <div className="grid h-44 place-items-center text-center text-sm text-slate-500">
                    <div>
                      <MessageCircle className="mx-auto mb-2" />
                      <p>
                        Aún no hay mensajes. Puedes registrar la gestión
                        inicial.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t bg-white p-4">
                <div className="flex gap-3">
                  <input
                    value={texto}
                    onChange={(event) => setTexto(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void enviar();
                    }}
                    placeholder="Registrar respuesta interna antes de activar la API…"
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-400"
                  />
                  <button
                    onClick={() => void enviar()}
                    className="rounded-xl bg-slate-950 px-4 text-white"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-center text-slate-500">
              <div>
                <MessageCircle className="mx-auto mb-3" />
                <p>Selecciona o crea una atención.</p>
              </div>
            </div>
          )}
        </main>
        <aside className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
          {seleccionada ? (
            <div className="space-y-5 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Responsable
                </p>
                <select
                  value={seleccionada.responsable_id || ""}
                  onChange={(event) =>
                    void asignarResponsable(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold"
                >
                  <option value="">Sin asignar</option>
                  {perfiles.map((perfil) => (
                    <option key={perfil.id} value={perfil.id}>
                      {nombrePerfil(perfil)} · {perfil.email}
                    </option>
                  ))}
                </select>
                {responsable && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <UserRoundCheck size={13} /> Atiende: {responsable.email}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Etapa comercial
                </p>
                <select
                  value={etapa}
                  onChange={(event) => void cambiarEtapa(event.target.value)}
                  disabled={!seleccionada.lead_id}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold disabled:bg-slate-100"
                >
                  {ETAPAS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Cotización</p>
                <select value={cotizacionActiva?.id || ""} onChange={(event) => { const encontrada = cotizaciones.find((item) => item.id === event.target.value); if (encontrada) void abrirCotizacion(encontrada); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                  <option value="">Seleccionar cotización</option>{cotizaciones.map((item) => <option key={item.id} value={item.id}>{item.codigo} · Q{Number(item.total || 0).toFixed(2)}</option>)}
                </select>
                {cotizacionActiva && <div className="mt-2 space-y-2 rounded-xl bg-orange-50 p-3"><select value={productoCotizacion} onChange={(event) => setProductoCotizacion(event.target.value)} className="w-full rounded-lg border border-orange-100 bg-white p-2 text-xs"><option value="">Agregar producto</option>{productos.map((item) => <option key={item.id} value={item.id}>{item.nombre} · Q{Number(item.precio_venta || 0).toFixed(2)}</option>)}</select><div className="flex gap-2"><input type="number" min="1" value={cantidadCotizacion} onChange={(event) => setCantidadCotizacion(event.target.value)} className="w-20 rounded-lg border border-orange-100 p-2 text-xs"/><button type="button" onClick={() => void agregarLineaCotizacion()} className="rounded-lg bg-orange-600 px-2 text-xs font-bold text-white">Agregar</button></div>{lineasCotizacion.map((linea) => <div key={linea.id} className="flex justify-between gap-2 text-xs"><span>{linea.cantidad}× {linea.descripcion}</span><button type="button" onClick={() => void quitarLineaCotizacion(linea)} className="font-bold text-rose-600">Quitar</button></div>)}<div className="grid grid-cols-2 gap-2"><input type="number" min="0" value={envioCotizacion} onChange={(event) => setEnvioCotizacion(event.target.value)} placeholder="Envío" className="rounded-lg border border-orange-100 p-2 text-xs"/><input type="number" min="0" value={descuentoCotizacion} onChange={(event) => setDescuentoCotizacion(event.target.value)} placeholder="Descuento" className="rounded-lg border border-orange-100 p-2 text-xs"/><input type="date" value={venceCotizacion} onChange={(event) => setVenceCotizacion(event.target.value)} className="col-span-2 rounded-lg border border-orange-100 p-2 text-xs"/></div><button type="button" onClick={() => void recalcularCotizacion(cotizacionActiva.id)} className="w-full rounded-lg border border-orange-200 bg-white p-2 text-xs font-bold text-orange-700">Guardar total · Q{Number(cotizacionActiva.total || 0).toFixed(2)}</button><Link href={`/pedidos?clienteId=${seleccionada.cliente_id || ""}&conversacionId=${seleccionada.id}&responsableId=${seleccionada.responsable_id || ""}&canal=${seleccionada.canal}&cotizacionId=${cotizacionActiva.id}`} className="block rounded-lg bg-slate-950 p-2 text-center text-xs font-bold text-white">Convertir en pedido</Link></div>}
              </div>
              <form onSubmit={guardarNota}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Seguimiento
                </p>
                <textarea
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  placeholder="Llamada, preferencia, acuerdo o próxima acción…"
                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-orange-400"
                />
                <button className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-orange-700">
                  <StickyNote size={15} /> Guardar nota
                </button>
              </form>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Historial
                </p>
                <div className="mt-3 space-y-3">
                  {actividades.map((actividad) => (
                    <div
                      key={actividad.id}
                      className="rounded-xl bg-slate-50 p-3"
                    >
                      <p className="text-xs font-bold text-slate-700">
                        {actividad.tipo}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {actividad.detalle}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {fecha(actividad.created_at)}
                      </p>
                    </div>
                  ))}
                  {!actividades.length && (
                    <p className="text-sm text-slate-500">
                      Aún no hay seguimientos.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
        <CheckCircle2 size={16} className="text-green-600" /> La base queda
        lista para que Meta cree conversaciones y un servicio de correo/WhatsApp
        procese avisos pendientes.
      </p>
    </section>
  );
}
