import type { Metadata } from "next";

import "./globals.css";
import AuthGate from "@/components/auth/AuthGate";
import AppShell from "@/components/auth/AppShell";

export const metadata: Metadata = {
  title: "La Cocina de Isa | CRM",
  description: "Sistema CRM gastronómico para ventas y operación",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><AuthGate><AppShell>{children}</AppShell></AuthGate></body></html>;
}
