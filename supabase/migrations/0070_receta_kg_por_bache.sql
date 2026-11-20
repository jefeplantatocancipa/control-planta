-- La cantidad de receta se carga por bache (volumen estándar del producto,
-- configurado en Administración → Productos), no por cada 1.000 L.
alter table product_insumos
  rename column cantidad_kg_por_1000l to cantidad_kg_por_bache;
