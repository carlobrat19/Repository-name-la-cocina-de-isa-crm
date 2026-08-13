import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { pedidoId, clienteId, total } = (await request.json()) as {
    pedidoId?: string;
    clienteId?: string;
    total?: number;
  };

  const totalFactura = Number(total);
  if (!pedidoId || !clienteId || !Number.isFinite(totalFactura) || totalFactura <= 0) {
    return NextResponse.json({ error: "Pedido, cliente y total válido son requeridos" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const provider = process.env.FEL_PROVIDER;
  if (!admin) return NextResponse.json({ error: "Falta configurar Supabase de servidor" }, { status: 503 });

  const { data: factura, error } = await admin
    .from("facturas")
    .insert({ pedido_id: pedidoId, cliente_id: clienteId, total: totalFactura, proveedor_fel: provider || "Sin configurar" })
    .select("id, estado")
    .single();

  if (error) return NextResponse.json({ error: "No fue posible crear el registro de factura" }, { status: 500 });
  if (!provider || !process.env.FEL_API_URL || !process.env.FEL_API_KEY) {
    return NextResponse.json({ factura, pendienteConfiguracion: true }, { status: 202 });
  }

  // El adaptador se implementa según el certificador FEL que elija el negocio.
  // Nunca se emite un documento fiscal con un contrato API asumido.
  return NextResponse.json({ factura, pendienteConfiguracion: true }, { status: 202 });
}
