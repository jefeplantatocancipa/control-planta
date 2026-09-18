-- Asistente Adm puede registrar entradas de inventario (compras) e
-- importarlas por Excel, igual que jefe_planta/supervisor, pero NO puede
-- registrar ajustes -- se restringe a nivel de fila por el "tipo" del
-- movimiento, no solo en la UI.
drop policy "inventario_movimientos_insert" on inventario_movimientos;
create policy "inventario_movimientos_insert" on inventario_movimientos
  for insert to authenticated
  with check (is_staff() or (current_role_is('asistente_adm') and tipo = 'entrada'));
