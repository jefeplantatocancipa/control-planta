-- Asistente Adm también puede registrar despachos de materiales a otra
-- bodega, además de entradas -- sigue sin poder registrar ajustes.
drop policy "inventario_movimientos_insert" on inventario_movimientos;
create policy "inventario_movimientos_insert" on inventario_movimientos
  for insert to authenticated
  with check (
    is_staff()
    or (current_role_is('asistente_adm') and tipo in ('entrada', 'despacho'))
  );
