-- Inventario final de producto terminado SIN EMPACAR (yogurt ya producido
-- que todavía no pasó por envasado), por mes -- lo que usa Estadísticas
-- para la merma exacta (inventario inicial + producido - final -
-- empacado). Es un conteo físico que reporta planta al cierre de cada
-- mes, no algo que el sistema pueda calcular solo -- antes vivía
-- hardcodeado en el código de Estadísticas; ahora el jefe de planta lo
-- carga él mismo desde Inventario apenas lo tiene, sin pedírselo a cada
-- rato por este chat.
--
-- No es el mismo inventario que vasos_blancos/insumos/etc. (eso es
-- materia prima y empaque, con su propio libro de movimientos) -- esto es
-- "cuánto yogurt hay hecho pero todavía no empacado", un solo número por
-- mes.
create table inventario_producto_terminado_mensual (
  id uuid primary key default gen_random_uuid(),
  mes date not null unique,
  kilos numeric(12, 2) not null,
  notas text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inventario_producto_terminado_mensual enable row level security;
create policy "inventario_ptm_select" on inventario_producto_terminado_mensual
  for select to authenticated
  using (is_staff() or current_role_is('asistente_adm') or current_role_is('planeacion'));
create policy "inventario_ptm_insert" on inventario_producto_terminado_mensual
  for insert to authenticated with check (is_staff());
create policy "inventario_ptm_update" on inventario_producto_terminado_mensual
  for update to authenticated using (is_staff());
create policy "inventario_ptm_delete" on inventario_producto_terminado_mensual
  for delete to authenticated using (current_role_is('jefe_planta'));

-- Los 4 valores que ya se habían acordado a mano, para no perderlos.
insert into inventario_producto_terminado_mensual (mes, kilos, notas)
values
  ('2026-07-01', 3000, 'Inventario final de cierre de mes, reportado por planta.'),
  ('2026-08-01', 9000, 'Inventario final de cierre de mes, reportado por planta.'),
  ('2026-09-01', 9000, 'Inventario final de cierre de mes, reportado por planta.')
on conflict (mes) do nothing;
