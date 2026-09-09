-- Planeación puede crear y editar el programa (production_programs,
-- production_orders, envasado_orders), pero no borrar -- eso queda
-- exclusivo del jefe de planta. Las políticas "for all" existentes se
-- dividen en insert/update (jefe_planta o planeacion) y delete
-- (solo jefe_planta), ya que una sola política no puede tener distintos
-- roles por operación.

drop policy "programs_write_jefe" on production_programs;
create policy "programs_insert" on production_programs
  for insert to authenticated
  with check (current_role_is('jefe_planta') or current_role_is('planeacion'));
create policy "programs_update" on production_programs
  for update to authenticated
  using (current_role_is('jefe_planta') or current_role_is('planeacion'))
  with check (current_role_is('jefe_planta') or current_role_is('planeacion'));
create policy "programs_delete" on production_programs
  for delete to authenticated
  using (current_role_is('jefe_planta'));

drop policy "orders_write_jefe" on production_orders;
create policy "orders_insert" on production_orders
  for insert to authenticated
  with check (current_role_is('jefe_planta') or current_role_is('planeacion'));
create policy "orders_update" on production_orders
  for update to authenticated
  using (current_role_is('jefe_planta') or current_role_is('planeacion'))
  with check (current_role_is('jefe_planta') or current_role_is('planeacion'));
create policy "orders_delete" on production_orders
  for delete to authenticated
  using (current_role_is('jefe_planta'));

drop policy "envasado_orders_write_jefe" on envasado_orders;
create policy "envasado_orders_insert" on envasado_orders
  for insert to authenticated
  with check (current_role_is('jefe_planta') or current_role_is('planeacion'));
create policy "envasado_orders_update" on envasado_orders
  for update to authenticated
  using (current_role_is('jefe_planta') or current_role_is('planeacion'))
  with check (current_role_is('jefe_planta') or current_role_is('planeacion'));
create policy "envasado_orders_delete" on envasado_orders
  for delete to authenticated
  using (current_role_is('jefe_planta'));
