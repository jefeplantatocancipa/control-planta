-- ============================================================================
-- Row Level Security
-- Roles: jefe_planta (acceso total), supervisor (captura + lectura),
-- operario (solo lectura de lo propio)
-- ============================================================================

create function current_role_is(target_role user_role)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = target_role
  );
$$;

create function is_staff() -- jefe_planta o supervisor
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('jefe_planta', 'supervisor')
  );
$$;

alter table profiles enable row level security;
alter table products enable row level security;
alter table process_stage_templates enable row level security;
alter table production_programs enable row level security;
alter table production_orders enable row level security;
alter table baches enable row level security;
alter table bache_stage_records enable row level security;
alter table envasados enable row level security;
alter table vasos_enmangados enable row level security;

-- profiles: todos los usuarios autenticados pueden leer el directorio (para
-- selects de "operario responsable"); solo jefe_planta administra roles.
create policy "profiles_select_authenticated" on profiles
  for select to authenticated using (true);

create policy "profiles_update_self_or_jefe" on profiles
  for update to authenticated
  using (id = auth.uid() or current_role_is('jefe_planta'))
  with check (id = auth.uid() or current_role_is('jefe_planta'));

create policy "profiles_insert_jefe" on profiles
  for insert to authenticated with check (current_role_is('jefe_planta'));

-- catálogos: lectura para todos los autenticados, escritura solo jefe_planta
create policy "products_select_all" on products
  for select to authenticated using (true);
create policy "products_write_jefe" on products
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

create policy "stage_templates_select_all" on process_stage_templates
  for select to authenticated using (true);
create policy "stage_templates_write_jefe" on process_stage_templates
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- programa de producción: lectura para todos, escritura solo jefe_planta
create policy "programs_select_all" on production_programs
  for select to authenticated using (true);
create policy "programs_write_jefe" on production_programs
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

create policy "orders_select_all" on production_orders
  for select to authenticated using (true);
create policy "orders_write_jefe" on production_orders
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- ejecución de proceso: jefe_planta y supervisor capturan; operario solo ve
-- los registros donde participó.
create policy "baches_select" on baches
  for select to authenticated
  using (is_staff() or created_by = auth.uid());
create policy "baches_write_staff" on baches
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy "stage_records_select" on bache_stage_records
  for select to authenticated
  using (is_staff() or operario_id = auth.uid());
create policy "stage_records_write_staff" on bache_stage_records
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy "envasados_select" on envasados
  for select to authenticated
  using (is_staff() or operario_id = auth.uid());
create policy "envasados_write_staff" on envasados
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create policy "vasos_enmangados_select" on vasos_enmangados
  for select to authenticated
  using (is_staff() or operario_id = auth.uid());
create policy "vasos_enmangados_write_staff" on vasos_enmangados
  for all to authenticated
  using (is_staff())
  with check (is_staff());
