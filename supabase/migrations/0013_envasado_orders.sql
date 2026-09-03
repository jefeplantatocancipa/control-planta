-- Programa (plan) de Envasado, segunda parte del importador de Excel del
-- módulo Programa de producción: comparte la misma semana/programa que las
-- órdenes de Baches (production_programs), pero planea por SKU + línea +
-- unidades a envasar (no por baches).
create table envasado_orders (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references production_programs(id) on delete cascade,
  product_id uuid not null references products(id),
  linea text,
  scheduled_date date not null,
  planned_quantity numeric(12, 2) not null check (planned_quantity > 0),
  gramaje_por_unidad numeric(12, 2) check (gramaje_por_unidad > 0),
  status order_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  unique (scheduled_date, linea, product_id)
);

alter table envasado_orders enable row level security;

create policy "envasado_orders_select_all" on envasado_orders
  for select to authenticated using (true);
create policy "envasado_orders_write_jefe" on envasado_orders
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));
