"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, ClipboardList, Factory, Package, ReceiptText, ShoppingBag, UsersRound, WalletCards } from "lucide-react";
import { ModuloCrm, useCrmAuth } from "@/components/auth/AuthGate";

type Access = { label: string; description: string; href: string; module: ModuloCrm; icon: typeof ShoppingBag; accent: string };

const accesses: Access[] = [
  { label: "Tomar pedido", description: "Registra una venta y coordina la entrega.", href: "/pedidos", module: "pedidos", icon: ShoppingBag, accent: "bg-orange-500" },
  { label: "Clientes", description: "Consulta y actualiza sus datos.", href: "/clientes", module: "clientes", icon: UsersRound, accent: "bg-blue-600" },
  { label: "Producción", description: "Organiza el trabajo de cocina.", href: "/produccion", module: "produccion", icon: Factory, accent: "bg-violet-600" },
  { label: "Pendientes", description: "Revisa qué productos preparar.", href: "/productos-pendientes", module: "pendientes", icon: ClipboardList, accent: "bg-amber-500" },
  { label: "Cobros y FEL", description: "Registra pagos y facturación.", href: "/finanzas", module: "cobros_fel", icon: WalletCards, accent: "bg-emerald-600" },
  { label: "Flujo de caja", description: "Registra ingresos y gastos.", href: "/flujo-caja", module: "flujo_caja", icon: ReceiptText, accent: "bg-slate-800" },
  { label: "Productos", description: "Gestiona catálogo y precios.", href: "/productos", module: "productos", icon: Package, accent: "bg-rose-600" },
  { label: "Reportes", description: "Analiza la información del negocio.", href: "/reportes", module: "reportes", icon: BarChart3, accent: "bg-cyan-700" },
];

export default function WelcomeHome() {
  const { puedeVer } = useCrmAuth();
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Buenos días" : now.getHours() < 19 ? "Buenas tardes" : "Buenas noches";
  const date = new Intl.DateTimeFormat("es-GT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const visibleAccesses = accesses.filter((access) => puedeVer(access.module));

  return <main className="min-h-screen bg-slate-50 px-5 py-8 sm:px-8 lg:px-12 lg:py-11"><div className="mx-auto max-w-6xl"><section className="overflow-hidden rounded-[2rem] bg-slate-950 px-7 py-9 text-white shadow-xl shadow-slate-950/10 sm:px-10 sm:py-12"><p className="text-xs font-bold uppercase tracking-[.24em] text-orange-400">La Cocina de Isa</p><h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{greeting}</h1><p className="mt-3 capitalize text-sm font-medium text-slate-300">{date}</p><div className="mt-9 max-w-2xl border-l-2 border-orange-400 pl-5"><p className="text-xl font-bold leading-relaxed sm:text-2xl">“Cada pedido lleva el sabor y el cariño de nuestra cocina.”</p><p className="mt-3 text-sm leading-6 text-slate-400">Selecciona un área para continuar con la operación del día.</p></div></section><section className="mt-8"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Accesos rápidos</p><h2 className="mt-1 text-2xl font-black text-slate-950">¿Qué quieres hacer?</h2></div><p className="hidden text-sm text-slate-500 sm:block">Solo ves las áreas autorizadas para tu cuenta.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{visibleAccesses.map((access) => { const Icon = access.icon; return <Link key={access.href} href={access.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"><span className={`grid size-11 place-items-center rounded-xl ${access.accent} text-white`}><Icon size={21}/></span><h3 className="mt-5 font-black text-slate-950">{access.label}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">{access.description}</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-orange-600">Abrir <ArrowRight size={15} className="transition group-hover:translate-x-1"/></span></Link>; })}</div>{!visibleAccesses.length && <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Tu cuenta todavía no tiene módulos asignados. Solicita acceso al administrador.</p>}</section></div></main>;
}
