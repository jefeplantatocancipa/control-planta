-- Consumo mensual de energía eléctrica, tomado de la factura compartida del
-- edificio (varias bodegas en un solo medidor, repartido entre inquilinos).
-- A diferencia de consumos_servicios (lectura diaria de un medidor propio),
-- acá el dato ya viene consolidado por mes desde la factura -- por eso es
-- una tabla aparte, mes a mes, no diaria.
--
-- kwh_bodega es el consumo YA REPARTIDO que le corresponde a esta bodega
-- (Bodega 4 fasalact) -- es el que se usa en Estadísticas, no kwh_factura
-- (que es el total del edificio entero).
create table consumos_energia (
  id uuid primary key default gen_random_uuid(),
  mes date not null unique,
  kwh_factura numeric(14, 2),
  valor_a_repartir numeric(14, 2),
  costo_kwh_sin_recargo numeric(14, 2),
  mora_cobros_unicos numeric(14, 2),
  kwh_bodega numeric(14, 2),
  observaciones text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table consumos_energia enable row level security;
create policy "consumos_energia_select" on consumos_energia
  for select to authenticated
  using (is_staff() or current_role_is('asistente_adm') or current_role_is('planeacion'));
create policy "consumos_energia_insert" on consumos_energia
  for insert to authenticated with check (is_staff());
create policy "consumos_energia_update" on consumos_energia
  for update to authenticated using (is_staff());
create policy "consumos_energia_delete" on consumos_energia
  for delete to authenticated using (current_role_is('jefe_planta'));

create index idx_consumos_energia_mes on consumos_energia(mes);

insert into consumos_energia
  (mes, kwh_factura, valor_a_repartir, costo_kwh_sin_recargo, mora_cobros_unicos, kwh_bodega)
values
  ('2026-05-01', 3874, 3678737, 950, 952000, 3344),
  ('2026-06-01', 13493, 13107604, 971, 28348, 11027),
  ('2026-07-01', 17180, 17849138, 1039, 70683, 14632),
  ('2026-08-01', 20039, 20242908, 1010, 11723, 17491),
  ('2026-09-01', 19807, 20477953, 1034, 312814, 17341),
  ('2026-10-01', 29861, 31941470, 1070, 0, 27313)
on conflict (mes) do nothing;
