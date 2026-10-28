-- Correcciones del asesor de seguridad de Supabase.
--
-- 1) Las vistas se creaban con los permisos de su dueño, así que se saltaban
--    el RLS: cualquier usuario con sesión veía todas las filas aunque su rol
--    no tuviera acceso a las tablas de origen (p. ej. un operario vería las
--    estadísticas de todos los operarios). Con security_invoker la vista
--    aplica el RLS de quien consulta.
alter view v_proceso_actual        set (security_invoker = true);
alter view v_cumplimiento_programa set (security_invoker = true);
alter view v_estadisticas_operario set (security_invoker = true);
alter view v_inventario_catalogo   set (security_invoker = true);
alter view v_inventario_stock      set (security_invoker = true);

-- 2) Funciones SECURITY DEFINER expuestas por /rest/v1/rpc a visitantes sin
--    sesión (anon). Todas las políticas son "to authenticated", así que anon
--    no las necesita. current_role_is() e is_staff() se quedan para
--    authenticated porque las políticas de RLS las llaman con el rol de
--    quien consulta. handle_new_user() solo la usa el trigger de auth.users,
--    que no necesita el permiso EXECUTE de nadie.
revoke execute on function current_role_is(user_role) from public, anon;
revoke execute on function is_staff()                  from public, anon;
revoke execute on function handle_new_user()           from public, anon, authenticated;
grant  execute on function current_role_is(user_role) to authenticated, service_role;
grant  execute on function is_staff()                  to authenticated, service_role;
grant  execute on function handle_new_user()           to service_role;

-- 3) Planeación puede VER (no modificar) baches, etapas y envasados, para
--    las pantallas Proceso, Cumplimiento y Estadísticas. Antes veía Proceso
--    solo gracias al hueco de las vistas del punto 1.
alter policy baches_select on baches using (
  is_staff() or current_role_is('calidad') or current_role_is('asistente_adm')
  or current_role_is('planeacion') or created_by = auth.uid()
);
alter policy stage_records_select on bache_stage_records using (
  is_staff() or current_role_is('calidad') or current_role_is('asistente_adm')
  or current_role_is('planeacion') or operario_id = auth.uid()
);
alter policy envasados_select on envasados using (
  is_staff() or current_role_is('calidad') or current_role_is('asistente_adm')
  or current_role_is('planeacion') or operario_id = auth.uid()
);
alter policy envasado_cortes_select on envasado_cortes using (
  is_staff() or current_role_is('calidad') or current_role_is('asistente_adm')
  or current_role_is('planeacion')
);
alter policy envasado_estibas_select on envasado_estibas using (
  is_staff() or current_role_is('calidad') or current_role_is('asistente_adm')
  or current_role_is('planeacion')
);
alter policy envasado_paradas_select on envasado_paradas using (
  is_staff() or current_role_is('calidad') or current_role_is('asistente_adm')
  or current_role_is('planeacion')
);
alter policy vasos_enmangados_select on vasos_enmangados using (
  is_staff() or current_role_is('asistente_adm')
  or current_role_is('planeacion') or operario_id = auth.uid()
);
