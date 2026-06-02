"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function PedidosPage() {

  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");

  const [fechaCreacion, setFechaCreacion] =
    useState("");

  const [fechaEntrega, setFechaEntrega] =
    useState("");

  const [estado, setEstado] =
    useState("Pendiente");

  const [pagoEstado, setPagoEstado] =
    useState("Pendiente");

  const [formaPago, setFormaPago] =
    useState("Efectivo");

  const [observaciones, setObservaciones] =
    useState("");

  const [productos, setProductos] =
    useState<any[]>([]);

  const [
    productoSeleccionado,
    setProductoSeleccionado,
  ] = useState("");

  const [cantidad, setCantidad] =
    useState(1);

  const [carrito, setCarrito] =
    useState<any[]>([]);
  
  const [vendedor,setVendedor]=
useState(
"REDES"
);
const [requiereEnvio,setRequiereEnvio]=
useState(false);  

  // OBTENER PRODUCTOS
  async function obtenerProductos() {

    const { data, error } =
      await supabase
        .from("productos")
        .select("*")
        .order("nombre");

    if (error) {
      console.log(error);
      return;
    }

    setProductos(data || []);
  }

  useEffect(() => {
    obtenerProductos();
  }, []);

  // AGREGAR PRODUCTO
  const agregarProducto = () => {

    const producto = productos.find(
      (p) => p.id === productoSeleccionado
    );

    if (!producto) {
      alert("Selecciona un producto");
      return;
    }

    const precioProducto = Number(
      producto.precio_venta || 0
    );

    const subtotal =
      precioProducto * Number(cantidad);

    const nuevoProducto = {
      id: producto.id,
      nombre: producto.nombre,
      cantidad: Number(cantidad),
      precio: precioProducto,
      subtotal,
    };

    setCarrito([
      ...carrito,
      nuevoProducto,
    ]);

    setProductoSeleccionado("");
    setCantidad(1);
  };

  // ELIMINAR PRODUCTO
  const eliminarProducto = (
    index: number
  ) => {

    const nuevosProductos =
      carrito.filter(
        (_, i) => i !== index
      );

    setCarrito(nuevosProductos);
  };

  // TOTAL PEDIDO
  const totalPedido = carrito.reduce(
    (acc, item) => {

      return (
        acc +
        Number(item.precio) *
          Number(item.cantidad)
      );

    },
    0
  );

  // GUARDAR PEDIDO
  async function guardarPedido() {

    if (carrito.length === 0) {
      alert("Agrega productos");
      return;
    }

    // GUARDAR PEDIDO
    const {
      data: pedidoData,
      error: pedidoError,
    } = await supabase
      .from("pedidos")
      .insert([
{
cliente,

telefono,

direccion,

fecha_pedido:
fechaCreacion,

fecha_entrega:
fechaEntrega,

estado,

pago_estado:
pagoEstado,

forma_pago:
formaPago,

total:
totalPedido,

observaciones,

vendedor,
requiere_envio:
requiereEnvio,

codigo:
"",
},
])
      .select();

    // ERROR PEDIDO
    if (pedidoError) {
      console.log(pedidoError);
      alert(
        JSON.stringify(
          pedidoError
        )
      );
      return;
    }

    // OBTENER ID
    const pedidoId =
      pedidoData[0].id;

    // GENERAR CODIGO ERP
    const numeroPedido =
      pedidoData[0].numero_pedido;

    const codigoERP =
      "PED-" +
      String(
        numeroPedido
      ).padStart(4, "0");

    // ACTUALIZAR CODIGO
    await supabase
      .from("pedidos")
      .update({
        codigo: codigoERP,
      })
      .eq("id", pedidoId);

    // DETALLE PRODUCTOS
    const detalleProductos =
      carrito.map((item) => ({
        pedido_id: pedidoId,

        producto_id: item.id,

        cantidad: Number(
          item.cantidad
        ),

        precio: Number(
          item.precio
        ),

        costo:
          Number(item.precio) *
          Number(item.cantidad),
      }));

    // GUARDAR DETALLE
    const {
      error: detalleError,
    } = await supabase
      .from("pedido_detalle")
      .insert(detalleProductos);

    // ERROR DETALLE
    if (detalleError) {
      console.log(detalleError);
      alert(
        JSON.stringify(
          detalleError
        )
      );
      return;
    }

    // MENSAJE
    alert(
      `Pedido ${codigoERP} guardado correctamente`
    );

    // LIMPIAR FORMULARIO
    setCliente("");
    setTelefono("");
    setDireccion("");

    setFechaCreacion("");
    setFechaEntrega("");

    setEstado("Pendiente");

    setPagoEstado("Pendiente");

    setFormaPago("Efectivo");

    setObservaciones("");

    setProductoSeleccionado("");
    setCantidad(1);

    setCarrito([]);
  }

  return (

    <main className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8">

      <div className="max-w-4xl mx-auto bg-white rounded-[35px] shadow-2xl border border-gray-200 p-10 space-y-8">

        {/* TITULO */}
        <div>

          <h1 className="text-5xl font-black text-gray-900 tracking-tight">
            Nuevo Pedido
          </h1>

          <p className="text-gray-500 mt-2 font-medium">
            Gestión profesional de pedidos
          </p>

        </div>

        {/* FORMULARIO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CLIENTE */}
          <div className="space-y-2">

            <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Cliente
            </label>

            <input
              className="w-full border border-gray-300 bg-gray-50 text-black focus:bg-white focus:border-black outline-none transition-all p-4 rounded-2xl shadow-sm"
              placeholder="Nombre del cliente"
              value={cliente}
              onChange={(e) =>
                setCliente(
                  e.target.value
                )
              }
            />

          </div>

          {/* TELEFONO */}
          <div className="space-y-2">

            <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Teléfono
            </label>

            <input
              className="w-full border border-gray-300 bg-gray-50 text-black focus:bg-white focus:border-black outline-none transition-all p-4 rounded-2xl shadow-sm"
              placeholder="Número telefónico"
              value={telefono}
              onChange={(e) =>
                setTelefono(
                  e.target.value
                )
              }
            />

          </div>

          {/* DIRECCION */}
          <div className="space-y-2 md:col-span-2">

            <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Dirección
            </label>

            <input
              className="w-full border border-gray-300 bg-gray-50 text-black focus:bg-white focus:border-black outline-none transition-all p-4 rounded-2xl shadow-sm"
              placeholder="Dirección de entrega"
              value={direccion}
              onChange={(e) =>
                setDireccion(
                  e.target.value
                )
              }
            />

          </div>

          {/* FECHA CREACION */}
          <div className="space-y-2">

            <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Fecha de Creación
            </label>

            <input
              type="date"
              className="w-full border border-gray-300 bg-gray-50 text-black focus:bg-white focus:border-black outline-none transition-all p-4 rounded-2xl shadow-sm"
              value={fechaCreacion}
              onChange={(e) =>
                setFechaCreacion(
                  e.target.value
                )
              }
            />

          </div>

          {/* FECHA ENTREGA */}
          <div className="space-y-2">

            <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Fecha de Entrega
            </label>

            <input
              type="date"
              className="w-full border border-gray-300 bg-gray-50 text-black focus:bg-white focus:border-black outline-none transition-all p-4 rounded-2xl shadow-sm"
              value={fechaEntrega}
              onChange={(e) =>
                setFechaEntrega(
                  e.target.value
                )
              }
            />

          </div>

          {/* ESTADO */}
          <div className="space-y-2">

            <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Estado del Pedido
            </label>

            <select
              className="w-full border border-gray-300 bg-gray-50 text-black focus:bg-white focus:border-black outline-none transition-all p-4 rounded-2xl shadow-sm"
              value={estado}
              onChange={(e) =>
                setEstado(
                  e.target.value
                )
              }
            >
              <option>
                Pendiente
              </option>

              <option>
                En Proceso
              </option>

              <option>
                Entregado
              </option>

            </select>

          </div>

          {/* PAGO */}
          <div className="space-y-2">

            <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Estado de Pago
            </label>

            <select
              className="w-full border border-gray-300 bg-gray-50 text-black focus:bg-white focus:border-black outline-none transition-all p-4 rounded-2xl shadow-sm"
              value={pagoEstado}
              onChange={(e) =>
                setPagoEstado(
                  e.target.value
                )
              }
            >
              <option>
                Pendiente
              </option>

              <option>
                Pagado
              </option>

            </select>

          </div>

          {/* FORMA PAGO */}
          <div className="space-y-2 md:col-span-2">

            <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Forma de Pago
            </label>

            <select
              className="w-full border border-gray-300 bg-gray-50 text-black focus:bg-white focus:border-black outline-none transition-all p-4 rounded-2xl shadow-sm"
              value={formaPago}
              onChange={(e) =>
                setFormaPago(
                  e.target.value
                )
              }
            >
              <option>
                Efectivo
              </option>

              <option>
                Transferencia
              </option>

              <option>
                Tarjeta
              </option>

            </select>

          </div>

        </div>

        {/* AGREGAR PRODUCTOS */}
        <div className="bg-gray-50 border border-gray-200 rounded-[30px] p-6 space-y-6">

          <div>

            <h2 className="text-4xl font-black text-gray-900">
              Agregar Productos
            </h2>

            <p className="text-gray-500 mt-1">
              Selecciona productos para el pedido
            </p>

          </div>

          {/* PRODUCTO */}
          <div className="space-y-2">

            <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Producto
            </label>

            <select
              className="w-full border border-gray-300 bg-white text-black focus:border-black outline-none transition-all p-4 rounded-2xl shadow-sm"
              value={productoSeleccionado}
              onChange={(e) =>
                setProductoSeleccionado(
                  e.target.value
                )
              }
            >

              <option value="">
                Seleccionar Producto
              </option>

              {productos.map((producto) => (

                <option
                  key={producto.id}
                  value={producto.id}
                >
                  {producto.nombre} - Q
                  {Number(
                    producto.precio_venta
                  ).toFixed(2)}
                </option>

              ))}

            </select>

          </div>

          {/* CANTIDAD */}
          <div className="space-y-2">

            <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Cantidad
            </label>

            <input
              type="number"
              min="1"
              className="w-full border border-gray-300 bg-white text-black placeholder-gray-400 focus:border-black outline-none transition-all p-4 rounded-2xl shadow-sm"
              value={cantidad}
              onChange={(e) =>
                setCantidad(
                  Number(e.target.value)
                )
              }
            />

          </div>

          {/* BOTON */}
          <button
            onClick={agregarProducto}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl"
          >
            Agregar Producto
          </button>

        </div>

        {/* PRODUCTOS DEL PEDIDO */}
        <div className="bg-gray-50 border border-gray-200 rounded-[30px] p-6 space-y-6">

          <h2 className="text-4xl font-black text-gray-900">
            Productos del Pedido
          </h2>

          {carrito.length === 0 ? (

            <p className="text-gray-500">
              No hay productos agregados.
            </p>

          ) : (

            <div className="space-y-4">

              {carrito.map((item, index) => (

                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-2xl p-5 flex justify-between items-center shadow-sm"
                >

                  <div>

                    <p className="font-black text-gray-900 uppercase text-lg">
                      {item.nombre}
                    </p>

                    <p className="text-gray-500 mt-1">
                      {item.cantidad} x Q
                      {Number(
                        item.precio
                      ).toFixed(2)}
                    </p>

                  </div>

                  <div className="flex items-center gap-4">

                    <p className="text-3xl font-black text-green-600">
                      Q
                      {Number(
                        item.subtotal
                      ).toFixed(2)}
                    </p>

                    <button
                      onClick={() =>
                        eliminarProducto(
                          index
                        )
                      }
                      className="bg-red-500 hover:bg-red-600 text-white w-12 h-12 rounded-2xl font-black transition-all"
                    >
                      X
                    </button>

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>

        {/* TOTAL */}
        <div className="bg-gradient-to-r from-black to-blue-950 rounded-[30px] p-8 text-center shadow-2xl">

          <p className="text-gray-400 uppercase tracking-widest font-black text-sm">
            Total del Pedido
          </p>

          <h2 className="text-6xl font-black text-white mt-2">
            Q
            {Number(
              totalPedido
            ).toFixed(2)}
          </h2>

        </div>

        {/* OBSERVACIONES */}
        <div className="space-y-2">

          <label className="text-sm font-black text-gray-700 uppercase tracking-widest">
            Observaciones
          </label>

          <textarea
            className="w-full border border-gray-300 bg-gray-50 text-black focus:bg-white focus:border-black outline-none transition-all p-4 rounded-2xl shadow-sm"
            rows={4}
            placeholder="Notas adicionales del pedido"
            value={observaciones}
            onChange={(e) =>
              setObservaciones(
                e.target.value
              )
            }
          />

        </div>
        <div className="mb-6">

  <p className="font-bold mb-2">
    Requiere envío
  </p>

  <select
    value={requiereEnvio ? "SI" : "NO"}
    onChange={(e) =>
      setRequiereEnvio(
        e.target.value === "SI"
      )
    }
    className="
      w-full
      border
      border-gray-300
      p-4
      rounded-2xl
      bg-white
    "
  >
    <option value="NO">
      No
    </option>

    <option value="SI">
      Sí
    </option>

  </select>

</div>
<div> 

<p className="
mb-2
font-bold
">

Vendedor

</p>

<select

value={vendedor}

onChange={
(e)=>

setVendedor(
e.target.value
)

}

className="
w-full
border
rounded-2xl
p-4
"

>

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

</div>
        {/* BOTON GUARDAR */}
        <button
          onClick={guardarPedido}
          className="w-full bg-black hover:bg-gray-900 text-white font-black py-5 rounded-2xl transition-all shadow-2xl text-xl"
        >
          Guardar Pedido
        </button>

      </div>

    </main>
  );
}