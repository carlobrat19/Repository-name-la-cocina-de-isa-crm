import { ReactNode } from "react";

export default function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="flex flex-col gap-5 border-b border-slate-200 bg-white px-6 py-7 md:flex-row md:items-end md:justify-between md:px-10"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-600">{eyebrow || "La Cocina de Isa"}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm text-slate-500 md:text-base">{description}</p></div>{actions && <div className="flex shrink-0 gap-3">{actions}</div>}</header>;
}
