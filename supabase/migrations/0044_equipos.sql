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
