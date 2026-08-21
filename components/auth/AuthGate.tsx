"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type RolCrm = "Administrador" | "Socio / Propietario" | "Gerencia operativa" | "Ventas" | "Producción" | "Reparto" | "Caja" | "Contador" | "Sin acceso";
export type ModuloCrm = "inicio" | "dashboard" | "pedidos" | "clientes" | "conversaciones" | "productos" | "recetas_costos" | "ingredientes" | "produccion" | "pendientes" | "cobros_fel" | "flujo_caja" | "reportes" | "integraciones" | "punto_venta" | "sucursales";

type AuthContextValue = {
  id: string | null;
  email: string | null;
  rol: RolCrm | null;
  modulos: ModuloCrm[];
  listo: boolean;
  puedeVer: (modulo: ModuloCrm) => boolean;
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
  const [id, setId] = useState<string | null>(null);
  const [rol, setRol] = useState<RolCrm | null>(null);
  const [modulos, setModulos] = useState<ModuloCrm[]>([]);
  const [listo, setListo] = useState(false);
  const esLogin = pathname.startsWith("/acceso");
  const esAcceso = esLogin || pathname.startsWith("/restablecer-contrasena");

  useEffect(() => {
    let activo = true;
    async function verificarAcceso() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!activo) return;
      if (!session) {
        setId(null); setEmail(null); setRol(null); setModulos([]); setListo(true);
        if (!esAcceso) router.replace("/acceso");
        return;
      }
      const [{ data: perfil }, { data: permisos }] = await Promise.all([
        supabase.from("perfiles_crm").select("rol, activo, acceso_hasta").eq("id", session.user.id).maybeSingle(),
        supabase.from("permisos_usuario_crm").select("modulo").eq("user_id", session.user.id),
      ]);
      if (!activo) return;
      const vigente = !perfil?.acceso_hasta || new Date(perfil.acceso_hasta) > new Date();
      const rolPerfil = perfil?.activo && vigente ? perfil.rol as RolCrm : "Sin acceso";
      setId(session.user.id); setEmail(session.user.email ?? null); setRol(rolPerfil);
      setModulos((permisos ?? []).map((permiso) => permiso.modulo as ModuloCrm)); setListo(true);
      if (!esAcceso && (!perfil || !perfil.activo || rolPerfil === "Sin acceso")) router.replace("/acceso?sin_acceso=1");
      if (esLogin && perfil?.activo && rolPerfil !== "Sin acceso") router.replace("/");
    }
    void verificarAcceso();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void verificarAcceso(); });
    return () => { activo = false; listener.subscription.unsubscribe(); };
  }, [esAcceso, esLogin, router]);

  const value = useMemo<AuthContextValue>(() => ({
    id, email, rol, modulos, listo,
    puedeVer: (modulo) => rol === "Administrador" || modulos.includes(modulo),
    salir: async () => { await supabase.auth.signOut(); router.replace("/acceso"); },
  }), [id, email, rol, modulos, listo, router]);

  if (!esAcceso && !listo) return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm font-semibold text-slate-300">Cargando CRM…</div>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
