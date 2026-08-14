import type { Metadata } from "next";

import "./globals.css";
import Sidebar from "@/components/dashboard/Sidebar";

export const metadata: Metadata = {
  title: "La Cocina de Isa | CRM",
  description: "Sistema CRM gastronómico para ventas y operación",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><div className="flex"><Sidebar/><main className="min-h-screen w-full pt-16 lg:ml-[264px] lg:pt-0">{children}</main></div></body></html>;
}
