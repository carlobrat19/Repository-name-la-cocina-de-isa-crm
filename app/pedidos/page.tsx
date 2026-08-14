"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  MapPin,
  Minus,
  PackagePlus,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type Producto = {
  id: string;
  nombre: string;
  precio_venta?: number | string | null;
};

type ItemCarrito = {
  id: string;
  nombre: string;
  cantidad: number;
  precio: number;
};

type Cliente = {
  id: string;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  nit?: string | null;
  razon_social?: string | null;
  direccion?: string | null;
};

const VENDEDORES = ["REDES", "LUCIA", "CARLO", "ISA", "MONICA", "RENATA"];
const ESTADOS = [
  "Pendiente",
  "Producción",
  "Empaquetado",
  "En Ruta",
  "Entregado",
];

function formatMoney(value: number) {
  return `Q${value.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const details = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return (
      [
        details.message,
        details.details,
        details.hint,
        details.code ? `Código ${details.code}` : "",
      ]
        .filter(Boolean)
        .join(" · ") || "Error desconocido"
    );
  }
  return "Error desconocido";
}

function InputLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-bold text-slate-600">
      {children}
    </label>
  );
}

export default function PedidosPage() {
  const [cliente, setCliente] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [telefono, setTelefono] = useState("");
  const [nit, setNit] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [correoFiscal, setCorreoFiscal] = useState("");
  const [direccionFiscal, setDireccionFiscal] = useState("");
  const [coincidenciasClientes, setCoincidenciasClientes] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [direccion, setDireccion] = useState("");
  const [fechaCreacion, setFechaCreacion] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [estado, setEstado] = useState("Pendiente");
  const [pagoEstado, setPagoEstado] = useState("Pendiente");
  const [formaPago, setFormaPago] = useState("Efectivo");
  const [observaciones, setObservaciones] = useState("");
  const [vendedor, setVendedor] = useState("REDES");
  const [requiereEnvio, setRequiereEnvio] = useState(false);
  const [departamentoEntrega, setDepartamentoEntrega] = useState("");
  const [municipioEntrega, setMunicipioEntrega] = useState("");
  const [zonaEntrega, setZonaEntrega] = useState("");
  const [costoEnvio, setCostoEnvio] = useState(0);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [guardando, setGuardando] = useState(false);

  async function obtenerProductos() {
    setCargandoProductos(true);
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, precio_venta")
      .order("nombre");
    if (error) console.error(error);
    setProductos((data || []) as Producto[]);
    setCargandoProductos(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void obtenerProductos(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function buscarClientes(termino: string) {
    const busqueda = termino.trim();
    if (busqueda.length < 2) {
      setCoincidenciasClientes([]);
      return;
    }
    setBuscandoClientes(true);
    const patron = `%${busqueda.replace(/[%_]/g, "")}%`;
    const [porNombre, porTelefono] = await Promise.all([
      supabase.from("clientes").select("id, nombre, telefono, email, nit, razon_social, direccion").ilike("nombre", patron).limit(6),
      supabase.from("clientes").select("id, nombre, telefono, email, nit, razon_social, direccion").ilike("telefono", patron).limit(6),
    ]);
    if (porNombre.error || porTelefono.error) {
      console.error(porNombre.error || porTelefono.error);
      setCoincidenciasClientes([]);
    } else {
      setCoincidenciasClientes(Array.from(new Map([...(porNombre.data || []), ...(porTelefono.data || [])].map((item) => [item.id, item])).values()) as Cliente[]);
    }
    setBuscandoClientes(false);
  }

  function seleccionarCliente(clienteExistente: Cliente) {
    setClienteId(clienteExistente.id);
    setCliente(clienteExistente.nombre || "");
    setTelefono(clienteExistente.telefono || "");
    setNit(clienteExistente.nit || "");
    setRazonSocial(clienteExistente.razon_social || "");
    setCorreoFiscal(clienteExistente.email || "");
    setDireccionFiscal(clienteExistente.direccion || "");
    setCoincidenciasClientes([]);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void buscarClientes(cliente), 250);
    return () => window.clearTimeout(timeout);
  }, [cliente]);

  const productoActual = useMemo(
    () => productos.find((producto) => producto.id === productoSeleccionado),
    [productos, productoSeleccionado],
  );
  const subtotalProductos = useMemo(
    () =>
      carrito.reduce((total, item) => total + item.precio * item.cantidad, 0),
    [carrito],
  );
  const totalPedido = subtotalProductos + (requiereEnvio ? costoEnvio : 0);
  const totalUnidades = useMemo(
    () => carrito.reduce((total, item) => total + item.cantidad, 0),
    [carrito],
  );

  function agregarProducto() {
    if (!productoActual) {
      alert("Selecciona un producto antes de agregarlo.");
      return;
    }
    const unidades = Math.max(1, Number(cantidad) || 1);
    const precio = Number(productoActual.precio_venta || 0);
    setCarrito((anterior) => {
      const existente = anterior.find((item) => item.id === productoActual.id);
      if (existente)
        return anterior.map((item) =>
          item.id === productoActual.id
            ? { ...item, cantidad: item.cantidad + unidades }
            : item,
        );
      return [
        ...anterior,
        {
          id: productoActual.id,
          nombre: productoActual.nombre,
          cantidad: unidades,
          precio,
        },
      ];
    });
    setProductoSeleccionado("");
    setCantidad(1);
  }

  function cambiarCantidad(id: string, cambio: number) {
    setCarrito((anterior) =>
      anterior.map((item) =>
        item.id === id
          ? { ...item, cantidad: Math.max(1, item.cantidad + cambio) }
          : item,
      ),
    );
  }

  function eliminarProducto(id: string) {
    setCarrito((anterior) => anterior.filter((item) => item.id !== id));
  }

  function limpiarFormulario() {
    setCliente("");
    setClienteId(null);
    setTelefono("");
    setNit("");
    setRazonSocial("");
    setCorreoFiscal("");
    setDireccionFiscal("");
    setCoincidenciasClientes([]);
    setDireccion("");
    setFechaCreacion(new Date().toISOString().slice(0, 10));
    setFechaEntrega("");
    setEstado("Pendiente");
    setPagoEstado("Pendiente");
    setFormaPago("Efectivo");
    setObservaciones("");
    setVendedor("REDES");
    setRequiereEnvio(false);
    setDepartamentoEntrega("");
    setMunicipioEntrega("");
    setZonaEntrega("");
    setCostoEnvio(0);
    setProductoSeleccionado("");
    setCantidad(1);
    setCarrito([]);
  }

  async function guardarPedido() {
    if (!cliente.trim()) {
      alert("Ingresa el nombre del cliente.");
      return;
    }
    if (carrito.length === 0) {
      alert("Agrega al menos un producto al pedido.");
      return;
    }
    if (requiereEnvio && !direccion.trim()) {
      alert("Ingresa la dirección para el envío.");
      return;
    }
    if (
      requiereEnvio &&
      (!departamentoEntrega.trim() ||
        !municipioEntrega.trim() ||
        !zonaEntrega.trim())
    ) {
      alert("Completa departamento, municipio y zona de entrega.");
      return;
    }
    setGuardando(true);
    try {
      const abonoInicial = pagoEstado === "Pago parcial" ? Number(window.prompt(`Abono inicial (total ${formatMoney(totalPedido)}):`, "") || 0) : pagoEstado === "Pagado" ? totalPedido : 0;
      if (pagoEstado === "Pago parcial" && (!Number.isFinite(abonoInicial) || abonoInicial <= 0 || abonoInicial >= totalPedido)) throw new Error("Ingresa un abono válido menor al total");
      let clientePedidoId = clienteId;
      let clienteExistente: Cliente | null = null;
      if (!clientePedidoId) {
        const coincidencias = await Promise.all([
          telefono.trim() ? supabase.from("clientes").select("id, nombre, telefono, email, nit, razon_social, direccion").eq("telefono", telefono.trim()).maybeSingle() : Promise.resolve({ data: null, error: null }),
          nit.trim() ? supabase.from("clientes").select("id, nombre, telefono, email, nit, razon_social, direccion").eq("nit", nit.trim()).maybeSingle() : Promise.resolve({ data: null, error: null }),
          supabase.from("clientes").select("id, nombre, telefono, email, nit, razon_social, direccion").ilike("nombre", cliente.trim()).maybeSingle(),
        ]);
        const error = coincidencias.find((resultado) => resultado.error)?.error;
        if (error) throw error;
        clienteExistente = (coincidencias.find((resultado) => resultado.data)?.data || null) as Cliente | null;
        clientePedidoId = clienteExistente?.id || null;
      }
      const datosCliente = {
        nombre: cliente.trim(), telefono: telefono.trim() || null, email: correoFiscal.trim() || null, nit: nit.trim() || null,
        razon_social: razonSocial.trim() || null, direccion: direccionFiscal.trim() || null, canal_origen: "Manual",
      };
      if (clientePedidoId) {
        const { error } = await supabase.from("clientes").update(datosCliente).eq("id", clientePedidoId);
        if (error) throw error;
      } else {
        const { data: clienteNuevo, error } = await supabase
          .from("clientes")
          .insert(datosCliente)
          .select("id")
          .single();
        if (error) throw error;
        clientePedidoId = clienteNuevo.id;
      }

      const { data: pedidoData, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          cliente: cliente.trim(),
          telefono: telefono.trim() || null,
          direccion: direccion.trim() || null,
          fecha_pedido: fechaCreacion || null,
          fecha_entrega: fechaEntrega || null,
          estado,
          pago_estado: pagoEstado,
          forma_pago: formaPago,
          total: totalPedido,
          subtotal_productos: subtotalProductos,
          costo_envio: requiereEnvio ? costoEnvio : 0,
          departamento_entrega: requiereEnvio
            ? departamentoEntrega.trim() || null
            : null,
          municipio_entrega: requiereEnvio
            ? municipioEntrega.trim() || null
            : null,
          zona_entrega: requiereEnvio ? zonaEntrega.trim() || null : null,
          cliente_id: clientePedidoId,
          saldo_pendiente: Math.max(0, totalPedido - abonoInicial),
          canal_origen: "Manual",
          observaciones: observaciones.trim() || null,
          vendedor,
          requiere_envio: requiereEnvio,
          codigo: "",
        })
        .select("id, numero_pedido")
        .single();
      if (pedidoError) throw pedidoError;

      const codigoERP = `PED-${String(pedidoData.numero_pedido).padStart(4, "0")}`;
      const { error: codigoError } = await supabase
        .from("pedidos")
        .update({ codigo: codigoERP })
        .eq("id", pedidoData.id);
      if (codigoError) throw codigoError;

      const { error: detalleError } = await supabase
        .from("pedido_detalle")
        .insert(
          carrito.map((item) => ({
            pedido_id: pedidoData.id,
            producto_id: item.id,
            cantidad: item.cantidad,
            precio: item.precio,
            costo: item.precio * item.cantidad,
          })),
        );
      if (detalleError) throw detalleError;

      if (abonoInicial > 0) {
        const { error } = await supabase
          .from("pagos")
          .insert({
            pedido_id: pedidoData.id,
          cliente_id: clientePedidoId,
            monto: abonoInicial,
            metodo: formaPago,
          });
        if (error) throw error;
      }
      const { error: inventarioError } = await supabase
        .from("movimientos_inventario")
        .insert(
          carrito.map((item) => ({
            producto_id: item.id,
            pedido_id: pedidoData.id,
            tipo: "Salida",
            cantidad: -item.cantidad,
            costo_unitario: item.precio,
            motivo: `Venta ${codigoERP}`,
          })),
        );
      if (inventarioError) throw inventarioError;

      alert(`Pedido ${codigoERP} guardado correctamente.`);
      limpiarFormulario();
    } catch (error) {
      console.error(error);
      alert(`No se pudo guardar: ${errorMessage(error)}`);
    } finally {
      setGuardando(false);
    }
  }

  const fieldClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100";

  return (
    <main className="min-h-screen bg-[#f7f7f8] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/pedidos/lista"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 transition hover:text-orange-600"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver a pedidos
            </Link>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
              Operación comercial
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Nuevo pedido
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Registra la venta y coordina la entrega desde un solo flujo.
            </p>
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            <span className="font-bold">{carrito.length}</span> producto
            {carrito.length === 1 ? "" : "s"} ·{" "}
            <span className="font-bold">{totalUnidades}</span> unidad
            {totalUnidades === 1 ? "" : "es"}
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-950">
                    Información del cliente
                  </h2>
                  <p className="text-xs text-slate-500">
                    Datos necesarios para registrar y entregar el pedido.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <InputLabel>
                    Nombre del cliente{" "}
                    <span className="text-orange-600">*</span>
                  </InputLabel>
                  <input
                    value={cliente}
                    onChange={(event) => { setCliente(event.target.value); setClienteId(null); }}
                    onFocus={() => void buscarClientes(cliente)}
                    placeholder="Busca por nombre o teléfono"
                    autoComplete="off"
                    className={fieldClass}
                  />
                  {(buscandoClientes || coincidenciasClientes.length > 0) && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">{buscandoClientes ? <p className="px-3 py-3 text-xs text-slate-500">Buscando clientes…</p> : coincidenciasClientes.map((clienteExistente) => <button key={clienteExistente.id} type="button" onMouseDown={(event) => { event.preventDefault(); seleccionarCliente(clienteExistente); }} className="block w-full border-b border-slate-100 px-3 py-3 text-left last:border-0 hover:bg-orange-50"><span className="block text-sm font-bold text-slate-900">{clienteExistente.nombre}</span><span className="mt-0.5 block text-xs text-slate-500">{clienteExistente.telefono || "Sin teléfono"}{clienteExistente.nit ? ` · NIT ${clienteExistente.nit}` : ""}</span></button>)}</div>}
                </div>
                <div>
                  <InputLabel>Teléfono</InputLabel>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      value={telefono}
                      onChange={(event) => setTelefono(event.target.value)}
                      placeholder="Ej. 5555 5555"
                      className={`${fieldClass} pl-9`}
                    />
                  </div>
                </div>
                <div>
                  <InputLabel>NIT / CF</InputLabel>
                  <input value={nit} onChange={(event) => { setNit(event.target.value); setClienteId(null); }} placeholder="CF o NIT para facturar" className={fieldClass} />
                </div>
                <div>
                  <InputLabel>Razón social / nombre en factura</InputLabel>
                  <input value={razonSocial} onChange={(event) => setRazonSocial(event.target.value)} placeholder="Nombre que llevará la factura" className={fieldClass} />
                </div>
                <div>
                  <InputLabel>Correo para factura</InputLabel>
                  <input type="email" value={correoFiscal} onChange={(event) => setCorreoFiscal(event.target.value)} placeholder="correo@cliente.com" className={fieldClass} />
                </div>
                <div>
                  <InputLabel>Dirección fiscal</InputLabel>
                  <input value={direccionFiscal} onChange={(event) => setDireccionFiscal(event.target.value)} placeholder="Dirección para FEL" className={fieldClass} />
                </div>
              </div>
              {clienteId && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Cliente existente seleccionado. Sus datos se actualizarán al guardar el pedido.</p>}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                  <PackagePlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-950">
                    Agregar productos
                  </h2>
                  <p className="text-xs text-slate-500">
                    Selecciona un producto y define la cantidad.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_130px_auto]">
                <div>
                  <InputLabel>Producto</InputLabel>
                  <div className="relative">
                    <select
                      value={productoSeleccionado}
                      onChange={(event) =>
                        setProductoSeleccionado(event.target.value)
                      }
                      disabled={cargandoProductos}
                      className={`${fieldClass} appearance-none pr-9 disabled:cursor-wait`}
                    >
                      <option value="">
                        {cargandoProductos
                          ? "Cargando productos…"
                          : "Seleccionar producto"}
                      </option>
                      {productos.map((producto) => (
                        <option key={producto.id} value={producto.id}>
                          {producto.nombre} ·{" "}
                          {formatMoney(Number(producto.precio_venta || 0))}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-9 h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <div>
                  <InputLabel>Cantidad</InputLabel>
                  <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() =>
                        setCantidad((actual) => Math.max(1, actual - 1))
                      }
                      className="px-3 text-slate-500 hover:bg-slate-100"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={cantidad}
                      onChange={(event) =>
                        setCantidad(Math.max(1, Number(event.target.value)))
                      }
                      className="min-w-0 w-full bg-transparent text-center text-sm font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCantidad((actual) => actual + 1)}
                      className="px-3 text-slate-500 hover:bg-slate-100"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={agregarProducto}
                  className="mt-[26px] inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-orange-600"
                >
                  <Plus className="h-4 w-4" /> Agregar
                </button>
              </div>
              {productoActual && (
                <p className="mt-3 text-xs font-semibold text-emerald-700">
                  Precio seleccionado:{" "}
                  {formatMoney(Number(productoActual.precio_venta || 0))}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-950">
                    Entrega y responsable
                  </h2>
                  <p className="text-xs text-slate-500">
                    Define cómo se gestionará este pedido.
                  </p>
                </div>
              </div>
              <div className="mb-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRequiereEnvio(false)}
                  className={`rounded-xl border p-3 text-left transition ${!requiereEnvio ? "border-orange-400 bg-orange-50 ring-2 ring-orange-100" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <span className="block text-sm font-bold text-slate-900">
                    Recoger en tienda
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    El cliente recoge su pedido.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequiereEnvio(true)}
                  className={`rounded-xl border p-3 text-left transition ${requiereEnvio ? "border-orange-400 bg-orange-50 ring-2 ring-orange-100" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <span className="block text-sm font-bold text-slate-900">
                    Requiere envío
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Coordinar dirección y entrega.
                  </span>
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <InputLabel>
                    Dirección{" "}
                    {requiereEnvio && (
                      <span className="text-orange-600">*</span>
                    )}
                  </InputLabel>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      value={direccion}
                      onChange={(event) => setDireccion(event.target.value)}
                      placeholder={
                        requiereEnvio
                          ? "Dirección completa de entrega"
                          : "Opcional: dirección del cliente"
                      }
                      className={`${fieldClass} pl-9`}
                    />
                  </div>
                </div>
                {requiereEnvio && (
                  <>
                    <div>
                      <InputLabel>
                        Departamento <span className="text-orange-600">*</span>
                      </InputLabel>
                      <input
                        value={departamentoEntrega}
                        onChange={(event) =>
                          setDepartamentoEntrega(event.target.value)
                        }
                        placeholder="Ej. Guatemala"
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <InputLabel>
                        Municipio <span className="text-orange-600">*</span>
                      </InputLabel>
                      <input
                        value={municipioEntrega}
                        onChange={(event) =>
                          setMunicipioEntrega(event.target.value)
                        }
                        placeholder="Ej. Mixco"
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <InputLabel>
                        Zona <span className="text-orange-600">*</span>
                      </InputLabel>
                      <input
                        value={zonaEntrega}
                        onChange={(event) => setZonaEntrega(event.target.value)}
                        placeholder="Ej. Zona 1"
                        className={fieldClass}
                      />
                    </div>
                  </>
                )}
                <div>
                  <InputLabel>Fecha de pedido</InputLabel>
                  <input
                    type="date"
                    value={fechaCreacion}
                    onChange={(event) => setFechaCreacion(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <InputLabel>Fecha de entrega</InputLabel>
                  <input
                    type="date"
                    value={fechaEntrega}
                    onChange={(event) => setFechaEntrega(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <InputLabel>Vendedor responsable</InputLabel>
                  <select
                    value={vendedor}
                    onChange={(event) => setVendedor(event.target.value)}
                    className={fieldClass}
                  >
                    {VENDEDORES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <InputLabel>Estado inicial</InputLabel>
                  <select
                    value={estado}
                    onChange={(event) => setEstado(event.target.value)}
                    className={fieldClass}
                  >
                    {ESTADOS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-950">Pago y notas</h2>
                  <p className="text-xs text-slate-500">
                    Registra cómo se cobrará y cualquier indicación especial.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <InputLabel>Estado de pago</InputLabel>
                  <select
                    value={pagoEstado}
                    onChange={(event) => setPagoEstado(event.target.value)}
                    className={fieldClass}
                  >
                    <option>Pendiente</option>
                    <option>Pagado</option>
                  </select>
                </div>
                <div>
                  <InputLabel>Forma de pago</InputLabel>
                  <select
                    value={formaPago}
                    onChange={(event) => setFormaPago(event.target.value)}
                    className={fieldClass}
                  >
                    <option>Efectivo</option>
                    <option>Transferencia</option>
                    <option>Tarjeta</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <InputLabel>Observaciones</InputLabel>
                  <textarea
                    value={observaciones}
                    onChange={(event) => setObservaciones(event.target.value)}
                    rows={4}
                    placeholder="Ej. Sin nuez, llamar antes de llegar, mensaje especial…"
                    className={`${fieldClass} resize-y`}
                  />
                </div>
              </div>
            </section>
            {requiereEnvio && (
              <section className="rounded-2xl border border-orange-200 bg-orange-50/40 p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-orange-100 p-2.5 text-orange-700">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-950">Costo de envío</h2>
                    <p className="text-xs text-slate-600">
                      Escribe manualmente el valor que cobrarás por la entrega.
                    </p>
                  </div>
                </div>
                <div className="max-w-sm">
                  <InputLabel>Costo de envío</InputLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-2.5 text-sm font-bold text-slate-500">
                      Q
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={costoEnvio || ""}
                      onChange={(event) =>
                        setCostoEnvio(
                          Math.max(0, Number(event.target.value) || 0),
                        )
                      }
                      placeholder="0.00"
                      className={`${fieldClass} pl-7`}
                    />
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-slate-950 px-5 py-5 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-orange-400" />
                    <h2 className="font-bold">Resumen del pedido</h2>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">
                    {totalUnidades} uds.
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Revisa antes de guardar.
                </p>
              </div>
              <div className="max-h-[48vh] divide-y divide-slate-100 overflow-y-auto">
                {carrito.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-600">
                      Tu carrito está vacío
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Agrega productos para iniciar el pedido.
                    </p>
                  </div>
                ) : (
                  carrito.map((item) => (
                    <div key={item.id} className="px-5 py-4">
                      <div className="flex gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {item.nombre}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatMoney(item.precio)} c/u
                          </p>
                        </div>
                        <p className="whitespace-nowrap text-sm font-black text-slate-900">
                          {formatMoney(item.precio * item.cantidad)}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(item.id, -1)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-slate-700">
                            {item.cantidad}
                          </span>
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(item.id, 1)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => eliminarProducto(item.id)}
                          aria-label={`Eliminar ${item.nombre}`}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-slate-200 bg-slate-50 p-5">
                <div className="space-y-2 border-b border-slate-200 pb-4 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Productos</span>
                    <span className="font-bold text-slate-900">
                      {formatMoney(subtotalProductos)}
                    </span>
                  </div>
                  {requiereEnvio && (
                    <div className="flex justify-between text-slate-600">
                      <span>
                        Envío
                        {departamentoEntrega ? ` · ${departamentoEntrega}` : ""}
                        {municipioEntrega ? `, ${municipioEntrega}` : ""}
                        {zonaEntrega ? `, ${zonaEntrega}` : ""}
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatMoney(costoEnvio)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Total a cobrar
                    </p>
                    <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                      {formatMoney(totalPedido)}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${pagoEstado === "Pagado" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {pagoEstado}
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-orange-500" />{" "}
                    {fechaEntrega
                      ? `Entrega: ${fechaEntrega}`
                      : "Fecha de entrega por definir"}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-orange-500" />{" "}
                    {requiereEnvio
                      ? "Con envío a domicilio"
                      : "Recoge en tienda"}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={guardando || carrito.length === 0}
                  onClick={() => void guardarPedido()}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  {guardando ? (
                    "Guardando pedido…"
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Guardar pedido ·{" "}
                      {formatMoney(totalPedido)}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  disabled={guardando}
                  className="mt-2 w-full py-2 text-xs font-bold text-slate-500 transition hover:text-rose-600 disabled:opacity-50"
                >
                  Limpiar formulario
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
