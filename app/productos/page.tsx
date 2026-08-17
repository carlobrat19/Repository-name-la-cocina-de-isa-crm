"use client";

import { useEffect, useState } from "react";
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
  receta_ingredientes: IngredienteReceta[];
};

type Producto = {
  id: string;
  nombre: string;
  categoria?: string | null;
  precio_venta: number | string;
  costo?: number | string | null;
  estado?: string | null;
};

export default function ProductosPage() {

const [nombre,setNombre]=useState("");
const [categoria,setCategoria]=useState("");
const [precio,setPrecio]=useState("");
const [costo,setCosto]=useState("");

const [productos,setProductos]=
useState<Producto[]>([]);

const [recetaPiloto, setRecetaPiloto] = useState<RecetaPiloto | null>(null);
const [panDeBanano, setPanDeBanano] = useState<Producto | null>(null);
const [precioFinalPan, setPrecioFinalPan] = useState("");
const [guardandoPrecioFinal, setGuardandoPrecioFinal] = useState(false);
const [busquedaProducto, setBusquedaProducto] = useState("");
const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");

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

const panBanano = productosCargados.find((producto) => producto.nombre === "PAN DE BANANO");
if (panBanano) {
setPanDeBanano(panBanano);
setPrecioFinalPan(String(panBanano.precio_venta ?? ""));
const recetaRespuesta = await supabase
.from("recetas_estandar")
.select("rendimiento, unidad_rendimiento, merma_pct, margen_pct, iva_pct, recargo_carta_pct, receta_ingredientes(cantidad, ingredientes(nombre, unidad_base, costo_referencia, stock_actual))")
.eq("producto_id", panBanano.id)
.maybeSingle();
if (!recetaRespuesta.error) setRecetaPiloto(recetaRespuesta.data as RecetaPiloto | null);
}

}

async function guardarPrecioFinalPan() {
if (!panDeBanano || !precioFinalPan || Number(precioFinalPan) < 0) {
alert("Ingresa un precio de venta final válido.");
return;
}

setGuardandoPrecioFinal(true);
const { error } = await supabase
.from("productos")
.update({ precio_venta: Number(precioFinalPan) })
.eq("id", panDeBanano.id);
setGuardandoPrecioFinal(false);

if (error) {
console.error(error);
alert("No se pudo guardar el precio final de venta.");
return;
}

alert("Precio final de venta actualizado.");
obtenerProductos();
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

if(
productoEditando
){

const resultado =

await supabase

.from(
"productos"
)

.update({

nombre,

categoria,

precio_venta:
Number(
precio
),

costo:
Number(
costo
),

})

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

.insert([
{

nombre,

categoria,

precio_venta:
Number(
precio
),

costo:
Number(
costo
),

estado:
"Activo"

}
]);

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
},[]);

const categorias = Array.from(new Set(productos.map((producto) => producto.categoria?.trim()).filter(Boolean))) as string[];
const productosFiltrados = productos.filter((producto) => {
const texto = `${producto.nombre} ${producto.categoria ?? ""}`.toLowerCase();
return texto.includes(busquedaProducto.trim().toLowerCase()) && (categoriaFiltro === "Todas" || producto.categoria === categoriaFiltro);
});

// ======================

return(

<main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-8 lg:px-10">

<div className="max-w-7xl mx-auto">

{recetaPiloto && (() => {
const costoBase = recetaPiloto.receta_ingredientes.reduce((total, detalle) => total + Number(detalle.cantidad || 0) * Number(detalle.ingredientes?.costo_referencia || 0), 0);
const conMerma = costoBase * (1 + Number(recetaPiloto.merma_pct || 0));
const precioSugerido = conMerma * (1 + Number(recetaPiloto.margen_pct || 0)) * (1 + Number(recetaPiloto.iva_pct || 0)) * (1 + Number(recetaPiloto.recargo_carta_pct || 0));
return <section className="mb-10 overflow-hidden rounded-[35px] bg-slate-950 p-8 text-white shadow-2xl">
<p className="text-xs font-bold uppercase tracking-[.2em] text-orange-400">Receta piloto · La Cocina de Isa</p>
<h1 className="mt-2 text-4xl font-black">Pan de Banano</h1>
<p className="mt-2 text-sm text-slate-300">Costo calculado automáticamente desde los ingredientes de tu receta estándar.</p>
<div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Costo ingredientes</p><b className="text-2xl">Q{costoBase.toFixed(2)}</b></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Costo con merma</p><b className="text-2xl">Q{conMerma.toFixed(2)}</b></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Rendimiento</p><b className="text-2xl">{recetaPiloto.rendimiento} {recetaPiloto.unidad_rendimiento}</b></div><div className="rounded-2xl bg-orange-500 p-4"><p className="text-xs text-orange-100">Precio sugerido (referencia)</p><b className="text-2xl">Q{precioSugerido.toFixed(2)}</b></div></div>
<div className="mt-5 flex flex-col gap-3 rounded-2xl border border-orange-400/40 bg-orange-500/10 p-4 sm:flex-row sm:items-end"><div className="flex-1"><label className="block text-xs font-bold uppercase tracking-wide text-orange-200">Precio final de venta</label><p className="mt-1 text-xs text-slate-300">Este es el precio que verá el cliente y el que se usará en los pedidos.</p><div className="mt-2 flex max-w-xs overflow-hidden rounded-xl bg-white"><span className="px-3 py-3 font-bold text-slate-600">Q</span><input aria-label="Precio final de venta de Pan de Banano" type="number" min="0" step="0.01" className="w-full bg-white py-3 pr-3 text-lg font-bold text-slate-900 outline-none" value={precioFinalPan} onChange={(event) => setPrecioFinalPan(event.target.value)} /></div></div><button type="button" onClick={guardarPrecioFinalPan} disabled={guardandoPrecioFinal} className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60">{guardandoPrecioFinal ? "Guardando..." : "Guardar precio final"}</button></div>
<div className="mt-7 overflow-x-auto rounded-2xl bg-white text-slate-900"><table className="w-full text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Ingrediente</th><th className="p-3">Cantidad</th><th className="p-3">Costo unitario</th><th className="p-3 text-right">Costo receta</th><th className="p-3 text-right">Stock</th></tr></thead><tbody>{recetaPiloto.receta_ingredientes.map((detalle) => <tr key={detalle.ingredientes?.nombre} className="border-t"><td className="p-3 font-bold">{detalle.ingredientes?.nombre}</td><td className="p-3">{Number(detalle.cantidad).toFixed(detalle.ingredientes?.unidad_base === "g" ? 1 : 2)} {detalle.ingredientes?.unidad_base}</td><td className="p-3">Q{Number(detalle.ingredientes?.costo_referencia || 0).toFixed(detalle.ingredientes?.unidad_base === "g" ? 4 : 2)}</td><td className="p-3 text-right font-bold">Q{(Number(detalle.cantidad) * Number(detalle.ingredientes?.costo_referencia || 0)).toFixed(2)}</td><td className="p-3 text-right">{Number(detalle.ingredientes?.stock_actual || 0).toFixed(detalle.ingredientes?.unidad_base === "g" ? 1 : 0)} {detalle.ingredientes?.unidad_base}</td></tr>)}</tbody></table></div>
<p className="mt-4 text-xs text-slate-300">Regla importada: {(Number(recetaPiloto.merma_pct) * 100).toFixed(0)}% merma · {(Number(recetaPiloto.margen_pct) * 100).toFixed(0)}% margen · {(Number(recetaPiloto.iva_pct) * 100).toFixed(0)}% IVA · {(Number(recetaPiloto.recargo_carta_pct) * 100).toFixed(0)}% recargo de carta.</p>
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

<input
type="number"
className="border border-slate-200 p-4 rounded-2xl outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
placeholder="Costo actual *"
value={costo}
onChange={(e)=>
setCosto(
e.target.value
)}
/>

<button

onClick={
guardarProducto
}

className="bg-slate-950 text-white p-4 rounded-2xl font-bold transition hover:bg-orange-600 sm:col-span-2"

>

{

productoEditando

?

"Actualizar Producto"

:

"Guardar Producto"

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
<div className="grid gap-3 sm:grid-cols-2"><input aria-label="Buscar productos" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-500" placeholder="Buscar producto o categoría" value={busquedaProducto} onChange={(event) => setBusquedaProducto(event.target.value)} /><select aria-label="Filtrar por categoría" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-orange-500" value={categoriaFiltro} onChange={(event) => setCategoriaFiltro(event.target.value)}><option>Todas</option>{categorias.map((categoria) => <option key={categoria}>{categoria}</option>)}</select></div>
</div>
</div>

<div className="overflow-x-auto p-3 sm:p-5">

<table className="w-full min-w-[880px] table-auto text-sm">

<thead>

<tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">

<th className="p-5 text-left">
Producto
</th>

<th className="p-5 text-left">
Categoría
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

<td className="p-5 font-bold text-slate-950">

{
producto.nombre
}

</td>

<td className="p-5 text-slate-600">

{
producto.categoria
}

</td>

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

{productosFiltrados.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-slate-500">No encontramos productos con esos filtros.</td></tr>}
</tbody>

</table>

</div>

</div>

</div>

</main>

);

}
