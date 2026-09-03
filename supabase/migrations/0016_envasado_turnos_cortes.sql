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
