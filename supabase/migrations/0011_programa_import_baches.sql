-- Soporta el importador de Excel del programa de producción (Baches): la
-- planilla real de la planta trae orden de producción, tanque, cantidad de
-- baches planeados y horas de inicio/final planeadas. Las horas "reales" no
-- se guardan acá: se calculan a partir de los baches ya vinculados a la
-- orden (production_order_id), igual que el resto de horas automáticas de
-- la app.

alter table production_orders
  add column orden_codigo text,
  add column tanque text,
  add column baches_planeados int check (baches_planeados > 0),
  add column hora_inicio_planeada timestamptz,
  add column hora_final_planeada timestamptz;

alter table production_orders
  add constraint production_orders_orden_codigo_key unique (orden_codigo);

-- La cantidad planeada en litros/unidades sigue existiendo para la carga
-- manual, pero deja de ser obligatoria: las órdenes importadas desde Excel
-- planean por cantidad de baches, no por volumen.
alter table production_orders
  alter column planned_quantity drop not null;
