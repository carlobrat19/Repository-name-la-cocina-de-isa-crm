"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  razon_social?: string | null;
  direccion?: string | null;
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
  const router = useRouter();
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
    [venceCotizacion, setVenceCotizacion] = useState("");
  const [datosPedido, setDatosPedido] = useState({
    nombre: "",
    telefono: "",
    email: "",
    nit: "",
    razonSocial: "",
    direccion: "",
    departamento: "",
    municipio: "",
    zona: "",
  });

  const cargar = useCallback(async () => {
    const [sesion, conversacionesData, perfilesData, productosData] =
      await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("conversaciones")
          .select(
            "id,canal,ultimo_mensaje,ultimo_mensaje_at,estado,cliente_id,responsable_id,prioridad,proxima_accion_at,lead_id,clientes(id,nombre,telefono,email,nit,razon_social,direccion),leads(id,estado,responsable_id,valor_estimado,ultima_actividad_at)",
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
    setVenceCotizacion(cotizacion.vence_el || "");
  }
  async function cargarCotizaciones(conversacion: Conversacion) {
    const { data, error: cotizacionError } = await supabase
      .from("cotizaciones")
      .select("id,codigo,estado,subtotal,costo_envio,total,vence_el")
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
    const conversacionId = new URLSearchParams(window.location.search).get(
      "conversacionId",
    );
    if (!conversacionId || seleccionada?.id === conversacionId) return;
    const conversacion = conversaciones.find(
      (item) => item.id === conversacionId,
    );
    if (conversacion) setSeleccionada(conversacion);
  }, [conversaciones, seleccionada?.id]);
  useEffect(() => {
    if (seleccionada) {
      void cargarDetalle(seleccionada);
      void cargarCotizaciones(seleccionada);
      void cargarDatosPedido(seleccionada);
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
  async function cargarDatosPedido(conversacion: Conversacion) {
    const base = conversacion.clientes;
    if (!base) {
      setDatosPedido({ nombre: "", telefono: "", email: "", nit: "", razonSocial: "", direccion: "", departamento: "", municipio: "", zona: "" });
      return;
    }
    const { data: direccion } = await supabase
      .from("cliente_direcciones")
      .select("direccion,departamento,municipio,zona")
      .eq("cliente_id", base.id)
      .eq("principal", true)
      .maybeSingle();
    setDatosPedido({
      nombre: base.nombre || "", telefono: base.telefono || "", email: base.email || "", nit: base.nit || "", razonSocial: base.razon_social || "", direccion: direccion?.direccion || base.direccion || "", departamento: direccion?.departamento || "", municipio: direccion?.municipio || "", zona: direccion?.zona || "",
    });
  }
  async function guardarDatosPedido() {
    if (!seleccionada || !datosPedido.nombre.trim()) {
      setError("Ingresa al menos el nombre del cliente antes de guardar.");
      return null;
    }
    setError("");
    const clienteDatos = { nombre: datosPedido.nombre.trim(), telefono: datosPedido.telefono.trim() || null, email: datosPedido.email.trim() || null, nit: datosPedido.nit.trim() || null, razon_social: datosPedido.razonSocial.trim() || null, direccion: datosPedido.direccion.trim() || null, canal_origen: seleccionada.canal };
    let clienteId = seleccionada.cliente_id;
    if (clienteId) {
      const { error: clienteError } = await supabase.from("clientes").update(clienteDatos).eq("id", clienteId);
      if (clienteError) { setError(clienteError.message); return null; }
    } else {
      const { data, error: clienteError } = await supabase.from("clientes").insert(clienteDatos).select("id,nombre,telefono,email,nit,razon_social,direccion").single();
      if (clienteError || !data) { setError(clienteError?.message || "No se pudo crear el cliente."); return null; }
      clienteId = data.id;
      const { error: conversacionError } = await supabase.from("conversaciones").update({ cliente_id: clienteId }).eq("id", seleccionada.id);
      if (conversacionError) { setError(conversacionError.message); return null; }
      const siguiente = { ...seleccionada, cliente_id: clienteId, clientes: data as Cliente };
      setSeleccionada(siguiente);
      setConversaciones((actuales) => actuales.map((item) => item.id === siguiente.id ? siguiente : item));
    }
    if (datosPedido.direccion.trim()) {
      const { data: existente } = await supabase.from("cliente_direcciones").select("id").eq("cliente_id", clienteId).eq("principal", true).maybeSingle();
      const direccionDatos = { direccion: datosPedido.direccion.trim(), departamento: datosPedido.departamento.trim() || null, municipio: datosPedido.municipio.trim() || null, zona: datosPedido.zona.trim() || null, etiqueta: "Entrega principal", principal: true };
      const respuesta = existente
        ? await supabase.from("cliente_direcciones").update(direccionDatos).eq("id", existente.id)
        : await supabase.from("cliente_direcciones").insert({ ...direccionDatos, cliente_id: clienteId });
      if (respuesta.error) { setError(respuesta.error.message); return null; }
    }
    await registrarActividad("Seguimiento", "Datos esenciales para pedido actualizados.", { ...seleccionada, cliente_id: clienteId });
    setAviso("Datos del cliente y entrega guardados. Ya puedes crear o convertir el pedido.");
    return clienteId;
  }
  async function abrirPedidoDesdeConversacion() {
    if (!seleccionada) return;
    const clienteId = await guardarDatosPedido();
    if (!clienteId) return;
    router.push(
      `/pedidos?clienteId=${clienteId}&conversacionId=${seleccionada.id}&responsableId=${seleccionada.responsable_id || ""}&canal=${seleccionada.canal}`,
    );
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
    setCotizacionActiva({ id: "", codigo, estado: "Borrador", subtotal: 0, costo_envio: 0, total: 0, vence_el: null });
    setLineasCotizacion([]);
    setProductoCotizacion("");
    setCantidadCotizacion("1");
    setEnvioCotizacion("0");
    setVenceCotizacion("");
    setAviso(`Borrador ${codigo} listo. Se guardará únicamente al presionar Guardar cotización.`);
  }
  async function agregarLineaCotizacion() {
    if (!cotizacionActiva || !productoCotizacion) return;
    const producto = productos.find((item) => item.id === productoCotizacion);
    const cantidad = Number(cantidadCotizacion);
    if (!producto || !Number.isFinite(cantidad) || cantidad <= 0) return;
    const linea = { id: crypto.randomUUID(), producto_id: producto.id, descripcion: producto.nombre, cantidad, precio: Number(producto.precio_venta || 0) };
    const nuevasLineas = [...lineasCotizacion, linea];
    const subtotal = nuevasLineas.reduce((total, item) => total + Number(item.cantidad) * Number(item.precio), 0);
    setLineasCotizacion(nuevasLineas);
    setCotizacionActiva({ ...cotizacionActiva, subtotal, total: subtotal + Math.max(0, Number(envioCotizacion || 0)) });
    setProductoCotizacion("");
    setCantidadCotizacion("1");
  }
  async function recalcularCotizacion() {
    if (!cotizacionActiva || !seleccionada || !usuarioId || !lineasCotizacion.length) {
      setError("Agrega al menos un producto antes de guardar la cotización.");
      return;
    }
    const clienteId = await guardarDatosPedido();
    if (!clienteId) return;
    const subtotal = lineasCotizacion.reduce(
      (total, item) =>
        total + Number(item.cantidad || 0) * Number(item.precio || 0),
      0,
    );
    const envio = Math.max(0, Number(envioCotizacion || 0));
    const total = Math.max(0, subtotal + envio);
    const datosCotizacion = {
        subtotal,
        costo_envio: envio,
        descuento: 0,
        total,
        vence_el: venceCotizacion || null,
      };
    const respuesta = cotizacionActiva.id
      ? await supabase.from("cotizaciones").update(datosCotizacion).eq("id", cotizacionActiva.id).select("id,codigo,estado,subtotal,costo_envio,total,vence_el").single()
      : await supabase.from("cotizaciones").insert({ ...datosCotizacion, codigo: cotizacionActiva.codigo, cliente_id: clienteId, conversacion_id: seleccionada.id, responsable_id: seleccionada.responsable_id, creado_por: usuarioId, estado: "Borrador", notas: `Generada desde ${seleccionada.canal}.` }).select("id,codigo,estado,subtotal,costo_envio,total,vence_el").single();
    if (respuesta.error || !respuesta.data) { setError(respuesta.error?.message || "No se pudo guardar la cotización."); return; }
    const actualizada = respuesta.data as Cotizacion;
    const { error: borrarError } = await supabase.from("cotizacion_detalle").delete().eq("cotizacion_id", actualizada.id);
    if (borrarError) { setError(borrarError.message); return; }
    const { error: detalleError } = await supabase.from("cotizacion_detalle").insert(lineasCotizacion.map(({ producto_id, descripcion, cantidad, precio }) => ({ cotizacion_id: actualizada.id, producto_id, descripcion, cantidad, precio })));
    if (detalleError) { setError(detalleError.message); return; }
    setCotizacionActiva(actualizada as Cotizacion);
    setCotizaciones((actuales) => actualizada.id === cotizacionActiva.id ? actuales.map((item) => item.id === actualizada.id ? actualizada : item) : [actualizada, ...actuales]);
    await registrarActividad("Cotización", `Cotización ${actualizada.codigo} guardada desde la conversación.`);
    setAviso(`Cotización ${actualizada.codigo} guardada.`);
  }
  async function quitarLineaCotizacion(linea: LineaCotizacion) {
    if (!cotizacionActiva) return;
    const nuevasLineas = lineasCotizacion.filter((item) => item.id !== linea.id);
    const subtotal = nuevasLineas.reduce((total, item) => total + Number(item.cantidad) * Number(item.precio), 0);
    setLineasCotizacion(nuevasLineas);
    setCotizacionActiva({ ...cotizacionActiva, subtotal, total: subtotal + Math.max(0, Number(envioCotizacion || 0)) });
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
                    <button
                      type="button"
                      onClick={() => void abrirPedidoDesdeConversacion()}
                      className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700"
                    >
                      <Plus size={14} /> Crear pedido
                    </button>
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
              <section className="rounded-xl border border-green-200 bg-green-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-green-800">Datos para pedido</p>
                <p className="mt-1 text-[11px] leading-4 text-green-700">Completa y guarda estos datos antes de crear o convertir el pedido.</p>
                <div className="mt-3 grid gap-2">
                  <input value={datosPedido.nombre} onChange={(event) => setDatosPedido({ ...datosPedido, nombre: event.target.value })} placeholder="Nombre del cliente *" className="rounded-lg border border-green-200 bg-white p-2 text-xs" />
                  <input value={datosPedido.telefono} onChange={(event) => setDatosPedido({ ...datosPedido, telefono: event.target.value })} placeholder="Teléfono / WhatsApp" className="rounded-lg border border-green-200 bg-white p-2 text-xs" />
                  <div className="grid grid-cols-2 gap-2"><input value={datosPedido.nit} onChange={(event) => setDatosPedido({ ...datosPedido, nit: event.target.value })} placeholder="NIT" className="rounded-lg border border-green-200 bg-white p-2 text-xs" /><input value={datosPedido.razonSocial} onChange={(event) => setDatosPedido({ ...datosPedido, razonSocial: event.target.value })} placeholder="Razón social" className="rounded-lg border border-green-200 bg-white p-2 text-xs" /></div>
                  <input type="email" value={datosPedido.email} onChange={(event) => setDatosPedido({ ...datosPedido, email: event.target.value })} placeholder="Correo fiscal" className="rounded-lg border border-green-200 bg-white p-2 text-xs" />
                  <input value={datosPedido.direccion} onChange={(event) => setDatosPedido({ ...datosPedido, direccion: event.target.value })} placeholder="Dirección de entrega" className="rounded-lg border border-green-200 bg-white p-2 text-xs" />
                  <div className="grid grid-cols-3 gap-2"><input value={datosPedido.departamento} onChange={(event) => setDatosPedido({ ...datosPedido, departamento: event.target.value })} placeholder="Departamento" className="min-w-0 rounded-lg border border-green-200 bg-white p-2 text-xs" /><input value={datosPedido.municipio} onChange={(event) => setDatosPedido({ ...datosPedido, municipio: event.target.value })} placeholder="Municipio" className="min-w-0 rounded-lg border border-green-200 bg-white p-2 text-xs" /><input value={datosPedido.zona} onChange={(event) => setDatosPedido({ ...datosPedido, zona: event.target.value })} placeholder="Zona" className="min-w-0 rounded-lg border border-green-200 bg-white p-2 text-xs" /></div>
                </div>
                <button type="button" onClick={() => void guardarDatosPedido()} className="mt-3 w-full rounded-lg bg-green-700 p-2 text-xs font-bold text-white hover:bg-green-800">Guardar datos del pedido</button>
              </section>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Cotización</p>
                <select value={cotizacionActiva?.id || ""} onChange={(event) => { const encontrada = cotizaciones.find((item) => item.id === event.target.value); if (encontrada) void abrirCotizacion(encontrada); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                  <option value="">Seleccionar cotización</option>{cotizaciones.map((item) => <option key={item.id} value={item.id}>{item.codigo} · Q{Number(item.total || 0).toFixed(2)}</option>)}
                </select>
                {cotizacionActiva && <div className="mt-2 space-y-2 rounded-xl bg-orange-50 p-3"><select value={productoCotizacion} onChange={(event) => setProductoCotizacion(event.target.value)} className="w-full rounded-lg border border-orange-100 bg-white p-2 text-xs"><option value="">Agregar producto</option>{productos.map((item) => <option key={item.id} value={item.id}>{item.nombre} · Q{Number(item.precio_venta || 0).toFixed(2)}</option>)}</select><div className="flex gap-2"><input aria-label="Cantidad" type="number" min="1" value={cantidadCotizacion} onChange={(event) => setCantidadCotizacion(event.target.value)} className="w-20 rounded-lg border border-orange-100 p-2 text-xs"/><button type="button" onClick={() => void agregarLineaCotizacion()} className="rounded-lg bg-orange-600 px-2 text-xs font-bold text-white">Agregar</button></div>{lineasCotizacion.map((linea) => <div key={linea.id} className="flex justify-between gap-2 text-xs"><span>{linea.cantidad}× {linea.descripcion}</span><button type="button" onClick={() => void quitarLineaCotizacion(linea)} className="font-bold text-rose-600">Quitar</button></div>)}<div className="grid gap-2"><label className="space-y-1 text-[11px] font-bold text-slate-600">Envío (Q)<input type="number" min="0" step="0.01" value={envioCotizacion} onChange={(event) => setEnvioCotizacion(event.target.value)} placeholder="0.00" className="w-full rounded-lg border border-orange-100 bg-white p-2 text-xs font-normal"/></label><label className="space-y-1 text-[11px] font-bold text-slate-600">Válida hasta (opcional)<input type="date" value={venceCotizacion} onChange={(event) => setVenceCotizacion(event.target.value)} className="w-full rounded-lg border border-orange-100 bg-white p-2 text-xs font-normal"/></label></div><p className="text-[11px] text-slate-600">Subtotal Q{Number(cotizacionActiva.subtotal || 0).toFixed(2)} + envío Q{Number(envioCotizacion || 0).toFixed(2)}</p><button type="button" onClick={() => void recalcularCotizacion()} className="w-full rounded-lg border border-orange-200 bg-white p-2 text-xs font-bold text-orange-700">Guardar cotización · Q{Number(cotizacionActiva.total || 0).toFixed(2)}</button><p className="text-[11px] leading-4 text-slate-600">Al convertir se trasladan productos, precios y envío. Solo completarás entrega y pago.</p>{cotizacionActiva.id ? <Link href={`/pedidos?clienteId=${seleccionada.cliente_id || ""}&conversacionId=${seleccionada.id}&responsableId=${seleccionada.responsable_id || ""}&canal=${seleccionada.canal}&cotizacionId=${cotizacionActiva.id}`} className="block rounded-lg bg-slate-950 p-2 text-center text-xs font-bold text-white">Convertir y completar pedido</Link> : <p className="rounded-lg bg-slate-200 p-2 text-center text-xs font-bold text-slate-600">Guarda la cotización antes de convertirla.</p>}</div>}
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
