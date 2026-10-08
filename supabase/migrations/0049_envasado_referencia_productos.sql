-- Una referencia de envasado puede usarse para varios productos base (ej.
-- "Entero de la Cuesta" y "Entero de la Cuesta R." empacan exactamente lo
-- mismo aunque sean recetas/baches distintos) -- antes quedaba atada a un
-- solo producto vía envasado_referencias.product_id, que se deja como el
-- producto "principal" (se sigue completando al crear/editar la
-- referencia, por compatibilidad con lo que ya lo lee) pero deja de ser
-- la única fuente de verdad de a qué productos aplica.
create table envasado_referencia_productos (
  referencia_id uuid not null references envasado_referencias(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (referencia_id, product_id)
);

alter table envasado_referencia_productos enable row level security;

create policy "envasado_referencia_productos_select_all" on envasado_referencia_productos
  for select to authenticated using (true);
create policy "envasado_referencia_productos_write_jefe" on envasado_referencia_productos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- Se completa con lo que ya había en product_id, para no perder la
-- asociación existente de cada referencia.
insert into envasado_referencia_productos (referencia_id, product_id)
select id, product_id from envasado_referencias
on conflict do nothing;
