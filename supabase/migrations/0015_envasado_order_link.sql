-- Igual que baches.production_order_id: permite iniciar un envasado a
-- partir de una orden de trabajo del programa (envasado_orders), en vez de
-- cargar la presentación a mano cada vez.
alter table envasados
  add column envasado_order_id uuid references envasado_orders(id);
