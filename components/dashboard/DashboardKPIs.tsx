type Props = {
  ventasTotales: number;
  ganancias: number;
  pedidos: number;
  pendientes: number;
  entregados: number;
  pagados: number;
};

export default function DashboardKPIs({
  ventasTotales,
  ganancias,
  pedidos,
  pendientes,
  entregados,
  pagados,
}: Props) {

  const cards = [
    {
      titulo: "VENTAS TOTALES",
      valor: `Q${ventasTotales.toFixed(2)}`,
      color: "text-green-600",
    },
    {
      titulo: "GANANCIAS",
      valor: `Q${ganancias.toFixed(2)}`,
      color: "text-emerald-500",
    },
    {
      titulo: "PEDIDOS",
      valor: pedidos,
      color: "text-blue-600",
    },
    {
      titulo: "PENDIENTES",
      valor: pendientes,
      color: "text-yellow-500",
    },
    {
      titulo: "ENTREGADOS",
      valor: entregados,
      color: "text-green-500",
    },
    {
      titulo: "PAGADOS",
      valor: pagados,
      color: "text-purple-500",
    },
  ];

  return (

    <div className="
      grid
      grid-cols-2
      md:grid-cols-3
      xl:grid-cols-6
      gap-6
      mt-8
    ">

      {cards.map((card) => (

        <div
          key={card.titulo}
          className="
          bg-white
          rounded-[28px]
          shadow-xl
          p-6
          hover:scale-[1.02]
          transition-all
          "
        >

          <p className="
            text-xs
            font-black
            tracking-wide
            text-gray-500
          ">
            {card.titulo}
          </p>

          <h2 className={`
            text-5xl
            font-black
            mt-3
            ${card.color}
          `}>
            {card.valor}
          </h2>

        </div>

      ))}

    </div>
  );
}