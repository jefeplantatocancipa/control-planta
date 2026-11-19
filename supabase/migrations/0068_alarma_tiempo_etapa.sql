-- Alarma de tiempo por etapa: tiempo estándar (manual, prioritario sobre
-- el calculado en la app a partir de la mediana histórica) + tolerancias
-- + activar/desactivar. Todo opcional/con default -- sin configurar, no
-- hay alarma (ver src/lib/duracion-estandar.ts).
alter table process_stage_templates
  add column standard_duration_min numeric,
  add column duration_tolerance_low_pct numeric not null default 30,
  add column duration_tolerance_high_pct numeric not null default 30,
  add column duration_alarm_enabled boolean not null default true;
