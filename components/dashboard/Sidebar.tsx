"use client";

import Link from "next/link";

import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Factory,
  DollarSign,
  Users,
} from "lucide-react";

export default function Sidebar() {

  const menu = [

    {
      nombre: "Dashboard",
      ruta: "/dashboard",
      icono: LayoutDashboard,
    },

    {
      nombre: "Pedidos",
      ruta: "/pedidos/lista",
      icono: ShoppingBag,
    },

    {
      nombre: "Productos",
      ruta: "/productos",
      icono: Package,
    },

    {
      nombre: "Producción",
      ruta: "/produccion",
      icono: Factory,
    },

    {
      nombre: "Flujo Caja",
      ruta: "/flujo-caja",
      icono: DollarSign,
    },


  ];

  return (

    <aside
      className="
        w-[280px]
        h-screen
        bg-[#0F172A]
        text-white
        fixed
        left-0
        top-0
        p-6
        flex
        flex-col
        shadow-2xl
      "
    >

      {/* LOGO */}

      <div className="mb-10">

        <h1
          className="
            text-3xl
            font-black
            leading-tight
          "
        >
          La Cocina
          <br />
          de Isa
        </h1>

        <p
          className="
            text-gray-400
            mt-2
            text-sm
          "
        >
          ERP Gastronómico
        </p>

      </div>

      {/* MENU */}

      <nav
        className="
          flex
          flex-col
          gap-2
        "
      >

        {menu.map((item) => {

          const Icono =
            item.icono;

          return (

            <Link
              key={item.nombre}
              href={item.ruta}
              className="
                flex
                items-center
                gap-4
                px-5
                py-4
                rounded-2xl
                hover:bg-white/10
                transition-all
                font-bold
                text-gray-200
                hover:text-white
              "
            >

              <Icono size={22} />

              {item.nombre}

            </Link>

          );

        })}

      </nav>

      {/* FOOTER */}

      <div className="mt-auto">

        <div
          className="
            bg-white/10
            rounded-3xl
            p-5
          "
        >

          <p
            className="
              text-sm
              text-gray-300
            "
          >
            Sistema ERP
          </p>

          <h3
            className="
              text-xl
              font-black
              mt-1
            "
          >
            La Cocina de Isa
          </h3>

        </div>

      </div>

    </aside>

  );

}