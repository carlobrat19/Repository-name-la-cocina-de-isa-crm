"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/acceso")) return <>{children}</>;
  return <div className="flex"><Sidebar/><main className="min-h-screen w-full pt-16 lg:ml-[264px] lg:pt-0">{children}</main></div>;
}
