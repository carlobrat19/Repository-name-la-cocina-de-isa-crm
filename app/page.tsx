import { obtenerProductos } from "../services/productos";

export default async function Home() {
  const productos = await obtenerProductos();

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="max-w-7xl mx-auto">

        <h1 className="text-4xl font-bold text-black mb-8">
          La Cocina de Isa CRM
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <p className="text-gray-800">Productos</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              {productos.length}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <p className="text-gray-800">Ventas Hoy</p>
            <h2 className="text-3xl font-bold text-gray-900">
              Q0.00
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <p className="text-gray-800">Ganancia</p>
            <h2 className="text-3xl font-bold text-gray-900">
              Q0.00
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <p className="text-gray-800">Pedidos</p>
            <h2 className="text-3xl font-bold text-gray-900">
              0
            </h2>
          </div>

        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Productos
            </h2>
          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead>
                <tr className="text-left py-3 text-black font-bold">
                  <th className="text-left py-3 text-black font-bold">Nombre</th>
                  <th className="text-left py-3 text-black font-bold">Categoría</th>
                  <th className="text-left py-3 text-black font-bold">Precio</th>
                  <th className="text-left py-3 text-black font-bold">Costo</th>
                  <th className="text-left py-3 text-black font-bold">Stock</th>
                  <th className="text-left py-3 text-black font-bold">Estado</th>
                </tr>
              </thead>

              <tbody>

                {productos.map((producto: any) => (
                  <tr
                    key={producto.id}
                    className="border-b border-gray-200"
                  >
                    <td className="py-3 text-black font-medium">
                      {producto.nombre}
                    </td>

                    <td className="py-3 text-black font-medium">
                      {producto.categoria}
                    </td>

                    <td className="py-3 text-black font-medium">
                      Q{producto.precio_venta}
                    </td>

                    <td className="py-3 text-black font-medium">
                      Q{producto.costo}
                    </td>

                    <td className="py-3 text-black font-medium">
                      {producto.stock}
                    </td>

                    <td className="py-3 text-black font-medium">
                      {producto.estado}
                    </td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>

        </div>

      </div>
    </main>
  );
}