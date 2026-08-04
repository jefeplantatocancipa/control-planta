-- ============================================================================
-- Vistas de soporte para dashboards y estadísticas
-- ============================================================================

-- Proceso actual: para cada bache activo, su última etapa (la que no tiene
-- ended_at, o la más reciente si todas están cerradas), para pintar el
-- tablero en vivo de las 8 etapas.
create view v_proceso_actual as
select
  b.id as bache_id,
  b.batch_code,
  b.product_id,
  p.name as product_name,
  b.status as bache_status,
  b.started_at as bache_started_at,
  st.id as stage_id,
  st.name as stage_name,
  st.sequence_order,
  sr.id as stage_record_id,
  sr.operario_id,
  pr.full_name as operario_name,
  sr.started_at as stage_started_at,
  sr.ended_at as stage_ended_at,
  sr.parameters
from baches b
join products p on p.id = b.product_id
left join lateral (
  select sr2.*
  from bache_stage_records sr2
  where sr2.bache_id = b.id
  order by (sr2.ended_at is null) desc, sr2.started_at desc
  limit 1
) sr on true
left join process_stage_templates st on st.id = sr.stage_template_id
left join profiles pr on pr.id = sr.operario_id
where b.status = 'en_proceso';

-- Cumplimiento del programa: planeado (production_orders) vs ejecutado
-- (unidades envasadas + vasos enmangados asociados a baches de esa orden).
create view v_cumplimiento_programa as
select
  po.id as production_order_id,
  po.program_id,
  pp.week_start_date,
  po.scheduled_date,
  po.product_id,
  pr.name as product_name,
  po.planned_quantity,
  po.unit,
  coalesce(sum(e.cantidad_unidades), 0) as executed_quantity,
  case
    when po.planned_quantity = 0 then 0
    else round(coalesce(sum(e.cantidad_unidades), 0) / po.planned_quantity * 100, 1)
  end as cumplimiento_pct
from production_orders po
join production_programs pp on pp.id = po.program_id
join products pr on pr.id = po.product_id
left join baches b on b.production_order_id = po.id
left join envasados e on e.bache_id = b.id
group by po.id, pp.week_start_date, pr.name;

-- Estadísticas por operario: duración promedio por etapa, unidades
-- producidas y tasa de mermas, para el módulo de estadísticas.
create view v_estadisticas_operario as
select
  pr.id as operario_id,
  pr.full_name as operario_name,
  st.id as stage_id,
  st.name as stage_name,
  count(sr.id) as etapas_completadas,
  avg(extract(epoch from (sr.ended_at - sr.started_at)) / 60) filter (where sr.ended_at is not null) as duracion_promedio_min
from bache_stage_records sr
join profiles pr on pr.id = sr.operario_id
join process_stage_templates st on st.id = sr.stage_template_id
group by pr.id, pr.full_name, st.id, st.name;

create view v_estadisticas_envasado_operario as
select
  pr.id as operario_id,
  pr.full_name as operario_name,
  count(e.id) as eventos_envasado,
  sum(e.cantidad_unidades) as total_unidades,
  sum(e.cantidad_mermas) as total_mermas,
  case
    when sum(e.cantidad_unidades) + sum(e.cantidad_mermas) = 0 then 0
    else round(sum(e.cantidad_mermas) / (sum(e.cantidad_unidades) + sum(e.cantidad_mermas)) * 100, 2)
  end as tasa_merma_pct
from envasados e
join profiles pr on pr.id = e.operario_id
group by pr.id, pr.full_name;
