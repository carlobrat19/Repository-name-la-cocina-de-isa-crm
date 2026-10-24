type DetalleCantidad = {
  producto_id: string | null;
  cantidad: number | string | null;
  productos: { nombre: string | null; categoria: string | null } | null;
};

type PedidoCantidad = {
  id: string;
  pedido_detalle: DetalleCantidad[] | null;
};

export type ResumenCantidadProducto = {
  clave: string;
  nombre: string;
  categoria: string | null;
  pedidos: number;
  unidades: number;
  grupos: { cantidadPorPedido: number; pedidos: number; unidades: number }[];
};

export function resumirCantidadesPorProducto(pedidos: PedidoCantidad[], productoFiltro: string): ResumenCantidadProducto[] {
  const productos = new Map<string, {
    nombre: string;
    categoria: string | null;
    porPedido: Map<string, number>;
  }>();

  for (const pedido of pedidos) {
    for (const detalle of pedido.pedido_detalle || []) {
      if (productoFiltro !== "Todos" && detalle.producto_id !== productoFiltro) continue;
      const cantidad = Number(detalle.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) continue;

      const nombre = detalle.productos?.nombre || "Producto eliminado";
      const clave = detalle.producto_id || `sin-id:${nombre}`;
      const producto = productos.get(clave) || {
        nombre,
        categoria: detalle.productos?.categoria || null,
        porPedido: new Map<string, number>(),
      };
      producto.porPedido.set(pedido.id, (producto.porPedido.get(pedido.id) || 0) + cantidad);
      productos.set(clave, producto);
    }
  }

  return Array.from(productos, ([clave, producto]) => {
    const pedidosPorCantidad = new Map<number, number>();
    for (const cantidad of producto.porPedido.values()) {
      pedidosPorCantidad.set(cantidad, (pedidosPorCantidad.get(cantidad) || 0) + 1);
    }
    const grupos = Array.from(pedidosPorCantidad, ([cantidadPorPedido, pedidos]) => ({
      cantidadPorPedido,
      pedidos,
      unidades: cantidadPorPedido * pedidos,
    })).sort((a, b) => a.cantidadPorPedido - b.cantidadPorPedido);

    return {
      clave,
      nombre: producto.nombre,
      categoria: producto.categoria,
      pedidos: producto.porPedido.size,
      unidades: grupos.reduce((total, grupo) => total + grupo.unidades, 0),
      grupos,
    };
  }).sort((a, b) => b.unidades - a.unidades || a.nombre.localeCompare(b.nombre, "es"));
}
