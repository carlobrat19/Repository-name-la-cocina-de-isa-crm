"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function FlujoCajaPage() {

const [tipo,setTipo]=useState("Ingreso");
const [categoria,setCategoria]=useState("");
const [descripcion,setDescripcion]=useState("");
const [monto,setMonto]=useState("");
const [cuenta,setCuenta]=useState("Banco");

const [movimientos,setMovimientos]=
useState<any[]>([]);

const [saldo,setSaldo]=
useState(0);

const [filtro,setFiltro]=
useState("Mes");

const [desde,setDesde]=
useState("");

const [hasta,setHasta]=
useState("");

useEffect(()=>{
cargarMovimientos();
},[
filtro,
desde,
hasta
]);

async function cargarMovimientos(){

let query=
supabase
.from(
"movimientos_caja"
)
.select("*")
.order(
"fecha",
{
ascending:false
}
)
.order(
"id",
{
ascending:false
}
);

const hoy=
new Date();

if(
filtro==="Hoy"
){

const fecha=
hoy
.toISOString()
.split("T")[0];

query=
query.eq(
"fecha",
fecha
);

}

if(
filtro==="Semana"
){

const inicio=
new Date();

inicio.setDate(
hoy.getDate()-7
);

query=
query.gte(
"fecha",
inicio
.toISOString()
.split("T")[0]
);

}

if(
filtro==="Mes"
){

const inicio=
new Date(
hoy.getFullYear(),
hoy.getMonth(),
1
);

query=
query.gte(
"fecha",
inicio
.toISOString()
.split("T")[0]
);

}

if(
desde
&&
hasta
){

query=
query
.gte(
"fecha",
desde
)
.lte(
"fecha",
hasta
);

}

const {
data,
error
}
=
await query;

if(
error
){
console.log(
error
);
return;
}

setMovimientos(
data||[]
);

let ingresos=
0;

let gastos=
0;

(data||[])
.forEach(
(
item
)=>{

if(
item.tipo==="Ingreso"
){

ingresos+=
Number(
item.monto
);

}

if(
item.tipo==="Gasto"
){

gastos+=
Number(
item.monto
);

}

}
);

setSaldo(
ingresos-
gastos
);

}

async function guardarMovimiento(){

if(
!categoria
||
!monto
){
alert(
"Completa datos"
);
return;
}

const {
error
}
=
await supabase
.from(
"movimientos_caja"
)
.insert([
{
tipo,
categoria,
descripcion,
monto:
Number(
monto
),
cuenta,
fecha:
new Date()
.toISOString()
.split("T")[0]
}
]);

if(
error
){
alert(
"Error"
);
return;
}

setCategoria("");
setDescripcion("");
setMonto("");

cargarMovimientos();

}

const ingresos=
movimientos
.filter(
x=>
x.tipo==="Ingreso"
)
.reduce(
(a,b)=>
a+
Number(
b.monto
),
0
);

const gastos=
movimientos
.filter(
x=>
x.tipo==="Gasto"
)
.reduce(
(a,b)=>
a+
Number(
b.monto
),
0
);

return(

<div className="p-10">

<h1 className="text-6xl font-black">
Flujo Caja
</h1>

<p className="text-gray-500 mb-8">
Control financiero
</p>

<div className="flex gap-4 mb-8">

<select
value={filtro}
onChange={(e)=>
setFiltro(
e.target.value
)}
className="border p-3 rounded-xl"
>

<option>
Todo
</option>

<option>
Hoy
</option>

<option>
Semana
</option>

<option>
Mes
</option>

</select>

<input
type="date"
value={desde}
onChange={(e)=>
setDesde(
e.target.value
)}
className="border p-3 rounded-xl"
/>

<input
type="date"
value={hasta}
onChange={(e)=>
setHasta(
e.target.value
)}
className="border p-3 rounded-xl"
/>

</div>

<div className="grid grid-cols-3 gap-6 mb-10">

<div className="bg-white p-8 rounded-3xl">

<p>
Saldo Actual
</p>

<h2 className="text-5xl font-black text-green-600">

Q{
saldo.toFixed(2)
}

</h2>

</div>

<div className="bg-white p-8 rounded-3xl">

<p>
Ingresos
</p>

<h2 className="text-5xl text-blue-600">

Q{ingresos}

</h2>

</div>

<div className="bg-white p-8 rounded-3xl">

<p>
Gastos
</p>

<h2 className="text-5xl text-red-600">

Q{gastos}

</h2>

</div>

</div>

<div className="bg-white p-8 rounded-3xl mb-10">

<h2 className="text-3xl font-black mb-8">

Nuevo Movimiento

</h2>

<div className="grid grid-cols-2 gap-4">

<select
value={tipo}
onChange={(e)=>
setTipo(
e.target.value
)}
className="border p-4 rounded-2xl"
>

<option>
Ingreso
</option>

<option>
Gasto
</option>

</select>

<select
value={categoria}
onChange={(e)=>
setCategoria(
e.target.value
)}
className="border p-4 rounded-2xl"
>

<option value="">
Seleccionar Categoría
</option>

{
tipo==="Ingreso"
?

<>

<option>
Venta
</option>

<option>
Capital Inicial
</option>

<option>
Transferencia
</option>

</>

:

<>

<option>
Materia Prima
</option>

<option>
Servicios
</option>

<option>
Publicidad
</option>

<option>
Otro Gasto
</option>

</>

}

</select>

<input
value={descripcion}
onChange={(e)=>
setDescripcion(
e.target.value
)}
placeholder="Descripción"
className="border p-4 rounded-2xl"
/>

<input
type="number"
value={monto}
onChange={(e)=>
setMonto(
e.target.value
)}
placeholder="Monto"
className="border p-4 rounded-2xl"
/>

<select
value={cuenta}
onChange={(e)=>
setCuenta(
e.target.value
)}
className="border p-4 rounded-2xl"
>

<option>
Banco
</option>

<option>
Efectivo
</option>

</select>

</div>

<button
onClick={
guardarMovimiento
}
className="mt-6 bg-black text-white px-8 py-4 rounded-2xl"
>

Guardar Movimiento

</button>

</div>

<div className="bg-white p-8 rounded-3xl">

<h2 className="text-3xl font-black mb-8">

Movimientos

</h2>

<div className="overflow-x-auto">

<table className="w-full">

<thead>

<tr className="border-b">

<th className="text-left p-4">
Fecha
</th>

<th className="text-left p-4">
Tipo
</th>

<th className="text-left p-4">
Categoría
</th>

<th className="text-left p-4">
Cuenta
</th>

<th className="text-right p-4">
Monto
</th>

<th className="text-left p-4">
Descripción
</th>

</tr>

</thead>

<tbody>

{
movimientos.map(
(
item
)=>(

<tr
key={
item.id
}
className="border-b"
>

<td className="p-4">
{item.fecha}
</td>

<td className="p-4">
{item.tipo}
</td>

<td className="p-4">
{item.categoria}
</td>

<td className="p-4">
{item.cuenta}
</td>

<td
className={`p-4 text-right font-black ${
item.tipo==="Ingreso"
?
"text-green-600"
:
"text-red-600"
}`}
>

Q{
Number(
item.monto
)
.toFixed(
2
)
}

</td>

<td className="p-4">
{item.descripcion}
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