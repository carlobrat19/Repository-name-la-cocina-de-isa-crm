"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { moneda } from "@/lib/crm";

type Proveedor = { id: string; nombre: string; nit: string | null };
type FacturaExistente = { id: string; proveedor_id: string; numero: string | null };
type LineaExistente = { factura_id: string; descripcion: string; categoria: string };
type Ingrediente = { id: string; nombre: string; unidad_base: "g" | "ml" | "unidad" };
type Equivalencia = { id: string; proveedor_id: string; descripcion: string; ingrediente_id: string };
type ItemFEL = { descripcion: string; cantidad: number | null; unidad: string | null; monto: number; categoria: string; sugerida: boolean; ingredienteId: string; ingredienteSugerido: string; cantidadBase: string; recordar: boolean };
type FacturaFEL = {
  archivo: string;
  xml: string;
  nit: string;
  proveedor: string;
  numero: string;
  fecha: string;
  total: number;
  impuesto: number;
  items: ItemFEL[];
  categoria: string;
};

const categorias = ["Por clasificar", "Materia prima", "Empaques", "Limpieza e higiene", "Mensajería y envíos", "Utensilios de cocina", "Equipo de cocina", "Mobiliario", "Servicios", "Publicidad", "Otros gastos"];
const normalizar = (valor: string) => valor.trim().toLocaleUpperCase("es-GT");
const clave = (nit: string, numero: string) => `${normalizar(nit)}|${normalizar(numero)}`;
const descripcionClave = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("es-GT").replace(/[^A-Z0-9]+/g, " ").trim();
function convertirCantidad(cantidad: number | null, unidad: string | null, base: Ingrediente["unidad_base"] | undefined) {
  if (!cantidad || !base) return "";
  const origen = descripcionClave(unidad || "");
  if (base === "g") {
    if (["KG", "KILOGRAMO", "KILOGRAMOS"].includes(origen)) return String(Math.round(cantidad * 1_000_000) / 1_000);
    if (["LB", "LIBRA", "LIBRAS"].includes(origen)) return String(Math.round(cantidad * 453_592.37) / 1_000);
    if (["G", "GRAMO", "GRAMOS"].includes(origen)) return String(cantidad);
  }
  if (base === "ml") {
    if (["L", "LT", "LITRO", "LITROS"].includes(origen)) return String(Math.round(cantidad * 1_000_000) / 1_000);
    if (["ML", "MILILITRO", "MILILITROS"].includes(origen)) return String(cantidad);
  }
  if (base === "unidad" && ["U", "UNI", "UN", "UNIDAD", "UNIDADES", "PZ", "PIEZA", "PIEZAS"].includes(origen)) return String(cantidad);
  return "";
}

function leerFel(xml: string, archivo: string): FacturaFEL {
  const documento = new DOMParser().parseFromString(xml, "application/xml");
  if (documento.getElementsByTagName("parsererror").length) throw new Error("XML inválido");
  const todos = Array.from(documento.getElementsByTagName("*"));
  const nodo = (nombre: string) => todos.find((elemento) => elemento.localName === nombre);
  const emisor = nodo("Emisor");
  const generales = nodo("DatosGenerales");
  const autorizacion = nodo("NumeroAutorizacion");
  const total = Number(nodo("GranTotal")?.textContent?.trim());
  const nit = emisor?.getAttribute("NITEmisor")?.trim() || "";
  const proveedor = emisor?.getAttribute("NombreEmisor")?.trim() || "";
  const fecha = (generales?.getAttribute("FechaHoraEmision") || "").slice(0, 10);
  const numero = [autorizacion?.getAttribute("Serie"), autorizacion?.getAttribute("Numero")].filter(Boolean).join("-") || autorizacion?.textContent?.trim() || "";
  if (!nit || !proveedor || !numero || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(total) || total < 0) throw new Error("Faltan datos principales de la factura FEL");
  const impuesto = todos.filter((elemento) => elemento.localName === "TotalImpuesto").reduce((suma, elemento) => suma + Number(elemento.getAttribute("TotalMontoImpuesto") || 0), 0);
  const items = todos.filter((elemento) => elemento.localName === "Item").map((item) => {
    const valor = (nombre: string) => Array.from(item.getElementsByTagName("*")).find((elemento) => elemento.localName === nombre)?.textContent?.trim() || "";
    const cantidad = Number(valor("Cantidad"));
    const monto = Number(valor("Total") || valor("Precio"));
    return { descripcion: valor("Descripcion"), cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : null, unidad: valor("UnidadMedida") || null, monto, categoria: "Por clasificar", sugerida: false, ingredienteId: "", ingredienteSugerido: "", cantidadBase: "", recordar: false };
  }).filter((item) => item.descripcion && Number.isFinite(item.monto) && item.monto >= 0);
  return { archivo, xml, nit, proveedor, numero, fecha, total, impuesto: Number.isFinite(impuesto) ? impuesto : 0, items, categoria: "Por clasificar" };
}

export default function ImportarZipSat({ usuarioId, proveedores, facturas, lineasExistentes, ingredientes, equivalencias, alGuardar }: { usuarioId: string | null; proveedores: Proveedor[]; facturas: FacturaExistente[]; lineasExistentes: LineaExistente[]; ingredientes: Ingrediente[]; equivalencias: Equivalencia[]; alGuardar: () => Promise<void> }) {
  const [filas, setFilas] = useState<FacturaFEL[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [procesadas, setProcesadas] = useState<Set<string>>(new Set());
  const [problemas, setProblemas] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [avance, setAvance] = useState("");
  const [filtro, setFiltro] = useState("");
  const [facturaDetalle, setFacturaDetalle] = useState("");

  const existentes = useMemo(() => new Set(facturas.map((factura) => {
    const proveedor = proveedores.find((item) => item.id === factura.proveedor_id);
    return clave(proveedor?.nit || "", factura.numero || "");
  })), [facturas, proveedores]);
  const repetidasZip = useMemo(() => {
    const vistas = new Set<string>();
    const repetidas = new Set<string>();
    for (const fila of filas) { const id = clave(fila.nit, fila.numero); if (vistas.has(id)) repetidas.add(id); else vistas.add(id); }
    return repetidas;
  }, [filas]);
  const elegibles = filas.filter((fila) => !existentes.has(clave(fila.nit, fila.numero)) && !repetidasZip.has(clave(fila.nit, fila.numero)) && !procesadas.has(fila.archivo));
  const visibles = filas.filter((fila) => `${fila.proveedor} ${fila.nit} ${fila.numero} ${fila.archivo} ${fila.items.map((item) => item.descripcion).join(" ")}`.toLocaleLowerCase("es-GT").includes(filtro.trim().toLocaleLowerCase("es-GT")));
  const repeticiones = useMemo(() => {
    const conteos = new Map<string, number>();
    for (const fila of filas) for (const item of fila.items) { const id = descripcionClave(item.descripcion); conteos.set(id, (conteos.get(id) || 0) + 1); }
    return conteos;
  }, [filas]);
  const detalle = filas.find((fila) => fila.archivo === facturaDetalle);
  const articulosRepetidos = useMemo(() => {
    const grupos = new Map<string, { descripcion: string; veces: number; total: number; facturas: Set<string>; categorias: Set<string> }>();
    for (const fila of filas) for (const item of fila.items) {
      const id = descripcionClave(item.descripcion);
      const grupo = grupos.get(id) || { descripcion: item.descripcion, veces: 0, total: 0, facturas: new Set<string>(), categorias: new Set<string>() };
      grupo.veces++; grupo.total += item.monto; grupo.facturas.add(fila.archivo); grupo.categorias.add(item.categoria); grupos.set(id, grupo);
    }
    return [...grupos.values()].filter((grupo) => grupo.veces > 1).sort((a, b) => b.veces - a.veces).slice(0, 20);
  }, [filas]);

  function cambiarCategoriaLinea(archivo: string, indice: number, categoria: string, todas: boolean) {
    setFilas((actual) => {
      const original = actual.find((fila) => fila.archivo === archivo)?.items[indice];
      if (!original) return actual;
      const id = descripcionClave(original.descripcion);
      return actual.map((fila) => ({ ...fila, items: fila.items.map((item, posicion) => {
        if (!(todas ? descripcionClave(item.descripcion) === id : fila.archivo === archivo && posicion === indice)) return item;
        return { ...item, categoria, sugerida: false };
      }) }));
    });
  }

  function cambiarIngredienteLinea(archivo: string, indice: number, ingredienteId: string, todas = false) {
    setFilas((actual) => {
      const origen = actual.find((fila) => fila.archivo === archivo);
      const original = origen?.items[indice];
      if (!origen || !original) return actual;
      const descripcion = descripcionClave(original.descripcion);
      const ingrediente = ingredientes.find((item) => item.id === ingredienteId);
      return actual.map((fila) => ({ ...fila, items: fila.items.map((item, posicion) => {
        if (!(todas ? normalizar(fila.nit) === normalizar(origen.nit) && descripcionClave(item.descripcion) === descripcion : fila.archivo === archivo && posicion === indice)) return item;
        return { ...item, ingredienteId, cantidadBase: convertirCantidad(item.cantidad, item.unidad, ingrediente?.unidad_base), recordar: false };
      }) }));
    });
  }

  function cambiarCantidadBase(archivo: string, indice: number, cantidadBase: string) {
    setFilas((actual) => actual.map((fila) => fila.archivo === archivo ? { ...fila, items: fila.items.map((item, posicion) => posicion === indice ? { ...item, cantidadBase } : item) } : fila));
  }

  function cambiarRecordar(archivo: string, indice: number, recordar: boolean) {
    setFilas((actual) => actual.map((fila) => fila.archivo === archivo ? { ...fila, items: fila.items.map((item, posicion) => posicion === indice ? { ...item, recordar } : item) } : fila));
  }

  async function leerZip(archivo: File | null) {
    setFilas([]); setSeleccionadas(new Set()); setProcesadas(new Set()); setProblemas([]); setMensaje("");
    if (!archivo) return;
    if (!archivo.name.toLowerCase().endsWith(".zip") || archivo.size > 20 * 1024 * 1024) { setMensaje("Selecciona un ZIP de la SAT de máximo 20 MB."); return; }
    setLeyendo(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(archivo);
      const entradas = Object.values(zip.files).filter((entrada) => !entrada.dir);
      if (entradas.length > 500) throw new Error("El ZIP supera el límite de 500 archivos.");
      const errores: string[] = [];
      const leidas: FacturaFEL[] = [];
      let caracteres = 0;
      for (const entrada of entradas) {
        if (!entrada.name.toLowerCase().endsWith(".xml")) { errores.push(`${entrada.name}: no es XML`); continue; }
        try {
          const xml = await entrada.async("string");
          caracteres += xml.length;
          if (xml.length > 2_000_000 || caracteres > 80_000_000) throw new Error("Archivo demasiado grande");
          leidas.push(leerFel(xml, entrada.name));
        } catch (error) { errores.push(`${entrada.name}: ${error instanceof Error ? error.message : "No se pudo leer"}`); }
      }
      const nitPorFactura = new Map(facturas.map((factura) => [factura.id, normalizar(proveedores.find((proveedor) => proveedor.id === factura.proveedor_id)?.nit || "")]));
      const historico = new Map<string, Set<string>>();
      for (const linea of lineasExistentes) {
        if (!linea.categoria || linea.categoria === "Por clasificar") continue;
        const nit = nitPorFactura.get(linea.factura_id);
        if (!nit) continue;
        const id = `${nit}|${descripcionClave(linea.descripcion)}`;
        if (!historico.has(id)) historico.set(id, new Set());
        historico.get(id)!.add(linea.categoria);
      }
      for (const fila of leidas) for (const item of fila.items) {
        const proveedorId = proveedores.find((proveedor) => normalizar(proveedor.nit || "") === normalizar(fila.nit))?.id;
        item.ingredienteSugerido = equivalencias.find((equivalencia) => equivalencia.proveedor_id === proveedorId && descripcionClave(equivalencia.descripcion) === descripcionClave(item.descripcion) && ingredientes.some((ingrediente) => ingrediente.id === equivalencia.ingrediente_id))?.ingrediente_id || "";
        const opciones = historico.get(`${normalizar(fila.nit)}|${descripcionClave(item.descripcion)}`);
        if (opciones?.size === 1) { item.categoria = [...opciones][0]; item.sugerida = true; }
        else if (!opciones?.size && /\bPAPEL (?:HIG|HIGIENICO|SANITARIO)\b/.test(descripcionClave(item.descripcion))) { item.categoria = "Limpieza e higiene"; item.sugerida = true; }
        else if (!opciones?.size && /\bHARINA\b/.test(descripcionClave(item.descripcion))) { item.categoria = "Materia prima"; item.sugerida = true; }
      }
      setFilas(leidas); setProblemas(errores); setFacturaDetalle("");
      setMensaje(`${leidas.length} facturas FEL leídas. Revisa la lista y selecciona solo las que quieres documentar.`);
    } catch (error) { setMensaje(error instanceof Error ? error.message : "No se pudo abrir el ZIP."); }
    finally { setLeyendo(false); }
  }

  async function importar() {
    if (!usuarioId || !seleccionadas.size || importando) return;
    const pendientes = elegibles.filter((fila) => seleccionadas.has(fila.archivo));
    if (!pendientes.length) return;
    for (const fila of pendientes) for (const item of fila.items) {
      if (item.ingredienteId && (!Number.isFinite(Number(item.cantidadBase)) || Number(item.cantidadBase) <= 0)) {
        setFacturaDetalle(fila.archivo);
        setMensaje(`Revisa la cantidad base de «${item.descripcion}» en la factura ${fila.numero}. Indica cuánto corresponde a la unidad del ingrediente.`);
        return;
      }
    }
    const nuevos = new Set(pendientes.filter((fila) => !proveedores.some((item) => normalizar(item.nit || "") === normalizar(fila.nit))).map((fila) => normalizar(fila.nit)));
    if (!window.confirm(`Se documentarán ${pendientes.length} facturas${nuevos.size ? ` y se crearán ${nuevos.size} proveedores nuevos` : ""}. No se crearán gastos ni movimientos de inventario. ¿Continuar?`)) return;
    setImportando(true); setProblemas([]);
    const errores: string[] = [];
    const proveedoresPorNit = new Map(proveedores.filter((item) => item.nit).map((item) => [normalizar(item.nit || ""), item.id]));
    const guardadas = new Set<string>();
    for (let indice = 0; indice < pendientes.length; indice++) {
      const fila = pendientes[indice];
      setAvance(`${indice + 1} de ${pendientes.length}: ${fila.proveedor}`);
      try {
        let proveedorId = proveedoresPorNit.get(normalizar(fila.nit));
        if (!proveedorId) {
          const { data, error } = await supabase.from("proveedores_compra").insert({ nombre: fila.proveedor, nit: fila.nit, creado_por: usuarioId }).select("id").single();
          if (error || !data) throw new Error(error?.message || "No se pudo crear el proveedor");
          proveedorId = String(data.id); proveedoresPorNit.set(normalizar(fila.nit), proveedorId);
        }
        const { data: factura, error: facturaError } = await supabase.from("facturas_compra").insert({ proveedor_id: proveedorId, numero: fila.numero, fecha: fila.fecha, total: fila.total, impuesto: fila.impuesto, categoria: fila.categoria, notas: "Importada desde ZIP FEL de la SAT; revisar categoría y vinculación de compras.", creado_por: usuarioId }).select("id").single();
        if (facturaError || !factura) throw new Error(facturaError?.code === "23505" ? "Factura ya registrada" : facturaError?.message || "No se pudo guardar la factura");
        guardadas.add(fila.archivo);
        if (fila.items.length) {
          const { error } = await supabase.from("facturas_compra_lineas").insert(fila.items.map((item) => ({ factura_id: factura.id, descripcion: item.descripcion, categoria: item.categoria, cantidad: item.cantidad, unidad_factura: item.unidad, monto: item.monto, ingrediente_id: item.ingredienteId || null, cantidad_base: item.ingredienteId ? Number(item.cantidadBase) : null })));
          if (error) errores.push(`${fila.archivo}: factura guardada, pero no sus líneas (${error.message})`);
          else {
            const recordadas = new Map<string, ItemFEL>();
            for (const item of fila.items) if (item.recordar && item.ingredienteId) recordadas.set(descripcionClave(item.descripcion), item);
            for (const item of recordadas.values()) {
              const existente = equivalencias.find((equivalencia) => equivalencia.proveedor_id === proveedorId && descripcionClave(equivalencia.descripcion) === descripcionClave(item.descripcion));
              const { error: equivalenciaError } = existente
                ? await supabase.from("equivalencias_proveedor_ingrediente").update({ ingrediente_id: item.ingredienteId }).eq("id", existente.id)
                : await supabase.from("equivalencias_proveedor_ingrediente").insert({ proveedor_id: proveedorId, descripcion: item.descripcion, ingrediente_id: item.ingredienteId });
              if (equivalenciaError && equivalenciaError.code !== "23505") errores.push(`${fila.archivo}: no se pudo recordar «${item.descripcion}» (${equivalenciaError.message})`);
            }
          }
        }
        const path = `${factura.id}/${crypto.randomUUID()}.xml`;
        const { error: archivoError } = await supabase.storage.from("facturas-compra").upload(path, new Blob([fila.xml], { type: "application/xml" }), { contentType: "application/xml", upsert: false });
        if (archivoError) errores.push(`${fila.archivo}: factura guardada sin adjunto (${archivoError.message})`);
        else {
          const { error } = await supabase.from("facturas_compra").update({ comprobante_path: path }).eq("id", factura.id);
          if (error) errores.push(`${fila.archivo}: factura guardada; el adjunto requiere revisión (${error.message})`);
        }
      } catch (error) { errores.push(`${fila.archivo}: ${error instanceof Error ? error.message : "No se pudo importar"}`); }
    }
    setProcesadas((actual) => new Set([...actual, ...guardadas]));
    setSeleccionadas(new Set()); setProblemas(errores);
    setMensaje(`${guardadas.size} facturas documentadas. ${errores.length ? `${errores.length} avisos para revisar.` : "Sin incidencias."} Caja e inventario no cambiaron.`);
    setAvance(""); setImportando(false);
    await alGuardar();
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-xl font-black">Importar ZIP de la SAT</h2>
    <p className="mt-1 text-sm text-slate-600">Sube el ZIP tal como lo descargaste. Revisa cada artículo y, si corresponde, vincúlalo a un ingrediente existente antes de importar. Esto documenta la factura, sin sumar inventario ni registrar pagos.</p>
    <input aria-label="ZIP de facturas FEL de la SAT" type="file" accept=".zip,application/zip,application/x-zip-compressed" disabled={leyendo || importando} onChange={(event) => void leerZip(event.target.files?.[0] || null)} className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm"/>
    {leyendo && <p role="status" className="mt-3 text-sm font-semibold">Leyendo facturas del ZIP…</p>}
    {mensaje && <p role="status" className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{mensaje}</p>}
    {!!problemas.length && <details className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><summary className="cursor-pointer font-bold">{problemas.length} archivos o avisos para revisar</summary><ul className="mt-2 max-h-44 overflow-y-auto pl-5">{problemas.map((problema, indice) => <li key={`${indice}-${problema}`} className="list-disc">{problema}</li>)}</ul></details>}
    {!!filas.length && <><div className="mt-5 flex flex-wrap items-center gap-3"><input aria-label="Filtrar facturas del ZIP" placeholder="Proveedor, NIT, número o artículo" value={filtro} onChange={(event) => setFiltro(event.target.value)} className="min-w-56 flex-1 rounded-xl border border-slate-200 p-3 text-sm"/><button type="button" onClick={() => setSeleccionadas(new Set(elegibles.map((fila) => fila.archivo)))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">Seleccionar {elegibles.length} disponibles</button><button type="button" onClick={() => setSeleccionadas(new Set())} className="text-xs font-bold text-slate-600 underline">Quitar selección</button></div>
      <p className="mt-2 text-xs text-slate-500">{filas.length} leídas · {elegibles.length} disponibles · {filas.length - elegibles.length} repetidas o ya registradas. Categoría e ingrediente se pueden ajustar antes de importar.</p>
      {!!articulosRepetidos.length && <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-bold">Artículos con descripción repetida · ver los más frecuentes</summary><p className="mt-2 text-xs text-slate-500">Son líneas de compra, no facturas duplicadas. El total es la suma de esas líneas dentro del ZIP.</p><div className="mt-2 max-h-52 overflow-y-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Descripción</th><th className="p-2">Líneas / facturas</th><th className="p-2">Categoría</th><th className="p-2 text-right">Monto documentado</th></tr></thead><tbody>{articulosRepetidos.map((grupo) => <tr key={descripcionClave(grupo.descripcion)} className="border-t border-slate-200"><td className="p-2 font-semibold">{grupo.descripcion}</td><td className="p-2">{grupo.veces} / {grupo.facturas.size}</td><td className="p-2">{grupo.categorias.size === 1 ? [...grupo.categorias][0] : "Varias · revisar"}</td><td className="p-2 text-right">{moneda(grupo.total)}</td></tr>)}</tbody></table></div></details>}
      <div className="mt-3 max-h-[460px] overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[850px] text-left text-sm"><thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="p-3">Elegir</th><th className="p-3">Proveedor</th><th className="p-3">Factura / fecha</th><th className="p-3">Líneas</th><th className="p-3">Categoría</th><th className="p-3 text-right">Total</th><th className="p-3">Estado</th></tr></thead><tbody>{visibles.map((fila) => { const duplicada = existentes.has(clave(fila.nit, fila.numero)) || repetidasZip.has(clave(fila.nit, fila.numero)) || procesadas.has(fila.archivo); return <tr key={fila.archivo} className="border-t border-slate-100"><td className="p-3"><input type="checkbox" aria-label={`Seleccionar factura de ${fila.proveedor} ${fila.numero}`} checked={seleccionadas.has(fila.archivo)} disabled={duplicada || importando} onChange={(event) => setSeleccionadas((actual) => { const siguiente = new Set(actual); if (event.target.checked) siguiente.add(fila.archivo); else siguiente.delete(fila.archivo); return siguiente; })}/></td><td className="p-3 font-semibold">{fila.proveedor}<p className="font-normal text-slate-500">NIT {fila.nit}</p></td><td className="p-3">{fila.numero}<p className="text-slate-500">{fila.fecha}</p></td><td className="p-3">{fila.items.length}</td><td className="p-3"><select aria-label={`Categoría de factura ${fila.numero}`} value={fila.categoria} disabled={duplicada || importando} onChange={(event) => setFilas((actual) => actual.map((item) => item.archivo === fila.archivo ? { ...item, categoria: event.target.value } : item))} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">{categorias.map((item) => <option key={item}>{item}</option>)}</select></td><td className="p-3 text-right font-bold">{moneda(fila.total)}</td><td className="p-3 text-xs">{procesadas.has(fila.archivo) ? "Importada" : duplicada ? "Repetida" : "Por revisar"}</td></tr>; })}</tbody></table></div>
      <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">Revisar artículos por factura</h3><p className="text-xs text-slate-600">Una descripción repetida no es una factura duplicada. Las sugerencias usan clasificaciones anteriores del mismo proveedor y deben revisarse.</p></div><select aria-label="Factura del ZIP para revisar artículos" value={facturaDetalle} onChange={(event) => setFacturaDetalle(event.target.value)} className="max-w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"><option value="">Seleccionar factura</option>{filas.map((fila) => <option key={fila.archivo} value={fila.archivo}>{fila.proveedor} · {fila.numero}</option>)}</select></div>
        {detalle && <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">{detalle.items.map((item, indice) => {
          const veces = repeticiones.get(descripcionClave(item.descripcion)) || 1;
          const coincidenciasProveedor = filas.reduce((total, fila) => total + (normalizar(fila.nit) === normalizar(detalle.nit) ? fila.items.filter((otro) => descripcionClave(otro.descripcion) === descripcionClave(item.descripcion)).length : 0), 0);
          const ingrediente = ingredientes.find((opcion) => opcion.id === item.ingredienteId);
          const sugerido = ingredientes.find((opcion) => opcion.id === item.ingredienteSugerido);
          return <div key={`${detalle.archivo}-${indice}`} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div><b>{item.descripcion}</b><p className="text-xs text-slate-500">{item.cantidad ?? "—"} {item.unidad || ""} · {moneda(item.monto)}{veces > 1 ? ` · Aparece ${veces} veces en el ZIP` : ""}</p></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-bold">Categoría<select value={item.categoria} disabled={importando} onChange={(event) => cambiarCategoriaLinea(detalle.archivo, indice, event.target.value, false)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs">{categorias.map((opcion) => <option key={opcion}>{opcion}</option>)}</select>{item.sugerida && <span className="font-normal text-blue-700">Sugerida · revisa antes de importar</span>}</label>
              <label className="text-xs font-bold">Ingrediente existente<select value={item.ingredienteId} disabled={importando} onChange={(event) => cambiarIngredienteLinea(detalle.archivo, indice, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"><option value="">Sin vincular</option>{ingredientes.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre} ({opcion.unidad_base})</option>)}</select></label>
              <label className="text-xs font-bold">Cantidad para ingrediente {ingrediente ? `(${ingrediente.unidad_base})` : ""}<input type="number" min="0.001" step="0.001" value={item.cantidadBase} disabled={importando || !ingrediente} onChange={(event) => cambiarCantidadBase(detalle.archivo, indice, event.target.value)} placeholder="Ingresa cantidad base" className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"/></label>
            </div>
            {sugerido && !item.ingredienteId && <button type="button" disabled={importando} onClick={() => cambiarIngredienteLinea(detalle.archivo, indice, sugerido.id)} className="mt-2 text-xs font-bold text-blue-700 underline">Sugerencia del proveedor: {sugerido.nombre} · usar</button>}
            {ingrediente && !item.cantidadBase && <p className="mt-2 text-xs text-amber-800">No se pudo convertir automáticamente «{item.unidad || "sin unidad"}». Indica la cantidad en {ingrediente.unidad_base} antes de importar.</p>}
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <button type="button" disabled={importando || veces < 2 || item.categoria === "Por clasificar"} onClick={() => cambiarCategoriaLinea(detalle.archivo, indice, item.categoria, true)} className="text-xs font-bold text-orange-700 underline disabled:text-slate-400">Aplicar categoría a {veces} coincidencias</button>
              <button type="button" disabled={importando || coincidenciasProveedor < 2 || !ingrediente} onClick={() => cambiarIngredienteLinea(detalle.archivo, indice, item.ingredienteId, true)} className="text-xs font-bold text-orange-700 underline disabled:text-slate-400">Aplicar ingrediente a {coincidenciasProveedor} artículos del proveedor</button>
              {ingrediente && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={item.recordar} disabled={importando} onChange={(event) => cambiarRecordar(detalle.archivo, indice, event.target.checked)}/> Recordar equivalencia para próximas facturas</label>}
            </div>
          </div>;
        })}</div>}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-600">{seleccionadas.size} seleccionadas. Las nuevas empresas proveedoras se crearán solo al confirmar.</p><button type="button" disabled={!seleccionadas.size || importando || !usuarioId} onClick={() => void importar()} className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{importando ? avance : `Importar ${seleccionadas.size} seleccionadas`}</button></div>
    </>}
  </section>;
}
