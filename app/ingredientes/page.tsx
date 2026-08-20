"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Unidad = "g" | "ml" | "unidad";
type Ingrediente = {
  id: string;
  nombre: string;
  unidad_base: Unidad;
  costo_referencia: number | string;
  stock_actual: number | string;
  activo: boolean;
  notas: string | null;
};
type Movimiento = {
  id: string;
  ingrediente_id: string;
  tipo: "compra" | "ajuste" | "consumo_produccion";
  cantidad: number | string;
  costo_unitario: number | string;
  total: number | string;
  nota: string | null;
  created_at: string;
  ingredientes: { nombre: string; unidad_base: Unidad } | null;
};

const numero = (valor: number | string | null | undefined, decimales = 3) =>
  Number(valor || 0).toLocaleString("es-GT", {
    maximumFractionDigits: decimales,
  });
const dinero = (valor: number | string | null | undefined, decimales = 4) =>
  `Q${Number(valor || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: decimales })}`;

export default function IngredientesPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Ingrediente | null>(null);
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState<Unidad>("g");
  const [stock, setStock] = useState("0");
  const [costo, setCosto] = useState("0");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);
    const [ingredientesRespuesta, movimientosRespuesta] = await Promise.all([
      supabase
        .from("ingredientes")
        .select(
          "id,nombre,unidad_base,costo_referencia,stock_actual,activo,notas",
        )
        .order("nombre"),
      supabase
        .from("compras_ingredientes")
        .select(
          "id,ingrediente_id,tipo,cantidad,costo_unitario,total,nota,created_at,ingredientes(nombre,unidad_base)",
        )
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    setCargando(false);
    if (ingredientesRespuesta.error || movimientosRespuesta.error) {
      console.error(ingredientesRespuesta.error || movimientosRespuesta.error);
      alert("No se pudo cargar el inventario de ingredientes.");
      return;
    }
    setIngredientes((ingredientesRespuesta.data || []) as Ingrediente[]);
    setMovimientos(
      (movimientosRespuesta.data || []) as unknown as Movimiento[],
    );
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const limpiar = () => {
    setSeleccionado(null);
    setNombre("");
    setUnidad("g");
    setStock("0");
    setCosto("0");
    setNota("");
  };
  const editar = (ingrediente: Ingrediente) => {
    setSeleccionado(ingrediente);
    setNombre(ingrediente.nombre);
    setUnidad(ingrediente.unidad_base);
    setStock(String(ingrediente.stock_actual));
    setCosto(String(ingrediente.costo_referencia));
    setNota("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const eliminar = async (ingrediente: Ingrediente) => {
    if (
      !window.confirm(
        `¿Eliminar definitivamente ${ingrediente.nombre}? Esta acción solo está disponible si no se usa en una receta.`,
      )
    )
      return;
    const { error } = await supabase.rpc("eliminar_ingrediente_seguro", {
      p_ingrediente_id: ingrediente.id,
    });
    if (error) {
      alert(error.message);
      return;
    }
    if (seleccionado?.id === ingrediente.id) limpiar();
    await cargar();
  };

  const guardar = async (event: FormEvent) => {
    event.preventDefault();
    if (!nombre.trim() || Number(stock) < 0 || Number(costo) < 0) {
      alert("Completa nombre, existencias y costo con valores válidos.");
      return;
    }
    setGuardando(true);
    if (seleccionado) {
      const { error } = await supabase.rpc("ajustar_ingrediente", {
        p_ingrediente_id: seleccionado.id,
        p_nombre: nombre.trim(),
        p_unidad_base: unidad,
        p_stock_final: Number(stock),
        p_costo_referencia: Number(costo),
        p_nota: nota.trim() || null,
      });
      setGuardando(false);
      if (error) {
        console.error(error);
        alert(
          "No se pudo guardar el ajuste. Verifica que el nombre no esté repetido.",
        );
        return;
      }
      alert(
        "Ingrediente actualizado. El cambio quedó registrado en el historial.",
      );
    } else {
      const { error } = await supabase
        .from("ingredientes")
        .insert({
          nombre: nombre.trim(),
          unidad_base: unidad,
          stock_actual: Number(stock),
          costo_referencia: Number(costo),
          notas: nota.trim() || null,
        });
      setGuardando(false);
      if (error) {
        console.error(error);
        alert(
          error.code === "23505"
            ? "Ya existe un ingrediente con ese nombre."
            : "No se pudo crear el ingrediente.",
        );
        return;
      }
      alert("Ingrediente creado.");
    }
    limpiar();
    await cargar();
  };

  const filtrados = useMemo(
    () =>
      ingredientes.filter((ingrediente) =>
        ingrediente.nombre
          .toLowerCase()
          .includes(busqueda.trim().toLowerCase()),
      ),
    [ingredientes, busqueda],
  );
  const valorInventario = ingredientes.reduce(
    (total, ingrediente) =>
      total +
      Number(ingrediente.stock_actual) * Number(ingrediente.costo_referencia),
    0,
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-orange-600">
              Costos e inventario
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
              Ingredientes
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Administra las materias primas que usan tus recetas. El costo por
              unidad y las existencias se reflejan automáticamente en el cálculo
              de cada receta.
            </p>
          </div>
          <Link
            href="/recetas"
            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
          >
            Ir a recetas y costos
          </Link>
        </header>
        <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <form
            onSubmit={guardar}
            className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-500">
              {seleccionado ? "Editar ingrediente" : "Nueva materia prima"}
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {seleccionado ? seleccionado.nombre : "Agregar ingrediente"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Un cambio de costo o existencia se guarda también en el historial
              como ajuste.
            </p>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-bold text-slate-700">
                Nombre
                <input
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Ej. Aceite vegetal"
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-orange-500"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-bold text-slate-700">
                  Unidad
                  <select
                    value={unidad}
                    onChange={(event) =>
                      setUnidad(event.target.value as Unidad)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <option value="g">Gramos (g)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="unidad">Unidad</option>
                  </select>
                </label>
                <label className="text-sm font-bold text-slate-700">
                  Existencia actual
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={stock}
                    onChange={(event) => setStock(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 p-3"
                  />
                </label>
              </div>
              <label className="block text-sm font-bold text-slate-700">
                Costo por {unidad}
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={costo}
                  onChange={(event) => setCosto(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Ejemplo: si compras 1 litro de aceite a Q25, usa ml y registra
                  1000 existencias con costo Q0.025 por ml.
                </span>
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Nota del ajuste
                <textarea
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  placeholder="Motivo, proveedor o referencia"
                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3"
                />
              </label>
              <button
                disabled={guardando}
                className="w-full rounded-xl bg-orange-500 p-3 font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {guardando
                  ? "Guardando…"
                  : seleccionado
                    ? "Guardar ajuste"
                    : "Crear ingrediente"}
              </button>
              {seleccionado && (
                <button
                  type="button"
                  onClick={limpiar}
                  className="w-full text-sm font-bold text-slate-500 underline"
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-6">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-500">
                    Inventario de cocina
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    Ingredientes registrados
                  </h2>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    Valor estimado
                  </p>
                  <p className="text-xl font-black text-emerald-800">
                    {dinero(valorInventario, 2)}
                  </p>
                </div>
              </div>
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar ingrediente"
                className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-orange-500"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4">Ingrediente</th>
                    <th className="p-4">Unidad</th>
                    <th className="p-4 text-right">Existencia</th>
                    <th className="p-4 text-right">Costo unitario</th>
                    <th className="p-4 text-right">Valor</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr>
                      <td className="p-8 text-slate-500" colSpan={6}>
                        Cargando ingredientes…
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((ingrediente) => (
                      <tr
                        key={ingrediente.id}
                        className="border-t border-slate-100"
                      >
                        <td className="p-4 font-bold text-slate-900">
                          {ingrediente.nombre}
                        </td>
                        <td className="p-4 text-slate-600">
                          {ingrediente.unidad_base}
                        </td>
                        <td className="p-4 text-right font-semibold">
                          {numero(ingrediente.stock_actual)}{" "}
                          {ingrediente.unidad_base}
                        </td>
                        <td className="p-4 text-right">
                          {dinero(ingrediente.costo_referencia)}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-700">
                          {dinero(
                            Number(ingrediente.stock_actual) *
                              Number(ingrediente.costo_referencia),
                            2,
                          )}
                        </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editar(ingrediente)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-orange-500 hover:text-orange-700"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void eliminar(ingrediente)}
                          className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                      </tr>
                    ))
                  )}
                  {!cargando && !filtrados.length && (
                    <tr>
                      <td
                        className="p-8 text-center text-slate-500"
                        colSpan={6}
                      >
                        No hay ingredientes con ese nombre.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-500">
              Trazabilidad
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Últimos movimientos
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Ingrediente</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4 text-right">Cambio</th>
                  <th className="p-4 text-right">Costo unitario</th>
                  <th className="p-4">Nota</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((movimiento) => (
                  <tr key={movimiento.id} className="border-t border-slate-100">
                    <td className="p-4 text-slate-600">
                      {new Date(movimiento.created_at).toLocaleString("es-GT", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="p-4 font-bold">
                      {movimiento.ingredientes?.nombre || "Ingrediente"}
                    </td>
                    <td className="p-4">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold capitalize">
                        {movimiento.tipo.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4 text-right font-semibold">
                      {Number(movimiento.cantidad) > 0 ? "+" : ""}
                      {numero(movimiento.cantidad)}{" "}
                      {movimiento.ingredientes?.unidad_base}
                    </td>
                    <td className="p-4 text-right">
                      {dinero(movimiento.costo_unitario)}
                    </td>
                    <td className="p-4 text-slate-600">
                      {movimiento.nota || "—"}
                    </td>
                  </tr>
                ))}
                {!movimientos.length && (
                  <tr>
                    <td className="p-8 text-center text-slate-500" colSpan={6}>
                      Aún no hay compras ni ajustes registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
