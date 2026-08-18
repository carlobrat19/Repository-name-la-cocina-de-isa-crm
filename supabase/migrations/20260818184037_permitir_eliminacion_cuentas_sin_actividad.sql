alter table public.auditoria_usuarios_crm
  alter column actor_id drop not null,
  drop constraint if exists auditoria_usuarios_crm_actor_id_fkey,
  drop constraint if exists auditoria_usuarios_crm_usuario_id_fkey;

alter table public.auditoria_usuarios_crm
  add constraint auditoria_usuarios_crm_actor_id_fkey foreign key (actor_id) references auth.users(id) on delete set null,
  add constraint auditoria_usuarios_crm_usuario_id_fkey foreign key (usuario_id) references auth.users(id) on delete set null;
