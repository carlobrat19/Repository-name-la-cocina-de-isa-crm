import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { pedidoId } = (await request.json()) as { pedidoId?: string };
  if (!pedidoId) return NextResponse.json({ error: "Pedido requerido" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const provider = process.env.FEL_PROVIDER;
  if (!admin) return NextResponse.json({ error: "Falta configurar Supabase de servidor" }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: usuario, error: usuarioError } = token ? await admin.auth.getUser(token) : { data: { user: null }, error: new Error("Sesión requerida") };
  if (usuarioError || !usuario.user) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });

  const [{ data: pedido, error: pedidoError }, { data: existente }] = await Promise.all([
    admin.from("pedidos").select("id, cliente_id, total, pago_estado, estado").eq("id", pedidoId).single(),
    admin.from("facturas").select("id, estado, serie, numero, uuid_fel").eq("pedido_id", pedidoId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (pedidoError || !pedido?.cliente_id || Number(pedido.total || 0) <= 0) return NextResponse.json({ error: "El pedido no tiene los datos necesarios para facturar" }, { status: 400 });
  if (pedido.pago_estado !== "Pagado") return NextResponse.json({ error: "El pedido debe estar marcado como Pagado antes de emitir FEL" }, { status: 400 });
  if (pedido.estado === "Cancelado") return NextResponse.json({ error: "No se puede emitir FEL de un pedido cancelado" }, { status: 400 });
  const { data: cliente } = await admin.from("clientes").select("nit, razon_social, direccion").eq("id", pedido.cliente_id).single();
  if (!cliente?.nit || !cliente?.razon_social || !cliente?.direccion) return NextResponse.json({ error: "Faltan NIT, razón social o dirección fiscal del cliente" }, { status: 400 });
  if (existente) return NextResponse.json({ factura: existente, pendienteConfiguracion: !provider || !process.env.FEL_API_URL || !process.env.FEL_API_KEY, yaExiste: true });

  const { data: factura, error } = await admin.from("facturas").insert({ pedido_id: pedidoId, cliente_id: pedido.cliente_id, total: Number(pedido.total), proveedor_fel: provider || "Sin configurar", estado: "Pendiente de emitir" }).select("id, estado").single();
  if (error) return NextResponse.json({ error: "No fue posible crear el registro de factura" }, { status: 500 });

  // The certified DTE is sent only after the provider credentials and adapter are configured.
  return NextResponse.json({ factura, pendienteConfiguracion: true }, { status: 202 });
}
