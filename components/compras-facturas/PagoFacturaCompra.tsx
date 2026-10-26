"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { moneda } from "@/lib/crm";

export type PagoFactura = { id: string; factura_id: string; monto: number; fecha: string; cuenta_id: string; metodo_pago: string; referencia: string | null };
export type CuentaPagoFactura = { id: string; nombre: string; activa: boolean };

const metodos = ["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta de crédito", "POS", "Link de pago", "Cheque", "Otro"];

export async function registrarPagoFactura(datos: {
  facturaId: string; monto: number; fecha: string; cuentaId: string;
  metodo: string; referencia: string; usuarioId: string;
}) {
  return supabase.from("pagos_facturas_compra").insert({
    factura_id: datos.facturaId, monto: datos.monto, fecha: datos.fecha,
    cuenta_id: datos.cuentaId, metodo_pago: datos.metodo,
    referencia: datos.referencia.trim() || null, creado_por: datos.usuarioId,
  });
}

export default function PagoFacturaCompra({ factura, pagos, cuentas, usuarioId, yaRegistradaEnCaja, alGuardar }: {
  factura: { id: string; total: number; numero: string | null };
  pagos: PagoFactura[];
  cuentas: CuentaPagoFactura[];
  usuarioId: string | null;
  yaRegistradaEnCaja: boolean;
  alGuardar: () => Promise<void>;
}) {
  const propios = pagos.filter((pago) => pago.factura_id === factura.id);
  const pagado = propios.reduce((total, pago) => total + Number(pago.monto || 0), 0);
  const saldo = Math.max(0, Math.round((Number(factura.total) - pagado) * 100) / 100);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(new Date().toLocaleDateString("en-CA"));
  const [cuentaId, setCuentaId] = useState("");
  const [metodo, setMetodo] = useState("Efectivo");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function guardar() {
    setError(""); setAviso("");
    if (yaRegistradaEnCaja) { setError("Esta factura respalda una compra que ya se registró en caja. No se puede pagar de nuevo."); return; }
    const valor = Number(monto || saldo);
    if (!usuarioId || !cuentaId || !fecha || !metodo || !Number.isFinite(valor) || valor <= 0 || valor > saldo) {
      setError("Selecciona cuenta, fecha, medio y un abono que no supere el saldo."); return;
    }
    if (!window.confirm(`¿Registrar pago de ${moneda(valor)} para esta factura? Se añadirá como gasto al Flujo de caja.`)) return;
    setGuardando(true);
    const { error: guardarError } = await registrarPagoFactura({ facturaId: factura.id, monto: valor, fecha, cuentaId, metodo, referencia, usuarioId });
    setGuardando(false);
    if (guardarError) { setError(`No se registró el pago: ${guardarError.message}`); return; }
    setMonto(""); setReferencia(""); setAviso("Pago registrado y reflejado en Flujo de caja.");
    await alGuardar();
  }

  return <section className="border-t border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black">Pago de esta factura</h3><p className="mt-1 text-sm text-slate-600">Se puede ingresar inventario antes de pagar. Cada abono crea un gasto vinculado a esta factura.</p></div><Link href="/flujo-caja" className="text-xs font-bold text-orange-700 underline">Ver Flujo de caja</Link></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3"><p className="rounded-lg bg-slate-50 p-3 text-sm">Total <b className="block">{moneda(factura.total)}</b></p><p className="rounded-lg bg-emerald-50 p-3 text-sm">Pagado <b className="block">{moneda(pagado)}</b></p><p className="rounded-lg bg-orange-50 p-3 text-sm">Saldo <b className="block">{moneda(saldo)}</b></p></div>
    <p className="mt-2 text-xs font-bold">{saldo <= 0 ? "Pagada" : pagado > 0 ? "Pago parcial" : "Pendiente de pago"}</p>
    {yaRegistradaEnCaja && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Esta factura respalda compras ya registradas en caja. No agregues otro pago desde aquí.</p>}
    {!!propios.length && <div className="mt-3 space-y-1 text-xs text-slate-600">{propios.map((pago) => <p key={pago.id}>{pago.fecha} · {moneda(pago.monto)} · {pago.metodo_pago} · {cuentas.find((cuenta) => cuenta.id === pago.cuenta_id)?.nombre || "Cuenta"}</p>)}</div>}
    {saldo > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-bold">Monto del abono<input type="number" min="0.01" max={saldo} step="0.01" placeholder={String(saldo)} value={monto} onChange={(event) => setMonto(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"/></label><label className="text-xs font-bold">Fecha<input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"/></label><label className="text-xs font-bold">Cuenta<select value={cuentaId} onChange={(event) => setCuentaId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"><option value="">Seleccionar</option>{cuentas.filter((cuenta) => cuenta.activa).map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>)}</select></label><label className="text-xs font-bold">Medio<select value={metodo} onChange={(event) => setMetodo(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm">{metodos.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold sm:col-span-2">Referencia o comprobante<input value={referencia} onChange={(event) => setReferencia(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"/></label><button type="button" disabled={guardando || !cuentas.some((cuenta) => cuenta.activa)} onClick={() => void guardar()} className="self-end rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{guardando ? "Registrando…" : "Registrar pago"}</button></div>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {aviso && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}
  </section>;
}
