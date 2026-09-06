-- La función pública es solamente un puente; la lógica interna valida sesión
-- y acceso al módulo de pedidos antes de registrar cualquier dato.
grant execute on function private.registrar_pedido_completo(jsonb) to authenticated;
