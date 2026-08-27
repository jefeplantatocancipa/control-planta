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
