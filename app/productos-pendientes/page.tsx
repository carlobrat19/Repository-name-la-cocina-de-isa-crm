"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { supabase } from "@/lib/supabase";

export default function ProductosPendientesPage() {

const [fechaInicio,setFechaInicio]=useState("");
const [fechaFin,setFechaFin]=useState("");
const [vendedor,setVendedor]=useState("Todos");
const [envioFiltro,setEnvioFiltro]=useState("Todos")

const [productos,setProductos]=
useState<any[]>([]);

async function cargarPendientes(){

let query=
supabase

.from("pedidos")

.select(`
id,
fecha_entrega,
estado,
vendedor,
requiere_envio,

pedido_detalle(
cantidad,
productos(
nombre
)
)

`)

.eq(
"estado",
"Pendiente"
);

if(
fechaInicio
){

query=
query.gte(
"fecha_entrega",
fechaInicio
);

}

if(
fechaFin
){

query=
query.lte(
"fecha_entrega",
fechaFin
);

}

if(
vendedor!=="Todos"
){

query=
query.eq(
"vendedor",
vendedor
);

}
if(
envioFiltro==="Con envío"
){

query=
query.eq(
"requiere_envio",
true
);

}

if(
envioFiltro==="Sin envío"
){

query=
query.eq(
"requiere_envio",
false
);

}
const {
data,
error
}
=
await query;

if(error){

console.log(error);

return;

}

const resumen:any=
{};

(data||[])
.forEach(
(pedido:any)=>{

pedido
.pedido_detalle
?.forEach(
(item:any)=>{

const nombre=
item
.productos
?.nombre;

if(
!nombre
)
return;

resumen[
nombre
]=
(
resumen[
nombre
]
||
0
)

+

Number(
item.cantidad
||
0
);

}

);

}

);

const resultado=

Object
.entries(
resumen
)

.map(
([
nombre,
cantidad
])=>({

nombre,

cantidad,

})
)

.sort(
(a:any,b:any)=>

b.cantidad
-
a.cantidad

);

setProductos(
resultado
);

}

useEffect(()=>{

cargarPendientes();

},[
fechaInicio,
fechaFin,
vendedor,
envioFiltro
]);

return(

<div
className="
flex
bg-gray-100
min-h-screen
"
>

<Sidebar/>

<div
className="
ml-[280px]
w-full
p-10
"
>

<h1
className="
text-5xl
font-black
"
>

Productos Pendientes

</h1>

<p
className="
text-gray-500
mt-2
mb-8
"
>

Consolidado de productos pendientes de entrega

</p>

<div
className="
grid
md:grid-cols-3
gap-4
mb-8
"
>

<input
type="date"

value={
fechaInicio
}

onChange={
(e)=>
setFechaInicio(
e.target.value
)
}

className="
p-4
rounded-2xl
"
/>

<input
type="date"

value={
fechaFin
}

onChange={
(e)=>
setFechaFin(
e.target.value
)
}

className="
p-4
rounded-2xl
"
/>

<select

value={
vendedor
}

onChange={
(e)=>
setVendedor(
e.target.value
)
}

className="
p-4
rounded-2xl
"

>

<option>
Todos
</option>

<option>
REDES
</option>

<option>
LUCIA
</option>

<option>
CARLO
</option>

<option>
ISA
</option>

<option>
MONICA
</option>

<option>
RENATA
</option>

</select>
<select

value={
envioFiltro
}

onChange={
(e)=>
setEnvioFiltro(
e.target.value
)
}

className="
p-4
rounded-2xl
"

>

<option>
Todos
</option>

<option>
Con envío
</option>

<option>
Sin envío
</option>

</select>
</div>

<div
className="
bg-white
rounded-3xl
shadow-xl
overflow-hidden
"
>

<table
className="
w-full
"
>

<thead>

<tr
className="
border-b
"
>

<th
className="
text-left
p-6
"
>

Producto

</th>

<th
className="
text-right
p-6
"
>

Cantidad Pendiente

</th>

</tr>

</thead>

<tbody>

{
productos.map(
(
item
)=>(

<tr
key={
item.nombre
}

className="
border-b
"
>

<td
className="
p-6
font-bold
"
>

{
item.nombre
}

</td>

<td
className="
p-6
text-right
text-2xl
font-black
"
>

{
item.cantidad
}

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

);

}