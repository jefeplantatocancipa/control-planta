-- Despacho de materiales a otra bodega (Funza, Chía, Bodega Luis, Guasca):
-- resta stock igual que un consumo, pero es una salida manual, no ligada a
-- un bache/envasado/enmangado -- queda registrada con su bodega destino.
alter table inventario_movimientos add column destino text;
alter table inventario_movimientos drop constraint inventario_movimientos_tipo_check;
alter table inventario_movimientos add constraint inventario_movimientos_tipo_check
  check (tipo in ('entrada', 'consumo', 'ajuste', 'despacho'));
