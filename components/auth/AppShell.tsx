"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  if (pathname.startsWith("/acceso")) return <>{children}</>;
  return <div className="flex"><Sidebar compact={compact} onCompactChange={setCompact}/><main className={`min-h-screen min-w-0 w-full pt-16 lg:pt-0 ${compact ? "lg:ml-[82px]" : "lg:ml-[264px]"}`}>{children}</main></div>;
}
