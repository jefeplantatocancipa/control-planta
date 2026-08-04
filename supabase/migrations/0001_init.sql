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
