"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "../../lib/supabase";

export default function ProduccionPage() {

  const [pedidos, setPedidos] =
    useState<any[]>([]);

  async function cargarPedidos() {

    const {
      data,
    } = await supabase
      .from("pedidos")
      .select("*")
      .order("numero_pedido", {
        ascending: false,
      });

    setPedidos(
      data || []
    );
  }

  useEffect(() => {

    cargarPedidos();

  }, []);

  async function cambiarEstado(
    id: string,
    estado: string
  ) {

    await supabase
      .from("pedidos")
      .update({
        estado,
      })
      .eq("id", id);

    cargarPedidos();
  }

  const columnas = [

    "Pendiente",

    "Producción",

    "Empaquetado",

    "En Ruta",

    "Entregado",

  ];

  function colorEstado(
    estado: string
  ) {

    if (
      estado === "Pendiente"
    ) {
      return "border-yellow-300";
    }

    if (
      estado === "Producción"
    ) {
      return "border-blue-300";
    }

    if (
      estado === "Empaquetado"
    ) {
      return "border-orange-300";
    }

    if (
      estado === "En Ruta"
    ) {
      return "border-purple-300";
    }

    if (
      estado === "Entregado"
    ) {
      return "border-green-300";
    }

    return "border-gray-300";
  }

  return (

    <main className="
      min-h-screen
      bg-gradient-to-br
      from-gray-100
      to-gray-200
      p-8
    ">

      {/* HEADER */}
      <div className="
        flex
        items-center
        justify-between
        mb-8
      ">

        <div>

          <h1 className="
            text-5xl
            font-black
            text-gray-900
          ">
            Panel Producción
          </h1>

          <p className="
            text-gray-500
            mt-2
            font-medium
          ">
            Gestión operativa de pedidos
          </p>

        </div>

        <div className="
          flex
          gap-4
        ">

          <Link
            href="/dashboard"
            className="
            bg-white
            border
            border-gray-300
            hover:bg-gray-50
            text-gray-900
            px-6
            py-4
            rounded-2xl
            font-black
            shadow-lg
            transition-all
            "
          >
            Dashboard
          </Link>

          <Link
            href="/pedidos/lista"
            className="
            bg-black
            hover:bg-gray-900
            text-white
            px-6
            py-4
            rounded-2xl
            font-black
            shadow-xl
            transition-all
            "
          >
            Ver Pedidos
          </Link>

        </div>

      </div>

      {/* COLUMNAS */}
      <div className="
        grid
        grid-cols-1
        md:grid-cols-2
        xl:grid-cols-5
        gap-6
      ">

        {columnas.map(
          (columna) => {

            const pedidosColumna =
              pedidos.filter(
                (pedido) =>
                  pedido.estado ===
                  columna
              );

            return (

              <div
                key={columna}
                className="
                bg-white
                rounded-[30px]
                shadow-2xl
                border
                border-gray-100
                overflow-hidden
                "
              >

                {/* HEADER */}
                <div className="
                  p-5
                  border-b
                  border-gray-100
                  bg-gray-50
                ">

                  <div className="
                    flex
                    items-center
                    justify-between
                  ">

                    <h2 className="
                      text-xl
                      font-black
                      text-gray-900
                    ">
                      {columna}
                    </h2>

                    <div className="
                      bg-black
                      text-white
                      text-xs
                      font-black
                      px-3
                      py-1
                      rounded-full
                    ">

                      {
                        pedidosColumna.length
                      }

                    </div>

                  </div>

                </div>

                {/* TARJETAS */}
                <div className="
                  p-4
                  space-y-4
                  min-h-[700px]
                ">

                  {pedidosColumna.map(
                    (pedido) => (

                      <div
                        key={pedido.id}
                        className={`
                        bg-white
                        rounded-3xl
                        border-2
                        ${colorEstado(
                          pedido.estado
                        )}
                        shadow-lg
                        p-5
                        `}
                      >

                        {/* CODIGO */}
                        <p className="
                          text-xs
                          font-black
                          text-blue-600
                          uppercase
                        ">
                          {pedido.codigo}
                        </p>

                        {/* CLIENTE */}
                        <h3 className="
                          text-2xl
                          font-black
                          text-gray-900
                          uppercase
                          mt-2
                        ">
                          {pedido.cliente}
                        </h3>

                        {/* TOTAL */}
                        <div className="
                          mt-4
                          flex
                          items-center
                          justify-between
                        ">

                          <div>

                            <p className="
                              text-xs
                              text-gray-400
                              uppercase
                              font-bold
                            ">
                              Total
                            </p>

                            <p className="
                              text-3xl
                              font-black
                              text-green-600
                            ">
                              Q
                              {Number(
                                pedido.total
                              ).toFixed(2)}
                            </p>

                          </div>

                          <div>

                            <p className="
                              text-xs
                              text-gray-400
                              uppercase
                              font-bold
                            ">
                              Pago
                            </p>

                            <p className="
                              text-sm
                              font-black
                              text-gray-700
                            ">
                              {
                                pedido.pago_estado
                              }
                            </p>

                          </div>

                        </div>

                        {/* FECHA */}
                        <div className="
                          mt-4
                        ">

                          <p className="
                            text-xs
                            text-gray-400
                            uppercase
                            font-bold
                          ">
                            Fecha Entrega
                          </p>

                          <p className="
                            text-sm
                            font-bold
                            text-gray-700
                            mt-1
                          ">
                            {
                              pedido.fecha_entrega
                            }
                          </p>

                        </div>

                        {/* BOTONES ESTADOS */}
                        <div className="
                          mt-5
                          space-y-2
                        ">

                          {/* PENDIENTE */}
                          {pedido.estado ===
                            "Pendiente" && (

                            <button
                              onClick={() =>
                                cambiarEstado(
                                  pedido.id,
                                  "Producción"
                                )
                              }
                              className="
                              w-full
                              bg-blue-600
                              hover:bg-blue-700
                              text-white
                              py-3
                              rounded-2xl
                              font-black
                              text-sm
                              shadow-lg
                              transition-all
                              "
                            >

                              Pasar a Producción

                            </button>

                          )}

                          {/* PRODUCCION */}
                          {pedido.estado ===
                            "Producción" && (

                            <>
                              <button
                                onClick={() =>
                                  cambiarEstado(
                                    pedido.id,
                                    "Pendiente"
                                  )
                                }
                                className="
                                w-full
                                bg-gray-300
                                hover:bg-gray-400
                                text-gray-900
                                py-3
                                rounded-2xl
                                font-black
                                text-sm
                                shadow
                                transition-all
                                "
                              >

                                ← Regresar

                              </button>

                              <button
                                onClick={() =>
                                  cambiarEstado(
                                    pedido.id,
                                    "Empaquetado"
                                  )
                                }
                                className="
                                w-full
                                bg-orange-500
                                hover:bg-orange-600
                                text-white
                                py-3
                                rounded-2xl
                                font-black
                                text-sm
                                shadow-lg
                                transition-all
                                "
                              >

                                Pasar a Empaquetado

                              </button>
                            </>

                          )}

                          {/* EMPAQUETADO */}
                          {pedido.estado ===
                            "Empaquetado" && (

                            <>
                              <button
                                onClick={() =>
                                  cambiarEstado(
                                    pedido.id,
                                    "Producción"
                                  )
                                }
                                className="
                                w-full
                                bg-gray-300
                                hover:bg-gray-400
                                text-gray-900
                                py-3
                                rounded-2xl
                                font-black
                                text-sm
                                shadow
                                transition-all
                                "
                              >

                                ← Regresar

                              </button>

                              <button
                                onClick={() =>
                                  cambiarEstado(
                                    pedido.id,
                                    "En Ruta"
                                  )
                                }
                                className="
                                w-full
                                bg-purple-600
                                hover:bg-purple-700
                                text-white
                                py-3
                                rounded-2xl
                                font-black
                                text-sm
                                shadow-lg
                                transition-all
                                "
                              >

                                Pasar a En Ruta

                              </button>
                            </>

                          )}

                          {/* EN RUTA */}
                          {pedido.estado ===
                            "En Ruta" && (

                            <>
                              <button
                                onClick={() =>
                                  cambiarEstado(
                                    pedido.id,
                                    "Empaquetado"
                                  )
                                }
                                className="
                                w-full
                                bg-gray-300
                                hover:bg-gray-400
                                text-gray-900
                                py-3
                                rounded-2xl
                                font-black
                                text-sm
                                shadow
                                transition-all
                                "
                              >

                                ← Regresar

                              </button>

                              <button
                                onClick={() =>
                                  cambiarEstado(
                                    pedido.id,
                                    "Entregado"
                                  )
                                }
                                className="
                                w-full
                                bg-green-600
                                hover:bg-green-700
                                text-white
                                py-3
                                rounded-2xl
                                font-black
                                text-sm
                                shadow-lg
                                transition-all
                                "
                              >

                                Marcar Entregado

                              </button>
                            </>

                          )}

                          {/* ENTREGADO */}
                          {pedido.estado ===
                            "Entregado" && (

                            <button
                              onClick={() =>
                                cambiarEstado(
                                  pedido.id,
                                  "En Ruta"
                                )
                              }
                              className="
                              w-full
                              bg-gray-300
                              hover:bg-gray-400
                              text-gray-900
                              py-3
                              rounded-2xl
                              font-black
                              text-sm
                              shadow
                              transition-all
                              "
                            >

                              ← Regresar a En Ruta

                            </button>

                          )}

                        </div>

                      </div>

                    )
                  )}

                </div>

              </div>

            );
          }
        )}

      </div>

    </main>
  );
}