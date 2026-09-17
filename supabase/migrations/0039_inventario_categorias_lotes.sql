-- Categorías abiertas de inventario (vos las creás/editás, no quedan fijas
-- en 3). Cada categoría dice a qué sistema alimenta ("tabla_destino"):
-- materia_prima -> insumos (recetas de bache), empaque -> envasado_insumos
-- (recetas de envasado), vaso_blanco -> vasos_blancos (enmangado), o
-- generico -> inventario_items (solo stock, sin receta -- ej. aseo,
-- producto enmangado terminado) para lo que no encaja en los tres
-- catálogos ya ligados a una receta.
create table inventario_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tabla_destino text not null default 'generico'
    check (tabla_destino in ('materia_prima', 'empaque', 'vaso_blanco', 'generico')),
  created_at timestamptz not null default now()
);

alter table inventario_categorias enable row level security;
create policy "inventario_categorias_select_all" on inventario_categorias
  for select to authenticated using (true);
create policy "inventario_categorias_write_jefe" on inventario_categorias
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

insert into inventario_categorias (nombre, tabla_destino) values
  ('Materia prima', 'materia_prima'),
  ('Empaque', 'empaque'),
  ('Vaso blanco', 'vaso_blanco');

-- "Código" (el identificador del Excel del cliente) y categoría en los tres
-- catálogos que ya existían y que ya alimentan una receta -- así el
-- importador puede hacer upsert por código en vez de por nombre, y esos
-- insumos importados ya aparecen para elegir en las recetas sin tocar nada
-- más.
alter table insumos add column codigo text unique;
alter table insumos add column categoria_id uuid references inventario_categorias(id);
alter table envasado_insumos add column codigo text unique;
alter table envasado_insumos add column categoria_id uuid references inventario_categorias(id);
alter table vasos_blancos add column codigo text unique;
alter table vasos_blancos add column categoria_id uuid references inventario_categorias(id);

-- Catálogo genérico: todo lo que el Excel trae y no corresponde a ninguno
-- de los tres catálogos de arriba (ej. aseo, producto enmangado
-- terminado). Solo se controla por entradas/ajustes manuales -- no hay
-- receta ni consumo automático para esto todavía.
create table inventario_items (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  name text not null,
  unit text not null default 'unidades',
  categoria_id uuid references inventario_categorias(id),
  stock_minimo numeric(12, 2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table inventario_items enable row level security;
create policy "inventario_items_select_all" on inventario_items
  for select to authenticated using (true);
create policy "inventario_items_write_jefe" on inventario_items
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- Lote de cada movimiento (para poder tener el mismo insumo con saldos de
-- distintos lotes) y el 4to tipo "generico" del catálogo de arriba.
alter table inventario_movimientos add column lote text;
alter table inventario_movimientos drop constraint inventario_movimientos_insumo_tipo_check;
alter table inventario_movimientos add constraint inventario_movimientos_insumo_tipo_check
  check (insumo_tipo in ('materia_prima', 'empaque', 'vaso_blanco', 'generico'));

-- Vista de stock: se reescribe para sumar también el catálogo genérico.
drop view v_inventario_stock;
create view v_inventario_stock as
select
  'materia_prima'::text as insumo_tipo,
  i.id as insumo_id,
  i.name,
  i.codigo,
  i.categoria_id,
  i.stock_minimo,
  coalesce(sum(m.cantidad), 0) as stock_actual
from insumos i
left join inventario_movimientos m
  on m.insumo_tipo = 'materia_prima' and m.insumo_id = i.id
where i.active
group by i.id, i.name, i.codigo, i.categoria_id, i.stock_minimo
union all
select
  'empaque',
  ei.id,
  ei.name,
  ei.codigo,
  ei.categoria_id,
  ei.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from envasado_insumos ei
left join inventario_movimientos m
  on m.insumo_tipo = 'empaque' and m.insumo_id = ei.id
where ei.active
group by ei.id, ei.name, ei.codigo, ei.categoria_id, ei.stock_minimo
union all
select
  'vaso_blanco',
  vb.id,
  vb.name,
  vb.codigo,
  vb.categoria_id,
  vb.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from vasos_blancos vb
left join inventario_movimientos m
  on m.insumo_tipo = 'vaso_blanco' and m.insumo_id = vb.id
where vb.active
group by vb.id, vb.name, vb.codigo, vb.categoria_id, vb.stock_minimo
union all
select
  'generico',
  gi.id,
  gi.name,
  gi.codigo,
  gi.categoria_id,
  gi.stock_minimo,
  coalesce(sum(m.cantidad), 0)
from inventario_items gi
left join inventario_movimientos m
  on m.insumo_tipo = 'generico' and m.insumo_id = gi.id
where gi.active
group by gi.id, gi.name, gi.codigo, gi.categoria_id, gi.stock_minimo;

-- Índice de "dónde vive cada código", para que el importador de entradas
-- pueda resolver un código del Excel sin importar a cuál de los cuatro
-- catálogos pertenece.
create view v_inventario_catalogo as
select 'materia_prima'::text as insumo_tipo, id as insumo_id, codigo, name from insumos where codigo is not null
union all
select 'empaque', id, codigo, name from envasado_insumos where codigo is not null
union all
select 'vaso_blanco', id, codigo, name from vasos_blancos where codigo is not null
union all
select 'generico', id, codigo, name from inventario_items where codigo is not null;
