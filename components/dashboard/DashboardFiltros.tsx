type Props = {
  filtro: string;
  setFiltro: (
    value: string
  ) => void;

  fechaInicio: string;
  setFechaInicio: (
    value: string
  ) => void;

  fechaFin: string;
  setFechaFin: (
    value: string
  ) => void;
};

export default function DashboardFiltros({
  filtro,
  setFiltro,
  fechaInicio,
  setFechaInicio,
  fechaFin,
  setFechaFin,
}: Props) {

  return (

    <div className="
      bg-white
      rounded-[30px]
      shadow-2xl
      p-6
      mt-8
    ">

      <div className="
        grid
        grid-cols-1
        md:grid-cols-4
        gap-4
      ">

        {/* FILTRO */}
        <select
          value={filtro}
          onChange={(e) =>
            setFiltro(
              e.target.value
            )
          }
          className="
          w-full
          bg-gray-50
          border
          border-gray-200
          rounded-2xl
          px-5
          py-4
          font-bold
          text-gray-900
          outline-none
          focus:border-black
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

        </select>

        {/* FECHA INICIO */}
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) =>
            setFechaInicio(
              e.target.value
            )
          }
          className="
          w-full
          bg-gray-50
          border
          border-gray-200
          rounded-2xl
          px-5
          py-4
          font-bold
          text-gray-900
          outline-none
          focus:border-black
          "
        />

        {/* FECHA FIN */}
        <input
          type="date"
          value={fechaFin}
          onChange={(e) =>
            setFechaFin(
              e.target.value
            )
          }
          className="
          w-full
          bg-gray-50
          border
          border-gray-200
          rounded-2xl
          px-5
          py-4
          font-bold
          text-gray-900
          outline-none
          focus:border-black
          "
        />

        {/* LABEL */}
        <div className="
          bg-gray-50
          rounded-2xl
          flex
          items-center
          justify-center
          font-black
          text-gray-800
        ">
          Dashboard Inteligente
        </div>

      </div>

    </div>
  );
}