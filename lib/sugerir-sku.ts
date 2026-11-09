type ProductoConSku = { sku?: string | null };

export function prefijoSkuParaCategoria(categoria: string): "LCI" | "BB" | null {
  const nombre = categoria.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (nombre === "la cocina de isa" || nombre === "cocina de isa" || nombre === "lci") return "LCI";
  if (nombre === "brasas bravas" || nombre === "bb") return "BB";
  return null;
}

export function sugerirSku(categoria: string, productos: ProductoConSku[]): string | null {
  const prefijo = prefijoSkuParaCategoria(categoria);
  if (!prefijo) return null;

  let ultimo = 0;
  let ancho = 3;
  const patron = new RegExp(`^${prefijo}[-\\s]?(\\d+)$`, "i");
  for (const producto of productos) {
    const coincidencia = producto.sku?.trim().match(patron);
    if (!coincidencia) continue;
    ultimo = Math.max(ultimo, Number(coincidencia[1]));
    ancho = Math.max(ancho, coincidencia[1].length);
  }
  return `${prefijo}${String(ultimo + 1).padStart(ancho, "0")}`;
}
