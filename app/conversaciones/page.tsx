"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageCircle, Send, UserRound } from "lucide-react";

import { Conversacion } from "@/lib/crm";
import { supabase } from "@/lib/supabase";

type Mensaje = { id: string; direccion: "Entrante" | "Saliente"; contenido: string | null; enviado_at: string };

export default function ConversacionesPage() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [seleccionada, setSeleccionada] = useState<Conversacion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [errorConexion, setErrorConexion] = useState("");

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("conversaciones").select("*, clientes(nombre, telefono)").order("ultimo_mensaje_at", { ascending: false });
    if (error) setErrorConexion(error.message);
    else setConversaciones((data || []) as Conversacion[]);
  }, []);

  // La consulta remota actualiza estado al resolverse, no durante el render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    if (!seleccionada) return;
    void supabase.from("mensajes").select("*").eq("conversacion_id", seleccionada.id).order("enviado_at").then(({ data }) => setMensajes((data || []) as Mensaje[]));
  }, [seleccionada]);

  async function enviar() {
    if (!seleccionada || !texto.trim()) return;
    const contenido = texto.trim();
    const { error } = await supabase.from("mensajes").insert({ conversacion_id: seleccionada.id, direccion: "Saliente", contenido });
    if (error) return alert(`No se pudo registrar el mensaje: ${error.message}`);
    await supabase.from("conversaciones").update({ ultimo_mensaje: contenido, ultimo_mensaje_at: new Date().toISOString() }).eq("id", seleccionada.id);
    setTexto("");
    setMensajes([...mensajes, { id: crypto.randomUUID(), direccion: "Saliente", contenido, enviado_at: new Date().toISOString() }]);
    await cargar();
  }

  const nombre = useMemo(() => seleccionada?.clientes?.nombre || "Conversación sin cliente", [seleccionada]);
  return <section className="p-6 md:p-10"><header className="mb-8"><p className="text-sm font-bold uppercase tracking-[.2em] text-green-600">Atención omnicanal</p><h1 className="text-4xl font-black">Bandeja de conversaciones</h1><p className="mt-2 text-gray-500">WhatsApp, Instagram y Facebook se concentran por cliente cuando Meta envía los webhooks.</p></header>
    {errorConexion && <p className="mb-5 rounded-xl bg-amber-50 p-4 text-amber-800">Primero ejecuta la migración CRM en Supabase. Detalle: {errorConexion}</p>}
    <div className="grid min-h-[620px] overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-200 lg:grid-cols-[350px_1fr]">
      <aside className="border-b lg:border-b-0 lg:border-r"><div className="border-b p-5"><h2 className="font-black">Abiertas ({conversaciones.filter((c) => c.estado === "Abierta").length})</h2></div><div className="divide-y">{conversaciones.map((conversacion) => <button key={conversacion.id} onClick={() => setSeleccionada(conversacion)} className={`w-full p-5 text-left hover:bg-gray-50 ${seleccionada?.id === conversacion.id ? "bg-blue-50" : ""}`}><div className="flex justify-between gap-3"><p className="font-bold">{conversacion.clientes?.nombre || "Contacto nuevo"}</p><span className="text-xs text-gray-400">{conversacion.canal}</span></div><p className="mt-1 line-clamp-1 text-sm text-gray-500">{conversacion.ultimo_mensaje || "Sin mensajes"}</p></button>)}{!conversaciones.length && <p className="p-8 text-sm text-gray-500">Aún no hay conversaciones. Conecta Meta y configura el webhook.</p>}</div></aside>
      <div className="flex min-h-[400px] flex-col">{seleccionada ? <><header className="flex items-center justify-between border-b p-5"><div className="flex items-center gap-3"><span className="rounded-full bg-green-100 p-2 text-green-700"><UserRound size={18}/></span><div><h2 className="font-black">{nombre}</h2><p className="text-sm text-gray-500">{seleccionada.clientes?.telefono || "Sin teléfono"} · {seleccionada.canal}</p></div></div><button className="rounded-lg border px-3 py-2 text-sm font-bold">Asignar</button></header><div className="flex-1 space-y-3 bg-gray-50 p-5">{mensajes.map((mensaje) => <div key={mensaje.id} className={`max-w-[80%] rounded-2xl p-3 text-sm ${mensaje.direccion === "Saliente" ? "ml-auto bg-blue-600 text-white" : "bg-white shadow-sm"}`}>{mensaje.contenido}<p className="mt-1 text-[10px] opacity-60">{new Date(mensaje.enviado_at).toLocaleString("es-GT")}</p></div>)}</div><div className="flex gap-3 border-t p-4"><input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void enviar(); }} placeholder="Respuesta interna hasta conectar envío API…" className="flex-1 rounded-xl border px-4 py-3"/><button onClick={() => void enviar()} className="rounded-xl bg-gray-950 px-4 text-white"><Send size={19}/></button></div></> : <div className="grid flex-1 place-items-center text-center text-gray-500"><div><MessageCircle className="mx-auto mb-3"/><p>Selecciona una conversación.</p></div></div>}</div>
    </div>
    <p className="mt-4 flex items-center gap-2 text-sm text-gray-500"><CheckCircle2 size={16} className="text-green-600"/> El endpoint seguro para recibir eventos de Meta está disponible en <code>/api/webhooks/meta</code>.</p>
  </section>;
}
