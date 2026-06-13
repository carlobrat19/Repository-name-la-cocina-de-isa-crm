"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "@/lib/supabase";

import DashboardKPIs from "@/components/dashboard/DashboardKPIs";
import UltimosPedidos from "@/components/dashboard/UltimosPedidos";
import TopProductos from "@/components/dashboard/TopProductos";
import GraficaVentas from "@/components/dashboard/GraficaVentas";

export default function DashboardPage() {

  const [pedidos,
    setPedidos] =
    useState<any[]>([]);

  const [topProductos,
    setTopProductos] =
    useState<any[]>([]);

  const [loading,
    setLoading] =
    useState(true);

  const [filtro,
    setFiltro] =
    useState("mes");

  const [fechaInicio,
    setFechaInicio] =
    useState("");

  const [fechaFin,
    setFechaFin] =
    useState("");

  // =========================
  // CARGAR DASHBOARD
  // =========================

  async function cargarDashboard() {

    setLoading(true);

    // =====================
    // PEDIDOS
    // =====================

    const {
      data: pedidosData,
      error,
    } = await supabase
      .from("pedidos")

.select(`

*,

detalles:pedido_detalle(

cantidad,

productos(
costo
)

)

`)

.order(
"fecha_creacion",
{
ascending:false
}
);

    console.log(
      "PEDIDOS:",
      pedidosData
    );

    console.log(
      "ERROR:",
      error
    );

    // =====================
    // PRODUCTOS MÁS VENDIDOS
    // =====================

    const {
      data: detalles,
      error: errorDetalles,
    } = await supabase
      .from("pedido_detalle")
      .select(`
        cantidad,
        productos (
          nombre
        )
      `);

    console.log(
      "DETALLES:",
      detalles
    );

    console.log(
      "ERROR DETALLES:",
      errorDetalles
    );

    setPedidos(
      pedidosData || []
    );

    // =====================
    // TOP PRODUCTOS
    // =====================

    const conteo:
      Record<string, number> = {};

    detalles?.forEach(
      (item: any) => {

        const nombre =
          item.productos
            ?.nombre;

        if (!nombre) return;

        conteo[nombre] =
          (conteo[nombre] || 0) +
          Number(
            item.cantidad || 0
          );
      }
    );

    const ranking =
      Object.entries(conteo)
        .map(
          ([nombre, total]) => ({
            nombre,
            total,
          })
        )
        .sort(
          (a, b) =>
            b.total - a.total
        )
        .slice(0, 10);

    setTopProductos(
      ranking
    );

    setLoading(false);
  }

  useEffect(() => {

    cargarDashboard();

  }, []);

  // =========================
  // FILTROS REALES
  // =========================

  const hoy = new Date();

  const pedidosFiltrados =
    pedidos.filter((pedido) => {

      const fechaPedido =
        new Date(
          pedido.fecha_creacion
        );

      // HOY

      if (filtro === "hoy") {

        return (
          fechaPedido
            .toDateString() ===
          hoy.toDateString()
        );
      }

      // SEMANA

      if (filtro === "semana") {

        const hace7Dias =
          new Date();

        hace7Dias.setDate(
          hoy.getDate() - 7
        );

        return (
          fechaPedido >=
          hace7Dias
        );
      }

      // MES

      if (filtro === "mes") {

        return (
          fechaPedido.getMonth() ===
            hoy.getMonth()
          &&
          fechaPedido.getFullYear() ===
            hoy.getFullYear()
        );
      }

      // PERSONALIZADO

      if (
        filtro ===
        "personalizado"
      ) {

        const fechaTexto =
          pedido.fecha_creacion
            ?.split("T")[0];

        if (
          !fechaInicio &&
          !fechaFin
        ) {
          return true;
        }

        if (
          fechaInicio &&
          !fechaFin
        ) {
          return (
            fechaTexto >=
            fechaInicio
          );
        }

        if (
          !fechaInicio &&
          fechaFin
        ) {
          return (
            fechaTexto <=
            fechaFin
          );
        }

        return (
          fechaTexto >=
            fechaInicio
          &&
          fechaTexto <=
            fechaFin
        );
      }

      return true;
    });

  // =========================
// KPIS
// =========================

// VENTAS

const ventasTotales =

pedidosFiltrados.reduce(

(acc,pedido)=>

acc +

Number(
pedido.total || 0
),

0

);

// COSTO REAL
// viene desde productos.costo

// =========================
// COSTO TOTAL
// =========================

// =========================
// COSTO TOTAL
// =========================

const costoTotal =

pedidosFiltrados.reduce(

(totalPedido,pedido)=>{

const detallesPedido =

pedido.detalles || [];

const costoPedido =

detallesPedido.reduce(

(acc:number,item:any)=>{

return (

acc +

(

Number(
item.cantidad || 0
)

*

Number(
item.productos?.costo || 0
)

)

);

},

0

);

return (

totalPedido +

costoPedido

);

},

0

);

// =========================
// GANANCIAS
// =========================

const ganancias =

ventasTotales

-

costoTotal;

// CONTADORES

const pendientes =

pedidosFiltrados.filter(

(p)=>

p.estado ===
"Pendiente"

).length;

const entregados =

pedidosFiltrados.filter(

(p)=>

p.estado ===
"Entregado"

).length;

const pagados =

pedidosFiltrados.filter(

(p:any)=>

String(
p.pago_estado
)

.toLowerCase()

===

"pagado"

).length;

  // =========================
  // GRAFICA
  // =========================

  const agrupado:
    Record<string, number> = {};

  pedidosFiltrados.forEach(
    (pedido) => {

      const fecha =
        pedido.fecha_creacion
          ?.split("T")[0];

      if (!fecha) return;

      agrupado[fecha] =
        (agrupado[fecha] || 0) +
        Number(
          pedido.total || 0
        );
    }
  );

  const datosGrafica =
    Object.entries(
      agrupado
    )
      .sort(
        ([fechaA], [fechaB]) =>
          fechaA.localeCompare(
            fechaB
          )
      )
      .map(
        ([fecha, total]) => ({

          fecha:
            fecha
              .split("-")
              .reverse()
              .join("/"),

          total,
        })
      );

  // =========================
  // LOADING
  // =========================

  if (loading) {

    return (

      <main className="
        min-h-screen
        flex
        items-center
        justify-center
        bg-gray-100
      ">

        <p className="
          text-2xl
          font-black
          text-gray-700
        ">
          Cargando Dashboard...
        </p>

      </main>
    );
  }

  return (

    <main className="
      min-h-screen
      bg-gradient-to-br
      from-gray-100
      to-gray-200
      p-6
    ">

      {/* HEADER */}

      <div className="
        flex
        items-start
        justify-between
        mb-8
      ">

        <div>

          <h1 className="
            text-6xl
            font-black
            text-gray-900
          ">
            Dashboard ERP
          </h1>

          <p className="
            text-gray-500
            mt-2
            font-medium
          ">
            Resumen general del negocio
          </p>

        </div>

        {/* BOTONES */}

        <div className="
          flex
          gap-4
        ">

          <Link
            href="/pedidos/lista"
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
            Ver Pedidos
          </Link>

          <Link
            href="/pedidos"
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
            Nuevo Pedido
          </Link>

        </div>

      </div>

      {/* FILTROS */}

      <div className="
        grid
        grid-cols-1
        md:grid-cols-3
        gap-4
        mb-8
      ">

        {/* SELECT */}

        <select
          value={filtro}
          onChange={(e) => {

            const valor =
              e.target.value;

            setFiltro(valor);

            if (
              valor !==
              "personalizado"
            ) {

              setFechaInicio("");
              setFechaFin("");
            }
          }}
          className="
            h-14
            rounded-2xl
            border
            border-gray-300
            bg-white
            px-4
            font-bold
            shadow-md
            outline-none
          "
        >

          <option value="hoy">
            Hoy
          </option>

          <option value="semana">
            Esta Semana
          </option>

          <option value="mes">
            Este Mes
          </option>

          <option value="personalizado">
            Personalizado
          </option>

        </select>

        {/* FECHA INICIO */}

        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => {

            setFechaInicio(
              e.target.value
            );

            setFiltro(
              "personalizado"
            );
          }}
          className="
            h-14
            rounded-2xl
            border
            border-gray-300
            bg-white
            px-4
            font-bold
            shadow-md
            outline-none
          "
        />

        {/* FECHA FIN */}

        <input
          type="date"
          value={fechaFin}
          onChange={(e) => {

            setFechaFin(
              e.target.value
            );

            setFiltro(
              "personalizado"
            );
          }}
          className="
            h-14
            rounded-2xl
            border
            border-gray-300
            bg-white
            px-4
            font-bold
            shadow-md
            outline-none
          "
        />

      </div>

      {/* KPIS */}

      <DashboardKPIs
        ventasTotales={
          ventasTotales
        }
        ganancias={
          ganancias
        }
        pedidos={
          pedidosFiltrados.length
        }
        pendientes={
          pendientes
        }
        entregados={
          entregados
        }
        pagados={
          pagados
        }
      />

      {/* GRAFICA */}

      <GraficaVentas
        data={datosGrafica}
      />

      {/* GRID */}

      <div className="
        grid
        grid-cols-1
        xl:grid-cols-3
        gap-8
        mt-8
      ">

        {/* PEDIDOS */}

        <div className="
          xl:col-span-2
        ">

          <UltimosPedidos
            pedidos={
              pedidosFiltrados
            }
          />

        </div>

        {/* PRODUCTOS */}

        <div>

          <TopProductos
            productos={
              topProductos
            }
          />

        </div>

      </div>

    </main>
  );
}