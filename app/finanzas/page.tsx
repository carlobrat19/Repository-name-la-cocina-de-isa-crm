"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Banknote, FileText, Landmark } from "lucide-react";

import { moneda } from "@/lib/crm";
import { supabase } from "@/lib/supabase";

type PedidoPendiente = { id: string; codigo: string | null; cliente: string | null; total: number | null; saldo_pendiente: number | null; clientes: { nombre: string }[] | null };

export default function FinanzasPage() {
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [pedidoId, setPedidoId] = useState("");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("Efectivo");
  const [referencia, setReferencia] = useState("");
  const [error, setError] = useState("");
  const cargar = useCallback(async () => { const { data, error: queryError } = await supabase.from("pedidos").select("id,codigo,cliente,total,saldo_pendiente,clientes(nombre)").gt("saldo_pendiente", 0).order("fecha_creacion", { ascending: false }); if (queryError) setError(queryError.message); setPedidos((data || []) as PedidoPendiente[]); }, []);
  // La consulta remota actualiza estado al resolverse, no durante el render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void cargar(); }, [cargar]);
  const totalPendiente = pedidos.reduce((sum, pedido) => sum + Number(pedido.saldo_pendiente || pedido.total || 0), 0);
  async function registrarPago(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const pedido = pedidos.find((item) => item.id === pedidoId); const valor = Number(monto); if (!pedido || !valor || valor <= 0) return; const { error: paymentError } = await supabase.from("pagos").insert({ pedido_id: pedido.id, monto: valor, metodo, referencia }); if (paymentError) return setError(paymentError.message); const saldo = Math.max(0, Number(pedido.saldo_pendiente || pedido.total || 0) - valor); const { error: orderError } = await supabase.from("pedidos").update({ saldo_pendiente: saldo, pago_estado: saldo === 0 ? "Pagado" : "Parcial" }).eq("id", pedido.id); if (orderError) return setError(orderError.message); setPedidoId(""); setMonto(""); setReferencia(""); await cargar(); }
  return <section className="space-y-8 p-6 md:p-10"><header><p className="text-sm font-bold uppercase tracking-[.2em] text-amber-600">Tesorería</p><h1 className="text-4xl font-black">Cobros y facturación</h1><p className="mt-2 text-gray-500">Registra abonos, controla cuentas por cobrar y deja cada pedido listo para FEL.</p></header>{error && <p className="rounded-xl bg-amber-50 p-4 text-amber-800">{error}</p>}<div className="grid gap-6 xl:grid-cols-[390px_1fr]"><form onSubmit={registrarPago} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200"><h2 className="flex items-center gap-2 text-xl font-black"><Banknote size={20}/> Registrar abono</h2><select required value={pedidoId} onChange={(e) => setPedidoId(e.target.value)} className="w-full rounded-xl border p-3"><option value="">Selecciona un pedido</option>{pedidos.map((pedido) => <option key={pedido.id} value={pedido.id}>{pedido.codigo || pedido.id.slice(0, 8)} · {pedido.clientes?.[0]?.nombre || pedido.cliente || "Sin cliente"}</option>)}</select><input required type="number" min="0.01" step="0.01" placeholder="Monto recibido" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full rounded-xl border p-3"/><select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="w-full rounded-xl border p-3"><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Link de pago</option></select><input placeholder="Referencia / comprobante" value={referencia} onChange={(e) => setReferencia(e.target.value)} className="w-full rounded-xl border p-3"/><button className="w-full rounded-xl bg-gray-950 p-3 font-bold text-white">Guardar pago</button></form><div className="space-y-5"><article className="rounded-3xl bg-amber-500 p-6 text-white"><Landmark size={24}/><p className="mt-4 text-sm opacity-80">Total por cobrar</p><p className="text-3xl font-black">{moneda(totalPendiente)}</p></article><div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-200"><div className="flex items-center gap-2 border-b p-5"><FileText size={20}/><h2 className="font-black">Cuentas pendientes</h2></div><div className="divide-y">{pedidos.map((pedido) => <article key={pedido.id} className="flex items-center justify-between gap-4 p-5"><div><p className="font-black">{pedido.codigo || "Pedido sin código"}</p><p className="text-sm text-gray-500">{pedido.clientes?.[0]?.nombre || pedido.cliente || "Sin cliente"}</p></div><p className="font-black text-amber-600">{moneda(pedido.saldo_pendiente || pedido.total)}</p></article>)}{!pedidos.length && <p className="p-8 text-gray-500">No hay cuentas por cobrar.</p>}</div></div></div></div></section>;
}
