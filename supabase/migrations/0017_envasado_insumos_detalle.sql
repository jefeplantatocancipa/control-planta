-- Para poder importar el catálogo de material de empaque desde Excel, con
-- presentación por caja y marca(s), tal como lo maneja la planta.
alter table envasado_insumos
  add column presentacion_caja text,
  add column marca text;
