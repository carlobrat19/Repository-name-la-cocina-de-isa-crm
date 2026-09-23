"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { moneda } from "@/lib/crm";
import { supabase } from "@/lib/supabase";

type PedidoTendencia = { id: string; fecha_creacion: string | null; estado: string | null; pago_estado: string | null; total: number | string | null };
type MovimientoTendencia = { id: string; fecha: string | null; tipo: string | null; categoria: string | null; monto: number | string | null };
type Mes = { mes: string; generados: number; cancelados: number; entregados: number; pagados: number; montoGenerado: number; montoCancelado: number; montoEntregado: number; montoPagado: number; ingresos: number; gastos: number; neto: number };

const nombresMes = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const normalizar = (valor: string | null) => (valor || "").trim().toLowerCase();
const esCancelado = (estado: string | null) => ["cancelado", "anulado"].includes(normalizar(estado));
const numero = (valor: number | string | null) => Number(valor || 0);
const formatoEje = (valor: number) => valor >= 1000 ? `${(valor / 1000).toFixed(0)} mil` : String(valor);

export default function TendenciasReportes() {
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [mesDetalle, setMesDetalle] = useState(() => new Date().getMonth());
  const [pedidos, setPedidos] = useState<PedidoTendencia[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoTendencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    const inicio = `${anio}-01-01`;
    const fin = `${anio + 1}-01-01`;
    const [pedidosRes, movimientosRes] = await Promise.all([
      supabase.from("pedidos").select("id,fecha_creacion,estado,pago_estado,total").gte("fecha_creacion", inicio).lt("fecha_creacion", fin).order("fecha_creacion").limit(5000),
      supabase.from("movimientos_caja").select("id,fecha,tipo,categoria,monto").gte("fecha", inicio).lt("fecha", fin).order("fecha").limit(5000),
    ]);
    if (pedidosRes.error || movimientosRes.error) setError(`No se pudieron cargar las tendencias: ${(pedidosRes.error || movimientosRes.error)?.message}`);
    setPedidos((pedidosRes.data || []) as PedidoTendencia[]);
    setMovimientos((movimientosRes.data || []) as MovimientoTendencia[]);
    setCargando(false);
  }, [anio]);

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, [cargar]);

  const meses = useMemo(() => {
    const resultado: Mes[] = nombresMes.map((mes) => ({ mes, generados: 0, cancelados: 0, entregados: 0, pagados: 0, montoGenerado: 0, montoCancelado: 0, montoEntregado: 0, montoPagado: 0, ingresos: 0, gastos: 0, neto: 0 }));
    for (const pedido of pedidos) {
      const indice = Number(pedido.fecha_creacion?.slice(5, 7)) - 1;
      if (!resultado[indice]) continue;
      const mes = resultado[indice]; const monto = numero(pedido.total);
      mes.generados++; mes.montoGenerado += monto;
      if (esCancelado(pedido.estado)) { mes.cancelados++; mes.montoCancelado += monto; continue; }
      if (normalizar(pedido.estado) === "entregado") { mes.entregados++; mes.montoEntregado += monto; }
      if (normalizar(pedido.pago_estado) === "pagado") { mes.pagados++; mes.montoPagado += monto; }
    }
    for (const movimiento of movimientos) {
      const indice = Number(movimiento.fecha?.slice(5, 7)) - 1;
      if (!resultado[indice]) continue;
      if (normalizar(movimiento.tipo) === "ingreso") resultado[indice].ingresos += numero(movimiento.monto);
      if (["gasto", "egreso"].includes(normalizar(movimiento.tipo))) resultado[indice].gastos += numero(movimiento.monto);
    }
    resultado.forEach((mes) => { mes.neto = mes.ingresos - mes.gastos; });
    return resultado;
  }, [pedidos, movimientos]);

  const categorias = useMemo(() => {
    const agrupar = (tipo: "ingreso" | "gasto") => {
      const totales = new Map<string, { categoria: string; monto: number; movimientos: number }>();
      movimientos.filter((movimiento) => Number(movimiento.fecha?.slice(5, 7)) === mesDetalle + 1 && normalizar(movimiento.tipo) === tipo).forEach((movimiento) => {
        const categoria = movimiento.categoria?.trim() || "Sin categoría";
        const actual = totales.get(categoria) || { categoria, monto: 0, movimientos: 0 };
        actual.monto += numero(movimiento.monto); actual.movimientos++;
        totales.set(categoria, actual);
      });
      return [...totales.values()].sort((a, b) => b.monto - a.monto);
    };
    return { ingresos: agrupar("ingreso"), gastos: agrupar("gasto") };
  }, [movimientos, mesDetalle]);

  const total = meses.reduce((actual, mes) => ({ generados: actual.generados + mes.generados, cancelados: actual.cancelados + mes.cancelados, entregados: actual.entregados + mes.entregados, pagados: actual.pagados + mes.pagados, montoGenerado: actual.montoGenerado + mes.montoGenerado, montoCancelado: actual.montoCancelado + mes.montoCancelado, montoEntregado: actual.montoEntregado + mes.montoEntregado, montoPagado: actual.montoPagado + mes.montoPagado }), { generados: 0, cancelados: 0, entregados: 0, pagados: 0, montoGenerado: 0, montoCancelado: 0, montoEntregado: 0, montoPagado: 0 });

  return <div className="space-y-6">
    <section className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="text-xl font-black text-slate-950">Tendencias anuales</h2><p className="mt-1 text-sm text-slate-600">Los 12 meses se muestran aunque todavía no haya movimientos.</p></div><div className="flex items-center gap-2"><label htmlFor="anio-tendencias" className="text-sm font-bold text-slate-700">Año</label><input id="anio-tendencias" type="number" min="2020" max="2100" value={anio} onChange={(event) => { const valor = Number(event.target.value); if (valor >= 2020 && valor <= 2100) setAnio(valor); }} className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm"/><button type="button" onClick={() => void cargar()} disabled={cargando} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{cargando ? "Cargando…" : "Actualizar"}</button></div></section>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Pedidos generados", total.generados, total.montoGenerado], ["Cancelados", total.cancelados, total.montoCancelado], ["Entregados", total.entregados, total.montoEntregado], ["Pagados", total.pagados, total.montoPagado]].map(([titulo, cantidad, monto]) => <article key={String(titulo)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p><p className="mt-2 text-2xl font-black text-slate-950">{cantidad} pedidos</p><p className="mt-1 text-sm font-semibold text-slate-700">{moneda(Number(monto))} en pedidos</p></article>)}</section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-black text-slate-950">Pedidos por mes de creación</h3><p className="mt-1 text-sm text-slate-600">Generados, cancelados, entregados y pagados según su estado actual. No representa la fecha en que cambiaron de estado.</p><div className="mt-5 h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={meses} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="mes"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Bar dataKey="generados" name="Generados" fill="#2563eb" radius={[4, 4, 0, 0]}/><Bar dataKey="cancelados" name="Cancelados" fill="#e11d48" radius={[4, 4, 0, 0]}/><Bar dataKey="entregados" name="Entregados" fill="#059669" radius={[4, 4, 0, 0]}/><Bar dataKey="pagados" name="Pagados" fill="#7c3aed" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1080px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">Mes</th><th>Generados</th><th className="text-right">Monto</th><th>Cancelados</th><th className="text-right">Monto</th><th>Entregados</th><th className="text-right">Monto</th><th>Pagados</th><th className="text-right">Monto</th></tr></thead><tbody>{meses.map((mes) => <tr key={mes.mes} className="border-b border-slate-100 last:border-0"><td className="py-2 font-bold">{mes.mes}</td><td>{mes.generados}</td><td className="text-right">{moneda(mes.montoGenerado)}</td><td>{mes.cancelados}</td><td className="text-right">{moneda(mes.montoCancelado)}</td><td>{mes.entregados}</td><td className="text-right">{moneda(mes.montoEntregado)}</td><td>{mes.pagados}</td><td className="text-right font-semibold">{moneda(mes.montoPagado)}</td></tr>)}</tbody></table></div></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-black text-slate-950">Flujo de caja por mes</h3><p className="mt-1 text-sm text-slate-600">Ingresos y gastos registrados por fecha del movimiento. Las transferencias entre cuentas no se cuentan como ingreso ni gasto.</p><div className="mt-5 h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={meses} margin={{ top: 8, right: 8, left: -5, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="mes"/><YAxis tickFormatter={formatoEje}/><Tooltip formatter={(value) => moneda(Number(value || 0))}/><Legend/><Bar dataKey="ingresos" name="Ingresos" fill="#059669" radius={[4, 4, 0, 0]}/><Bar dataKey="gastos" name="Gastos" fill="#f97316" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">Mes</th><th className="text-right">Ingresos</th><th className="text-right">Gastos</th><th className="text-right">Flujo neto</th></tr></thead><tbody>{meses.map((mes) => <tr key={mes.mes} className="border-b border-slate-100 last:border-0"><td className="py-2 font-bold">{mes.mes}</td><td className="text-right">{moneda(mes.ingresos)}</td><td className="text-right">{moneda(mes.gastos)}</td><td className="text-right font-bold">{moneda(mes.neto)}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-slate-500">El flujo neto es ingresos menos gastos; no equivale a utilidad. Puede incluir aportes de capital y otros ingresos no provenientes de ventas.</p></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black text-slate-950">¿En qué se gastó y de dónde ingresó?</h3><p className="mt-1 text-sm text-slate-600">Desglose por categorías registradas en el flujo de caja.</p></div><label className="text-sm font-semibold text-slate-700">Mes <select value={mesDetalle} onChange={(event) => setMesDetalle(Number(event.target.value))} className="ml-2 rounded-xl border border-slate-200 px-3 py-2">{nombresMes.map((nombre, indice) => <option key={nombre} value={indice}>{nombre}</option>)}</select></label></div><div className="mt-5 grid gap-5 lg:grid-cols-2">{([["Gastos", categorias.gastos, "bg-orange-500"], ["Ingresos", categorias.ingresos, "bg-emerald-500"]] as const).map(([titulo, lista, color]) => { const maximo = Math.max(1, ...lista.map((fila) => fila.monto)); return <div key={titulo} className="rounded-2xl border border-slate-100 p-4"><h4 className="font-black text-slate-900">{titulo} · {moneda(lista.reduce((suma, fila) => suma + fila.monto, 0))}</h4><div className="mt-4 space-y-4">{lista.map((fila) => <div key={fila.categoria}><div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{fila.categoria} <span className="text-xs font-normal text-slate-500">({fila.movimientos})</span></span><span className="font-bold">{moneda(fila.monto)}</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${color}`} style={{ width: `${fila.monto / maximo * 100}%` }}/></div></div>)}{!lista.length && <p className="text-sm text-slate-500">Sin movimientos de este tipo en el mes.</p>}</div></div>; })}</div></section>
  </div>;
}
