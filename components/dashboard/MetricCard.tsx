import { LucideIcon } from "lucide-react";

export default function MetricCard({ label, value, detail, icon: Icon, accent = "orange" }: { label: string; value: string | number; detail: string; icon: LucideIcon; accent?: "orange" | "blue" | "green" | "violet" }) {
  const colors = { orange: "bg-orange-50 text-orange-600", blue: "bg-blue-50 text-blue-600", green: "bg-emerald-50 text-emerald-600", violet: "bg-violet-50 text-violet-600" };
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p></div><span className={`grid size-10 place-items-center rounded-xl ${colors[accent]}`}><Icon size={20}/></span></div><p className="mt-4 text-xs font-medium text-slate-400">{detail}</p></article>;
}
