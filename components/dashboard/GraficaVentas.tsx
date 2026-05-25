"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Props = {
  data: {
    fecha: string;
    total: number;
  }[];
};

export default function GraficaVentas({
  data,
}: Props) {

  return (

    <div className="
      bg-white
      rounded-[30px]
      shadow-2xl
      p-8
      mt-8
    ">

      <h2 className="
        text-5xl
        font-black
        text-gray-900
      ">
        Ventas por Día
      </h2>

      <p className="
        text-gray-500
        mt-2
        mb-8
      ">
        Rendimiento de ventas
      </p>

      <div className="h-[350px]">

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <LineChart data={data}>

            <CartesianGrid
              strokeDasharray="3 3"
            />

            <XAxis dataKey="fecha" />

            <YAxis />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="total"
              stroke="#16a34a"
              strokeWidth={4}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

    </div>
  );
}