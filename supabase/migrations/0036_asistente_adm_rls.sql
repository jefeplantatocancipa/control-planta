-- Asistente Adm es un observador: puede leer todo (para ver e imprimir
-- informes en cualquier módulo), pero nunca puede escribir -- por eso solo
-- se toca la parte "_select" de cada política, nunca la de escritura. Los
-- catálogos que ya eran de lectura abierta a cualquier autenticado
-- (products, process_stage_templates, envasado_referencias, etc.) no
-- necesitan cambios acá.

drop policy "baches_select" on baches;
create policy "baches_select" on baches
  for select to authenticated
  using (is_staff() or current_role_is('calidad') or current_role_is('asistente_adm') or created_by = auth.uid());

drop policy "stage_records_select" on bache_stage_records;
create policy "stage_records_select" on bache_stage_records
  for select to authenticated
  using (is_staff() or current_role_is('calidad') or current_role_is('asistente_adm') or operario_id = auth.uid());

drop policy "envasados_select" on envasados;
create policy "envasados_select" on envasados
  for select to authenticated
  using (is_staff() or current_role_is('calidad') or current_role_is('asistente_adm') or operario_id = auth.uid());

drop policy "vasos_enmangados_select" on vasos_enmangados;
create policy "vasos_enmangados_select" on vasos_enmangados
  for select to authenticated
  using (is_staff() or current_role_is('asistente_adm') or operario_id = auth.uid());

drop policy "envasado_insumos_uso_select" on envasado_insumos_uso;
create policy "envasado_insumos_uso_select" on envasado_insumos_uso
  for select to authenticated using (is_staff() or current_role_is('calidad') or current_role_is('asistente_adm'));

drop policy "envasado_cortes_select" on envasado_cortes;
create policy "envasado_cortes_select" on envasado_cortes
  for select to authenticated using (is_staff() or current_role_is('calidad') or current_role_is('asistente_adm'));

drop policy "envasado_calidad_lecturas_select" on envasado_calidad_lecturas;
create policy "envasado_calidad_lecturas_select" on envasado_calidad_lecturas
  for select to authenticated using (is_staff() or current_role_is('calidad') or current_role_is('asistente_adm'));

drop policy "envasado_estibas_select" on envasado_estibas;
create policy "envasado_estibas_select" on envasado_estibas
  for select to authenticated using (is_staff() or current_role_is('calidad') or current_role_is('asistente_adm'));

drop policy "envasado_paradas_select" on envasado_paradas;
create policy "envasado_paradas_select" on envasado_paradas
  for select to authenticated using (is_staff() or current_role_is('calidad') or current_role_is('asistente_adm'));

drop policy "encajados_select" on encajados;
create policy "encajados_select" on encajados
  for select to authenticated using (is_staff() or current_role_is('asistente_adm'));

drop policy "encajado_estibas_select" on encajado_estibas;
create policy "encajado_estibas_select" on encajado_estibas
  for select to authenticated using (is_staff() or current_role_is('asistente_adm'));

drop policy "bache_stage_firmas_select" on bache_stage_firmas;
create policy "bache_stage_firmas_select" on bache_stage_firmas
  for select to authenticated using (is_staff() or current_role_is('calidad') or current_role_is('asistente_adm'));

drop policy "envasado_corte_firmas_select" on envasado_corte_firmas;
create policy "envasado_corte_firmas_select" on envasado_corte_firmas
  for select to authenticated using (is_staff() or current_role_is('calidad') or current_role_is('asistente_adm'));
