/** Mes calendario completo anterior en la zona de operación del CRM. */
export function rangoMesAnteriorGuatemala(hoy = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guatemala", year: "numeric", month: "numeric",
  }).formatToParts(hoy);
  const anio = Number(partes.find((parte) => parte.type === "year")?.value);
  const mes = Number(partes.find((parte) => parte.type === "month")?.value);
  const anioAnterior = mes === 1 ? anio - 1 : anio;
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const prefijo = `${anioAnterior}-${String(mesAnterior).padStart(2, "0")}`;
  return { desde: `${prefijo}-01`, hasta: `${prefijo}-${String(new Date(anioAnterior, mesAnterior, 0).getDate()).padStart(2, "0")}` };
}
