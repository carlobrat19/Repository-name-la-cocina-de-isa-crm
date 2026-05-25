type Props = {
  productos: {
    nombre: string;
    total: number;
  }[];
};

export default function TopProductos({
  productos,
}: Props) {

  return (

    <div className="
      bg-white
      rounded-[30px]
      shadow-2xl
      p-6
      h-full
    ">

      <h2 className="
        text-4xl
        font-black
        text-gray-900
      ">
        Productos Más Vendidos
      </h2>

      <p className="
        text-gray-500
        mt-2
        mb-6
      ">
        Ranking de productos
      </p>

      <div className="
        space-y-4
      ">

        {productos.length === 0 && (

          <div className="
            bg-gray-50
            rounded-2xl
            h-32
            flex
            items-center
            justify-center
            text-gray-400
            font-bold
          ">
            No hay datos
          </div>

        )}

        {productos.map(
          (
            producto,
            index
          ) => (

            <div
              key={index}
              className="
              flex
              items-center
              justify-between
              bg-gray-50
              rounded-2xl
              p-4
              "
            >

              <div className="
                flex
                items-center
                gap-4
              ">

                <div className="
                  w-12
                  h-12
                  rounded-2xl
                  bg-black
                  text-white
                  flex
                  items-center
                  justify-center
                  font-black
                ">
                  #{index + 1}
                </div>

                <div>

                  <p className="
                    font-black
                    text-gray-900
                    text-lg
                  ">
                    {producto.nombre}
                  </p>

                  <p className="
                    text-gray-500
                    text-sm
                  ">
                    Producto vendido
                  </p>

                </div>

              </div>

              <div className="
                text-right
              ">

                <p className="
                  text-3xl
                  font-black
                  text-green-600
                ">
                  {producto.total}
                </p>

                <p className="
                  text-xs
                  text-gray-500
                  uppercase
                ">
                  vendidos
                </p>

              </div>

            </div>

          )
        )}

      </div>

    </div>
  );
}