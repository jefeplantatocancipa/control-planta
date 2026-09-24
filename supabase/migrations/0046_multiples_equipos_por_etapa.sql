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
