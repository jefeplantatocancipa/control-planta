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
