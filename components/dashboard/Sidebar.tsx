"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, ClipboardList, Factory, LayoutDashboard, Menu, MessageCircle, Package, PanelLeftClose, PanelLeftOpen, ReceiptText, ShoppingBag, UsersRound, WalletCards, X } from "lucide-react";
import { useState } from "react";

const menu = [
  { label: "Resumen", href: "/dashboard", icon: LayoutDashboard }, { label: "Pedidos", href: "/pedidos/lista", icon: ShoppingBag }, { label: "Clientes", href: "/clientes", icon: UsersRound }, { label: "Conversaciones", href: "/conversaciones", icon: MessageCircle }, { label: "Productos", href: "/productos", icon: Package }, { label: "Producción", href: "/produccion", icon: Factory }, { label: "Pendientes", href: "/productos-pendientes", icon: ClipboardList }, { label: "Cobros y FEL", href: "/finanzas", icon: WalletCards }, { label: "Flujo de caja", href: "/flujo-caja", icon: ReceiptText }, { label: "Reportes", href: "/reportes", icon: BarChart3 }, { label: "Integraciones", href: "/integraciones", icon: Boxes },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  return <>
    <button aria-label="Abrir menú" onClick={() => setOpen(true)} className="fixed left-4 top-4 z-30 grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"><Menu size={20}/></button>
    {open && <button aria-label="Cerrar menú" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setOpen(false)}/>}
    <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-800 bg-slate-950 px-3 py-5 text-slate-300 transition-all duration-200 ${compact ? "w-[82px]" : "w-[264px]"} ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
      <div className={`mb-8 flex items-center ${compact ? "justify-center" : "justify-between px-2"}`}><Link href="/dashboard" className="flex items-center gap-3 overflow-hidden text-white" onClick={() => setOpen(false)}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-500 font-black text-white">I</span>{!compact && <span className="whitespace-nowrap"><b className="block text-base">La Cocina de Isa</b><small className="text-xs text-slate-500">CRM gastronómico</small></span>}</Link>{!compact && <button aria-label="Contraer menú" onClick={() => setCompact(true)} className="hidden rounded-lg p-2 hover:bg-white/10 lg:block"><PanelLeftClose size={18}/></button>}</div>
      <nav className="flex-1 space-y-1 overflow-y-auto">{!compact && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-600">Operación</p>}{menu.map(({ label, href, icon: Icon }) => { const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)); return <Link key={href} href={href} title={compact ? label : undefined} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "bg-orange-500 text-white shadow-lg shadow-orange-950/30" : "hover:bg-white/8 hover:text-white"}`}><Icon size={19} className="shrink-0"/>{!compact && <span className="whitespace-nowrap">{label}</span>}</Link>; })}</nav>
      <div className={`mt-4 border-t border-slate-800 pt-4 ${compact ? "text-center" : "px-2"}`}>{!compact && <p className="text-xs text-slate-500">Panel de operación</p>}<button onClick={() => setCompact(!compact)} className="mt-2 hidden rounded-lg p-2 hover:bg-white/10 lg:inline-flex" aria-label="Cambiar tamaño del menú">{compact ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button><button onClick={() => setOpen(false)} className="mt-2 inline-flex rounded-lg p-2 hover:bg-white/10 lg:hidden" aria-label="Cerrar menú"><X size={18}/></button></div>
    </aside>
  </>;
}
