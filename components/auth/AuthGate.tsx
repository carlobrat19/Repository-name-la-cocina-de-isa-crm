"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type RolCrm = "Administrador" | "Ventas" | "Producción" | "Reparto" | "Caja" | "Sin acceso";

type AuthContextValue = {
  email: string | null;
  rol: RolCrm | null;
  listo: boolean;
  puedeVer: (roles: RolCrm[]) => boolean;
  salir: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useCrmAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useCrmAuth debe usarse dentro de AuthGate");
  return context;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [rol, setRol] = useState<RolCrm | null>(null);
  const [listo, setListo] = useState(false);
  const esAcceso = pathname.startsWith("/acceso");

  useEffect(() => {
    let activo = true;
    async function verificarAcceso() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!activo) return;
      if (!session) {
        setEmail(null); setRol(null); setListo(true);
        if (!esAcceso) router.replace("/acceso");
        return;
      }
      const { data: perfil } = await supabase.from("perfiles_crm").select("rol, activo").eq("id", session.user.id).maybeSingle();
      if (!activo) return;
      const rolPerfil = perfil?.activo ? perfil.rol as RolCrm : "Sin acceso";
      setEmail(session.user.email ?? null); setRol(rolPerfil); setListo(true);
      if (!esAcceso && (!perfil || !perfil.activo || rolPerfil === "Sin acceso")) router.replace("/acceso?sin_acceso=1");
      if (esAcceso && perfil?.activo && rolPerfil !== "Sin acceso") router.replace("/dashboard");
    }
    void verificarAcceso();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void verificarAcceso(); });
    return () => { activo = false; listener.subscription.unsubscribe(); };
  }, [esAcceso, router]);

  const value = useMemo<AuthContextValue>(() => ({
    email, rol, listo,
    puedeVer: (roles) => rol === "Administrador" || (rol ? roles.includes(rol) : false),
    salir: async () => { await supabase.auth.signOut(); router.replace("/acceso"); },
  }), [email, rol, listo, router]);

  if (!esAcceso && !listo) return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm font-semibold text-slate-300">Cargando CRM…</div>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
