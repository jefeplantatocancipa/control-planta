-- Materia prima y material de empaque no tenían unidad de medida (solo
-- vasos blancos y el catálogo genérico la tenían) -- se agrega para poder
-- mostrarla junto al stock en /inventario.
alter table insumos add column unit text not null default 'unidades';
alter table envasado_insumos add column unit text not null default 'unidades';

drop view v_inventario_stock;
create view v_inventario_stock as
select
  'materia_prima'::text as insumo_tipo,
  i.id as insumo_id,
  i.name,
  i.unit,
  i.codigo,
  i.categoria_id,
  i.stock_minimo,
  coalesce(sum(m.cantidad), 0) as stock_actual
from insumos i
left join inventario_movimientos m
  on m.insumo_tipo = 'materia_prima' and m.insumo_id = i.id
where i.active
group by i.id, i.name, i.unit, i.codigo, i.categoria_id, i.stock_minimo
union all
select
  'empaque',
  ei.id,
  ei.name,
  ei.unit,
  ei.codigo,
  ei.categoria_id,
  ei.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from envasado_insumos ei
left join inventario_movimientos m
  on m.insumo_tipo = 'empaque' and m.insumo_id = ei.id
where ei.active
group by ei.id, ei.name, ei.unit, ei.codigo, ei.categoria_id, ei.stock_minimo
union all
select
  'vaso_blanco',
  vb.id,
  vb.name,
  vb.unit,
  vb.codigo,
  vb.categoria_id,
  vb.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from vasos_blancos vb
left join inventario_movimientos m
  on m.insumo_tipo = 'vaso_blanco' and m.insumo_id = vb.id
where vb.active
group by vb.id, vb.name, vb.unit, vb.codigo, vb.categoria_id, vb.stock_minimo
union all
select
  'generico',
  gi.id,
  gi.name,
  gi.unit,
  gi.codigo,
  gi.categoria_id,
  gi.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from inventario_items gi
left join inventario_movimientos m
  on m.insumo_tipo = 'generico' and m.insumo_id = gi.id
where gi.active
group by gi.id, gi.name, gi.unit, gi.codigo, gi.categoria_id, gi.stock_minimo;
