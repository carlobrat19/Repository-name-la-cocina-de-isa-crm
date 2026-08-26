"use client";

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Cake,
  Check,
  ClipboardList,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { CANALES, Cliente, moneda } from "@/lib/crm";
import { supabase } from "@/lib/supabase";

type Direccion = {
  id: string;
  etiqueta: string;
  direccion: string;
  departamento?: string | null;
  municipio?: string | null;
  zona?: string | null;
  referencia?: string | null;
  principal: boolean;
};
type FormCliente = {
  nombre: string;
  telefono: string;
  email: string;
  nit: string;
  razon_social: string;
  canal_origen: string;
  estado: string;
  fecha_nacimiento: string;
  notas: string;
  direccion: string;
  departamento: string;
  municipio: string;
  zona: string;
  referencia: string;
};
type PedidoCliente = {
  id: string;
  codigo: string;
  fecha_pedido: string | null;
  fecha_entrega: string | null;
  estado: string;
  pago_estado: string | null;
  total: number | string;
  saldo_pendiente: number | string;
  canal_origen: string | null;
  pedido_detalle: {
    cantidad: number | string;
    precio: number | string;
    productos: { nombre: string } | null;
  }[];
};
type ConversacionCliente = {
  id: string;
  canal: string;
  estado: string;
  ultimo_mensaje: string | null;
  ultimo_mensaje_at: string | null;
  created_at: string;
};
const nuevoFormulario: FormCliente = {
  nombre: "",
  telefono: "",
  email: "",
  nit: "",
  razon_social: "",
  canal_origen: "Manual",
  estado: "Activo",
  fecha_nacimiento: "",
  notas: "",
  direccion: "",
  departamento: "",
  municipio: "",
  zona: "",
  referencia: "",
};
const campo =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [direcciones, setDirecciones] = useState<Record<string, Direccion[]>>(
    {},
  );
  const [form, setForm] = useState<FormCliente>(nuevoFormulario);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const [canalFiltro, setCanalFiltro] = useState("Todos");
  const [estadoFiltro, setEstadoFiltro] = useState("Activos");
  const [fiscalFiltro, setFiscalFiltro] = useState("Todos");
  const [cumpleFiltro, setCumpleFiltro] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clienteFicha, setClienteFicha] = useState<Cliente | null>(null);
  const [pedidosFicha, setPedidosFicha] = useState<PedidoCliente[]>([]);
  const [conversacionesFicha, setConversacionesFicha] = useState<
    ConversacionCliente[]
  >([]);
  const [cargandoFicha, setCargandoFicha] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [clientesRespuesta, direccionesRespuesta] = await Promise.all([
      supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("cliente_direcciones")
        .select(
          "id, cliente_id, etiqueta, direccion, departamento, municipio, zona, referencia, principal",
        )
        .order("principal", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    if (clientesRespuesta.error || direccionesRespuesta.error)
      alert(
        `No se pudo cargar: ${(clientesRespuesta.error || direccionesRespuesta.error)?.message}`,
      );
    setClientes((clientesRespuesta.data || []) as Cliente[]);
    const agrupadas: Record<string, Direccion[]> = {};
    for (const direccion of (direccionesRespuesta.data || []) as (Direccion & {
      cliente_id: string;
    })[])
      (agrupadas[direccion.cliente_id] ||= []).push(direccion);
    setDirecciones(agrupadas);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, [cargar]);
  const cambiar = (campoForm: keyof FormCliente, valor: string) =>
    setForm((actual) => ({ ...actual, [campoForm]: valor }));
  function limpiar() {
    setEditandoId(null);
    setForm(nuevoFormulario);
  }
  function editar(cliente: Cliente) {
    const principal =
      (direcciones[cliente.id] || []).find(
        (direccion) => direccion.principal,
      ) || direcciones[cliente.id]?.[0];
    setEditandoId(cliente.id);
    setForm({
      nombre: cliente.nombre || "",
      telefono: cliente.telefono || "",
      email: cliente.email || "",
      nit: cliente.nit || "",
      razon_social: cliente.razon_social || "",
      canal_origen: cliente.canal_origen || "Manual",
      estado: (cliente as Cliente & { estado?: string }).estado || "Activo",
      fecha_nacimiento: cliente.fecha_nacimiento || "",
      notas: cliente.notas || "",
      direccion: principal?.direccion || "",
      departamento: principal?.departamento || "",
      municipio: principal?.municipio || "",
      zona: principal?.zona || "",
      referencia: principal?.referencia || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    const datosCliente = {
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      nit: form.nit.trim() || null,
      razon_social: form.razon_social.trim() || null,
      canal_origen: form.canal_origen,
      estado: form.estado,
      fecha_nacimiento: form.fecha_nacimiento || null,
      notas: form.notas.trim() || null,
    };
    const respuesta = editandoId
      ? await supabase
          .from("clientes")
          .update(datosCliente)
          .eq("id", editandoId)
          .select("id")
          .single()
      : await supabase
          .from("clientes")
          .insert(datosCliente)
          .select("id")
          .single();
    if (respuesta.error || !respuesta.data) {
      setSaving(false);
      alert(
        `No se pudo guardar: ${respuesta.error?.message || "Error desconocido"}`,
      );
      return;
    }
    const clienteId = respuesta.data.id;
    if (form.direccion.trim()) {
      const direccionActual =
        (direcciones[clienteId] || []).find(
          (direccion) => direccion.principal,
        ) || direcciones[clienteId]?.[0];
      const datosDireccion = {
        cliente_id: clienteId,
        etiqueta: "Principal",
        direccion: form.direccion.trim(),
        departamento: form.departamento.trim() || null,
        municipio: form.municipio.trim() || null,
        zona: form.zona.trim() || null,
        referencia: form.referencia.trim() || null,
        principal: true,
      };
      const direccionRespuesta = direccionActual
        ? await supabase
            .from("cliente_direcciones")
            .update(datosDireccion)
            .eq("id", direccionActual.id)
        : await supabase.from("cliente_direcciones").insert(datosDireccion);
      if (direccionRespuesta.error) {
        setSaving(false);
        alert(
          `Cliente guardado, pero no su dirección: ${direccionRespuesta.error.message}`,
        );
        return;
      }
    }
    setSaving(false);
    limpiar();
    await cargar();
  }

  async function abrirFicha(cliente: Cliente) {
    setClienteFicha(cliente);
    setPedidosFicha([]);
    setConversacionesFicha([]);
    setCargandoFicha(true);
    const [pedidosRespuesta, conversacionesRespuesta] = await Promise.all([
      supabase
        .from("pedidos")
        .select(
          "id, codigo, fecha_pedido, fecha_entrega, estado, pago_estado, total, saldo_pendiente, canal_origen, pedido_detalle(cantidad, precio, productos(nombre))",
        )
        .eq("cliente_id", cliente.id)
        .order("fecha_pedido", { ascending: false })
        .limit(100),
      supabase
        .from("conversaciones")
        .select(
          "id, canal, estado, ultimo_mensaje, ultimo_mensaje_at, created_at",
        )
        .eq("cliente_id", cliente.id)
        .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false })
        .limit(50),
    ]);
    setCargandoFicha(false);
    if (pedidosRespuesta.error || conversacionesRespuesta.error) {
      alert(
        `No se pudo cargar la ficha: ${(pedidosRespuesta.error || conversacionesRespuesta.error)?.message}`,
      );
      return;
    }
    setPedidosFicha(
      (pedidosRespuesta.data || []) as unknown as PedidoCliente[],
    );
    setConversacionesFicha(
      (conversacionesRespuesta.data || []) as ConversacionCliente[],
    );
  }

  async function eliminarCliente(cliente: Cliente) {
    const confirmar = window.confirm(
      `¿Eliminar a ${cliente.nombre}? Solo se puede borrar si no tiene pedidos, pagos, cotizaciones ni conversaciones.`,
    );
    if (!confirmar) return;
    const { error } = await supabase.rpc("eliminar_cliente_seguro", {
      p_cliente_id: cliente.id,
    });
    if (error) {
      alert(
        `No se pudo eliminar: ${error.message}. Si ya tiene historial, desactívalo para conservar su trazabilidad.`,
      );
      return;
    }
    if (clienteFicha?.id === cliente.id) setClienteFicha(null);
    await cargar();
  }

  const mesActual = String(new Date().getMonth() + 1).padStart(2, "0");

  const filtrados = useMemo(
    () =>
      clientes.filter((cliente) => {
        const texto =
          `${cliente.nombre} ${cliente.telefono || ""} ${cliente.email || ""} ${cliente.nit || ""}`.toLowerCase();
        const estado =
          (cliente as Cliente & { estado?: string }).estado || "Activo";
        return (
          texto.includes(buscar.toLowerCase()) &&
          (canalFiltro === "Todos" || cliente.canal_origen === canalFiltro) &&
          (estadoFiltro === "Todos" ||
            (estadoFiltro === "Activos"
              ? estado === "Activo"
              : estado !== "Activo")) &&
          (fiscalFiltro === "Todos" ||
            (fiscalFiltro === "Con NIT"
              ? Boolean(cliente.nit)
              : !cliente.nit)) &&
          (cumpleFiltro === "Todos" ||
            (cumpleFiltro === "Con fecha"
              ? Boolean(cliente.fecha_nacimiento)
              : cliente.fecha_nacimiento?.slice(5, 7) === mesActual))
        );
      }),
    [
      clientes,
      buscar,
      canalFiltro,
      estadoFiltro,
      fiscalFiltro,
      cumpleFiltro,
      mesActual,
    ],
  );

  const clientesActivos = clientes.filter(
    (cliente) => cliente.estado !== "Inactivo",
  ).length;
  const cumpleanerosEsteMes = clientes.filter(
    (cliente) => cliente.fecha_nacimiento?.slice(5, 7) === mesActual,
  ).length;
  const productosMasComprados = useMemo(() => {
    const acumulados = new Map<
      string,
      { nombre: string; cantidad: number; monto: number }
    >();
    for (const pedido of pedidosFicha) {
      for (const item of pedido.pedido_detalle || []) {
        const nombre = item.productos?.nombre || "Producto sin nombre";
        const actual = acumulados.get(nombre) || {
          nombre,
          cantidad: 0,
          monto: 0,
        };
        actual.cantidad += Number(item.cantidad || 0);
        actual.monto += Number(item.cantidad || 0) * Number(item.precio || 0);
        acumulados.set(nombre, actual);
      }
    }
    return [...acumulados.values()]
      .sort((a, b) => b.cantidad - a.cantidad || b.monto - a.monto)
      .slice(0, 5);
  }, [pedidosFicha]);
  const totalHistoricoFicha = pedidosFicha.reduce(
    (total, pedido) => total + Number(pedido.total || 0),
    0,
  );
  const saldoFicha = pedidosFicha.reduce(
    (total, pedido) => total + Number(pedido.saldo_pendiente || 0),
    0,
  );
  const fechaCorta = (valor?: string | null) =>
    valor
      ? new Intl.DateTimeFormat("es-GT", { dateStyle: "medium" }).format(
          new Date(`${valor.slice(0, 10)}T00:00:00`),
        )
      : "Sin fecha";

  return (
    <section className="space-y-7 p-6 md:p-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">
            CRM comercial
          </p>
          <h1 className="mt-1 text-4xl font-black text-slate-950">Clientes</h1>
          <p className="mt-2 text-slate-500">
            Datos comerciales, facturación y direcciones listas para tomar
            pedidos.
          </p>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm">
          <div className="px-4 py-3">
            <p className="text-xs text-slate-300">Registrados</p>
            <p className="text-xl font-black">{clientes.length}</p>
          </div>
          <div className="border-x border-slate-700 px-4 py-3">
            <p className="text-xs text-slate-300">Activos</p>
            <p className="text-xl font-black text-emerald-300">
              {clientesActivos}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-slate-300">Cumplen este mes</p>
            <p className="text-xl font-black text-orange-300">
              {cumpleanerosEsteMes}
            </p>
          </div>
        </div>
      </header>
      <div className="grid gap-6 xl:grid-cols-[410px_minmax(0,1fr)]">
        <form
          onSubmit={guardar}
          className="h-fit space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
              {editandoId ? <Pencil size={20} /> : <Plus size={20} />}{" "}
              {editandoId ? "Editar cliente" : "Nuevo cliente"}
            </h2>
            {editandoId && (
              <button
                type="button"
                onClick={limpiar}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <input
            required
            placeholder="Nombre o razón comercial *"
            value={form.nombre}
            onChange={(e) => cambiar("nombre", e.target.value)}
            className={campo}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <input
              placeholder="WhatsApp / teléfono"
              value={form.telefono}
              onChange={(e) => cambiar("telefono", e.target.value)}
              className={campo}
            />
            <input
              type="email"
              placeholder="Correo"
              value={form.email}
              onChange={(e) => cambiar("email", e.target.value)}
              className={campo}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <input
              placeholder="NIT"
              value={form.nit}
              onChange={(e) => cambiar("nit", e.target.value)}
              className={campo}
            />
            <input
              placeholder="Razón social para FEL"
              value={form.razon_social}
              onChange={(e) => cambiar("razon_social", e.target.value)}
              className={campo}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.canal_origen}
              onChange={(e) => cambiar("canal_origen", e.target.value)}
              className={campo}
            >
              {CANALES.map((canal) => (
                <option key={canal}>{canal}</option>
              ))}
            </select>
            <select
              value={form.estado}
              onChange={(e) => cambiar("estado", e.target.value)}
              className={campo}
            >
              <option>Activo</option>
              <option>Inactivo</option>
            </select>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Fecha de nacimiento{" "}
            <span className="font-normal text-slate-400">(opcional)</span>
            <input
              type="date"
              value={form.fecha_nacimiento}
              onChange={(e) => cambiar("fecha_nacimiento", e.target.value)}
              className={`${campo} mt-1.5`}
            />
          </label>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
              <MapPin className="h-4 w-4 text-orange-600" /> Dirección principal
            </p>
            <textarea
              placeholder="Dirección completa de entrega"
              value={form.direccion}
              onChange={(e) => cambiar("direccion", e.target.value)}
              className={`${campo} min-h-20 resize-y`}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <input
                placeholder="Departamento"
                value={form.departamento}
                onChange={(e) => cambiar("departamento", e.target.value)}
                className={campo}
              />
              <input
                placeholder="Municipio"
                value={form.municipio}
                onChange={(e) => cambiar("municipio", e.target.value)}
                className={campo}
              />
              <input
                placeholder="Zona"
                value={form.zona}
                onChange={(e) => cambiar("zona", e.target.value)}
                className={campo}
              />
            </div>
            <input
              placeholder="Referencia (opcional)"
              value={form.referencia}
              onChange={(e) => cambiar("referencia", e.target.value)}
              className={`${campo} mt-3`}
            />
          </div>
          <textarea
            placeholder="Notas internas"
            value={form.notas}
            onChange={(e) => cambiar("notas", e.target.value)}
            className={`${campo} min-h-20 resize-y`}
          />
          <button
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 p-3 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            <Check size={17} />
            {saving
              ? "Guardando…"
              : editandoId
                ? "Guardar cambios"
                : "Crear cliente"}
          </button>
        </form>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 border-b p-5">
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar por nombre, teléfono, correo o NIT"
                className="w-full border-0 bg-transparent p-3 outline-none"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <select
                value={canalFiltro}
                onChange={(e) => setCanalFiltro(e.target.value)}
                className={campo}
              >
                <option>Todos</option>
                {CANALES.map((canal) => (
                  <option key={canal}>{canal}</option>
                ))}
              </select>
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className={campo}
              >
                <option>Activos</option>
                <option>Inactivos</option>
                <option>Todos</option>
              </select>
              <select
                value={fiscalFiltro}
                onChange={(e) => setFiscalFiltro(e.target.value)}
                className={campo}
              >
                <option>Todos</option>
                <option>Con NIT</option>
                <option>Sin NIT</option>
              </select>
              <select
                value={cumpleFiltro}
                onChange={(e) => setCumpleFiltro(e.target.value)}
                className={campo}
              >
                <option>Todos</option>
                <option>Con fecha</option>
                <option>Este mes</option>
              </select>
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {filtrados.length} cliente{filtrados.length === 1 ? "" : "s"}{" "}
              encontrado{filtrados.length === 1 ? "" : "s"}
            </p>
          </div>
          {loading ? (
            <p className="p-8 text-slate-500">Cargando clientes…</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtrados.map((cliente) => {
                const principal =
                  (direcciones[cliente.id] || []).find(
                    (direccion) => direccion.principal,
                  ) || direcciones[cliente.id]?.[0];
                return (
                  <article
                    key={cliente.id}
                    className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-black text-slate-950">
                          {cliente.nombre}
                        </h2>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                          {(cliente as Cliente & { estado?: string }).estado ||
                            "Activo"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {cliente.telefono || "Sin teléfono"}
                        {cliente.email ? ` · ${cliente.email}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-blue-600">
                        {cliente.canal_origen}{" "}
                        {cliente.nit ? `· NIT ${cliente.nit}` : "· Sin NIT"}
                      </p>
                      {principal && (
                        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
                          {principal.direccion}
                          {[
                            principal.departamento,
                            principal.municipio,
                            principal.zona,
                          ].filter(Boolean).length
                            ? ` · ${[principal.departamento, principal.municipio, principal.zona].filter(Boolean).join(", ")}`
                            : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-5 lg:text-right">
                      <div>
                        <p className="text-xs text-slate-500">
                          Saldo pendiente
                        </p>
                        <p className="font-black text-amber-600">
                          {moneda(cliente.saldo)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void abrirFicha(cliente)}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-orange-600"
                        >
                          <ClipboardList size={15} /> Ficha
                        </button>
                        <button
                          type="button"
                          onClick={() => editar(cliente)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-orange-300 hover:text-orange-700"
                        >
                          <Pencil size={15} /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void eliminarCliente(cliente)}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-100 px-3 py-2 text-sm font-bold text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                          aria-label={`Eliminar ${cliente.nombre}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {!filtrados.length && (
                <div className="grid place-items-center gap-2 p-12 text-slate-500">
                  <Users />
                  <p>No hay clientes que coincidan con estos filtros.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {clienteFicha && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Ficha de ${clienteFicha.nombre}`}
            className="mx-auto max-w-6xl rounded-3xl bg-slate-50 shadow-2xl"
          >
            <header className="flex flex-col gap-4 rounded-t-3xl bg-slate-950 p-6 text-white sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-orange-300">
                  Ficha del cliente
                </p>
                <h2 className="mt-1 text-3xl font-black">
                  {clienteFicha.nombre}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  {clienteFicha.telefono || "Sin teléfono"}
                  {clienteFicha.email ? ` · ${clienteFicha.email}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClienteFicha(null)}
                className="inline-flex h-10 w-10 items-center justify-center self-end rounded-xl border border-slate-700 text-white hover:bg-slate-800 sm:self-auto"
                aria-label="Cerrar ficha"
              >
                <X size={20} />
              </button>
            </header>
            {cargandoFicha ? (
              <p className="p-10 text-slate-500">
                Cargando historial del cliente…
              </p>
            ) : (
              <div className="space-y-6 p-5 sm:p-7">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <IndicadorFicha
                    titulo="Pedidos"
                    valor={String(pedidosFicha.length)}
                    icono={<ClipboardList size={18} />}
                  />
                  <IndicadorFicha
                    titulo="Compras históricas"
                    valor={moneda(totalHistoricoFicha)}
                    icono={<ShoppingBag size={18} />}
                  />
                  <IndicadorFicha
                    titulo="Saldo pendiente"
                    valor={moneda(saldoFicha)}
                    icono={<Users size={18} />}
                    alerta={saldoFicha > 0}
                  />
                  <IndicadorFicha
                    titulo="Conversaciones"
                    valor={String(conversacionesFicha.length)}
                    icono={<MessageCircle size={18} />}
                  />
                </div>
                <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
                  <article className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-lg font-black text-slate-950">
                      Datos y facturación
                    </h3>
                    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                      <DatoFicha
                        etiqueta="NIT"
                        valor={clienteFicha.nit || "Pendiente"}
                      />
                      <DatoFicha
                        etiqueta="Razón social"
                        valor={clienteFicha.razon_social || "Pendiente"}
                      />
                      <DatoFicha
                        etiqueta="Canal de origen"
                        valor={clienteFicha.canal_origen || "Manual"}
                      />
                      <DatoFicha
                        etiqueta="Estado"
                        valor={clienteFicha.estado || "Activo"}
                      />
                      <DatoFicha
                        etiqueta="Cumpleaños"
                        valor={
                          clienteFicha.fecha_nacimiento
                            ? new Intl.DateTimeFormat("es-GT", {
                                day: "numeric",
                                month: "long",
                              }).format(
                                new Date(
                                  `${clienteFicha.fecha_nacimiento}T00:00:00`,
                                ),
                              )
                            : "No registrado"
                        }
                        icono={<Cake size={15} />}
                      />
                      <DatoFicha
                        etiqueta="Notas internas"
                        valor={clienteFicha.notas || "Sin notas"}
                      />
                    </dl>
                  </article>
                  <article className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="flex items-center gap-2 text-lg font-black text-slate-950">
                      <MapPin size={18} className="text-orange-600" />{" "}
                      Direcciones guardadas
                    </h3>
                    <div className="mt-4 space-y-3">
                      {(direcciones[clienteFicha.id] || []).map((direccion) => (
                        <div
                          key={direccion.id}
                          className="rounded-xl bg-slate-50 p-3 text-sm"
                        >
                          <p className="font-bold text-slate-900">
                            {direccion.etiqueta}
                            {direccion.principal ? " · Principal" : ""}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {direccion.direccion}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[
                              direccion.departamento,
                              direccion.municipio,
                              direccion.zona,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Ubicación pendiente"}
                          </p>
                        </div>
                      ))}
                      {!(direcciones[clienteFicha.id] || []).length && (
                        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                          No tiene direcciones guardadas.
                        </p>
                      )}
                    </div>
                  </article>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 p-5">
                      <h3 className="text-lg font-black text-slate-950">
                        Productos más comprados
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Según el historial de pedidos.
                      </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {productosMasComprados.map((producto, indice) => (
                        <div
                          key={producto.nombre}
                          className="flex items-center justify-between p-4 text-sm"
                        >
                          <p className="font-semibold text-slate-800">
                            <span className="mr-2 text-orange-600">
                              #{indice + 1}
                            </span>
                            {producto.nombre}
                          </p>
                          <p className="font-black text-slate-950">
                            {producto.cantidad} uds.
                          </p>
                        </div>
                      ))}
                      {!productosMasComprados.length && (
                        <p className="p-5 text-sm text-slate-500">
                          Aún no hay productos comprados.
                        </p>
                      )}
                    </div>
                  </article>
                  <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 p-5">
                      <h3 className="text-lg font-black text-slate-950">
                        Conversaciones
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Historial de atención comercial.
                      </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {conversacionesFicha.map((conversacion) => (
                        <div key={conversacion.id} className="p-4 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-slate-900">
                              {conversacion.canal}
                            </p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                              {conversacion.estado}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-slate-600">
                            {conversacion.ultimo_mensaje ||
                              "Sin mensajes registrados"}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {fechaCorta(
                              conversacion.ultimo_mensaje_at ||
                                conversacion.created_at,
                            )}
                          </p>
                        </div>
                      ))}
                      {!conversacionesFicha.length && (
                        <p className="p-5 text-sm text-slate-500">
                          Aún no hay conversaciones vinculadas.
                        </p>
                      )}
                    </div>
                  </article>
                </div>
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 p-5">
                    <h3 className="text-lg font-black text-slate-950">
                      Historial de pedidos
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {pedidosFicha.map((pedido) => (
                      <div
                        key={pedido.id}
                        className="grid gap-2 p-4 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center"
                      >
                        <div>
                          <p className="font-black text-slate-950">
                            {pedido.codigo || "Pedido"}
                          </p>
                          <p className="mt-1 text-slate-500">
                            {fechaCorta(pedido.fecha_pedido)} ·{" "}
                            {pedido.pedido_detalle
                              ?.map(
                                (item) =>
                                  `${item.cantidad}× ${item.productos?.nombre || "Producto"}`,
                              )
                              .join(", ") || "Sin detalle"}
                          </p>
                        </div>
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
                          {pedido.estado}
                        </span>
                        <div className="text-left sm:text-right">
                          <p className="font-black text-slate-950">
                            {moneda(Number(pedido.total))}
                          </p>
                          <p className="text-xs text-slate-500">
                            {pedido.pago_estado || "Pendiente"}
                          </p>
                        </div>
                      </div>
                    ))}
                    {!pedidosFicha.length && (
                      <p className="p-5 text-sm text-slate-500">
                        Aún no hay pedidos registrados.
                      </p>
                    )}
                  </div>
                </article>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function IndicadorFicha({
  titulo,
  valor,
  icono,
  alerta = false,
}: {
  titulo: string;
  valor: string;
  icono: ReactNode;
  alerta?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-slate-400">
        {icono}
        <span className="text-xs font-semibold">{titulo}</span>
      </div>
      <p
        className={`mt-3 text-xl font-black ${alerta ? "text-amber-600" : "text-slate-950"}`}
      >
        {valor}
      </p>
    </article>
  );
}

function DatoFicha({
  etiqueta,
  valor,
  icono,
}: {
  etiqueta: string;
  valor: string;
  icono?: ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-400">
        {icono}
        {etiqueta}
      </dt>
      <dd className="mt-1 font-semibold text-slate-800">{valor}</dd>
    </div>
  );
}
