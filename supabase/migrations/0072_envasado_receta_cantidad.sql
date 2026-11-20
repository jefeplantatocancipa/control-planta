-- La receta de material de empaque por referencia era solo un checklist
-- (qué insumos aplican) sin cantidad -- hace falta para calcular Pedido de
-- insumos. Cantidad de ese insumo por cada unidad envasada (para cajas se
-- carga como fracción, ej. 1/24).
alter table envasado_referencia_insumos
  add column cantidad_por_unidad numeric;
