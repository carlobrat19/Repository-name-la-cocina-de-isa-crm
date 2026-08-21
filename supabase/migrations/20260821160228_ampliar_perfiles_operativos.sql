-- Perfiles descriptivos para el equipo. Los permisos efectivos siguen siendo
-- individuales por módulo; únicamente Administrador puede gestionar usuarios.
alter table public.perfiles_crm
  drop constraint if exists perfiles_crm_rol_check,
  add constraint perfiles_crm_rol_check check (rol in (
    'Administrador', 'Socio / Propietario', 'Gerencia operativa', 'Ventas',
    'Producción', 'Reparto', 'Caja', 'Contador', 'Sin acceso'
  ));

alter table public.invitaciones_crm
  drop constraint if exists invitaciones_crm_rol_check,
  add constraint invitaciones_crm_rol_check check (rol in (
    'Administrador', 'Socio / Propietario', 'Gerencia operativa', 'Ventas',
    'Producción', 'Reparto', 'Caja', 'Contador', 'Sin acceso'
  ));
