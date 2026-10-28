type TextoPdf = { str: string; transform: number[] };

export type FacturaPdfFel = {
  proveedor: string;
  nit: string;
  numero: string;
  fecha: string;
  total: number;
  impuesto: number;
  lineas: { descripcion: string; cantidad: number; monto: number }[];
};

const numero = (valor: string) => Number(valor.replace(/,/g, "").trim());
const meses: Record<string, string> = { ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06", jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12" };

function fechaIso(valor: string) {
  const partes = valor.match(/(\d{1,2})[-/](\d{1,2}|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[-/](\d{4})/i);
  if (!partes) return "";
  const mes = meses[partes[2].toLowerCase()] || partes[2].padStart(2, "0");
  const fecha = `${partes[3]}-${mes}-${partes[1].padStart(2, "0")}`;
  return !Number.isNaN(Date.parse(`${fecha}T12:00:00Z`)) ? fecha : "";
}

export async function leerPdfFel(bytes: Uint8Array): Promise<FacturaPdfFel> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const tarea = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  try {
    const documento = await tarea.promise;
    if (documento.numPages > 20) throw new Error("El PDF supera el límite de 20 páginas.");
    const filas: TextoPdf[][] = [];
    for (let pagina = 1; pagina <= documento.numPages; pagina++) {
      const contenido = await (await documento.getPage(pagina)).getTextContent();
      const grupos: TextoPdf[][] = [];
      for (const item of contenido.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const texto = item as TextoPdf;
        const grupo = grupos.find((fila) => Math.abs(fila[0].transform[5] - texto.transform[5]) <= 1.5);
        if (grupo) grupo.push(texto);
        else grupos.push([texto]);
      }
      filas.push(...grupos.map((fila) => fila.sort((a, b) => a.transform[4] - b.transform[4])));
    }
    const renglones = filas.map((fila) => fila.map((item) => item.str.trim()).join(" "));
    const textoCompleto = renglones.join("\n");
    const nit = textoCompleto.match(/NIT\s*Emisor\s*:\s*([\d-]+)/i)?.[1] || "";
    const proveedor = renglones.find((fila) => /SOCIEDAD ANONIMA|S\.A\./i.test(fila) && !/certificador|NIT:/i.test(fila))?.split(/NÚMERO DE AUTORIZACIÓN/i)[0].trim() || "";
    const serie = textoCompleto.match(/Serie\s*:\s*([A-Z0-9-]+)/i)?.[1] || "";
    const correlativo = textoCompleto.match(/N[uú]mero de DTE\s*:\s*(\d+)/i)?.[1] || "";
    const fecha = fechaIso(textoCompleto.match(/Fecha y hora de emisi[oó]n\s*:\s*([^\s]+(?:\s+\d{2}:\d{2}:\d{2})?)/i)?.[1] || "");
    const totalTexto = textoCompleto.match(/TOTALES\s*:\s*[\d,.]+\s+([\d,.]+)/i)?.[1] || "";
    const impuestoTexto = textoCompleto.match(/TOTALES\s*:[^\n]*?IVA\s+([\d,.]+)/i)?.[1]
      || [...textoCompleto.matchAll(/IVA[ \t]+([\d,.]+)/gi)].at(-1)?.[1] || "";
    const lineas = filas.flatMap((fila) => {
      const celda = (desde: number, hasta: number) => fila.filter((item) => item.transform[4] >= desde && item.transform[4] < hasta).map((item) => item.str.trim()).join(" ").trim();
      if (!/^\d+$/.test(celda(45, 70)) || !/^(Bien|Servicio)$/i.test(celda(70, 110))) return [];
      const cantidad = numero(celda(110, 150));
      const descripcion = celda(150, 280);
      const monto = numero(celda(430, 502));
      return descripcion && Number.isFinite(cantidad) && cantidad > 0 && Number.isFinite(monto) && monto >= 0 ? [{ descripcion, cantidad, monto }] : [];
    });
    const total = numero(totalTexto);
    const suma = Math.round(lineas.reduce((acumulado, linea) => acumulado + linea.monto, 0) * 100) / 100;
    if (!nit || !serie || !correlativo || !fecha || !Number.isFinite(total) || !lineas.length || Math.abs(suma - total) > 0.05) {
      throw new Error("No pude reconocer todos los datos y artículos de este PDF FEL. Puedes adjuntarlo y completar la factura manualmente, o usar el XML válido.");
    }
    return { proveedor, nit, numero: `${serie}-${correlativo}`, fecha, total, impuesto: numero(impuestoTexto) || 0, lineas };
  } finally {
    await tarea.destroy();
  }
}
