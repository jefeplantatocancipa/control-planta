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
