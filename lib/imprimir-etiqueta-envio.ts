type ProductoEtiqueta = {
  nombre: string;
  cantidad: number;
};

export type DatosEtiquetaEnvio = {
  codigo: string;
  cliente: string;
  telefono?: string | null;
  direccion?: string | null;
  departamento?: string | null;
  municipio?: string | null;
  zona?: string | null;
  fechaEntrega?: string | null;
  horaEntrega?: string | null;
  tipoEntrega: string;
  estadoPago: string;
  metodoPago?: string | null;
  total: number;
  abonado: number;
  saldo: number;
  observaciones?: string | null;
  productos: ProductoEtiqueta[];
};

const escapar = (valor: string | number | null | undefined) =>
  String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[caracter] || caracter);

const dinero = (valor: number) =>
  `Q${valor.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function imprimirEtiquetaEnvio(datos: DatosEtiquetaEnvio): boolean {
  const ventana = window.open("", "_blank", "width=600,height=800");
  if (!ventana) return false;

  const ubicacion = [datos.zona, datos.municipio, datos.departamento].filter(Boolean).join(" · ");
  const productos = datos.productos.map((producto) =>
    `<li><b>${escapar(producto.cantidad)}×</b> ${escapar(producto.nombre)}</li>`,
  ).join("");
  const saldo = Math.max(0, datos.saldo);
  const cobro = saldo < 0.01
    ? `<div class="cobro pagado">PAGADO · NO COBRAR</div>`
    : `<div class="cobro">COBRAR AL ENTREGAR: ${escapar(dinero(saldo))}</div>`;

  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Etiqueta ${escapar(datos.codigo)}</title><style>
    @page { size: 100mm 150mm; margin: 3mm; }
    * { box-sizing: border-box; }
    body { width: 94mm; margin: 0 auto; color: #111; background: #fff; font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.28; }
    h1,h2,p { margin: 0; } header { border-bottom: 2px solid #111; padding-bottom: 3mm; }
    header .marca { font-size: 11pt; font-weight: 700; } header h1 { margin-top: 1mm; font-size: 18pt; overflow-wrap: anywhere; }
    .seccion { border-bottom: 1px solid #111; padding: 2.5mm 0; }
    .titulo { display: block; margin-bottom: 1mm; font-size: 8pt; font-weight: 700; text-transform: uppercase; }
    .destinatario { font-size: 14pt; font-weight: 700; overflow-wrap: anywhere; }
    .direccion { font-size: 12pt; font-weight: 700; overflow-wrap: anywhere; }
    .dato { overflow-wrap: anywhere; } ul { margin: 1mm 0 0; padding-left: 5mm; } li { margin-bottom: 1mm; break-inside: avoid; }
    .cobro { margin-top: 2.5mm; border: 2px solid #111; padding: 2mm; text-align: center; font-size: 12pt; font-weight: 700; }
    .pagado { background: #eee; } .nota { white-space: pre-wrap; overflow-wrap: anywhere; }
    @media screen { body { padding: 12px 0; } }
  </style></head><body>
    <header><p class="marca">LA COCINA DE ISA · ORDEN DE ENVÍO</p><h1>${escapar(datos.codigo)}</h1></header>
    <section class="seccion"><span class="titulo">Recibe</span><p class="destinatario">${escapar(datos.cliente || "Sin nombre")}</p><p class="dato">Tel: ${escapar(datos.telefono || "Sin teléfono")}</p></section>
    <section class="seccion"><span class="titulo">Destino</span><p class="direccion">${escapar(datos.direccion || "Recoger en tienda")}</p><p class="dato">${escapar(ubicacion)}</p></section>
    <section class="seccion"><span class="titulo">Entrega</span><p>${escapar(datos.fechaEntrega || "Fecha por confirmar")} · ${escapar(datos.horaEntrega || "Hora por confirmar")}</p><p>${escapar(datos.tipoEntrega)}</p></section>
    <section class="seccion"><span class="titulo">Contenido · ${escapar(datos.productos.length)} producto(s)</span><ul>${productos}</ul></section>
    <section class="seccion"><span class="titulo">Cobro</span><p>Estado: ${escapar(datos.estadoPago)}</p><p>Medio: ${escapar(datos.metodoPago || "Por confirmar")}</p><p>Total: ${escapar(dinero(datos.total))} · Pagado: ${escapar(dinero(datos.abonado))}</p>${cobro}</section>
    ${datos.observaciones ? `<section class="seccion"><span class="titulo">Observaciones</span><p class="nota">${escapar(datos.observaciones)}</p></section>` : ""}
    <script>window.onload=()=>window.print()<\/script>
  </body></html>`);
  ventana.document.close();
  return true;
}
