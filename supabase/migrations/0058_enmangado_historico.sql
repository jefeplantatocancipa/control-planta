-- Enmangado histórico, tomado de Base_Control_de_Enmangado_2026.xlsm (hoja
-- Consolidado) -- el módulo de Enmangado en vivo registra por operario
-- (vasos_enmangados), pero esa planilla llevaba el detalle por turno
-- (personal, paradas, responsable) desde antes y sigue siendo la fuente
-- real de "cuánto se enmangó" mes a mes. Se carga el resumen mensual ya
-- consolidado (no el detalle por turno/lote) -- es lo que hace falta para
-- el histórico de Estadísticas, no un desglose turno por turno.
create table enmangado_historico_mensual (
  id uuid primary key default gen_random_uuid(),
  mes date not null unique,
  registros integer not null default 0,
  unidades_producidas integer not null default 0,
  paradas_min integer not null default 0,
  created_at timestamptz not null default now()
);

alter table enmangado_historico_mensual enable row level security;
create policy "enmangado_historico_mensual_select" on enmangado_historico_mensual
  for select to authenticated
  using (is_staff() or current_role_is('asistente_adm') or current_role_is('planeacion'));
create policy "enmangado_historico_mensual_insert" on enmangado_historico_mensual
  for insert to authenticated with check (current_role_is('jefe_planta'));
create policy "enmangado_historico_mensual_update" on enmangado_historico_mensual
  for update to authenticated using (current_role_is('jefe_planta'));
create policy "enmangado_historico_mensual_delete" on enmangado_historico_mensual
  for delete to authenticated using (current_role_is('jefe_planta'));

insert into enmangado_historico_mensual (mes, registros, unidades_producidas, paradas_min)
values
  ('2026-08-01', 84, 273564, 2635),
  ('2026-09-01', 117, 255246, 2155),
  ('2026-10-01', 156, 397380, 2935),
  ('2026-11-01', 46, 118850, 870)
on conflict (mes) do nothing;
