import * as XLSX from "xlsx";

type FilaExcel = Record<string, string | number | boolean | null>;

export function exportarExcel(nombreArchivo: string, hojas: { nombre: string; filas: FilaExcel[] }[]) {
  const libro = XLSX.utils.book_new();
  for (const hoja of hojas) {
    const columnas = hoja.filas.length ? Object.keys(hoja.filas[0]) : ["Sin resultados"];
    const tabla = hoja.filas.length ? hoja.filas : [{ "Sin resultados": "No hay datos para los filtros seleccionados" }];
    const pagina = XLSX.utils.json_to_sheet(tabla, { header: columnas });
    pagina["!cols"] = columnas.map((columna) => ({
      wch: Math.min(45, tabla.reduce((ancho, fila) => Math.max(ancho, String(fila[columna] ?? "").length + 2), Math.max(14, columna.length + 2))),
    }));
    if (pagina["!ref"]) pagina["!autofilter"] = { ref: pagina["!ref"] };
    XLSX.utils.book_append_sheet(libro, pagina, hoja.nombre);
  }
  XLSX.writeFile(libro, `${nombreArchivo}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
