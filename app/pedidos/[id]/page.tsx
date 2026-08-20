"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  MessageCircle,
  Package,
  Pencil,
  Printer,
  Save,
  ShieldCheck,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Pedido = {
  id: string;
  cliente_id?: string | null;
  codigo?: string | null;
  cliente?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  departamento_entrega?: string | null;
  municipio_entrega?: string | null;
  zona_entrega?: string | null;
  fecha_pedido?: string | null;
  fecha_entrega?: string | null;
  hora_entrega?: string | null;
  estado?: string | null;
  pago_estado?: string | null;
  forma_pago?: string | null;
  vendedor?: string | null;
  requiere_envio?: boolean | null;
  total?: number | string | null;
  subtotal_productos?: number | string | null;
  costo_envio?: number | string | null;
  saldo_pendiente?: number | string | null;
  observaciones?: string | null;
  canal_origen?: string | null;
  tipo_documento?: string | null;
  creado_por?: string | null;
  creado_por_nombre?: string | null;
  responsable_id?: string | null;
};
type Detalle = {
  id?: string;
  producto_id?: string | null;
  cantidad?: number | null;
  precio?: number | string | null;
  productos?: { nombre?: string | null } | null;
};
type ClienteFiscal = {
  id: string;
  nombre?: string | null;
  email?: string | null;
  nit?: string | null;
  razon_social?: string | null;
  direccion?: string | null;
};
type Pago = {
  id: string;
  monto?: number | string | null;
  metodo?: string | null;
  referencia?: string | null;
  fecha?: string | null;
};
type Factura = {
  id: string;
  estado?: string | null;
  serie?: string | null;
  numero?: string | null;
  uuid_fel?: string | null;
  total?: number | string | null;
  error_fel?: string | null;
  emitida_at?: string | null;
};

const dinero = (valor?: number | string | null) =>
  `Q${Number(valor || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (valor?: string | null) =>
  valor
    ? new Date(`${valor.slice(0, 10)}T12:00:00`).toLocaleDateString("es-GT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Por confirmar";
const etiquetaEstado = (estado?: string | null) =>
  estado === "Entregado"
    ? "bg-emerald-100 text-emerald-700"
    : estado === "En Ruta"
      ? "bg-sky-100 text-sky-700"
      : "bg-amber-100 text-amber-800";
const ESTADOS_PEDIDO = ["Pendiente", "Producción", "Empaquetado", "En Ruta", "Entregado", "Cancelado"];
const ESTADOS_PAGO = ["Pendiente", "Pago parcial", "Pagado"];

export default function DetallePedidoPage() {
  const { id } = useParams<{ id: string }>();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [detalles, setDetalles] = useState<Detalle[]>([]);
  const [clienteFiscal, setClienteFiscal] = useState<ClienteFiscal | null>(
    null,
  );
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [factura, setFactura] = useState<Factura | null>(null);
  const [responsableNombre, setResponsableNombre] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [facturando, setFacturando] = useState(false);
  const [actualizandoEstado, setActualizandoEstado] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargarPedido = useCallback(async () => {
    if (!id) return;
    setCargando(true);
    const pedidoRespuesta = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", id)
      .single();
    if (pedidoRespuesta.error || !pedidoRespuesta.data) {
      setCargando(false);
      return;
    }
    const pedidoActual = pedidoRespuesta.data as Pedido;
    const [
      detallesRespuesta,
      pagosRespuesta,
      facturaRespuesta,
      clienteRespuesta,
      responsableRespuesta,
    ] = await Promise.all([
      supabase
        .from("pedido_detalle")
        .select("id, producto_id, cantidad, precio, productos(nombre)")
        .eq("pedido_id", id),
      supabase
        .from("pagos")
        .select("id, monto, metodo, referencia, fecha")
        .eq("pedido_id", id)
        .order("fecha", { ascending: false }),
      supabase
        .from("facturas")
        .select("*")
        .eq("pedido_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      pedidoActual.cliente_id
        ? supabase
            .from("clientes")
            .select("id, nombre, email, nit, razon_social, direccion")
            .eq("id", pedidoActual.cliente_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      pedidoActual.responsable_id
        ? supabase.from("perfiles_crm").select("nombre,email").eq("id", pedidoActual.responsable_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setPedido(pedidoActual);
    setDetalles((detallesRespuesta.data ?? []) as Detalle[]);
    setPagos((pagosRespuesta.data ?? []) as Pago[]);
    setFactura((facturaRespuesta.data ?? null) as Factura | null);
    setClienteFiscal((clienteRespuesta.data ?? null) as ClienteFiscal | null);
    setResponsableNombre(responsableRespuesta.data ? (responsableRespuesta.data.nombre || responsableRespuesta.data.email) : null);
    setCargando(false);
  }, [id]);
  useEffect(() => {
    const timer = window.setTimeout(() => void cargarPedido(), 0);
    return () => window.clearTimeout(timer);
  }, [cargarPedido]);

  const subtotal = useMemo(
    () =>
      pedido
        ? Number(
            pedido.subtotal_productos ??
              detalles.reduce(
                (total, item) =>
                  total + Number(item.precio || 0) * Number(item.cantidad || 0),
                0,
              ),
          )
        : 0,
    [pedido, detalles],
  );
  const envio = Number(pedido?.costo_envio || 0);
  const total = Number(pedido?.total || subtotal + envio);
  const abonadoRegistrado = pagos.reduce(
    (suma, pago) => suma + Number(pago.monto || 0),
    0,
  );
  const abonado = abonadoRegistrado;
  const saldo = Math.max(0, total - abonado);
  const pagoConfirmado = saldo <= 0.009 && total > 0;
  const ubicacion = [
    pedido?.departamento_entrega,
    pedido?.municipio_entrega,
    pedido?.zona_entrega,
  ]
    .filter(Boolean)
    .join(" · ");
  const datosFiscalesCompletos = Boolean(
    clienteFiscal?.nit &&
      clienteFiscal?.razon_social &&
      (clienteFiscal?.direccion || pedido?.direccion),
  );

  async function guardarCambios() {
    if (!pedido) return;
    setGuardando(true);
    const { error } = await supabase
      .from("pedidos")
      .update({
        estado: pedido.estado,
        forma_pago: pedido.forma_pago,
        fecha_entrega: pedido.fecha_entrega || null,
        hora_entrega: pedido.hora_entrega || null,
        direccion: pedido.direccion || null,
        departamento_entrega: pedido.departamento_entrega || null,
        municipio_entrega: pedido.municipio_entrega || null,
        zona_entrega: pedido.zona_entrega || null,
        observaciones: pedido.observaciones || null,
        vendedor: pedido.vendedor || null,
      })
      .eq("id", pedido.id);
    if (!error && clienteFiscal)
      await supabase
        .from("clientes")
        .update({
          email: clienteFiscal.email || null,
          nit: clienteFiscal.nit || null,
          razon_social: clienteFiscal.razon_social || null,
          direccion: clienteFiscal.direccion || null,
        })
        .eq("id", clienteFiscal.id);
    setGuardando(false);
    if (error) {
      alert(`No se pudo guardar: ${error.message}`);
      return;
    }
    setEditando(false);
    await cargarPedido();
  }

  function imprimir() {
    if (!pedido) return;
    const filas = detalles
      .map(
        (detalle) =>
          `<tr><td>${detalle.productos?.nombre || "Producto"}</td><td class="c">${detalle.cantidad || 0}</td><td class="m">${dinero(detalle.precio)}</td><td class="m">${dinero(Number(detalle.precio || 0) * Number(detalle.cantidad || 0))}</td></tr>`,
      )
      .join("") + `<tr><td colspan="3" class="m"><b>Productos</b></td><td class="m">${dinero(subtotal)}</td></tr>${envio > 0 ? `<tr><td colspan="3" class="m"><b>Envío</b></td><td class="m">${dinero(envio)}</td></tr>` : ""}<tr><td colspan="3" class="m"><b>Total pedido</b></td><td class="m"><b>${dinero(total)}</b></td></tr><tr><td colspan="3" class="m">Estado de pago: ${pedido.pago_estado || "Pendiente"}</td><td class="m">Pagado: ${dinero(abonado)}</td></tr><tr><td colspan="3" class="m"><b>Saldo por cobrar</b></td><td class="m"><b>${dinero(saldo)}</b></td></tr>`;
    const ventana = window.open("", "_blank", "width=900,height=700");
    if (!ventana) return;
    ventana.document.write(
      `<!doctype html><html><head><meta charset="utf-8"/><title>${pedido.codigo || "Pedido"}</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:32px}header{display:flex;justify-content:space-between;border-bottom:3px solid #f97316;padding-bottom:18px}.code{font-weight:bold;color:#ea580c}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:11px;border-bottom:1px solid #ddd;text-align:left}.m{text-align:right}.c{text-align:center}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:22px}.box{background:#f8fafc;padding:14px;border-radius:10px}.label{font-size:10px;text-transform:uppercase;font-weight:bold;color:#64748b}.total{margin-top:22px;text-align:right;font-size:20px;font-weight:bold}.note{margin-top:20px;padding:14px;background:#fff7ed;border-radius:10px;white-space:pre-wrap}</style></head><body><header><div><div class="code">${pedido.codigo || "PEDIDO"}</div><h1>Comprobante de pedido</h1></div><div><b>La Cocina de Isa</b><br/>${fecha(pedido.fecha_pedido)}</div></header><section class="grid"><div class="box"><div class="label">Cliente</div><b>${pedido.cliente || "Sin nombre"}</b><br/>${pedido.telefono || "Sin teléfono"}</div><div class="box"><div class="label">Entrega</div>${fecha(pedido.fecha_entrega)} · ${pedido.hora_entrega || "Hora por confirmar"}<br/>${pedido.requiere_envio ? "Envío a domicilio" : "Recoge en tienda"}</div><div class="box"><div class="label">Dirección</div>${pedido.direccion || "Recoger en tienda"}<br/>${ubicacion || ""}</div><div class="box"><div class="label">Cobro</div>${pedido.pago_estado || "Pendiente"} · ${pedido.forma_pago || ""}</div></section><table><thead><tr><th>Producto</th><th class="c">Cant.</th><th class="m">Precio</th><th class="m">Subtotal</th></tr></thead><tbody>${filas}</tbody></table><div class="total">Total: ${dinero(total)}</div>${pedido.observaciones ? `<div class="note"><b>Notas</b><br/>${pedido.observaciones}</div>` : ""}<script>window.onload=()=>window.print()<\/script></body></html>`,
    );
    ventana.document.close();
  }
  function enviarWhatsApp() {
    if (!pedido?.telefono) {
      alert("Este pedido no tiene teléfono.");
      return;
    }
    const texto = `Hola ${pedido.cliente || ""}, te compartimos tu pedido ${pedido.codigo || ""}. Total: ${dinero(total)}. Entrega: ${fecha(pedido.fecha_entrega)}.`;
    window.open(
      `https://wa.me/${pedido.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`,
      "_blank",
    );
  }
  function actualizar<K extends keyof Pedido>(campo: K, valor: Pedido[K]) {
    setPedido((actual) => (actual ? { ...actual, [campo]: valor } : actual));
  }

  async function actualizarEstadoRapido(campo: "estado" | "pago_estado", valor: string) {
    if (!pedido) return;
    if (campo === "estado" && valor === "Cancelado" && !window.confirm("¿Confirmas que deseas cancelar este pedido? No se podrá emitir FEL mientras esté cancelado.")) return;
    setActualizandoEstado(true);
    if (campo === "pago_estado") {
      if (valor === "Pendiente") {
        alert("El estado de pago se calcula con los abonos registrados. Para corregir un cobro utiliza un ajuste autorizado; no se eliminan pagos para conservar la trazabilidad.");
        setActualizandoEstado(false);
        return;
      }
      const monto = valor === "Pagado" ? saldo : Number(window.prompt(`Abono recibido (saldo actual ${dinero(saldo)}):`, "") || 0);
      if (!Number.isFinite(monto) || monto <= 0 || monto > saldo) {
        alert("Ingresa un monto válido que no supere el saldo pendiente.");
        setActualizandoEstado(false);
        return;
      }
      const { error } = await supabase.rpc("registrar_abono_pedido", { p_pedido_id: pedido.id, p_monto: monto, p_metodo: pedido.forma_pago || "Efectivo", p_referencia: null });
      setActualizandoEstado(false);
      if (error) { alert(`No se pudo registrar el pago: ${error.message}`); return; }
      await cargarPedido();
      return;
    }
    const { error } = await supabase.from("pedidos").update({ estado: valor }).eq("id", pedido.id);
    setActualizandoEstado(false);
    if (error) { alert(`No se pudo actualizar: ${error.message}`); return; }
    await cargarPedido();
  }

  async function emitirFEL() {
    if (!pedido?.cliente_id) return;
    if (pedido.estado === "Cancelado") { alert("No puedes emitir FEL de un pedido cancelado."); return; }
    if (!pagoConfirmado) { alert("Marca el pedido como Pagado antes de emitir FEL."); return; }
    if (!datosFiscalesCompletos) { alert("Completa NIT, razón social y dirección fiscal antes de emitir FEL."); return; }
    if (!window.confirm("¿Confirmas que deseas preparar la emisión FEL de este pedido? Una factura certificada no se edita.")) return;
    setFacturando(true);
    try {
      const { data: sesion } = await supabase.auth.getSession();
      if (!sesion.session?.access_token) throw new Error("Tu sesión expiró. Ingresa nuevamente.");
      const respuesta = await fetch("/api/fel/emitir", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sesion.session.access_token}` }, body: JSON.stringify({ pedidoId: pedido.id }) });
      const resultado = await respuesta.json() as { error?: string; pendienteConfiguracion?: boolean };
      if (!respuesta.ok) throw new Error(resultado.error || "No se pudo preparar la factura");
      alert(resultado.pendienteConfiguracion ? "Factura preparada. Falta conectar las credenciales del certificador FEL para emitir el DTE legal." : "Factura FEL emitida.");
      await cargarPedido();
    } catch (error) { alert(error instanceof Error ? error.message : "No se pudo preparar la factura"); }
    finally { setFacturando(false); }
  }

  if (cargando)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-slate-500">
        Cargando pedido…
      </main>
    );
  if (!pedido)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-center">
          <p className="font-bold text-slate-800">
            No encontramos este pedido.
          </p>
          <Link
            href="/pedidos/lista"
            className="mt-3 inline-block text-sm font-bold text-orange-600"
          >
            Volver a pedidos
          </Link>
        </div>
      </main>
    );

  const input =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100";
  return (
    <main className="min-h-screen bg-[#f7f7f8] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Link
              href="/pedidos/lista"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-orange-600"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver a pedidos
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-orange-100 px-2.5 py-1 font-mono text-xs font-black text-orange-700">
                {pedido.codigo || "SIN CÓDIGO"}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${etiquetaEstado(pedido.estado)}`}
              >
                {pedido.estado || "Pendiente"}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${pedido.pago_estado === "Pagado" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
              >
                {pedido.pago_estado || "Pago pendiente"}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              Pedido de {pedido.cliente || "cliente"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Vista operativa, de cobro y preparación para facturación
              electrónica.
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Registrado por: {pedido.creado_por_nombre || "No disponible (pedido creado antes de esta mejora)"}
            </p>
            {responsableNombre && <p className="mt-1 text-xs font-semibold text-orange-700">Seguimiento asignado a: {responsableNombre}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEditando(!editando)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-orange-300 hover:text-orange-700"
            >
              <Pencil className="h-4 w-4" /> {editando ? "Cancelar" : "Editar"}
            </button>
            {editando && (
              <button
                disabled={guardando}
                onClick={() => void guardarCambios()}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />{" "}
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            )}
            <button
              onClick={imprimir}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </div>
        </header>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Total pedido"
                value={dinero(total)}
                color="text-slate-950"
              />
              <Metric
                label="Cobrado"
                value={dinero(abonado)}
                color="text-emerald-600"
              />
              <Metric
                label="Saldo pendiente"
                value={dinero(saldo)}
                color={saldo > 0 ? "text-rose-600" : "text-emerald-600"}
              />
              <Metric
                label="Entrega"
                value={fecha(pedido.fecha_entrega)}
                color="text-slate-950"
              />
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle
                icon={<UserRound className="h-5 w-5" />}
                title="Cliente y datos fiscales"
                text="Información que necesitarás para emitir FEL."
              />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Cliente" value={pedido.cliente || "Sin nombre"} />
                <Field
                  label="Teléfono"
                  value={pedido.telefono || "Sin teléfono"}
                />
                {editando ? (
                  <>
                    <Editable
                      label="NIT"
                      value={clienteFiscal?.nit || ""}
                      onChange={(value) =>
                        setClienteFiscal((actual) =>
                          actual ? { ...actual, nit: value } : actual,
                        )
                      }
                      placeholder="CF o NIT del cliente"
                    />
                    <Editable
                      label="Razón social / nombre en factura"
                      value={clienteFiscal?.razon_social || ""}
                      onChange={(value) =>
                        setClienteFiscal((actual) =>
                          actual ? { ...actual, razon_social: value } : actual,
                        )
                      }
                      placeholder="Nombre para factura"
                    />
                    <Editable
                      label="Correo para factura"
                      value={clienteFiscal?.email || ""}
                      onChange={(value) =>
                        setClienteFiscal((actual) =>
                          actual ? { ...actual, email: value } : actual,
                        )
                      }
                      placeholder="correo@cliente.com"
                    />
                    <Editable
                      label="Dirección fiscal"
                      value={clienteFiscal?.direccion || ""}
                      onChange={(value) =>
                        setClienteFiscal((actual) =>
                          actual ? { ...actual, direccion: value } : actual,
                        )
                      }
                      placeholder="Dirección para factura"
                    />
                  </>
                ) : (
                  <>
                    <Field
                      label="NIT"
                      value={clienteFiscal?.nit || "Pendiente"}
                    />
                    <Field
                      label="Razón social"
                      value={clienteFiscal?.razon_social || "Pendiente"}
                    />
                    <Field
                      label="Correo fiscal"
                      value={clienteFiscal?.email || "Pendiente"}
                    />
                    <Field
                      label="Dirección fiscal"
                      value={clienteFiscal?.direccion || "Pendiente"}
                    />
                  </>
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle
                icon={<Truck className="h-5 w-5" />}
                title="Entrega y operación"
                text={
                  pedido.requiere_envio
                    ? "Entrega a domicilio"
                    : "Recoge en tienda"
                }
              />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {editando ? (
                  <>
                    <Editable
                      label="Dirección de entrega"
                      value={pedido.direccion || ""}
                      onChange={(value) => actualizar("direccion", value)}
                    />
                    <Editable
                      label="Departamento"
                      value={pedido.departamento_entrega || ""}
                      onChange={(value) =>
                        actualizar("departamento_entrega", value)
                      }
                    />
                    <Editable
                      label="Municipio"
                      value={pedido.municipio_entrega || ""}
                      onChange={(value) =>
                        actualizar("municipio_entrega", value)
                      }
                    />
                    <Editable
                      label="Zona"
                      value={pedido.zona_entrega || ""}
                      onChange={(value) => actualizar("zona_entrega", value)}
                    />
                    <Editable
                      label="Fecha de entrega"
                      type="date"
                      value={pedido.fecha_entrega || ""}
                      onChange={(value) => actualizar("fecha_entrega", value)}
                    />
                    <Editable
                      label="Hora de entrega"
                      value={pedido.hora_entrega || ""}
                      onChange={(value) => actualizar("hora_entrega", value)}
                    />
                  </>
                ) : (
                  <>
                    <Field
                      label="Dirección"
                      value={pedido.direccion || "Recoger en tienda"}
                      wide
                    />
                    <Field
                      label="Ubicación"
                      value={ubicacion || "Sin ubicación registrada"}
                    />
                    <Field
                      label="Responsable"
                      value={pedido.vendedor || "Sin asignar"}
                    />
                    <Field
                      label="Fecha de entrega"
                      value={fecha(pedido.fecha_entrega)}
                    />
                    <Field
                      label="Hora"
                      value={pedido.hora_entrega || "Por confirmar"}
                    />
                  </>
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <SectionTitle
                  icon={<Package className="h-5 w-5" />}
                  title="Productos del pedido"
                  text={`${detalles.length} producto${detalles.length === 1 ? "" : "s"} registrados`}
                />
              </div>
              <div className="divide-y divide-slate-100">
                {detalles.map((detalle, indice) => (
                  <div
                    key={detalle.id || indice}
                    className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {detalle.productos?.nombre || "Producto"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {detalle.cantidad || 0} × {dinero(detalle.precio)}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-base font-black text-slate-950">
                      {dinero(
                        Number(detalle.precio || 0) *
                          Number(detalle.cantidad || 0),
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 px-5 py-4 sm:px-6">
                <div className="ml-auto max-w-xs space-y-2 text-sm">
                  <Line label="Productos" value={dinero(subtotal)} />
                  {envio > 0 && <Line label="Envío" value={dinero(envio)} />}
                  <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-lg font-black text-slate-950">
                    <span>Total</span>
                    <span>{dinero(total)}</span>
                  </div>
                </div>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle
                icon={<ClipboardList className="h-5 w-5" />}
                title="Notas e indicaciones"
                text="Información para producción, reparto y atención."
              />
              {editando ? (
                <textarea
                  value={pedido.observaciones || ""}
                  onChange={(event) =>
                    actualizar("observaciones", event.target.value)
                  }
                  rows={5}
                  className={`${input} mt-5 resize-y`}
                  placeholder="Indicaciones especiales del pedido"
                />
              ) : (
                <p className="mt-5 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {pedido.observaciones || "Sin observaciones."}
                </p>
              )}
            </section>
          </div>
          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-950">Estado del pedido</h2>
              <p className="mt-1 text-xs text-slate-500">Actualiza la operación y el pago sin editar todo el pedido.</p>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold text-slate-600">Pedido<select value={pedido.estado || "Pendiente"} disabled={actualizandoEstado} onChange={(event) => void actualizarEstadoRapido("estado", event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800">{ESTADOS_PEDIDO.map((estado) => <option key={estado}>{estado}</option>)}</select></label>
                <label className="block text-xs font-bold text-slate-600">Pago<select value={pedido.pago_estado || "Pendiente"} disabled={actualizandoEstado || pedido.estado === "Cancelado"} onChange={(event) => void actualizarEstadoRapido("pago_estado", event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 disabled:bg-slate-100">{ESTADOS_PAGO.map((estado) => <option key={estado}>{estado}</option>)}</select></label>
              </div>
              {pedido.estado === "Cancelado" && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">Pedido cancelado: la emisión FEL está bloqueada.</p>}
            </section>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-slate-950 p-5 text-white">
                <div className="flex items-center gap-2">
                  <WalletCards className="h-5 w-5 text-orange-400" />
                  <h2 className="font-bold">Cobro y pagos</h2>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Control de cuenta por cobrar.
                </p>
              </div>
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between rounded-xl bg-rose-50 px-3 py-3">
                  <span className="text-xs font-bold text-rose-700">
                    Saldo pendiente
                  </span>
                  <b className="text-lg text-rose-700">{dinero(saldo)}</b>
                </div>
                {pagos.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    Aún no hay pagos registrados.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pagos.map((pago) => (
                      <div
                        key={pago.id}
                        className="rounded-xl border border-slate-100 p-3"
                      >
                        <div className="flex justify-between gap-3">
                          <b className="text-sm text-slate-900">
                            {dinero(pago.monto)}
                          </b>
                          <span className="text-xs text-slate-500">
                            {fecha(pago.fecha)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {pago.metodo || "Sin método"}
                          {pago.referencia ? ` · ${pago.referencia}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-orange-600 p-5 text-white">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <h2 className="font-bold">Facturación FEL</h2>
                </div>
                <p className="mt-1 text-xs text-orange-100">
                  Estado documental del pedido.
                </p>
              </div>
              <div className="p-5">
                {factura ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <b className="text-sm">
                        {factura.estado || "Factura registrada"}
                      </b>
                    </div>
                    <Field
                      label="Serie y número"
                      value={
                        [factura.serie, factura.numero]
                          .filter(Boolean)
                          .join("-") || "Pendiente"
                      }
                    />
                    <Field
                      label="UUID FEL"
                      value={factura.uuid_fel || "Pendiente"}
                    />
                    <Field
                      label="Emitida"
                      value={
                        factura.emitida_at
                          ? new Date(factura.emitida_at).toLocaleString("es-GT")
                          : "Pendiente"
                      }
                    />
                    {factura.error_fel && (
                      <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                        {factura.error_fel}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Pendiente de emitir
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Se emitirá aquí al conectar un certificador FEL
                      autorizado.
                    </p>
                    <div
                      className={`mt-4 rounded-xl p-3 text-xs font-semibold ${datosFiscalesCompletos ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}
                    >
                      <ShieldCheck className="mr-1 inline h-4 w-4" />{" "}
                      {datosFiscalesCompletos
                        ? "Datos fiscales listos para facturar."
                        : "Faltan NIT, razón social o dirección fiscal."}
                    </div>
                    <button onClick={() => void emitirFEL()} disabled={!pagoConfirmado || !datosFiscalesCompletos || facturando} className="mt-4 w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                      {facturando ? "Preparando factura…" : pagoConfirmado ? "Confirmar y emitir FEL" : "Pendiente de pago"}
                    </button>
                    {pagoConfirmado && datosFiscalesCompletos && <p className="mt-2 text-center text-xs text-slate-500">Se solicitará confirmación antes de emitir el documento fiscal.</p>}
                  </div>
                )}
              </div>
            </section>
            <button
              onClick={enviarWhatsApp}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
            </button>
            <Link
              href="/pedidos/lista"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 hover:border-orange-300 hover:text-orange-700"
            >
              Volver a pedidos <ChevronRight className="h-4 w-4" />
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SectionTitle({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-xl bg-orange-50 p-2 text-orange-600">{icon}</div>
      <div>
        <h2 className="font-bold text-slate-950">{title}</h2>
        <p className="text-xs text-slate-500">{text}</p>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label === "Cobrado" ? "Pagado" : label}
      </p>
      <p className={`mt-2 text-xl font-black ${color}`}>{value}</p>
    </div>
  );
}
function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}
function Editable({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
      />
    </label>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <b className="text-slate-900">{value}</b>
    </div>
  );
}
