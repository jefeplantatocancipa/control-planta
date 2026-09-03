-- El sku del "Formato de Empaque" identifica una presentación empacada
-- concreta (ej. "Yogurt Griego Entero 450 g"), no el producto a granel del
-- bache. Se agrega un catálogo propio, análogo al de enmangado_referencias,
-- y el programa de Envasado pasa a planear por referencia en vez de por
-- producto directamente.
--
-- envasado_orders recién se creó en 0013 y todavía no tiene datos en uso
-- (el primer intento de import falló por no encontrar coincidencias), así
-- que se recrea limpio en vez de alterar columna por columna.
drop table if exists envasado_orders;

create table envasado_referencias (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  sku text not null unique,
  name text not null,
  peso_unitario numeric(12, 2) not null check (peso_unitario > 0),
  multiempaque int not null default 1 check (multiempaque > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table envasado_referencias enable row level security;

create policy "envasado_referencias_select_all" on envasado_referencias
  for select to authenticated using (true);
create policy "envasado_referencias_write_jefe" on envasado_referencias
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));

create table envasado_orders (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references production_programs(id) on delete cascade,
  referencia_id uuid not null references envasado_referencias(id),
  linea text,
  scheduled_date date not null,
  planned_quantity numeric(12, 2) not null check (planned_quantity > 0),
  status order_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  unique (scheduled_date, linea, referencia_id)
);

alter table envasado_orders enable row level security;

create policy "envasado_orders_select_all" on envasado_orders
  for select to authenticated using (true);
create policy "envasado_orders_write_jefe" on envasado_orders
  for all to authenticated
  using (current_role_is('jefe_planta'))
  with check (current_role_is('jefe_planta'));
