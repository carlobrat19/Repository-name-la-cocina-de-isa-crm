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

// ======================

return(

<main className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-10">

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

<div className="bg-white rounded-[35px] shadow-2xl p-10 max-w-3xl mx-auto">

<h1 className="text-5xl font-black mb-8">

Nuevo Producto

</h1>

<div className="grid gap-5">

<input
className="border border-gray-200 p-5 rounded-2xl"
placeholder="Nombre"
value={nombre}
onChange={(e)=>
setNombre(
e.target.value
)}
/>

<input
className="border border-gray-200 p-5 rounded-2xl"
placeholder="Categoría"
value={categoria}
onChange={(e)=>
setCategoria(
e.target.value
)}
/>

<input
type="number"
className="border border-gray-200 p-5 rounded-2xl"
placeholder="Precio final de venta"
value={precio}
onChange={(e)=>
setPrecio(
e.target.value
)}
/>

<input
type="number"
className="border border-gray-200 p-5 rounded-2xl"
placeholder="Costo"
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

className="
bg-black
text-white
p-5
rounded-2xl
font-bold
"

>

{

productoEditando

?

"Actualizar Producto"

:

"Guardar Producto"

}

</button>

</div>

</div>

<div className="mt-10 bg-white rounded-[35px] shadow-2xl p-10">

<h2 className="text-3xl font-black mb-10">

Productos Guardados

</h2>

<div className="overflow-x-auto">

<table className="w-full table-auto">

<thead>

<tr className="border-b">

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

productos.map(
(producto)=>(

<tr
key={
producto.id
}
>

<td className="p-6 font-bold">

{
producto.nombre
}

</td>

<td className="p-6">

{
producto.categoria
}

</td>

<td className="p-6 text-green-700 font-bold">

Q{
Number(
producto.precio_venta
).toFixed(2)
}

</td>

<td className="p-6 text-red-600">

Q{
Number(
producto.costo || 0
).toFixed(2)
}

</td>

<td className="p-6 text-blue-700 font-black">

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

<td className="p-6">

<span className="bg-green-100 text-green-700 px-4 py-2 rounded-full">

{
producto.estado
}

</span>

</td>

<td className="p-6">

<div className="flex gap-3">

<button

className="bg-yellow-500 text-white px-5 py-2 rounded-xl"

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

top:0,

behavior:
"smooth"

});

}}

>

Editar

</button>

<button

className="bg-red-600 text-white px-5 py-2 rounded-xl"

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

</tbody>

</table>

</div>

</div>

</div>

</main>

);

}
