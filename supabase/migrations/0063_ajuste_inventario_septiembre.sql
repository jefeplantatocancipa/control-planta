-- Ajuste adicional al inventario final de septiembre 2026: +2.800 kg sobre
-- lo que ya estaba cargado (9.200 -> 12.000 kg).
update inventario_producto_terminado_mensual
set
  kilos = kilos + 2800,
  notas = coalesce(notas || ' ', '') || 'Ajuste adicional de +2.800 kg.',
  updated_at = now()
where mes = '2026-09-01';
