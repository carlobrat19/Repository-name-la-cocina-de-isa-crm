"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus, RefreshCw, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { moneda } from "@/lib/crm";
import { useCrmAuth } from "@/components/auth/AuthGate";
import ImportarZipSat from "@/components/compras-facturas/ImportarZipSat";
import RevisarFactura from "@/components/compras-facturas/RevisarFactura";

type Proveedor = { id: string; nombre: string; nit: string | null; contacto: string | null; telefono: string | null; correo: string | null };
type Factura = { id: string; proveedor_id: string; numero: string | null; fecha: string; total: number; impuesto: number; categoria: string; estado: string; origen: string; comprobante_path: string | null; notas: string | null };
type LineaGuardada = { id: string; factura_id: string; descripcion: string; categoria: string; cantidad: number | null; unidad_factura: string | null; cantidad_base: number | null; monto: number; ingrediente_id: string | null; compra_ingrediente_id: string | null };
type Ingrediente = { id: string; nombre: string; unidad_base: "g" | "ml" | "unidad" };
type Compra = { id: string; ingrediente_id: string; cantidad: number; total: number; created_at: string };
type Equivalencia = { id: string; proveedor_id: string; descripcion: string; ingrediente_id: string };
type LineaFormulario = { descripcion: string; categoria: string; cantidad: string; unidad: string; cantidadBase: string; monto: string; ingredienteId: string; compraId: string; recordar: boolean };

const categorias = ["Materia prima", "Empaques", "Mensajería y envíos", "Utensilios de cocina", "Equipo de cocina", "Mobiliario", "Servicios", "Publicidad", "Otros gastos"];
const nuevaLinea = (): LineaFormulario => ({ descripcion: "", categoria: "Materia prima", cantidad: "", unidad: "", cantidadBase: "", monto: "", ingredienteId: "", compraId: "", recordar: false });
const dinero = (valor: number | string | null | undefined) => moneda(Number(valor || 0));
const texto = (valor: string) => valor.trim().toLocaleLowerCase("es-GT");
function convertirCantidad(cantidad: string, unidad: string, unidadBase: Ingrediente["unidad_base"] | undefined) {
  const valor = Number(cantidad);
  if (!Number.isFinite(valor) || valor <= 0 || !unidadBase) return "";
  const origen = texto(unidad);
  if (unidadBase === "g") {
    if (["kg", "kilogramo", "kilogramos"].includes(origen)) return String(Math.round(valor * 1000 * 1000) / 1000);
    if (["lb", "libra", "libras"].includes(origen)) return String(Math.round(valor * 453.59237 * 1000) / 1000);
    if (["g", "gramo", "gramos"].includes(origen)) return String(valor);
  }
  if (unidadBase === "ml") {
    if (["l", "lt", "litro", "litros"].includes(origen)) return String(Math.round(valor * 1000 * 1000) / 1000);
    if (["ml", "mililitro", "mililitros"].includes(origen)) return String(valor);
  }
  if (unidadBase === "unidad" && ["unidad", "unidades", "u"].includes(origen)) return String(valor);
  return "";
}

export default function ComprasFacturasPage() {
  const { id: usuarioId } = useCrmAuth();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [lineasGuardadas, setLineasGuardadas] = useState<LineaGuardada[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [equivalencias, setEquivalencias] = useState<Equivalencia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [nombreProveedor, setNombreProveedor] = useState("");
  const [nitProveedor, setNitProveedor] = useState("");
  const [contactoProveedor, setContactoProveedor] = useState("");
  const [telefonoProveedor, setTelefonoProveedor] = useState("");
  const [correoProveedor, setCorreoProveedor] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(new Date().toLocaleDateString("en-CA"));
  const [total, setTotal] = useState("");
  const [impuesto, setImpuesto] = useState("0");
  const [categoria, setCategoria] = useState("Materia prima");
  const [notas, setNotas] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [lineas, setLineas] = useState<LineaFormulario[]>([nuevaLinea()]);
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [facturaEnlace, setFacturaEnlace] = useState("");
  const [revisandoFacturaId, setRevisandoFacturaId] = useState("");

  async function cargar() {
    setCargando(true);
    setError("");
    const [proveedoresR, facturasR, lineasR, ingredientesR, comprasR, equivalenciasR] = await Promise.all([
      supabase.from("proveedores_compra").select("id,nombre,nit,contacto,telefono,correo").order("nombre"),
      supabase.from("facturas_compra").select("id,proveedor_id,numero,fecha,total,impuesto,categoria,estado,origen,comprobante_path,notas").order("fecha", { ascending: false }).limit(500),
      supabase.from("facturas_compra_lineas").select("id,factura_id,descripcion,categoria,cantidad,unidad_factura,cantidad_base,monto,ingrediente_id,compra_ingrediente_id").limit(2000),
      supabase.from("ingredientes").select("id,nombre,unidad_base").eq("activo", true).order("nombre"),
      supabase.from("compras_ingredientes").select("id,ingrediente_id,cantidad,total,created_at").eq("tipo", "compra").order("created_at", { ascending: false }).limit(500),
      supabase.from("equivalencias_proveedor_ingrediente").select("id,proveedor_id,descripcion,ingrediente_id"),
    ]);
    const principal = proveedoresR.error || facturasR.error || lineasR.error || equivalenciasR.error;
    if (principal) setError(`No se pudieron cargar las facturas: ${principal.message}`);
    else {
      setProveedores((proveedoresR.data || []) as Proveedor[]);
      setFacturas((facturasR.data || []) as Factura[]);
      setLineasGuardadas((lineasR.data || []) as LineaGuardada[]);
      setEquivalencias((equivalenciasR.data || []) as Equivalencia[]);
    }
    if (ingredientesR.error || comprasR.error) setAviso("No tienes acceso al catálogo de ingredientes o a sus compras. Puedes documentar facturas, pero no vincularlas hasta tener ese permiso.");
    else { setIngredientes((ingredientesR.data || []) as Ingrediente[]); setCompras((comprasR.data || []) as Compra[]); }
    setCargando(false);
  }

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { const timer = window.setTimeout(() => setFacturaEnlace(new URLSearchParams(window.location.search).get("factura") || ""), 0); return () => window.clearTimeout(timer); }, []);

  const comprasVinculadas = useMemo(() => new Set(lineasGuardadas.map((linea) => linea.compra_ingrediente_id).filter(Boolean)), [lineasGuardadas]);
  const filtradas = useMemo(() => facturas.filter((factura) => {
    const proveedor = proveedores.find((item) => item.id === factura.proveedor_id);
    return (!facturaEnlace || factura.id === facturaEnlace) && (!desde || factura.fecha >= desde) && (!hasta || factura.fecha <= hasta) && (!filtroProveedor || factura.proveedor_id === filtroProveedor) && `${proveedor?.nombre || ""} ${proveedor?.nit || ""} ${factura.numero || ""} ${factura.categoria}`.toLocaleLowerCase("es-GT").includes(texto(busqueda));
  }), [facturas, proveedores, desde, hasta, filtroProveedor, busqueda, facturaEnlace]);
  const totalFiltrado = filtradas.reduce((suma, factura) => suma + Number(factura.total || 0), 0);
  const porProveedor = useMemo(() => proveedores.map((proveedor) => ({ proveedor, documentos: filtradas.filter((factura) => factura.proveedor_id === proveedor.id) })).filter((item) => item.documentos.length).map((item) => ({ nombre: item.proveedor.nombre, cantidad: item.documentos.length, total: item.documentos.reduce((suma, factura) => suma + Number(factura.total || 0), 0) })).sort((a, b) => b.total - a.total), [proveedores, filtradas]);

  function actualizarLinea(indice: number, cambio: Partial<LineaFormulario>) {
    setLineas((actual) => actual.map((linea, posicion) => posicion === indice ? { ...linea, ...cambio } : linea));
  }

  async function seleccionarArchivo(nuevoArchivo: File | null) {
    setArchivo(nuevoArchivo);
    if (!nuevoArchivo?.name.toLowerCase().endsWith(".xml")) return;
    try {
      const documento = new DOMParser().parseFromString(await nuevoArchivo.text(), "application/xml");
      if (documento.getElementsByTagName("parsererror").length) throw new Error("El XML no es válido.");
      const nodo = (nombre: string) => Array.from(documento.getElementsByTagName("*")).find((elemento) => elemento.localName === nombre);
      const nodos = (nombre: string) => Array.from(documento.getElementsByTagName("*")).filter((elemento) => elemento.localName === nombre);
      const emisor = nodo("Emisor");
      const generales = nodo("DatosGenerales");
      const autorizacion = nodo("NumeroAutorizacion");
      const totalXml = nodo("GranTotal")?.textContent?.trim();
      if (!emisor || !generales || !totalXml) throw new Error("El archivo no contiene los datos principales de una factura FEL.");
      const nit = emisor.getAttribute("NITEmisor")?.trim() || "";
      const existente = proveedores.find((item) => nit && texto(item.nit || "") === texto(nit));
      if (existente) setProveedorId(existente.id);
      else { setProveedorId(""); setNombreProveedor(emisor.getAttribute("NombreEmisor")?.trim() || ""); setNitProveedor(nit); setAviso("El proveedor del XML no está en el catálogo. Revisa sus datos y agrégalo antes de guardar la factura."); }
      setFecha((generales.getAttribute("FechaHoraEmision") || "").slice(0, 10));
      setNumero([autorizacion?.getAttribute("Serie"), autorizacion?.getAttribute("Numero")].filter(Boolean).join("-") || autorizacion?.textContent?.trim() || "");
      setTotal(totalXml);
      const impuestoXml = nodos("TotalImpuesto").reduce((suma, item) => suma + Number(item.getAttribute("TotalMontoImpuesto") || 0), 0);
      setImpuesto(String(impuestoXml));
      const items = nodos("Item").map((item) => {
        const valor = (nombre: string) => Array.from(item.getElementsByTagName("*")).find((elemento) => elemento.localName === nombre)?.textContent?.trim() || "";
        return { ...nuevaLinea(), descripcion: valor("Descripcion"), cantidad: valor("Cantidad"), unidad: valor("UnidadMedida"), monto: valor("Total") || valor("Precio") };
      }).filter((item) => item.descripcion);
      if (items.length) setLineas(items);
      if (existente) setAviso("Datos del XML cargados como borrador. Revisa importes, proveedor y productos antes de guardar.");
    } catch (problema) { setError(problema instanceof Error ? problema.message : "No se pudo leer el XML."); }
  }

  async function crearProveedor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setAviso("");
    if (!usuarioId || !nombreProveedor.trim()) { setError("Escribe el nombre del proveedor."); return; }
    const nit = nitProveedor.trim() || null;
    if (nit && proveedores.some((item) => texto(item.nit || "") === texto(nit))) { setError("Ya existe un proveedor con ese NIT."); return; }
    setGuardando(true);
    const { data, error: guardarError } = await supabase.from("proveedores_compra").insert({ nombre: nombreProveedor.trim(), nit, contacto: contactoProveedor.trim() || null, telefono: telefonoProveedor.trim() || null, correo: correoProveedor.trim() || null, creado_por: usuarioId }).select("id").single();
    setGuardando(false);
    if (guardarError) { setError(`No se pudo guardar el proveedor: ${guardarError.message}`); return; }
    setNombreProveedor(""); setNitProveedor(""); setContactoProveedor(""); setTelefonoProveedor(""); setCorreoProveedor("");
    setProveedorId(data.id); setAviso("Proveedor agregado al catálogo."); await cargar();
  }

  async function guardarFactura(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setAviso("");
    if (!usuarioId || !proveedorId || !fecha || !Number.isFinite(Number(total)) || Number(total) < 0 || !Number.isFinite(Number(impuesto)) || Number(impuesto) < 0) { setError("Selecciona proveedor, fecha y montos válidos."); return; }
    if (numero.trim() && facturas.some((factura) => factura.proveedor_id === proveedorId && texto(factura.numero || "") === texto(numero))) { setError("Esta factura ya está registrada para ese proveedor."); return; }
    const mimeArchivo = archivo?.type || (archivo?.name.toLowerCase().endsWith(".xml") ? "application/xml" : "");
    if (archivo && (archivo.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "application/pdf", "application/xml", "text/xml"].includes(mimeArchivo))) { setError("Adjunta JPG, PNG, WebP, PDF o XML de máximo 10 MB."); return; }
    const completas = lineas.filter((linea) => linea.descripcion.trim());
    if (lineas.some((linea) => !linea.descripcion.trim() && (linea.monto || linea.compraId))) { setError("Completa la descripción de cada línea usada."); return; }
    if (completas.some((linea) => !Number.isFinite(Number(linea.monto)) || Number(linea.monto) < 0 || (linea.ingredienteId && (!Number.isFinite(Number(linea.cantidadBase)) || Number(linea.cantidadBase) <= 0)))) { setError("Revisa los montos y la cantidad en gramos, mililitros o unidades de las líneas vinculadas."); return; }
    if (new Set(completas.map((linea) => linea.compraId).filter(Boolean)).size !== completas.filter((linea) => linea.compraId).length) { setError("Una compra existente solo puede vincularse a una línea."); return; }
    if (completas.some((linea) => linea.compraId && (!linea.ingredienteId || compras.find((compra) => compra.id === linea.compraId)?.ingrediente_id !== linea.ingredienteId))) { setError("La compra existente debe corresponder al ingrediente de su línea."); return; }
    setGuardando(true);
    const { data: factura, error: facturaError } = await supabase.from("facturas_compra").insert({ proveedor_id: proveedorId, numero: numero.trim() || null, fecha, total: Number(total), impuesto: Number(impuesto), categoria, notas: notas.trim() || null, creado_por: usuarioId }).select("id").single();
    if (facturaError || !factura) { setGuardando(false); setError(`No se pudo guardar la factura: ${facturaError?.message || "Error desconocido"}`); return; }
    if (completas.length) {
      const { error: lineasError } = await supabase.from("facturas_compra_lineas").insert(completas.map((linea) => ({ factura_id: factura.id, descripcion: linea.descripcion.trim(), categoria: linea.categoria, cantidad: linea.cantidad ? Number(linea.cantidad) : null, unidad_factura: linea.unidad.trim() || null, cantidad_base: linea.cantidadBase ? Number(linea.cantidadBase) : null, monto: Number(linea.monto), ingrediente_id: linea.ingredienteId || null, compra_ingrediente_id: linea.compraId || null })));
      if (lineasError) { setGuardando(false); setError(`La factura quedó en revisión, pero sus líneas no se guardaron: ${lineasError.message}`); await cargar(); return; }
    }
    if (archivo) {
      const extension = archivo.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${factura.id}/${crypto.randomUUID()}.${extension}`;
      const { error: subirError } = await supabase.storage.from("facturas-compra").upload(path, archivo, { upsert: false, contentType: mimeArchivo });
      if (subirError) { setGuardando(false); setError(`La factura quedó en revisión, pero no se pudo adjuntar el archivo: ${subirError.message}`); await cargar(); return; }
      const { error: adjuntarError } = await supabase.from("facturas_compra").update({ comprobante_path: path }).eq("id", factura.id);
      if (adjuntarError) { setGuardando(false); setError("La factura quedó en revisión, pero no se pudo asociar el archivo. Solicita ayuda antes de volver a cargarla."); await cargar(); return; }
    }
    for (const linea of completas.filter((item) => item.recordar && item.ingredienteId)) {
      const existente = equivalencias.find((item) => item.proveedor_id === proveedorId && texto(item.descripcion) === texto(linea.descripcion));
      const operacion = existente
        ? supabase.from("equivalencias_proveedor_ingrediente").update({ ingrediente_id: linea.ingredienteId }).eq("id", existente.id)
        : supabase.from("equivalencias_proveedor_ingrediente").insert({ proveedor_id: proveedorId, descripcion: linea.descripcion.trim(), ingrediente_id: linea.ingredienteId });
      const { error: equivalenciaError } = await operacion;
      if (equivalenciaError) { setAviso("Factura guardada; una equivalencia no se pudo recordar."); break; }
    }
    setGuardando(false); setNumero(""); setTotal(""); setImpuesto("0"); setNotas(""); setArchivo(null); setLineas([nuevaLinea()]);
    setAviso("Factura documentada. No se duplicó inventario ni se creó un nuevo gasto en caja."); await cargar();
  }

  async function abrirComprobante(path: string) {
    const { data, error: enlaceError } = await supabase.storage.from("facturas-compra").createSignedUrl(path, 60);
    if (enlaceError || !data?.signedUrl) { setError("No se pudo abrir el comprobante."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return <main className="min-h-screen bg-slate-100 px-4 py-7 sm:px-7 lg:px-10"><div className="mx-auto max-w-[1600px] space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-orange-600">Finanzas y control</p><h1 className="mt-2 text-4xl font-black text-slate-950">Compras y facturas</h1><p className="mt-2 text-sm text-slate-600">Documenta comprobantes y proveedores sin duplicar las compras que ya registras.</p></div><button type="button" onClick={() => void cargar()} disabled={cargando} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"><RefreshCw size={16}/>{cargando ? "Actualizando…" : "Actualizar"}</button></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
    {aviso && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{aviso}</p>}
    <ImportarZipSat usuarioId={usuarioId} proveedores={proveedores} facturas={facturas} alGuardar={cargar}/>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-xl font-black">Revisar y vincular una factura</h2><p className="mt-1 text-sm text-slate-500">Clasifica sus líneas y, si corresponde, vincula compras de ingredientes ya registradas.</p></div><select aria-label="Seleccionar factura para revisar" value={revisandoFacturaId} onChange={(event) => setRevisandoFacturaId(event.target.value)} className="min-w-64 max-w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"><option value="">Seleccionar factura</option>{facturas.map((factura) => <option key={factura.id} value={factura.id}>{factura.fecha} · {proveedores.find((item) => item.id === factura.proveedor_id)?.nombre || "Proveedor"} · {factura.numero || "Sin número"}</option>)}</select></div>
      {facturas.find((factura) => factura.id === revisandoFacturaId) && <RevisarFactura key={revisandoFacturaId} factura={facturas.find((factura) => factura.id === revisandoFacturaId)!} lineas={lineasGuardadas.filter((linea) => linea.factura_id === revisandoFacturaId)} ingredientes={ingredientes} compras={compras} comprasVinculadas={comprasVinculadas} cerrar={() => setRevisandoFacturaId("")} alGuardar={cargar}/>}
    </section>
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Proveedores</h2><p className="mt-1 text-sm text-slate-500">El NIT ayuda a reconocerlos y detectar facturas repetidas.</p>
        <form onSubmit={crearProveedor} className="mt-5 space-y-3"><label className="block text-sm font-bold">Nombre<input required value={nombreProveedor} onChange={(event) => setNombreProveedor(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><label className="block text-sm font-bold">NIT<input value={nitProveedor} onChange={(event) => setNitProveedor(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><label className="block text-sm font-bold">Contacto<input value={contactoProveedor} onChange={(event) => setContactoProveedor(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-bold">Teléfono<input value={telefonoProveedor} onChange={(event) => setTelefonoProveedor(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><label className="block text-sm font-bold">Correo<input type="email" value={correoProveedor} onChange={(event) => setCorreoProveedor(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label></div><button disabled={guardando} className="w-full rounded-xl bg-slate-950 p-3 text-sm font-bold text-white disabled:opacity-50">Agregar proveedor</button></form>
        <div className="mt-6 max-h-72 space-y-2 overflow-y-auto">{proveedores.map((proveedor) => <div key={proveedor.id} className="rounded-xl border border-slate-100 p-3"><p className="font-bold">{proveedor.nombre}</p><p className="text-xs text-slate-500">NIT: {proveedor.nit || "Sin registrar"}</p></div>)}</div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Agregar factura de compra</h2><p className="mt-1 text-sm text-slate-500">El XML FEL propone datos automáticamente; para fotos y PDF ingrésalos manualmente. Revisa todo antes de guardar.</p>
        <form onSubmit={guardarFactura} className="mt-5 space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="block text-sm font-bold">Proveedor<select required value={proveedorId} onChange={(event) => setProveedorId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3"><option value="">Seleccionar</option>{proveedores.map((proveedor) => <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre} · {proveedor.nit || "sin NIT"}</option>)}</select></label><label className="block text-sm font-bold">Número de factura<input value={numero} onChange={(event) => setNumero(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><label className="block text-sm font-bold">Fecha<input type="date" required value={fecha} onChange={(event) => setFecha(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><label className="block text-sm font-bold">Total Q<input type="number" min="0" step="0.01" required value={total} onChange={(event) => setTotal(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><label className="block text-sm font-bold">Impuestos incluidos Q<input type="number" min="0" step="0.01" value={impuesto} onChange={(event) => setImpuesto(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label><label className="block text-sm font-bold">Categoría<select value={categoria} onChange={(event) => setCategoria(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3">{categorias.map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-sm font-bold sm:col-span-2"><span className="inline-flex items-center gap-2"><Upload size={15}/> Comprobante</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,application/xml,text/xml,.xml" onChange={(event) => void seleccionarArchivo(event.target.files?.[0] || null)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs"/></label></div>
          <label className="block text-sm font-bold">Notas<input value={notas} onChange={(event) => setNotas(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label>
          <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-950"><b>¿Ya registraste los ingredientes?</b> Vincula abajo esas compras para respaldarlas. Si aún no las registraste, conserva tu flujo de <Link href="/recetas" className="font-bold underline">Recetas y costos</Link> y luego documenta la factura. Adjuntar una factura nunca vuelve a aumentar existencias ni a cargar caja.</div>
          <div className="flex items-center justify-between"><div><h3 className="font-black">Productos de la factura</h3><p className="text-xs text-slate-500">Opcional. La cantidad base debe estar en la unidad del ingrediente del CRM.</p></div><button type="button" onClick={() => setLineas((actual) => [...actual, nuevaLinea()])} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><Plus size={14}/> Línea</button></div>
          {lineas.map((linea, indice) => { const sugerido = equivalencias.find((item) => item.proveedor_id === proveedorId && texto(item.descripcion) === texto(linea.descripcion)); const ingrediente = ingredientes.find((item) => item.id === linea.ingredienteId); const comprasDisponibles = compras.filter((compra) => compra.ingrediente_id === linea.ingredienteId && !comprasVinculadas.has(compra.id)); return <div key={indice} className="rounded-xl border border-slate-200 p-3"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="block text-xs font-bold lg:col-span-2">Descripción<input value={linea.descripcion} onChange={(event) => actualizarLinea(indice, { descripcion: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"/></label><label className="block text-xs font-bold">Monto Q<input type="number" min="0" step="0.01" value={linea.monto} onChange={(event) => actualizarLinea(indice, { monto: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"/></label><label className="block text-xs font-bold">Categoría<select value={linea.categoria} onChange={(event) => actualizarLinea(indice, { categoria: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm">{categorias.map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-xs font-bold">Cantidad en factura<input type="number" min="0" step="0.001" value={linea.cantidad} onChange={(event) => actualizarLinea(indice, { cantidad: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"/></label><label className="block text-xs font-bold">Unidad de factura<input placeholder="Ej. kg, bolsa" value={linea.unidad} onChange={(event) => actualizarLinea(indice, { unidad: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"/></label><label className="block text-xs font-bold">Ingrediente existente<select value={linea.ingredienteId} onChange={(event) => actualizarLinea(indice, { ingredienteId: event.target.value, compraId: "", cantidadBase: "" })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"><option value="">No vincular</option>{ingredientes.map((item) => <option key={item.id} value={item.id}>{item.nombre} ({item.unidad_base})</option>)}</select></label><label className="block text-xs font-bold">Cantidad base {ingrediente ? `(${ingrediente.unidad_base})` : ""}<input type="number" min="0" step="0.001" placeholder="Ej. 1000 g" value={linea.cantidadBase} onChange={(event) => actualizarLinea(indice, { cantidadBase: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"/></label></div>
            {ingrediente && convertirCantidad(linea.cantidad, linea.unidad, ingrediente.unidad_base) && <button type="button" onClick={() => actualizarLinea(indice, { cantidadBase: convertirCantidad(linea.cantidad, linea.unidad, ingrediente.unidad_base) })} className="mt-2 mr-3 text-xs font-bold text-blue-700 underline">Usar conversión: {convertirCantidad(linea.cantidad, linea.unidad, ingrediente.unidad_base)} {ingrediente.unidad_base}</button>}
            {sugerido && sugerido.ingrediente_id !== linea.ingredienteId && <button type="button" onClick={() => actualizarLinea(indice, { ingredienteId: sugerido.ingrediente_id, compraId: "" })} className="mt-2 text-xs font-bold text-orange-700 underline">Sugerencia guardada: {ingredientes.find((item) => item.id === sugerido.ingrediente_id)?.nombre || "Ingrediente"} · usar</button>}
            {ingrediente && <div className="mt-3 flex flex-wrap items-end gap-3"><label className="min-w-60 flex-1 text-xs font-bold">Compra ya registrada<select value={linea.compraId} onChange={(event) => { const compra = compras.find((item) => item.id === event.target.value); actualizarLinea(indice, { compraId: event.target.value, cantidadBase: compra ? String(compra.cantidad) : linea.cantidadBase }); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"><option value="">Sin vincular</option>{comprasDisponibles.map((compra) => <option key={compra.id} value={compra.id}>{new Date(compra.created_at).toLocaleDateString("es-GT")} · {compra.cantidad} {ingrediente.unidad_base} · {dinero(compra.total)}</option>)}</select></label><label className="flex items-center gap-2 pb-2 text-xs font-semibold"><input type="checkbox" checked={linea.recordar} onChange={(event) => actualizarLinea(indice, { recordar: event.target.checked })}/> Recordar esta equivalencia</label></div>}
            {lineas.length > 1 && <button type="button" onClick={() => setLineas((actual) => actual.filter((_, posicion) => posicion !== indice))} className="mt-2 text-xs font-bold text-rose-700 underline">Quitar línea</button>}</div>; })}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">Suma de líneas: {dinero(lineas.reduce((suma, linea) => suma + Number(linea.monto || 0), 0))} · Total factura: {dinero(total)}</p><button disabled={guardando || !proveedores.length} className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar factura"}</button></div>
        </form>
      </section>
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="text-xl font-black">Historial de facturas de compra</h2><p className="mt-1 text-sm text-slate-500">{filtradas.length} comprobantes · {dinero(totalFiltrado)} en el rango. Documentar no equivale a pagar.</p></div><FileText className="text-orange-500"/></div>{facturaEnlace && <div className="flex items-center justify-between bg-orange-50 px-4 py-2 text-xs font-bold text-orange-900"><span>Mostrando la factura vinculada a la compra.</span><button type="button" onClick={() => { setFacturaEnlace(""); window.history.replaceState(null, "", "/compras-facturas"); }} className="underline">Ver todas</button></div>}<div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"><input aria-label="Buscar proveedor o factura" placeholder="Proveedor, NIT o factura" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} className="rounded-xl border border-slate-200 p-3 text-sm"/><select aria-label="Filtrar proveedor" value={filtroProveedor} onChange={(event) => setFiltroProveedor(event.target.value)} className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><option value="">Todos los proveedores</option>{proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><input aria-label="Desde" type="date" value={desde} onChange={(event) => setDesde(event.target.value)} className="rounded-xl border border-slate-200 p-3 text-sm"/><input aria-label="Hasta" type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} className="rounded-xl border border-slate-200 p-3 text-sm"/></div><div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">{porProveedor.map((item) => <div key={item.nombre} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{item.nombre} · {item.cantidad} facturas</p><p className="mt-1 text-lg font-black">{dinero(item.total)}</p></div>)}</div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Fecha / factura</th><th className="p-4">Proveedor</th><th className="p-4">Categoría</th><th className="p-4">Vinculación</th><th className="p-4 text-right">Total</th><th className="p-4">Archivo</th></tr></thead><tbody>{filtradas.map((factura) => { const propias = lineasGuardadas.filter((linea) => linea.factura_id === factura.id); const vinculadas = propias.filter((linea) => linea.compra_ingrediente_id).length; return <tr key={factura.id} className="border-t border-slate-100"><td className="p-4"><b>{factura.numero || "Sin número"}</b><p className="text-xs text-slate-500">{factura.fecha}</p></td><td className="p-4">{proveedores.find((item) => item.id === factura.proveedor_id)?.nombre || "Proveedor"}</td><td className="p-4">{factura.categoria}</td><td className="p-4 text-xs">{propias.length} líneas · {vinculadas} compras vinculadas</td><td className="p-4 text-right font-black">{dinero(factura.total)}</td><td className="p-4">{factura.comprobante_path ? <button type="button" onClick={() => void abrirComprobante(factura.comprobante_path!)} className="font-bold text-orange-700 underline">Ver comprobante</button> : <span className="text-slate-400">Sin archivo</span>}</td></tr>; })}{!filtradas.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aún no hay facturas para estos filtros.</td></tr>}</tbody></table></div></section>
  </div></main>;
}
