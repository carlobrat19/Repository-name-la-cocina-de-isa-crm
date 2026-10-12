"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CreditCard, Pencil, WalletCards } from "lucide-react";
import { moneda } from "@/lib/crm";
import { supabase } from "@/lib/supabase";

type Movimiento = { id: string; tipo: "Ingreso" | "Gasto" | "Transferencia"; categoria: string | null; descripcion: string | null; monto: number | string; fecha: string | null; cuenta: string | null; cuenta_id: string | null; cuenta_destino_id: string | null; metodo_pago: string | null; origen: string | null; origen_id: string | null; pedido_id: string | null; created_at: string | null };
type Cuenta = { id: string; nombre: string; tipo: "Caja" | "Banco" | "POS" | "Tarjeta de crédito" | "Billetera digital"; saldo_inicial: number | string; fecha_saldo_inicial: string; activa: boolean; notas: string | null; sucursal_id: string | null };
const categorias = { Ingreso: ["Venta manual", "Capital aportado", "Reembolso", "Otros ingresos"], Gasto: ["Materia prima", "Mensajería y envíos", "Utensilios de cocina", "Equipo de cocina", "Mobiliario", "Servicios", "Publicidad", "Nómina", "Sueldo de propietarios", "Retiro de utilidades", "Alquiler", "Transporte", "Comisiones POS", "Impuestos", "Mantenimiento", "Otros gastos"], Transferencia: ["Movimiento entre cuentas", "Pago de tarjeta de crédito"] };
const metodos = ["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta de crédito", "POS", "Link de pago", "Cheque", "Otro"];
const dinero = (valor: number | string | null | undefined) => moneda(Number(valor || 0));
const fecha = (valor: string | null) => valor ? new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${valor.slice(0, 10)}T12:00:00`)) : "—";
const normalizarFecha = (valor: string | null) => (valor || "").slice(0, 10);

export default function FlujoCajaPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]); const [cuentasData, setCuentasData] = useState<Cuenta[]>([]); const [cargando, setCargando] = useState(false); const [guardando, setGuardando] = useState(false); const [error, setError] = useState(""); const [aviso, setAviso] = useState("");
  const cuentas = cuentasData.filter((item) => item.activa);
  const [tipo, setTipo] = useState<Movimiento["tipo"]>("Gasto"); const [categoria, setCategoria] = useState("Materia prima"); const [descripcion, setDescripcion] = useState(""); const [monto, setMonto] = useState(""); const [cuenta, setCuenta] = useState("Caja"); const [cuentaDestinoId, setCuentaDestinoId] = useState(""); const [metodo, setMetodo] = useState("Efectivo"); const [fechaMovimiento, setFechaMovimiento] = useState(new Date().toISOString().slice(0, 10));
  const [nombreCuenta, setNombreCuenta] = useState(""); const [tipoCuenta, setTipoCuenta] = useState<Cuenta["tipo"]>("Caja"); const [saldoInicial, setSaldoInicial] = useState(""); const [fechaSaldoInicial, setFechaSaldoInicial] = useState(new Date().toISOString().slice(0, 10)); const [creandoCuenta, setCreandoCuenta] = useState(false); const [cuentaInicialId, setCuentaInicialId] = useState(""); const [saldoConfigurado, setSaldoConfigurado] = useState(""); const [guardandoSaldo, setGuardandoSaldo] = useState(false);
  const [periodo, setPeriodo] = useState("Mes"); const [desde, setDesde] = useState(""); const [hasta, setHasta] = useState(""); const [tipoFiltro, setTipoFiltro] = useState("Todos"); const [cuentaFiltro, setCuentaFiltro] = useState("Todas"); const [origenFiltro, setOrigenFiltro] = useState("Todos"); const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Movimiento | null>(null);
  const [edicion, setEdicion] = useState({ tipo: "Gasto" as Movimiento["tipo"], categoria: "", descripcion: "", monto: "", fecha: "", cuenta_id: "", cuenta_destino_id: "", metodo_pago: "Efectivo" });
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  async function cargar() { setCargando(true); setError(""); const [movimientosRespuesta, cuentasRespuesta] = await Promise.all([supabase.from("movimientos_caja").select("id,tipo,categoria,descripcion,monto,fecha,cuenta,cuenta_id,cuenta_destino_id,metodo_pago,origen,origen_id,pedido_id,created_at").order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(500), supabase.from("cuentas_financieras").select("id,nombre,tipo,saldo_inicial,fecha_saldo_inicial,activa,notas,sucursal_id").order("created_at")]); const consultaError = movimientosRespuesta.error || cuentasRespuesta.error; if (consultaError) { console.error(consultaError); setError("No se pudo cargar el flujo de caja."); } else { setMovimientos((movimientosRespuesta.data || []) as Movimiento[]); setCuentasData((cuentasRespuesta.data || []) as Cuenta[]); } setCargando(false); }
  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, []);

  const rango = useMemo(() => { const hoy = new Date(); const final = hoy.toISOString().slice(0, 10); if (periodo === "Personalizado") return { inicio: desde, final: hasta }; if (periodo === "Todo") return { inicio: "", final: "" }; const inicio = new Date(hoy); if (periodo === "Hoy") return { inicio: final, final }; if (periodo === "Semana") inicio.setDate(hoy.getDate() - 6); if (periodo === "Mes") inicio.setDate(1); return { inicio: inicio.toISOString().slice(0, 10), final }; }, [periodo, desde, hasta]);
  const filtrados = useMemo(() => movimientos.filter((movimiento) => { const valorFecha = normalizarFecha(movimiento.fecha); const texto = `${movimiento.tipo} ${movimiento.categoria || ""} ${movimiento.descripcion || ""} ${movimiento.cuenta || ""} ${movimiento.metodo_pago || ""} ${movimiento.origen || ""}`.toLowerCase(); return (!rango.inicio || valorFecha >= rango.inicio) && (!rango.final || valorFecha <= rango.final) && (tipoFiltro === "Todos" || movimiento.tipo === tipoFiltro) && (cuentaFiltro === "Todas" || movimiento.cuenta_id === cuentaFiltro) && (origenFiltro === "Todos" || movimiento.origen === origenFiltro) && texto.includes(busqueda.toLowerCase()); }), [movimientos, rango, tipoFiltro, cuentaFiltro, origenFiltro, busqueda]);
  const totales = useMemo(() => filtrados.reduce((actual, movimiento) => { const valor = Number(movimiento.monto || 0); if (movimiento.tipo === "Ingreso") actual.ingresos += valor; if (movimiento.tipo === "Gasto") actual.gastos += valor; if ((movimiento.cuenta || "").toLowerCase().includes("crédito")) actual.credito += movimiento.tipo === "Gasto" ? valor : -valor; return actual; }, { ingresos: 0, gastos: 0, credito: 0 }), [filtrados]);
  const saldo = totales.ingresos - totales.gastos; const automaticos = filtrados.filter((movimiento) => movimiento.origen && movimiento.origen !== "manual").length;
  const saldosCuentas = useMemo(() => cuentasData.map((cuentaActual) => { let saldoCuenta = Number(cuentaActual.saldo_inicial || 0); movimientos.filter((movimiento) => !cuentaActual.fecha_saldo_inicial || normalizarFecha(movimiento.fecha) >= cuentaActual.fecha_saldo_inicial).forEach((movimiento) => { const valor = Number(movimiento.monto || 0); if (movimiento.cuenta_id === cuentaActual.id) saldoCuenta += movimiento.tipo === "Ingreso" ? valor : -valor; if (movimiento.cuenta_destino_id === cuentaActual.id) saldoCuenta += valor; }); return { ...cuentaActual, saldo: saldoCuenta }; }), [cuentasData, movimientos]);
  const saldosCuentasActivas = saldosCuentas.filter((cuentaActual) => cuentaActual.activa);
  const liquidez = saldosCuentasActivas.filter((cuentaActual) => cuentaActual.tipo !== "Tarjeta de crédito").reduce((suma, cuentaActual) => suma + cuentaActual.saldo, 0);
  const deudaTarjetas = saldosCuentasActivas.filter((cuentaActual) => cuentaActual.tipo === "Tarjeta de crédito").reduce((suma, cuentaActual) => suma + Math.max(0, -cuentaActual.saldo), 0);

  async function guardar(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setAviso(""); const valor = Number(monto); const cuentaOrigen = cuentas.find((item) => item.nombre === cuenta); const cuentaDestino = cuentas.find((item) => item.id === cuentaDestinoId); if (!categoria || !Number.isFinite(valor) || valor <= 0 || !cuentaOrigen) { setError("Selecciona una cuenta, categoría y un monto válido."); return; } if (tipo === "Transferencia" && (!cuentaDestino || cuentaDestino.id === cuentaOrigen.id)) { setError("En una transferencia selecciona una cuenta de destino distinta."); return; } setGuardando(true); const { error: insercionError } = await supabase.from("movimientos_caja").insert({ tipo, categoria, descripcion: descripcion.trim() || null, monto: valor, fecha: fechaMovimiento || null, cuenta, cuenta_id: cuentaOrigen.id, cuenta_destino_id: tipo === "Transferencia" ? cuentaDestino?.id ?? null : null, metodo_pago: metodo, origen: "manual" }); setGuardando(false); if (insercionError) { setError(insercionError.message); return; } setDescripcion(""); setMonto(""); setCuentaDestinoId(""); setAviso(tipo === "Transferencia" ? "Transferencia registrada entre las dos cuentas." : "Movimiento guardado en el flujo de caja."); await cargar(); }
  function abrirEdicion(movimiento: Movimiento) {
    setError(""); setAviso(""); setEditando(movimiento);
    setEdicion({ tipo: movimiento.tipo, categoria: movimiento.categoria || categorias[movimiento.tipo][0], descripcion: movimiento.descripcion || "", monto: String(movimiento.monto), fecha: normalizarFecha(movimiento.fecha), cuenta_id: movimiento.cuenta_id || "", cuenta_destino_id: movimiento.cuenta_destino_id || "", metodo_pago: movimiento.metodo_pago || "Efectivo" });
  }
  async function guardarEdicion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editando) return;
    setError(""); setAviso("");
    const valor = Number(edicion.monto);
    if (!edicion.cuenta_id || !edicion.metodo_pago || (editando.origen === "manual" && (!Number.isFinite(valor) || valor <= 0 || !edicion.fecha || !edicion.categoria))) {
      setError("Completa la cuenta, el medio de pago y los datos obligatorios."); return;
    }
    setGuardandoEdicion(true);
    const { error: edicionError } = await supabase.rpc("editar_movimiento_caja_seguro", { p_movimiento_id: editando.id, p_datos: edicion });
    setGuardandoEdicion(false);
    if (edicionError) { setError(`No se pudo guardar la corrección: ${edicionError.message}`); return; }
    setEditando(null); setAviso("Movimiento actualizado. El cobro o la compra original también quedó sincronizado."); await cargar();
  }
  async function crearCuenta(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const inicial = Number(saldoInicial || 0); if (!nombreCuenta.trim() || !Number.isFinite(inicial)) { setError("Ingresa nombre y saldo inicial válidos."); return; } setCreandoCuenta(true); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setCreandoCuenta(false); setError("Tu sesión expiró. Inicia sesión de nuevo para crear una cuenta."); return; } const saldoFirmado = tipoCuenta === "Tarjeta de crédito" ? -Math.abs(inicial) : inicial; const { error: cuentaError } = await supabase.from("cuentas_financieras").insert({ nombre: nombreCuenta.trim(), tipo: tipoCuenta, saldo_inicial: saldoFirmado, fecha_saldo_inicial: fechaSaldoInicial, creado_por: user.id }); setCreandoCuenta(false); if (cuentaError) { setError(cuentaError.message); return; } setNombreCuenta(""); setSaldoInicial(""); setAviso("Cuenta creada. Su saldo inicial ya forma parte del control financiero."); await cargar(); }
  async function guardarSaldoInicial(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setAviso(""); const cuentaSeleccionada = cuentas.find((item) => item.id === cuentaInicialId); const valor = Number(saldoConfigurado || 0); if (!cuentaSeleccionada || !Number.isFinite(valor)) { setError("Selecciona una cuenta e ingresa un saldo válido."); return; } setGuardandoSaldo(true); const saldoFirmado = cuentaSeleccionada.tipo === "Tarjeta de crédito" ? -Math.abs(valor) : valor; const { error: saldoError } = await supabase.from("cuentas_financieras").update({ saldo_inicial: saldoFirmado, fecha_saldo_inicial: fechaSaldoInicial }).eq("id", cuentaSeleccionada.id); setGuardandoSaldo(false); if (saldoError) { setError(saldoError.message); return; } setSaldoConfigurado(""); setAviso("Saldo inicial actualizado. Los movimientos posteriores se suman automáticamente a esta cuenta."); await cargar(); }
  async function eliminarCuenta(cuentaActual: Cuenta) { if (!window.confirm(`¿Eliminar definitivamente la cuenta ${cuentaActual.nombre}? Solo se eliminará si no tiene movimientos.`)) return; const { error: eliminarError } = await supabase.rpc("eliminar_cuenta_financiera_segura", { p_cuenta_id: cuentaActual.id }); if (eliminarError) { setError(eliminarError.message); return; } setAviso("Cuenta eliminada definitivamente."); await cargar(); }
  async function alternarCuenta(cuentaActual: Cuenta) { const { error: cambioError } = await supabase.from("cuentas_financieras").update({ activa: !cuentaActual.activa }).eq("id", cuentaActual.id); if (cambioError) { setError(cambioError.message); return; } setAviso(cuentaActual.activa ? "Cuenta desactivada. El historial financiero se conserva." : "Cuenta activada."); await cargar(); }
  const limpiar = () => { setPeriodo("Mes"); setDesde(""); setHasta(""); setTipoFiltro("Todos"); setCuentaFiltro("Todas"); setOrigenFiltro("Todos"); setBusqueda(""); };

  return <main className="min-h-screen bg-slate-100 px-4 py-7 sm:px-7 lg:px-10">
<div className="mx-auto max-w-[1600px]">
    <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
<div>
<p className="text-xs font-bold uppercase tracking-[.22em] text-orange-600">Tesorería operativa</p>
<h1 className="mt-2 text-4xl font-black text-slate-950">Flujo de caja</h1>
<p className="mt-2 text-sm text-slate-600">Controla dinero recibido, gastos, compras de ingredientes y movimientos por cuenta o medio de pago.</p>
</div>
<button disabled={cargando} onClick={() => void cargar()} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{cargando ? "Actualizando…" : "Actualizar"}</button>
</header>
    {(error || aviso) && <p className={`mb-5 rounded-xl p-4 text-sm font-semibold ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{error || aviso}</p>}
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
<div className="grid gap-3 xl:grid-cols-[150px_170px_170px_170px_180px_1fr_auto]">
<select value={periodo} onChange={(event) => { setPeriodo(event.target.value); if (event.target.value !== "Personalizado") { setDesde(""); setHasta(""); } }} className="rounded-xl border border-slate-200 px-3 py-3 text-sm">
<option>Hoy</option>
<option>Semana</option>
<option>Mes</option>
<option>Todo</option>
<option>Personalizado</option>
</select>
<input type="date" value={desde} onChange={(event) => { setDesde(event.target.value); setPeriodo("Personalizado"); }} aria-label="Fecha desde" className="rounded-xl border border-slate-200 px-3 py-3 text-sm"/>
<input type="date" value={hasta} onChange={(event) => { setHasta(event.target.value); setPeriodo("Personalizado"); }} aria-label="Fecha hasta" className="rounded-xl border border-slate-200 px-3 py-3 text-sm"/>
<select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm">
<option>Todos</option>
<option>Ingreso</option>
<option>Gasto</option>
<option>Transferencia</option>
</select>
<select value={cuentaFiltro} onChange={(event) => setCuentaFiltro(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm">
<option value="Todas">Todas las cuentas</option>{cuentas.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}</select>
<input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar categoría, descripción o método" className="rounded-xl border border-slate-200 px-4 py-3 text-sm"/>
<button onClick={limpiar} className="text-sm font-bold text-slate-500 underline">Limpiar</button>
</div>
</section>
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
<article className="rounded-2xl bg-slate-950 p-5 text-white">
<WalletCards size={20}/>
<p className="mt-4 text-xs font-bold uppercase text-slate-400">Liquidez actual</p>
<p className="mt-2 text-3xl font-black">{dinero(liquidez)}</p>
<p className="mt-1 text-sm text-slate-400">Caja, banco, POS y billeteras</p>
</article>
<article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
<ArrowUpRight size={20}/>
<p className="mt-4 text-xs font-bold uppercase">Ingresos del rango</p>
<p className="mt-2 text-3xl font-black">{dinero(totales.ingresos)}</p>
<p className="mt-1 text-sm">Flujo neto: {dinero(saldo)}</p>
</article>
<article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
<ArrowDownRight size={20}/>
<p className="mt-4 text-xs font-bold uppercase">Gastos del rango</p>
<p className="mt-2 text-3xl font-black">{dinero(totales.gastos)}</p>
<p className="mt-1 text-sm">Compras, servicios y operación</p>
</article>
<article className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-violet-800">
<CreditCard size={20}/>
<p className="mt-4 text-xs font-bold uppercase">Deuda tarjetas</p>
<p className="mt-2 text-3xl font-black">{dinero(deudaTarjetas)}</p>
<p className="mt-1 text-sm">Obligaciones pendientes</p>
</article>
</section>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-6">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Configuración financiera</p>
        <h2 className="mt-2 text-2xl font-black">Cuentas y saldos iniciales</h2>
        <p className="mt-1 text-sm text-slate-500">Empieza cada cuenta en Q0.00 y registra el saldo real cuando quieras. Después, los cobros, compras y gastos actualizarán el saldo automáticamente.</p>
      </div>
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {saldosCuentas.map((cuentaActual) => <article key={cuentaActual.id} className={`rounded-2xl border border-slate-200 p-4 ${cuentaActual.activa ? "bg-slate-50" : "bg-slate-100 opacity-70"}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{cuentaActual.tipo}{cuentaActual.sucursal_id ? " · Caja de sucursal" : ""}</p><p className="mt-2 font-black text-slate-900">{cuentaActual.nombre}</p><p className={`mt-3 text-2xl font-black ${cuentaActual.tipo === "Tarjeta de crédito" ? "text-violet-700" : "text-emerald-700"}`}>{dinero(cuentaActual.tipo === "Tarjeta de crédito" ? Math.max(0, -cuentaActual.saldo) : cuentaActual.saldo)}</p><p className="mt-1 text-xs text-slate-500">{cuentaActual.activa ? (cuentaActual.tipo === "Tarjeta de crédito" ? "Deuda pendiente" : "Saldo disponible") : "Cuenta desactivada"}</p><div className="mt-3 flex gap-2">{!cuentaActual.sucursal_id && <><button onClick={() => void alternarCuenta(cuentaActual)} className="text-xs font-bold text-slate-600">{cuentaActual.activa ? "Desactivar" : "Activar"}</button><button onClick={() => void eliminarCuenta(cuentaActual)} className="text-xs font-bold text-rose-700">Eliminar</button></>}{cuentaActual.sucursal_id && <span className="text-xs text-slate-500">Gestiona esta caja desde Sucursales.</span>}</div></article>)}
          </div>
          <form onSubmit={guardarSaldoInicial} className="mt-5 grid gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4 md:grid-cols-[1fr_150px_150px_auto]">
            <label className="text-sm font-bold">Cuenta<select value={cuentaInicialId} onChange={(event) => setCuentaInicialId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3"><option value="">Seleccionar cuenta</option>{cuentas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label className="text-sm font-bold">Saldo actual (Q)<input type="number" min="0" step="0.01" value={saldoConfigurado} onChange={(event) => setSaldoConfigurado(event.target.value)} placeholder="0.00" className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3"/></label>
            <label className="text-sm font-bold">Fecha base<input type="date" value={fechaSaldoInicial} onChange={(event) => setFechaSaldoInicial(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3"/></label>
            <button disabled={guardandoSaldo} className="self-end rounded-xl bg-slate-950 p-3 text-sm font-bold text-white disabled:opacity-60">{guardandoSaldo ? "Guardando…" : "Guardar saldo"}</button>
          </form>
        </div>
        <form onSubmit={crearCuenta} className="rounded-2xl border border-slate-200 p-5"><h3 className="text-lg font-black">Agregar cuenta</h3><p className="mt-1 text-sm text-slate-500">Ej. Banco Industrial, caja de quiosco o POS.</p><div className="mt-4 grid gap-3"><input value={nombreCuenta} onChange={(event) => setNombreCuenta(event.target.value)} placeholder="Nombre de la cuenta" className="rounded-xl border border-slate-200 p-3 text-sm"/><select value={tipoCuenta} onChange={(event) => setTipoCuenta(event.target.value as Cuenta["tipo"])} className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><option>Caja</option><option>Banco</option><option>POS</option><option>Tarjeta de crédito</option><option>Billetera digital</option></select><div className="grid grid-cols-2 gap-3"><input type="number" min="0" step="0.01" value={saldoInicial} onChange={(event) => setSaldoInicial(event.target.value)} placeholder={tipoCuenta === "Tarjeta de crédito" ? "Deuda inicial (Q)" : "Saldo inicial (Q)"} className="rounded-xl border border-slate-200 p-3 text-sm"/><input type="date" value={fechaSaldoInicial} onChange={(event) => setFechaSaldoInicial(event.target.value)} className="rounded-xl border border-slate-200 p-3 text-sm"/></div><button disabled={creandoCuenta} className="rounded-xl bg-orange-500 p-3 text-sm font-bold text-white disabled:opacity-60">{creandoCuenta ? "Creando…" : "Crear cuenta"}</button></div></form>
      </div>
    </section>
    <section className="mt-6 grid gap-6 xl:grid-cols-[390px_1fr]">
<form onSubmit={guardar} className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
<p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Registro manual</p>
<h2 className="mt-2 text-2xl font-black">Nuevo movimiento</h2>
<p className="mt-2 text-sm text-slate-500">Usa este formulario para servicios, gastos generales, capital u otros movimientos no automáticos.</p>
<div className="mt-6 space-y-4">
<div className="grid grid-cols-2 gap-3">
<label className="text-sm font-bold">Tipo<select value={tipo} onChange={(event) => { const nuevoTipo = event.target.value as Movimiento["tipo"]; setTipo(nuevoTipo); setCategoria(categorias[nuevoTipo][0]); setCuentaDestinoId(""); if (nuevoTipo === "Transferencia") setMetodo("Transferencia"); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3">
<option>Ingreso</option>
<option>Gasto</option>
<option>Transferencia</option>
</select>
</label>
<label className="text-sm font-bold">Fecha<input type="date" value={fechaMovimiento} onChange={(event) => setFechaMovimiento(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
</label>
</div>
<label className="block text-sm font-bold">Categoría<select value={categoria} onChange={(event) => setCategoria(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3">{categorias[tipo].map((opcion) => <option key={opcion}>{opcion}</option>)}</select>
</label>
{tipo === "Gasto" && <p className="text-xs leading-5 text-slate-500">Sartenes y utensilios: Utensilios de cocina · Refrigeradora: Equipo de cocina · Mesas: Mobiliario. Materia prima es para ingredientes que se consumen al preparar productos. Sueldo de propietarios es un pago por trabajo; Retiro de utilidades es dinero que se saca de las ganancias.</p>}
<label className="block text-sm font-bold">Descripción<input value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder={tipo === "Transferencia" ? "Ej. Pago de tarjeta de Carlo" : "Ej. Pago de energía eléctrica"} className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
</label>
<label className="block text-sm font-bold">Monto (Q)<input type="number" min="0.01" step="0.01" value={monto} onChange={(event) => setMonto(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
</label>
<div className="grid grid-cols-2 gap-3">
<label className="text-sm font-bold">{tipo === "Transferencia" ? "Cuenta que paga" : "Cuenta"}<select value={cuenta} onChange={(event) => setCuenta(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3">{cuentas.map((opcion) => <option key={opcion.id}>{opcion.nombre}</option>)}</select>
</label>
{tipo === "Transferencia" ? <label className="text-sm font-bold">Cuenta que recibe<select required value={cuentaDestinoId} onChange={(event) => setCuentaDestinoId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3"><option value="">Seleccionar cuenta</option>{cuentas.filter((opcion) => opcion.nombre !== cuenta).map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}</select></label> : <label className="text-sm font-bold">Medio de pago<select value={metodo} onChange={(event) => setMetodo(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3">{metodos.map((opcion) => <option key={opcion}>{opcion}</option>)}</select></label>}
</div>
{tipo === "Transferencia" && <p className="rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">El monto saldrá de la primera cuenta y entrará a la segunda. No se contará como ingreso ni gasto.</p>}
<button disabled={guardando} className="w-full rounded-xl bg-slate-950 p-3 font-bold text-white disabled:opacity-60">{guardando ? "Guardando…" : "Guardar movimiento"}</button>
</div>
</form>
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
<div className="flex flex-col gap-2 border-b border-slate-100 p-6 sm:flex-row sm:items-end sm:justify-between">
<div>
<p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Libro de movimientos</p>
<h2 className="mt-2 text-2xl font-black">Detalle del flujo</h2>
<p className="mt-1 text-sm text-slate-500">{filtrados.length} movimientos · {automaticos} automáticos desde cobros o compras.</p>
</div>
<div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">{rango.inicio || rango.final ? `${rango.inicio ? fecha(rango.inicio) : "Sin fecha inicial"} — ${rango.final ? fecha(rango.final) : "Sin fecha final"}` : "Todo el historial"}</div>
</div>
<div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 md:grid-cols-2 lg:grid-cols-12">
<input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar nombre, categoría, cuenta o referencia" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm lg:col-span-6"/>
<label className="text-xs font-bold text-slate-600 lg:col-span-3">Desde<input type="date" value={desde} onChange={(event) => { setDesde(event.target.value); setPeriodo("Personalizado"); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
<label className="text-xs font-bold text-slate-600 lg:col-span-3">Hasta<input type="date" value={hasta} onChange={(event) => { setHasta(event.target.value); setPeriodo("Personalizado"); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
<select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value)} aria-label="Filtrar por tipo" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm lg:col-span-3"><option value="Todos">Todos los tipos</option><option>Ingreso</option><option>Gasto</option><option>Transferencia</option></select>
<select value={cuentaFiltro} onChange={(event) => setCuentaFiltro(event.target.value)} aria-label="Filtrar por cuenta" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm lg:col-span-3"><option value="Todas">Todas las cuentas</option>{cuentas.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>)}</select>
<select value={origenFiltro} onChange={(event) => setOrigenFiltro(event.target.value)} aria-label="Filtrar por origen" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm lg:col-span-3"><option value="Todos">Todos los orígenes</option><option value="manual">Manual</option><option value="pago">Cobro</option><option value="compra_ingrediente">Compra ingrediente</option></select>
<button onClick={limpiar} className="px-3 text-sm font-bold text-slate-500 underline lg:col-span-3">Limpiar filtros</button>
</div>
<div className="max-h-[620px] overflow-auto">
<table className="w-full min-w-[950px] text-sm">
<thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500 shadow-sm">
<tr>
<th className="p-4">Fecha</th>
<th className="p-4">Movimiento</th>
<th className="p-4">Categoría</th>
<th className="p-4">Cuenta / método</th>
<th className="p-4">Origen</th>
<th className="p-4 text-right">Monto</th>
<th className="p-4 text-right">Acción</th>
</tr>
</thead>
<tbody>{cargando && <tr>
<td colSpan={7} className="p-10 text-center text-slate-500">Cargando movimientos…</td>
</tr>}{!cargando && filtrados.map((movimiento) => <tr key={movimiento.id} className="border-t border-slate-100 hover:bg-slate-50">
<td className="p-4 font-semibold text-slate-600">{fecha(movimiento.fecha)}</td>
<td className="p-4">
<span className={`rounded-full px-2.5 py-1 text-xs font-bold ${movimiento.tipo === "Ingreso" ? "bg-emerald-100 text-emerald-700" : movimiento.tipo === "Gasto" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>{movimiento.tipo}</span>
<p className="mt-2 font-semibold text-slate-800">{movimiento.descripcion || "Sin descripción"}</p>
</td>
<td className="p-4 font-semibold">{movimiento.categoria || "—"}</td>
<td className="p-4">
<p>{movimiento.cuenta || "—"}</p>
<p className="mt-1 text-xs text-slate-500">{movimiento.metodo_pago || "Sin especificar"}</p>
</td>
<td className="p-4">
<span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{movimiento.origen === "pago" ? "Cobro" : movimiento.origen === "compra_ingrediente" ? "Compra ingrediente" : "Manual"}</span>
</td>
<td className={`p-4 text-right text-base font-black ${movimiento.tipo === "Ingreso" ? "text-emerald-600" : movimiento.tipo === "Gasto" ? "text-rose-600" : "text-blue-600"}`}>{movimiento.tipo === "Ingreso" ? "+" : movimiento.tipo === "Gasto" ? "−" : "↔"}{dinero(movimiento.monto)}</td>
<td className="p-4 text-right"><button type="button" onClick={() => abrirEdicion(movimiento)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-orange-50"><Pencil size={13} /> Editar</button></td>
</tr>)}{!cargando && !filtrados.length && <tr>
<td colSpan={7} className="p-10 text-center text-slate-500">No hay movimientos para estos filtros.</td>
</tr>}</tbody>
</table>
</div>
</section>
</section>
  </div>
{editando && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !guardandoEdicion) setEditando(null); }}>
  <form onSubmit={guardarEdicion} role="dialog" aria-modal="true" aria-label="Editar movimiento de caja" className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
    <div><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Corrección de movimiento</p><h2 className="mt-1 text-2xl font-black text-slate-950">Editar {editando.tipo.toLowerCase()}</h2><p className="mt-1 text-sm text-slate-500">{editando.descripcion || "Movimiento sin descripción"}</p></div>
    {editando.origen && editando.origen !== "manual" ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Este movimiento viene de {editando.origen === "pago" ? "un cobro" : "una compra de ingredientes"}. Aquí puedes corregir la cuenta y el medio de pago; el monto y la fecha se conservan para no alterar el pedido ni el inventario.</p> : <div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">Tipo<select value={edicion.tipo} onChange={(event) => { const nuevoTipo = event.target.value as Movimiento["tipo"]; setEdicion({ ...edicion, tipo: nuevoTipo, categoria: categorias[nuevoTipo][0], cuenta_destino_id: "" }); }} className="mt-1 w-full rounded-xl border border-slate-200 p-3"><option>Ingreso</option><option>Gasto</option><option>Transferencia</option></select></label><label className="text-sm font-bold">Fecha<input type="date" required value={edicion.fecha} onChange={(event) => setEdicion({ ...edicion, fecha: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label></div>}
    {(!editando.origen || editando.origen === "manual") && <><label className="block text-sm font-bold">Categoría<select value={edicion.categoria} onChange={(event) => setEdicion({ ...edicion, categoria: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3">{categorias[edicion.tipo].map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-sm font-bold">Descripción<input value={edicion.descripcion} onChange={(event) => setEdicion({ ...edicion, descripcion: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label><label className="block text-sm font-bold">Monto (Q)<input type="number" required min="0.01" step="0.01" value={edicion.monto} onChange={(event) => setEdicion({ ...edicion, monto: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3" /></label></>}
    <label className="block text-sm font-bold">Cuenta<select required value={edicion.cuenta_id} onChange={(event) => setEdicion({ ...edicion, cuenta_id: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3"><option value="">Selecciona una cuenta</option>{cuentas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
    {(!editando.origen || editando.origen === "manual") && edicion.tipo === "Transferencia" && <label className="block text-sm font-bold">Cuenta de destino<select required value={edicion.cuenta_destino_id} onChange={(event) => setEdicion({ ...edicion, cuenta_destino_id: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3"><option value="">Selecciona una cuenta</option>{cuentas.filter((item) => item.id !== edicion.cuenta_id).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>}
    <label className="block text-sm font-bold">Medio de pago<select required value={edicion.metodo_pago} onChange={(event) => setEdicion({ ...edicion, metodo_pago: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3">{metodos.map((item) => <option key={item}>{item}</option>)}</select></label>
    {edicion.metodo_pago === "Tarjeta de crédito" && editando.tipo === "Ingreso" && <p className="text-xs text-slate-600">Si el cliente pagó con su tarjeta, selecciona la cuenta donde recibes esos cobros (por ejemplo, POS), no la tarjeta de crédito propia del negocio.</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
    <div className="flex gap-3"><button disabled={guardandoEdicion} className="flex-1 rounded-xl bg-slate-950 p-3 text-sm font-bold text-white disabled:opacity-60">{guardandoEdicion ? "Guardando…" : "Guardar cambios"}</button><button type="button" disabled={guardandoEdicion} onClick={() => setEditando(null)} className="rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700">Cancelar</button></div>
  </form>
</div>}
</main>;
}
