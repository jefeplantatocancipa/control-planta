-- Inventario final de producto terminado sin empacar -- valores
-- definitivos reportados por planta, reemplazan los que había cargados
-- (incluye octubre, que todavía no tenía dato).
insert into inventario_producto_terminado_mensual (mes, kilos, notas)
values
  ('2026-07-01', 2100, 'Inventario final de cierre de mes, reportado por planta (definitivo).'),
  ('2026-08-01', 6000, 'Inventario final de cierre de mes, reportado por planta (definitivo).'),
  ('2026-09-01', 9200, 'Inventario final de cierre de mes, reportado por planta (definitivo).'),
  ('2026-10-01', 8000, 'Inventario final de cierre de mes, reportado por planta (definitivo).')
on conflict (mes) do update set
  kilos = excluded.kilos,
  notas = excluded.notas,
  updated_at = now();
