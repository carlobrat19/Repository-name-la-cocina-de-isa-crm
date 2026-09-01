"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "../../lib/supabase";

type IngredienteReceta = {
  cantidad: number;
  ingredientes: { nombre: string; unidad_base: string; costo_referencia: number | string; stock_actual: number | string } | null;
};

type RecetaPiloto = {
  rendimiento: number | string;
  unidad_rendimiento: string;
  merma_pct: number | string;
  margen_pct: number | string;
  iva_pct: number | string;
  recargo_carta_pct: number | string;
  comision_canal_pct: number | string;
  costos_adicionales: number | string;
  receta_ingredientes: IngredienteReceta[];
};

type Producto = {
  id: string;
  nombre: string;
  categoria?: string | null;
  precio_venta: number | string;
  costo?: number | string | null;
  estado?: string | null;
  stock?: number | string | null;
  descripcion?: string | null;
  sku?: string | null;
  imagen_url?: string | null;
  stock_minimo?: number | string | null;
  disponible_online?: boolean | null;
  publicar_catalogo?: boolean | null;
  tiempo_preparacion_min?: number | string | null;
  etiquetas?: string[] | null;
  canales_venta?: string[] | null;
};

export default function ProductosPage() {

const [nombre,setNombre]=useState("");
const [categoria,setCategoria]=useState("");
const [precio,setPrecio]=useState("");
const [costo,setCosto]=useState("");
const [stock,setStock]=useState("0");
const [stockMinimo,setStockMinimo]=useState("0");
const [descripcion,setDescripcion]=useState("");
const [sku,setSku]=useState("");
const [tiempoPreparacion,setTiempoPreparacion]=useState("");
const [etiquetas,setEtiquetas]=useState("");
const [publicarCatalogo,setPublicarCatalogo]=useState(false);
const [disponibleOnline,setDisponibleOnline]=useState(true);
const [canalesVenta,setCanalesVenta]=useState<string[]>(["WhatsApp", "Web"]);
const [fotoProducto,setFotoProducto]=useState<File | null>(null);
const [fotoActual,setFotoActual]=useState("");
const [subiendoFoto,setSubiendoFoto]=useState(false);

const [productos,setProductos]=
useState<Producto[]>([]);

const [recetaPiloto, setRecetaPiloto] = useState<RecetaPiloto | null>(null);
const [productoReceta, setProductoReceta] = useState<Producto | null>(null);
const [precioFinalProducto, setPrecioFinalProducto] = useState("");
const [guardandoPrecioFinal, setGuardandoPrecioFinal] = useState(false);
const [busquedaProducto, setBusquedaProducto] = useState("");
const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
const [inventarioFiltro, setInventarioFiltro] = useState("Todos");
const [catalogoFiltro, setCatalogoFiltro] = useState("Todos");
const [canalFiltro, setCanalFiltro] = useState("Todos");

const [
productoEditando,
setProductoEditando
]=
useState<string|null>(
null
);

// ======================
// OBTENER PRODUCTOS
// ======================

async function obtenerProductos(){

const {
data,
error
}
=
await supabase

.from(
"productos"
)

.select("*")

.order(
"id",
{
ascending:false
}
);

if(error){

console.log(error);

return;

}

const productosCargados = (data || []) as Producto[];

setProductos(
productosCargados
);

const productoInicial = productosCargados.find((producto) => producto.nombre === "PAN DE BANANO") || productosCargados[0];
if (productoInicial && !productoReceta) {
void cargarResumenProducto(productoInicial);
}
}

async function cargarResumenProducto(producto: Producto) {
setProductoReceta(producto);
setPrecioFinalProducto(String(producto.precio_venta ?? ""));
const recetaRespuesta = await supabase
.from("recetas_estandar")
.select("rendimiento, unidad_rendimiento, merma_pct, margen_pct, iva_pct, recargo_carta_pct, comision_canal_pct, costos_adicionales, receta_ingredientes(cantidad, ingredientes(nombre, unidad_base, costo_referencia, stock_actual))")
.eq("producto_id", producto.id)
.maybeSingle();
if (recetaRespuesta.error) { console.error(recetaRespuesta.error); return; }
setRecetaPiloto(recetaRespuesta.data as RecetaPiloto | null);
}

async function guardarPrecioFinalPan() {
if (!productoReceta || !precioFinalProducto || Number(precioFinalProducto) < 0) {
alert("Ingresa un precio de venta final válido.");
return;
}

setGuardandoPrecioFinal(true);
const { error } = await supabase
.from("productos")
.update({ precio_venta: Number(precioFinalProducto) })
.eq("id", productoReceta.id);
setGuardandoPrecioFinal(false);

if (error) {
console.error(error);
alert("No se pudo guardar el precio final de venta.");
return;
}

alert("Precio final de venta actualizado.");
await obtenerProductos();
setProductoReceta({ ...productoReceta, precio_venta: Number(precioFinalProducto) });
}

// ======================
// GUARDAR
// ======================

async function guardarProducto(){

if(
!nombre
||
!precio
||
!costo
){

alert(
"Completa campos"
);

return;

}

 let error;
 let imagenUrl = fotoActual || null;
 if (fotoProducto) {
 setSubiendoFoto(true);
 const extension = fotoProducto.name.split(".").pop()?.toLowerCase() || "jpg";
 const ruta = `${crypto.randomUUID()}.${extension}`;
 const { error: errorFoto } = await supabase.storage.from("productos").upload(ruta, fotoProducto, { contentType: fotoProducto.type });
 setSubiendoFoto(false);
 if (errorFoto) { console.error(errorFoto); alert("No se pudo subir la foto del producto."); return; }
 imagenUrl = supabase.storage.from("productos").getPublicUrl(ruta).data.publicUrl;
 }

 const datosProducto = {
 nombre,
 categoria: categoria || null,
 precio_venta: Number(precio),
 costo: Number(costo),
 stock: Number(stock || 0),
 stock_minimo: Number(stockMinimo || 0),
 descripcion: descripcion.trim() || null,
 sku: sku.trim() || null,
 imagen_url: imagenUrl,
 tiempo_preparacion_min: tiempoPreparacion === "" ? null : Number(tiempoPreparacion),
 etiquetas: etiquetas.split(",").map((etiqueta) => etiqueta.trim()).filter(Boolean),
 publicar_catalogo: publicarCatalogo,
 disponible_online: disponibleOnline,
 canales_venta: canalesVenta,
 };

if(
productoEditando
){

const resultado =

await supabase

.from(
"productos"
)

.update(datosProducto)

.eq(
"id",
productoEditando
);

error =
resultado.error;

}else{

const resultado =

await supabase

.from(
"productos"
)

.insert([{ ...datosProducto, estado: "Activo" }]);

error =
resultado.error;

}

if(error){

console.log(error);

alert(
"Error guardando"
);

return;

}

alert(

productoEditando

?

"Producto actualizado"

:

"Producto guardado"

);

setNombre("");

setCategoria("");

setPrecio("");

setCosto("");
setStock("0"); setStockMinimo("0"); setDescripcion(""); setSku(""); setTiempoPreparacion(""); setEtiquetas(""); setPublicarCatalogo(false); setDisponibleOnline(true); setCanalesVenta(["WhatsApp", "Web"]); setFotoProducto(null); setFotoActual("");

setProductoEditando(
null
);

obtenerProductos();

}

// ======================
// ELIMINAR
// ======================

async function eliminarProducto(
id:string,
nombre:string
){

const ok =
confirm(
`¿Eliminar ${nombre}?`
);

if(!ok)
return;

await supabase

.from(
"productos"
)

.delete()

.eq(
"id",
id
);

obtenerProductos();

}

// ======================

useEffect(()=>{
const timer = window.setTimeout(() => void obtenerProductos(), 0);
return () => window.clearTimeout(timer);
// obtenerProductos no depende de estado y solo debe ejecutarse al cargar el módulo.
},[]); // eslint-disable-line react-hooks/exhaustive-deps

const categorias = Array.from(new Set(productos.map((producto) => producto.categoria?.trim()).filter(Boolean))) as string[];
const canales = Array.from(new Set(productos.flatMap((producto) => producto.canales_venta || []))).sort();
const productosFiltrados = productos.filter((producto) => {
const texto = `${producto.nombre} ${producto.categoria ?? ""} ${producto.sku ?? ""} ${(producto.etiquetas || []).join(" ")}`.toLowerCase();
const stockActual = Number(producto.stock || 0);
const stockMinimoActual = Number(producto.stock_minimo || 0);
const pasaInventario = inventarioFiltro === "Todos" || (inventarioFiltro === "Sin existencias" && stockActual <= 0) || (inventarioFiltro === "Stock bajo" && stockActual > 0 && stockActual <= stockMinimoActual) || (inventarioFiltro === "Disponible" && stockActual > stockMinimoActual);
const pasaCatalogo = catalogoFiltro === "Todos" || (catalogoFiltro === "Publicado" && producto.publicar_catalogo) || (catalogoFiltro === "No publicado" && !producto.publicar_catalogo) || (catalogoFiltro === "Disponible online" && producto.disponible_online);
return texto.includes(busquedaProducto.trim().toLowerCase()) && (categoriaFiltro === "Todas" || producto.categoria === categoriaFiltro) && pasaInventario && pasaCatalogo && (canalFiltro === "Todos" || (producto.canales_venta || []).includes(canalFiltro));
});

// ======================

return(

<main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-8 lg:px-10">

<div className="max-w-7xl mx-auto">

{productoReceta && (() => {
if (!recetaPiloto) return <section className="mb-10 rounded-[35px] bg-slate-950 p-8 text-white shadow-2xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-400">Producto seleccionado · {productoReceta.categoria || "Sin categoría"}</p><h1 className="mt-2 text-4xl font-black">{productoReceta.nombre}</h1><p className="mt-3 max-w-2xl text-sm text-slate-300">Este producto todavía no tiene una receta estándar. Créala para calcular sus costos automáticamente desde ingredientes e inventario.</p><Link href="/recetas" className="mt-6 inline-block rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-400">Crear receta para este producto</Link></section>;
const costoBase = recetaPiloto.receta_ingredientes.reduce((total, detalle) => total + Number(detalle.cantidad || 0) * Number(detalle.ingredientes?.costo_referencia || 0), 0);
const conMerma = costoBase * (1 + Number(recetaPiloto.merma_pct || 0));
const costoDirectoLote = conMerma + Number(recetaPiloto.costos_adicionales || 0);
const costoDirectoPorUnidad = costoDirectoLote / Math.max(0.001, Number(recetaPiloto.rendimiento || 1));
const indirectos = costoDirectoPorUnidad * Number(recetaPiloto.margen_pct || 0);
const costoCompleto = costoDirectoPorUnidad + indirectos;
const utilidadCarta = costoCompleto * Number(recetaPiloto.recargo_carta_pct || 0);
const precioAntesComision = costoCompleto + utilidadCarta;
const precioSinIva = precioAntesComision / Math.max(0.01, 1 - Number(recetaPiloto.comision_canal_pct || 0));
const precioSugerido = precioSinIva * (1 + Number(recetaPiloto.iva_pct || 0));
return <section className="mb-10 overflow-hidden rounded-[35px] bg-slate-950 p-8 text-white shadow-2xl">
<p className="text-xs font-bold uppercase tracking-[.2em] text-orange-400">Receta estándar · {productoReceta.categoria || "Sin categoría"}</p>
<h1 className="mt-2 text-4xl font-black">{productoReceta.nombre}</h1>
<p className="mt-2 text-sm text-slate-300">Costo calculado automáticamente desde los ingredientes de tu receta estándar.</p>
<div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Costo ingredientes</p><b className="text-2xl">Q{costoBase.toFixed(2)}</b></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Costo con merma</p><b className="text-2xl">Q{costoDirectoPorUnidad.toFixed(2)}</b></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Costo completo</p><b className="text-2xl">Q{costoCompleto.toFixed(2)}</b></div><div className="rounded-2xl bg-orange-500 p-4"><p className="text-xs text-orange-100">Precio sugerido con IVA</p><b className="text-2xl">Q{precioSugerido.toFixed(2)}</b></div></div>
<div className="mt-5 flex flex-col gap-3 rounded-2xl border border-orange-400/40 bg-orange-500/10 p-4 sm:flex-row sm:items-end"><div className="flex-1"><label className="block text-xs font-bold uppercase tracking-wide text-orange-200">Precio final de venta</label><p className="mt-1 text-xs text-slate-300">Este es el precio que verá el cliente y el que se usará en los pedidos.</p><div className="mt-2 flex max-w-xs overflow-hidden rounded-xl bg-white"><span className="px-3 py-3 font-bold text-slate-600">Q</span><input aria-label={`Precio final de venta de ${productoReceta.nombre}`} type="number" min="0" step="0.01" className="w-full bg-white py-3 pr-3 text-lg font-bold text-slate-900 outline-none" value={precioFinalProducto} onChange={(event) => setPrecioFinalProducto(event.target.value)} /></div></div><button type="button" onClick={guardarPrecioFinalPan} disabled={guardandoPrecioFinal} className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60">{guardandoPrecioFinal ? "Guardando..." : "Guardar precio final"}</button></div>
<div className="mt-7 overflow-x-auto rounded-2xl bg-white text-slate-900"><table className="w-full text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Ingrediente</th><th className="p-3">Cantidad</th><th className="p-3">Costo unitario</th><th className="p-3 text-right">Costo receta</th><th className="p-3 text-right">Stock</th></tr></thead><tbody>{recetaPiloto.receta_ingredientes.map((detalle) => <tr key={detalle.ingredientes?.nombre} className="border-t"><td className="p-3 font-bold">{detalle.ingredientes?.nombre}</td><td className="p-3">{Number(detalle.cantidad).toFixed(detalle.ingredientes?.unidad_base === "g" ? 1 : 2)} {detalle.ingredientes?.unidad_base}</td><td className="p-3">Q{Number(detalle.ingredientes?.costo_referencia || 0).toFixed(detalle.ingredientes?.unidad_base === "g" ? 4 : 2)}</td><td className="p-3 text-right font-bold">Q{(Number(detalle.cantidad) * Number(detalle.ingredientes?.costo_referencia || 0)).toFixed(2)}</td><td className="p-3 text-right">{Number(detalle.ingredientes?.stock_actual || 0).toFixed(detalle.ingredientes?.unidad_base === "g" ? 1 : 0)} {detalle.ingredientes?.unidad_base}</td></tr>)}</tbody></table></div>
<p className="mt-4 text-xs text-slate-300">Regla Intecap: {(Number(recetaPiloto.merma_pct) * 100).toFixed(0)}% merma · {(Number(recetaPiloto.margen_pct) * 100).toFixed(0)}% costos indirectos · {(Number(recetaPiloto.recargo_carta_pct) * 100).toFixed(0)}% utilidad de carta · {(Number(recetaPiloto.comision_canal_pct || 0) * 100).toFixed(0)}% comisión de canal · {(Number(recetaPiloto.iva_pct) * 100).toFixed(0)}% IVA.</p>
</section>;
})()}

<div id="editor-producto" className="grid gap-8 rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl lg:grid-cols-[.85fr_1.15fr] lg:p-9">

<div className="rounded-3xl bg-slate-950 p-7 text-white">
<p className="text-xs font-bold uppercase tracking-[.2em] text-orange-400">Catálogo comercial</p>
<h2 className="mt-3 text-3xl font-black">{productoEditando ? "Editando producto" : "Crea un producto listo para vender"}</h2>
<p className="mt-3 text-sm leading-6 text-slate-300">El precio final es el que se mostrará al cliente. El costo sirve para medir la utilidad mientras completas la receta estándar.</p>
<div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Productos</p><p className="mt-1 text-2xl font-black">{productos.length}</p></div><div className="rounded-2xl bg-orange-500 p-4"><p className="text-xs text-orange-100">Activos</p><p className="mt-1 text-2xl font-black">{productos.filter((producto) => producto.estado === "Activo").length}</p></div></div>
</div>

<div>

<p className="text-xs font-bold uppercase tracking-[.2em] text-orange-500">{productoEditando ? "Edición" : "Nuevo producto"}</p>
<h1 className="mt-2 text-4xl font-black text-slate-950 mb-2">

{productoEditando ? "Actualiza la información" : "Agrega un producto al catálogo"}

</h1>
<p className="mb-7 text-sm text-slate-500">Los campos con valores monetarios se registran en quetzales.</p>
{productoEditando && <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900"><b>Producto en edición:</b> {nombre}. Los cambios de esta pantalla se guardarán únicamente para este producto.</div>}

<div className="grid gap-4 sm:grid-cols-2">

<input
className="border border-slate-200 p-4 rounded-2xl outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 sm:col-span-2"
placeholder="Nombre del producto *"
value={nombre}
onChange={(e)=>
setNombre(
e.target.value
)}
/>

<input
className="border border-slate-200 p-4 rounded-2xl outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
placeholder="Marca o categoría"
value={categoria}
onChange={(e)=>
setCategoria(
e.target.value
)}
/>

<input
type="number"
className="border border-slate-200 p-4 rounded-2xl outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
placeholder="Precio final de venta"
value={precio}
onChange={(e)=>
setPrecio(
e.target.value
)}
/>

<textarea className="border border-slate-200 p-4 rounded-2xl outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 sm:col-span-2" placeholder="Descripción comercial: qué incluye, sabor, tamaño y condiciones" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
<input className="border border-slate-200 p-4 rounded-2xl outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100" placeholder="SKU o código interno" value={sku} onChange={(e) => setSku(e.target.value)} />
<label className="text-sm font-bold text-slate-700">Tiempo de preparación (minutos)<input type="number" min="0" className="mt-2 w-full border border-slate-200 p-4 rounded-2xl outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100" value={tiempoPreparacion} onChange={(e) => setTiempoPreparacion(e.target.value)} /></label>
<label className="text-sm font-bold text-slate-700">Existencias disponibles para vender<input type="number" min="0" className="mt-2 w-full border border-slate-200 p-4 rounded-2xl outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100" value={stock} onChange={(e) => setStock(e.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-500">Unidades listas para aceptar pedidos.</span></label>
<label className="text-sm font-bold text-slate-700">Stock mínimo de alerta<input type="number" min="0" className="mt-2 w-full border border-slate-200 p-4 rounded-2xl outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-500">El sistema marcará stock bajo al llegar a esta cantidad.</span></label>
<input className="border border-slate-200 p-4 rounded-2xl outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 sm:col-span-2" placeholder="Etiquetas separadas por coma: regalo, postre, aniversario" value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} />
<label className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm font-bold text-slate-700 sm:col-span-2">Foto principal del producto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFotoProducto(e.target.files?.[0] || null)} className="mt-2 block w-full text-sm font-normal" />{fotoActual && <span className="mt-2 block text-xs font-normal text-emerald-700">Este producto ya tiene una foto. Selecciona otra solo si deseas reemplazarla.</span>}</label>
<div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:col-span-2"><p className="text-sm font-black text-slate-900">Catálogo y canales de venta</p><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={publicarCatalogo} onChange={(e) => setPublicarCatalogo(e.target.checked)} /> Publicar en el catálogo digital</label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={disponibleOnline} onChange={(e) => setDisponibleOnline(e.target.checked)} /> Disponible para pedidos en línea</label><div className="flex flex-wrap gap-3">{["WhatsApp", "Web", "Facebook", "Instagram", "PedidosYa", "Uber Eats"].map((canal) => <label key={canal} className="flex items-center gap-1 text-xs font-semibold"><input type="checkbox" checked={canalesVenta.includes(canal)} onChange={(e) => setCanalesVenta(e.target.checked ? [...canalesVenta, canal] : canalesVenta.filter((actual) => actual !== canal))} /> {canal}</label>)}</div></div>

<label className="text-sm font-bold text-slate-700">Costo actual (Q)<input type="number" min="0" step="0.01" className="mt-2 w-full border border-slate-200 p-4 rounded-2xl outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100" value={costo} onChange={(e) => setCosto(e.target.value)} /></label>

<button

disabled={subiendoFoto}
onClick={
guardarProducto
}

className="bg-slate-950 text-white p-4 rounded-2xl font-bold transition hover:bg-orange-600 sm:col-span-2"

>

{

productoEditando

?

subiendoFoto ? "Subiendo foto..." : "Actualizar Producto"

:

subiendoFoto ? "Subiendo foto..." : "Guardar Producto"

}

</button>

{productoEditando && <button type="button" onClick={() => { setProductoEditando(null); setNombre(""); setCategoria(""); setPrecio(""); setCosto(""); }} className="-mt-1 text-sm font-bold text-slate-500 underline sm:col-span-2">Cancelar edición</button>}

</div>

</div>

</div>

<div className="mt-10 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl">

<div className="border-b border-slate-200 p-6 sm:p-8">
<div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
<div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-500">Catálogo</p><h2 className="mt-2 text-3xl font-black text-slate-950">Productos guardados</h2><p className="mt-1 text-sm text-slate-500">{productosFiltrados.length} de {productos.length} productos visibles</p></div>
<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Link href="/recetas" className="rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-orange-600">Recetas y costos</Link><input aria-label="Buscar productos" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-500" placeholder="Nombre, código, etiqueta o categoría" value={busquedaProducto} onChange={(event) => setBusquedaProducto(event.target.value)} /><select aria-label="Filtrar por categoría" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-orange-500" value={categoriaFiltro} onChange={(event) => setCategoriaFiltro(event.target.value)}><option>Todas</option>{categorias.map((categoria) => <option key={categoria}>{categoria}</option>)}</select><select aria-label="Filtrar por inventario" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-orange-500" value={inventarioFiltro} onChange={(event) => setInventarioFiltro(event.target.value)}><option>Todos</option><option>Disponible</option><option>Stock bajo</option><option>Sin existencias</option></select><select aria-label="Filtrar por catálogo" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-orange-500" value={catalogoFiltro} onChange={(event) => setCatalogoFiltro(event.target.value)}><option>Todos</option><option>Publicado</option><option>No publicado</option><option>Disponible online</option></select><select aria-label="Filtrar por canal" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-orange-500" value={canalFiltro} onChange={(event) => setCanalFiltro(event.target.value)}><option>Todos</option>{canales.map((canal) => <option key={canal}>{canal}</option>)}</select></div>
</div>
</div>

<div className="overflow-x-auto p-3 sm:p-5">

<table className="w-full min-w-[1180px] table-auto text-sm">

<thead>

<tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">

<th className="p-5 text-left">
Producto y código
</th>

<th className="p-5 text-left">
Categoría
</th>

<th className="p-5 text-left">
Inventario
</th>

<th className="p-5 text-left">
Catálogo
</th>

<th className="p-5 text-left">
Precio final
</th>

<th className="p-5 text-left">
Costo
</th>

<th className="p-5 text-left">
Ganancia
</th>

<th className="p-5 text-left">
Estado
</th>

<th className="p-5 text-left">
Acciones
</th>

</tr>

</thead>

<tbody className="divide-y">

{

productosFiltrados.map(
(producto)=>(

<tr className="border-b border-slate-100 transition hover:bg-orange-50/40"
key={
producto.id
}
>

<td className="p-5"><div className="flex min-w-[230px] items-center gap-3">{producto.imagen_url ? <Image src={producto.imagen_url} alt={producto.nombre} width={48} height={48} className="size-12 rounded-xl border border-slate-200 object-cover" /> : <div className="grid size-12 place-items-center rounded-xl bg-orange-50 text-xs font-black text-orange-600">SIN<br/>FOTO</div>}<div><p className="font-bold text-slate-950">{producto.nombre}</p><p className="mt-1 font-mono text-[11px] font-bold uppercase text-slate-500">{producto.sku || "SIN CÓDIGO"}</p>{producto.descripcion && <p className="mt-1 max-w-[240px] truncate text-xs text-slate-500">{producto.descripcion}</p>}</div></div></td>

<td className="p-5 text-slate-600">

{
producto.categoria
}

</td>

<td className="p-5"><p className={`font-black ${Number(producto.stock || 0) <= 0 ? "text-rose-600" : Number(producto.stock || 0) <= Number(producto.stock_minimo || 0) ? "text-amber-600" : "text-emerald-700"}`}>{Number(producto.stock || 0)} u.</p><p className="mt-1 text-[11px] text-slate-500">Mínimo: {Number(producto.stock_minimo || 0)}</p></td>

<td className="p-5"><div className="flex flex-col items-start gap-1">{producto.publicar_catalogo ? <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">Publicado</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">Interno</span>}<span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${producto.disponible_online && Number(producto.stock || 0) > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{producto.disponible_online && Number(producto.stock || 0) > 0 ? "Disponible online" : "No disponible"}</span></div></td>

<td className="p-5 text-emerald-700 font-bold">

Q{
Number(
producto.precio_venta
).toFixed(2)
}

</td>

<td className="p-5 text-rose-600">

Q{
Number(
producto.costo || 0
).toFixed(2)
}

</td>

<td className="p-5 text-blue-700 font-black">

Q{

(
Number(
producto.precio_venta
)
-

Number(
producto.costo
)

).toFixed(2)

}

</td>

<td className="p-5">

<span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 text-xs font-bold rounded-full">

{
producto.estado
}

</span>

</td>

<td className="p-5">

<div className="flex gap-3">

<button

className="bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition hover:bg-amber-600"

onClick={()=>{

void cargarResumenProducto(producto);

setProductoEditando(
producto.id
);

setNombre(
producto.nombre
);

setCategoria(
producto.categoria ?? ""
);

setPrecio(
String(
producto.precio_venta
)
);

setCosto(
String(
producto.costo
)
);
setStock(String(producto.stock ?? 0)); setStockMinimo(String(producto.stock_minimo ?? 0)); setDescripcion(producto.descripcion ?? ""); setSku(producto.sku ?? ""); setTiempoPreparacion(producto.tiempo_preparacion_min == null ? "" : String(producto.tiempo_preparacion_min)); setEtiquetas((producto.etiquetas || []).join(", ")); setPublicarCatalogo(Boolean(producto.publicar_catalogo)); setDisponibleOnline(producto.disponible_online !== false); setCanalesVenta(producto.canales_venta?.length ? producto.canales_venta : ["WhatsApp", "Web"]); setFotoActual(producto.imagen_url ?? ""); setFotoProducto(null);

window.scrollTo({

top:document.getElementById("editor-producto")?.getBoundingClientRect().top ?? 0,

behavior:
"smooth"

});

}}

>

Editar

</button>

<button

className="bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition hover:bg-rose-700"

onClick={()=>

eliminarProducto(

producto.id,

producto.nombre

)

}

>

Eliminar

</button>

</div>

</td>

</tr>

)

)

}

{productosFiltrados.length === 0 && <tr><td colSpan={9} className="p-12 text-center text-slate-500">No encontramos productos con esos filtros.</td></tr>}
</tbody>

</table>

</div>

</div>

</div>

</main>

);

}
