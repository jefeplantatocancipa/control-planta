-- Infraestructura compartida para el control de desviaciones en la
-- preparación de baches (tiempo de etapa y receta de insumos). Las partes
-- que detectan cada tipo de desviación (alarmas por tiempo, tolerancias de
-- receta) escriben acá; esta tabla es la base de ambas.

create type desviacion_tipo as enum ('tiempo', 'receta');
create type desviacion_motivo as enum (
  'falla_equipo',
  'espera_insumos',
  'espera_leche',
  'ajuste_proceso',
  'error_registro',
  'otro'
);

create table desviaciones (
  id uuid primary key default gen_random_uuid(),
  bache_id uuid not null references baches(id) on delete cascade,
  stage_record_id uuid not null references bache_stage_records(id) on delete cascade,
  tipo desviacion_tipo not null,
  insumo_id uuid references insumos(id), -- solo tipo='receta'
  valor_real numeric not null, -- minutos (tiempo) o kg (receta)
  valor_esperado numeric,
  limite_inferior numeric,
  limite_superior numeric,
  motivo desviacion_motivo not null,
  descripcion text not null check (char_length(descripcion) >= 10),
  turno_id uuid references turnos(id),
  bitacora_entrada_id uuid references bitacora_entradas(id),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_desviaciones_bache on desviaciones(bache_id);

-- Firma de calidad/jefe de planta sobre una desviación, mismo esquema que
-- bache_stage_firmas (0031_calidad_firmas.sql).
create table desviacion_firmas (
  id uuid primary key default gen_random_uuid(),
  desviacion_id uuid not null unique references desviaciones(id) on delete cascade,
  aprobado boolean not null,
  observaciones text,
  firmado_por uuid references profiles(id),
  firmado_at timestamptz not null default now()
);

-- Para poder enlazar la entrada automática de bitácora al bache que
-- originó la desviación (hoy bitacora_entradas no tiene esa referencia).
alter table bitacora_entradas add column bache_id uuid references baches(id) on delete set null;

alter table desviaciones enable row level security;
create policy "desviaciones_select" on desviaciones
  for select to authenticated
  using (is_staff() or current_role_is('calidad'));
create policy "desviaciones_insert" on desviaciones
  for insert to authenticated
  with check (is_staff());

alter table desviacion_firmas enable row level security;
create policy "desviacion_firmas_select" on desviacion_firmas
  for select to authenticated
  using (is_staff() or current_role_is('calidad'));
create policy "desviacion_firmas_write" on desviacion_firmas
  for all to authenticated
  using (current_role_is('calidad') or current_role_is('jefe_planta'))
  with check (current_role_is('calidad') or current_role_is('jefe_planta'));
