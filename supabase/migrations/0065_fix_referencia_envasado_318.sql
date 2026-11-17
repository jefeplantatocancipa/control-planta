-- El envasado del bache 318 (lote 320 Tq2) quedó con la referencia
-- equivocada ("15257011206 — YOGURT GRIEGO ENTERO NATURAL DE LA CUESTA
-- 1000G") -- corresponde a "15116311279 — YOG GRIEGO SKETOS NATURAL
-- ENTERO 1000 G". Se corrige tanto referencia_id como el texto congelado
-- de presentacion (lo que se ve en la tabla de Finalizados), para que
-- queden consistentes entre sí.
update envasados
set
  referencia_id = (select id from envasado_referencias where sku = '15116311279'),
  presentacion = (
    select sku || ' — ' || name from envasado_referencias where sku = '15116311279'
  )
where id = '2b738496-0628-4ca5-bbba-c15987ed2edc';
