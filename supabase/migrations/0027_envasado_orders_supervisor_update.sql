-- El estado de envasado_orders se actualiza solo (pendiente -> en_proceso
-- al iniciar el envasado, -> completado al finalizarlo), pero esas
-- escrituras las hace un supervisor en el dia a dia (startEnvasado y
-- finalizarEnvasado se pueden ejecutar como jefe_planta o supervisor). La
-- politica de update nunca incluyo a supervisor, asi que esas escrituras
-- quedaban bloqueadas en silencio por RLS y la orden se quedaba en
-- "pendiente" para siempre. Insert/delete siguen sin supervisor (eso se
-- hace desde Programa, que ya filtra por rol en la app).
drop policy "envasado_orders_update" on envasado_orders;
create policy "envasado_orders_update" on envasado_orders
  for update to authenticated
  using (
    current_role_is('jefe_planta')
    or current_role_is('planeacion')
    or current_role_is('supervisor')
  )
  with check (
    current_role_is('jefe_planta')
    or current_role_is('planeacion')
    or current_role_is('supervisor')
  );
