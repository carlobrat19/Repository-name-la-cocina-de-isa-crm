-- Expone solamente las cuentas activas que pueden usarse al registrar compras.
-- El permiso se comprueba en el esquema privado.
create or replace function private.cuentas_para_compras_ingredientes()
returns table (id uuid, nombre text, tipo text)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if (select auth.uid()) is null
    or not private.tiene_modulo_crm('productos') then
    raise exception 'No autorizado para consultar cuentas de compra';
  end if;

  return query
  select cuenta.id, cuenta.nombre, cuenta.tipo
  from public.cuentas_financieras as cuenta
  where cuenta.activa = true
    and cuenta.sucursal_id is null
  order by
    case cuenta.tipo
      when 'Caja' then 1
      when 'Banco' then 2
      when 'POS' then 3
      when 'Tarjeta de crédito' then 4
      else 5
    end,
    cuenta.nombre;
end;
$$;

create or replace function public.cuentas_para_compras_ingredientes()
returns table (id uuid, nombre text, tipo text)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.cuentas_para_compras_ingredientes();
$$;

revoke all on function private.cuentas_para_compras_ingredientes() from public, anon;
revoke all on function public.cuentas_para_compras_ingredientes() from public, anon;
grant execute on function private.cuentas_para_compras_ingredientes() to authenticated;
grant execute on function public.cuentas_para_compras_ingredientes() to authenticated;
