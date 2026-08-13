"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, ReceiptText, UsersRound } from "lucide-react";

import { moneda } from "@/lib/crm";
import { supabase } from "@/lib/supabase";

type Pedido = { id: string; total: number | null; estado: string; vendedor: string | null; canal_origen: string | null; cliente_id: string | null; fecha_creacion: string };
type Pago = { monto: number | null };

export default function ReportesPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [error, setError] = useState("");
  const cargar = useCallback(async () => {
    const [{ data: pedidosData, error: pedidosError }, { data: pagosData, error: pagosError }] = await Promise.all([supabase.from("pedidos").select("id,total,estado,vendedor,canal_origen,cliente_id,fecha_creacion"), supabase.from("pagos").select("monto")]);
    if (pedidosError || pagosError) setError(pedidosError?.message || pagosError?.message || "Error de datos");
    setPedidos((pedidosData || []) as Pedido[]); setPagos((pagosData || []) as Pago[]);
  }, []);
  // La consulta remota actualiza estado al resolverse, no durante el render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void cargar(); }, [cargar]);
  const total = pedidos.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const cobrado = pagos.reduce((sum, p) => sum + Number(p.monto || 0), 0);
  const porCanal = useMemo(() => Object.entries(pedidos.reduce<Record<string, number>>((memo, pedido) => { const canal = pedido.canal_origen || "Manual"; memo[canal] = (memo[canal] || 0) + Number(pedido.total || 0); return memo; }, {})).sort((a,b) => b[1]-a[1]), [pedidos]);
  return <section className="space-y-8 p-6 md:p-10"><header><p className="text-sm font-bold uppercase tracking-[.2em] text-purple-600">Inteligencia comercial</p><h1 className="text-4xl font-black">Reportes y control</h1><p className="mt-2 text-gray-500">Indicadores unificados de ventas, cobranza y canales de adquisición.</p></header>{error && <p className="rounded-xl bg-amber-50 p-4 text-amber-800">{error}</p>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Ventas registradas", moneda(total), BarChart3, "text-blue-600"],["Cobrado", moneda(cobrado), CreditCard, "text-green-600"],["Por cobrar", moneda(total-cobrado), ReceiptText, "text-amber-600"],["Clientes con compra", new Set(pedidos.map((p) => p.cliente_id).filter(Boolean)).size, UsersRound, "text-purple-600"]].map(([titulo, valor, Icon, color]) => { const MetricIcon = Icon as typeof BarChart3; return <article key={titulo as string} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200"><MetricIcon className={color as string}/><p className="mt-5 text-sm text-gray-500">{titulo as string}</p><p className="mt-1 text-2xl font-black">{valor as string | number}</p></article>})}</div><div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200"><h2 className="text-xl font-black">Ventas por canal</h2><div className="mt-5 space-y-4">{porCanal.map(([canal, valor]) => <div key={canal}><div className="mb-1 flex justify-between text-sm font-bold"><span>{canal}</span><span>{moneda(valor)}</span></div><div className="h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-purple-600" style={{width: `${total ? Math.max(5, valor / total * 100) : 0}%`}}/></div></div>)}{!porCanal.length && <p className="text-gray-500">Todavía no hay ventas para analizar.</p>}</div></div></section>;
}
