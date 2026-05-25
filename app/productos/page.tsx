"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ProductosPage() {

const [nombre,setNombre]=useState("");
const [categoria,setCategoria]=useState("");
const [precio,setPrecio]=useState("");
const [costo,setCosto]=useState("");

const [productos,setProductos]=
useState<any[]>([]);

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

setProductos(
data || []
);

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

obtenerProductos();

},[]);

// ======================

return(

<main className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-10">

<div className="max-w-7xl mx-auto">

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
placeholder="Precio Venta"
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
Precio
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
(producto:any)=>(

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
producto.categoria
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