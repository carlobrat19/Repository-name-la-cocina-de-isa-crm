-- El cliente Supabase llama RPC con un objeto de parámetros. Por eso los
-- argumentos públicos deben conservar sus nombres, no solo sus tipos.
drop function if exists public.registrar_abono_pedido(uuid, numeric, text, text);

create function public.registrar_abono_pedido(
  p_pedido_id uuid,
  p_monto numeric,
  p_metodo text,
  p_referencia text default null
)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.registrar_abono_pedido(
    p_pedido_id,
    p_monto,
    p_metodo,
    p_referencia
  );
$$;

-- La función pública es el único punto de entrada para la aplicación.
-- La función privada mantiene las validaciones de sesión y permisos.
revoke all on function public.registrar_abono_pedido(uuid, numeric, text, text) from public, anon;
revoke all on function private.registrar_abono_pedido(uuid, numeric, text, text) from public, anon;
grant execute on function public.registrar_abono_pedido(uuid, numeric, text, text) to authenticated;
grant execute on function private.registrar_abono_pedido(uuid, numeric, text, text) to authenticated;
