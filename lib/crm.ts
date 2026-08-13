export const ESTADOS_PEDIDO = ["Pendiente", "Producción", "Empaquetado", "En Ruta", "Entregado"] as const;
export const CANALES = ["Manual", "WhatsApp", "Instagram", "Facebook", "Web"] as const;

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  nit: string | null;
  razon_social: string | null;
  canal_origen: string;
  saldo: number;
  notas: string | null;
  created_at: string;
};

export type Conversacion = {
  id: string;
  canal: "WhatsApp" | "Instagram" | "Facebook" | "Web";
  ultimo_mensaje: string | null;
  ultimo_mensaje_at: string | null;
  estado: string;
  clientes: Pick<Cliente, "nombre" | "telefono"> | null;
};

export const moneda = (valor: number | string | null | undefined) =>
  new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(Number(valor || 0));
