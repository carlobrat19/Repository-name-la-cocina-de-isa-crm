create policy "modulo conversaciones clientes lectura" on public.clientes for select to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')));

create policy "modulo conversaciones clientes alta" on public.clientes for insert to authenticated
  with check ((select private.tiene_modulo_crm('conversaciones')));

create policy "modulo conversaciones clientes actualiza" on public.clientes for update to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')))
  with check ((select private.tiene_modulo_crm('conversaciones')));

create policy "modulo conversaciones direcciones lectura" on public.cliente_direcciones for select to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')));

create policy "modulo conversaciones direcciones alta" on public.cliente_direcciones for insert to authenticated
  with check ((select private.tiene_modulo_crm('conversaciones')));

create policy "modulo conversaciones direcciones actualiza" on public.cliente_direcciones for update to authenticated
  using ((select private.tiene_modulo_crm('conversaciones')))
  with check ((select private.tiene_modulo_crm('conversaciones')));
