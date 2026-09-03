-- Volumen equivalente de un bache "estándar" de este producto (en su
-- unidad, generalmente litros). Sirve para sugerir el volumen al crear un
-- bache a partir de una orden de producción importada desde Excel, que
-- planea por cantidad de baches y no por volumen.
alter table products
  add column volumen_por_bache numeric(12, 2) check (volumen_por_bache > 0);
