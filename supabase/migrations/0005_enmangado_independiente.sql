-- ============================================================================
-- El enmangado (etiquetado de vasos blancos por referencia) es un proceso
-- propio, planificado y medido igual que la producción de baches, pero
-- independiente de un envasado puntual. Se le da su propio programa/órdenes
-- (mismo patrón que production_programs/production_orders) y la captura pasa
-- a referenciar el producto (la "referencia") en vez de un envasado.
-- ============================================================================

create table enmangado_programs (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  status program_status not null default 'borrador',
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (week_start_date)
);

create table enmangado_orders (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references enmangado_programs(id) on delete cascade,
  product_id uuid not null references products(id),
  scheduled_date date not null,
  planned_quantity numeric(12, 2) not null check (planned_quantity > 0),
  unit text not null default 'unidades',
  status order_status not null default 'pendiente',
  created_at timestamptz not null default now()
);

create index idx_enmangado_orders_program on enmangado_orders(program_id);
create index idx_enmangado_orders_scheduled_date on enmangado_orders(scheduled_date);

alter table enmangado_programs enable row level security;
alter table enmangado_orders enable row level security;

create policy "enmangado_programs_select_all" on enmangado_programs
  for select to authenticated using (true);
create policy "enmangado_programs_write_jefe" on enmangado_programs
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

create policy "enmangado_orders_select_all" on enmangado_orders
  for select to authenticated using (true);
create policy "enmangado_orders_write_jefe" on enmangado_orders
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

-- vasos_enmangados ya no cuelga de un envasado puntual: cuelga de la
-- referencia (producto) que se está etiquetando y, opcionalmente, de la
-- orden de enmangado planificada para ese día.
alter table vasos_enmangados
  add column product_id uuid references products(id),
  add column enmangado_order_id uuid references enmangado_orders(id);

-- Backfill para filas existentes (datos de prueba) antes de exigir NOT NULL.
update vasos_enmangados ve
set product_id = b.product_id
from envasados e
join baches b on b.id = e.bache_id
where e.id = ve.envasado_id
  and ve.product_id is null;

alter table vasos_enmangados
  alter column product_id set not null,
  drop column envasado_id;

create index idx_vasos_enmangados_product on vasos_enmangados(product_id);
create index idx_vasos_enmangados_order on vasos_enmangados(enmangado_order_id);
