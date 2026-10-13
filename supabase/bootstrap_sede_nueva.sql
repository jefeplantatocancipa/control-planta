-- ============================================================================
-- Control de Planta -- esquema completo consolidado (migraciones 0001-0049)
-- Generado para inicializar una sede nueva de una sola vez en el SQL Editor
-- de Supabase. Correr completo en un proyecto Supabase recien creado.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0001_init.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Control de Procesos - Planta de Lácteos
-- Migración inicial: catálogos, planeación, ejecución de proceso, RLS
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Roles y perfiles
-- ----------------------------------------------------------------------------
create type user_role as enum ('jefe_planta', 'supervisor', 'operario');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'operario',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Crea automáticamente un profile cuando se registra un usuario en auth.users.
-- El rol se puede pasar en raw_user_meta_data->>'role' al invitar/crear el usuario;
-- por defecto queda como 'operario' y el jefe de planta lo puede ajustar después.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'operario')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ----------------------------------------------------------------------------
-- Catálogos
-- ----------------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null default 'litros',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create type process_type as enum ('bache');

-- Plantilla de etapas de un proceso. product_id nulo = plantilla por defecto
-- usada por cualquier producto que no tenga plantilla propia. Esto permite
-- que hoy todos los productos compartan las mismas 8 etapas, y en el futuro
-- un producto nuevo pueda tener su propia secuencia sin cambiar el modelo.
create table process_stage_templates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  process_type process_type not null default 'bache',
  name text not null,
  sequence_order int not null,
  parameter_schema jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, process_type, sequence_order)
);

-- ----------------------------------------------------------------------------
-- Planeación: programa de producción semanal
-- ----------------------------------------------------------------------------
create type program_status as enum ('borrador', 'publicado', 'cerrado');
create type order_status as enum ('pendiente', 'en_proceso', 'completado', 'cancelado');

create table production_programs (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  status program_status not null default 'borrador',
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (week_start_date)
);

create table production_orders (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references production_programs(id) on delete cascade,
  product_id uuid not null references products(id),
  scheduled_date date not null,
  planned_quantity numeric(12, 2) not null check (planned_quantity > 0),
  unit text not null default 'litros',
  status order_status not null default 'pendiente',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Ejecución: preparación de baches
-- ----------------------------------------------------------------------------
create type bache_status as enum ('en_proceso', 'completado', 'cancelado');

create table baches (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid references production_orders(id),
  product_id uuid not null references products(id),
  batch_code text not null unique,
  status bache_status not null default 'en_proceso',
  volumen_total_litros numeric(12, 2),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table bache_stage_records (
  id uuid primary key default gen_random_uuid(),
  bache_id uuid not null references baches(id) on delete cascade,
  stage_template_id uuid not null references process_stage_templates(id),
  operario_id uuid not null references profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  parameters jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (bache_id, stage_template_id)
);

-- ----------------------------------------------------------------------------
-- Ejecución: envasado y vasos enmangados
-- ----------------------------------------------------------------------------
create table envasados (
  id uuid primary key default gen_random_uuid(),
  bache_id uuid not null references baches(id),
  operario_id uuid not null references profiles(id),
  presentacion text not null,
  cantidad_unidades numeric(12, 2) not null check (cantidad_unidades >= 0),
  cantidad_mermas numeric(12, 2) not null default 0 check (cantidad_mermas >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table vasos_enmangados (
  id uuid primary key default gen_random_uuid(),
  envasado_id uuid not null references envasados(id),
  operario_id uuid not null references profiles(id),
  lote_etiqueta text,
  cantidad_unidades numeric(12, 2) not null check (cantidad_unidades >= 0),
  cantidad_mermas numeric(12, 2) not null default 0 check (cantidad_mermas >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Índices
-- ----------------------------------------------------------------------------
create index idx_production_orders_program on production_orders(program_id);
create index idx_production_orders_scheduled_date on production_orders(scheduled_date);
create index idx_baches_status on baches(status);
create index idx_baches_production_order on baches(production_order_id);
create index idx_bache_stage_records_bache on bache_stage_records(bache_id);
create index idx_bache_stage_records_operario on bache_stage_records(operario_id);
create index idx_envasados_bache on envasados(bache_id);
create index idx_vasos_enmangados_envasado on vasos_enmangados(envasado_id);

-- ----------------------------------------------------------------------------
-- Seed: producto inicial + las 8 etapas fijas de preparación de bache
-- ----------------------------------------------------------------------------
insert into products (code, name, unit) values ('LECHE-PAST-001', 'Leche pasteurizada', 'litros');

insert into process_stage_templates (product_id, process_type, name, sequence_order, parameter_schema)
select null, 'bache', name, sequence_order, parameter_schema::jsonb
from (values
  ('Ingreso de leche', 1, '[{"key":"volumen_litros","label":"Volumen (L)","type":"number"},{"key":"temperatura_c","label":"Temperatura (°C)","type":"number"}]'),
  ('Precalentamiento', 2, '[{"key":"temperatura_c","label":"Temperatura (°C)","type":"number"},{"key":"tiempo_min","label":"Tiempo (min)","type":"number"}]'),
  ('Mezcla', 3, '[{"key":"tiempo_min","label":"Tiempo (min)","type":"number"},{"key":"insumos","label":"Insumos agregados","type":"text"}]'),
  ('Homogenización', 4, '[{"key":"presion_bar","label":"Presión (bar)","type":"number"},{"key":"temperatura_c","label":"Temperatura (°C)","type":"number"}]'),
  ('Pasteurización', 5, '[{"key":"temperatura_c","label":"Temperatura (°C)","type":"number"},{"key":"tiempo_min","label":"Tiempo (min)","type":"number"}]'),
  ('Enfriamiento', 6, '[{"key":"temperatura_c","label":"Temperatura (°C)","type":"number"}]'),
  ('Inoculación', 7, '[{"key":"cultivo","label":"Cultivo/inóculo","type":"text"},{"key":"ph","label":"pH","type":"number"}]'),
  ('Corte', 8, '[{"key":"ph","label":"pH final","type":"number"},{"key":"tiempo_min","label":"Tiempo (min)","type":"number"}]')
) as t(name, sequence_order, parameter_schema);

-- ---------------------------------------------------------------------------
-- 0002_rls.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0003_views.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Vistas de soporte para dashboards y estadísticas
-- ============================================================================

-- Proceso actual: para cada bache activo, su última etapa (la que no tiene
-- ended_at, o la más reciente si todas están cerradas), para pintar el
-- tablero en vivo de las 8 etapas.
create view v_proceso_actual as
select
  b.id as bache_id,
  b.batch_code,
  b.product_id,
  p.name as product_name,
  b.status as bache_status,
  b.started_at as bache_started_at,
  st.id as stage_id,
  st.name as stage_name,
  st.sequence_order,
  sr.id as stage_record_id,
  sr.operario_id,
  pr.full_name as operario_name,
  sr.started_at as stage_started_at,
  sr.ended_at as stage_ended_at,
  sr.parameters
from baches b
join products p on p.id = b.product_id
left join lateral (
  select sr2.*
  from bache_stage_records sr2
  where sr2.bache_id = b.id
  order by (sr2.ended_at is null) desc, sr2.started_at desc
  limit 1
) sr on true
left join process_stage_templates st on st.id = sr.stage_template_id
left join profiles pr on pr.id = sr.operario_id
where b.status = 'en_proceso';

-- Cumplimiento del programa: planeado (production_orders) vs ejecutado
-- (unidades envasadas + vasos enmangados asociados a baches de esa orden).
create view v_cumplimiento_programa as
select
  po.id as production_order_id,
  po.program_id,
  pp.week_start_date,
  po.scheduled_date,
  po.product_id,
  pr.name as product_name,
  po.planned_quantity,
  po.unit,
  coalesce(sum(e.cantidad_unidades), 0) as executed_quantity,
  case
    when po.planned_quantity = 0 then 0
    else round(coalesce(sum(e.cantidad_unidades), 0) / po.planned_quantity * 100, 1)
  end as cumplimiento_pct
from production_orders po
join production_programs pp on pp.id = po.program_id
join products pr on pr.id = po.product_id
left join baches b on b.production_order_id = po.id
left join envasados e on e.bache_id = b.id
group by po.id, pp.week_start_date, pr.name;

-- Estadísticas por operario: duración promedio por etapa, unidades
-- producidas y tasa de mermas, para el módulo de estadísticas.
create view v_estadisticas_operario as
select
  pr.id as operario_id,
  pr.full_name as operario_name,
  st.id as stage_id,
  st.name as stage_name,
  count(sr.id) as etapas_completadas,
  avg(extract(epoch from (sr.ended_at - sr.started_at)) / 60) filter (where sr.ended_at is not null) as duracion_promedio_min
from bache_stage_records sr
join profiles pr on pr.id = sr.operario_id
join process_stage_templates st on st.id = sr.stage_template_id
group by pr.id, pr.full_name, st.id, st.name;

create view v_estadisticas_envasado_operario as
select
  pr.id as operario_id,
  pr.full_name as operario_name,
  count(e.id) as eventos_envasado,
  sum(e.cantidad_unidades) as total_unidades,
  sum(e.cantidad_mermas) as total_mermas,
  case
    when sum(e.cantidad_unidades) + sum(e.cantidad_mermas) = 0 then 0
    else round(sum(e.cantidad_mermas) / (sum(e.cantidad_unidades) + sum(e.cantidad_mermas)) * 100, 2)
  end as tasa_merma_pct
from envasados e
join profiles pr on pr.id = e.operario_id
group by pr.id, pr.full_name;

-- ---------------------------------------------------------------------------
-- 0004_grants.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Grants para el rol `authenticated`
--
-- Supabase ya no auto-expone tablas/vistas nuevas a los roles de la API
-- (auto_expose_new_tables quedó deprecado, ver supabase/config.toml). RLS por
-- sí sola no alcanza: Postgres primero revisa GRANT a nivel de tabla y recién
-- después evalúa las políticas de RLS. Sin esto, cualquier query desde
-- PostgREST devuelve "permission denied" aunque las políticas sean correctas.
-- ============================================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- Para que las tablas que se creen en migraciones futuras hereden el mismo
-- acceso sin tener que repetir este grant a mano.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ---------------------------------------------------------------------------
-- 0005_enmangado_independiente.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- El enmangado (etiquetado de vasos blancos por referencia) es un proceso
-- propio, planificado y medido igual que la producción de baches, pero
-- independiente de un envasado puntual. Se le da su propio programa/órdenes
-- (mismo patrón que production_programs/production_orders) y la captura pasa
-- a referenciar el producto (la "referencia") en vez de un envasado.
-- ============================================================================

create table enmangado_programs (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  status program_status not null default 'borrador',
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (week_start_date)
);

create table enmangado_orders (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references enmangado_programs(id) on delete cascade,
  product_id uuid not null references products(id),
  scheduled_date date not null,
  planned_quantity numeric(12, 2) not null check (planned_quantity > 0),
  unit text not null default 'unidades',
  status order_status not null default 'pendiente',
  created_at timestamptz not null default now()
);

create index idx_enmangado_orders_program on enmangado_orders(program_id);
create index idx_enmangado_orders_scheduled_date on enmangado_orders(scheduled_date);

alter table enmangado_programs enable row level security;
alter table enmangado_orders enable row level security;

create policy "enmangado_programs_select_all" on enmangado_programs
  for select to authenticated using (true);
create policy "enmangado_programs_write_jefe" on enmangado_programs
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

create policy "enmangado_orders_select_all" on enmangado_orders
  for select to authenticated using (true);
create policy "enmangado_orders_write_jefe" on enmangado_orders
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- vasos_enmangados ya no cuelga de un envasado puntual: cuelga de la
-- referencia (producto) que se está etiquetando y, opcionalmente, de la
-- orden de enmangado planificada para ese día.
alter table vasos_enmangados
  add column product_id uuid references products(id),
  add column enmangado_order_id uuid references enmangado_orders(id);

-- Backfill para filas existentes (datos de prueba) antes de exigir NOT NULL.
update vasos_enmangados ve
set product_id = b.product_id
from envasados e
join baches b on b.id = e.bache_id
where e.id = ve.envasado_id
  and ve.product_id is null;

alter table vasos_enmangados
  alter column product_id set not null,
  drop column envasado_id;

create index idx_vasos_enmangados_product on vasos_enmangados(product_id);
create index idx_vasos_enmangados_order on vasos_enmangados(enmangado_order_id);

-- ---------------------------------------------------------------------------
-- 0006_enmangado_vasos_blancos.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- El enmangado no tiene relación con la línea de baches/yogurt: entra un
-- vaso blanco, se le pone una etiqueta y sale un vaso fajillado (producto
-- terminado). Le damos su propio catálogo de materia prima (vasos blancos,
-- con control de stock) y su propio catálogo de producto terminado
-- (referencias), en vez de reutilizar el catálogo de productos de baches.
--
-- Las tablas enmangado_orders/vasos_enmangados creadas en 0005 apuntaban a
-- products (el catálogo de baches), lo cual estaba mal; se truncan porque
-- solo tienen datos de prueba y se re-apuntan al catálogo nuevo.
-- ============================================================================

truncate table vasos_enmangados;
truncate table enmangado_orders, enmangado_programs cascade;

create table vasos_blancos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'unidades',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table vasos_blancos_entradas (
  id uuid primary key default gen_random_uuid(),
  vaso_blanco_id uuid not null references vasos_blancos(id),
  cantidad numeric(12, 2) not null check (cantidad > 0),
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table enmangado_referencias (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  vaso_blanco_id uuid not null references vasos_blancos(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table enmangado_orders
  drop column product_id,
  add column referencia_id uuid not null references enmangado_referencias(id);

alter table vasos_enmangados
  drop column product_id,
  add column referencia_id uuid not null references enmangado_referencias(id);

create index idx_vasos_blancos_entradas_vaso on vasos_blancos_entradas(vaso_blanco_id);
create index idx_enmangado_referencias_vaso_blanco on enmangado_referencias(vaso_blanco_id);
create index idx_enmangado_orders_referencia on enmangado_orders(referencia_id);
create index idx_vasos_enmangados_referencia on vasos_enmangados(referencia_id);

alter table vasos_blancos enable row level security;
alter table vasos_blancos_entradas enable row level security;
alter table enmangado_referencias enable row level security;

-- Catálogos: lectura para todos los autenticados, escritura solo jefe_planta.
create policy "vasos_blancos_select_all" on vasos_blancos
  for select to authenticated using (true);
create policy "vasos_blancos_write_jefe" on vasos_blancos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

create policy "enmangado_referencias_select_all" on enmangado_referencias
  for select to authenticated using (true);
create policy "enmangado_referencias_write_jefe" on enmangado_referencias
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- Entradas de stock: las registra el personal de planta (jefe_planta o
-- supervisor), igual que el resto de la captura de proceso.
create policy "vasos_blancos_entradas_select" on vasos_blancos_entradas
  for select to authenticated using (true);
create policy "vasos_blancos_entradas_write_staff" on vasos_blancos_entradas
  for all to authenticated
  using (is_staff())
  with check (is_staff());

-- ---------------------------------------------------------------------------
-- 0007_alistamiento_insumos.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Nueva etapa de preparación de bache: "Alistamiento de insumos" (pesaje).
-- A diferencia de las demás etapas, esta no captura un formulario fijo de
-- parámetros sino una lista de insumos (cada uno con lote, peso y marca), así
-- que las plantillas de etapa necesitan indicar qué tipo de captura usan.
-- ============================================================================

create type stage_capture_mode as enum ('parametros', 'insumos');

alter table process_stage_templates
  add column capture_mode stage_capture_mode not null default 'parametros';

-- Corre las 8 etapas existentes un lugar para que el alistamiento quede
-- primero. product_id es null en todas (plantilla por defecto), así que no
-- hay riesgo de choque con sequence_order de otro producto.
update process_stage_templates
set sequence_order = sequence_order + 1
where product_id is null and process_type = 'bache';

insert into process_stage_templates
  (product_id, process_type, name, sequence_order, parameter_schema, capture_mode)
values
  (null, 'bache', 'Alistamiento de insumos', 1, '[]'::jsonb, 'insumos');

-- ---------------------------------------------------------------------------
-- 0008_insumos_receta.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Catálogo de insumos y receta por producto: la etapa "Alistamiento de
-- insumos" pasa de una lista libre a un checklist basado en los insumos que
-- le corresponden al producto del bache.
-- ============================================================================

create table insumos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table product_insumos (
  product_id uuid not null references products(id) on delete cascade,
  insumo_id uuid not null references insumos(id) on delete cascade,
  primary key (product_id, insumo_id)
);

create index idx_product_insumos_product on product_insumos(product_id);
create index idx_product_insumos_insumo on product_insumos(insumo_id);

alter table insumos enable row level security;
alter table product_insumos enable row level security;

create policy "insumos_select_all" on insumos
  for select to authenticated using (true);
create policy "insumos_write_jefe" on insumos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

create policy "product_insumos_select_all" on product_insumos
  for select to authenticated using (true);
create policy "product_insumos_write_jefe" on product_insumos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- ---------------------------------------------------------------------------
-- 0009_captures_insumos.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Una etapa necesita poder tener parámetros propios (ej. temperatura) Y un
-- checklist de insumos al mismo tiempo (ej. "Mezcla" confirma qué insumos de
-- los prealistados se agregaron). capture_mode era exclusivo (parametros O
-- insumos); se reemplaza por un booleano independiente.
-- ============================================================================

alter table process_stage_templates
  add column captures_insumos boolean not null default false;

update process_stage_templates
set captures_insumos = true
where capture_mode = 'insumos';

alter table process_stage_templates
  drop column capture_mode;

drop type stage_capture_mode;

-- ---------------------------------------------------------------------------
-- 0010_captures_readings.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- Etapas como "Curva de fermentación": en vez de capturar los parámetros una
-- sola vez al finalizar, se toman varias lecturas a lo largo del tiempo (cada
-- una con su hora automática) mientras la etapa sigue en curso. Es un flag
-- independiente, igual que captures_insumos: una etapa puede combinar ambos.
-- ============================================================================

alter table process_stage_templates
  add column captures_readings boolean not null default false;

-- ---------------------------------------------------------------------------
-- 0011_programa_import_baches.sql
-- ---------------------------------------------------------------------------
-- Soporta el importador de Excel del programa de producción (Baches): la
-- planilla real de la planta trae orden de producción, tanque, cantidad de
-- baches planeados y horas de inicio/final planeadas. Las horas "reales" no
-- se guardan acá: se calculan a partir de los baches ya vinculados a la
-- orden (production_order_id), igual que el resto de horas automáticas de
-- la app.

alter table production_orders
  add column orden_codigo text,
  add column tanque text,
  add column baches_planeados int check (baches_planeados > 0),
  add column hora_inicio_planeada timestamptz,
  add column hora_final_planeada timestamptz;

alter table production_orders
  add constraint production_orders_orden_codigo_key unique (orden_codigo);

-- La cantidad planeada en litros/unidades sigue existiendo para la carga
-- manual, pero deja de ser obligatoria: las órdenes importadas desde Excel
-- planean por cantidad de baches, no por volumen.
alter table production_orders
  alter column planned_quantity drop not null;

-- ---------------------------------------------------------------------------
-- 0012_volumen_por_bache.sql
-- ---------------------------------------------------------------------------
-- Volumen equivalente de un bache "estándar" de este producto (en su
-- unidad, generalmente litros). Sirve para sugerir el volumen al crear un
-- bache a partir de una orden de producción importada desde Excel, que
-- planea por cantidad de baches y no por volumen.
alter table products
  add column volumen_por_bache numeric(12, 2) check (volumen_por_bache > 0);

-- ---------------------------------------------------------------------------
-- 0013_envasado_orders.sql
-- ---------------------------------------------------------------------------
-- Programa (plan) de Envasado, segunda parte del importador de Excel del
-- módulo Programa de producción: comparte la misma semana/programa que las
-- órdenes de Baches (production_programs), pero planea por SKU + línea +
-- unidades a envasar (no por baches).
create table envasado_orders (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references production_programs(id) on delete cascade,
  product_id uuid not null references products(id),
  linea text,
  scheduled_date date not null,
  planned_quantity numeric(12, 2) not null check (planned_quantity > 0),
  gramaje_por_unidad numeric(12, 2) check (gramaje_por_unidad > 0),
  status order_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  unique (scheduled_date, linea, product_id)
);

alter table envasado_orders enable row level security;

create policy "envasado_orders_select_all" on envasado_orders
  for select to authenticated using (true);
create policy "envasado_orders_write_jefe" on envasado_orders
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- ---------------------------------------------------------------------------
-- 0014_envasado_referencias.sql
-- ---------------------------------------------------------------------------
-- El sku del "Formato de Empaque" identifica una presentación empacada
-- concreta (ej. "Yogurt Griego Entero 450 g"), no el producto a granel del
-- bache. Se agrega un catálogo propio, análogo al de enmangado_referencias,
-- y el programa de Envasado pasa a planear por referencia en vez de por
-- producto directamente.
--
-- envasado_orders recién se creó en 0013 y todavía no tiene datos en uso
-- (el primer intento de import falló por no encontrar coincidencias), así
-- que se recrea limpio en vez de alterar columna por columna.
drop table if exists envasado_orders;

create table envasado_referencias (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  sku text not null unique,
  name text not null,
  peso_unitario numeric(12, 2) not null check (peso_unitario > 0),
  multiempaque int not null default 1 check (multiempaque > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table envasado_referencias enable row level security;

create policy "envasado_referencias_select_all" on envasado_referencias
  for select to authenticated using (true);
create policy "envasado_referencias_write_jefe" on envasado_referencias
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

create table envasado_orders (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references production_programs(id) on delete cascade,
  referencia_id uuid not null references envasado_referencias(id),
  linea text,
  scheduled_date date not null,
  planned_quantity numeric(12, 2) not null check (planned_quantity > 0),
  status order_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  unique (scheduled_date, linea, referencia_id)
);

alter table envasado_orders enable row level security;

create policy "envasado_orders_select_all" on envasado_orders
  for select to authenticated using (true);
create policy "envasado_orders_write_jefe" on envasado_orders
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- ---------------------------------------------------------------------------
-- 0015_envasado_order_link.sql
-- ---------------------------------------------------------------------------
-- Igual que baches.production_order_id: permite iniciar un envasado a
-- partir de una orden de trabajo del programa (envasado_orders), en vez de
-- cargar la presentación a mano cada vez.
alter table envasados
  add column envasado_order_id uuid references envasado_orders(id);

-- ---------------------------------------------------------------------------
-- 0016_envasado_turnos_cortes.sql
-- ---------------------------------------------------------------------------
-- Control de envasado por turno: franjas horarias fijas (Turnos), catálogo
-- de insumos de envasado (envases/empaques: vasos, tapas, etiquetas, cajas),
-- el registro de qué se usó de esos insumos al iniciar un envasado, y el
-- "corte" que cada turno deja sobre un envasado en curso (unidades hechas,
-- control de calidad de sellado/lote, peso promedio de 3 unidades).

create table turnos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hora_inicio time not null,
  hora_fin time not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table turnos enable row level security;
create policy "turnos_select_all" on turnos
  for select to authenticated using (true);
create policy "turnos_write_jefe" on turnos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

insert into turnos (name, hora_inicio, hora_fin) values
  ('Turno A', '06:00', '14:00'),
  ('Turno B', '14:00', '22:00'),
  ('Turno C', '22:00', '06:00');

-- Catálogo de insumos de envasado (envases/empaques), independiente del
-- catálogo de insumos de producción del bache.
create table envasado_insumos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table envasado_insumos enable row level security;
create policy "envasado_insumos_select_all" on envasado_insumos
  for select to authenticated using (true);
create policy "envasado_insumos_write_jefe" on envasado_insumos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- Nota general del supervisor sobre los insumos de envasado usados, cargada
-- una vez al iniciar el envasado (no por turno).
alter table envasados
  add column insumos_observacion text;

create table envasado_insumos_uso (
  id uuid primary key default gen_random_uuid(),
  envasado_id uuid not null references envasados(id) on delete cascade,
  envasado_insumo_id uuid not null references envasado_insumos(id),
  lote text,
  fecha_vencimiento date,
  proveedor text,
  cantidad_usada numeric(12, 2),
  unidad_medida text,
  desperdicio numeric(12, 2),
  created_at timestamptz not null default now()
);

alter table envasado_insumos_uso enable row level security;
create policy "envasado_insumos_uso_select" on envasado_insumos_uso
  for select to authenticated using (is_staff());
create policy "envasado_insumos_uso_write" on envasado_insumos_uso
  for all to authenticated
  using (is_staff())
  with check (is_staff());

-- Corte de turno: checkpoint que deja cada turno (A/B/C) sobre un envasado
-- en curso, con el conteo de unidades al inicio/final del turno y el
-- control de calidad (sellado, marcado del lote, peso promedio de 3
-- unidades).
create table envasado_cortes (
  id uuid primary key default gen_random_uuid(),
  envasado_id uuid not null references envasados(id) on delete cascade,
  turno_id uuid not null references turnos(id),
  fecha date not null default current_date,
  operario_id uuid not null references profiles(id),
  operario_2_id uuid references profiles(id),
  unidades_inicio numeric(12, 2) not null check (unidades_inicio >= 0),
  unidades_final numeric(12, 2) not null check (unidades_final >= unidades_inicio),
  sellado_cumple boolean not null,
  lote_marcado text not null check (lote_marcado in ('C', 'NC')),
  peso_1 numeric(12, 3),
  peso_2 numeric(12, 3),
  peso_3 numeric(12, 3),
  observaciones text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (envasado_id, turno_id, fecha)
);

alter table envasado_cortes enable row level security;
create policy "envasado_cortes_select" on envasado_cortes
  for select to authenticated using (is_staff());
create policy "envasado_cortes_write" on envasado_cortes
  for all to authenticated
  using (is_staff())
  with check (is_staff());

-- ---------------------------------------------------------------------------
-- 0017_envasado_insumos_detalle.sql
-- ---------------------------------------------------------------------------
-- Para poder importar el catálogo de material de empaque desde Excel, con
-- presentación por caja y marca(s), tal como lo maneja la planta.
alter table envasado_insumos
  add column presentacion_caja text,
  add column marca text;

-- ---------------------------------------------------------------------------
-- 0018_envasado_referencia_insumos.sql
-- ---------------------------------------------------------------------------
-- Receta de material de empaque por referencia (sku): qué insumos de
-- envasado corresponden a cada presentación, igual que product_insumos
-- para la receta de materia prima por producto.
create table envasado_referencia_insumos (
  referencia_id uuid not null references envasado_referencias(id) on delete cascade,
  envasado_insumo_id uuid not null references envasado_insumos(id) on delete cascade,
  primary key (referencia_id, envasado_insumo_id)
);

alter table envasado_referencia_insumos enable row level security;

create policy "envasado_referencia_insumos_select_all" on envasado_referencia_insumos
  for select to authenticated using (true);
create policy "envasado_referencia_insumos_write_jefe" on envasado_referencia_insumos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- ---------------------------------------------------------------------------
-- 0019_envasado_control_horario.sql
-- ---------------------------------------------------------------------------
-- Reestructura el "corte de turno": pasa a ser un inicio/fin de turno (como
-- iniciar/finalizar una etapa) en vez de un único snapshot. El control de
-- calidad (peso neto de 3 unidades, sellado, fechado) se hace por lecturas
-- repetidas (cada hora) mientras el turno está activo, y el avance de
-- producción se registra por ciclos de estiba (inicio/final + unidades),
-- en vez de un solo par de unidades inicio/final por turno.

-- El nombre exacto del check de unidades_final lo asigna Postgres al
-- crear la tabla; se busca dinámicamente en vez de asumirlo, para no
-- depender de la convención de nombres.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'envasado_cortes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%unidades_final%'
  loop
    execute format('alter table envasado_cortes drop constraint %I', con.conname);
  end loop;
end $$;

alter table envasado_cortes
  drop column sellado_cumple,
  drop column lote_marcado,
  drop column peso_1,
  drop column peso_2,
  drop column peso_3;

alter table envasado_cortes
  add column started_at timestamptz not null default now(),
  add column ended_at timestamptz,
  add column desperdicio numeric(12, 2);

alter table envasado_cortes
  alter column unidades_final drop not null;

create table envasado_calidad_lecturas (
  id uuid primary key default gen_random_uuid(),
  corte_id uuid not null references envasado_cortes(id) on delete cascade,
  peso_1 numeric(12, 3),
  peso_2 numeric(12, 3),
  peso_3 numeric(12, 3),
  sellado_cumple boolean not null,
  fechado_cumple boolean not null,
  observaciones text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table envasado_calidad_lecturas enable row level security;
create policy "envasado_calidad_lecturas_select" on envasado_calidad_lecturas
  for select to authenticated using (is_staff());
create policy "envasado_calidad_lecturas_write" on envasado_calidad_lecturas
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create table envasado_estibas (
  id uuid primary key default gen_random_uuid(),
  corte_id uuid not null references envasado_cortes(id) on delete cascade,
  inicio_estiba timestamptz not null default now(),
  final_estiba timestamptz,
  unidades_por_estiba numeric(12, 2),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table envasado_estibas enable row level security;
create policy "envasado_estibas_select" on envasado_estibas
  for select to authenticated using (is_staff());
create policy "envasado_estibas_write" on envasado_estibas
  for all to authenticated
  using (is_staff())
  with check (is_staff());

-- ---------------------------------------------------------------------------
-- 0020_bache_volumen_restante.sql
-- ---------------------------------------------------------------------------
-- Para saber si un bache sigue teniendo producto sin envasar (y por lo
-- tanto debe seguir apareciendo para elegir en "Iniciar envasado"), o si
-- ya se agotó.
alter table baches
  add column volumen_restante_litros numeric(12, 2);

update baches
  set volumen_restante_litros = volumen_total_litros
  where volumen_total_litros is not null;

-- ---------------------------------------------------------------------------
-- 0021_encajado.sql
-- ---------------------------------------------------------------------------
-- Encajado: empacar en cajas las unidades ya envasadas. No tiene programa
-- propio (no se agenda a mano) — se crea automáticamente al cerrar un
-- envasado (uno por envasado), y arranca "pendiente" (sin started_at) hasta
-- que alguien lo inicia desde /encajado capturando el lote. El avance se
-- controla igual que en envasado: ciclos de estiba con inicio/final
-- automáticos, pero acá solo importa el tiempo (no se cuentan unidades por
-- estiba, eso ya quedó registrado en el envasado).

create table encajados (
  id uuid primary key default gen_random_uuid(),
  envasado_id uuid not null unique references envasados(id) on delete cascade,
  bache_id uuid not null references baches(id),
  lote text,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table encajados enable row level security;
create policy "encajados_select" on encajados
  for select to authenticated using (is_staff());
create policy "encajados_write" on encajados
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create table encajado_estibas (
  id uuid primary key default gen_random_uuid(),
  encajado_id uuid not null references encajados(id) on delete cascade,
  inicio_estiba timestamptz not null default now(),
  final_estiba timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table encajado_estibas enable row level security;
create policy "encajado_estibas_select" on encajado_estibas
  for select to authenticated using (is_staff());
create policy "encajado_estibas_write" on encajado_estibas
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create index idx_encajados_bache on encajados(bache_id);
create index idx_encajado_estibas_encajado on encajado_estibas(encajado_id);

-- ---------------------------------------------------------------------------
-- 0022_tanques.sql
-- ---------------------------------------------------------------------------
-- Catálogo de tanques: para que el parámetro "Tanque" de las etapas del
-- bache se elija de una lista (como los insumos) en vez de escribirse a
-- mano en cada captura.

create table tanques (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table tanques enable row level security;

create policy "tanques_select_all" on tanques
  for select to authenticated using (true);
create policy "tanques_write_jefe" on tanques
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- ---------------------------------------------------------------------------
-- 0023_envasado_paradas.sql
-- ---------------------------------------------------------------------------
-- Paradas de envasado: a diferencia del turno/corte (que es "quién está
-- trabajando ahora"), una parada vive a nivel del envasado completo, porque
-- puede pasar con o sin turno activo (línea sin actividad, entre turnos,
-- falla, cambio de referencia, descanso, etc.). Se inicia con el motivo
-- (opcional, se sabe al momento de parar) y se cierra sin campos extra,
-- igual que el resto de inicio/fin automáticos de la app.

create table envasado_paradas (
  id uuid primary key default gen_random_uuid(),
  envasado_id uuid not null references envasados(id) on delete cascade,
  motivo text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table envasado_paradas enable row level security;
create policy "envasado_paradas_select" on envasado_paradas
  for select to authenticated using (is_staff());
create policy "envasado_paradas_write" on envasado_paradas
  for all to authenticated
  using (is_staff())
  with check (is_staff());

create index idx_envasado_paradas_envasado on envasado_paradas(envasado_id);

-- ---------------------------------------------------------------------------
-- 0024_envasado_lote.sql
-- ---------------------------------------------------------------------------
-- El lote de envasado se captura al iniciar (como la presentación), para
-- poder identificar la producción de ese día en el empaque final.
alter table envasados
  add column lote text;

-- ---------------------------------------------------------------------------
-- 0025_rol_planeacion.sql
-- ---------------------------------------------------------------------------
-- Nuevo rol "planeacion": solo tiene acceso a Programa (crear/editar
-- ordenes, importar Excel) y a Proceso actual (de solo lectura para
-- cualquier rol autenticado, no necesita permisos especiales). Va en su
-- propia migración porque Postgres no permite usar un valor de enum recién
-- agregado en la misma transacción en que se agrega.
alter type user_role add value 'planeacion';

-- ---------------------------------------------------------------------------
-- 0026_planeacion_rls_programa.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0027_envasado_orders_supervisor_update.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0028_backfill_encajados.sql
-- ---------------------------------------------------------------------------
-- finalizarEnvasado insertaba el encajado sin revisar si fallaba (ver
-- fix en el codigo), asi que algunos envasados ya finalizados se quedaron
-- sin su encajado. Se rellenan acá los que falten.
insert into encajados (envasado_id, bache_id, created_by)
select e.id, e.bache_id, e.created_by
from envasados e
where e.ended_at is not null
  and not exists (
    select 1 from encajados en where en.envasado_id = e.id
  );

-- ---------------------------------------------------------------------------
-- 0029_envasado_insumos_inventario.sql
-- ---------------------------------------------------------------------------
-- El checklist de insumos de envasado pasa de pedir "cantidad usada" al
-- iniciar (una estimación antes de haber envasado nada) a un control de
-- inventario real: inventario inicial al iniciar el envasado, e inventario
-- final al cerrarlo -- el consumo real queda implícito en la diferencia.
alter table envasado_insumos_uso
  rename column cantidad_usada to inventario_inicial;

alter table envasado_insumos_uso
  add column inventario_final numeric(12, 2);

-- ---------------------------------------------------------------------------
-- 0030_rol_calidad.sql
-- ---------------------------------------------------------------------------
-- Nuevo rol "calidad": firma (aprueba) los valores capturados en cada etapa
-- de baches y cada turno de envasado, pero no puede iniciar/finalizar nada
-- del proceso -- solo puede leer y firmar. Va en su propia migración porque
-- Postgres no permite usar un valor de enum recién agregado en la misma
-- transacción en que se agrega.
alter type user_role add value 'calidad';

-- ---------------------------------------------------------------------------
-- 0031_calidad_firmas.sql
-- ---------------------------------------------------------------------------
-- Módulo de calidad: firma (aprobación) etapa por etapa en baches, y turno
-- por turno (corte) en envasado. La firma es un registro aparte, posterior
-- al cierre de la etapa/turno -- nunca bloquea ni interfiere el proceso, que
-- sigue su curso normal sin depender de que calidad firme o no.

create table bache_stage_firmas (
  id uuid primary key default gen_random_uuid(),
  stage_record_id uuid not null unique references bache_stage_records(id) on delete cascade,
  aprobado boolean not null,
  observaciones text,
  firmado_por uuid not null references profiles(id),
  firmado_at timestamptz not null default now()
);

alter table bache_stage_firmas enable row level security;
create policy "bache_stage_firmas_select" on bache_stage_firmas
  for select to authenticated using (is_staff() or current_role_is('calidad'));
create policy "bache_stage_firmas_write" on bache_stage_firmas
  for all to authenticated
  using (current_role_is('calidad') or current_role_is('jefe_planta'))
  with check (current_role_is('calidad') or current_role_is('jefe_planta'));

create table envasado_corte_firmas (
  id uuid primary key default gen_random_uuid(),
  corte_id uuid not null unique references envasado_cortes(id) on delete cascade,
  aprobado boolean not null,
  observaciones text,
  firmado_por uuid not null references profiles(id),
  firmado_at timestamptz not null default now()
);

alter table envasado_corte_firmas enable row level security;
create policy "envasado_corte_firmas_select" on envasado_corte_firmas
  for select to authenticated using (is_staff() or current_role_is('calidad'));
create policy "envasado_corte_firmas_write" on envasado_corte_firmas
  for all to authenticated
  using (current_role_is('calidad') or current_role_is('jefe_planta'))
  with check (current_role_is('calidad') or current_role_is('jefe_planta'));

-- Calidad necesita poder leer baches y envasado (y sus datos asociados) para
-- poder firmar -- ver, no interviene -- por ahora limitado a esos dos
-- módulos, según lo pedido.
drop policy "baches_select" on baches;
create policy "baches_select" on baches
  for select to authenticated
  using (is_staff() or current_role_is('calidad') or created_by = auth.uid());

drop policy "stage_records_select" on bache_stage_records;
create policy "stage_records_select" on bache_stage_records
  for select to authenticated
  using (is_staff() or current_role_is('calidad') or operario_id = auth.uid());

drop policy "envasados_select" on envasados;
create policy "envasados_select" on envasados
  for select to authenticated
  using (is_staff() or current_role_is('calidad') or operario_id = auth.uid());

drop policy "envasado_insumos_uso_select" on envasado_insumos_uso;
create policy "envasado_insumos_uso_select" on envasado_insumos_uso
  for select to authenticated using (is_staff() or current_role_is('calidad'));

drop policy "envasado_cortes_select" on envasado_cortes;
create policy "envasado_cortes_select" on envasado_cortes
  for select to authenticated using (is_staff() or current_role_is('calidad'));

drop policy "envasado_calidad_lecturas_select" on envasado_calidad_lecturas;
create policy "envasado_calidad_lecturas_select" on envasado_calidad_lecturas
  for select to authenticated using (is_staff() or current_role_is('calidad'));

drop policy "envasado_estibas_select" on envasado_estibas;
create policy "envasado_estibas_select" on envasado_estibas
  for select to authenticated using (is_staff() or current_role_is('calidad'));

drop policy "envasado_paradas_select" on envasado_paradas;
create policy "envasado_paradas_select" on envasado_paradas
  for select to authenticated using (is_staff() or current_role_is('calidad'));

create index idx_bache_stage_firmas_record on bache_stage_firmas(stage_record_id);
create index idx_envasado_corte_firmas_corte on envasado_corte_firmas(corte_id);

-- ---------------------------------------------------------------------------
-- 0032_cierre_firmado_por.sql
-- ---------------------------------------------------------------------------
-- Quién ejecuta el cierre de una etapa (bache) o de un turno (envasado)
-- queda registrado como "firma" de ese cierre -- distinto de la firma de
-- calidad (que es una aprobación aparte, posterior). Así los supervisores
-- también aparecen firmando cuando cierran una etapa/turno, no solo quien
-- fue elegido como operario responsable al inicio.
alter table bache_stage_records add column closed_by uuid references profiles(id);
alter table envasado_cortes add column closed_by uuid references profiles(id);

-- ---------------------------------------------------------------------------
-- 0033_producto_requiere_envasado.sql
-- ---------------------------------------------------------------------------
-- Algunos productos (ej. cremado) no se envasan: no deben aparecer en el
-- selector de "Iniciar envasado" aunque el bache ya esté completo. Por
-- defecto todos los productos sí se envasan (comportamiento actual).
alter table products add column requiere_envasado boolean not null default true;

-- ---------------------------------------------------------------------------
-- 0034_envasado_referencia_id.sql
-- ---------------------------------------------------------------------------
-- Para calcular kilos empacados (unidades x peso unitario) y compararlos
-- contra el balance de masa de insumos en el informe del bache, cada
-- envasado necesita quedar vinculado a su referencia (presentación), no
-- solo al texto libre que hoy se muestra en pantalla.
alter table envasados add column referencia_id uuid references envasado_referencias(id);

-- ---------------------------------------------------------------------------
-- 0035_rol_asistente_adm.sql
-- ---------------------------------------------------------------------------
-- Nuevo rol "asistente_adm": puede ver e imprimir todos los módulos de la
-- app, pero nunca puede crear, editar ni eliminar nada -- es puramente un
-- observador. Va en su propia migración porque Postgres no permite usar un
-- valor de enum recién agregado en la misma transacción en que se agrega.
alter type user_role add value 'asistente_adm';

-- ---------------------------------------------------------------------------
-- 0036_asistente_adm_rls.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0037_encajado_cajas_por_estiba.sql
-- ---------------------------------------------------------------------------
-- Además del tiempo, el encajado ahora registra cuántas cajas salieron de
-- cada estiba (se captura al finalizarla, igual que las unidades por
-- estiba en envasado).
alter table encajado_estibas add column cajas_por_estiba integer;

-- ---------------------------------------------------------------------------
-- 0038_inventario.sql
-- ---------------------------------------------------------------------------
-- Módulo de Inventario: un libro de movimientos (no un contador que se
-- pisa) para materia prima (insumos), material de empaque
-- (envasado_insumos) y vasos blancos (enmangado). El stock actual de
-- cualquier insumo es siempre la suma de sus movimientos -- nunca un
-- campo que alguien edita directo -- así queda trazabilidad completa y
-- nunca se puede desincronizar de la realidad.
--
-- insumo_tipo/insumo_id no tienen FK real porque apuntan a tres catálogos
-- distintos (insumos, envasado_insumos, vasos_blancos) -- Postgres no
-- soporta una FK condicional a una tabla u otra. La integridad queda a
-- cargo del código de la app (siempre inserta el tipo correcto).
create table inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  insumo_tipo text not null check (insumo_tipo in ('materia_prima', 'empaque', 'vaso_blanco')),
  insumo_id uuid not null,
  tipo text not null check (tipo in ('entrada', 'consumo', 'ajuste')),
  -- Siempre firmado: positivo suma al stock (entrada, ajuste hacia arriba),
  -- negativo resta (consumo, ajuste hacia abajo). El stock actual es la
  -- suma simple de esta columna.
  cantidad numeric(12, 2) not null,
  origen_tipo text check (origen_tipo in ('bache', 'envasado', 'enmangado', 'manual')),
  origen_id uuid,
  proveedor text,
  notas text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table inventario_movimientos enable row level security;
create policy "inventario_movimientos_select" on inventario_movimientos
  for select to authenticated using (is_staff() or current_role_is('asistente_adm'));
create policy "inventario_movimientos_insert" on inventario_movimientos
  for insert to authenticated with check (is_staff());
create policy "inventario_movimientos_delete" on inventario_movimientos
  for delete to authenticated using (current_role_is('jefe_planta'));

create index idx_inventario_movimientos_insumo on inventario_movimientos(insumo_tipo, insumo_id);
create index idx_inventario_movimientos_origen on inventario_movimientos(origen_tipo, origen_id);

-- Stock mínimo configurable por insumo, en cada catálogo existente (no un
-- catálogo de inventario aparte): se edita desde la misma pantalla de
-- Administración donde ya se crea cada insumo.
alter table insumos add column stock_minimo numeric(12, 2);
alter table envasado_insumos add column stock_minimo numeric(12, 2);
alter table vasos_blancos add column stock_minimo numeric(12, 2);

-- Stock actual = catálogo (activos) + su saldo de movimientos (0 si nunca
-- tuvo ninguno).
create view v_inventario_stock as
select
  'materia_prima'::text as insumo_tipo,
  i.id as insumo_id,
  i.name,
  i.stock_minimo,
  coalesce(sum(m.cantidad), 0) as stock_actual
from insumos i
left join inventario_movimientos m
  on m.insumo_tipo = 'materia_prima' and m.insumo_id = i.id
where i.active
group by i.id, i.name, i.stock_minimo
union all
select
  'empaque',
  ei.id,
  ei.name,
  ei.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from envasado_insumos ei
left join inventario_movimientos m
  on m.insumo_tipo = 'empaque' and m.insumo_id = ei.id
where ei.active
group by ei.id, ei.name, ei.stock_minimo
union all
select
  'vaso_blanco',
  vb.id,
  vb.name,
  vb.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from vasos_blancos vb
left join inventario_movimientos m
  on m.insumo_tipo = 'vaso_blanco' and m.insumo_id = vb.id
where vb.active
group by vb.id, vb.name, vb.stock_minimo;

-- Backfill de vasos blancos: es el único de los tres que ya tenía datos
-- estructurados de entradas y consumo (no texto libre ni JSON), así que se
-- puede reconstruir su historial completo sin riesgo. Materia prima y
-- material de empaque arrancan a contar desde ahora -- para esos dos, la
-- primera carga real es hacer un conteo físico y registrarlo como entrada
-- o ajuste inicial.
insert into inventario_movimientos
  (insumo_tipo, insumo_id, tipo, cantidad, origen_tipo, notas, created_by, created_at)
select
  'vaso_blanco',
  e.vaso_blanco_id,
  'entrada',
  e.cantidad,
  'manual',
  e.notes,
  e.created_by,
  e.created_at
from vasos_blancos_entradas e;

insert into inventario_movimientos
  (insumo_tipo, insumo_id, tipo, cantidad, origen_tipo, origen_id, created_by, created_at)
select
  'vaso_blanco',
  r.vaso_blanco_id,
  'consumo',
  -v.cantidad_unidades,
  'enmangado',
  v.id,
  v.created_by,
  v.created_at
from vasos_enmangados v
join enmangado_referencias r on r.id = v.referencia_id;

-- ---------------------------------------------------------------------------
-- 0039_inventario_categorias_lotes.sql
-- ---------------------------------------------------------------------------
-- Categorías abiertas de inventario (vos las creás/editás, no quedan fijas
-- en 3). Cada categoría dice a qué sistema alimenta ("tabla_destino"):
-- materia_prima -> insumos (recetas de bache), empaque -> envasado_insumos
-- (recetas de envasado), vaso_blanco -> vasos_blancos (enmangado), o
-- generico -> inventario_items (solo stock, sin receta -- ej. aseo,
-- producto enmangado terminado) para lo que no encaja en los tres
-- catálogos ya ligados a una receta.
create table inventario_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tabla_destino text not null default 'generico'
    check (tabla_destino in ('materia_prima', 'empaque', 'vaso_blanco', 'generico')),
  created_at timestamptz not null default now()
);

alter table inventario_categorias enable row level security;
create policy "inventario_categorias_select_all" on inventario_categorias
  for select to authenticated using (true);
create policy "inventario_categorias_write_jefe" on inventario_categorias
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

insert into inventario_categorias (nombre, tabla_destino) values
  ('Materia prima', 'materia_prima'),
  ('Empaque', 'empaque'),
  ('Vaso blanco', 'vaso_blanco');

-- "Código" (el identificador del Excel del cliente) y categoría en los tres
-- catálogos que ya existían y que ya alimentan una receta -- así el
-- importador puede hacer upsert por código en vez de por nombre, y esos
-- insumos importados ya aparecen para elegir en las recetas sin tocar nada
-- más.
alter table insumos add column codigo text unique;
alter table insumos add column categoria_id uuid references inventario_categorias(id);
alter table envasado_insumos add column codigo text unique;
alter table envasado_insumos add column categoria_id uuid references inventario_categorias(id);
alter table vasos_blancos add column codigo text unique;
alter table vasos_blancos add column categoria_id uuid references inventario_categorias(id);

-- Catálogo genérico: todo lo que el Excel trae y no corresponde a ninguno
-- de los tres catálogos de arriba (ej. aseo, producto enmangado
-- terminado). Solo se controla por entradas/ajustes manuales -- no hay
-- receta ni consumo automático para esto todavía.
create table inventario_items (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  name text not null,
  unit text not null default 'unidades',
  categoria_id uuid references inventario_categorias(id),
  stock_minimo numeric(12, 2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table inventario_items enable row level security;
create policy "inventario_items_select_all" on inventario_items
  for select to authenticated using (true);
create policy "inventario_items_write_jefe" on inventario_items
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- Lote de cada movimiento (para poder tener el mismo insumo con saldos de
-- distintos lotes) y el 4to tipo "generico" del catálogo de arriba.
alter table inventario_movimientos add column lote text;
alter table inventario_movimientos drop constraint inventario_movimientos_insumo_tipo_check;
alter table inventario_movimientos add constraint inventario_movimientos_insumo_tipo_check
  check (insumo_tipo in ('materia_prima', 'empaque', 'vaso_blanco', 'generico'));

-- Vista de stock: se reescribe para sumar también el catálogo genérico.
drop view v_inventario_stock;
create view v_inventario_stock as
select
  'materia_prima'::text as insumo_tipo,
  i.id as insumo_id,
  i.name,
  i.codigo,
  i.categoria_id,
  i.stock_minimo,
  coalesce(sum(m.cantidad), 0) as stock_actual
from insumos i
left join inventario_movimientos m
  on m.insumo_tipo = 'materia_prima' and m.insumo_id = i.id
where i.active
group by i.id, i.name, i.codigo, i.categoria_id, i.stock_minimo
union all
select
  'empaque',
  ei.id,
  ei.name,
  ei.codigo,
  ei.categoria_id,
  ei.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from envasado_insumos ei
left join inventario_movimientos m
  on m.insumo_tipo = 'empaque' and m.insumo_id = ei.id
where ei.active
group by ei.id, ei.name, ei.codigo, ei.categoria_id, ei.stock_minimo
union all
select
  'vaso_blanco',
  vb.id,
  vb.name,
  vb.codigo,
  vb.categoria_id,
  vb.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from vasos_blancos vb
left join inventario_movimientos m
  on m.insumo_tipo = 'vaso_blanco' and m.insumo_id = vb.id
where vb.active
group by vb.id, vb.name, vb.codigo, vb.categoria_id, vb.stock_minimo
union all
select
  'generico',
  gi.id,
  gi.name,
  gi.codigo,
  gi.categoria_id,
  gi.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from inventario_items gi
left join inventario_movimientos m
  on m.insumo_tipo = 'generico' and m.insumo_id = gi.id
where gi.active
group by gi.id, gi.name, gi.codigo, gi.categoria_id, gi.stock_minimo;

-- Índice de "dónde vive cada código", para que el importador de entradas
-- pueda resolver un código del Excel sin importar a cuál de los cuatro
-- catálogos pertenece.
create view v_inventario_catalogo as
select 'materia_prima'::text as insumo_tipo, id as insumo_id, codigo, name from insumos where codigo is not null
union all
select 'empaque', id, codigo, name from envasado_insumos where codigo is not null
union all
select 'vaso_blanco', id, codigo, name from vasos_blancos where codigo is not null
union all
select 'generico', id, codigo, name from inventario_items where codigo is not null;

-- ---------------------------------------------------------------------------
-- 0040_unidad_materia_prima_empaque.sql
-- ---------------------------------------------------------------------------
-- Materia prima y material de empaque no tenían unidad de medida (solo
-- vasos blancos y el catálogo genérico la tenían) -- se agrega para poder
-- mostrarla junto al stock en /inventario.
alter table insumos add column unit text not null default 'unidades';
alter table envasado_insumos add column unit text not null default 'unidades';

drop view v_inventario_stock;
create view v_inventario_stock as
select
  'materia_prima'::text as insumo_tipo,
  i.id as insumo_id,
  i.name,
  i.unit,
  i.codigo,
  i.categoria_id,
  i.stock_minimo,
  coalesce(sum(m.cantidad), 0) as stock_actual
from insumos i
left join inventario_movimientos m
  on m.insumo_tipo = 'materia_prima' and m.insumo_id = i.id
where i.active
group by i.id, i.name, i.unit, i.codigo, i.categoria_id, i.stock_minimo
union all
select
  'empaque',
  ei.id,
  ei.name,
  ei.unit,
  ei.codigo,
  ei.categoria_id,
  ei.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from envasado_insumos ei
left join inventario_movimientos m
  on m.insumo_tipo = 'empaque' and m.insumo_id = ei.id
where ei.active
group by ei.id, ei.name, ei.unit, ei.codigo, ei.categoria_id, ei.stock_minimo
union all
select
  'vaso_blanco',
  vb.id,
  vb.name,
  vb.unit,
  vb.codigo,
  vb.categoria_id,
  vb.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from vasos_blancos vb
left join inventario_movimientos m
  on m.insumo_tipo = 'vaso_blanco' and m.insumo_id = vb.id
where vb.active
group by vb.id, vb.name, vb.unit, vb.codigo, vb.categoria_id, vb.stock_minimo
union all
select
  'generico',
  gi.id,
  gi.name,
  gi.unit,
  gi.codigo,
  gi.categoria_id,
  gi.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from inventario_items gi
left join inventario_movimientos m
  on m.insumo_tipo = 'generico' and m.insumo_id = gi.id
where gi.active
group by gi.id, gi.name, gi.unit, gi.codigo, gi.categoria_id, gi.stock_minimo;

-- ---------------------------------------------------------------------------
-- 0041_asistente_adm_entradas_inventario.sql
-- ---------------------------------------------------------------------------
-- Asistente Adm puede registrar entradas de inventario (compras) e
-- importarlas por Excel, igual que jefe_planta/supervisor, pero NO puede
-- registrar ajustes -- se restringe a nivel de fila por el "tipo" del
-- movimiento, no solo en la UI.
drop policy "inventario_movimientos_insert" on inventario_movimientos;
create policy "inventario_movimientos_insert" on inventario_movimientos
  for insert to authenticated
  with check (is_staff() or (current_role_is('asistente_adm') and tipo = 'entrada'));

-- ---------------------------------------------------------------------------
-- 0042_despacho_materiales.sql
-- ---------------------------------------------------------------------------
-- Despacho de materiales a otra bodega (Funza, Chía, Bodega Luis, Guasca):
-- resta stock igual que un consumo, pero es una salida manual, no ligada a
-- un bache/envasado/enmangado -- queda registrada con su bodega destino.
alter table inventario_movimientos add column destino text;
alter table inventario_movimientos drop constraint inventario_movimientos_tipo_check;
alter table inventario_movimientos add constraint inventario_movimientos_tipo_check
  check (tipo in ('entrada', 'consumo', 'ajuste', 'despacho'));

-- ---------------------------------------------------------------------------
-- 0043_asistente_adm_despacho_inventario.sql
-- ---------------------------------------------------------------------------
-- Asistente Adm también puede registrar despachos de materiales a otra
-- bodega, además de entradas -- sigue sin poder registrar ajustes.
drop policy "inventario_movimientos_insert" on inventario_movimientos;
create policy "inventario_movimientos_insert" on inventario_movimientos
  for insert to authenticated
  with check (
    is_staff()
    or (current_role_is('asistente_adm') and tipo in ('entrada', 'despacho'))
  );

-- ---------------------------------------------------------------------------
-- 0044_equipos.sql
-- ---------------------------------------------------------------------------
-- Catálogo de equipos: generaliza "tanques" (solo nombre) a cualquier
-- equipo de proceso (tanque, pasteurizador, homogeneizador, marmita,
-- etc.), con tipo y capacidad -- base para el diagrama de Gantt, el
-- pronóstico de terminación y la ocupación de equipos.
create table equipos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tipo text not null default 'tanque',
  capacidad numeric(10, 2),
  unidad text not null default 'L',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table equipos enable row level security;
create policy "equipos_select_all" on equipos
  for select to authenticated using (true);
create policy "equipos_write_jefe" on equipos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- Se migran los tanques existentes como equipos de tipo "tanque" (sin
-- capacidad todavía -- se puede cargar después desde Administración).
insert into equipos (name, tipo, active, created_at)
select name, 'tanque', active, created_at from tanques;

-- Una etapa puede requerir un equipo (se elige uno específico al iniciar
-- la etapa, no al finalizarla, para poder saber en tiempo real qué se
-- está usando ahora mismo). "equipo_tipo" es un filtro opcional: si se
-- carga, solo se ofrecen equipos de ese tipo al elegir.
alter table process_stage_templates add column requires_equipo boolean not null default false;
alter table process_stage_templates add column equipo_tipo text;

-- Equipo elegido al iniciar la etapa -- la ventana de ocupación de ese
-- equipo es directamente [started_at, ended_at] de este registro.
alter table bache_stage_records add column equipo_id uuid references equipos(id);
create index idx_bache_stage_records_equipo on bache_stage_records(equipo_id) where equipo_id is not null;

-- ---------------------------------------------------------------------------
-- 0045_equipo_fijo_por_etapa.sql
-- ---------------------------------------------------------------------------
-- Equipo fijo por etapa: para equipos de los que solo hay una unidad
-- (pasteurizador, homogeneizador, etc.), se asigna una vez en la etapa y
-- no hace falta que el operario elija nada al iniciarla -- se usa
-- automáticamente. "requires_equipo" + "equipo_tipo" (de la migración
-- anterior) quedan para equipos de los que hay varios y el operario elige
-- el que esté libre (ej. tanques de almacenamiento).
alter table process_stage_templates add column equipo_id uuid references equipos(id);

-- ---------------------------------------------------------------------------
-- 0046_multiples_equipos_por_etapa.sql
-- ---------------------------------------------------------------------------
-- Una etapa puede necesitar más de un equipo a la vez (ej. un tanque Y un
-- pasteurizador juntos), así que el requerimiento de equipo pasa de ser
-- una sola columna en process_stage_templates a una lista en una tabla
-- aparte. Cada fila es "fijo" (siempre el mismo equipo, se asigna acá,
-- el operario no elige nada) o "elige" (el operario elige entre los
-- equipos de ese tipo, según cuál esté libre).
create table stage_equipo_requirements (
  id uuid primary key default gen_random_uuid(),
  stage_template_id uuid not null references process_stage_templates(id) on delete cascade,
  modo text not null check (modo in ('fijo', 'elige')),
  equipo_id uuid references equipos(id),
  equipo_tipo text,
  orden integer not null default 1,
  created_at timestamptz not null default now()
);

alter table stage_equipo_requirements enable row level security;
create policy "stage_equipo_requirements_select_all" on stage_equipo_requirements
  for select to authenticated using (true);
create policy "stage_equipo_requirements_write_jefe" on stage_equipo_requirements
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- Se migra la configuración de un solo equipo por etapa que ya existía.
insert into stage_equipo_requirements (stage_template_id, modo, equipo_id, equipo_tipo)
select id, 'fijo', equipo_id, null from process_stage_templates where equipo_id is not null;

insert into stage_equipo_requirements (stage_template_id, modo, equipo_id, equipo_tipo)
select id, 'elige', null, equipo_tipo from process_stage_templates where requires_equipo;

alter table process_stage_templates drop column requires_equipo;
alter table process_stage_templates drop column equipo_tipo;
alter table process_stage_templates drop column equipo_id;

-- Equipos realmente usados en una etapa de un bache (uno por requerimiento
-- cumplido). La ventana de ocupación de cada equipo es
-- [bache_stage_records.started_at, bache_stage_records.ended_at] del
-- registro al que está ligado.
create table bache_stage_record_equipos (
  id uuid primary key default gen_random_uuid(),
  stage_record_id uuid not null references bache_stage_records(id) on delete cascade,
  requirement_id uuid references stage_equipo_requirements(id),
  equipo_id uuid not null references equipos(id),
  created_at timestamptz not null default now()
);

alter table bache_stage_record_equipos enable row level security;
create policy "bache_stage_record_equipos_select" on bache_stage_record_equipos
  for select to authenticated using (is_staff() or current_role_is('asistente_adm') or current_role_is('calidad'));
create policy "bache_stage_record_equipos_insert" on bache_stage_record_equipos
  for insert to authenticated with check (is_staff());

create index idx_bache_stage_record_equipos_equipo on bache_stage_record_equipos(equipo_id);
create index idx_bache_stage_record_equipos_record on bache_stage_record_equipos(stage_record_id);

-- Se migra el equipo único que ya se hubiera guardado en algún registro.
insert into bache_stage_record_equipos (stage_record_id, equipo_id)
select id, equipo_id from bache_stage_records where equipo_id is not null;

alter table bache_stage_records drop column equipo_id;

-- ---------------------------------------------------------------------------
-- 0047_fix_borrar_requerimiento_equipo.sql
-- ---------------------------------------------------------------------------
-- Al editar los equipos de una etapa, se borra la lista vieja y se inserta
-- la nueva (igual que parameter_schema). Pero si algún bache ya usó un
-- equipo para un requerimiento puntual, quedaba una fila en
-- bache_stage_record_equipos apuntándolo, y el borrado fallaba por la
-- referencia (sin "on delete"). El error no se revisaba, así que el
-- guardado seguía igual e insertaba la lista nueva encima de la vieja --
-- por eso la lista de equipos de una etapa solo crecía y nunca bajaba.
-- Con "on delete set null" el borrado ya no falla; el registro histórico
-- de qué equipo se usó queda igual (equipo_id no se toca), solo se pierde
-- la referencia a CUÁL requerimiento puntual era.
alter table bache_stage_record_equipos
  drop constraint bache_stage_record_equipos_requirement_id_fkey;
alter table bache_stage_record_equipos
  add constraint bache_stage_record_equipos_requirement_id_fkey
  foreign key (requirement_id) references stage_equipo_requirements(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 0048_drop_view_envasado_operario.sql
-- ---------------------------------------------------------------------------
-- "Envasado por operario" en Estadísticas dejó de usar esta vista: agrupaba
-- por envasados.operario_id, que le cargaba TODAS las unidades del envasado
-- a un solo operario elegido al iniciar. Ahora se calcula por turno
-- (envasado_cortes + envasado_estibas), acreditando cada turno a los
-- operarios que realmente lo trabajaron.
drop view if exists v_estadisticas_envasado_operario;

-- ---------------------------------------------------------------------------
-- 0049_envasado_referencia_productos.sql
-- ---------------------------------------------------------------------------
-- Una referencia de envasado puede usarse para varios productos base (ej.
-- "Entero de la Cuesta" y "Entero de la Cuesta R." empacan exactamente lo
-- mismo aunque sean recetas/baches distintos) -- antes quedaba atada a un
-- solo producto vía envasado_referencias.product_id, que se deja como el
-- producto "principal" (se sigue completando al crear/editar la
-- referencia, por compatibilidad con lo que ya lo lee) pero deja de ser
-- la única fuente de verdad de a qué productos aplica.
create table envasado_referencia_productos (
  referencia_id uuid not null references envasado_referencias(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (referencia_id, product_id)
);

alter table envasado_referencia_productos enable row level security;

create policy "envasado_referencia_productos_select_all" on envasado_referencia_productos
  for select to authenticated using (true);
create policy "envasado_referencia_productos_write_jefe" on envasado_referencia_productos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- Se completa con lo que ya había en product_id, para no perder la
-- asociación existente de cada referencia.
insert into envasado_referencia_productos (referencia_id, product_id)
select id, product_id from envasado_referencias
on conflict do nothing;
