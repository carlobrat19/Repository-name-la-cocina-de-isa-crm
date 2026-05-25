import type { Metadata } from "next";

import "./globals.css";

import Sidebar from "@/components/dashboard/Sidebar";

export const metadata: Metadata = {

  title: "La Cocina de Isa ERP",

  description:
    "Sistema ERP Gastronómico",

};

export default function RootLayout({

  children,

}: Readonly<{

  children: React.ReactNode;

}>) {

  return (

    <html lang="es">

      <body
        className="
          bg-gray-100
        "
      >

        <div
          className="
            flex
          "
        >

          {/* SIDEBAR */}

          <Sidebar />

          {/* CONTENIDO */}

          <main
            className="
              ml-[280px]
              w-full
              min-h-screen
            "
          >

            {children}

          </main>

        </div>

      </body>

    </html>
  );
}
