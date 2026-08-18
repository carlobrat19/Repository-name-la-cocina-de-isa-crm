import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel para eliminar cuentas." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const { data: { user: actor } } = await admin.auth.getUser(token);
  if (!actor || actor.email?.toLowerCase() !== "carlobrat@gmail.com") return NextResponse.json({ error: "Solo el administrador principal puede eliminar cuentas." }, { status: 403 });
  const { id } = await context.params;
  if (id === actor.id) return NextResponse.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 400 });
  const { data: objetivo } = await admin.from("perfiles_crm").select("id,email,nombre").eq("id", id).maybeSingle();
  if (!objetivo || objetivo.email.toLowerCase() === "carlobrat@gmail.com") return NextResponse.json({ error: "Cuenta no disponible para eliminar." }, { status: 404 });
  const revisiones = await Promise.all([
    admin.from("pedidos").select("id", { count: "exact", head: true }).eq("creado_por", id),
    admin.from("movimientos_caja").select("id", { count: "exact", head: true }).eq("creado_por", id),
    admin.from("compras_ingredientes").select("id", { count: "exact", head: true }).eq("creado_por", id),
    admin.from("historial_estados_pedido").select("id", { count: "exact", head: true }).eq("creado_por", id),
  ]);
  if (revisiones.some((revision) => revision.error)) return NextResponse.json({ error: "No se pudo validar la actividad de la cuenta." }, { status: 500 });
  if (revisiones.some((revision) => Number(revision.count || 0) > 0)) return NextResponse.json({ error: "Esta cuenta tiene actividad registrada. Desactívala para conservar la trazabilidad." }, { status: 409 });
  const { error: auditoriaError } = await admin.from("auditoria_usuarios_crm").insert({ actor_id: actor.id, usuario_id: id, accion: "Eliminó una cuenta sin actividad", detalle: { email: objetivo.email, nombre: objetivo.nombre || "" } });
  if (auditoriaError) return NextResponse.json({ error: "No se pudo registrar la bitácora de eliminación." }, { status: 500 });
  const { error: eliminarError } = await admin.auth.admin.deleteUser(id);
  if (eliminarError) return NextResponse.json({ error: eliminarError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
