import Link from "next/link";

interface Props {

  pedidos: any[];
}

export default function UltimosPedidos({

  pedidos,

}: Props) {

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

  return (

    <div
      className="
      bg-white
      rounded-[35px]
      shadow-2xl
      border
      border-gray-100
      overflow-hidden
      "
    >

      {/* HEADER */}
      <div className="
        flex
        items-center
        justify-between
        px-6
        py-5
        border-b
        border-gray-100
        bg-gray-50
      ">

        <div>

          <h2 className="
            text-3xl
            font-black
            text-gray-900
          ">
            Últimos Pedidos
          </h2>

          <p className="
            text-gray-500
            mt-1
            font-medium
          ">
            Pedidos recientes del sistema
          </p>

        </div>

        {/* BADGE */}
        <div
          className="
          bg-black
          text-white
          px-4
          py-2
          rounded-2xl
          text-sm
          font-black
          shadow-lg
          "
        >

          {pedidos.length} pedidos

        </div>

      </div>

      {/* TABLA */}
      <div className="overflow-x-auto">

        <table className="w-full">

          <thead className="
            bg-gray-100
            border-b
            border-gray-200
          ">

            <tr>

              <th className="
                text-left
                p-6
                font-black
                text-gray-700
                uppercase
              ">
                Cliente
              </th>

              <th className="
                text-center
                p-6
                font-black
                text-gray-700
                uppercase
              ">
                Fecha
              </th>

              <th className="
                text-center
                p-6
                font-black
                text-gray-700
                uppercase
              ">
                Estado
              </th>

              <th className="
                text-center
                p-6
                font-black
                text-gray-700
                uppercase
              ">
                Pago
              </th>

              <th className="
                text-center
                p-6
                font-black
                text-gray-700
                uppercase
              ">
                Total
              </th>

              <th className="
                text-center
                p-6
                font-black
                text-gray-700
                uppercase
              ">
                Acción
              </th>

            </tr>

          </thead>

          <tbody>

            {pedidos.map(
              (pedido) => (

                <tr
                  key={pedido.id}
                  className="
                  border-b
                  border-gray-100
                  hover:bg-gray-50
                  transition-all
                  "
                >

                  {/* CLIENTE */}
                  <td className="p-6">

                    <p className="
                      text-xs
                      font-black
                      text-blue-600
                      uppercase
                    ">
                      {pedido.codigo}
                    </p>

                    <h2 className="
                      text-xl
                      font-black
                      text-gray-900
                      uppercase
                      mt-2
                    ">
                      {pedido.cliente}
                    </h2>

                    <p className="
                      text-sm
                      text-gray-400
                      mt-1
                    ">
                      {pedido.telefono}
                    </p>

                  </td>

                  {/* FECHA */}
                  <td className="
                    p-6
                    text-center
                    font-semibold
                    text-gray-700
                  ">
                    {pedido.fecha_pedido}
                  </td>

                  {/* ESTADO */}
                  <td className="
                    p-6
                    text-center
                  ">

                    <span
                      className={`
                      px-3
                      py-1
                      rounded-full
                      text-xs
                      font-black
                      ${colorEstado(
                        pedido.estado
                      )}
                      `}
                    >
                      {pedido.estado}
                    </span>

                  </td>

                  {/* PAGO */}
                  <td className="
                    p-6
                    text-center
                  ">

                    <span
                      className={`
                      px-3
                      py-1
                      rounded-full
                      text-xs
                      font-black
                      ${
                        pedido.pago_estado ===
                        "Pagado"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }
                      `}
                    >

                      {pedido.pago_estado}

                    </span>

                  </td>

                  {/* TOTAL */}
                  <td className="
                    p-6
                    text-center
                  ">

                    <p className="
                      text-xl
                      font-black
                      text-green-600
                    ">
                      Q
                      {Number(
                        pedido.total
                      ).toFixed(2)}
                    </p>

                  </td>

                  {/* ACCION */}
                  <td className="
                    p-6
                    text-center
                  ">

                    <div className="
                      flex
                      items-center
                      justify-center
                    ">

                      <Link
                        href={`/pedidos/${pedido.id}`}
                        className="
                        w-11
                        h-11
                        rounded-2xl
                        bg-black
                        hover:bg-gray-800
                        flex
                        items-center
                        justify-center
                        text-white
                        shadow-lg
                        transition-all
                        hover:scale-105
                        "
                      >

                        👁

                      </Link>

                    </div>

                  </td>

                </tr>

              )
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}