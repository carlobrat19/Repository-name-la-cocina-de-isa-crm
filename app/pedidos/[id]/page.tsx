"use client";

import { useEffect, useState } from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  Pencil,
  Save,
  Trash2,
  ArrowLeft,
} from "lucide-react";

import { supabase } from "../../../lib/supabase";

export default function DetallePedidoPage() {

  const params = useParams();

  const router = useRouter();

  const id = params?.id as string;

  const [pedido, setPedido] =
    useState<any>(null);

  const [detalles, setDetalles] =
    useState<any[]>([]);

  const [modoEdicion,
    setModoEdicion] =
    useState(false);

  const [productos,
    setProductos] =
    useState<any[]>([]);
  useEffect(() => {

  const style =
    document.createElement("style");

  style.innerHTML = `

    @media print {

      aside,
      nav,
      header,
      .sidebar {

        display: none !important;

      }

      body {

        background: white !important;

      }

    }

  `;

  document.head.appendChild(style);

  return () => {

    document.head.removeChild(style);

  };

}, []);
  // =========================
  // OBTENER PEDIDO
  // =========================

  async function obtenerPedido() {

    if (!id) return;

    // PEDIDO

    const {
      data,
      error,
    } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {

      console.log(error);

      alert(
        JSON.stringify(error)
      );

      return;
    }

    setPedido(data);

    // DETALLES

    const {
      data: detalleData,
      error: detalleError,
    } = await supabase
      .from("pedido_detalle")
      .select(`
        *,
        productos (
          nombre
        )
      `)
      .eq("pedido_id", id);

    if (detalleError) {

      console.log(
        detalleError
      );

    } else {

      setDetalles(
        detalleData || []
      );
    }

    // PRODUCTOS

    const {
      data: productosData,
    } = await supabase
      .from("productos")
      .select("*")
      .order("nombre");

    setProductos(
      productosData || []
    );
  }

  useEffect(() => {

    if (id) {
      obtenerPedido();
    }

  }, [id]);

  // =========================
  // ACTUALIZAR ESTADO
  // =========================

  async function actualizarEstado(
    nuevoEstado: string
  ) {

    const { error } =
      await supabase
        .from("pedidos")
        .update({
          estado: nuevoEstado,
        })
        .eq("id", id);

    if (error) {

      alert(
        "Error actualizando estado"
      );

      return;
    }

  await obtenerPedido();

router.refresh();

}

  // =========================
  // ACTUALIZAR PAGO
  // =========================

  async function actualizarPago(
nuevoPago: string
) {

const { error } =

await supabase
.from("pedidos")
.update({
pago_estado:
nuevoPago,
})
.eq(
"id",
id
);

if (error) {

alert(
"Error actualizando pago"
);

return;

}

// SOLO CUANDO PASE A PAGADO
if (

pedido?.pago_estado !==
"Pagado"

&&

nuevoPago ===
"Pagado"

) {

const {
data:
movimientoExiste
}
=

await supabase

.from(
"movimientos_caja"
)

.select(
"id"
)

.eq(
"pedido_id",
id
)

.maybeSingle();

if (
!movimientoExiste?.id
) {

const {
data:
pedidoActual
}
=

await supabase

.from(
"pedidos"
)

.select("*")

.eq(
"id",
id
)

.single();

if (
pedidoActual?.id
&&
Number(
pedidoActual.total
) > 0
) {

const {
error:
errorCaja
}
=

await supabase

.from(
"movimientos_caja"
)

.insert([{

tipo:
"Ingreso",

categoria:
"Venta",

descripcion:
`Pedido ${pedidoActual.codigo || pedidoActual.id}`,

monto:
Number(
pedidoActual.total
),

cuenta:

(
pedidoActual.forma_pago || ""
)
.toLowerCase()
.includes(
"efectivo"
)

?

"Efectivo"

:

"Banco",

pedido_id:
id,

fecha:
new Date()
.toISOString()
.split("T")[0]

}]);

if (
errorCaja
) {

console.log(
"ERROR CAJA:",
errorCaja
);

alert(
JSON.stringify(
errorCaja
)
);

}

}

}

}

await obtenerPedido();

router.refresh();

}

  // =========================
  // TOTAL
  // =========================

  const totalPedido =
    detalles.reduce(
      (acc, item) =>
        acc +
        (
          Number(item.precio || 0) *
          Number(item.cantidad || 0)
        ),
      0
    );

  // =========================
  // GUARDAR CAMBIOS
  // =========================

  async function guardarCambios() {

    const { error } =
      await supabase
        .from("pedidos")
        .update({

          cliente:
            pedido.cliente,

          telefono:
            pedido.telefono,

          direccion:
            pedido.direccion,

          total:
            totalPedido,

        })
        .eq("id", id);

    if (error) {

      alert(error.message);

      return;
    }

    for (const item of detalles) {

      if (item.id) {

        await supabase
          .from("pedido_detalle")
          .update({

            cantidad:
              item.cantidad,

            precio:
              item.precio,

            costo:
              Number(item.cantidad) *
              Number(item.precio),

          })
          .eq("id", item.id);

      } else {

        await supabase
          .from("pedido_detalle")
          .insert({

            pedido_id: id,

            producto_id:
              item.producto_id,

            cantidad:
              item.cantidad,

            precio:
              item.precio,

            costo:
              Number(item.cantidad) *
              Number(item.precio),

          });
      }
    }

    alert(
      "Pedido actualizado"
    );

    setModoEdicion(false);

    obtenerPedido();
  }

  // =========================
  // ELIMINAR PEDIDO
  // =========================

  async function eliminarPedido() {

    const confirmar =
      confirm(
        "¿Eliminar pedido?"
      );

    if (!confirmar) return;

    await supabase
      .from("pedido_detalle")
      .delete()
      .eq("pedido_id", id);

    await supabase
      .from("pedidos")
      .delete()
      .eq("id", id);

    alert(
      "Pedido eliminado"
    );

    router.push(
      "/pedidos/lista"
    );
  }

  // =========================
  // ELIMINAR PRODUCTO
  // =========================

  function eliminarProducto(
    index: number
  ) {

    const nuevos =
      detalles.filter(
        (_, i) =>
          i !== index
      );

    setDetalles(nuevos);
  }

  // =========================
  // WHATSAPP
  // =========================

  function enviarWhatsApp() {

    const mensaje =
      `Hola ${pedido.cliente}, ` +
      `tu pedido ${pedido.codigo} ` +
      `actualmente está en estado: ${pedido.estado}.`;

    const telefono =
      pedido.telefono || "";

    const url =
      `https://wa.me/502${telefono}?text=${encodeURIComponent(
        mensaje
      )}`;

    window.open(url, "_blank");
  }

  // =========================
  // LOADING
  // =========================

  if (!pedido) {

    return (

      <main className="min-h-screen flex items-center justify-center bg-gray-100">

        <p className="text-2xl font-black text-gray-700">
          Cargando pedido...
        </p>

      </main>

    );
  }

  return (

   <main
  className="
    min-h-screen
    bg-gradient-to-br
    from-gray-100
    to-gray-200
    p-8

    print:bg-white
    print:p-0
    print:m-0
    print:ml-0
    print:w-full
    print:max-w-[95%]
  "
>

      <div className="max-w-6xl mx-auto">

        {/* BOTONES */}

        <div className="
          flex
          flex-wrap
          gap-3
          mb-6
          print:hidden
        ">

          <button
            onClick={() =>
              router.back()
            }
            className="
              bg-gray-700
              hover:bg-black
              text-white
              px-5
              py-3
              rounded-2xl
              font-black
              flex
              items-center
              gap-2
            "
          >

            <ArrowLeft size={18} />

            Regresar

          </button>

          <button
            onClick={() =>
              setModoEdicion(
                !modoEdicion
              )
            }
            className="
              bg-yellow-500
              hover:bg-yellow-600
              text-white
              px-5
              py-3
              rounded-2xl
              font-black
              flex
              items-center
              gap-2
            "
          >

            <Pencil size={18} />

            Editar

          </button>

          <button
            onClick={
              guardarCambios
            }
            className="
              bg-green-600
              hover:bg-green-700
              text-white
              px-5
              py-3
              rounded-2xl
              font-black
              flex
              items-center
              gap-2
            "
          >

            <Save size={18} />

            Guardar

          </button>

          <button
            onClick={
              eliminarPedido
            }
            className="
              bg-red-600
              hover:bg-red-700
              text-white
              px-5
              py-3
              rounded-2xl
              font-black
              flex
              items-center
              gap-2
            "
          >

            <Trash2 size={18} />

            Eliminar

          </button>

        </div>

        {/* CARD */}

        <div
  className="
    bg-white
    rounded-[35px]
    shadow-2xl
    p-10

    print:shadow-none
    print:rounded-none
    print:p-2
    print:w-full
    print:max-w-full
    print:mx-0
  "
>

          {/* CODIGO */}

          <p className="text-sm font-black uppercase tracking-widest text-blue-600">
            Código Pedido
          </p>

          <h1 className="text-4xl font-black text-gray-600 mt-2">
            {pedido.codigo}
          </h1>

          {/* CLIENTE */}

          <div className="mt-6">

            <input
              value={pedido.cliente}
              disabled={!modoEdicion}
              onChange={(e) =>
                setPedido({
                  ...pedido,
                  cliente:
                    e.target.value,
                })
              }
              className="
                text-4xl
                font-black
                uppercase
                text-gray-600
                bg-transparent
                w-full
                outline-none
              "
            />

            <input
              value={pedido.telefono}
              disabled={!modoEdicion}
              onChange={(e) =>
                setPedido({
                  ...pedido,
                  telefono:
                    e.target.value,
                })
              }
              className="
                text-lg
                text-gray-500
                mt-2
                bg-transparent
                w-full
                outline-none
              "
            />

            <input
              value={pedido.direccion}
              disabled={!modoEdicion}
              onChange={(e) =>
                setPedido({
                  ...pedido,
                  direccion:
                    e.target.value,
                })
              }
              className="
                text-lg
                text-gray-500
                mt-1
                bg-transparent
                w-full
                outline-none
              "
            />

          </div>

          {/* GRID */}

<div className="mt-6">

  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

    {/* FECHA PEDIDO */}
    <div className="bg-gray-100 rounded-3xl p-4">

      <p className="text-xs uppercase font-black text-gray-500">
        Fecha Pedido
      </p>

      <h3 className="text-xl font-black text-gray-900 mt-1">
        {pedido.fecha_pedido}
      </h3>

    </div>

    {/* FECHA ENTREGA */}
    <div className="bg-gray-100 rounded-3xl p-4">

      <p className="text-xs uppercase font-black text-gray-500">
        Fecha Entrega
      </p>

      <h3 className="text-xl font-black text-gray-900 mt-1">
        {pedido.fecha_entrega}
      </h3>

    </div>

    {/* ESTADO PEDIDO */}
    <div className="bg-gray-100 rounded-3xl p-4">

      <p className="text-xs uppercase font-black text-gray-500 mb-2">
        Estado Pedido
      </p>

      <select
        value={pedido.estado}
        onChange={(e) =>
          actualizarEstado(
            e.target.value
          )
        }
        className="
          w-full
          bg-white
          border
          border-gray-300
          rounded-2xl
          p-3
          font-black
          outline-none
        "
      >

        <option>
          Pendiente
        </option>

        <option>
          Producción
        </option>

        <option>
          Empaquetado
        </option>

        <option>
          En Ruta
        </option>

        <option>
          Entregado
        </option>

      </select>

    </div>

    {/* ESTADO PAGO */}
    <div className="bg-gray-100 rounded-3xl p-4">

      <p className="text-xs uppercase font-black text-gray-500 mb-2">
        Estado Pago
      </p>

      <select
        value={
          pedido.pago_estado
        }
        onChange={(e) =>
          actualizarPago(
            e.target.value
          )
        }
        className="
          w-full
          bg-white
          border
          border-gray-300
          rounded-2xl
          p-3
          font-black
          outline-none
        "
      >

        <option>
          Pendiente
        </option>

        <option>
          Pagado
        </option>

      </select>

    </div>

  </div>

  {/* FORMA PAGO */}

  <div className="
    bg-gray-100
    rounded-3xl
    p-4
    mt-4
  ">

    <p className="
      text-xs
      uppercase
      font-black
      text-gray-500
      mb-2
    ">
      Forma Pago
    </p>

    <div
      className="
        w-full
        bg-white
        border
        border-gray-300
        rounded-2xl
        p-3
        font-black
        text-gray-900
      "
    >

      {pedido.forma_pago}

    </div>

  </div>

</div>

          {/* PRODUCTOS */}

          <div className="mt-6">

            <h2 className="text-3xl font-black text-gray-900 mb-4">
              Productos del Pedido
            </h2>

            {/* AGREGAR PRODUCTOS */}

            {
              modoEdicion && (

                <div className="
                  bg-gray-50
                  rounded-3xl
                  p-6
                  mb-6
                ">

                  <h3 className="
                    text-3xl
                    font-black
                    text-gray-900
                  ">
                    Agregar Productos
                  </h3>

                  <p className="
                    text-gray-500
                    mt-1
                    mb-6
                  ">
                    Selecciona productos para el pedido
                  </p>

                  <div className="mb-5">

                    <p className="
                      text-sm
                      uppercase
                      tracking-widest
                      font-black
                      text-gray-700
                      mb-2
                    ">
                      Producto
                    </p>

                    <select
                      id="productoSelect"
                      className="
                        w-full
                        bg-white
                        border
                        border-gray-300
                        rounded-2xl
                        p-4
                        font-bold
                        outline-none
                      "
                    >

                      <option value="">
                        Seleccionar Producto
                      </option>

                      {productos.map(
                        (producto) => (

                          <option
                            key={producto.id}
                            value={producto.id}
                          >

                            {producto.nombre}

                          </option>
                        )
                      )}

                    </select>

                  </div>

                  <div className="mb-6">

                    <p className="
                      text-sm
                      uppercase
                      tracking-widest
                      font-black
                      text-gray-700
                      mb-2
                    ">
                      Cantidad
                    </p>

                    <input
                      id="cantidadProducto"
                      type="number"
                      defaultValue={1}
                      min={1}
                      className="
                        w-full
                        bg-white
                        border
                        border-gray-300
                        rounded-2xl
                        p-4
                        font-bold
                        outline-none
                      "
                    />

                  </div>

                  <button
                    onClick={() => {

                      const productoId =
                        (
                          document.getElementById(
                            "productoSelect"
                          ) as HTMLSelectElement
                        ).value;

                      const cantidad =
                        Number(
                          (
                            document.getElementById(
                              "cantidadProducto"
                            ) as HTMLInputElement
                          ).value
                        );

                      if (!productoId) {

                        alert(
                          "Selecciona producto"
                        );

                        return;
                      }

                      const producto =
                        productos.find(
                          (p) =>
                            p.id === productoId
                        );

                      if (!producto) return;

                      const nuevo = {

                        producto_id:
                          producto.id,

                        productos:
                          producto,

                        cantidad,

                        precio:
                          producto.precio_venta,

                        costo:
                          Number(
                            producto.precio_venta
                          ) * cantidad,
                      };

                      setDetalles([
                        ...detalles,
                        nuevo,
                      ]);

                      (
                        document.getElementById(
                          "productoSelect"
                        ) as HTMLSelectElement
                      ).value = "";

                      (
                        document.getElementById(
                          "cantidadProducto"
                        ) as HTMLInputElement
                      ).value = "1";
                    }}
                    className="
                      w-full
                      bg-blue-600
                      hover:bg-blue-700
                      text-white
                      py-4
                      rounded-2xl
                      font-black
                      transition-all
                    "
                  >

                    Agregar Producto

                  </button>

                </div>
              )
            }

            <div className="space-y-3">

              {detalles.map(
                (detalle, index) => (

                  <div
                    key={index}
                    className="bg-gray-100 rounded-3xl p-4 flex justify-between items-center"
                  >

                    <div>

                      <h3 className="text-xl font-black text-gray-900 uppercase">

                        {
                          detalle.productos
                            ?.nombre
                        }

                      </h3>

                      <input
                        type="number"
                        min="1"
                        value={detalle.cantidad}
                        disabled={!modoEdicion}
                        onChange={(e) => {

                          const nuevos =
                            [...detalles];

                          nuevos[index]
                            .cantidad =
                            Number(
                              e.target.value
                            );

                          setDetalles(
                            nuevos
                          );
                        }}
                        className="
                          border
                          border-gray-300
                          rounded-xl
                          px-3
                          py-2
                          mt-2
                          w-24
                        "
                      />

                    </div>

                    <div className="text-right">

                      <p className="text-xs uppercase font-black text-gray-500">
                        Subtotal
                      </p>

                      <h3 className="text-2xl font-black text-green-600 mt-1">

                        Q
                        {(
                          Number(
                            detalle.precio || 0
                          ) *
                          Number(
                            detalle.cantidad || 0
                          )
                        ).toFixed(2)}

                      </h3>

                      {
                        modoEdicion && (

                          <button
                            onClick={() =>
                              eliminarProducto(
                                index
                              )
                            }
                            className="
                              mt-3
                              bg-red-500
                              hover:bg-red-600
                              text-white
                              px-4
                              py-2
                              rounded-xl
                              font-black
                            "
                          >

                            Eliminar

                          </button>
                        )
                      }

                    </div>

                  </div>

                )
              )}

            </div>

          </div>

          {/* TOTAL */}

          <div className="mt-6 flex justify-end">

            <div className="bg-green-100 rounded-3xl px-8 py-4">

              <p className="text-xs uppercase font-black text-green-700">
                Total Pedido
              </p>

              <h2 className="text-4xl font-black text-green-600 mt-1">

                Q
                {totalPedido.toFixed(2)}

              </h2>

            </div>

          </div>

          {/* ACCIONES */}

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">

            <button
              onClick={
                enviarWhatsApp
              }
              className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black transition-all shadow-lg"
            >
              WhatsApp
            </button>

            <button
              onClick={() =>
                window.print()
              }
              className="bg-black hover:bg-gray-900 text-white py-4 rounded-2xl font-black transition-all shadow-lg"
            >
              Imprimir Pedido
            </button>

          </div>

        </div>

      </div>

    </main>
  );
}