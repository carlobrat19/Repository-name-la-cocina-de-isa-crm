import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { leerPdfFel } from "@/lib/leer-pdf-fel";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "No está disponible la lectura de PDF." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: usuario, error: authError } = token ? await admin.auth.getUser(token) : { data: { user: null }, error: new Error("Sesión requerida") };
  if (authError || !usuario.user) return NextResponse.json({ error: "Inicia sesión para leer la factura." }, { status: 401 });
  const [{ data: perfil }, { data: permiso }] = await Promise.all([
    admin.from("perfiles_crm").select("rol,activo,acceso_hasta").eq("id", usuario.user.id).maybeSingle(),
    admin.from("permisos_usuario_crm").select("modulo").eq("user_id", usuario.user.id).eq("modulo", "flujo_caja").maybeSingle(),
  ]);
  const vigente = perfil?.activo && (!perfil.acceso_hasta || new Date(perfil.acceso_hasta) > new Date());
  if (!vigente || (perfil?.rol !== "Administrador" && !permiso)) return NextResponse.json({ error: "No tienes permiso para leer facturas de compra." }, { status: 403 });

  const archivo = (await request.formData()).get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0 || archivo.size > 4 * 1024 * 1024 || !archivo.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Selecciona un PDF válido de máximo 4 MB." }, { status: 400 });
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return NextResponse.json({ error: "El archivo no es un PDF válido." }, { status: 400 });
  try {
    return NextResponse.json({ factura: await leerPdfFel(bytes) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer el PDF." }, { status: 422 });
  }
}
