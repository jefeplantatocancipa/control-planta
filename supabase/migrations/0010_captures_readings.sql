-- ============================================================================
-- Etapas como "Curva de fermentación": en vez de capturar los parámetros una
-- sola vez al finalizar, se toman varias lecturas a lo largo del tiempo (cada
-- una con su hora automática) mientras la etapa sigue en curso. Es un flag
-- independiente, igual que captures_insumos: una etapa puede combinar ambos.
-- ============================================================================

alter table process_stage_templates
  add column captures_readings boolean not null default false;
