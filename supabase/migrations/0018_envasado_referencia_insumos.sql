-- Receta de material de empaque por referencia (sku): qué insumos de
-- envasado corresponden a cada presentación, igual que product_insumos
-- para la receta de materia prima por producto.
create table envasado_referencia_insumos (
  referencia_id uuid not null references envasado_referencias(id) on delete cascade,
  envasado_insumo_id uuid not null references envasado_insumos(id) on delete cascade,
  primary key (referencia_id, envasado_insumo_id)
);

alter table envasado_referencia_insumos enable row level security;

create policy "envasado_referencia_insumos_select_all" on envasado_referencia_insumos
  for select to authenticated using (true);
create policy "envasado_referencia_insumos_write_jefe" on envasado_referencia_insumos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));
