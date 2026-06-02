"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";


import { supabase } from "../../../lib/supabase";

export default function ListaPedidosPage() {

  const [pedidos, setPedidos] =
    useState<any[]>([]);

  const [detalles, setDetalles] =
    useState<any[]>([]);

  const [productos, setProductos] =
    useState<any[]>([]);

  // FILTROS
  const [busqueda, setBusqueda] =
    useState("");

  const [estadoFiltro, setEstadoFiltro] =
    useState("Todos");

  const [pagoFiltro, setPagoFiltro] =
    useState("Todos");

  const [vendedorFiltro, setVendedorFiltro] =
    useState("Todos");

  const [envioFiltro, setEnvioFiltro] =
    useState("Todos");

  // NUEVOS FILTROS FECHA
  const [fechaPedidoFiltro, setFechaPedidoFiltro] =
    useState("");

  const [fechaEntregaFiltro, setFechaEntregaFiltro] =
    useState("");

  // OBTENER PEDIDOS
  async function obtenerPedidos() {

    // PEDIDOS
    const {
      data: pedidosData,
      error,
    } =
      await supabase
        .from("pedidos")
        .select("*")
        .order("numero_pedido", {
          ascending: false,
        });

    if (error) {

      console.log(error);

      return;
    }

    setPedidos(
      pedidosData || []
    );

    // DETALLES
    const {
      data: detalleData,
      error: detalleError,
    } =
      await supabase
        .from("pedido_detalle")
        .select("*");

    if (detalleError) {

      console.log(
        detalleError
      );

      return;
    }

    setDetalles(
      detalleData || []
    );

    // PRODUCTOS
    const {
      data: productosData,
      error: productosError,
    } =
      await supabase
        .from("productos")
        .select("*");

    if (productosError) {

      console.log(
        productosError
      );

      return;
    }

    setProductos(
      productosData || []
    );
  }

  useEffect(() => {

    obtenerPedidos();

  }, []);

  // COLOR ESTADO
  function colorEstado(
    estado: string
  ) {

    if (
      estado === "Pendiente"
    ) {
      return "bg-yellow-100 text-yellow-700";
    }

    if (
      estado === "Producción"
    ) {
      return "bg-blue-100 text-blue-700";
    }

    if (
      estado === "Empaquetado"
    ) {
      return "bg-orange-100 text-orange-700";
    }

    if (
      estado === "En Ruta"
    ) {
      return "bg-purple-100 text-purple-700";
    }

    if (
      estado === "Entregado"
    ) {
      return "bg-green-100 text-green-700";
    }

    return "bg-gray-100 text-gray-700";
  }

  // COLOR PAGO
  function colorPago(
    pago: string
  ) {

    if (
      pago === "Pagado"
    ) {
      return "bg-green-100 text-green-700";
    }

    return "bg-red-100 text-red-700";
  }

  // FILTROS
  const pedidosFiltrados =
    useMemo(() => {

      return pedidos.filter(
        (pedido) => {

          const texto =
            busqueda.toLowerCase();

          const coincideBusqueda =

            pedido.cliente
              ?.toLowerCase()
              .includes(texto)

            ||

            pedido.codigo
              ?.toLowerCase()
              .includes(texto);

          const coincideEstado =

            estadoFiltro ===
            "Todos"

              ? true

              : pedido.estado ===
                estadoFiltro;

          const coincidePago =

            pagoFiltro ===
            "Todos"

              ? true

              : pedido.pago_estado ===
                pagoFiltro;

          const coincideFechaPedido =

            fechaPedidoFiltro === ""

              ? true

              : pedido.fecha_pedido ===
                fechaPedidoFiltro;
          const coincideVendedor =

vendedorFiltro === "Todos"

?

true

:

pedido.vendedor ===
vendedorFiltro;

const coincideEnvio =

envioFiltro ===
"Todos"

?

true

:

envioFiltro ===
"Con envío"

?

pedido.requiere_envio === true

:

pedido.requiere_envio === false;

const coincideFechaEntrega =

fechaEntregaFiltro === ""

?

true

:

pedido.fecha_entrega ===
fechaEntregaFiltro;

          return (

coincideBusqueda
&&
coincideEstado
&&
coincidePago
&&
coincideVendedor
&&
coincideEnvio
&&
coincideFechaPedido
&&
coincideFechaEntrega

);
        }
      );

    }, [
      pedidos,
busqueda,
estadoFiltro,
pagoFiltro,
vendedorFiltro,
fechaPedidoFiltro,
fechaEntregaFiltro,
    ]);

  return (

    <main className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8">

      <div className="max-w-7xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex justify-between items-center">

          <div>

            <h1 className="text-5xl font-black text-gray-900">
              Pedidos
            </h1>

            <p className="text-gray-500 mt-2 font-medium">
              Administración de pedidos
            </p>

          </div>

          <a
            href="/pedidos"
            className="bg-black hover:bg-gray-900 text-white px-6 py-4 rounded-2xl font-black transition-all shadow-xl"
          >
            Nuevo Pedido
          </a>

        </div>

        {/* FILTROS */}
        <div className="bg-white rounded-[35px] shadow-2xl border border-gray-200 p-6">

          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">

            {/* BUSCADOR */}
            <input
              type="text"
              placeholder="Buscar"
              value={busqueda}
              onChange={(e) =>
                setBusqueda(
                  e.target.value
                )
              }
              className="
              w-36
              bg-white
              text-gray-800
              placeholder-gray-400
              border
              border-gray-300
              rounded-2xl
              p-4
              outline-none
              font-semibold
              shadow-sm
              focus:ring-2
              focus:ring-blue-500
              "
            />

            {/* ESTADO */}
            <select
              value={
                estadoFiltro
              }
              onChange={(e) =>
                setEstadoFiltro(
                  e.target.value
                )
              }
              className="
              bg-white
              text-gray-800
              border
              border-gray-300
              rounded-2xl
              p-4
              outline-none
              font-semibold
              shadow-sm
              focus:ring-2
              focus:ring-blue-500
              "
            >

              <option>
                Todos
              </option>

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

            {/* PAGO */}
            <select
              value={pagoFiltro}
              onChange={(e) =>
                setPagoFiltro(
                  e.target.value
                )
              }
              className="
              bg-white
              text-gray-800
              border
              border-gray-300
              rounded-2xl
              p-4
              outline-none
              font-semibold
              shadow-sm
              focus:ring-2
              focus:ring-blue-500
              "
            >

              <option>
                Todos
              </option>

              <option>
                Pendiente
              </option>

              <option>
                Pagado
              </option>

            </select>
<select

value={
vendedorFiltro
}

onChange={
(e)=>

setVendedorFiltro(
e.target.value
)

}

className="
bg-white
text-gray-800
border
border-gray-300
rounded-2xl
p-4
font-semibold
shadow-sm
focus:ring-2
focus:ring-blue-500
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
            {/* FECHA PEDIDO */}
            <input
              type="date"
              value={fechaPedidoFiltro}
              onChange={(e) =>
                setFechaPedidoFiltro(
                  e.target.value
                )
              }
              className="
              bg-white
              text-gray-800
              border
              border-gray-300
              rounded-2xl
              p-4
              outline-none
              font-semibold
              shadow-sm
              focus:ring-2
              focus:ring-blue-500
              "
            />

            {/* FECHA ENTREGA */}
            <input
              type="date"
              value={fechaEntregaFiltro}
              onChange={(e) =>
                setFechaEntregaFiltro(
                  e.target.value
                )
              }
              className="
              bg-white
              text-gray-800
              border
              border-gray-300
              rounded-2xl
              p-4
              outline-none
              font-semibold
              shadow-sm
              focus:ring-2
              focus:ring-blue-500
              "
            />

          </div>
          <select

value={envioFiltro}

onChange={(e)=>
setEnvioFiltro(
e.target.value
)
}

className="
w-32
bg-white
text-gray-800
border
border-gray-300
rounded-2xl
p-4
font-semibold
shadow-sm
focus:ring-2
focus:ring-blue-500
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

        {/* TABLA */}
        <div className="bg-white rounded-[35px] shadow-2xl border border-gray-200 overflow-hidden">

          <div className="overflow-x-auto">

            <table className="w-full table-fixed">

              <thead className="bg-gray-100 border-b border-gray-200">

                <tr>

                  <th className="w-[35%] text-left p-6 font-black text-gray-700 uppercase">
                    Cliente
                  </th>

                  <th className="w-[10%] text-center p-6 font-black text-gray-700 uppercase">
                    Fecha Pedido
                  </th>

                  <th className="w-[10%] text-center p-6 font-black text-gray-700 uppercase">
                    Fecha Entrega
                  </th>

                  <th className="w-[10%] text-center p-6 font-black text-gray-700 uppercase">
                    Estado
                  </th>

                  <th className="w-[10%] text-center p-6 font-black text-gray-700 uppercase">
                    Pago
                  </th>

                  <th className="w-[10%] text-center p-6 font-black text-gray-700 uppercase">
                    Forma Pago
                  </th>

                  <th className="w-[8%] text-center p-6 font-black text-gray-700 uppercase">
                    Total
                  </th>

                  <th className="w-[12%] text-center p-6 font-black text-gray-700 uppercase">
                    Detalle
                  </th>

                </tr>

              </thead>

              <tbody>

                {pedidosFiltrados.map(
                  (pedido) => (

                    <tr
                      key={pedido.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-all align-top"
                    >

                      {/* CLIENTE */}
                      <td className="p-6 align-top">

                        <div>

                          <p className="text-xs font-black text-blue-600 uppercase tracking-widest">
                            {pedido.codigo}
                          </p>

                          <p className="font-black text-gray-900 text-2xl uppercase mt-2">
                            {pedido.cliente || "Sin nombre"}
                          </p>

                          <p className="text-gray-500 text-sm mt-1">
                            {pedido.telefono}
                          </p>

                          <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                            📍 {pedido.direccion}
                          </p>

                          {/* PRODUCTOS */}
                          <div className="mt-4 space-y-3">

                            {detalles
                              .filter(
                                (
                                  detalle
                                ) =>
                                  detalle.pedido_id ===
                                  pedido.id
                              )
                              .map(
                                (
                                  detalle,
                                  index
                                ) => (

                                  <div
                                    key={index}
                                    className="bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 shadow-sm"
                                  >

                                    <div className="flex justify-between items-center">

                                      <div>

                                        <p className="text-sm font-black text-gray-800 uppercase">

                                          {
                                            productos.find(
                                              (
                                                p
                                              ) =>
                                                p.id ===
                                                detalle.producto_id
                                            )?.nombre
                                          }

                                        </p>

                                        <p className="text-xs text-gray-500 mt-1">
                                          Cantidad:
                                          {" "}
                                          {
                                            detalle.cantidad
                                          }
                                        </p>

                                      </div>

                                      <div>

                                        <p className="text-xl font-black text-green-600">
                                          Q
                                          {Number(
                                            detalle.precio
                                          ).toFixed(
                                            2
                                          )}
                                        </p>

                                      </div>

                                    </div>

                                  </div>

                                )
                              )}

                          </div>

                        </div>

                      </td>

                      {/* FECHA PEDIDO */}
                      <td className="p-6 font-semibold text-gray-700 align-top text-center">

                        <div className="whitespace-nowrap">
                          {pedido.fecha_pedido}
                        </div>

                      </td>

                      {/* FECHA ENTREGA */}
                      <td className="p-6 font-semibold text-gray-700 align-top text-center">

                        <div className="whitespace-nowrap">
                          {pedido.fecha_entrega}
                        </div>

                      </td>

                      {/* ESTADO */}
                      <td className="p-6 align-top text-center">

                        <span
                          className={`inline-flex whitespace-nowrap items-center justify-center px-3 py-1 rounded-full text-xs font-black ${colorEstado(
                            pedido.estado
                          )}`}
                        >
                          {pedido.estado}
                        </span>

                      </td>

                      {/* PAGO */}
                      <td className="p-6 align-top text-center">

                        <span
                          className={`inline-flex whitespace-nowrap items-center justify-center px-3 py-1 rounded-full text-xs font-black ${colorPago(
                            pedido.pago_estado
                          )}`}
                        >
                          {
                            pedido.pago_estado
                          }
                        </span>

                      </td>

                      {/* FORMA PAGO */}
                      <td className="p-6 font-semibold text-gray-700 align-top text-center whitespace-nowrap">

                        {pedido.forma_pago}

                      </td>

                      {/* TOTAL */}
                      <td className="p-6 align-top text-center whitespace-nowrap">

                        <span className="text-xl font-black text-green-600">
                          Q
                          {Number(
                            pedido.total
                          ).toFixed(2)}
                        </span>

                      </td>

                      {/* DETALLE */}
                      <td className="p-6 align-top text-center">

                        <button
                          onClick={() =>
                            window.location.href =
                              `/pedidos/${pedido.id}`
                          }
                          className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg transition-all"
                        >
                          Ver Pedido
                        </button>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>

    </main>
  );
}