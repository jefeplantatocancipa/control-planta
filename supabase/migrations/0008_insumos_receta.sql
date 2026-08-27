-- ============================================================================
-- Catálogo de insumos y receta por producto: la etapa "Alistamiento de
-- insumos" pasa de una lista libre a un checklist basado en los insumos que
-- le corresponden al producto del bache.
-- ============================================================================

create table insumos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table product_insumos (
  product_id uuid not null references products(id) on delete cascade,
  insumo_id uuid not null references insumos(id) on delete cascade,
  primary key (product_id, insumo_id)
);

create index idx_product_insumos_product on product_insumos(product_id);
create index idx_product_insumos_insumo on product_insumos(insumo_id);

alter table insumos enable row level security;
alter table product_insumos enable row level security;

create policy "insumos_select_all" on insumos
  for select to authenticated using (true);
create policy "insumos_write_jefe" on insumos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

create policy "product_insumos_select_all" on product_insumos
  for select to authenticated using (true);
create policy "product_insumos_write_jefe" on product_insumos
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));
