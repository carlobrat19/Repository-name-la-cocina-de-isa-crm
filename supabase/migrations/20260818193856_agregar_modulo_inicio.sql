-- Inicio is a private welcome page, separate from the operational summary.
alter table public.permisos_usuario_crm
  drop constraint if exists permisos_usuario_crm_modulo_check;

alter table public.permisos_usuario_crm
  add constraint permisos_usuario_crm_modulo_check check (modulo in (
    'inicio', 'dashboard', 'pedidos', 'clientes', 'conversaciones', 'productos',
    'recetas_costos', 'ingredientes', 'produccion', 'pendientes',
    'cobros_fel', 'flujo_caja', 'reportes', 'integraciones'
  ));

-- Existing staff who could see Resumen should keep a visible entry point.
insert into public.permisos_usuario_crm (user_id, modulo)
select user_id, 'inicio'
from public.permisos_usuario_crm
where modulo = 'dashboard'
on conflict (user_id, modulo) do nothing;

update public.invitaciones_crm
set modulos = array_append(modulos, 'inicio')
where 'dashboard' = any(modulos)
  and not ('inicio' = any(modulos));
