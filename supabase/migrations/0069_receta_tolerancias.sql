-- Receta estándar por insumo: cantidad esperada (kg por cada 1.000 L de
-- bache), tolerancias y si es obligatorio. Todo opcional -- sin tolerancia
-- cargada para un insumo, no hay alarma para ese insumo (se muestra la
-- cantidad esperada nomás, si está cargada).
alter table product_insumos
  add column cantidad_kg_por_1000l numeric,
  add column tolerancia_inferior_pct numeric,
  add column tolerancia_superior_pct numeric,
  add column obligatorio boolean not null default false;

-- Hace falta para poder hacer upsert por (product_id, insumo_id) desde la
-- carga masiva -- hoy el guardado manual evita duplicados borrando y
-- reinsertando todo, pero el importador necesita poder actualizar una fila
-- puntual sin tocar el resto de la receta.
alter table product_insumos
  add constraint product_insumos_product_insumo_key unique (product_id, insumo_id);
